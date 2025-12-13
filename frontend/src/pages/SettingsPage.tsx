import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../components/DashboardLayout';
import authService from '../services/authService';

export function SettingsPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validate = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields.');
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return false;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authService.changePassword({ currentPassword, newPassword });
      setMessage(res.message || 'Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Settings</h2>
          <p className="text-gray-600 mt-1">Account management and security</p>
        </div>

        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
            <p className="text-sm text-gray-600 mt-1">
              Signed in as <span className="font-semibold text-gray-900">{user?.nickname || user?.email}</span>
            </p>
          </div>
          <div className="px-6 py-6">
            <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wildfire-500 focus:border-transparent"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wildfire-500 focus:border-transparent"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">At least 8 characters.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wildfire-500 focus:border-transparent"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
              </div>

              {message && (
                <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
                  {message}
                </div>
              )}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className={`btn-primary ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {loading ? 'Updating…' : 'Update password'}
                </button>
                <span className="text-xs text-gray-500">Tip: use a passphrase.</span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
