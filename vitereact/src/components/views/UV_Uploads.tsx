import React, { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// Type definitions based on Zod schemas
interface UploadJob {
  id: string;
  workspace_id: string;
  user_id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  platform: string;
  status: string;
  progress: number;
  rows_processed: number;
  rows_total: number;
  rows_success: number;
  rows_error: number;
  error_text: string | null;
  error_log_url: string | null;
  mapping_template_id: string | null;
  date_from: string | null;
  date_to: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PaginatedUploadsResponse {
  data: UploadJob[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface FilterState {
  status_filter: string | null;
  platform_filter: string | null;
  search_query: string | null;
}

const UV_Uploads: React.FC = () => {
  const { workspace_id } = useParams<{ workspace_id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Global state access - individual selectors
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const globalUploadState = useAppStore(state => state.upload_state);

  // Local state
  const [selectedUpload, setSelectedUpload] = useState<UploadJob | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Filter state from URL parameters
  const filterState: FilterState = {
    status_filter: searchParams.get('status_filter'),
    platform_filter: searchParams.get('platform_filter'),
    search_query: searchParams.get('search_query'),
  };

  const currentPage = parseInt(searchParams.get('page') || '1');
  const perPage = 10;

  // API base URL
  const getApiBaseUrl = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Fetch upload history
  const {
    data: uploadHistory,
    isLoading: isFetchingHistory,
    error: fetchError,
    refetch: refetchHistory
  } = useQuery({
    queryKey: ['upload_history', workspace_id, filterState, currentPage],
    queryFn: async (): Promise<PaginatedUploadsResponse> => {
      const params = new URLSearchParams();
      if (filterState.status_filter) params.append('status_filter', filterState.status_filter);
      if (filterState.platform_filter) params.append('platform_filter', filterState.platform_filter);
      if (filterState.search_query) params.append('search_query', filterState.search_query);
      params.append('page', currentPage.toString());
      params.append('limit', perPage.toString());

      const response = await axios.get(
        `${getApiBaseUrl()}/api/workspaces/${workspace_id}/uploads?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      return response.data;
    },
    enabled: !!workspace_id && !!authToken,
    staleTime: 30000, // 30 seconds
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });

  // Delete upload mutation
  const deleteUploadMutation = useMutation({
    mutationFn: async (uploadId: string) => {
      await axios.delete(
        `${getApiBaseUrl()}/api/workspaces/${workspace_id}/uploads/${uploadId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upload_history'] });
      setSelectedUpload(null);
      setShowDeleteModal(false);
    },
  });

  // Reprocess upload mutation
  const reprocessUploadMutation = useMutation({
    mutationFn: async (uploadId: string) => {
      await axios.post(
        `${getApiBaseUrl()}/api/workspaces/${workspace_id}/uploads/${uploadId}/reprocess`,
        {},
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upload_history'] });
    },
  });

  // Update URL parameters
  const updateFilter = (key: keyof FilterState, value: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.delete('page'); // Reset to page 1 when filtering
    setSearchParams(newParams);
  };

  const updatePage = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    setSearchParams(newParams);
  };

  // Status badge component
  const StatusBadge: React.FC<{ status: string; progress?: number }> = ({ status, progress }) => {
    const getStatusConfig = (status: string) => {
      switch (status) {
        case 'queued':
          return { color: 'bg-gray-100 text-gray-800', label: 'Queued' };
        case 'processing':
          return { color: 'bg-blue-100 text-blue-800', label: 'Processing' };
        case 'completed':
          return { color: 'bg-green-100 text-green-800', label: 'Completed' };
        case 'failed':
          return { color: 'bg-red-100 text-red-800', label: 'Failed' };
        default:
          return { color: 'bg-gray-100 text-gray-800', label: status };
      }
    };

    const config = getStatusConfig(status);

    return (
      <div className="flex items-center space-x-2">
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
          {config.label}
        </span>
        {status === 'processing' && progress !== undefined && (
          <div className="w-16 bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    );
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle error log download
  const handleDownloadErrorLog = (errorLogUrl: string) => {
    window.open(errorLogUrl, '_blank');
  };

  // Calculate upload analytics
  const calculateAnalytics = () => {
    if (!uploadHistory?.data.length) return null;

    const total = uploadHistory.data.length;
    const completed = uploadHistory.data.filter(u => u.status === 'completed').length;
    const failed = uploadHistory.data.filter(u => u.status === 'failed').length;
    const processing = uploadHistory.data.filter(u => u.status === 'processing').length;

    const successRate = total > 0 ? (completed / total) * 100 : 0;

    return {
      total,
      completed,
      failed,
      processing,
      successRate: Math.round(successRate),
    };
  };

  const analytics = calculateAnalytics();

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Upload Management</h1>
                  <p className="mt-2 text-sm text-gray-600">
                    Manage your data uploads and track processing status
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <Link
                    to={`/w/${workspace_id}/upload`}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Upload New File
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Analytics Cards */}
          {analytics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Uploads</p>
                    <p className="text-2xl font-bold text-gray-900">{analytics.total}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Completed</p>
                    <p className="text-2xl font-bold text-gray-900">{analytics.completed}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Failed</p>
                    <p className="text-2xl font-bold text-gray-900">{analytics.failed}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Success Rate</p>
                    <p className="text-2xl font-bold text-gray-900">{analytics.successRate}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Uploads from Global State */}
          {globalUploadState.active_uploads.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-8 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Active Uploads</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {globalUploadState.active_uploads.map((upload) => (
                  <div key={upload.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{upload.filename}</p>
                        <p className="text-sm text-gray-500 capitalize">{upload.platform}</p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <StatusBadge status={upload.status} progress={upload.progress} />
                        <span className="text-sm text-gray-500">{upload.progress}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-8 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search Files</label>
                <input
                  type="text"
                  placeholder="Search by filename..."
                  value={filterState.search_query || ''}
                  onChange={(e) => updateFilter('search_query', e.target.value || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filterState.status_filter || ''}
                  onChange={(e) => updateFilter('status_filter', e.target.value || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="queued">Queued</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
                <select
                  value={filterState.platform_filter || ''}
                  onChange={(e) => updateFilter('platform_filter', e.target.value || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Platforms</option>
                  <option value="facebook">Facebook</option>
                  <option value="tiktok">TikTok</option>
                  <option value="snapchat">Snapchat</option>
                  <option value="google">Google</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="twitter">Twitter</option>
                </select>
              </div>
            </div>
          </div>

          {/* Upload History Table */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Upload History</h3>
            </div>

            {isFetchingHistory ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading uploads...</p>
              </div>
            ) : fetchError ? (
              <div className="p-8 text-center">
                <div className="text-red-600 mb-2">
                  <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">Failed to load uploads</p>
                <button
                  onClick={() => refetchHistory()}
                  className="mt-2 text-blue-600 hover:text-blue-500 text-sm font-medium"
                >
                  Try again
                </button>
              </div>
            ) : !uploadHistory?.data.length ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No uploads found</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {Object.values(filterState).some(Boolean) 
                    ? "No uploads match your current filters" 
                    : "Get started by uploading your first file"
                  }
                </p>
                <Link
                  to={`/w/${workspace_id}/upload`}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Upload File
                </Link>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          File
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Platform
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Progress
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {uploadHistory.data.map((upload) => (
                        <tr key={upload.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {upload.original_filename}
                              </p>
                              <p className="text-sm text-gray-500">
                                {formatFileSize(upload.file_size)}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="capitalize text-sm text-gray-900">
                              {upload.platform}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={upload.status} progress={upload.progress} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {upload.rows_total > 0 ? (
                              <div>
                                <p>{upload.rows_processed.toLocaleString()} / {upload.rows_total.toLocaleString()} rows</p>
                                {upload.rows_error > 0 && (
                                  <p className="text-red-600 text-xs">
                                    {upload.rows_error.toLocaleString()} errors
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(upload.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              {upload.status === 'failed' && (
                                <button
                                  onClick={() => reprocessUploadMutation.mutate(upload.id)}
                                  disabled={reprocessUploadMutation.isPending}
                                  className="text-blue-600 hover:text-blue-500 disabled:opacity-50"
                                  title="Reprocess Upload"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                </button>
                              )}
                              
                              {upload.error_log_url && (
                                <button
                                  onClick={() => handleDownloadErrorLog(upload.error_log_url!)}
                                  className="text-orange-600 hover:text-orange-500"
                                  title="Download Error Log"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </button>
                              )}
                              
                              <button
                                onClick={() => {
                                  setSelectedUpload(upload);
                                  setShowDeleteModal(true);
                                }}
                                className="text-red-600 hover:text-red-500"
                                title="Delete Upload"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {uploadHistory.pagination.total_pages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Showing {((currentPage - 1) * perPage) + 1} to {Math.min(currentPage * perPage, uploadHistory.pagination.total)} of {uploadHistory.pagination.total} uploads
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updatePage(currentPage - 1)}
                        disabled={currentPage <= 1}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      
                      {Array.from({ length: Math.min(5, uploadHistory.pagination.total_pages) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <button
                            key={page}
                            onClick={() => updatePage(page)}
                            className={`px-3 py-1 border rounded-md text-sm ${
                              page === currentPage
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={() => updatePage(currentPage + 1)}
                        disabled={currentPage >= uploadHistory.pagination.total_pages}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Upload</h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete "{selectedUpload.original_filename}"? This action cannot be undone.
              </p>
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedUpload(null);
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteUploadMutation.mutate(selectedUpload.id)}
                  disabled={deleteUploadMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteUploadMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_Uploads;