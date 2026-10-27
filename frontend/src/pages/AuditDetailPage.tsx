import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { AxiosError } from 'axios';
import { DashboardLayout } from '../components/DashboardLayout';
import { VerdictBadge } from '../components/VerdictBadge';
import auditsService, { formatAuditDate } from '../services/auditsService';
import type { AuditDetail, AuditFinding } from '../services/auditsService';

const SEVERITY_ORDER = ['blocker', 'warn', 'info'];

const SEVERITY_CLASSES: Record<string, string> = {
  blocker: 'text-red-700',
  warn: 'text-amber-700',
  info: 'text-blue-700',
};

export function AuditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const data = await auditsService.getAudit(id);
        if (!cancelled) {
          setAudit(data);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          const axiosError = err as AxiosError<{ message: string }>;
          setError(axiosError.response?.data?.message || 'Failed to load audit');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Known severities first, in order; any unknown severity still shows, after them
  const findings = audit?.findings ?? [];
  const severities = [...new Set([...SEVERITY_ORDER, ...findings.map((f) => f.severity)])];
  const findingGroups = severities
    .map((severity) => ({ severity, items: findings.filter((f) => f.severity === severity) }))
    .filter((group) => group.items.length > 0);

  const renderFindings = (items: AuditFinding[]) => (
    <table className="w-full">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="px-6 py-2 text-left text-xs font-medium text-gray-700 uppercase">Code</th>
          <th className="px-6 py-2 text-left text-xs font-medium text-gray-700 uppercase">File</th>
          <th className="px-6 py-2 text-left text-xs font-medium text-gray-700 uppercase">Detail</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {items.map((f, i) => (
          <tr key={`${f.code}-${f.file}-${i}`}>
            <td className="px-6 py-3 text-sm font-mono text-gray-900 whitespace-nowrap">{f.code}</td>
            <td className="px-6 py-3 text-sm font-mono text-gray-600 break-all">{f.file || '—'}</td>
            <td className="px-6 py-3 text-sm text-gray-700">{f.detail}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{audit ? `${audit.name} ${audit.version}` : 'Audit'}</h2>
            {audit && (
              <a
                href={audit.mod_io_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-wildfire-600 hover:text-wildfire-700 underline underline-offset-2"
              >
                View on mod.io ↗
              </a>
            )}
          </div>
          <Link to="/dashboard/audits" className="text-wildfire-600 hover:text-wildfire-700 font-medium">
            Back to Audits
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading audit...</p>
          </div>
        ) : audit && (
          <>
            {audit.error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                <div className="font-semibold mb-1">Error</div>
                <div className="font-mono text-sm break-all">{audit.error}</div>
              </div>
            )}

            {/* Summary */}
            <div className="card">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">Summary</h3>
              </div>
              <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Verdict</div>
                  <div className="mt-1"><VerdictBadge verdict={audit.verdict} /></div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Status</div>
                  <div className="text-base text-gray-900">{audit.status}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Review</div>
                  <div className="text-base text-gray-900">{audit.review_status ?? '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Completed</div>
                  <div className="text-base text-gray-900">{formatAuditDate(audit.completed_at)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Reviewed</div>
                  <div className="text-base text-gray-900">{formatAuditDate(audit.reviewed_at)}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-sm text-gray-600">Zip SHA-256</div>
                  <div className="font-mono text-sm text-gray-900 break-all">{audit.zip_sha256 ?? '—'}</div>
                </div>
              </div>
            </div>

            {/* Stats and mod.json */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900">Stats</h3>
                </div>
                <dl className="px-6 py-4 grid grid-cols-2 gap-4 text-sm">
                  <dt className="text-gray-600">Files</dt>
                  <dd className="text-gray-900">{audit.stats?.files ?? '—'}</dd>
                  <dt className="text-gray-600">Total bytes</dt>
                  <dd className="text-gray-900">{audit.stats?.total_bytes?.toLocaleString('en-US') ?? '—'}</dd>
                  <dt className="text-gray-600">JavaScript bytes</dt>
                  <dd className="text-gray-900">{audit.stats?.javascript_bytes?.toLocaleString('en-US') ?? '—'}</dd>
                  <dt className="text-gray-600">XML bytes</dt>
                  <dd className="text-gray-900">{audit.stats?.xml_bytes?.toLocaleString('en-US') ?? '—'}</dd>
                </dl>
              </div>

              <div className="card">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900">mod.json</h3>
                </div>
                <dl className="px-6 py-4 grid grid-cols-2 gap-4 text-sm">
                  <dt className="text-gray-600">Name</dt>
                  <dd className="text-gray-900">{audit.mod_json?.name ?? '—'}</dd>
                  <dt className="text-gray-600">Version</dt>
                  <dd className="text-gray-900">{audit.mod_json?.version ?? '—'}</dd>
                  <dt className="text-gray-600">Dependencies</dt>
                  <dd className="text-gray-900">
                    {audit.mod_json?.dependencies?.length
                      ? <ul className="font-mono break-all space-y-1">{audit.mod_json.dependencies.map((d) => <li key={d}>{d}</li>)}</ul>
                      : 'None'}
                  </dd>
                </dl>
              </div>
            </div>

            {/* Findings */}
            <div className="card overflow-x-auto">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">Findings ({findings.length})</h3>
              </div>
              {findingGroups.length === 0 ? (
                <div className="px-6 py-6 text-sm text-gray-600">No findings.</div>
              ) : (
                findingGroups.map((group) => (
                  <div key={group.severity} className="border-b border-gray-200 last:border-b-0">
                    <div className={`px-6 pt-4 pb-2 text-sm font-semibold uppercase ${SEVERITY_CLASSES[group.severity] ?? 'text-gray-700'}`}>
                      {group.severity} ({group.items.length})
                    </div>
                    {renderFindings(group.items)}
                  </div>
                ))
              )}
            </div>

            {/* Comment draft */}
            <div className="card">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">Comment draft</h3>
              </div>
              <div className="px-6 py-4">
                {audit.comment_draft ? (
                  <pre className="whitespace-pre-wrap break-words font-mono text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg p-4">{audit.comment_draft}</pre>
                ) : (
                  <p className="text-sm text-gray-600">No comment draft.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
