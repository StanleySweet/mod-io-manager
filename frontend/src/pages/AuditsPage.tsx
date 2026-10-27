import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { AxiosError } from 'axios';
import { DashboardLayout } from '../components/DashboardLayout';
import { VerdictBadge } from '../components/VerdictBadge';
import auditsService, { formatAuditDate } from '../services/auditsService';
import type { AuditSummary, AuditVerdict, AuditStatus } from '../services/auditsService';

const VERDICTS: AuditVerdict[] = ['SIGN', 'REFUSE', 'NEEDS_HUMAN', 'REPACKAGE', 'OUTDATED', 'UNRELEASED'];
const STATUSES: AuditStatus[] = ['pending', 'claimed', 'completed', 'failed'];

export function AuditsPage() {
  const [audits, setAudits] = useState<AuditSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('');

  const loadAudits = useCallback(async () => {
    try {
      setIsLoading(true);
      setAudits(await auditsService.getAudits({ status: statusFilter || undefined, verdict: verdictFilter || undefined }));
      setError('');
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError(axiosError.response?.data?.message || 'Failed to load audits');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, verdictFilter]);

  useEffect(() => {
    loadAudits();
  }, [loadAudits]);

  const selectClass = 'px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-wildfire-500 focus:border-transparent bg-white';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Audits</h2>
          <p className="text-gray-600 mt-1">Results of the modaudit queue, read-only. Approvals happen in the terminal tool.</p>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-end flex-wrap">
          <label className="flex flex-col text-sm text-gray-700 gap-1">
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm text-gray-700 gap-1">
            Verdict
            <select value={verdictFilter} onChange={(e) => setVerdictFilter(e.target.value)} className={selectClass}>
              <option value="">All</option>
              {VERDICTS.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading audits...</p>
          </div>
        ) : audits.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No audits found.</p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Mod</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Version</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Verdict</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Review</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Findings</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Completed</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {audits.map((audit) => (
                  <tr key={audit.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <a
                        href={audit.mod_io_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-wildfire-600 hover:text-wildfire-700 underline underline-offset-2"
                      >
                        {audit.name}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{audit.version}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{audit.status}</div>
                      {audit.error && (
                        <div className="text-xs text-red-600 max-w-xs truncate" title={audit.error}>{audit.error}</div>
                      )}
                    </td>
                    <td className="px-6 py-4"><VerdictBadge verdict={audit.verdict} /></td>
                    <td className="px-6 py-4 text-sm text-gray-600">{audit.review_status ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{audit.findings_count ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatAuditDate(audit.completed_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/dashboard/audits/${audit.id}`} className="text-wildfire-600 hover:text-wildfire-700 text-sm font-medium">
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
