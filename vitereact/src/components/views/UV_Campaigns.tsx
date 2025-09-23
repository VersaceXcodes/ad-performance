import React, { useState, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  ChevronDown, 
  ChevronRight, 
  MoreHorizontal,
  Play,
  Pause,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus
} from 'lucide-react';

// Types based on Zod schemas
interface Campaign {
  id: string;
  account_id: string;
  campaign_id: string;
  campaign_name: string | null;
  status: 'active' | 'paused' | 'archived';
  objective: string | null;
  buying_type: string | null;
  created_at: string;
  updated_at: string;
}

interface AdSet {
  id: string;
  campaign_id: string;
  adset_id: string;
  adset_name: string | null;
  status: 'active' | 'paused' | 'archived';
  bid_strategy: string | null;
  optimization_goal: string | null;
  created_at: string;
  updated_at: string;
}

interface Ad {
  id: string;
  adset_id: string;
  ad_id: string;
  ad_name: string | null;
  creative_name: string | null;
  creative_thumb_url: string | null;
  creative_tags: string | null;
  status: 'active' | 'paused' | 'archived';
  ad_format: string | null;
  created_at: string;
  updated_at: string;
}

interface MetricsData {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpm: number;
  cpc: number;
  cpa: number;
  cvr: number;
  roas: number;
}

interface CampaignWithMetrics extends Campaign {
  metrics: MetricsData;
  adsets?: AdSetWithMetrics[];
}

interface AdSetWithMetrics extends AdSet {
  metrics: MetricsData;
  ads?: AdWithMetrics[];
}

interface AdWithMetrics extends Ad {
  metrics: MetricsData;
}

interface CampaignsResponse {
  data: CampaignWithMetrics[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

const UV_Campaigns: React.FC = () => {
  const { workspace_id, campaign_id } = useParams<{ workspace_id: string; campaign_id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Global state selectors - individual selectors to prevent infinite loops
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const platformFilter = useAppStore(state => state.platform_filter);
  const addToastNotification = useAppStore(state => state.add_toast_notification);

  // Local state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search_query') || '');
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // URL param state
  const currentPage = parseInt(searchParams.get('page') || '1');
  const perPage = parseInt(searchParams.get('per_page') || '50');
  const sortBy = searchParams.get('sort_by') || 'spend';
  const sortOrder = searchParams.get('sort_order') || 'desc';
  const statusFilter = searchParams.get('status_filter') || '';
  const platformsParam = searchParams.get('platforms') || '';
  const accountsParam = searchParams.get('accounts') || '';

  const selectedPlatforms = platformsParam ? platformsParam.split(',') : platformFilter.selected_platforms;
  const selectedAccounts = accountsParam ? accountsParam.split(',') : platformFilter.selected_accounts;

  // API functions
  const fetchCampaigns = async (): Promise<CampaignsResponse> => {
    if (!workspace_id || !authToken) throw new Error('Missing workspace or auth token');

    const params = new URLSearchParams({
      page: currentPage.toString(),
      per_page: perPage.toString(),
      sort_by: sortBy,
      sort_order: sortOrder,
    });

    if (searchQuery) params.append('search_query', searchQuery);
    if (statusFilter) params.append('status_filter', statusFilter);
    if (selectedPlatforms.length > 0) params.append('platforms', selectedPlatforms.join(','));
    if (selectedAccounts.length > 0) params.append('accounts', selectedAccounts.join(','));

    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/workspaces/${workspace_id}/campaigns?${params}`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    return response.data;
  };

  const fetchCampaignDetails = async (campaignId: string) => {
    if (!workspace_id || !authToken) throw new Error('Missing workspace or auth token');

    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/workspaces/${workspace_id}/campaigns/${campaignId}`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    return response.data;
  };



  // React Query hooks
  const campaignsQuery = useQuery({
    queryKey: ['campaigns', workspace_id, currentPage, perPage, sortBy, sortOrder, searchQuery, statusFilter, selectedPlatforms, selectedAccounts],
    queryFn: fetchCampaigns,
    enabled: !!workspace_id && !!authToken && !campaign_id,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const campaignDetailsQuery = useQuery({
    queryKey: ['campaign-details', workspace_id, campaign_id],
    queryFn: () => fetchCampaignDetails(campaign_id!),
    enabled: !!workspace_id && !!authToken && !!campaign_id,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Update search params when filters change
  const updateSearchParams = useCallback((updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });

    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    updateSearchParams({ search_query: query, page: '1' });
  }, [updateSearchParams]);

  // Handle sort
  const handleSort = useCallback((column: string) => {
    const newOrder = sortBy === column && sortOrder === 'desc' ? 'asc' : 'desc';
    updateSearchParams({ sort_by: column, sort_order: newOrder, page: '1' });
  }, [sortBy, sortOrder, updateSearchParams]);

  // Handle pagination
  const handlePageChange = useCallback((page: number) => {
    updateSearchParams({ page: page.toString() });
  }, [updateSearchParams]);

  // Handle campaign expansion
  const toggleCampaignExpansion = useCallback((campaignId: string) => {
    setExpandedCampaigns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(campaignId)) {
        newSet.delete(campaignId);
      } else {
        newSet.add(campaignId);
      }
      return newSet;
    });
  }, []);



  // Handle item selection
  const toggleItemSelection = useCallback((itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (!campaignsQuery.data) return;
    
    const allIds = campaignsQuery.data.data.map(campaign => campaign.id);
    const allSelected = allIds.every(id => selectedItems.has(id));
    
    if (allSelected) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(allIds));
    }
  }, [campaignsQuery.data, selectedItems]);

  // Bulk actions
  const bulkUpdateStatus = useMutation({
    mutationFn: async ({ campaignIds, status }: { campaignIds: string[], status: string }) => {
      const promises = campaignIds.map(id =>
        axios.put(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/workspaces/${workspace_id}/campaigns/${id}`,
          { status },
          { headers: { Authorization: `Bearer ${authToken}` } }
        )
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspace_id] });
      addToastNotification({
        type: 'success',
        message: 'Campaigns updated successfully',
        auto_dismiss: true,
      });
      setSelectedItems(new Set());
    },
    onError: () => {
      addToastNotification({
        type: 'error',
        message: 'Failed to update campaigns',
        auto_dismiss: true,
      });
    },
  });

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get trend indicator
  const getTrendIndicator = (value: number, previousValue: number) => {
    if (value > previousValue) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    } else if (value < previousValue) {
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    }
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  // Campaign row component
  const CampaignRow: React.FC<{ campaign: CampaignWithMetrics; level: number }> = ({ campaign, level }) => {
    const isExpanded = expandedCampaigns.has(campaign.id);
    const isSelected = selectedItems.has(campaign.id);

    return (
      <>
        <tr className={`border-b border-gray-200 hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
          <td className="px-6 py-4 whitespace-nowrap text-sm">
            <div className="flex items-center" style={{ paddingLeft: `${level * 20}px` }}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleItemSelection(campaign.id)}
                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <button
                onClick={() => toggleCampaignExpansion(campaign.id)}
                className="ml-2 p-1 text-gray-400 hover:text-gray-600"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              <div className="ml-2">
                <div className="font-medium text-gray-900">
                  {campaign.campaign_name || `Campaign ${campaign.campaign_id}`}
                </div>
                <div className="text-gray-500 text-xs">ID: {campaign.campaign_id}</div>
              </div>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
              {campaign.status}
            </span>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            {formatCurrency(campaign.metrics.spend)}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            {campaign.metrics.impressions.toLocaleString()}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            {campaign.metrics.clicks.toLocaleString()}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            {campaign.metrics.conversions.toLocaleString()}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            {formatCurrency(campaign.metrics.revenue)}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            <div className="flex items-center">
              {formatPercentage(campaign.metrics.ctr)}
              {getTrendIndicator(campaign.metrics.ctr, 2.5)}
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            {formatCurrency(campaign.metrics.cpm)}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            {campaign.metrics.roas.toFixed(2)}x
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button className="text-gray-400 hover:text-gray-600">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </td>
        </tr>
      </>
    );
  };

  // If showing detailed campaign view
  if (campaign_id) {
    return (
      <>
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <div className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center">
                  <nav className="flex" aria-label="Breadcrumb">
                    <ol className="flex items-center space-x-4">
                      <li>
                        <Link to={`/w/${workspace_id}`} className="text-gray-400 hover:text-gray-500">
                          Overview
                        </Link>
                      </li>
                      <li>
                        <div className="flex items-center">
                          <ChevronRight className="flex-shrink-0 h-5 w-5 text-gray-400" />
                          <Link to={`/w/${workspace_id}/campaigns`} className="ml-4 text-gray-400 hover:text-gray-500">
                            Campaigns
                          </Link>
                        </div>
                      </li>
                      <li>
                        <div className="flex items-center">
                          <ChevronRight className="flex-shrink-0 h-5 w-5 text-gray-400" />
                          <span className="ml-4 text-gray-900 font-medium">
                            {campaignDetailsQuery.data?.campaign?.campaign_name || 'Campaign Details'}
                          </span>
                        </div>
                      </li>
                    </ol>
                  </nav>
                </div>
              </div>
            </div>
          </div>

          {/* Campaign Details Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {campaignDetailsQuery.isLoading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-64 bg-gray-200 rounded"></div>
              </div>
            ) : campaignDetailsQuery.error ? (
              <div className="text-center py-12">
                <div className="text-red-600 mb-4">Failed to load campaign details</div>
                <button
                  onClick={() => campaignDetailsQuery.refetch()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="bg-white shadow rounded-lg p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">
                  {campaignDetailsQuery.data?.campaign?.campaign_name || 'Campaign Details'}
                </h1>
                <p className="text-gray-600">Campaign details view would be implemented here with ad sets and ads hierarchy.</p>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // Main campaigns list view
  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
                <span className="ml-3 text-sm text-gray-500">
                  {campaignsQuery.data?.pagination.total || 0} campaigns
                </span>
              </div>
              <div className="flex items-center space-x-4">
                {selectedItems.size > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-700">{selectedItems.size} selected</span>
                    <button
                      onClick={() => bulkUpdateStatus.mutate({ campaignIds: Array.from(selectedItems), status: 'active' })}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Activate
                    </button>
                    <button
                      onClick={() => bulkUpdateStatus.mutate({ campaignIds: Array.from(selectedItems), status: 'paused' })}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Pause className="w-4 h-4 mr-1" />
                      Pause
                    </button>
                    <button className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                      <Download className="w-4 h-4 mr-1" />
                      Export
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1">
                {/* Search */}
                <div className="relative flex-1 max-w-lg">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search campaigns, IDs, creative names..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Filter Toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                  {(statusFilter || selectedPlatforms.length > 0 || selectedAccounts.length > 0) && (
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {[statusFilter, ...selectedPlatforms, ...selectedAccounts].filter(Boolean).length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Status Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => updateSearchParams({ status_filter: e.target.value, page: '1' })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>

                  {/* Platform Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Platforms</label>
                    <div className="space-y-2">
                      {['facebook', 'tiktok', 'snapchat', 'google'].map(platform => (
                        <label key={platform} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedPlatforms.includes(platform)}
                            onChange={(e) => {
                              const newPlatforms = e.target.checked
                                ? [...selectedPlatforms, platform]
                                : selectedPlatforms.filter(p => p !== platform);
                              updateSearchParams({ platforms: newPlatforms.join(','), page: '1' });
                            }}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700 capitalize">{platform}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Performance Threshold */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Performance</label>
                    <div className="space-y-2">
                      <input
                        type="number"
                        placeholder="Min ROAS"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      <input
                        type="number"
                        placeholder="Min Spend"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setSearchParams(new URLSearchParams());
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {campaignsQuery.isLoading ? (
            <div className="bg-white shadow rounded-lg">
              <div className="animate-pulse p-6">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="space-y-3">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          ) : campaignsQuery.error ? (
            <div className="bg-white shadow rounded-lg p-6 text-center">
              <div className="text-red-600 mb-4">Failed to load campaigns</div>
              <button
                onClick={() => campaignsQuery.refetch()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          ) : !campaignsQuery.data?.data.length ? (
            <div className="bg-white shadow rounded-lg p-12 text-center">
              <div className="text-gray-500 mb-4">No campaigns found</div>
              <Link
                to={`/w/${workspace_id}/upload`}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Upload Campaign Data
              </Link>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={campaignsQuery.data?.data.length > 0 && campaignsQuery.data.data.every(campaign => selectedItems.has(campaign.id))}
                          onChange={handleSelectAll}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2">Campaign</span>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('spend')}>
                        <div className="flex items-center">
                          Spend
                          <ArrowUpDown className="ml-1 w-3 h-3" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('impressions')}>
                        <div className="flex items-center">
                          Impressions
                          <ArrowUpDown className="ml-1 w-3 h-3" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('clicks')}>
                        <div className="flex items-center">
                          Clicks
                          <ArrowUpDown className="ml-1 w-3 h-3" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('conversions')}>
                        <div className="flex items-center">
                          Conversions
                          <ArrowUpDown className="ml-1 w-3 h-3" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('revenue')}>
                        <div className="flex items-center">
                          Revenue
                          <ArrowUpDown className="ml-1 w-3 h-3" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('ctr')}>
                        <div className="flex items-center">
                          CTR
                          <ArrowUpDown className="ml-1 w-3 h-3" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('cpm')}>
                        <div className="flex items-center">
                          CPM
                          <ArrowUpDown className="ml-1 w-3 h-3" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => handleSort('roas')}>
                        <div className="flex items-center">
                          ROAS
                          <ArrowUpDown className="ml-1 w-3 h-3" />
                        </div>
                      </th>
                      <th className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {campaignsQuery.data?.data.map((campaign) => (
                      <CampaignRow key={campaign.id} campaign={campaign} level={0} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {campaignsQuery.data && campaignsQuery.data.pagination.total_pages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === campaignsQuery.data.pagination.total_pages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing{' '}
                        <span className="font-medium">{(currentPage - 1) * perPage + 1}</span>
                        {' '}to{' '}
                        <span className="font-medium">
                          {Math.min(currentPage * perPage, campaignsQuery.data.pagination.total)}
                        </span>
                        {' '}of{' '}
                        <span className="font-medium">{campaignsQuery.data.pagination.total}</span>
                        {' '}results
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        
                        {/* Page numbers */}
                        {[...Array(Math.min(5, campaignsQuery.data.pagination.total_pages))].map((_, index) => {
                          const pageNum = currentPage - 2 + index;
                          if (pageNum < 1 || pageNum > campaignsQuery.data.pagination.total_pages) return null;
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                pageNum === currentPage
                                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === campaignsQuery.data.pagination.total_pages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_Campaigns;