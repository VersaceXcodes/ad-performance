import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// TypeScript interfaces based on Zod schemas
interface WorkspaceSettings {
  id: string;
  name: string;
  default_currency: string;
  default_revenue_per_conversion: number | null;
  timezone: string;
  data_retention_days: number;
  created_at: string;
  updated_at: string;
}

interface UserPreferences {
  id: string;
  user_id: string;
  email_notifications: boolean;
  in_app_notifications: boolean;
  email_frequency: string;
  reduced_motion: boolean;
  date_format: string;
  number_format: string;
  default_dashboard_view: string;
  theme_preference: string;
  created_at: string;
  updated_at: string;
}

interface TeamMember {
  membership: {
    id: string;
    user_id: string;
    workspace_id: string;
    role: string;
    status: string;
    invited_by: string | null;
    invitation_token: string | null;
    invitation_expires: string | null;
    created_at: string;
    updated_at: string;
  };
  user: {
    id: string;
    email: string;
    name: string;
    email_verified: boolean;
    created_at: string;
    updated_at: string;
  };
}

interface PendingInvitation {
  id: string;
  workspace_id: string;
  invited_by: string;
  email: string;
  role: string;
  invitation_token: string;
  status: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
  updated_at: string;
}

const UV_Settings: React.FC = () => {
  const { workspace_id } = useParams<{ workspace_id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Global state access - individual selectors to prevent infinite loops
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentWorkspace = useAppStore(state => state.current_workspace);

  // Local state management
  const [currentSection, setCurrentSection] = useState(searchParams.get('section') || 'workspace');
  const [editMode, setEditMode] = useState({
    workspace: false,
    personal: false,
    team: false
  });
  const [formState, setFormState] = useState({
    workspace: {} as Partial<WorkspaceSettings>,
    personal: {} as Partial<UserPreferences>,
    team_invitation: { email: '', role: 'member' }
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Get API base URL
  const getApiBaseUrl = () => {
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  };

  // Determine user role in current workspace
  const userRole = currentWorkspace?.role || 'member';
  const canManageWorkspace = userRole === 'owner' || userRole === 'admin';
  const canManageTeam = userRole === 'owner' || userRole === 'admin';
  const canDeleteWorkspace = userRole === 'owner';

  // API Query Functions
  const fetchWorkspaceSettings = async (): Promise<WorkspaceSettings> => {
    const response = await axios.get(
      `${getApiBaseUrl()}/api/workspaces/${workspace_id}`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    return response.data;
  };

  const fetchUserPreferences = async (): Promise<UserPreferences> => {
    const response = await axios.get(
      `${getApiBaseUrl()}/api/users/${currentUser?.id}/preferences`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    return response.data;
  };

  const fetchTeamMembers = async (): Promise<TeamMember[]> => {
    const response = await axios.get(
      `${getApiBaseUrl()}/api/workspaces/${workspace_id}/members`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    return response.data;
  };

  const fetchPendingInvitations = async (): Promise<PendingInvitation[]> => {
    const response = await axios.get(
      `${getApiBaseUrl()}/api/workspaces/${workspace_id}/invitations`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    return response.data;
  };

  // React Query hooks
  const workspaceQuery = useQuery({
    queryKey: ['workspace-settings', workspace_id],
    queryFn: fetchWorkspaceSettings,
    enabled: !!workspace_id && !!authToken && canManageWorkspace,
    staleTime: 5 * 60 * 1000,
  });

  const userPreferencesQuery = useQuery({
    queryKey: ['user-preferences', currentUser?.id],
    queryFn: fetchUserPreferences,
    enabled: !!currentUser?.id && !!authToken,
    staleTime: 5 * 60 * 1000,
  });

  const teamMembersQuery = useQuery({
    queryKey: ['team-members', workspace_id],
    queryFn: fetchTeamMembers,
    enabled: !!workspace_id && !!authToken && canManageTeam,
    staleTime: 2 * 60 * 1000,
  });

  const pendingInvitationsQuery = useQuery({
    queryKey: ['pending-invitations', workspace_id],
    queryFn: fetchPendingInvitations,
    enabled: !!workspace_id && !!authToken && canManageTeam,
    staleTime: 2 * 60 * 1000,
  });

  // Mutation functions
  const updateWorkspaceMutation = useMutation({
    mutationFn: async (data: Partial<WorkspaceSettings>) => {
      const response = await axios.put(
        `${getApiBaseUrl()}/api/workspaces/${workspace_id}`,
        data,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-settings', workspace_id] });
      setEditMode(prev => ({ ...prev, workspace: false }));
      setFormState(prev => ({ ...prev, workspace: {} }));
    },
  });

  const updateUserPreferencesMutation = useMutation({
    mutationFn: async (data: Partial<UserPreferences>) => {
      const response = await axios.put(
        `${getApiBaseUrl()}/api/users/${currentUser?.id}/preferences`,
        data,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences', currentUser?.id] });
      setEditMode(prev => ({ ...prev, personal: false }));
      setFormState(prev => ({ ...prev, personal: {} }));
    },
  });

  const inviteTeamMemberMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const response = await axios.post(
        `${getApiBaseUrl()}/api/workspaces/${workspace_id}/invitations`,
        data,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invitations', workspace_id] });
      setFormState(prev => ({ ...prev, team_invitation: { email: '', role: 'member' } }));
    },
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: async ({ member_id, role }: { member_id: string; role: string }) => {
      const response = await axios.put(
        `${getApiBaseUrl()}/api/workspaces/${workspace_id}/members/${member_id}`,
        { role },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', workspace_id] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (member_id: string) => {
      await axios.delete(
        `${getApiBaseUrl()}/api/workspaces/${workspace_id}/members/${member_id}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', workspace_id] });
    },
  });

  const deleteWorkspaceMutation = useMutation({
    mutationFn: async () => {
      await axios.delete(
        `${getApiBaseUrl()}/api/workspaces/${workspace_id}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
    },
    onSuccess: () => {
      // Navigate to workspace selection or create new workspace
      window.location.href = '/w/default';
    },
  });

  // Event handlers
  const handleSectionChange = (section: string) => {
    setCurrentSection(section);
    setSearchParams({ section });
  };

  const handleWorkspaceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceQuery.data) return;

    const updatedData = {
      ...workspaceQuery.data,
      ...formState.workspace
    };

    updateWorkspaceMutation.mutate(updatedData);
  };

  const handleUserPreferencesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPreferencesQuery.data) return;

    const updatedData = {
      ...userPreferencesQuery.data,
      ...formState.personal
    };

    updateUserPreferencesMutation.mutate(updatedData);
  };

  const handleTeamInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inviteTeamMemberMutation.mutate(formState.team_invitation);
  };

  const handleRoleChange = (member_id: string, new_role: string) => {
    updateMemberRoleMutation.mutate({ member_id, role: new_role });
  };

  const handleMemberRemove = (member_id: string) => {
    if (confirm('Are you sure you want to remove this team member?')) {
      removeMemberMutation.mutate(member_id);
    }
  };

  const handleDeleteWorkspace = () => {
    if (deleteConfirmText === workspaceQuery.data?.name) {
      deleteWorkspaceMutation.mutate();
    }
  };

  // Update form state when switching to edit mode
  useEffect(() => {
    if (editMode.workspace && workspaceQuery.data) {
      setFormState(prev => ({
        ...prev,
        workspace: { ...workspaceQuery.data }
      }));
    }
  }, [editMode.workspace, workspaceQuery.data]);

  useEffect(() => {
    if (editMode.personal && userPreferencesQuery.data) {
      setFormState(prev => ({
        ...prev,
        personal: { ...userPreferencesQuery.data }
      }));
    }
  }, [editMode.personal, userPreferencesQuery.data]);

  // Currency options
  const currencyOptions = [
    { value: 'USD', label: 'USD ($)' },
    { value: 'EUR', label: 'EUR (€)' },
    { value: 'GBP', label: 'GBP (£)' },
  ];

  // Timezone options (simplified)
  const timezoneOptions = [
    { value: 'UTC', label: 'UTC' },
    { value: 'America/New_York', label: 'Eastern Time' },
    { value: 'America/Chicago', label: 'Central Time' },
    { value: 'America/Denver', label: 'Mountain Time' },
    { value: 'America/Los_Angeles', label: 'Pacific Time' },
    { value: 'Europe/London', label: 'London' },
    { value: 'Europe/Paris', label: 'Paris' },
    { value: 'Asia/Tokyo', label: 'Tokyo' },
  ];

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
              <p className="mt-2 text-gray-600">
                Manage your workspace configuration and personal preferences
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            {/* Settings Navigation */}
            <div className="lg:col-span-3">
              <nav className="space-y-1">
                {canManageWorkspace && (
                  <button
                    onClick={() => handleSectionChange('workspace')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      currentSection === 'workspace'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    Workspace
                  </button>
                )}
                
                {canManageTeam && (
                  <button
                    onClick={() => handleSectionChange('team')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      currentSection === 'team'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    Team
                  </button>
                )}
                
                <button
                  onClick={() => handleSectionChange('personal')}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentSection === 'personal'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Personal
                </button>
                
                {userRole === 'owner' && (
                  <button
                    onClick={() => handleSectionChange('billing')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      currentSection === 'billing'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    Billing
                  </button>
                )}
              </nav>
            </div>

            {/* Settings Content */}
            <div className="lg:col-span-9 mt-6 lg:mt-0">
              {/* Workspace Settings */}
              {currentSection === 'workspace' && canManageWorkspace && (
                <div className="bg-white shadow rounded-lg">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-medium text-gray-900">Workspace Settings</h2>
                      {!editMode.workspace ? (
                        <button
                          onClick={() => setEditMode(prev => ({ ...prev, workspace: true }))}
                          className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-500"
                        >
                          Edit
                        </button>
                      ) : (
                        <div className="space-x-2">
                          <button
                            onClick={() => setEditMode(prev => ({ ...prev, workspace: false }))}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-6 py-6">
                    {workspaceQuery.isLoading ? (
                      <div className="animate-pulse space-y-4">
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div className="h-10 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div className="h-10 bg-gray-200 rounded"></div>
                      </div>
                    ) : editMode.workspace ? (
                      <form onSubmit={handleWorkspaceSubmit} className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Workspace Name
                          </label>
                          <input
                            type="text"
                            value={formState.workspace.name || ''}
                            onChange={(e) => setFormState(prev => ({
                              ...prev,
                              workspace: { ...prev.workspace, name: e.target.value }
                            }))}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Default Currency
                          </label>
                          <select
                            value={formState.workspace.default_currency || 'USD'}
                            onChange={(e) => setFormState(prev => ({
                              ...prev,
                              workspace: { ...prev.workspace, default_currency: e.target.value }
                            }))}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          >
                            {currencyOptions.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Default Revenue per Conversion
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formState.workspace.default_revenue_per_conversion || ''}
                            onChange={(e) => setFormState(prev => ({
                              ...prev,
                              workspace: { 
                                ...prev.workspace, 
                                default_revenue_per_conversion: e.target.value ? parseFloat(e.target.value) : null 
                              }
                            }))}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Optional"
                          />
                          <p className="mt-1 text-sm text-gray-500">
                            Used for calculating ROAS when revenue data is not available
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Timezone
                          </label>
                          <select
                            value={formState.workspace.timezone || 'UTC'}
                            onChange={(e) => setFormState(prev => ({
                              ...prev,
                              workspace: { ...prev.workspace, timezone: e.target.value }
                            }))}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          >
                            {timezoneOptions.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Data Retention (Days)
                          </label>
                          <select
                            value={formState.workspace.data_retention_days || 730}
                            onChange={(e) => setFormState(prev => ({
                              ...prev,
                              workspace: { ...prev.workspace, data_retention_days: parseInt(e.target.value) }
                            }))}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value={90}>90 days</option>
                            <option value={180}>180 days</option>
                            <option value={365}>1 year</option>
                            <option value={730}>2 years</option>
                            <option value={1095}>3 years</option>
                          </select>
                          <p className="mt-1 text-sm text-gray-500">
                            How long to keep historical data before automatic deletion
                          </p>
                        </div>

                        <div className="flex justify-end space-x-3">
                          <button
                            type="submit"
                            disabled={updateWorkspaceMutation.isPending}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                          >
                            {updateWorkspaceMutation.isPending ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Workspace Name</dt>
                          <dd className="mt-1 text-sm text-gray-900">{workspaceQuery.data?.name}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Default Currency</dt>
                          <dd className="mt-1 text-sm text-gray-900">{workspaceQuery.data?.default_currency}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Default Revenue per Conversion</dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {workspaceQuery.data?.default_revenue_per_conversion 
                              ? `${workspaceQuery.data.default_currency} ${workspaceQuery.data.default_revenue_per_conversion}`
                              : 'Not set'
                            }
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Timezone</dt>
                          <dd className="mt-1 text-sm text-gray-900">{workspaceQuery.data?.timezone}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Data Retention</dt>
                          <dd className="mt-1 text-sm text-gray-900">{workspaceQuery.data?.data_retention_days} days</dd>
                        </div>
                      </div>
                    )}

                    {updateWorkspaceMutation.isError && (
                      <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                        <p className="text-sm">
                          Failed to update workspace settings. Please try again.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Danger Zone */}
                  {canDeleteWorkspace && (
                    <div className="px-6 py-6 border-t border-gray-200">
                      <div className="rounded-md bg-red-50 p-4">
                        <h3 className="text-sm font-medium text-red-800 mb-2">Danger Zone</h3>
                        <p className="text-sm text-red-700 mb-4">
                          Once you delete a workspace, there is no going back. All data will be permanently lost.
                        </p>
                        
                        {!showDeleteConfirm ? (
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                          >
                            Delete Workspace
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-sm text-red-700">
                              Type the workspace name "{workspaceQuery.data?.name}" to confirm deletion:
                            </p>
                            <input
                              type="text"
                              value={deleteConfirmText}
                              onChange={(e) => setDeleteConfirmText(e.target.value)}
                              className="block w-full px-3 py-2 border border-red-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                              placeholder={workspaceQuery.data?.name}
                            />
                            <div className="flex space-x-3">
                              <button
                                onClick={handleDeleteWorkspace}
                                disabled={deleteConfirmText !== workspaceQuery.data?.name || deleteWorkspaceMutation.isPending}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                              >
                                {deleteWorkspaceMutation.isPending ? 'Deleting...' : 'Delete Workspace'}
                              </button>
                              <button
                                onClick={() => {
                                  setShowDeleteConfirm(false);
                                  setDeleteConfirmText('');
                                }}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Team Settings */}
              {currentSection === 'team' && canManageTeam && (
                <div className="space-y-6">
                  {/* Team Members */}
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-medium text-gray-900">Team Members</h2>
                    </div>
                    <div className="px-6 py-6">
                      {teamMembersQuery.isLoading ? (
                        <div className="animate-pulse space-y-4">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="flex items-center space-x-4">
                              <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                              <div className="flex-1 space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {teamMembersQuery.data?.map((member) => (
                            <div key={member.membership.id} className="flex items-center justify-between py-3">
                              <div className="flex items-center space-x-4">
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  <span className="text-sm font-medium text-blue-800">
                                    {member.user.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{member.user.name}</p>
                                  <p className="text-sm text-gray-500">{member.user.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <select
                                  value={member.membership.role}
                                  onChange={(e) => handleRoleChange(member.membership.id, e.target.value)}
                                  disabled={member.user.id === currentUser?.id}
                                  className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                >
                                  <option value="owner">Owner</option>
                                  <option value="admin">Admin</option>
                                  <option value="member">Member</option>
                                </select>
                                {member.user.id !== currentUser?.id && (
                                  <button
                                    onClick={() => handleMemberRemove(member.membership.id)}
                                    className="text-red-600 hover:text-red-800 text-sm"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Invite New Member */}
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-medium text-gray-900">Invite Team Member</h2>
                    </div>
                    <div className="px-6 py-6">
                      <form onSubmit={handleTeamInviteSubmit} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Email Address
                          </label>
                          <input
                            type="email"
                            required
                            value={formState.team_invitation.email}
                            onChange={(e) => setFormState(prev => ({
                              ...prev,
                              team_invitation: { ...prev.team_invitation, email: e.target.value }
                            }))}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="colleague@example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Role
                          </label>
                          <select
                            value={formState.team_invitation.role}
                            onChange={(e) => setFormState(prev => ({
                              ...prev,
                              team_invitation: { ...prev.team_invitation, role: e.target.value }
                            }))}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                          </select>
                        </div>
                        <button
                          type="submit"
                          disabled={inviteTeamMemberMutation.isPending}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          {inviteTeamMemberMutation.isPending ? 'Sending...' : 'Send Invitation'}
                        </button>
                      </form>

                      {inviteTeamMemberMutation.isError && (
                        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                          <p className="text-sm">
                            Failed to send invitation. Please check the email address and try again.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pending Invitations */}
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-medium text-gray-900">Pending Invitations</h2>
                    </div>
                    <div className="px-6 py-6">
                      {pendingInvitationsQuery.isLoading ? (
                        <div className="animate-pulse space-y-4">
                          {[1, 2].map(i => (
                            <div key={i} className="h-12 bg-gray-200 rounded"></div>
                          ))}
                        </div>
                      ) : pendingInvitationsQuery.data?.length === 0 ? (
                        <p className="text-sm text-gray-500">No pending invitations</p>
                      ) : (
                        <div className="space-y-4">
                          {pendingInvitationsQuery.data?.map((invitation) => (
                            <div key={invitation.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{invitation.email}</p>
                                <p className="text-sm text-gray-500">Role: {invitation.role} • Expires: {new Date(invitation.expires_at).toLocaleDateString()}</p>
                              </div>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Pending
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Personal Settings */}
              {currentSection === 'personal' && (
                <div className="bg-white shadow rounded-lg">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-medium text-gray-900">Personal Preferences</h2>
                      {!editMode.personal ? (
                        <button
                          onClick={() => setEditMode(prev => ({ ...prev, personal: true }))}
                          className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-500"
                        >
                          Edit
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditMode(prev => ({ ...prev, personal: false }))}
                          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-500"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="px-6 py-6">
                    {userPreferencesQuery.isLoading ? (
                      <div className="animate-pulse space-y-4">
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div className="h-10 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div className="h-10 bg-gray-200 rounded"></div>
                      </div>
                    ) : editMode.personal ? (
                      <form onSubmit={handleUserPreferencesSubmit} className="space-y-6">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 mb-4">Notifications</h3>
                          <div className="space-y-4">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={formState.personal.email_notifications ?? true}
                                onChange={(e) => setFormState(prev => ({
                                  ...prev,
                                  personal: { ...prev.personal, email_notifications: e.target.checked }
                                }))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label className="ml-3 text-sm text-gray-700">
                                Email notifications
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={formState.personal.in_app_notifications ?? true}
                                onChange={(e) => setFormState(prev => ({
                                  ...prev,
                                  personal: { ...prev.personal, in_app_notifications: e.target.checked }
                                }))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label className="ml-3 text-sm text-gray-700">
                                In-app notifications
                              </label>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Email frequency
                              </label>
                              <select
                                value={formState.personal.email_frequency || 'immediate'}
                                onChange={(e) => setFormState(prev => ({
                                  ...prev,
                                  personal: { ...prev.personal, email_frequency: e.target.value }
                                }))}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="immediate">Immediate</option>
                                <option value="daily">Daily digest</option>
                                <option value="weekly">Weekly digest</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-medium text-gray-900 mb-4">Display Preferences</h3>
                          <div className="space-y-4">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={formState.personal.reduced_motion ?? false}
                                onChange={(e) => setFormState(prev => ({
                                  ...prev,
                                  personal: { ...prev.personal, reduced_motion: e.target.checked }
                                }))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label className="ml-3 text-sm text-gray-700">
                                Reduce motion (accessibility)
                              </label>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Date format
                              </label>
                              <select
                                value={formState.personal.date_format || 'YYYY-MM-DD'}
                                onChange={(e) => setFormState(prev => ({
                                  ...prev,
                                  personal: { ...prev.personal, date_format: e.target.value }
                                }))}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Number format
                              </label>
                              <select
                                value={formState.personal.number_format || 'US'}
                                onChange={(e) => setFormState(prev => ({
                                  ...prev,
                                  personal: { ...prev.personal, number_format: e.target.value }
                                }))}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="US">US (1,234.56)</option>
                                <option value="EU">EU (1.234,56)</option>
                                <option value="UK">UK (1,234.56)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Default dashboard view
                              </label>
                              <select
                                value={formState.personal.default_dashboard_view || 'overview'}
                                onChange={(e) => setFormState(prev => ({
                                  ...prev,
                                  personal: { ...prev.personal, default_dashboard_view: e.target.value }
                                }))}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="overview">Overview</option>
                                <option value="campaigns">Campaigns</option>
                                <option value="creatives">Creatives</option>
                                <option value="analytics">Analytics</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Theme
                              </label>
                              <select
                                value={formState.personal.theme_preference || 'dark'}
                                onChange={(e) => setFormState(prev => ({
                                  ...prev,
                                  personal: { ...prev.personal, theme_preference: e.target.value }
                                }))}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                                <option value="auto">Auto</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={updateUserPreferencesMutation.isPending}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                          >
                            {updateUserPreferencesMutation.isPending ? 'Saving...' : 'Save Preferences'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 mb-4">Notifications</h3>
                          <div className="space-y-2">
                            <p className="text-sm text-gray-600">
                              Email notifications: {userPreferencesQuery.data?.email_notifications ? 'Enabled' : 'Disabled'}
                            </p>
                            <p className="text-sm text-gray-600">
                              In-app notifications: {userPreferencesQuery.data?.in_app_notifications ? 'Enabled' : 'Disabled'}
                            </p>
                            <p className="text-sm text-gray-600">
                              Email frequency: {userPreferencesQuery.data?.email_frequency}
                            </p>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 mb-4">Display Preferences</h3>
                          <div className="space-y-2">
                            <p className="text-sm text-gray-600">
                              Reduced motion: {userPreferencesQuery.data?.reduced_motion ? 'Enabled' : 'Disabled'}
                            </p>
                            <p className="text-sm text-gray-600">
                              Date format: {userPreferencesQuery.data?.date_format}
                            </p>
                            <p className="text-sm text-gray-600">
                              Number format: {userPreferencesQuery.data?.number_format}
                            </p>
                            <p className="text-sm text-gray-600">
                              Default dashboard: {userPreferencesQuery.data?.default_dashboard_view}
                            </p>
                            <p className="text-sm text-gray-600">
                              Theme: {userPreferencesQuery.data?.theme_preference}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {updateUserPreferencesMutation.isError && (
                      <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                        <p className="text-sm">
                          Failed to update preferences. Please try again.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Billing Section (Owner only, placeholder) */}
              {currentSection === 'billing' && userRole === 'owner' && (
                <div className="bg-white shadow rounded-lg">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-medium text-gray-900">Billing</h2>
                  </div>
                  <div className="px-6 py-6">
                    <div className="text-center py-12">
                      <p className="text-gray-500 mb-4">Billing management coming soon</p>
                      <p className="text-sm text-gray-400">
                        Manage your subscription, payment methods, and billing history
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Permission denied message */}
              {((currentSection === 'workspace' && !canManageWorkspace) ||
                (currentSection === 'team' && !canManageTeam) ||
                (currentSection === 'billing' && userRole !== 'owner')) && (
                <div className="bg-white shadow rounded-lg">
                  <div className="px-6 py-12 text-center">
                    <div className="mx-auto h-12 w-12 text-gray-400">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9-7a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Access Restricted</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      You don't have permission to access this section.
                      Contact your workspace owner for access.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_Settings;