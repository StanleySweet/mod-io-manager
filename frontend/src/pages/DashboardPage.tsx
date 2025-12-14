import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Mod } from '../services/modsService';
import type { AxiosError } from 'axios';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../components/DashboardLayout';
import modsService from '../services/modsService';

export function DashboardPage() {
  const [mods, setMods] = useState<Mod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<0 | 1 | 3 | 'all' | 'outdated'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'version' | 'signed'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadMods();
  }, []);

  const loadMods = async () => {
    try {
      setIsLoading(true);
      const isOutdatedFilter = filter === 'outdated';
      const data = await modsService.getAllMods({ outdated: isOutdatedFilter });
      setMods(data);
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }> | Error;
      if ('response' in axiosError && axiosError.response) {
        setError(axiosError.response.data?.message || 'Failed to load mods');
      } else {
        setError('Failed to load mods');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: 0 | 1 | 3) => {
    const styles: Record<0 | 1 | 3, { bg: string; text: string; label: string }> = {
      0: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
      1: { bg: 'bg-green-100', text: 'text-green-800', label: 'Live' },
      3: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Archived' },
    };
    const style = styles[status];
    return (
      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    );
  };

  const filteredMods = useMemo(() => {
    let result = mods;
    
    // Filter by status (excluding 'outdated' which is handled differently)
    if (filter !== 'all' && filter !== 'outdated') {
      result = result.filter(m => m.status === filter);
    }
    
    // Filter: only outdated
    if (filter === 'outdated') {
      result = result.filter(m => !!m.latest_version && !!m.current_version && m.latest_version !== m.current_version);
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(m => 
        m.name.toLowerCase().includes(query) ||
        m.summary?.toLowerCase().includes(query)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let compareA: any;
      let compareB: any;
      
      switch (sortBy) {
        case 'name':
          compareA = a.name.toLowerCase();
          compareB = b.name.toLowerCase();
          break;
        case 'status':
          compareA = a.status;
          compareB = b.status;
          break;
        case 'version':
          compareA = a.latest_version || '';
          compareB = b.latest_version || '';
          break;
        case 'signed':
          compareA = a.is_signed ? 1 : 0;
          compareB = b.is_signed ? 1 : 0;
          break;
        default:
          return 0;
      }
      
      if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1;
      if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [mods, filter, searchQuery, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredMods.length / itemsPerPage);
  const paginatedMods = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredMods.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredMods, currentPage, itemsPerPage]);

  const handleSort = (column: 'name' | 'status' | 'version' | 'signed') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Mods</h2>
            <p className="text-gray-600 mt-1">
              {user?.role === 'mod_signer' 
                ? 'Unsigned mods available for signing' 
                : 'All mods in the system'}
            </p>
          </div>
          <button
            onClick={loadMods}
            className="btn-primary"
          >
            Refresh
          </button>
        </div>

        {/* Filters and Search */}
        <div className="space-y-4">
          {/* Search Bar */}
          <div>
            <input
              type="text"
              placeholder="Search mods by name or description..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset to first page on search
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-wildfire-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter + Outdated Toggle */}
          <div className="flex gap-2 items-center flex-wrap">
            {(['all', 0, 1, 3, 'outdated'] as const).map((filterValue) => (
              <button
                key={filterValue}
                onClick={() => {
                  setFilter(filterValue);
                  setCurrentPage(1); // Reset to first page on filter change
                  // Reload mods with the new filter
                  (async () => {
                    setIsLoading(true);
                    try {
                      const isOutdatedFilter = filterValue === 'outdated';
                      const data = await modsService.getAllMods({ outdated: isOutdatedFilter });
                      setMods(data);
                    } finally {
                      setIsLoading(false);
                    }
                  })();
                }}
                className={
                  filter === filterValue
                    ? 'btn-primary'
                    : 'btn-secondary'
                }
                title={filterValue === 'outdated' ? 'Show only mods with updates available' : undefined}
              >
                {filterValue === 'all' ? 'All' : filterValue === 0 ? 'Pending' : filterValue === 1 ? 'Live' : filterValue === 3 ? 'Archived' : `Outdated only (${mods.filter(m => !!m.latest_version && !!m.current_version && m.latest_version !== m.current_version).length})`}
              </button>
            ))}
          </div>

          {/* Results count */}
          <div className="text-sm text-gray-600">
            Showing {paginatedMods.length} of {filteredMods.length} mods
            {searchQuery && ` matching "${searchQuery}"`}
          </div>

          {/* Outdated filter checkbox removed in favor of button */}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading mods...</p>
          </div>
        ) : filteredMods.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No mods found.</p>
          </div>
        ) : (
          /* Mods Table */
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      Name
                      {sortBy === 'name' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Update / Status</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase">Current</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase">Latest</th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('signed')}
                  >
                    <div className="flex items-center gap-2">
                      Signed
                      {sortBy === 'signed' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Versions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedMods.map((mod) => (
                  <tr key={mod.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <a
                        href={(function () {
                          try {
                            const url = mod.mod_io_url || '';
                            const parts = url.split('/m/');
                            if (parts.length === 2) {
                              const slug = parts[1].split('/')[0];
                              return `https://mod.io/g/0ad/m/${slug}/admin/settings#files`;
                            }
                            return url;
                          } catch {
                            return mod.mod_io_url;
                          }
                        })()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-wildfire-600 hover:text-wildfire-700"
                      >
                        {mod.name}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {mod.status === 1 && mod.latest_version && mod.current_version && mod.latest_version !== mod.current_version ? (
                        <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-wildfire-100 text-wildfire-800 border border-wildfire-200">
                          Update available
                        </span>
                      ) : (
                        getStatusBadge(mod.status)
                      )}
                    </td>
                     <td className="px-6 py-4 text-sm text-gray-900">
                       <div className="flex items-center gap-2">
                         <span>{mod.current_version || '-'}</span>
                         {mod.current_version && (
                           <span
                             className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border ${
                               mod.current_version === mod.latest_version
                                 ? 'bg-wildfire-50 text-wildfire-700 border-wildfire-200'
                                 : 'bg-amber-50 text-amber-800 border-amber-200'
                             }`}
                           >
                             {mod.current_version === mod.latest_version ? 'Live' : 'Active'}
                           </span>
                         )}
                       </div>
                     </td>
                     <td className="px-6 py-4 text-sm text-gray-900">
                       <div className="flex items-center gap-2">
                         <span>{mod.latest_version || '-'}</span>
                         {mod.latest_version && (
                           <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border bg-blue-50 text-blue-800 border-blue-200">Latest</span>
                         )}
                       </div>
                     </td>
                    <td className="px-6 py-4 text-sm">
                      {mod.is_signed ? (
                        <span className="text-green-700 font-medium">✓ Signed</span>
                      ) : (
                        <span className="text-red-700 font-medium">✗ Unsigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {mod.version_count ? (
                        <>
                          {mod.version_count} version{mod.version_count !== 1 ? 's' : ''}
                        </>
                      ) : (
                        <span className="inline-flex items-center rounded px-2 py-1 text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                          ⚠ No files (spam?)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => navigate(`/dashboard/mods/${mod.id}/versions`)}
                        className="text-wildfire-600 hover:text-wildfire-700 font-medium"
                      >
                        View Versions
                      </button>
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
