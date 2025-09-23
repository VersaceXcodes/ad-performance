import React, { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// ========================
// INTERFACES & TYPES
// ========================

interface CreativePerformance {
  id: string;
  workspace_id: string;
  creative_name: string;
  creative_thumb_url: string | null;
  creative_tags: string | null;
  ad_format: string | null;
  platforms: string[];
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  total_revenue: number;
  avg_ctr: number | null;
  avg_cpm: number | null;
  avg_cpc: number | null;
  avg_cpa: number | null;
  avg_cvr: number | null;
  avg_roas: number | null;
  campaign_count: number;
  performance_rank: string | null;
  first_seen_date: string;
  last_seen_date: string;
  created_at: string;
  updated_at: string;
}

interface CreativePerformanceResponse {
  data: CreativePerformance[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

type PerformanceFilter = 'winners' | 'losers' | 'all';
type SortBy = 'creative_name' | 'total_spend' | 'avg_roas' | 'campaign_count' | 'last_seen_date';

// ========================
// API FUNCTIONS
// ========================

const fetchCreativePerformance = async (
  workspaceId: string,
  params: {
    performance_filter?: PerformanceFilter;
    sort_by?: SortBy;
    sort_order?: 'asc' | 'desc';
    platforms?: string;
    creative_tags?: string;
    date_from?: string;
    date_to?: string;
    query?: string;
    min_spend?: number;
    max_spend?: number;
    limit?: number;
    offset?: number;
  },
  token: string
): Promise<CreativePerformanceResponse> => {
  const queryParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, value.toString());
    }
  });

  const response = await axios.get(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/workspaces/${workspaceId}/creatives?${queryParams}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
};

// ========================
// UTILITY FUNCTIONS
// ========================

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercentage = (value: number | null): string => {
  if (value === null) return 'N/A';
  return `${value.toFixed(2)}%`;
};

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(value);
};

const getPerformanceColor = (roas: number | null): string => {
  if (roas === null) return 'text-gray-500';
  if (roas >= 3.0) return 'text-green-600';
  if (roas >= 2.0) return 'text-yellow-600';
  return 'text-red-600';
};

const getPerformanceRank = (creative: CreativePerformance): 'winner' | 'loser' | 'average' => {
  const roas = creative.avg_roas || 0;
  if (roas >= 3.0) return 'winner';
  if (roas < 1.5) return 'loser';
  return 'average';
};

// ========================
// MAIN COMPONENT
// ========================

const UV_Creatives: React.FC = () => {
  const { workspace_id } = useParams<{ workspace_id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State
  const [selectedCreative, setSelectedCreative] = useState<CreativePerformance | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Zustand store selectors
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const dateRangeFilter = useAppStore(state => state.date_range_filter);
  const platformFilter = useAppStore(state => state.platform_filter);

  // URL Parameters
  const performanceFilter = (searchParams.get('performance_filter') as PerformanceFilter) || 'all';
  const sortBy = (searchParams.get('sort_by') as SortBy) || 'total_spend';
  const sortOrder = (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc';
  const platformsParam = searchParams.get('platforms') || '';
  const tagsParam = searchParams.get('creative_tags') || '';

  // Query parameters for API
  const queryParams = useMemo(() => ({
    performance_filter: performanceFilter,
    sort_by: sortBy,
    sort_order: sortOrder,
    platforms: platformsParam || platformFilter.selected_platforms.join(','),
    creative_tags: tagsParam,
    date_from: searchParams.get('date_from') || dateRangeFilter.date_from || undefined,
    date_to: searchParams.get('date_to') || dateRangeFilter.date_to || undefined,
    query: searchQuery,
    limit: 50,
    offset: 0,
  }), [
    performanceFilter,
    sortBy,
    sortOrder,
    platformsParam,
    tagsParam,
    platformFilter.selected_platforms,
    dateRangeFilter.date_from,
    dateRangeFilter.date_to,
    searchQuery
  ]);

  // React Query
  const {
    data: creativesData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['creatives', workspace_id, queryParams],
    queryFn: () => fetchCreativePerformance(workspace_id!, queryParams, authToken!),
    enabled: !!(workspace_id && authToken),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // Handlers
  const updateUrlParam = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const handlePerformanceFilterChange = (filter: PerformanceFilter) => {
    updateUrlParam('performance_filter', filter === 'all' ? '' : filter);
  };



  const openCreativeModal = (creative: CreativePerformance) => {
    setSelectedCreative(creative);
    setIsModalOpen(true);
  };

  const closeCreativeModal = () => {
    setSelectedCreative(null);
    setIsModalOpen(false);
  };

  // Filter creatives based on performance filter
  const filteredCreatives = useMemo(() => {
    if (!creativesData?.data) return [];
    
    if (performanceFilter === 'all') return creativesData.data;
    
    return creativesData.data.filter(creative => {
      const rank = getPerformanceRank(creative);
      return performanceFilter === 'winners' ? rank === 'winner' : rank === 'loser';
    });
  }, [creativesData?.data, performanceFilter]);

  // Performance stats
  const performanceStats = useMemo(() => {
    if (!creativesData?.data) return { winners: 0, losers: 0, total: 0 };
    
    const winners = creativesData.data.filter(c => getPerformanceRank(c) === 'winner').length;
    const losers = creativesData.data.filter(c => getPerformanceRank(c) === 'loser').length;
    
    return {
      winners,
      losers,
      total: creativesData.data.length
    };
  }, [creativesData?.data]);

  if (!workspace_id) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Workspace not found</h2>
            <p className="mt-2 text-gray-600">Please select a valid workspace.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Creative Performance</h1>
                  <p className="mt-2 text-gray-600">
                    Analyze and optimize your creative assets across all campaigns
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <Link
                    to={`/w/${workspace_id}/campaigns`}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    View Campaigns
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Tabs & Stats */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex space-x-8">
                  <button
                    onClick={() => handlePerformanceFilterChange('all')}
                    className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      performanceFilter === 'all'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    All Creatives ({performanceStats.total})
                  </button>
                  <button
                    onClick={() => handlePerformanceFilterChange('winners')}
                    className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      performanceFilter === 'winners'
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Top Performers ({performanceStats.winners})
                  </button>
                  <button
                    onClick={() => handlePerformanceFilterChange('losers')}
                    className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      performanceFilter === 'losers'
                        ? 'border-red-500 text-red-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Bottom Performers ({performanceStats.losers})
                  </button>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search creatives..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [newSortBy, newSortOrder] = e.target.value.split('-') as [SortBy, 'asc' | 'desc'];
                      updateUrlParam('sort_by', newSortBy);
                      updateUrlParam('sort_order', newSortOrder);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="total_spend-desc">Spend (High to Low)</option>
                    <option value="total_spend-asc">Spend (Low to High)</option>
                    <option value="avg_roas-desc">ROAS (High to Low)</option>
                    <option value="avg_roas-asc">ROAS (Low to High)</option>
                    <option value="campaign_count-desc">Campaigns (Most)</option>
                    <option value="campaign_count-asc">Campaigns (Least)</option>
                    <option value="last_seen_date-desc">Recently Used</option>
                    <option value="creative_name-asc">Name (A-Z)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading creatives...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
              <h3 className="text-lg font-medium text-red-800 mb-2">Error loading creatives</h3>
              <p className="text-red-600 mb-4">
                {error instanceof Error ? error.message : 'Failed to load creative performance data'}
              </p>
              <button
                onClick={() => refetch()}
                className="inline-flex items-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : filteredCreatives.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No creatives found</h3>
              <p className="text-gray-500 mb-6">
                {performanceFilter === 'all' 
                  ? 'Upload some campaign data to start analyzing creative performance.'
                  : `No ${performanceFilter} found with the current filters.`
                }
              </p>
              {performanceFilter === 'all' && (
                <Link
                  to={`/w/${workspace_id}/upload`}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  Upload Campaign Data
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredCreatives.map((creative) => {
                const performanceRank = getPerformanceRank(creative);
                const performanceColor = getPerformanceColor(creative.avg_roas);
                
                return (
                  <div
                    key={creative.id}
                    onClick={() => openCreativeModal(creative)}
                    className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-200 cursor-pointer group"
                  >
                    {/* Creative Thumbnail */}
                    <div className="relative h-48 bg-gray-100">
                      {creative.creative_thumb_url ? (
                        <img
                          src={creative.creative_thumb_url}
                          alt={creative.creative_name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      
                      {/* Performance Badge */}
                      <div className="absolute top-3 right-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          performanceRank === 'winner' 
                            ? 'bg-green-100 text-green-800'
                            : performanceRank === 'loser'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {performanceRank === 'winner' ? 'Winner' : performanceRank === 'loser' ? 'Loser' : 'Average'}
                        </span>
                      </div>

                      {/* Format Badge */}
                      {creative.ad_format && (
                        <div className="absolute top-3 left-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {creative.ad_format.replace('_', ' ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Creative Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-2 truncate" title={creative.creative_name}>
                        {creative.creative_name}
                      </h3>

                      {/* Platforms */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {creative.platforms.map((platform) => (
                          <span
                            key={platform}
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700"
                          >
                            {platform.charAt(0).toUpperCase() + platform.slice(1)}
                          </span>
                        ))}
                      </div>

                      {/* Key Metrics */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Spend</span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(creative.total_spend)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">ROAS</span>
                          <span className={`text-sm font-medium ${performanceColor}`}>
                            {creative.avg_roas ? `${creative.avg_roas.toFixed(2)}x` : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">CTR</span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatPercentage(creative.avg_ctr)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Campaigns</span>
                          <span className="text-sm font-medium text-gray-900">
                            {creative.campaign_count}
                          </span>
                        </div>
                      </div>

                      {/* Tags */}
                      {creative.creative_tags && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex flex-wrap gap-1">
                            {creative.creative_tags.split(',').slice(0, 2).map((tag, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700"
                              >
                                {tag.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Creative Detail Modal */}
        {isModalOpen && selectedCreative && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Creative Details</h2>
                <button
                  onClick={closeCreativeModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Creative Preview */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Creative Preview</h3>
                    <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center mb-4">
                      {selectedCreative.creative_thumb_url ? (
                        <img
                          src={selectedCreative.creative_thumb_url}
                          alt={selectedCreative.creative_name}
                          className="max-h-full max-w-full object-contain rounded-lg"
                        />
                      ) : (
                        <div className="text-center">
                          <svg className="h-16 w-16 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-gray-500">No preview available</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Name:</span>
                        <p className="text-gray-900">{selectedCreative.creative_name}</p>
                      </div>
                      {selectedCreative.ad_format && (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Format:</span>
                          <p className="text-gray-900">{selectedCreative.ad_format.replace('_', ' ')}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-sm font-medium text-gray-700">Platforms:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedCreative.platforms.map((platform) => (
                            <span
                              key={platform}
                              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700"
                            >
                              {platform.charAt(0).toUpperCase() + platform.slice(1)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-500">Total Spend</p>
                        <p className="text-xl font-semibold text-gray-900">
                          {formatCurrency(selectedCreative.total_spend)}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-500">Revenue</p>
                        <p className="text-xl font-semibold text-gray-900">
                          {formatCurrency(selectedCreative.total_revenue)}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-500">ROAS</p>
                        <p className={`text-xl font-semibold ${getPerformanceColor(selectedCreative.avg_roas)}`}>
                          {selectedCreative.avg_roas ? `${selectedCreative.avg_roas.toFixed(2)}x` : 'N/A'}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-500">CPA</p>
                        <p className="text-xl font-semibold text-gray-900">
                          {selectedCreative.avg_cpa ? formatCurrency(selectedCreative.avg_cpa) : 'N/A'}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-500">CTR</p>
                        <p className="text-xl font-semibold text-gray-900">
                          {formatPercentage(selectedCreative.avg_ctr)}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-500">Campaigns</p>
                        <p className="text-xl font-semibold text-gray-900">
                          {selectedCreative.campaign_count}
                        </p>
                      </div>
                    </div>

                    {/* Additional Metrics */}
                    <div className="mt-6 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Impressions:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatNumber(selectedCreative.total_impressions)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Clicks:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatNumber(selectedCreative.total_clicks)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Conversions:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatNumber(selectedCreative.total_conversions)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">CVR:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatPercentage(selectedCreative.avg_cvr)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Campaign Usage */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Campaign Usage</h3>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-blue-800">
                      This creative is being used in <strong>{selectedCreative.campaign_count}</strong> campaigns
                      from <strong>{new Date(selectedCreative.first_seen_date).toLocaleDateString()}</strong> to <strong>{new Date(selectedCreative.last_seen_date).toLocaleDateString()}</strong>
                    </p>
                    <Link
                      to={`/w/${workspace_id}/campaigns?creative_filter=${selectedCreative.id}`}
                      className="inline-flex items-center mt-3 text-sm font-medium text-blue-600 hover:text-blue-500"
                    >
                      View campaigns using this creative
                      <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>

                {/* Tags */}
                {selectedCreative.creative_tags && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedCreative.creative_tags.split(',').map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                        >
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200">
                <button
                  onClick={closeCreativeModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <Link
                  to={`/w/${workspace_id}/campaigns?creative_filter=${selectedCreative.id}`}
                  className="px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  View Campaigns
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_Creatives;