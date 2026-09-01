import React, { useEffect, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { useWallet } from '../Context/WalletContext';
import { createNftMetadataAsset, StoredNftAsset } from '../Services/nftAssetStorage';
import { mintFranchise, franchiseErrorMessage } from '../Services/franchise';
import { legionErrorMessage, mintLegion } from '../Services/legion';

const initial = { recipient: '', nftType: 'Franchise', name: '', territory: '', territoryCode: '', tier: '5', description: '', attributes: '[]', legionNFTId: '0', priceUSD: '0', commissionBps: '0', parentId: '0', character: '', population: '0', treasuryShareBps: '0' };

export const AdminNftIssuance: React.FC = () => {
  const { address, isConnected, isCorrectNetwork } = useWallet();
  const [form, setForm] = useState(initial); const [asset, setAsset] = useState<File | null>(null); const [preview, setPreview] = useState<string | null>(null); const [stored, setStored] = useState<StoredNftAsset | null>(null); const [message, setMessage] = useState(''); const [hash, setHash] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { setForm((current) => ({ ...current, recipient: current.recipient || address || '' })); }, [address]);
  useEffect(() => { if (!asset) return setPreview(null); const url = URL.createObjectURL(asset); setPreview(url); return () => URL.revokeObjectURL(url); }, [asset]);
  const update = (key: keyof typeof initial, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const changeNftType = (nftType: 'Franchise' | 'Legion') => setForm((current) => current.nftType === nftType ? current : {
    ...current,
    nftType,
    // A Legion Continent is enum value 0. The prior Franchise default was 5,
    // which made the visible first option disagree with the submitted value.
    tier: nftType === 'Legion' ? '0' : '5',
    parentId: nftType === 'Legion' ? '0' : current.parentId,
  });
  const parsedAttributes = () => { const value = JSON.parse(form.attributes); if (!Array.isArray(value)) throw new Error('Attributes must be a JSON array.'); return value; };
  const persistAsset = async () => { if (!asset) throw new Error('Select the real PNG asset first.'); const attributes = parsedAttributes(); const externalUrl = window.location.origin; const result = await createNftMetadataAsset({ asset, name: form.name, description: form.description, externalUrl, attributes }); setStored(result); return result; };
  const submit = async () => {
    if (busy) return; if (!isConnected) return setMessage('Connect the admin/minter MetaMask wallet.'); if (!isCorrectNetwork) return setMessage('Switch MetaMask to Hardhat Local (31337).');
    setBusy(true); setHash(''); setMessage('Uploading the real PNG and ERC-721 metadata…');
    try {
      const storedAsset = stored || await persistAsset();
      if (form.nftType === 'Legion' && storedAsset.provider !== 'pinata') {
        // Local HTTP metadata is useful for development previews only. Legion
        // certificates require a durable, explicit HTTPS/IPFS ERC-721 URI.
        setStored(null);
        throw new Error('Legion minting requires Pinata/IPFS metadata. Configure NFT_STORAGE_PROVIDER=pinata and PINATA_JWT on the backend, then create metadata again.');
      }
      setMessage('Confirm the real on-chain mint in MetaMask.');
      const onSubmitted = (transactionHash: string) => { setHash(transactionHash); setMessage('Transaction submitted. Waiting for receipt confirmation…'); };
      const result = form.nftType === 'Franchise'
        ? await mintFranchise({ franchisee: form.recipient, franchiseName: form.name, territoryCode: form.territoryCode, territoryName: form.territory, level: Number(form.tier), legionNFTId: form.legionNFTId, priceUSD: form.priceUSD, commissionBps: form.commissionBps, tokenURI: storedAsset.uri, ipfsCID: storedAsset.metadataCid || '' }, onSubmitted)
      : await mintLegion({ recipient: form.recipient, name: form.name, territory: form.territory, level: form.tier, parentId: form.parentId, character: form.character, metadataURI: storedAsset.metadataUri, population: form.population, treasuryShareBps: form.treasuryShareBps }, onSubmitted);
      setMessage(`${form.nftType} NFT #${result.tokenId || 'confirmed'} minted on-chain. The canonical indexer will discover the emitted event.`); setStored(null);
    } catch (error) { setMessage(form.nftType === 'Franchise' ? franchiseErrorMessage(error) : legionErrorMessage(error)); } finally { setBusy(false); }
  };
  return <section className="nft-issuance-form rounded-2xl border border-emerald-500/30 bg-slate-900 p-5"><div className="flex gap-2"><ImagePlus className="h-5 w-5 text-emerald-400"/><div><h2 className="font-bold text-white">Real NFT issuance</h2><p className="text-xs text-slate-400">Admin API stores a real PNG plus ERC-721 metadata; MetaMask performs the contract mint. Local-chain NFTs disappear if Hardhat is recreated.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2">
    <label className="text-xs">NFT type<select value={form.nftType} onChange={(e)=>changeNftType(e.target.value as 'Franchise' | 'Legion')} className="input"><option>Franchise</option><option>Legion</option></select></label><label className="text-xs">Recipient wallet<input className="input" value={form.recipient} onChange={(e)=>update('recipient',e.target.value)}/></label><label className="text-xs">Name<input className="input" value={form.name} onChange={(e)=>update('name',e.target.value)}/></label><label className="text-xs">Territory name<input className="input" value={form.territory} onChange={(e)=>update('territory',e.target.value)}/></label>
    {form.nftType === 'Franchise' ? <><label className="text-xs">Unique territory code<input className="input" value={form.territoryCode} onChange={(e)=>update('territoryCode',e.target.value)}/></label><label className="text-xs">Tier<select className="input" value={form.tier} onChange={(e)=>update('tier',e.target.value)}>{['World','Continent','Country','State','Zone','District','Pincode','Area','Locality'].map((name,index)=><option value={index} key={name}>{index}: {name}</option>)}</select></label><label className="text-xs">Linked Legion token ID<input className="input" value={form.legionNFTId} onChange={(e)=>update('legionNFTId',e.target.value)}/></label><label className="text-xs">Recorded price USD<input className="input" value={form.priceUSD} onChange={(e)=>update('priceUSD',e.target.value)}/></label><label className="text-xs">Recorded commission BPS<input className="input" value={form.commissionBps} onChange={(e)=>update('commissionBps',e.target.value)}/></label></> : <><label className="text-xs">Level<select className="input" value={form.tier} onChange={(e)=>update('tier',e.target.value)}>{['Continent','Country','State','District'].map((name,index)=><option value={index} key={name}>{index}: {name}</option>)}</select></label><label className="text-xs">Parent token ID<input className="input" value={form.parentId} onChange={(e)=>update('parentId',e.target.value)}/></label><label className="text-xs">Character<input className="input" value={form.character} onChange={(e)=>update('character',e.target.value)}/></label><label className="text-xs">Population<input className="input" value={form.population} onChange={(e)=>update('population',e.target.value)}/></label><label className="text-xs">Treasury share BPS<input className="input" value={form.treasuryShareBps} onChange={(e)=>update('treasuryShareBps',e.target.value)}/></label></>}
    <label className="text-xs md:col-span-2">Description<textarea className="input" value={form.description} onChange={(e)=>update('description',e.target.value)}/></label><label className="text-xs md:col-span-2">Attributes JSON<input className="input" value={form.attributes} onChange={(e)=>update('attributes',e.target.value)} placeholder='[{"trait_type":"Tier","value":"District"}]'/></label><label className="text-xs md:col-span-2">PNG asset<input type="file" accept="image/png" onChange={(e)=>setAsset(e.target.files?.[0] || null)} className="nft-issuance-file mt-1 block text-xs"/></label>
  </div>{preview && <img src={preview} alt="Selected NFT asset preview" className="mt-4 max-h-48 rounded-xl border border-slate-700"/>}{stored && <p className="mt-3 break-all text-xs text-emerald-300">Metadata URI: {stored.metadataUri}</p>}<button disabled={busy} onClick={()=>void submit()} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy && <Loader2 className="mr-2 inline h-4 w-4 animate-spin"/>}Create metadata & mint {form.nftType}</button>{message && <p className="mt-3 text-xs text-slate-200">{message}{hash && <> Transaction: <span className="break-all font-mono">{hash}</span></>}</p>}</section>;
};
