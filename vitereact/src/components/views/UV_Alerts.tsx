import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// Types
interface AlertRule {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number | null;
  threshold_percentage: number | null;
  time_window: string;
  platform_filter: Record<string, any> | null;
  account_filter: Record<string, any> | null;
  campaign_filter: Record<string, any> | null;
  severity: string;
  is_active: boolean;
  notification_email: boolean;
  notification_in_app: boolean;
  cooldown_minutes: number;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AlertTrigger {
  id: string;
  alert_rule_id: string;
  workspace_id: string;
  triggered_at: string;
  metric_value: number;
  threshold_value: number;
  condition_met: string;
  affected_entity_type: string;
  affected_entity_id: string;
  affected_entity_name: string | null;
  platform: string;
  details: Record<string, any> | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface RuleBuilderState {
  name: string;
  metric: string;
  condition: string;
  threshold: number | null;
  threshold_percentage: number | null;
  time_window: string;
  platform_filter: Record<string, any> | null;
  account_filter: Record<string, any> | null;
  campaign_filter: Record<string, any> | null;
  severity: string;
  is_active: boolean;
  notification_email: boolean;
  notification_in_app: boolean;
  cooldown_minutes: number;
}

const UV_Alerts: React.FC = () => {
  const { workspace_id } = useParams<{ workspace_id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Zustand state - individual selectors to prevent infinite loops
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const currentWorkspace = useAppStore(state => state.current_workspace);
  const addToastNotification = useAppStore(state => state.add_toast_notification);

  // Local state
  const [activeTab, setActiveTab] = useState<'rules' | 'triggers' | 'create'>('rules');
  const [selectedRule, setSelectedRule] = useState<AlertRule | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  // Filter state from URL params
  const ruleStatus = searchParams.get('rule_status');
  const triggerStatus = searchParams.get('trigger_status');
  const alertType = searchParams.get('alert_type');
  const dateFrom = searchParams.get('date_from');

  // Rule builder state
  const [ruleBuilderState, setRuleBuilderState] = useState<RuleBuilderState>({
    name: '',
    metric: 'spend',
    condition: 'greater_than',
    threshold: null,
    threshold_percentage: null,
    time_window: 'daily',
    platform_filter: null,
    account_filter: null,
    campaign_filter: null,
    severity: 'warning',
    is_active: true,
    notification_email: true,
    notification_in_app: true,
    cooldown_minutes: 60,
  });

  // Pagination state
  const [rulesPage, setRulesPage] = useState(1);
  const [triggersPage, setTriggersPage] = useState(1);

  const getApiBaseUrl = () => {
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  };

  // API functions
  const fetchAlertRules = async (page: number = 1): Promise<PaginatedResponse<AlertRule>> => {
    const params = new URLSearchParams({
      limit: '10',
      offset: ((page - 1) * 10).toString(),
    });
    
    if (ruleStatus === 'active') params.set('is_active', 'true');
    if (ruleStatus === 'inactive') params.set('is_active', 'false');
    if (alertType) params.set('severity', alertType);
    
    const response = await axios.get(
      `${getApiBaseUrl()}/api/workspaces/${workspace_id}/alert-rules?${params}`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    return response.data;
  };

  const fetchAlertTriggers = async (page: number = 1): Promise<PaginatedResponse<AlertTrigger>> => {
    const params = new URLSearchParams({
      limit: '10',
      offset: ((page - 1) * 10).toString(),
    });
    
    if (triggerStatus === 'resolved') params.set('is_resolved', 'true');
    if (triggerStatus === 'unresolved') params.set('is_resolved', 'false');
    
    const response = await axios.get(
      `${getApiBaseUrl()}/api/workspaces/${workspace_id}/alert-triggers?${params}`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    return response.data;
  };

  const createAlertRule = async (ruleData: Omit<AlertRule, 'id' | 'workspace_id' | 'created_by' | 'created_at' | 'updated_at' | 'last_triggered_at'>): Promise<AlertRule> => {
    const response = await axios.post(
      `${getApiBaseUrl()}/api/workspaces/${workspace_id}/alert-rules`,
      { ...ruleData, workspace_id, created_by: currentUser?.id },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    return response.data;
  };

  const updateAlertRule = async (ruleId: string, ruleData: Partial<AlertRule>): Promise<AlertRule> => {
    const response = await axios.put(
      `${getApiBaseUrl()}/api/workspaces/${workspace_id}/alert-rules/${ruleId}`,
      ruleData,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    return response.data;
  };

  const deleteAlertRule = async (ruleId: string): Promise<void> => {
    await axios.delete(
      `${getApiBaseUrl()}/api/workspaces/${workspace_id}/alert-rules/${ruleId}`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
  };

  const resolveAlertTrigger = async (triggerId: string): Promise<AlertTrigger> => {
    const response = await axios.put(
      `${getApiBaseUrl()}/api/workspaces/${workspace_id}/alert-triggers/${triggerId}`,
      {
        is_resolved: true,
        resolved_by: currentUser?.id,
        resolved_at: new Date().toISOString(),
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    return response.data;
  };

  // React Query hooks
  const { 
    data: alertRules, 
    isLoading: rulesLoading, 
    error: rulesError 
  } = useQuery({
    queryKey: ['alert-rules', workspace_id, rulesPage, ruleStatus, alertType],
    queryFn: () => fetchAlertRules(rulesPage),
    enabled: !!workspace_id && !!authToken && activeTab === 'rules',
    staleTime: 30000,
  });

  const { 
    data: alertTriggers, 
    isLoading: triggersLoading, 
    error: triggersError 
  } = useQuery({
    queryKey: ['alert-triggers', workspace_id, triggersPage, triggerStatus],
    queryFn: () => fetchAlertTriggers(triggersPage),
    enabled: !!workspace_id && !!authToken && activeTab === 'triggers',
    staleTime: 30000,
  });

  const createRuleMutation = useMutation({
    mutationFn: createAlertRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      addToastNotification({
        type: 'success',
        message: 'Alert rule created successfully',
        auto_dismiss: true,
      });
      setActiveTab('rules');
      resetRuleBuilder();
    },
    onError: (error: any) => {
      addToastNotification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to create alert rule',
        auto_dismiss: true,
      });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ ruleId, ruleData }: { ruleId: string; ruleData: Partial<AlertRule> }) => 
      updateAlertRule(ruleId, ruleData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      addToastNotification({
        type: 'success',
        message: 'Alert rule updated successfully',
        auto_dismiss: true,
      });
      setSelectedRule(null);
      setIsEditing(false);
      resetRuleBuilder();
    },
    onError: (error: any) => {
      addToastNotification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update alert rule',
        auto_dismiss: true,
      });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: deleteAlertRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      addToastNotification({
        type: 'success',
        message: 'Alert rule deleted successfully',
        auto_dismiss: true,
      });
      setShowDeleteConfirm(null);
    },
    onError: (error: any) => {
      addToastNotification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to delete alert rule',
        auto_dismiss: true,
      });
    },
  });

  const resolveTriggerMutation = useMutation({
    mutationFn: resolveAlertTrigger,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-triggers'] });
      addToastNotification({
        type: 'success',
        message: 'Alert resolved successfully',
        auto_dismiss: true,
      });
    },
    onError: (error: any) => {
      addToastNotification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to resolve alert',
        auto_dismiss: true,
      });
    },
  });

  // Helper functions
  const resetRuleBuilder = () => {
    setRuleBuilderState({
      name: '',
      metric: 'spend',
      condition: 'greater_than',
      threshold: null,
      threshold_percentage: null,
      time_window: 'daily',
      platform_filter: null,
      account_filter: null,
      campaign_filter: null,
      severity: 'warning',
      is_active: true,
      notification_email: true,
      notification_in_app: true,
      cooldown_minutes: 60,
    });
  };

  const updateFilter = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const handleRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isEditing && selectedRule) {
      updateRuleMutation.mutate({
        ruleId: selectedRule.id,
        ruleData: ruleBuilderState,
      });
    } else {
      createRuleMutation.mutate(ruleBuilderState);
    }
  };

  const handleEditRule = (rule: AlertRule) => {
    setSelectedRule(rule);
    setIsEditing(true);
    setRuleBuilderState({
      name: rule.name,
      metric: rule.metric,
      condition: rule.condition,
      threshold: rule.threshold,
      threshold_percentage: rule.threshold_percentage,
      time_window: rule.time_window,
      platform_filter: rule.platform_filter,
      account_filter: rule.account_filter,
      campaign_filter: rule.campaign_filter,
      severity: rule.severity,
      is_active: rule.is_active,
      notification_email: rule.notification_email,
      notification_in_app: rule.notification_in_app,
      cooldown_minutes: rule.cooldown_minutes,
    });
    setActiveTab('create');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'info': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Alert Management</h1>
                  <p className="mt-2 text-gray-600">
                    Configure alert rules and monitor triggered alerts for proactive performance monitoring
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      resetRuleBuilder();
                      setIsEditing(false);
                      setSelectedRule(null);
                      setActiveTab('create');
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Create Alert Rule
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-8">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-8">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('rules')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'rules'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Alert Rules
                {alertRules && (
                  <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                    {alertRules.pagination.total}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('triggers')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'triggers'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Alert History
                {alertTriggers && (
                  <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                    {alertTriggers.pagination.total}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'create'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {isEditing ? 'Edit Rule' : 'Create Rule'}
              </button>
            </nav>
          </div>

          {/* Alert Rules Tab */}
          {activeTab === 'rules' && (
            <div className="space-y-6">
              {/* Filters */}
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rule Status
                    </label>
                    <select
                      value={ruleStatus || ''}
                      onChange={(e) => updateFilter('rule_status', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Severity
                    </label>
                    <select
                      value={alertType || ''}
                      onChange={(e) => updateFilter('alert_type', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Severities</option>
                      <option value="critical">Critical</option>
                      <option value="warning">Warning</option>
                      <option value="info">Info</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date From
                    </label>
                    <input
                      type="date"
                      value={dateFrom || ''}
                      onChange={(e) => updateFilter('date_from', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Rules Table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Alert Rules</h3>
                </div>
                
                {rulesLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading alert rules...</p>
                  </div>
                ) : rulesError ? (
                  <div className="p-8 text-center">
                    <p className="text-red-600">Error loading alert rules. Please try again.</p>
                  </div>
                ) : !alertRules?.data.length ? (
                  <div className="p-8 text-center">
                    <p className="text-gray-600">No alert rules found. Create your first alert rule to get started.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Rule Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Metric & Condition
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Severity
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Last Triggered
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {alertRules.data.map((rule) => (
                          <tr key={rule.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{rule.name}</div>
                                <div className="text-sm text-gray-500">
                                  Cooldown: {rule.cooldown_minutes}min
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {rule.metric.toUpperCase()} {rule.condition.replace('_', ' ')}
                              </div>
                              <div className="text-sm text-gray-500">
                                {rule.threshold !== null 
                                  ? `Threshold: ${rule.threshold}`
                                  : `Percentage: ${rule.threshold_percentage}%`
                                }
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(rule.severity)}`}>
                                {rule.severity}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(rule.is_active)}`}>
                                {rule.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {rule.last_triggered_at ? formatDate(rule.last_triggered_at) : 'Never'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex space-x-2 justify-end">
                                <button
                                  onClick={() => handleEditRule(rule)}
                                  className="text-blue-600 hover:text-blue-700 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    updateRuleMutation.mutate({
                                      ruleId: rule.id,
                                      ruleData: { is_active: !rule.is_active }
                                    });
                                  }}
                                  className={`transition-colors ${
                                    rule.is_active
                                      ? 'text-yellow-600 hover:text-yellow-700'
                                      : 'text-green-600 hover:text-green-700'
                                  }`}
                                >
                                  {rule.is_active ? 'Disable' : 'Enable'}
                                </button>
                                <button
                                  onClick={() => setShowDeleteConfirm(rule.id)}
                                  className="text-red-600 hover:text-red-700 transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination for Rules */}
                {alertRules && alertRules.pagination.total_pages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {((rulesPage - 1) * 10) + 1} to {Math.min(rulesPage * 10, alertRules.pagination.total)} of {alertRules.pagination.total} rules
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setRulesPage(prev => Math.max(1, prev - 1))}
                        disabled={rulesPage === 1}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setRulesPage(prev => Math.min(alertRules.pagination.total_pages, prev + 1))}
                        disabled={rulesPage === alertRules.pagination.total_pages}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Alert Triggers Tab */}
          {activeTab === 'triggers' && (
            <div className="space-y-6">
              {/* Filters */}
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Resolution Status
                    </label>
                    <select
                      value={triggerStatus || ''}
                      onChange={(e) => updateFilter('trigger_status', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Statuses</option>
                      <option value="unresolved">Unresolved</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Triggers Table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Alert History</h3>
                </div>
                
                {triggersLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading alert history...</p>
                  </div>
                ) : triggersError ? (
                  <div className="p-8 text-center">
                    <p className="text-red-600">Error loading alert history. Please try again.</p>
                  </div>
                ) : !alertTriggers?.data.length ? (
                  <div className="p-8 text-center">
                    <p className="text-gray-600">No triggered alerts found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Triggered At
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Affected Entity
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Platform
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Metric Value
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {alertTriggers.data.map((trigger) => (
                          <tr key={trigger.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(trigger.triggered_at)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {trigger.affected_entity_name || trigger.affected_entity_id}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {trigger.affected_entity_type}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                {trigger.platform}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                Value: {trigger.metric_value}
                              </div>
                              <div className="text-sm text-gray-500">
                                Threshold: {trigger.threshold_value}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                trigger.is_resolved 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {trigger.is_resolved ? 'Resolved' : 'Unresolved'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              {!trigger.is_resolved && (
                                <button
                                  onClick={() => resolveTriggerMutation.mutate(trigger.id)}
                                  disabled={resolveTriggerMutation.isPending}
                                  className="text-green-600 hover:text-green-700 transition-colors disabled:opacity-50"
                                >
                                  {resolveTriggerMutation.isPending ? 'Resolving...' : 'Resolve'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination for Triggers */}
                {alertTriggers && alertTriggers.pagination.total_pages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {((triggersPage - 1) * 10) + 1} to {Math.min(triggersPage * 10, alertTriggers.pagination.total)} of {alertTriggers.pagination.total} triggers
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setTriggersPage(prev => Math.max(1, prev - 1))}
                        disabled={triggersPage === 1}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setTriggersPage(prev => Math.min(alertTriggers.pagination.total_pages, prev + 1))}
                        disabled={triggersPage === alertTriggers.pagination.total_pages}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Create/Edit Rule Tab */}
          {activeTab === 'create' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {isEditing ? 'Edit Alert Rule' : 'Create New Alert Rule'}
                </h3>
                <p className="mt-1 text-gray-600">
                  Configure alert conditions and notification settings
                </p>
              </div>

              <form onSubmit={handleRuleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rule Name *
                    </label>
                    <input
                      type="text"
                      value={ruleBuilderState.name}
                      onChange={(e) => setRuleBuilderState(prev => ({ ...prev, name: e.target.value }))}
                      required
                      placeholder="e.g., High ROAS Drop Alert"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Severity *
                    </label>
                    <select
                      value={ruleBuilderState.severity}
                      onChange={(e) => setRuleBuilderState(prev => ({ ...prev, severity: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                {/* Metric Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Metric *
                    </label>
                    <select
                      value={ruleBuilderState.metric}
                      onChange={(e) => setRuleBuilderState(prev => ({ ...prev, metric: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="spend">Spend</option>
                      <option value="impressions">Impressions</option>
                      <option value="clicks">Clicks</option>
                      <option value="conversions">Conversions</option>
                      <option value="revenue">Revenue</option>
                      <option value="ctr">CTR</option>
                      <option value="cpm">CPM</option>
                      <option value="cpc">CPC</option>
                      <option value="cpa">CPA</option>
                      <option value="cvr">CVR</option>
                      <option value="roas">ROAS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Condition *
                    </label>
                    <select
                      value={ruleBuilderState.condition}
                      onChange={(e) => setRuleBuilderState(prev => ({ ...prev, condition: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="greater_than">Greater Than</option>
                      <option value="less_than">Less Than</option>
                      <option value="percentage_increase">Percentage Increase</option>
                      <option value="percentage_decrease">Percentage Decrease</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Time Window *
                    </label>
                    <select
                      value={ruleBuilderState.time_window}
                      onChange={(e) => setRuleBuilderState(prev => ({ ...prev, time_window: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                </div>

                {/* Threshold Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {(ruleBuilderState.condition === 'greater_than' || ruleBuilderState.condition === 'less_than') ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Threshold Value
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={ruleBuilderState.threshold || ''}
                        onChange={(e) => setRuleBuilderState(prev => ({ 
                          ...prev, 
                          threshold: e.target.value ? parseFloat(e.target.value) : null,
                          threshold_percentage: null
                        }))}
                        placeholder="e.g., 1000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Percentage Change (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={ruleBuilderState.threshold_percentage || ''}
                        onChange={(e) => setRuleBuilderState(prev => ({ 
                          ...prev, 
                          threshold_percentage: e.target.value ? parseFloat(e.target.value) : null,
                          threshold: null
                        }))}
                        placeholder="e.g., 20"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cooldown (minutes) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={ruleBuilderState.cooldown_minutes}
                      onChange={(e) => setRuleBuilderState(prev => ({ 
                        ...prev, 
                        cooldown_minutes: parseInt(e.target.value) || 60
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Notification Settings */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Notification Settings</h4>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="notification_email"
                        checked={ruleBuilderState.notification_email}
                        onChange={(e) => setRuleBuilderState(prev => ({ 
                          ...prev, 
                          notification_email: e.target.checked 
                        }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="notification_email" className="ml-2 text-sm text-gray-700">
                        Send email notifications
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="notification_in_app"
                        checked={ruleBuilderState.notification_in_app}
                        onChange={(e) => setRuleBuilderState(prev => ({ 
                          ...prev, 
                          notification_in_app: e.target.checked 
                        }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="notification_in_app" className="ml-2 text-sm text-gray-700">
                        Send in-app notifications
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={ruleBuilderState.is_active}
                        onChange={(e) => setRuleBuilderState(prev => ({ 
                          ...prev, 
                          is_active: e.target.checked 
                        }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                        Activate rule immediately
                      </label>
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={createRuleMutation.isPending || updateRuleMutation.isPending}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {createRuleMutation.isPending || updateRuleMutation.isPending 
                      ? 'Saving...' 
                      : isEditing ? 'Update Rule' : 'Create Rule'
                    }
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetRuleBuilder();
                      setIsEditing(false);
                      setSelectedRule(null);
                      setActiveTab('rules');
                    }}
                    className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Alert Rule</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this alert rule? This action cannot be undone.
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    deleteRuleMutation.mutate(showDeleteConfirm);
                  }}
                  disabled={deleteRuleMutation.isPending}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleteRuleMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_Alerts;