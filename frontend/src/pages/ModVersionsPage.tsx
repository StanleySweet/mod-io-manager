import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import apiClient from '../services/apiClient';

interface ModVersion {
  id: number;
  mod_id: number;
  version: string;
  uploaded_at: string;
  is_signed: boolean;
  is_current: boolean;
  filesize: number;
  mod_io_file_id: number;
  checksum_hash?: string;
  signature?: string;
}

interface Mod {
  id: number;
  name: string;
  mod_io_id: number;
  mod_io_url: string;
}

interface ModVersionsResponse {
  mod: Mod;
  versions: ModVersion[];
}

export function ModVersionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [mod, setMod] = useState<Mod | null>(null);
  const [versions, setVersions] = useState<ModVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'signed' | 'unsigned'>('all');

  const loadVersions = useCallback(async () => {
    if (!id) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await apiClient.get<ModVersionsResponse>(`/mods/${id}/versions`);
      setMod(response.data.mod);
      setVersions(response.data.versions);
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load mod versions');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredVersions = versions.filter(v => {
    if (filterStatus === 'signed') return v.is_signed;
    if (filterStatus === 'unsigned') return !v.is_signed;
    return true;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{mod?.name || 'Loading...'}</h2>
            {mod && (
              <div className="mt-2 flex gap-4 text-sm text-gray-600">
                <span>Mod.io ID: {mod.mod_io_id}</span>
                <a 
                  href={mod.mod_io_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-wildfire-600 hover:text-wildfire-700 underline underline-offset-2"
                >
                  View on mod.io ↗
                </a>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-wildfire-600 hover:text-wildfire-700 font-medium"
          >
            Back to Mods
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Filters - always visible */}
        <div className="flex gap-2 items-center flex-wrap">
          {(['all', 'signed', 'unsigned'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={
                filterStatus === status
                  ? 'btn-primary'
                  : 'btn-secondary'
              }
            >
              {status === 'all' ? 'All' : status === 'signed' ? 'Signed' : 'Unsigned'}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading versions...</p>
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No versions found for this mod.</p>
          </div>
        ) : (
          <>
            {/* Active Version + Versions Table */}
            <div className="space-y-6">
              {/* Active Version card */}
              {(function () {
                const active = versions.find(v => v.is_current);
                if (!active) return null;
                return (
                <div className="card">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      Active Version
                      <span className="px-2 py-1 text-xs font-semibold rounded-full border bg-wildfire-50 text-wildfire-700 border-wildfire-200">Live</span>
                    </h3>
                    {/* Quick link to mod.io files admin */}
                    {mod?.mod_io_url && (
                      <a
                        href={(function () {
                          try {
                            const parts = mod.mod_io_url.split('/m/');
                            const slug = parts[1]?.split('/')[0] || '';
                            return slug ? `https://mod.io/g/0ad/m/${slug}/admin/settings#files` : mod.mod_io_url;
                          } catch {
                            return mod.mod_io_url;
                          }
                        })()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-wildfire-600 hover:text-wildfire-700 text-sm font-medium"
                      >
                        Manage files on mod.io ↗
                      </a>
                    )}
                  </div>
                  <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Version</div>
                      <div className="text-base font-medium text-gray-900">{active.version}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Uploaded</div>
                      <div className="text-base text-gray-900">{formatDate(active.uploaded_at)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Size</div>
                      <div className="text-base text-gray-900">{formatFileSize(active.filesize)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Signed</div>
                      <div className="text-base text-gray-900">{active.is_signed ? '✓ Signed' : '✗ Unsigned'}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Versions Table */}
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">
                  Version History ({filteredVersions.length} version{filteredVersions.length !== 1 ? 's' : ''})
                </h3>
              </div>
              
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Version</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Uploaded</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Signed</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Checksum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredVersions
                    .filter(v => !v.is_current)
                    .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
                    .map((version) => (
                    <tr key={version.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">{version.version}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(version.uploaded_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatFileSize(version.filesize)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {version.is_signed ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-green-600 font-medium">✓ Signed</span>
                            {version.signature && (
                              <code className="text-xs text-gray-500 break-all">
                                {version.signature.substring(0, 16)}...
                              </code>
                            )}
                          </div>
                        ) : (
                          <span className="text-red-600 font-medium">✗ Unsigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {version.checksum_hash ? (
                          <code className="text-xs text-gray-600 break-all">
                            {version.checksum_hash.substring(0, 16)}...
                          </code>
                        ) : (
                          <span className="text-gray-400 text-sm">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">
                  Version History ({filteredVersions.length} version{filteredVersions.length !== 1 ? 's' : ''})
                </h3>
              </div>
              
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Version</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Uploaded</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Signed</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Checksum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredVersions
                    .filter(v => !v.is_current)
                    .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
                    .map((version) => (
                    <tr key={version.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">{version.version}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(version.uploaded_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatFileSize(version.filesize)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {version.is_signed ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-green-600 font-medium">✓ Signed</span>
                            {version.signature && (
                              <code className="text-xs text-gray-500 break-all">
                                {version.signature.substring(0, 16)}...
                              </code>
                            )}
                          </div>
                        ) : (
                          <span className="text-red-600 font-medium">✗ Unsigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {version.checksum_hash ? (
                          <code className="text-xs text-gray-600 break-all">
                            {version.checksum_hash.substring(0, 16)}...
                          </code>
                        ) : (
                          <span className="text-gray-400 text-sm">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
