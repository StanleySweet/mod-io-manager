import { useState, useEffect } from 'react';
import type { AxiosError } from 'axios';
import { DashboardLayout } from '../components/DashboardLayout';
import apiKeysService from '../services/apiKeysService';
import type { ApiKey, CreatedApiKey } from '../services/apiKeysService';

const errorMessage = (err: unknown, fallback: string) => {
  const axiosError = err as AxiosError<{ message: string }>;
  return axiosError.response?.data?.message || fallback;
};

export function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      setIsLoading(true);
      setKeys(await apiKeysService.getApiKeys());
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Failed to load API keys'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      setIsCreating(true);
      setError('');
      setCopied(false);
      const created = await apiKeysService.createApiKey(trimmed);
      setCreatedKey(created);
      setName('');
      await loadKeys();
    } catch (err) {
      setError(errorMessage(err, 'Failed to create API key'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
    } catch {
      setError('Copy failed. Select the key and copy it manually.');
    }
  };

  const handleRevoke = async (key: ApiKey) => {
    if (!window.confirm(`Revoke API key "${key.name}"? Any worker using it will stop working.`)) return;
    try {
      setError('');
      await apiKeysService.revokeApiKey(key.id);
      await loadKeys();
    } catch (err) {
      setError(errorMessage(err, 'Failed to revoke API key'));
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">API Keys</h2>
          <p className="text-gray-600 mt-1">Keys used by the modaudit queue worker</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Create API key</h3>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[240px]">
              <label htmlFor="api-key-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                id="api-key-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={255}
                placeholder="e.g. audit-worker-1"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wildfire-500 focus:border-transparent"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className={`btn-primary ${isCreating || !name.trim() ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isCreating ? 'Creating…' : 'Create key'}
            </button>
          </form>

          {createdKey && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-300 rounded-lg space-y-3">
              <p className="text-sm font-semibold text-amber-900">
                Copy this key now. You will not see it again.
              </p>
              <p className="text-xs text-amber-800">
                Only a hash is stored. If you lose this key, revoke it and create a new one.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <code className="flex-1 min-w-[240px] break-all bg-white border border-amber-200 rounded px-3 py-2 text-sm font-mono text-gray-900">
                  {createdKey.key}
                </code>
                <button type="button" onClick={handleCopy} className="btn-secondary">
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button type="button" onClick={() => setCreatedKey(null)} className="btn-secondary">
                  I have saved it
                </button>
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading API keys...</p>
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No API keys yet.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Last used</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {keys.map((key) => (
                  <tr key={key.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{key.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{key.role}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        key.revoked_at ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-800'
                      }`}>
                        {key.revoked_at ? 'Revoked' : 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(key.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-6 py-4">
                      {!key.revoked_at && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(key)}
                          className="px-3 py-1 text-sm text-red-700 border border-red-300 rounded-md hover:bg-red-50"
                        >
                          Revoke
                        </button>
                      )}
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
