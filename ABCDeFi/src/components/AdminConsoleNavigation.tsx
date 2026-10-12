import React from 'react';
import { can, type AdminCapability } from '../Services/adminCapability';

export type AdminConsoleSection =
  | 'overview'
  | 'users'
  | 'compliance'
  | 'operations'
  | 'security'
  | 'lending'
  | 'p2p'
  | 'audit'
  | 'system'
  | 'treasury'
  | 'reserve'
  | 'referral'
  | 'loan-nfts'
  | 'token';

type ConsoleDefinition = { key: AdminConsoleSection; label: string };
export type AdminConsoleGroup = { label: string; sections: ConsoleDefinition[] };

const consoleLabels: Record<NonNullable<AdminCapability['role']>, string> = {
  super_admin: 'Super Admin Console',
  operations_admin: 'Operations Console',
  security_admin: 'Security Console',
  compliance_admin: 'Compliance Console',
  support_admin: 'Support Console',
};

export function consoleForRole(capability: AdminCapability): string {
  return capability.role ? consoleLabels[capability.role] : 'Admin Console Unavailable';
}

export function consoleSectionsFor(capability: AdminCapability): ConsoleDefinition[] {
  const sections: ConsoleDefinition[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'system', label: 'System / Provenance' },
  ];
  if (can(capability, 'users.read')) sections.push({ key: 'users', label: 'Users' });
  if (can(capability, 'compliance.read')) sections.push({ key: 'compliance', label: 'Compliance' });
  if (can(capability, 'ico.read') || can(capability, 'legion.read') || can(capability, 'marketplace.read')) sections.push({ key: 'operations', label: 'Operations' });
  if (can(capability, 'security.read') || can(capability, 'emergency.read')) sections.push({ key: 'security', label: 'Security' });
  if (can(capability, 'lending.read')) sections.push({ key: 'lending', label: 'Lending' });
  if (can(capability, 'p2p.read')) sections.push({ key: 'p2p', label: 'P2P' });
  if (can(capability, 'audit.read')) sections.push({ key: 'audit', label: 'Audit' });
  if (capability.role === 'super_admin') sections.push(
    { key: 'token', label: 'ABCD Token' },
    { key: 'treasury', label: 'Treasury' },
    { key: 'reserve', label: 'Reserve' },
    { key: 'referral', label: 'Referral' },
    { key: 'loan-nfts', label: 'LoanNFT' },
  );
  return sections;
}

/** Permission-filtered information architecture.  This is presentation only:
 * every section keeps the exact pre-existing API and chain enforcement. */
export function consoleNavigationGroupsFor(capability: AdminCapability): AdminConsoleGroup[] {
  const visible = new Map(consoleSectionsFor(capability).map((section) => [section.key, section]));
  const group = (label: string, keys: AdminConsoleSection[]): AdminConsoleGroup | null => {
    const sections = keys.map((key) => visible.get(key)).filter((entry): entry is ConsoleDefinition => Boolean(entry));
    return sections.length ? { label, sections } : null;
  };
  return [
    group('Administration', ['overview', 'users', 'compliance']),
    group('Operations', ['operations']),
    group('Lending', ['lending', 'p2p', 'loan-nfts']),
    group('Treasury & Token', ['token', 'treasury', 'reserve']),
    group('Security', ['security']),
    group('Audit & System', ['audit', 'system', 'referral']),
  ].filter((entry): entry is AdminConsoleGroup => Boolean(entry));
}

export const AdminConsoleNavigation: React.FC<{
  capability: AdminCapability;
  activeSection: AdminConsoleSection;
  onSelect: (section: AdminConsoleSection) => void;
}> = ({ capability, activeSection, onSelect }) => {
  const groups = consoleNavigationGroupsFor(capability);
  return <nav aria-label="Admin console navigation" className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs">
    <p className="font-bold text-white">{consoleForRole(capability)}</p>
    <p className="mt-1 text-slate-400">Only sections backed by an application permission are navigable. A visible section still fails closed when its canonical source is unavailable.</p>
    <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => <section key={group.label} aria-label={`${group.label} navigation`} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2"><p className="px-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{group.label}</p><div className="mt-2 flex flex-wrap gap-2">{group.sections.map((section) => <button
        key={section.key}
        type="button"
        aria-pressed={activeSection === section.key}
        onClick={() => onSelect(section.key)}
        className={activeSection === section.key
          ? 'rounded-lg border border-cyan-400/60 bg-cyan-400/10 px-3 py-2 font-bold text-cyan-100'
          : 'rounded-lg border border-slate-700 px-3 py-2 font-semibold text-slate-300 hover:border-slate-500'}
      >{section.label}</button>)}</div></section>)}
    </div>
  </nav>;
};
