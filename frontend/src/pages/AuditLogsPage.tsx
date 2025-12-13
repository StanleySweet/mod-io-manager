import { useState, useEffect } from 'react';
import type { AxiosError } from 'axios';
import { DashboardLayout } from '../components/DashboardLayout';
import apiClient from '../services/apiClient';

interface AuditLog {
  id: number;
  user_id: number;
  user_email?: string;
  nickname?: string;
  action: string;
  resource: string | null;
  details: string | null;
  timestamp: string;
}

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortBy, setSortBy] = useState<'timestamp' | 'action' | 'nickname'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const formatDateTime = (value: string | number | null | undefined) => {
    if (!value) return '-';
    
    // Handle various timestamp formats
    let d: Date;
    
    if (typeof value === 'number') {
      // Unix timestamp (seconds or milliseconds)
      d = new Date(value > 1e10 ? value : value * 1000);
    } else if (typeof value === 'string') {
      // SQLite format: "YYYY-MM-DD HH:MM:SS" - convert to ISO
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)) {
        d = new Date(value.replace(' ', 'T') + 'Z');
      } else {
        d = new Date(value);
      }
    } else {
      return '-';
    }
    
    if (isNaN(d.getTime())) {
      console.error('Failed to parse date:', value);
      return '-';
    }
    
    return (
      d.toLocaleDateString('en-US') +
      ' ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    );
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/admin/audit-logs');
      const payload = response.data?.logs || response.data;
      setLogs(Array.isArray(payload) ? payload : []);
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }> | Error;
      if ('response' in axiosError && axiosError.response) {
        setError(axiosError.response.data?.message || 'Failed to load audit logs');
      } else {
        setError('Failed to load audit logs');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      'create': 'bg-green-100 text-green-800',
      'update': 'bg-blue-100 text-blue-800',
      'delete': 'bg-red-100 text-red-800',
      'login': 'bg-purple-100 text-purple-800',
    };
    const classes = colors[action.toLowerCase()] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${classes} capitalize`}>
        {action}
      </span>
    );
  };

  const handleSort = (column: 'timestamp' | 'action' | 'nickname') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'timestamp' ? 'desc' : 'asc');
    }
  };

  // Filter and sort logs
  const filteredLogs = logs
    .filter(log => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        log.nickname?.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query) ||
        log.details?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      let compareA: any;
      let compareB: any;

      switch (sortBy) {
        case 'timestamp':
          compareA = new Date(a.timestamp).getTime();
          compareB = new Date(b.timestamp).getTime();
          break;
        case 'action':
          compareA = a.action.toLowerCase();
          compareB = b.action.toLowerCase();
          break;
        case 'nickname':
          compareA = (a.nickname || '').toLowerCase();
          compareB = (b.nickname || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1;
      if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Audit Logs</h2>
          <p className="text-gray-600 mt-1">Track all user actions and system events</p>
        </div>

        {/* Search Bar */}
        <div>
          <input
            type="text"
            placeholder="Search by user, action, or details..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-wildfire-500 focus:border-transparent"
          />
        </div>

        {/* Results count */}
        <div className="text-sm text-gray-600">
          Showing {paginatedLogs.length} of {filteredLogs.length} logs
          {searchQuery && ` matching "${searchQuery}"`}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading audit logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">
              {searchQuery ? 'No logs found matching your search.' : 'No audit logs found.'}
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th 
                    onClick={() => handleSort('nickname')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      User
                      {sortBy === 'nickname' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('action')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      Action
                      {sortBy === 'action' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Details</th>
                  <th 
                    onClick={() => handleSort('timestamp')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      Date
                      {sortBy === 'timestamp' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900">{log.nickname || '—'}</span>
                        {log.user_email && (
                          <span className="text-xs text-gray-600">{log.user_email}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">{getActionBadge(log.action)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                      {log.details || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDateTime(log.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Page {currentPage} of {totalPages}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>

                  {/* Page numbers */}
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 rounded border ${
                            currentPage === pageNum
                              ? 'bg-wildfire-600 text-white border-wildfire-600'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
