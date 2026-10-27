import apiClient from './apiClient';

export type AuditVerdict = 'SIGN' | 'REFUSE' | 'NEEDS_HUMAN' | 'REPACKAGE' | 'OUTDATED' | 'UNRELEASED';
export type AuditStatus = 'pending' | 'claimed' | 'completed' | 'failed';

// Dates come back as SQLite values: epoch milliseconds or text
export type AuditDate = string | number | null;

export interface AuditSummary {
  id: number;
  name: string;
  mod_io_url: string;
  version: string;
  status: AuditStatus;
  verdict: AuditVerdict | null;
  review_status: string | null;
  findings_count: number | null;
  error: string | null;
  completed_at: AuditDate;
  reviewed_at: AuditDate;
}

export interface AuditFinding {
  code: string;
  severity: string;
  file: string;
  detail: string;
}

export interface AuditDetail {
  id: number;
  name: string;
  mod_io_url: string;
  version: string;
  status: AuditStatus;
  verdict: AuditVerdict | null;
  review_status: string | null;
  error: string | null;
  completed_at: AuditDate;
  reviewed_at: AuditDate;
  zip_sha256: string | null;
  mod_json: { name?: string; version?: string; dependencies?: string[] } | null;
  stats: { files: number; total_bytes: number; javascript_bytes: number; xml_bytes: number } | null;
  findings: AuditFinding[];
  comment_draft: string | null;
}

export const formatAuditDate = (value: AuditDate): string => {
  if (value === null || value === '') return '—';
  const d = typeof value === 'number' ? new Date(value) : new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value) ? value.replace(' ', 'T') + 'Z' : value);
  if (isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('en-US')} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
};

export const auditsService = {
  async getAudits(params?: { status?: string; verdict?: string }): Promise<AuditSummary[]> {
    const response = await apiClient.get<{ audits: AuditSummary[] }>('/audits', { params });
    return response.data.audits;
  },

  async getAudit(id: string): Promise<AuditDetail> {
    const response = await apiClient.get<AuditDetail>(`/audits/${id}`);
    return response.data;
  },
};

export default auditsService;
