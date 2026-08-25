import React, { useState, useEffect, useRef } from 'react';
import {
  Server,
  Database,
  Globe,
  Code,
  CheckCircle2,
  Play,
  Terminal,
  Activity,
  Box,
  Cpu,
  CloudLightning,
  ShieldCheck,
  RefreshCcw,
} from 'lucide-react';

type DeploymentStatus = 'idle' | 'building' | 'deploying' | 'verifying' | 'live' | 'failed';

interface ServiceDeployState {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: DeploymentStatus;
  progress: number; // 0 to 100
  url?: string;
  version: string;
  logs: string[];
}

const INITIAL_SERVICES: ServiceDeployState[] = [
  {
    id: 'contracts',
    name: 'Smart Contracts (Sepolia)',
    icon: <Code className="w-5 h-5 text-purple-400" />,
    status: 'idle',
    progress: 0,
    version: 'v2.4.1-core',
    logs: [],
  },
  {
    id: 'db',
    name: 'PostgreSQL Database',
    icon: <Database className="w-5 h-5 text-amber-400" />,
    status: 'idle',
    progress: 0,
    version: 'pg-15.4',
    logs: [],
  },
  {
    id: 'backend',
    name: 'Node.js Backend API',
    icon: <Server className="w-5 h-5 text-blue-400" />,
    status: 'idle',
    progress: 0,
    version: 'v1.8.0',
    logs: [],
  },
  {
    id: 'frontend',
    name: 'React Frontend App',
    icon: <Globe className="w-5 h-5 text-emerald-400" />,
    status: 'idle',
    progress: 0,
    version: 'v3.0.2',
    logs: [],
  },
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const ProductionDeployment: React.FC = () => {
  const [services, setServices] = useState<ServiceDeployState[]>(INITIAL_SERVICES);
  const [globalStatus, setGlobalStatus] = useState<'idle' | 'deploying' | 'live'>('idle');
  const [activeLogTab, setActiveLogTab] = useState<string>('all');
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [services]);

  const addLog = (id: string, message: string) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, logs: [...s.logs, `[${new Date().toLocaleTimeString()}] ${message}`] } : s))
    );
  };

  const updateService = (id: string, updates: Partial<ServiceDeployState>) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const deployService = async (s: ServiceDeployState, delayScale: number) => {
    updateService(s.id, { status: 'building', progress: 10 });
    addLog(s.id, `Starting deployment process for ${s.name}...`);
    
    await sleep(800 * delayScale);
    updateService(s.id, { progress: 30 });
    addLog(s.id, `Compiling resources...`);
    
    await sleep(1000 * delayScale);
    updateService(s.id, { status: 'deploying', progress: 60 });
    addLog(s.id, `Deploying to production environment...`);
    
    await sleep(1200 * delayScale);
    updateService(s.id, { status: 'verifying', progress: 85 });
    addLog(s.id, `Running health checks and verifications...`);
    
    await sleep(900 * delayScale);
    const urls: Record<string, string> = {
      'contracts': '0x7a2...8b9',
      'db': 'db-prod-eu-west.aws.internal',
      'backend': 'https://api.abcdefi.com',
      'frontend': 'https://app.abcdefi.com',
    };
    
    updateService(s.id, { status: 'live', progress: 100, url: urls[s.id] });
    addLog(s.id, `✅ Successfully deployed! Live at ${urls[s.id]}`);
  };

  const handleDeployAll = async () => {
    setGlobalStatus('deploying');
    
    // Sequential/staggered deployment: Contracts -> DB -> Backend -> Frontend
    await deployService(services[0], 1.2); // Contracts
    await deployService(services[1], 1.0); // DB
    await deployService(services[2], 1.1); // Backend
    await deployService(services[3], 0.9); // Frontend
    
    setGlobalStatus('live');
  };

  const statusColor = (status: DeploymentStatus) => {
    switch (status) {
      case 'idle': return 'text-slate-500 bg-slate-500/10 border-slate-500/30';
      case 'building': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'deploying': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'verifying': return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      case 'live': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'failed': return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    }
  };

  const progressBarColor = (status: DeploymentStatus) => {
    if (status === 'live') return 'bg-emerald-500';
    if (status === 'failed') return 'bg-rose-500';
    return 'bg-blue-500';
  };

  const allLogs = services.flatMap(s => s.logs.map(l => ({ service: s.name, log: l, id: s.id })))
    .sort((a, b) => {
      const timeA = a.log.match(/\[(.*?)\]/)?.[1] || '';
      const timeB = b.log.match(/\[(.*?)\]/)?.[1] || '';
      return timeA.localeCompare(timeB);
    });

  const displayLogs = activeLogTab === 'all' 
    ? allLogs 
    : services.find(s => s.id === activeLogTab)?.logs.map(l => ({ service: services.find(s => s.id === activeLogTab)!.name, log: l, id: activeLogTab })) || [];

  return (
    <div id="production-deployment" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 font-mono">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <span>Phase 9 — Production</span>
            <span className="text-slate-600">↓</span>
            <span>Step 22: Deployment</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
            <CloudLightning className="w-5 h-5 text-cyan-400" />
            Production Infrastructure Deployment
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Orchestrate and monitor the deployment of Smart Contracts, Database, Backend API, and Frontend application.
          </p>
        </div>

        <button
          onClick={handleDeployAll}
          disabled={globalStatus === 'deploying' || globalStatus === 'live'}
          className={`shrink-0 px-6 py-3 rounded-2xl font-black text-sm transition shadow-lg flex items-center gap-2 cursor-pointer
            ${globalStatus === 'idle' 
              ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-500/25' 
              : globalStatus === 'deploying' 
                ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                : 'bg-emerald-600 text-white shadow-emerald-500/25'}`}
        >
          {globalStatus === 'idle' && <><Play className="w-4 h-4 fill-current" /> Deploy All to Production</>}
          {globalStatus === 'deploying' && <><RefreshCcw className="w-4 h-4 animate-spin" /> Deploying Infrastructure...</>}
          {globalStatus === 'live' && <><CheckCircle2 className="w-4 h-4" /> Production is Live</>}
        </button>
      </div>

      {/* METRICS ROW */}
      {globalStatus === 'live' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {[
            { label: 'System Health', value: '100%', color: 'text-emerald-400', icon: Activity },
            { label: 'Uptime', value: '99.99%', color: 'text-emerald-400', icon: ShieldCheck },
            { label: 'Active Nodes', value: '12', color: 'text-blue-400', icon: Box },
            { label: 'CPU Utilization', value: '24%', color: 'text-amber-400', icon: Cpu },
          ].map((m) => (
            <div key={m.label} className="bg-slate-950 border border-emerald-900/30 rounded-2xl p-3.5 flex items-center gap-3">
              <div className={`p-2 rounded-xl bg-slate-900 border border-slate-800 ${m.color}`}>
                <m.icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">{m.label}</div>
                <div className={`text-sm font-extrabold ${m.color}`}>{m.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DEPLOYMENT PIPELINE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Services Status */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-slate-400" /> Infrastructure Pipeline
          </h3>
          
          <div className="space-y-3">
            {services.map((s, idx) => (
              <div key={s.id} className="bg-slate-950 border border-slate-800 rounded-3xl p-4 relative overflow-hidden">
                {/* Background Progress Bar */}
                <div 
                  className={`absolute top-0 left-0 h-full opacity-5 transition-all duration-500 ${progressBarColor(s.status)}`}
                  style={{ width: `${s.progress}%` }}
                />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 shrink-0">
                        {s.icon}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">{idx + 1}. {s.name}</div>
                        <div className="text-[10px] text-slate-500 font-medium">Target: {s.version}</div>
                      </div>
                    </div>
                    
                    <div className={`px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase border flex items-center gap-1.5 ${statusColor(s.status)}`}>
                      {s.status === 'building' || s.status === 'deploying' || s.status === 'verifying' ? (
                        <RefreshCcw className="w-3 h-3 animate-spin" />
                      ) : s.status === 'live' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      )}
                      {s.status}
                    </div>
                  </div>

                  {/* Progress Line */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${progressBarColor(s.status)}`}
                        style={{ width: `${s.progress}%` }}
                      />
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 w-8 text-right">{s.progress}%</div>
                  </div>

                  {s.url && (
                    <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Live Endpoint:</span>
                      <a href="#" className="text-cyan-400 hover:text-cyan-300 transition underline underline-offset-4 decoration-cyan-900">{s.url}</a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Terminal Logs */}
        <div className="flex flex-col h-full space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-400" /> Deployment Console
            </h3>
            
            <div className="flex bg-slate-950 border border-slate-800 rounded-xl overflow-hidden p-0.5 text-[10px] font-bold">
              <button 
                onClick={() => setActiveLogTab('all')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${activeLogTab === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                All Logs
              </button>
              {services.map(s => (
                <button 
                  key={s.id}
                  onClick={() => setActiveLogTab(s.id)}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${activeLogTab === s.id ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {s.id}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-[350px] bg-[#0A0C10] border border-slate-800 rounded-3xl p-4 font-mono text-[11px] overflow-hidden flex flex-col relative">
            <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-[#0A0C10] to-transparent z-10 pointer-events-none" />
            
            <div className="flex-1 overflow-y-auto space-y-1.5 pt-2 pb-6 no-scrollbar relative z-0">
              {displayLogs.length === 0 ? (
                <div className="text-slate-600 italic">Waiting for deployment to start...</div>
              ) : (
                displayLogs.map((logItem, i) => (
                  <div key={i} className="leading-relaxed break-all">
                    {activeLogTab === 'all' && (
                      <span className="text-slate-500 mr-2 shrink-0">[{logItem.id}]</span>
                    )}
                    <span className={
                      logItem.log.includes('✅') ? 'text-emerald-400' :
                      logItem.log.includes('Failed') ? 'text-rose-400' :
                      logItem.log.includes('Deploying') ? 'text-amber-400' :
                      logItem.log.includes('Compiling') ? 'text-blue-400' :
                      'text-slate-300'
                    }>
                      {logItem.log}
                    </span>
                  </div>
                ))
              )}
              {globalStatus === 'deploying' && (
                <div className="flex items-center gap-2 text-slate-500 mt-2">
                  <span className="w-2 h-4 bg-slate-500 animate-pulse" />
                </div>
              )}
              <div ref={logsEndRef} />
            </div>

            <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-[#0A0C10] to-transparent z-10 pointer-events-none" />
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProductionDeployment;
