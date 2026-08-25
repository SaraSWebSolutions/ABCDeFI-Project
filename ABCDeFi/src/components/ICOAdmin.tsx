import React, { useState, useEffect } from 'react';
import { Download, Upload } from 'lucide-react';
import { api } from '../Services/axiosConfig';

export const ICOAdmin: React.FC = () => {
  const [exportJson, setExportJson] = useState('');
  const [importJson, setImportJson] = useState('');
  const [message, setMessage] = useState('');
  const [lastExportAt, setLastExportAt] = useState<string | null>(null);

  const fetchExport = async () => {
    setMessage('');
    try {
      const res = await api.get('/ico/admin/export');
      const body = res.data;
      const pretty = JSON.stringify(body, null, 2);
      setExportJson(pretty);
      setLastExportAt(new Date().toISOString());
    } catch (err: any) {
      setMessage('Failed to fetch export: ' + (err?.message || err));
    }
  };

  const downloadExport = () => {
    const blob = new Blob([exportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ico-data-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (!lastExportAt) setLastExportAt(new Date().toISOString());
  };

  useEffect(() => {
    // Auto-fetch current export on mount
    fetchExport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doImport = async () => {
    setMessage('');
    try {
      const parsed = JSON.parse(importJson);
      await api.post('/ico/admin/import', parsed);
      setMessage('Import successful — server state updated.');
    } catch (err: any) {
      setMessage('Import failed: ' + (err?.message || err));
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white">ICO Admin</h3>
        <div className="text-slate-400">Export / Import ICO data</div>
      </div>
      <div className="text-[11px] text-slate-400">Last export: {lastExportAt ? new Date(lastExportAt).toLocaleString() : 'never'}</div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <button onClick={fetchExport} className="bg-emerald-600 px-3 py-1 rounded text-white font-bold">Fetch Export</button>
            <button onClick={downloadExport} disabled={!exportJson} className="bg-slate-700 px-3 py-1 rounded text-white flex items-center gap-2"><Download className="w-4 h-4"/> Download</button>
          </div>
          <textarea value={exportJson} readOnly rows={18} className="w-full bg-slate-950 p-2 text-[11px] font-mono rounded" />
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="text-slate-400">Paste JSON below to import and overwrite server state.</div>
          </div>
          <textarea value={importJson} onChange={(e) => setImportJson(e.target.value)} rows={18} className="w-full bg-slate-950 p-2 text-[11px] font-mono rounded" />
          <div className="flex items-center gap-2 mt-2">
            <button onClick={doImport} className="bg-indigo-600 px-3 py-1 rounded text-white font-bold flex items-center gap-2"><Upload className="w-4 h-4"/> Import</button>
            <div className="text-slate-500 text-[11px]">Server will persist changes to disk.</div>
          </div>
        </div>
      </div>

      {message && <div className="text-[12px] text-amber-300">{message}</div>}
    </div>
  );
};

export default ICOAdmin;
