import React, { useState } from 'react';
import { FileText, ArrowRight, UserCheck, Briefcase, Award } from 'lucide-react';

export interface DemographicData {
  fullName: string;
  gender: 'Female' | 'Male' | 'Other';
  dateOfBirth: string;
  nationality: string;
  address: string;
  isLowIncomeEconomy: boolean;
  isFinancialProfessional: boolean;
  workplaceIdCardUploaded: boolean;
}

interface SelectDocumentProps {
  onSelect: (docType: 'National ID' | 'Passport' | 'Aadhaar' | 'Workplace ID', demographics: DemographicData) => void;
}

export const SelectDocument: React.FC<SelectDocumentProps> = ({ onSelect }) => {
  const [selected, setSelected] = useState<'National ID' | 'Passport' | 'Aadhaar' | 'Workplace ID'>('National ID');
  const [fullName, setFullName] = useState<string>('Dinesh Rivers');
  const [gender, setGender] = useState<'Female' | 'Male' | 'Other'>('Male');
  const [dateOfBirth, setDateOfBirth] = useState<string>('2002-05-14'); // Age 24
  const [nationality, setNationality] = useState<string>('India');
  const [address, setAddress] = useState<string>('Hyderabad, Telangana, India');
  const [isLowIncomeEconomy, setIsLowIncomeEconomy] = useState<boolean>(true);
  const [isFinancialProfessional, setIsFinancialProfessional] = useState<boolean>(false);
  const [workplaceIdUploaded, setWorkplaceIdUploaded] = useState<boolean>(false);

  const docs = [
    { id: 'National ID', title: 'National Identity Card', desc: 'Government National Identification Card' },
    { id: 'Aadhaar', title: 'Aadhaar Card / Driver License', desc: 'National Resident Identity Document' },
    { id: 'Passport', title: 'International Passport', desc: 'Official Travel Passport' },
    { id: 'Workplace ID', title: 'Workplace Identity Card', desc: 'Required for Financial Professional Bonus Claim' },
  ] as const;

  const handleSubmit = () => {
    onSelect(selected, {
      fullName,
      gender,
      dateOfBirth,
      nationality,
      address,
      isLowIncomeEconomy,
      isFinancialProfessional,
      workplaceIdCardUploaded: workplaceIdUploaded || selected === 'Workplace ID',
    });
  };

  return (
    <div className="space-y-6 text-slate-100 font-sans">
      <div>
        <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
          Whitepaper Identity & Bonus Verification
        </span>
        <h2 className="text-lg font-bold text-white tracking-tight mt-1.5">Step 2: Identity Documents & Demographic Details</h2>
        <p className="text-xs text-slate-400">Verifies identity, prevents multi-claiming fraud, and unlocks eligible ICO bonuses.</p>
      </div>

      {/* DOCUMENT TYPE SELECTION */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase font-bold text-slate-400">Primary Identity Document</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {docs.map((d) => (
            <div
              key={d.id}
              onClick={() => setSelected(d.id)}
              className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition ${
                selected === d.id
                  ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-md'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  selected === d.id ? 'border-indigo-400 bg-indigo-600' : 'border-slate-700'
                }`}>
                  {selected === d.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{d.title}</div>
                  <div className="text-[10px] text-slate-500">{d.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DEMOGRAPHIC DATA FIELDS FOR BONUSES */}
      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
        <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
          <UserCheck className="w-4 h-4 text-indigo-400" /> Verified Demographic Information (For One-Time Bonus Claims)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase">Full Legal Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full mt-1 bg-slate-900 border border-slate-800 text-white px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase">Gender (Woman Bonus)</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as any)}
              className="w-full mt-1 bg-slate-900 border border-slate-800 text-white px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="Female">Female (+5% Women Bonus Eligible)</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase">Date of Birth (Age Bonus 18-24)</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full mt-1 bg-slate-900 border border-slate-800 text-white px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase">Nationality</label>
            <input
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              className="w-full mt-1 bg-slate-900 border border-slate-800 text-white px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] text-slate-400 font-bold uppercase">Residential Address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full mt-1 bg-slate-900 border border-slate-800 text-white px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* BONUS QUALIFICATION CHECKBOXES */}
        <div className="pt-2 space-y-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isLowIncomeEconomy}
              onChange={(e) => setIsLowIncomeEconomy(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-slate-300">Reside in a Low-Income / Emerging Economy (+5% Bonus)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isFinancialProfessional || selected === 'Workplace ID'}
              onChange={(e) => {
                setIsFinancialProfessional(e.target.checked);
                setWorkplaceIdUploaded(e.target.checked);
              }}
              className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-slate-300">Financial Professional (+10% Bonus, Workplace ID attached)</span>
          </label>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
      >
        <span>Continue to Upload ID Photo & Selfie →</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default SelectDocument;
