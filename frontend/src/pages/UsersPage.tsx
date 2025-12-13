import { useState, useEffect } from 'react';
import type { AxiosError } from 'axios';
import { DashboardLayout } from '../components/DashboardLayout';
import apiClient from '../services/apiClient';

interface User {
  id: number;
  email: string;
  nickname?: string;
  role: 'mod_signer' | 'admin';
  created_at: string;
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/admin/users');
      setUsers(response.data);
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }> | Error;
      if ('response' in axiosError && axiosError.response) {
        setError(axiosError.response.data?.message || 'Failed to load users');
      } else {
        setError('Failed to load users');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (userId: number, newRole: 'mod_signer' | 'admin') => {
    try {
      await apiClient.patch(`/admin/users/${userId}/role`, { role: newRole });
      await loadUsers();
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }> | Error;
      if ('response' in axiosError && axiosError.response) {
        setError(axiosError.response.data?.message || 'Failed to update role');
      } else {
        setError('Failed to update role');
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Users</h2>
          <p className="text-gray-600 mt-1">Manage user accounts and roles</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No users found.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900">{user.nickname || '—'}</span>
                        <span className="text-xs text-gray-600">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        user.role === 'admin' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as 'mod_signer' | 'admin')}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-wildfire-500 focus:border-transparent"
                      >
                        <option value="mod_signer">mod_signer</option>
                        <option value="admin">admin</option>
                      </select>
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
