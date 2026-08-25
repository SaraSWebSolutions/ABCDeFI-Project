import React, { useState } from 'react';
import {
  Upload,
  FileCode,
  Sparkles,
  CheckCircle2,
  Image as ImageIcon,
  ArrowRight,
  ShieldCheck,
  Globe,
  Layers,
  Zap,
  Info,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { NFTLevel, NFTLevelIcons, NFTLevelNames, slugify } from '../Services/legionNFT';

interface FranchiseDashboardProps {
  onNftMinted?: (newNft: any) => void;
}

export const FranchiseDashboard: React.FC<FranchiseDashboardProps> = ({ onNftMinted }) => {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  // STEP 1: Upload PNG State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // STEP 2: Metadata Config State
  const [form, setForm] = useState({
    name: 'Hyderabad Cyber City',
    territory: 'Hyderabad District, Telangana',
    level: NFTLevel.District,
    parentId: 200, // Telangana State
    character: 'District Knight',
    population: 10000000,
    treasuryShareBps: 50,
    ownerWallet: '0x15d34AA54267DB7D7c367839AAf71A00a2C6A65E',
  });

  // STEP 3: Minting Status
  const [isMinting, setIsMinting] = useState(false);
  const [mintedResult, setMintedResult] = useState<{
    tokenId: number;
    transactionHash: string;
    ipfsUri: string;
  } | null>(null);

  // Handle Drag & Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Generate Sample Metadata JSON
  const generatedMetadata = {
    name: form.name,
    description: `Official Legion Territory NFT for ${form.name} (${form.territory}). Zero-code Franchise Mint.`,
    image: imagePreview ? 'ipfs://QmX8f9aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9b/upload.png' : `ipfs://QmX8f9aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9b/${slugify(form.name)}.png`,
    level: NFTLevelNames[form.level],
    attributes: [
      { trait_type: 'Level', value: NFTLevelNames[form.level] },
      { trait_type: 'Parent NFT ID', value: form.parentId },
      { trait_type: 'Character', value: form.character },
      { trait_type: 'Treasury Share Bps', value: form.treasuryShareBps },
      { trait_type: 'Population', value: form.population },
    ],
  };

  // Execute Mint NFT
  const handleExecuteMint = async () => {
    setIsMinting(true);

    // Simulate block time & transaction confirmation
    setTimeout(() => {
      const newTokenId = Math.floor(Math.random() * 900) + 270;
      const txHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      const ipfsHash = `ipfs://Qm${Array.from({ length: 44 }, () => Math.floor(Math.random() * 36).toString(36)).join('')}/${slugify(form.name)}.json`;

      const result = {
        tokenId: newTokenId,
        transactionHash: txHash,
        ipfsUri: ipfsHash,
      };

      setMintedResult(result);
      setIsMinting(false);

      if (onNftMinted) {
        onNftMinted({
          nftId: newTokenId,
          name: form.name,
          territory: form.territory,
          level: form.level,
          parentId: form.parentId,
          character: form.character,
          metadataURI: ipfsHash,
          population: form.population,
          treasuryShareBps: form.treasuryShareBps,
          createdAt: new Date().toISOString().split('T')[0],
          owner: form.ownerWallet,
          imageSlug: slugify(form.name),
        });
      }
    }, 2000);
  };

  const handleReset = () => {
    setActiveStep(1);
    setImageFile(null);
    setImagePreview(null);
    setMintedResult(null);
  };

  return (
    <div className="space-y-6 font-mono">
      {/* HEADER HERO */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold mb-2">
              <Zap className="w-3.5 h-3.5" /> Phase 8 — 0-Code Franchise Dashboard
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-amber-400" />
              Franchise NFT Minting Portal
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Upload PNG → Generate Metadata → Mint NFT. No coding required for franchise owners.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Code-Free Engine Active
            </span>
          </div>
        </div>

        {/* 3-STEP WIZARD PROGRESS BAR */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-xs">
          {/* STEP 1 */}
          <button
            onClick={() => setActiveStep(1)}
            className={`p-3 rounded-2xl border transition-all text-left flex items-center gap-3 cursor-pointer ${
              activeStep === 1
                ? 'bg-amber-500/10 border-amber-500 text-amber-300 ring-1 ring-amber-500/40'
                : activeStep > 1
                ? 'bg-slate-950 border-emerald-500/40 text-emerald-400'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            <div className="w-7 h-7 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center font-black text-xs shrink-0">
              {activeStep > 1 ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : '1'}
            </div>
            <div className="truncate">
              <div className="font-bold text-white text-xs">1. Upload PNG</div>
              <div className="text-[10px] text-slate-400 truncate">Artwork file upload</div>
            </div>
          </button>

          {/* STEP 2 */}
          <button
            onClick={() => setImagePreview && setActiveStep(2)}
            className={`p-3 rounded-2xl border transition-all text-left flex items-center gap-3 cursor-pointer ${
              activeStep === 2
                ? 'bg-amber-500/10 border-amber-500 text-amber-300 ring-1 ring-amber-500/40'
                : activeStep > 2
                ? 'bg-slate-950 border-emerald-500/40 text-emerald-400'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            <div className="w-7 h-7 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center font-black text-xs shrink-0">
              {activeStep > 2 ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : '2'}
            </div>
            <div className="truncate">
              <div className="font-bold text-white text-xs">2. Metadata</div>
              <div className="text-[10px] text-slate-400 truncate">Traits & IPFS Schema</div>
            </div>
          </button>

          {/* STEP 3 */}
          <button
            onClick={() => activeStep >= 2 && setActiveStep(3)}
            className={`p-3 rounded-2xl border transition-all text-left flex items-center gap-3 cursor-pointer ${
              activeStep === 3
                ? 'bg-amber-500/10 border-amber-500 text-amber-300 ring-1 ring-amber-500/40'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            <div className="w-7 h-7 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center font-black text-xs shrink-0">
              3
            </div>
            <div className="truncate">
              <div className="font-bold text-white text-xs">3. Mint NFT</div>
              <div className="text-[10px] text-slate-400 truncate">On-Chain Execution</div>
            </div>
          </button>
        </div>
      </div>

      {/* STEP 1: UPLOAD PNG */}
      {activeStep === 1 && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-amber-400" />
              Step 1: Upload Territory PNG Artwork
            </h3>
            <p className="text-xs text-slate-400">
              Select or drag and drop high-resolution PNG artwork for the new franchise NFT.
            </p>
          </div>

          {/* PRESET PNG ASSETS OR CUSTOM UPLOAD */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Quick Select Uploaded Asset PNGs</span>
              <span className="text-amber-400 text-[10px]">Or Drag & Drop your custom PNG below</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { name: 'ABCD Protocol', file: '/src/assets/ABCD.png' },
                { name: 'Rocket Launch', file: '/src/assets/rocket.png' },
                { name: 'Ethereum Asset', file: '/src/assets/Ethereum.png' },
                { name: 'Bitcoin Asset', file: '/src/assets/Bitcoin.png' },
              ].map((asset) => (
                <div
                  key={asset.name}
                  onClick={() => {
                    setImagePreview(asset.file);
                    setImageFile(new File([], asset.name + '.png'));
                  }}
                  className={`bg-slate-900 border rounded-2xl p-3 flex flex-col items-center gap-2 cursor-pointer transition hover:scale-105 ${
                    imagePreview === asset.file ? 'border-amber-500 ring-1 ring-amber-500/50 bg-amber-500/10' : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <img src={asset.file} alt={asset.name} className="w-12 h-12 object-contain" />
                  <span className="text-[10px] font-bold text-slate-300 truncate w-full text-center">{asset.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-4 transition ${
              isDragging
                ? 'border-amber-500 bg-amber-500/10'
                : imagePreview
                ? 'border-emerald-500/60 bg-slate-900'
                : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
            }`}
          >
            {imagePreview ? (
              <div className="space-y-4 flex flex-col items-center">
                <div className="w-48 h-48 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-xl relative flex items-center justify-center p-2">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                  <div className="absolute top-2 right-2 bg-emerald-500 text-slate-950 p-1 rounded-full text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> PNG Artwork Ready ({imageFile?.name || 'Selected PNG Asset'})
                </div>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Upload className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-bold text-white">Drag and drop custom PNG file here</div>
                  <div className="text-xs text-slate-500">Supports PNG format (1080x1080px recommended)</div>
                </div>
              </>
            )}

            <label className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-5 py-2.5 rounded-2xl text-xs transition cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-amber-500/20">
              <Upload className="w-4 h-4" /> Browse Local PNG File
              <input type="file" accept="image/png,image/*" onChange={handleFileSelect} className="hidden" />
            </label>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-900">
            <button
              onClick={() => setActiveStep(2)}
              className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-black px-6 py-3 rounded-2xl text-xs transition flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              Next: Configure Metadata <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: METADATA FORM & LIVE JSON PREVIEW */}
      {activeStep === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* FORM */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <FileCode className="w-5 h-5 text-amber-400" />
                Step 2: Define Franchise Metadata
              </h3>
              <p className="text-xs text-slate-400">
                Configure territory attributes. System automatically formats JSON metadata.
              </p>
            </div>

            <form onSubmit={(e) => e.preventDefault()} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Territory Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Hyderabad Cyber City, Warangal Tech Zone"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-amber-500 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Territory Description</label>
                <input
                  type="text"
                  value={form.territory}
                  onChange={(e) => setForm({ ...form, territory: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Hierarchy Level</label>
                  <select
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-bold"
                  >
                    <option value={NFTLevel.Continent}>Continent (Level 0)</option>
                    <option value={NFTLevel.Country}>Country (Level 1)</option>
                    <option value={NFTLevel.State}>State (Level 2)</option>
                    <option value={NFTLevel.District}>District (Level 3)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Parent NFT ID</label>
                  <input
                    type="number"
                    value={form.parentId}
                    onChange={(e) => setForm({ ...form, parentId: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500 font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Character Role</label>
                  <input
                    type="text"
                    value={form.character}
                    onChange={(e) => setForm({ ...form, character: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-cyan-300 focus:outline-none focus:border-amber-500 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Treasury Share Bps</label>
                  <input
                    type="number"
                    value={form.treasuryShareBps}
                    onChange={(e) => setForm({ ...form, treasuryShareBps: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-emerald-400 focus:outline-none focus:border-amber-500 font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Owner Wallet Address</label>
                <input
                  type="text"
                  value={form.ownerWallet}
                  onChange={(e) => setForm({ ...form, ownerWallet: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-300 focus:outline-none focus:border-amber-500 font-mono text-[11px]"
                  required
                />
              </div>
            </form>

            <div className="flex justify-between pt-4 border-t border-slate-900">
              <button
                onClick={() => setActiveStep(1)}
                className="text-slate-400 hover:text-white px-4 py-2 text-xs font-bold cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={() => setActiveStep(3)}
                className="bg-amber-600 hover:bg-amber-500 text-white font-black px-6 py-2.5 rounded-2xl text-xs transition flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
              >
                Proceed to Minting <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* LIVE JSON PREVIEW */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCode className="w-4 h-4" /> Live Auto-Generated Metadata Schema
                </span>
                <span className="text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-emerald-400 font-bold">
                  ERC-721 Validated
                </span>
              </div>

              <pre className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-[380px]">
                {JSON.stringify(generatedMetadata, null, 2)}
              </pre>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-2xl border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>No JSON writing or backend code required. The system compiles metadata directly for IPFS pinning and smart contract execution.</span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: ONE-CLICK MINT NFT */}
      {activeStep === 3 && (
        <div className="bg-slate-950 border border-amber-500/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl ring-1 ring-amber-500/20 max-w-2xl mx-auto text-center">
          <div className="space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-white">Step 3: One-Click On-Chain Mint</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Executes LegionNFT smart contract mint function, pins metadata to IPFS, and assigns hierarchy lineage automatically.
            </p>
          </div>

          {/* SUMMARY REVIEW CARD */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left text-xs space-y-2 font-mono">
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-500">Franchise Territory:</span>
              <span className="font-bold text-white">{form.name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-500">Hierarchy Level:</span>
              <span className="font-bold text-amber-400">{NFTLevelIcons[form.level]} {NFTLevelNames[form.level]}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-500">Parent NFT ID:</span>
              <span className="font-bold text-slate-200">#{form.parentId}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Revenue Share:</span>
              <span className="font-bold text-emerald-400">{(form.treasuryShareBps / 100).toFixed(2)}% ({form.treasuryShareBps} Bps)</span>
            </div>
          </div>

          {/* MINT ACTION BUTTON / RESULT */}
          {mintedResult ? (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-3xl p-6 space-y-4 animate-in fade-in duration-300">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xl font-black text-white">NFT Minted Successfully!</h4>
                <p className="text-xs text-emerald-300">Territory Franchise NFT created on-chain.</p>
              </div>

              <div className="space-y-2 text-left bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Minted Token ID:</span>
                  <span className="font-black text-amber-400">#{mintedResult.tokenId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tx Hash:</span>
                  <span className="font-mono text-[10px] text-slate-300 truncate max-w-[200px]">{mintedResult.transactionHash}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-500 block">IPFS Metadata URI:</span>
                  <span className="font-mono text-[10px] text-amber-400 break-all">{mintedResult.ipfsUri}</span>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-2xl text-xs transition cursor-pointer inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Mint Another Franchise NFT
              </button>
            </div>
          ) : (
            <button
              onClick={handleExecuteMint}
              disabled={isMinting}
              className={`w-full py-4 rounded-2xl font-black text-sm transition shadow-2xl flex items-center justify-center gap-2 cursor-pointer ${
                isMinting
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-amber-500/25'
              }`}
            >
              {isMinting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                  <span>Executing Smart Contract Mint...</span>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 fill-current" />
                  <span>Click to Mint NFT (0 Code)</span>
                </>
              )}
            </button>
          )}

          {!mintedResult && (
            <button
              onClick={() => setActiveStep(2)}
              className="text-slate-500 hover:text-white text-xs font-bold cursor-pointer"
            >
              Cancel & Modify Metadata
            </button>
          )}
        </div>
      )}
      {/* ADMINISTRATIVE FRANCHISE MANAGEMENT WORKFLOWS */}
      <div className="bg-slate-950 border border-amber-500/30 rounded-3xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <span>Admin Management</span>
              <span className="text-slate-600">↓</span>
              <span>Franchise Territory Governance</span>
            </div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2 mt-0.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              Administrative Franchise Workflows & Revenue Sharing
            </h3>
          </div>
          <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
            269 Territory Franchises Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="text-slate-400 font-bold">1. Continents (Level 0)</div>
            <div className="text-base font-black text-amber-300 mt-1">6 Continents</div>
            <div className="text-[10px] text-slate-500">Global Master Franchises</div>
          </div>

          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="text-slate-400 font-bold">2. Countries (Level 1)</div>
            <div className="text-base font-black text-indigo-300 mt-1">193 Countries</div>
            <div className="text-[10px] text-slate-500">National Sovereign Nodes</div>
          </div>

          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="text-slate-400 font-bold">3. States (Level 2)</div>
            <div className="text-base font-black text-purple-300 mt-1">37 States</div>
            <div className="text-[10px] text-slate-500">Regional Governance Units</div>
          </div>

          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="text-slate-400 font-bold">4. Telangana Districts (L3)</div>
            <div className="text-base font-black text-emerald-400 mt-1">33 Districts</div>
            <div className="text-[10px] text-slate-500">Local Franchise Nodes</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FranchiseDashboard;
