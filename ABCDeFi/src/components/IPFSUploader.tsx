import React, { useState } from 'react';
import {
  UploadCloud,
  FileCheck,
  Globe,
  Copy,
  ExternalLink,
  CheckCircle2,
  RefreshCcw,
  Sparkles,
  Layers,
  Image,
} from 'lucide-react';

export interface IPFSUploadItem {
  id: string;
  fileName: string;
  category: 'continents' | 'countries' | 'states' | 'districts';
  fileSize: string;
  ipfsUri: string;
  gatewayUrl: string;
  status: 'uploading' | 'pinned';
  uploadedAt: string;
}

const INITIAL_UPLOADS: IPFSUploadItem[] = [
  {
    id: '1',
    fileName: 'asia.png',
    category: 'continents',
    fileSize: '1.4 MB',
    ipfsUri: 'ipfs://QmX8f9aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9b/asia.png',
    gatewayUrl: 'https://ipfs.io/ipfs/QmX8f9aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9b/asia.png',
    status: 'pinned',
    uploadedAt: 'Just now',
  },
  {
    id: '2',
    fileName: 'india.png',
    category: 'countries',
    fileSize: '1.2 MB',
    ipfsUri: 'ipfs://QmY3b1aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9c/india.png',
    gatewayUrl: 'https://ipfs.io/ipfs/QmY3b1aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9c/india.png',
    status: 'pinned',
    uploadedAt: 'Just now',
  },
  {
    id: '3',
    fileName: 'telangana.png',
    category: 'states',
    fileSize: '1.1 MB',
    ipfsUri: 'ipfs://QmZ9c4aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9d/telangana.png',
    gatewayUrl: 'https://ipfs.io/ipfs/QmZ9c4aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9d/telangana.png',
    status: 'pinned',
    uploadedAt: 'Just now',
  },
  {
    id: '4',
    fileName: 'hyderabad.png',
    category: 'districts',
    fileSize: '980 KB',
    ipfsUri: 'ipfs://QmA2d5aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9e/hyderabad.png',
    gatewayUrl: 'https://ipfs.io/ipfs/QmA2d5aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9e/hyderabad.png',
    status: 'pinned',
    uploadedAt: 'Just now',
  },
];

export const IPFSUploader: React.FC = () => {
  const [uploads, setUploads] = useState<IPFSUploadItem[]>(INITIAL_UPLOADS);
  const [selectedCategory, setSelectedCategory] = useState<'continents' | 'countries' | 'states' | 'districts'>('countries');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    setTimeout(() => {
      const newItems: IPFSUploadItem[] = Array.from(files).map((file, idx) => {
        const hash = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const cid = `QmX${hash}bZ9aKw7Jv3pD8mN4L6R2t1Y5c0A3e8F9b`;
        return {
          id: (Date.now() + idx).toString(),
          fileName: file.name,
          category: selectedCategory,
          fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
          ipfsUri: `ipfs://${cid}/${file.name}`,
          gatewayUrl: `https://ipfs.io/ipfs/${cid}/${file.name}`,
          status: 'pinned',
          uploadedAt: new Date().toLocaleTimeString(),
        };
      });

      setUploads([...newItems, ...uploads]);
      setIsUploading(false);
    }, 1500);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredUploads = uploads.filter((u) => u.category === selectedCategory);

  return (
    <div id="ipfs-uploader" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 font-mono">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <span>Decentralized Storage</span>
            <span className="text-slate-600">↓</span>
            <span>IPFS Pinning Service</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
            <UploadCloud className="w-5 h-5 text-cyan-400" />
            IPFS Artwork & Metadata Upload Portal
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload territory PNG artwork to IPFS and receive immutable <code className="text-cyan-300">ipfs://...</code> CIDs for contract minting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black px-5 py-2.5 rounded-2xl text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer flex items-center gap-2 shrink-0">
            {isUploading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            <span>{isUploading ? 'Uploading to IPFS...' : 'Upload PNGs to IPFS'}</span>
            <input type="file" accept="image/png" multiple onChange={handleFileUpload} className="hidden" disabled={isUploading} />
          </label>
        </div>
      </div>

      {/* CATEGORY SELECTOR TABS */}
      <div className="flex gap-2 border-b border-slate-800 pb-3 overflow-x-auto no-scrollbar text-xs">
        {[
          { key: 'continents', label: 'Continents (assets/continents/)', icon: '🌍' },
          { key: 'countries', label: '193 Countries (assets/countries/)', icon: '🏳️' },
          { key: 'states', label: 'States (assets/states/)', icon: '🏛️' },
          { key: 'districts', label: 'Districts (assets/districts/)', icon: '📍' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedCategory(tab.key as any)}
            className={`px-4 py-2 rounded-2xl font-bold transition cursor-pointer flex items-center gap-2 shrink-0 ${
              selectedCategory === tab.key
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/20'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* RECENT UPLOADS TABLE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
          <span>Pinned IPFS Files ({filteredUploads.length})</span>
          <span className="text-[10px] text-slate-500">Gateway: ipfs.io</span>
        </div>

        {filteredUploads.length === 0 ? (
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 text-center space-y-2">
            <Image className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-xs text-slate-400 font-bold">No PNGs pinned yet under assets/{selectedCategory}/</div>
            <div className="text-[10px] text-slate-600">Click "Upload PNGs to IPFS" above to generate ipfs:// URIs.</div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredUploads.map((item) => (
              <div key={item.id} className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 text-cyan-400 shrink-0">
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <span>{item.fileName}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 uppercase font-extrabold flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Pinned
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-3 mt-0.5">
                      <span>Size: {item.fileSize}</span>
                      <span>Time: {item.uploadedAt}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
                  {/* IPFS URI Pill */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center gap-2">
                    <code className="text-cyan-300 text-[11px] font-bold truncate max-w-[220px]">{item.ipfsUri}</code>
                    <button
                      onClick={() => copyToClipboard(item.ipfsUri, item.id)}
                      className="text-slate-400 hover:text-white transition cursor-pointer"
                      title="Copy ipfs:// URI"
                    >
                      {copiedId === item.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <a
                    href={item.gatewayUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl transition flex items-center gap-1 text-[11px]"
                  >
                    <span>View</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IPFSUploader;
