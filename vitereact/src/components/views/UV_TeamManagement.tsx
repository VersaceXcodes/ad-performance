import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { 
  Users, 
  UserPlus, 
  Settings, 
  Shield, 
  Activity, 
  Mail, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  Download, 
  Filter, 
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  FileText
} from 'lucide-react';

// ========================
// TYPE DEFINITIONS
// ========================

interface TeamMember {
  membership: {
    id: string;
    user_id: string;
    workspace_id: string;
    role: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
  user: {
    id: string;
    email: string;
    name: string;
    created_at: string;
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
  created_at: string;
}

interface AuditLog {
  id: string;
  workspace_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, any>;
  created_at: string;
}

interface InvitationFormData {
  email: string;
  role: string;
  is_submitting: boolean;
  validation_errors: {
    email?: string;
    role?: string;
  };
}

interface LoadingStates {
  members: boolean;
  invitations: boolean;
  audit_logs: boolean;
  updating_role: boolean;
  removing_member: boolean;
  sending_invitation: boolean;
}

// ========================
// API FUNCTIONS
// ========================

const getApiBaseUrl = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const fetchTeamMembers = async (workspaceId: string, authToken: string, memberFilter?: string) => {
  const params = new URLSearchParams();
  if (memberFilter) params.append('member_filter', memberFilter);
  
  const response = await axios.get(
    `${getApiBaseUrl()}/api/workspaces/${workspaceId}/members?${params.toString()}`,
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  return response.data;
};

const fetchPendingInvitations = async (workspaceId: string, authToken: string) => {
  const response = await axios.get(
    `${getApiBaseUrl()}/api/workspaces/${workspaceId}/invitations`,
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  return response.data;
};

const fetchAuditLogs = async (workspaceId: string, authToken: string) => {
  const response = await axios.get(
    `${getApiBaseUrl()}/api/workspaces/${workspaceId}/audit-logs?limit=50&sort_by=created_at&sort_order=desc`,
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  return response.data;
};

const inviteMember = async (workspaceId: string, authToken: string, email: string, role: string) => {
  const response = await axios.post(
    `${getApiBaseUrl()}/api/workspaces/${workspaceId}/invitations`,
    { email, role },
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  return response.data;
};

const updateMemberRole = async (workspaceId: string, memberId: string, authToken: string, role: string) => {
  const response = await axios.put(
    `${getApiBaseUrl()}/api/workspaces/${workspaceId}/members/${memberId}`,
    { role },
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  return response.data;
};

const removeMember = async (workspaceId: string, memberId: string, authToken: string) => {
  await axios.delete(
    `${getApiBaseUrl()}/api/workspaces/${workspaceId}/members/${memberId}`,
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
};

const exportTeamData = async (workspaceId: string, authToken: string, format: string) => {
  const response = await axios.post(
    `${getApiBaseUrl()}/api/workspaces/${workspaceId}/exports`,
    { export_type: 'team_members', format },
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  return response.data;
};

// ========================
// MAIN COMPONENT
// ========================

const UV_TeamManagement: React.FC = () => {
  const { workspace_id } = useParams<{ workspace_id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Global state - using individual selectors to prevent infinite loops
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentWorkspace = useAppStore(state => state.current_workspace);
  const addToastNotification = useAppStore(state => state.add_toast_notification);

  // Local state
  const [invitationForm, setInvitationForm] = useState<InvitationFormData>({
    email: '',
    role: 'member',
    is_submitting: false,
    validation_errors: {}
  });

  const [memberFilter, setMemberFilter] = useState<string | null>(
    searchParams.get('member_filter')
  );

  const [selectedMember, setSelectedMember] = useState<{
    membership_id: string;
    current_role: string;
    new_role: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'audit' | 'activity'>('members');
  const [searchQuery, setSearchQuery] = useState('');

  // Current user role for permission checks
  const currentUserRole = currentWorkspace?.role || 'member';
  const canManageTeam = currentUserRole === 'owner' || currentUserRole === 'admin';

  // ========================
  // REACT QUERY HOOKS
  // ========================

  const { data: teamMembers = [], isLoading: membersLoading, refetch: refetchMembers } = useQuery({
    queryKey: ['teamMembers', workspace_id, memberFilter],
    queryFn: () => fetchTeamMembers(workspace_id!, authToken!, memberFilter || undefined),
    enabled: !!workspace_id && !!authToken,
    staleTime: 60000
  });

  const { data: pendingInvitations = [], isLoading: invitationsLoading, refetch: refetchInvitations } = useQuery({
    queryKey: ['pendingInvitations', workspace_id],
    queryFn: () => fetchPendingInvitations(workspace_id!, authToken!),
    enabled: !!workspace_id && !!authToken,
    staleTime: 30000
  });

  const { data: auditLogsData, isLoading: auditLoading } = useQuery({
    queryKey: ['auditLogs', workspace_id],
    queryFn: () => fetchAuditLogs(workspace_id!, authToken!),
    enabled: !!workspace_id && !!authToken && activeTab === 'audit',
    staleTime: 30000
  });

  const auditLogs = auditLogsData?.data || [];

  // ========================
  // MUTATIONS
  // ========================

  const inviteMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      inviteMember(workspace_id!, authToken!, email, role),
    onSuccess: () => {
      addToastNotification({
        type: 'success',
        message: 'Team member invited successfully',
        auto_dismiss: true
      });
      setInvitationForm({
        email: '',
        role: 'member',
        is_submitting: false,
        validation_errors: {}
      });
      refetchInvitations();
    },
    onError: (error: any) => {
      addToastNotification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to send invitation',
        auto_dismiss: true
      });
      setInvitationForm(prev => ({ ...prev, is_submitting: false }));
    }
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      updateMemberRole(workspace_id!, memberId, authToken!, role),
    onSuccess: () => {
      addToastNotification({
        type: 'success',
        message: 'Member role updated successfully',
        auto_dismiss: true
      });
      setSelectedMember(null);
      refetchMembers();
    },
    onError: (error: any) => {
      addToastNotification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update member role',
        auto_dismiss: true
      });
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => removeMember(workspace_id!, memberId, authToken!),
    onSuccess: () => {
      addToastNotification({
        type: 'success',
        message: 'Member removed successfully',
        auto_dismiss: true
      });
      refetchMembers();
    },
    onError: (error: any) => {
      addToastNotification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to remove member',
        auto_dismiss: true
      });
    }
  });

  const exportMutation = useMutation({
    mutationFn: (format: string) => exportTeamData(workspace_id!, authToken!, format),
    onSuccess: () => {
      addToastNotification({
        type: 'success',
        message: 'Team data export started',
        auto_dismiss: true
      });
    },
    onError: (error: any) => {
      addToastNotification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to export team data',
        auto_dismiss: true
      });
    }
  });

  // ========================
  // EVENT HANDLERS
  // ========================

  const validateInvitationForm = () => {
    const errors: { email?: string; role?: string } = {};

    if (!invitationForm.email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitationForm.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!invitationForm.role) {
      errors.role = 'Role selection is required';
    }

    setInvitationForm(prev => ({ ...prev, validation_errors: errors }));
    return Object.keys(errors).length === 0;
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateInvitationForm()) return;

    setInvitationForm(prev => ({ ...prev, is_submitting: true }));
    inviteMutation.mutate({
      email: invitationForm.email,
      role: invitationForm.role
    });
  };

  const handleRoleChange = (memberId: string, currentRole: string, newRole: string) => {
    setSelectedMember({
      membership_id: memberId,
      current_role: currentRole,
      new_role: newRole
    });
  };

  const confirmRoleChange = () => {
    if (selectedMember) {
      updateRoleMutation.mutate({
        memberId: selectedMember.membership_id,
        role: selectedMember.new_role
      });
    }
  };

  const handleMemberRemove = (memberId: string, memberName: string) => {
    if (window.confirm(`Are you sure you want to remove ${memberName} from the workspace?`)) {
      removeMemberMutation.mutate(memberId);
    }
  };

  const handleFilterChange = (filter: string | null) => {
    setMemberFilter(filter);
    const newSearchParams = new URLSearchParams(searchParams);
    if (filter) {
      newSearchParams.set('member_filter', filter);
    } else {
      newSearchParams.delete('member_filter');
    }
    setSearchParams(newSearchParams);
  };

  const handleExport = (format: 'csv' | 'xlsx') => {
    exportMutation.mutate(format);
  };

  // ========================
  // UTILITY FUNCTIONS
  // ========================

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-blue-100 text-blue-800';
      case 'member': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="size-4 text-green-500" />;
      case 'pending': return <Clock className="size-4 text-yellow-500" />;
      case 'inactive': return <XCircle className="size-4 text-red-500" />;
      default: return <Clock className="size-4 text-gray-500" />;
    }
  };

  const filteredMembers = teamMembers.filter((member: TeamMember) =>
    member.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ========================
  // RENDER HELPER FUNCTIONS
  // ========================

  const renderRolePermissions = () => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <Shield className="size-5 mr-2 text-blue-600" />
        Role Permissions Matrix
      </h3>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Permission
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Owner
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Admin
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Member
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">View workspace data</td>
              <td className="px-6 py-4 whitespace-nowrap text-center"><CheckCircle className="size-4 text-green-500 mx-auto" /></td>
              <td className="px-6 py-4 whitespace-nowrap text-center"><CheckCircle className="size-4 text-green-500 mx-auto" /></td>
              <td className="px-6 py-4 whitespace-nowrap text-center"><CheckCircle className="size-4 text-green-500 mx-auto" /></td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Upload data files</td>
              <td className="px-6 py-4 whitespace-nowrap text-center"><CheckCircle className="size-4 text-green-500 mx-auto" /></td>
              <td className="px-6 py-4 whitespace-nowrap text-center"><CheckCircle className="size-4 text-green-500 mx-auto" /></td>
              <td className="px-6 py-4 whitespace-nowrap text-center"><CheckCircle className="size-4 text-green-500 mx-auto" /></td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Create and manage alerts</td>
              <td className="px-6 py-4 whitespace-nowrap text-center"><CheckCircle className="size-4 text-green-500 mx-auto" /></td>
              <td className="px-6 py-4 whitespace-nowrap text-center"><CheckCircle className="size-4 text-green-500 mx-auto" /></td>
              <td className="px-6 py-4 whitespace-nowrap text-center"><XCircle className="size-4 text-red-500 mx-auto" /></td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Manage team members</td>
              <td className="px-6 py-4 whitespace-nowrap text-center"><CheckCircle className="size-4 text-green-500 mx-auto" /></td>
              <td className="px-6 py-4 whitespace-nowrap text-center"><CheckCircle className="size-4 text-green-500 mx-auto" /></td>
              <td className="px-6 py-4 whitespace-nowrap text-center"><XCircle className="size-4 text-red-500 mx-auto" /></td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Workspace settings</td>
              <td className="px-6 py-4 whitespace-nowrap text-center"><CheckCircle className="size-4 text-green-500 mx-auto" /></td>
              <td className="px-6 py-4 whitespace-nowrap text-center"><XCircle className="size-4 text-red-500 mx-auto" /></td>
              <td className="px-6 py-4 whitespace-nowrap text-center"><XCircle className="size-4 text-red-500 mx-auto" /></td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Delete workspace</td>
              <td className="px-6 py-4 whitespace-nowrap text-center"><CheckCircle className="size-4 text-green-500 mx-auto" /></td>
              <td className="px-6 py-4 whitespace-nowrap text-center"><XCircle className="size-4 text-red-500 mx-auto" /></td>
              <td className="px-6 py-4 whitespace-nowrap text-center"><XCircle className="size-4 text-red-500 mx-auto" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  // ========================
  // MAIN RENDER
  // ========================

  if (!canManageTeam) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <AlertTriangle className="size-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
            <p className="text-gray-600 mb-6">
              You need Admin or Owner permissions to access team management.
            </p>
            <Link
              to={`/w/${workspace_id}/settings`}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Settings
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
            <div className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <nav className="flex space-x-2 text-sm text-gray-500 mb-2">
                    <Link to={`/w/${workspace_id}`} className="hover:text-gray-700">
                      Dashboard
                    </Link>
                    <span>→</span>
                    <Link to={`/w/${workspace_id}/settings`} className="hover:text-gray-700">
                      Settings
                    </Link>
                    <span>→</span>
                    <span className="text-gray-900">Team Management</span>
                  </nav>
                  <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                    <Users className="size-8 mr-3 text-blue-600" />
                    Team Management
                  </h1>
                  <p className="text-gray-600 mt-2">
                    Manage team members, roles, and permissions for your workspace
                  </p>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleExport('csv')}
                    disabled={exportMutation.isPending}
                    className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <Download className="size-4 mr-2" />
                    Export CSV
                  </button>
                  <button
                    onClick={() => handleExport('xlsx')}
                    disabled={exportMutation.isPending}
                    className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <Download className="size-4 mr-2" />
                    Export Excel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-8">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('members')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'members'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="size-4 inline mr-2" />
                Team Members ({teamMembers.length})
              </button>
              <button
                onClick={() => setActiveTab('invitations')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'invitations'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Mail className="size-4 inline mr-2" />
                Pending Invitations ({pendingInvitations.length})
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'audit'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FileText className="size-4 inline mr-2" />
                Audit Log
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'activity'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Activity className="size-4 inline mr-2" />
                Permissions
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'members' && (
            <div className="space-y-8">
              {/* Invite New Member Form */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <UserPlus className="size-5 mr-2 text-blue-600" />
                  Invite New Team Member
                </h3>
                
                <form onSubmit={handleInviteSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={invitationForm.email}
                      onChange={(e) => {
                        setInvitationForm(prev => ({
                          ...prev,
                          email: e.target.value,
                          validation_errors: { ...prev.validation_errors, email: undefined }
                        }));
                      }}
                      placeholder="colleague@company.com"
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-colors ${
                        invitationForm.validation_errors.email
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                          : 'border-gray-300'
                      }`}
                    />
                    {invitationForm.validation_errors.email && (
                      <p className="mt-1 text-sm text-red-600">{invitationForm.validation_errors.email}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                      Role
                    </label>
                    <select
                      id="role"
                      value={invitationForm.role}
                      onChange={(e) => {
                        setInvitationForm(prev => ({
                          ...prev,
                          role: e.target.value,
                          validation_errors: { ...prev.validation_errors, role: undefined }
                        }));
                      }}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-colors ${
                        invitationForm.validation_errors.role
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                          : 'border-gray-300'
                      }`}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      {currentUserRole === 'owner' && <option value="owner">Owner</option>}
                    </select>
                    {invitationForm.validation_errors.role && (
                      <p className="mt-1 text-sm text-red-600">{invitationForm.validation_errors.role}</p>
                    )}
                  </div>
                  
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={invitationForm.is_submitting || inviteMutation.isPending}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {invitationForm.is_submitting || inviteMutation.isPending ? (
                        <span className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Sending...
                        </span>
                      ) : (
                        'Send Invitation'
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Team Members List */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Team Members ({filteredMembers.length})
                    </h3>
                    
                    <div className="flex items-center space-x-4">
                      {/* Search */}
                      <div className="relative">
                        <Search className="size-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search members..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-colors"
                        />
                      </div>
                      
                      {/* Filter */}
                      <select
                        value={memberFilter || ''}
                        onChange={(e) => handleFilterChange(e.target.value || null)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-colors"
                      >
                        <option value="">All Roles</option>
                        <option value="owner">Owners</option>
                        <option value="admin">Admins</option>
                        <option value="member">Members</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {membersLoading ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading team members...</p>
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Member
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Role
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Joined
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredMembers.map((member: TeamMember) => (
                          <tr key={member.membership.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                    <span className="text-sm font-medium text-blue-800">
                                      {member.user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                    </span>
                                  </div>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {member.user.name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {member.user.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(member.membership.role)}`}>
                                {member.membership.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {getStatusIcon(member.membership.status)}
                                <span className="ml-2 text-sm text-gray-900 capitalize">
                                  {member.membership.status}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(member.membership.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end space-x-2">
                                {member.membership.role !== 'owner' && (
                                  <>
                                    <select
                                      value={member.membership.role}
                                      onChange={(e) => handleRoleChange(
                                        member.membership.id,
                                        member.membership.role,
                                        e.target.value
                                      )}
                                      className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      disabled={updateRoleMutation.isPending}
                                    >
                                      <option value="member">Member</option>
                                      <option value="admin">Admin</option>
                                      {currentUserRole === 'owner' && <option value="owner">Owner</option>}
                                    </select>
                                    <button
                                      onClick={() => handleMemberRemove(member.membership.id, member.user.name)}
                                      className="text-red-600 hover:text-red-900 transition-colors"
                                      disabled={removeMemberMutation.isPending}
                                    >
                                      <Trash2 className="size-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'invitations' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Pending Invitations ({pendingInvitations.length})
                </h3>
              </div>

              <div className="overflow-x-auto">
                {invitationsLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading invitations...</p>
                  </div>
                ) : pendingInvitations.length === 0 ? (
                  <div className="p-8 text-center">
                    <Mail className="size-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No pending invitations</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sent
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Expires
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pendingInvitations.map((invitation: PendingInvitation) => (
                        <tr key={invitation.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {invitation.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(invitation.role)}`}>
                              {invitation.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              {invitation.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(invitation.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(invitation.expires_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Team Activity Audit Log
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Track team member actions and changes for compliance and security
                </p>
              </div>

              <div className="overflow-x-auto">
                {auditLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading audit logs...</p>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="p-8 text-center">
                    <FileText className="size-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No audit logs found</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Timestamp
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Entity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {auditLogs.map((log: AuditLog) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {log.user_id || 'System'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {log.action}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {log.entity_type} {log.entity_id && `(${log.entity_id})`}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {log.details ? JSON.stringify(log.details) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'activity' && renderRolePermissions()}
        </div>

        {/* Role Change Confirmation Modal */}
        {selectedMember && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Confirm Role Change
              </h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to change this member's role from{' '}
                <span className="font-medium">{selectedMember.current_role}</span> to{' '}
                <span className="font-medium">{selectedMember.new_role}</span>?
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setSelectedMember(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={updateRoleMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRoleChange}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  disabled={updateRoleMutation.isPending}
                >
                  {updateRoleMutation.isPending ? (
                    <span className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </span>
                  ) : (
                    'Confirm Change'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_TeamManagement;