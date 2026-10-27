import type { AuditVerdict } from '../services/auditsService';

const VERDICT_CLASSES: Record<AuditVerdict, string> = {
  SIGN: 'bg-green-100 text-green-800',
  REFUSE: 'bg-red-100 text-red-800',
  NEEDS_HUMAN: 'bg-amber-100 text-amber-800',
  REPACKAGE: 'bg-blue-100 text-blue-800',
  OUTDATED: 'bg-gray-100 text-gray-600',
  UNRELEASED: 'bg-gray-100 text-gray-600',
};

export function VerdictBadge({ verdict }: { verdict: AuditVerdict | null }) {
  if (!verdict) {
    return <span className="text-sm text-gray-500">—</span>;
  }
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${VERDICT_CLASSES[verdict]}`}>
      {verdict}
    </span>
  );
}
