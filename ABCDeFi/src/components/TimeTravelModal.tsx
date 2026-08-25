import React, { useState } from 'react';
import { FastForward, Clock, Calendar, X } from 'lucide-react';

interface TimeTravelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTimestamp: number;
  onSetTime: (timestamp: number) => void;
}

export const TimeTravelModal: React.FC<TimeTravelModalProps> = ({
  isOpen,
  onClose,
  currentTimestamp,
  onSetTime,
}) => {
  if (!isOpen) return null;

  const currentDateIso = new Date(currentTimestamp * 1000).toISOString().slice(0, 16);
  const [dateInput, setDateInput] = useState<string>(currentDateIso);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ts = Math.floor(new Date(dateInput).getTime() / 1000);
    if (!isNaN(ts) && ts > 0) {
      onSetTime(ts);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer font-bold"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <FastForward className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">EVM Block Time Warp</h3>
            <p className="text-xs text-slate-400">Set exact simulated blockchain timestamp</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Target Date & Time
            </label>
            <input
              type="datetime-local"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer"
            />
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Current Block Time:</span>
              <span className="text-white">{new Date(currentTimestamp * 1000).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Target Unix Epoch:</span>
              <span className="text-indigo-300 font-bold">
                {Math.floor(new Date(dateInput).getTime() / 1000) || 0}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              Warp EVM Clock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
