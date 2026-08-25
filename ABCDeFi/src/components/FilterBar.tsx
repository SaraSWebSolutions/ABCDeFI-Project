import React, { useState } from "react";
import { Sliders, RefreshCw } from "lucide-react";
import { FilterCriteria } from "../Context/NFTContext";

interface FilterBarProps {
  onChange: (criteria: FilterCriteria) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ onChange }) => {
  const [role, setRole] = useState<"borrower" | "lender" | "">("");
  const [status, setStatus] = useState<string>("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as "borrower" | "lender" | "";
    setRole(val);
    onChange({ role: val || undefined, status: status || undefined, sort });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setStatus(val);
    onChange({ role: role || undefined, status: val || undefined, sort });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as "newest" | "oldest";
    setSort(val);
    onChange({ role: role || undefined, status: status || undefined, sort: val });
  };

  const handleReset = () => {
    setRole("");
    setStatus("");
    setSort("newest");
    onChange({ sort: "newest" });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 font-mono text-slate-100">
      <div className="flex items-center gap-2">
        <Sliders className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-bold uppercase tracking-wider text-white">Filter NFTs</span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* Role Select */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-slate-400 uppercase">Role</label>
          <select
            value={role}
            onChange={handleRoleChange}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Roles</option>
            <option value="borrower">Borrower</option>
            <option value="lender">Lender</option>
          </select>
        </div>

        {/* Status Select */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-slate-400 uppercase">Status</label>
          <select
            value={status}
            onChange={handleStatusChange}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="repaid">Repaid</option>
            <option value="defaulted">Defaulted</option>
            <option value="liquidated">Liquidated</option>
          </select>
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-slate-400 uppercase">Sort</label>
          <select
            value={sort}
            onChange={handleSortChange}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>

        {/* Reset Button */}
        <button
          onClick={handleReset}
          className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
};

export default FilterBar;
