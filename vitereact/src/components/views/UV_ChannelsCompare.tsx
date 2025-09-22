import React, { useState, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import { 
  ArrowUpIcon, 
  ArrowDownIcon, 
  ChevronUpIcon, 
  ChevronDownIcon,
  ArrowsUpDownIcon,
  ChartBarIcon,
  DocumentArrowDownIcon,
  CameraIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

// Types based on OpenAPI schema
interface PlatformComparison {
  platform: string;
  spend: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpm: number;
  cvr: number;
  impressions: number;
  clicks: number;
  conversions: number;
  account_count: number;
  campaign_count: number;
}

interface AccountBreakdown {
  account_id: string;
  account_name: string;
  spend: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpm: number;
  cvr: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

type SortableMetric = 'spend' | 'revenue' | 'roas' | 'cpa' | 'ctr' | 'cpm' | 'cvr' | 'impressions' | 'clicks' | 'conversions';

const UV_ChannelsCompare: React.FC = () => {
  const { workspace_id } = useParams<{ workspace_id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Global state - individual selectors to prevent infinite loops
  const currentWorkspace = useAppStore(state => state.current_workspace);
  const dateRangeFilter = useAppStore(state => state.date_range_filter);
  const platformFilter = useAppStore(state => state.platform_filter);
  
  // Local state
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set());
  const [efficiencyView, setEfficiencyView] = useState(searchParams.get('efficiency_view') === 'true');
  const [sortBy, setSortBy] = useState<SortableMetric>((searchParams.get('sort_by') as SortableMetric) || 'spend');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>((searchParams.get('sort_order') as 'asc' | 'desc') || 'desc');

  // Platform configuration
  const platformConfig = {
    facebook: { name: 'Meta', color: 'bg-blue-600', logo: '📘' },
    tiktok: { name: 'TikTok', color: 'bg-black', logo: '🎵' },
    snapchat: { name: 'Snapchat', color: 'bg-yellow-400', logo: '👻' },
    google: { name: 'Google', color: 'bg-red-500', logo: '🔍' },
    linkedin: { name: 'LinkedIn', color: 'bg-blue-700', logo: '💼' },
    twitter: { name: 'X (Twitter)', color: 'bg-gray-900', logo: '🐦' }
  };

  // API query for platform comparison data
  const { data: comparisonData, isLoading, error, refetch } = useQuery({
    queryKey: [
      'platform-comparison', 
      workspace_id, 
      dateRangeFilter.date_from, 
      dateRangeFilter.date_to,
      platformFilter.selected_platforms.join(','),
      sortBy,
      sortOrder,
      efficiencyView
    ],
    queryFn: async (): Promise<PlatformComparison[]> => {
      if (!workspace_id) throw new Error('Workspace ID required');
      
      const params = new URLSearchParams();
      if (dateRangeFilter.date_from) params.append('date_from', dateRangeFilter.date_from);
      if (dateRangeFilter.date_to) params.append('date_to', dateRangeFilter.date_to);
      if (platformFilter.selected_platforms.length > 0) {
        params.append('platforms', platformFilter.selected_platforms.join(','));
      }
      params.append('sort_by', sortBy);
      params.append('sort_order', sortOrder);
      if (efficiencyView) params.append('efficiency_view', 'true');

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/workspaces/${workspace_id}/metrics/comparison?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${useAppStore.getState().authentication_state.auth_token}`
          }
        }
      );
      
      return response.data;
    },
    enabled: !!workspace_id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Mock account breakdown data (would come from separate API call)
  const getAccountBreakdown = (platform: string): AccountBreakdown[] => {
    return [
      {
        account_id: `${platform}_acc_1`,
        account_name: `${platformConfig[platform as keyof typeof platformConfig]?.name} Account 1`,
        spend: 5000,
        revenue: 15000,
        roas: 3.0,
        cpa: 25.0,
        ctr: 2.5,
        cpm: 15.0,
        cvr: 1.8,
        impressions: 333333,
        clicks: 8333,
        conversions: 150
      },
      {
        account_id: `${platform}_acc_2`,
        account_name: `${platformConfig[platform as keyof typeof platformConfig]?.name} Account 2`,
        spend: 3000,
        revenue: 9000,
        roas: 3.0,
        cpa: 20.0,
        ctr: 3.0,
        cpm: 12.0,
        cvr: 2.0,
        impressions: 250000,
        clicks: 7500,
        conversions: 150
      }
    ];
  };

  // Performance analysis
  const performanceAnalysis = useMemo(() => {
    if (!comparisonData?.length) return null;
    
    const sortedByRoas = [...comparisonData].sort((a, b) => b.roas - a.roas);
    const sortedBySpend = [...comparisonData].sort((a, b) => b.spend - a.spend);
    
    return {
      topPerformer: sortedByRoas[0],
      bottomPerformer: sortedByRoas[sortedByRoas.length - 1],
      highestSpend: sortedBySpend[0],
      totalSpend: comparisonData.reduce((sum, p) => sum + p.spend, 0),
      avgRoas: comparisonData.reduce((sum, p) => sum + p.roas, 0) / comparisonData.length
    };
  }, [comparisonData]);

  // Handle sorting
  const handleSort = (metric: SortableMetric) => {
    const newSortOrder = sortBy === metric && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(metric);
    setSortOrder(newSortOrder);
    
    // Update URL params
    const newParams = new URLSearchParams(searchParams);
    newParams.set('sort_by', metric);
    newParams.set('sort_order', newSortOrder);
    setSearchParams(newParams);
  };

  // Handle efficiency view toggle
  const handleEfficiencyToggle = () => {
    const newEfficiencyView = !efficiencyView;
    setEfficiencyView(newEfficiencyView);
    
    const newParams = new URLSearchParams(searchParams);
    if (newEfficiencyView) {
      newParams.set('efficiency_view', 'true');
    } else {
      newParams.delete('efficiency_view');
    }
    setSearchParams(newParams);
  };

  // Toggle platform expansion
  const togglePlatformExpansion = (platform: string) => {
    const newExpanded = new Set(expandedPlatforms);
    if (newExpanded.has(platform)) {
      newExpanded.delete(platform);
    } else {
      newExpanded.add(platform);
    }
    setExpandedPlatforms(newExpanded);
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Format number
  const formatNumber = (num: number, decimals: number = 2): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num);
  };

  // Format percentage
  const formatPercentage = (num: number): string => {
    return `${formatNumber(num, 2)}%`;
  };

  // Get performance badge
  const getPerformanceBadge = (platform: string, roas: number) => {
    if (!performanceAnalysis) return null;
    
    if (platform === performanceAnalysis.topPerformer.platform) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <TrophyIcon className="w-3 h-3 mr-1" />
          Top Performer
        </span>
      );
    }
    
    if (platform === performanceAnalysis.bottomPerformer.platform) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
          Needs Attention
        </span>
      );
    }
    
    return null;
  };

  // Export functionality
  const handleExportCSV = () => {
    if (!comparisonData) return;
    
    const headers = ['Platform', 'Spend', 'Revenue', 'ROAS', 'CPA', 'CTR', 'CPM', 'CVR', 'Impressions', 'Clicks', 'Conversions'];
    const csvContent = [
      headers.join(','),
      ...comparisonData.map(platform => [
        platformConfig[platform.platform as keyof typeof platformConfig]?.name || platform.platform,
        platform.spend,
        platform.revenue,
        platform.roas,
        platform.cpa,
        platform.ctr,
        platform.cpm,
        platform.cvr,
        platform.impressions,
        platform.clicks,
        platform.conversions
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `platform-comparison-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="h-64 bg-gray-200 rounded mb-6"></div>
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-900 mb-2">Failed to Load Platform Comparison</h3>
              <p className="text-red-700 mb-4">
                {error instanceof Error ? error.message : 'An unexpected error occurred'}
              </p>
              <button
                onClick={() => refetch()}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Channel Performance Comparison</h1>
                <p className="text-gray-600 mt-2">
                  Compare performance across advertising platforms to optimize budget allocation
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
                  Export CSV
                </button>
                
                <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <CameraIcon className="w-5 h-5 mr-2" />
                  Export Chart
                </button>
              </div>
            </div>
          </div>

          {/* Performance Insights */}
          {performanceAnalysis && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Top Performer</p>
                    <p className="text-2xl font-bold text-green-600">
                      {platformConfig[performanceAnalysis.topPerformer.platform as keyof typeof platformConfig]?.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {formatNumber(performanceAnalysis.topPerformer.roas, 2)}x ROAS
                    </p>
                  </div>
                  <div className="text-4xl">
                    {platformConfig[performanceAnalysis.topPerformer.platform as keyof typeof platformConfig]?.logo}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Spend</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(performanceAnalysis.totalSpend)}
                    </p>
                    <p className="text-sm text-gray-600">
                      Across {comparisonData?.length || 0} platforms
                    </p>
                  </div>
                  <ChartBarIcon className="w-8 h-8 text-blue-600" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Average ROAS</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatNumber(performanceAnalysis.avgRoas, 2)}x
                    </p>
                    <p className="text-sm text-gray-600">
                      Portfolio performance
                    </p>
                  </div>
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-bold">Ø</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={efficiencyView}
                    onChange={handleEfficiencyToggle}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">
                    Efficiency View (per 1K impressions)
                  </span>
                </label>
                
                <div className="flex items-center text-sm text-gray-500">
                  <InformationCircleIcon className="w-4 h-4 mr-1" />
                  Normalize metrics for fair comparison across spending levels
                </div>
              </div>
              
              <div className="text-sm text-gray-500">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Platform
                    </th>
                    {(['spend', 'revenue', 'roas', 'cpa', 'ctr', 'cpm', 'cvr'] as SortableMetric[]).map(metric => (
                      <th
                        key={metric}
                        className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort(metric)}
                      >
                        <div className="flex items-center space-x-1">
                          <span>{metric.toUpperCase()}</span>
                          {sortBy === metric ? (
                            sortOrder === 'desc' ? (
                              <ArrowDownIcon className="w-4 h-4" />
                            ) : (
                              <ArrowUpIcon className="w-4 h-4" />
                            )
                          ) : (
                            <ArrowsUpDownIcon className="w-4 h-4 opacity-50" />
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Performance
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {comparisonData?.map((platform) => (
                    <React.Fragment key={platform.platform}>
                      {/* Main platform row */}
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <button
                              onClick={() => togglePlatformExpansion(platform.platform)}
                              className="mr-3 p-1 hover:bg-gray-200 rounded transition-colors"
                            >
                              {expandedPlatforms.has(platform.platform) ? (
                                <ChevronUpIcon className="w-4 h-4 text-gray-500" />
                              ) : (
                                <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                              )}
                            </button>
                            
                            <div className="flex items-center">
                              <div className={`w-10 h-10 rounded-lg ${platformConfig[platform.platform as keyof typeof platformConfig]?.color || 'bg-gray-500'} flex items-center justify-center text-white text-xl mr-3`}>
                                {platformConfig[platform.platform as keyof typeof platformConfig]?.logo || '📊'}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {platformConfig[platform.platform as keyof typeof platformConfig]?.name || platform.platform}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {platform.account_count} accounts • {platform.campaign_count} campaigns
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {efficiencyView 
                            ? formatCurrency((platform.spend / platform.impressions) * 1000)
                            : formatCurrency(platform.spend)
                          }
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {efficiencyView 
                            ? formatCurrency((platform.revenue / platform.impressions) * 1000)
                            : formatCurrency(platform.revenue)
                          }
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <span className={platform.roas >= 2 ? 'text-green-600' : platform.roas >= 1.5 ? 'text-yellow-600' : 'text-red-600'}>
                            {formatNumber(platform.roas, 2)}x
                          </span>
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {efficiencyView 
                            ? formatCurrency((platform.cpa / platform.impressions) * 1000)
                            : formatCurrency(platform.cpa)
                          }
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatPercentage(platform.ctr)}
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(platform.cpm)}
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatPercentage(platform.cvr)}
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getPerformanceBadge(platform.platform, platform.roas)}
                        </td>
                      </tr>

                      {/* Expanded account breakdown */}
                      {expandedPlatforms.has(platform.platform) && (
                        <>
                          {getAccountBreakdown(platform.platform).map((account) => (
                            <tr key={account.account_id} className="bg-gray-50">
                              <td className="px-6 py-3 whitespace-nowrap">
                                <div className="ml-12 flex items-center">
                                  <div className="w-2 h-2 bg-gray-400 rounded-full mr-3"></div>
                                  <div className="text-sm text-gray-700">
                                    {account.account_name}
                                  </div>
                                </div>
                              </td>
                              
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                {formatCurrency(account.spend)}
                              </td>
                              
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                {formatCurrency(account.revenue)}
                              </td>
                              
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                {formatNumber(account.roas, 2)}x
                              </td>
                              
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                {formatCurrency(account.cpa)}
                              </td>
                              
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                {formatPercentage(account.ctr)}
                              </td>
                              
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                {formatCurrency(account.cpm)}
                              </td>
                              
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                {formatPercentage(account.cvr)}
                              </td>
                              
                              <td className="px-6 py-3 whitespace-nowrap">
                                <Link
                                  to={`/w/${workspace_id}/campaigns?accounts=${account.account_id}`}
                                  className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                >
                                  View Campaigns →
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Budget Allocation Insights */}
          {performanceAnalysis && (
            <div className="mt-8 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Allocation Insights</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Recommendations</h4>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div className="text-sm text-gray-700">
                        <strong>Increase budget</strong> for {platformConfig[performanceAnalysis.topPerformer.platform as keyof typeof platformConfig]?.name} 
                        (ROAS: {formatNumber(performanceAnalysis.topPerformer.roas, 2)}x)
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div className="text-sm text-gray-700">
                        <strong>Review and optimize</strong> {platformConfig[performanceAnalysis.bottomPerformer.platform as keyof typeof platformConfig]?.name} 
                        campaigns (ROAS: {formatNumber(performanceAnalysis.bottomPerformer.roas, 2)}x)
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div className="text-sm text-gray-700">
                        <strong>Maintain current allocation</strong> for platforms performing above {formatNumber(performanceAnalysis.avgRoas, 2)}x ROAS
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Quick Actions</h4>
                  <div className="space-y-2">
                    <Link
                      to={`/w/${workspace_id}/campaigns?platforms=${performanceAnalysis.topPerformer.platform}`}
                      className="block w-full text-left px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm"
                    >
                      Analyze {platformConfig[performanceAnalysis.topPerformer.platform as keyof typeof platformConfig]?.name} top campaigns
                    </Link>
                    
                    <Link
                      to={`/w/${workspace_id}/campaigns?platforms=${performanceAnalysis.bottomPerformer.platform}`}
                      className="block w-full text-left px-4 py-2 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors text-sm"
                    >
                      Troubleshoot {platformConfig[performanceAnalysis.bottomPerformer.platform as keyof typeof platformConfig]?.name} performance
                    </Link>
                    
                    <Link
                      to={`/w/${workspace_id}/alerts`}
                      className="block w-full text-left px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                    >
                      Set up performance alerts
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!comparisonData?.length && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center border border-gray-100">
              <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Platform Data Available</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Upload advertising data from multiple platforms to see performance comparisons and insights.
              </p>
              <Link
                to={`/w/${workspace_id}/upload`}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Upload Data
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_ChannelsCompare;