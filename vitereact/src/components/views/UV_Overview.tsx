import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import {
  CalendarIcon,
  ArrowDownIcon,
  PlusIcon,
  ShareIcon,
  DocumentArrowDownIcon,
  BellIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ArrowUpIcon
} from '@heroicons/react/24/outline';

// Types matching the OpenAPI schema
interface OverviewMetrics {
  spend: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpm: number;
  cvr: number;
  mer: number;
  comparison: {
    spend_change: number;
    revenue_change: number;
    roas_change: number;
    cpa_change: number;
    ctr_change: number;
    cpm_change: number;
    cvr_change: number;
    mer_change: number;
  };
  insights: Array<{
    type: string;
    message: string;
    severity: string;
    entity_type: string;
    entity_id: string;
  }>;
}

interface TimeSeriesData {
  date: string;
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
  platform?: string;
}

interface AnomalyDetection {
  id: string;
  metric: string;
  platform: string;
  current_value: number;
  expected_value: number;
  deviation_percentage: number;
  severity: string;
  anomaly_type: string;
  date: string;
}

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

const UV_Overview: React.FC = () => {
  const { workspace_id } = useParams<{ workspace_id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Zustand store selectors - individual selectors to avoid infinite loops
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentWorkspace = useAppStore(state => state.current_workspace);
  const dateRangeFilter = useAppStore(state => state.date_range_filter);
  const platformFilter = useAppStore(state => state.platform_filter);
  const updateDateRange = useAppStore(state => state.update_date_range);
  const updateComparisonMode = useAppStore(state => state.update_comparison_mode);
  const updatePlatformFilter = useAppStore(state => state.update_platform_filter);
  const addToastNotification = useAppStore(state => state.add_toast_notification);

  // Local state for UI interactions
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['spend', 'revenue', 'roas']);
  const [showInsightsPanel, setShowInsightsPanel] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'platforms'>('overview');

  // Sync URL params with global state
  useEffect(() => {
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const preset = searchParams.get('date_preset');
    const comparisonMode = searchParams.get('comparison_mode');
    const platformsParam = searchParams.get('platforms');

    if (dateFrom || dateTo || preset) {
      updateDateRange(dateFrom, dateTo, preset);
    }
    if (comparisonMode) {
      updateComparisonMode(comparisonMode);
    }
    if (platformsParam) {
      const platforms = platformsParam.split(',').filter(Boolean);
      updatePlatformFilter(platforms);
    }
  }, [searchParams, updateDateRange, updateComparisonMode, updatePlatformFilter]);

  // API query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    
    if (dateRangeFilter.date_from) params.append('date_from', dateRangeFilter.date_from);
    if (dateRangeFilter.date_to) params.append('date_to', dateRangeFilter.date_to);
    if (dateRangeFilter.date_preset) params.append('date_preset', dateRangeFilter.date_preset);
    if (dateRangeFilter.comparison_mode) params.append('comparison_mode', dateRangeFilter.comparison_mode);
    if (platformFilter.selected_platforms.length > 0) {
      params.append('platforms', platformFilter.selected_platforms.join(','));
    }
    if (platformFilter.selected_accounts.length > 0) {
      params.append('accounts', platformFilter.selected_accounts.join(','));
    }

    return params.toString();
  }, [dateRangeFilter, platformFilter]);

  // API calls using React Query
  const { data: overviewMetrics, isLoading: isLoadingOverview, error: overviewError } = useQuery({
    queryKey: ['overview-metrics', workspace_id, queryParams],
    queryFn: async () => {
      console.log('Fetching overview metrics:', {
        workspace_id,
        queryParams: queryParams.toString(),
        url: `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/workspaces/${workspace_id}/metrics/overview?${queryParams}`
      });
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/workspaces/${workspace_id}/metrics/overview?${queryParams}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      console.log('Overview metrics response:', response.data);
      return response.data as OverviewMetrics;
    },
    enabled: !!workspace_id && !!authToken,
    staleTime: 5 * 60 * 1000,
    select: (data) => {
      const processed = {
        ...data,
        spend: Number(data.spend || 0),
        revenue: Number(data.revenue || 0),
        roas: Number(data.roas || 0),
        cpa: Number(data.cpa || 0),
        ctr: Number(data.ctr || 0),
        cpm: Number(data.cpm || 0),
        cvr: Number(data.cvr || 0),
        mer: Number(data.mer || 0)
      };
      console.log('Processed overview metrics:', processed);
      return processed;
    }
  });

  const { data: timeSeriesData, isLoading: isLoadingTimeSeries } = useQuery({
    queryKey: ['metrics-trends', workspace_id, queryParams, selectedMetrics],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/workspaces/${workspace_id}/metrics/trends?${queryParams}&metrics=${selectedMetrics.join(',')}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data as TimeSeriesData[];
    },
    enabled: !!workspace_id && !!authToken && selectedMetrics.length > 0,
    staleTime: 5 * 60 * 1000
  });

  const { data: anomalies } = useQuery({
    queryKey: ['anomalies', workspace_id, queryParams],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/workspaces/${workspace_id}/anomalies?${queryParams}&is_reviewed=false`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data.data as AnomalyDetection[];
    },
    enabled: !!workspace_id && !!authToken,
    staleTime: 2 * 60 * 1000
  });

  const { data: platformComparison, isLoading: isLoadingPlatforms } = useQuery({
    queryKey: ['platform-comparison', workspace_id, queryParams],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/workspaces/${workspace_id}/metrics/comparison?${queryParams}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data as PlatformComparison[];
    },
    enabled: !!workspace_id && !!authToken,
    staleTime: 5 * 60 * 1000
  });

  // Date range presets
  const datePresets = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last 7 days', value: 'last_7_days' },
    { label: 'Last 30 days', value: 'last_30_days' },
    { label: 'Last 90 days', value: 'last_90_days' },
    { label: 'Month to date', value: 'mtd' },
    { label: 'Quarter to date', value: 'qtd' },
    { label: 'Year to date', value: 'ytd' }
  ];

  // KPI configuration
  const kpiConfig = [
    { key: 'spend', label: 'Spend', format: 'currency', color: 'blue' },
    { key: 'revenue', label: 'Revenue', format: 'currency', color: 'green' },
    { key: 'roas', label: 'ROAS', format: 'decimal', color: 'purple', suffix: 'x' },
    { key: 'cpa', label: 'CPA', format: 'currency', color: 'orange' },
    { key: 'ctr', label: 'CTR', format: 'percentage', color: 'blue' },
    { key: 'cpm', label: 'CPM', format: 'currency', color: 'indigo' },
    { key: 'cvr', label: 'CVR', format: 'percentage', color: 'green' },
    { key: 'mer', label: 'MER', format: 'decimal', color: 'purple', suffix: 'x' }
  ];

  // Format functions
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  
  const formatPercentage = (value: number) => `${value.toFixed(2)}%`;
  
  const formatDecimal = (value: number, suffix?: string) => 
    `${value.toFixed(2)}${suffix || ''}`;

  const formatValue = (value: number, format: string, suffix?: string) => {
    switch (format) {
      case 'currency': return formatCurrency(value);
      case 'percentage': return formatPercentage(value);
      case 'decimal': return formatDecimal(value, suffix);
      default: return value.toString();
    }
  };

  // Handle filter changes
  const handleDatePresetChange = (preset: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('date_preset', preset);
    newParams.delete('date_from');
    newParams.delete('date_to');
    setSearchParams(newParams);
  };

  const handleComparisonModeChange = (mode: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (mode === dateRangeFilter.comparison_mode) {
      newParams.delete('comparison_mode');
    } else {
      newParams.set('comparison_mode', mode);
    }
    setSearchParams(newParams);
  };

  const handleExportData = () => {
    addToastNotification({
      type: 'info',
      message: 'Export functionality will be available soon',
      auto_dismiss: true
    });
  };

  const handleShareDashboard = () => {
    addToastNotification({
      type: 'info',
      message: 'Share functionality will be available soon',
      auto_dismiss: true
    });
  };

  // Loading state
  if (isLoadingOverview) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </>
    );
  }

  // Error state
  if (overviewError) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load dashboard</h2>
            <p className="text-gray-600 mb-4">Please try refreshing the page or contact support if the issue persists.</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </>
    );
  }

  // Empty state (no data) - only show if metrics exist but are truly zero
  // Don't show empty state during loading or if there's an error
  const hasNoData = overviewMetrics && 
                    overviewMetrics.spend === 0 && 
                    overviewMetrics.revenue === 0 && 
                    overviewMetrics.roas === 0 && 
                    overviewMetrics.cpa === 0;
  
  console.log('Dashboard state check:', {
    isLoadingOverview,
    hasError: !!overviewError,
    hasMetrics: !!overviewMetrics,
    hasNoData,
    spend: overviewMetrics?.spend,
    revenue: overviewMetrics?.revenue
  });
  
  if (!isLoadingOverview && !overviewError && hasNoData) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No data available</h2>
            <p className="text-gray-600 mb-8">
              Upload your advertising data to start analyzing your performance across platforms.
            </p>
            <Link
              to={`/w/${workspace_id}/upload`}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Upload Your First File
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Performance Overview</h1>
                <p className="mt-1 text-sm text-gray-600">
                  {currentWorkspace?.name} • {currentUser?.name}
                </p>
              </div>
              
              {/* Quick Actions */}
              <div className="flex items-center space-x-3">
                <Link
                  to={`/w/${workspace_id}/upload`}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Upload Data
                </Link>
                
                <button
                  onClick={handleExportData}
                  className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                  Export
                </button>
                
                <button
                  onClick={handleShareDashboard}
                  className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  <ShareIcon className="h-4 w-4 mr-2" />
                  Share
                </button>
                
                <Link
                  to={`/w/${workspace_id}/alerts`}
                  className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  <BellIcon className="h-4 w-4 mr-2" />
                  Alerts
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Date Range Presets */}
              <div className="flex items-center space-x-2">
                <CalendarIcon className="h-5 w-5 text-gray-400" />
                <select
                  value={dateRangeFilter.date_preset || 'last_30_days'}
                  onChange={(e) => handleDatePresetChange(e.target.value)}
                  className="border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  {datePresets.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Comparison Mode Toggle */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleComparisonModeChange('vs_previous_period')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    dateRangeFilter.comparison_mode === 'vs_previous_period'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  vs Previous Period
                </button>
                <button
                  onClick={() => handleComparisonModeChange('vs_same_period_last_year')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    dateRangeFilter.comparison_mode === 'vs_same_period_last_year'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  vs Same Period Last Year
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Anomaly Alerts */}
        {anomalies && anomalies.length > 0 && (
          <div className="bg-yellow-50 border-b border-yellow-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex items-center space-x-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">
                  {anomalies.length} anomal{anomalies.length === 1 ? 'y' : 'ies'} detected
                </span>
                <div className="flex space-x-2 ml-4">
                  {anomalies.slice(0, 3).map((anomaly) => (
                    <Link
                      key={anomaly.id}
                      to={`/w/${workspace_id}/alerts`}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        anomaly.severity === 'critical'
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : anomaly.severity === 'high'
                          ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                          : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      }`}
                    >
                      {anomaly.metric} {anomaly.anomaly_type} on {anomaly.platform}
                    </Link>
                  ))}
                  {anomalies.length > 3 && (
                    <Link
                      to={`/w/${workspace_id}/alerts`}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
                    >
                      +{anomalies.length - 3} more
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {kpiConfig.map((kpi) => {
              const value = overviewMetrics?.[kpi.key as keyof OverviewMetrics] as number || 0;
              const changeKey = `${kpi.key}_change` as keyof NonNullable<typeof overviewMetrics>['comparison'];
              const change = overviewMetrics?.comparison?.[changeKey] || 0;
              const isPositive = change > 0;
              const isNegative = change < 0;

              return (
                <div key={kpi.key} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-600">{kpi.label}</h3>
                    {dateRangeFilter.comparison_mode && (
                      <div className={`flex items-center space-x-1 text-xs font-medium ${
                        isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {isPositive ? (
                          <ArrowUpIcon className="h-3 w-3" />
                        ) : isNegative ? (
                          <ArrowDownIcon className="h-3 w-3" />
                        ) : null}
                        <span>{Math.abs(change).toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-2">
                    <p className="text-2xl font-bold text-gray-900">
                      {formatValue(value, kpi.format, kpi.suffix)}
                    </p>
                  </div>
                  
                  {/* Mini Sparkline Placeholder */}
                  <div className="h-8 bg-gray-50 rounded flex items-end justify-center space-x-1">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-1 bg-${kpi.color}-400 rounded-t`}
                        style={{ height: `${Math.random() * 100}%` }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Content Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'overview'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <ArrowTrendingUpIcon className="h-4 w-4" />
                    <span>Time Series</span>
                  </div>
                </button>
                
                <button
                  onClick={() => setActiveTab('platforms')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'platforms'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <ChartBarIcon className="h-4 w-4" />
                    <span>Platform Comparison</span>
                  </div>
                </button>
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'overview' && (
                <div>
                  {/* Metric Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Select metrics to display
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {kpiConfig.map((kpi) => (
                        <button
                          key={kpi.key}
                          onClick={() => {
                            setSelectedMetrics(prev => 
                              prev.includes(kpi.key)
                                ? prev.filter(m => m !== kpi.key)
                                : [...prev, kpi.key]
                            );
                          }}
                          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                            selectedMetrics.includes(kpi.key)
                              ? `bg-${kpi.color}-100 text-${kpi.color}-700`
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {kpi.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chart Placeholder */}
                  {isLoadingTimeSeries ? (
                    <div className="h-80 bg-gray-50 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-sm text-gray-600">Loading chart data...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-80 bg-gray-50 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <ArrowTrendingUpIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          Interactive time series chart will be displayed here
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {timeSeriesData?.length || 0} data points available
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'platforms' && (
                <div>
                  {isLoadingPlatforms ? (
                    <div className="h-80 bg-gray-50 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-sm text-gray-600">Loading platform data...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Platform
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Spend
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Revenue
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              ROAS
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              CTR
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Campaigns
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {platformComparison?.map((platform) => (
                            <tr key={platform.platform} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className={`w-3 h-3 rounded-full mr-3 ${
                                    platform.platform === 'facebook' ? 'bg-blue-500' :
                                    platform.platform === 'tiktok' ? 'bg-black' :
                                    platform.platform === 'snapchat' ? 'bg-yellow-500' :
                                    'bg-gray-500'
                                  }`}></div>
                                  <span className="text-sm font-medium text-gray-900 capitalize">
                                    {platform.platform}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrency(platform.spend)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrency(platform.revenue)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatDecimal(platform.roas, 'x')}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatPercentage(platform.ctr)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {platform.campaign_count}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Insights Panel */}
          {showInsightsPanel && overviewMetrics?.insights && overviewMetrics.insights.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Performance Insights</h2>
                <button
                  onClick={() => setShowInsightsPanel(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  ×
                </button>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  {overviewMetrics.insights.map((insight, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        insight.severity === 'critical' ? 'bg-red-500' :
                        insight.severity === 'warning' ? 'bg-yellow-500' :
                        'bg-blue-500'
                      }`}></div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{insight.message}</p>
                        {insight.entity_type && insight.entity_id && (
                          <Link
                            to={`/w/${workspace_id}/campaigns`}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Investigate {insight.entity_type} →
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_Overview;