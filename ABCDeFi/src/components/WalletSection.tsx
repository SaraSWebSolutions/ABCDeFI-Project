import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { AlertCircle, Check, Loader2, ShieldCheck, Unplug, Wallet } from "lucide-react";
import { useWallet } from "../Context/WalletContext";
import { DEPLOYMENT_CHAIN_ID, DEPLOYMENT_NETWORK } from "../Config/contracts";
import {
  ABCDTokenState,
  approveSpender,
  burnTokens,
  getABCDTokenState,
  getAllowance,
  tokenErrorMessage,
  transferTokens,
} from "../Services/token";

interface WalletSectionUser { walletAddress?: string; }
interface WalletStatusResponse {
  success: boolean;
  linked: boolean;
  wallet: { address: string; chainId: number; walletType: string; verified: boolean } | null;
  message?: string;
}
interface WalletSectionProps {
  user: WalletSectionUser | null;
  onWalletConnected?: (walletAddress: string, data?: WalletStatusResponse) => void;
  onSiweLogin?: () => Promise<unknown>;
}

const REQUIRED_CHAIN_ID = Number(DEPLOYMENT_CHAIN_ID);
const REQUIRED_NETWORK_NAME = DEPLOYMENT_NETWORK || "Hardhat Local";
const NETWORK_NAMES: Record<number, string> = { 31337: "Hardhat Local", 97: "BNB Smart Chain Testnet", 56: "BNB Smart Chain" };
const WALLET_API_TIMEOUT_MS = 15_000;

function messageFromResponse(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
    ? payload.message : fallback;
}

async function walletApiRequest(path: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), WALLET_API_TIMEOUT_MS);
  try {
    const response = await fetch(path, { ...init, signal: controller.signal });
    return { response, data: await response.json().catch(() => ({})) };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Wallet request timed out. Check that the ABCDeFi backend is available and try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

/** Shows an address only after an explicit in-session MetaMask connection. */
export const WalletSection: React.FC<WalletSectionProps> = ({ user: _user, onWalletConnected, onSiweLogin }) => {
  const {
    address, isConnected, isConnecting, walletVerified, chainId,
    balanceABCD, connectWallet, disconnectWallet, isCorrectNetwork, refreshBalances, switchChain, loginWithSignature,
  } = useWallet();
  const [loading, setLoading] = useState(false);
  const [walletLinked, setWalletLinked] = useState(false);
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tokenRecipient, setTokenRecipient] = useState("");
  const [tokenTransferAmount, setTokenTransferAmount] = useState("");
  const [tokenSpender, setTokenSpender] = useState("");
  const [tokenApprovalAmount, setTokenApprovalAmount] = useState("");
  const [tokenBurnAmount, setTokenBurnAmount] = useState("");
  const [tokenAllowance, setTokenAllowance] = useState<string | null>(null);
  const [tokenAction, setTokenAction] = useState<"transfer" | "approve" | "burn" | "allowance" | null>(null);
  const [tokenError, setTokenError] = useState("");
  const [tokenMessage, setTokenMessage] = useState("");
  const [tokenState, setTokenState] = useState<ABCDTokenState | null>(null);
  const [tokenStateError, setTokenStateError] = useState("");

  const refreshTokenState = useCallback(async () => {
    if (!isConnected || !isCorrectNetwork) {
      setTokenState(null);
      setTokenStateError("");
      return;
    }
    try {
      setTokenStateError("");
      setTokenState(await getABCDTokenState());
    } catch (stateError) {
      setTokenState(null);
      setTokenStateError(tokenErrorMessage(stateError));
    }
  }, [isConnected, isCorrectNetwork]);

  useEffect(() => {
    void refreshTokenState();
  }, [refreshTokenState]);

  const walletStatus = useMemo(() => {
    if (!isConnected || !address) return "disconnected";
    return walletVerified ? "verified" : "link_required";
  }, [address, isConnected, walletVerified]);

  const connectMetaMask = async () => {
    setError(""); setMessage("");
    try { await connectWallet("metamask"); }
    catch (walletError) { setError(walletError instanceof Error ? walletError.message : "Failed to connect MetaMask."); }
  };

  const switchToRequiredNetwork = async () => {
    setError(""); setMessage(""); setSwitchingNetwork(true);
    try { await switchChain(REQUIRED_NETWORK_NAME); setMessage(`Connected to ${REQUIRED_NETWORK_NAME}.`); }
    catch (switchError) { setError(switchError instanceof Error ? switchError.message : "Unable to switch MetaMask network."); }
    finally { setSwitchingNetwork(false); }
  };

  const verifyAndLinkWallet = async () => {
    setError(""); setMessage("");
    if (!address) { setError("Connect MetaMask first."); return; }
    if (Number(chainId) !== REQUIRED_CHAIN_ID) { setError(`Please switch to ${REQUIRED_NETWORK_NAME} first.`); return; }
    const token = localStorage.getItem("abcdefi_jwt");
    if (!token) { setError("Please sign in to your ABCDeFi account first."); return; }
    try {
      setLoading(true);
      const { response: nonceResponse, data: nonceData } = await walletApiRequest("/api/user/wallet/nonce", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!nonceResponse.ok || typeof nonceData.nonce !== "string") {
        throw new Error(messageFromResponse(nonceData, "Failed to create wallet challenge."));
      }
      const ethereum = window.ethereum;
      if (!ethereum) throw new Error("MetaMask is not installed. Please install MetaMask.");
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const currentAddress = await signer.getAddress();
      if (currentAddress.toLowerCase() !== address.toLowerCase()) throw new Error("MetaMask account changed. Please reconnect.");
      const signature = await signer.signMessage(nonceData.nonce);
      const { response: verifyResponse, data: verifyData } = await walletApiRequest("/api/user/wallet/verify", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletAddress: currentAddress, signature, chainId: REQUIRED_CHAIN_ID, walletType: "MetaMask" }),
      });
      if (!verifyResponse.ok || !verifyData.success) throw new Error(messageFromResponse(verifyData, "Wallet verification failed."));
      // Linking a wallet to an email account is distinct from SIWE. Do not
      // mark this browser session as verified until the explicit SIWE flow
      // has signed and verified its own challenge.
      setWalletLinked(true);
      setMessage("Wallet linked. Complete SIWE Login to verify this session.");
      onWalletConnected?.(currentAddress, verifyData);
    } catch (verificationError) {
      console.error("Wallet verification error:", verificationError);
      setError(verificationError instanceof Error ? verificationError.message : "Wallet verification failed.");
    } finally { setLoading(false); }
  };

  const runSiweLogin = async () => {
    setError(""); setMessage(""); setLoading(true);
    try { await (onSiweLogin || loginWithSignature)(); setMessage("SIWE login succeeded."); }
    catch (loginError) { setError(loginError instanceof Error ? loginError.message : "SIWE login failed."); }
    finally { setLoading(false); }
  };

  const handleDisconnect = () => { disconnectWallet(); setWalletLinked(false); setError(""); setMessage(""); };
  const runTokenAction = async (
    action: Exclude<typeof tokenAction, null>,
    operation: () => Promise<{ hash?: string }>,
    successMessage: string,
  ) => {
    setTokenAction(action); setTokenError(""); setTokenMessage("");
    try {
      const receipt = await operation();
      await Promise.all([refreshBalances(), refreshTokenState()]);
      setTokenMessage(`${successMessage}${receipt.hash ? ` Transaction: ${receipt.hash}` : ""}`);
    } catch (tokenOperationError) {
      setTokenError(tokenErrorMessage(tokenOperationError));
    } finally { setTokenAction(null); }
  };

  const readAllowance = async () => {
    if (!address) return;
    setTokenAction("allowance"); setTokenError(""); setTokenMessage("");
    try {
      setTokenAllowance(await getAllowance(address, tokenSpender.trim()));
    } catch (allowanceError) {
      setTokenAllowance(null);
      setTokenError(tokenErrorMessage(allowanceError));
    } finally { setTokenAction(null); }
  };
  const numericChainId = chainId === null ? null : Number(chainId);
  const networkName = numericChainId === null ? "Not connected" : NETWORK_NAMES[numericChainId] || `Unknown Network (${numericChainId})`;
  const busy = loading || isConnecting;
  const tokenTransferOrBurnUnavailable = tokenAction !== null || tokenState === null || tokenState.isPaused;

  return <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
    <div className="mb-6 flex items-center gap-3"><Wallet className="text-emerald-400" /><div><h2 className="text-lg font-semibold">Wallet Connection</h2><p className="text-sm text-slate-400">Connect and verify your Web3 wallet</p></div></div>
    {walletStatus === "disconnected" && <button onClick={connectMetaMask} disabled={busy} className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-black">{busy ? <><Loader2 className="mr-2 inline animate-spin" />Connecting...</> : "Connect MetaMask"}</button>}
    {walletStatus !== "disconnected" && <div className="space-y-4">
      <div className="rounded-lg bg-slate-800 p-4"><p className="text-xs text-slate-400">Connected Wallet</p><p className="mt-1 font-mono text-sm">{address}</p></div>
      <div className="rounded-lg bg-slate-800 p-4"><p className="text-xs text-slate-400">Network</p><p className="mt-1">{networkName}{numericChainId !== null ? ` • Chain ID: ${numericChainId}` : ""}</p></div>
      {numericChainId !== REQUIRED_CHAIN_ID && <button onClick={switchToRequiredNetwork} disabled={switchingNetwork || busy} className="w-full rounded-lg bg-yellow-400 px-4 py-3 font-semibold text-black">{switchingNetwork ? "Switching..." : `Switch to ${REQUIRED_NETWORK_NAME}`}</button>}
      {numericChainId === REQUIRED_CHAIN_ID && walletStatus === "link_required" && !walletLinked && <button onClick={verifyAndLinkWallet} disabled={busy} className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-black">{busy ? "Waiting for MetaMask..." : "Link Wallet"}</button>}
      {numericChainId === REQUIRED_CHAIN_ID && walletStatus === "link_required" && walletLinked && <button onClick={runSiweLogin} disabled={busy} className="w-full rounded-lg bg-indigo-500 px-4 py-3 font-semibold text-white">{busy ? "Waiting for MetaMask..." : "🔑 SIWE Login"}</button>}
      {walletStatus === "verified" && <div className="flex items-center gap-2 rounded-lg bg-emerald-950 p-4 text-emerald-400"><ShieldCheck /><span>Wallet verified through SIWE</span></div>}
      {numericChainId === REQUIRED_CHAIN_ID && <div className="rounded-lg border border-slate-700 bg-slate-950 p-4 space-y-4">
        <div><p className="text-sm font-semibold text-white">ABCD Token</p><p className="text-xs text-slate-400">Connected balance: {balanceABCD ?? "Unavailable"} ABCD</p></div>
        {tokenState ? <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-300 space-y-1"><p>{tokenState.name} · {tokenState.symbol} · {tokenState.decimals} decimals</p><p>Supply: <span className="font-mono text-white">{tokenState.totalSupply}</span> / <span className="font-mono text-white">{tokenState.maxSupply}</span> ABCD</p><p>Token status: <span className={tokenState.isPaused ? "font-semibold text-amber-300" : "font-semibold text-emerald-300"}>{tokenState.isPaused ? "Paused" : "Active"}</span></p></div> : <p className="text-xs text-slate-400">Loading canonical ABCD token status…</p>}
        {tokenStateError && <p className="rounded-lg bg-red-950 p-3 text-sm text-red-400">ABCD token status read failed: {tokenStateError}</p>}
        {tokenState?.isPaused && <p className="rounded-lg bg-amber-950 p-3 text-sm text-amber-300">ABCD is paused. Transfers and burns are disabled until an authorized pauser unpauses the deployed token.</p>}
        <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
          <input value={tokenRecipient} onChange={(event) => setTokenRecipient(event.target.value)} placeholder="Recipient address (0x...)" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
          <input value={tokenTransferAmount} onChange={(event) => setTokenTransferAmount(event.target.value)} placeholder="Amount" inputMode="decimal" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
          <button onClick={() => runTokenAction("transfer", () => transferTokens(tokenRecipient.trim(), tokenTransferAmount.trim()), "ABCD transfer confirmed.")} disabled={tokenTransferOrBurnUnavailable} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{tokenAction === "transfer" ? "Confirming..." : "Transfer"}</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto_auto]">
          <input value={tokenSpender} onChange={(event) => { setTokenSpender(event.target.value); setTokenAllowance(null); }} placeholder="Spender contract address (0x...)" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
          <input value={tokenApprovalAmount} onChange={(event) => setTokenApprovalAmount(event.target.value)} placeholder="Amount" inputMode="decimal" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
          <button onClick={readAllowance} disabled={tokenAction !== null} className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-50">{tokenAction === "allowance" ? "Reading..." : "Allowance"}</button>
          <button onClick={() => runTokenAction("approve", () => approveSpender(tokenSpender.trim(), tokenApprovalAmount.trim()), "ABCD approval confirmed.")} disabled={tokenAction !== null} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{tokenAction === "approve" ? "Confirming..." : "Approve"}</button>
        </div>
        {tokenAllowance !== null && <p className="text-xs text-slate-400">Current allowance: {tokenAllowance} ABCD</p>}
        <div className="grid gap-2 sm:grid-cols-[10rem_auto_1fr]">
          <input value={tokenBurnAmount} onChange={(event) => setTokenBurnAmount(event.target.value)} placeholder="Amount to burn" inputMode="decimal" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
          <button onClick={() => runTokenAction("burn", () => burnTokens(tokenBurnAmount.trim()), "ABCD burn confirmed.")} disabled={tokenTransferOrBurnUnavailable} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{tokenAction === "burn" ? "Confirming..." : "Burn"}</button>
          <p className="self-center text-xs text-slate-400">Burning permanently reduces your wallet balance and total supply.</p>
        </div>
        <p className="text-xs text-slate-500">Minting is intentionally not shown here: it requires MINTER_ROLE and the fixed supply must first be below its maximum.</p>
        {tokenError && <p className="rounded-lg bg-red-950 p-3 text-sm text-red-400">{tokenError}</p>}
        {tokenMessage && <p className="break-all rounded-lg bg-emerald-950 p-3 text-sm text-emerald-400">{tokenMessage}</p>}
      </div>}
      <button onClick={handleDisconnect} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600 px-4 py-3 font-semibold text-slate-200"><Unplug size={18} />Disconnect Wallet</button>
    </div>}
    {error && <div className="mt-4 flex gap-2 rounded-lg bg-red-950 p-4 text-red-400"><AlertCircle /><span>{error}</span></div>}
    {message && <div className="mt-4 flex gap-2 rounded-lg bg-emerald-950 p-4 text-emerald-400"><Check /><span>{message}</span></div>}
  </div>;
};
