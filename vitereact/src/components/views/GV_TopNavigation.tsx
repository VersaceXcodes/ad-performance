import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// Type definitions for API responses
interface WorkspaceResponse {
  workspace: {
    id: string;
    name: string;
    default_currency: string;
    timezone: string;
    created_at: string;
    updated_at: string;
  };
  membership: {
    id: string;
    role: string;
    status: string;
    created_at: string;
  };
}

interface NotificationResponse {
  data: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    priority: string;
    is_read: boolean;
    created_at: string;
  }>;
}



const GV_TopNavigation: React.FC = () => {
  // Local state for dropdown visibility
  const [userProfileDropdownOpen, setUserProfileDropdownOpen] = useState(false);
  const [workspaceSwitcherOpen, setWorkspaceSwitcherOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const [dateRangePickerOpen, setDateRangePickerOpen] = useState(false);
  const [platformFilterOpen, setPlatformFilterOpen] = useState(false);

  // Zustand store selectors - individual selectors to prevent infinite loops
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentWorkspace = useAppStore(state => state.current_workspace);
  const dateRangeFilter = useAppStore(state => state.date_range_filter);
  const platformFilter = useAppStore(state => state.platform_filter);
  const logoutUser = useAppStore(state => state.logout_user);
  const switchWorkspace = useAppStore(state => state.switch_workspace);
  const updateDateRange = useAppStore(state => state.update_date_range);
  const updateComparisonMode = useAppStore(state => state.update_comparison_mode);
  const updatePlatformFilter = useAppStore(state => state.update_platform_filter);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  // API base URL
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Fetch user workspaces
  const { data: availableWorkspaces = [], isLoading: workspacesLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async (): Promise<WorkspaceResponse[]> => {
      const response = await axios.get(`${apiBaseUrl}/api/workspaces`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      return response.data;
    },
    enabled: !!authToken,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Fetch recent notifications
  const { data: notificationsData, refetch: refetchNotifications } = useQuery({
    queryKey: ['notifications', currentWorkspace?.id],
    queryFn: async (): Promise<NotificationResponse> => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');
      
      const response = await axios.get(
        `${apiBaseUrl}/api/workspaces/${currentWorkspace.id}/notifications`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          params: {
            limit: 5,
            sort_by: 'created_at',
            sort_order: 'desc'
          }
        }
      );
      return response.data;
    },
    enabled: !!authToken && !!currentWorkspace?.id,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Workspace switching mutation
  const workspaceSwitchMutation = useMutation({
    mutationFn: async (workspaceId: string) => {
      console.log('[Workspace Switch] Starting switch to:', workspaceId);
      await switchWorkspace(workspaceId);
      console.log('[Workspace Switch] Store updated successfully');
      return workspaceId;
    },
    onSuccess: (workspaceId) => {
      console.log('[Workspace Switch] onSuccess called with:', workspaceId);
      setWorkspaceSwitcherOpen(false);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      
      const currentPath = location.pathname;
      console.log('[Workspace Switch] Current path:', currentPath);
      const pathSegments = currentPath.split('/').filter(Boolean);
      
      let newPath: string;
      if (pathSegments.length >= 2 && pathSegments[0] === 'w') {
        pathSegments[1] = workspaceId;
        newPath = '/' + pathSegments.join('/');
      } else {
        newPath = `/w/${workspaceId}`;
      }
      
      console.log('[Workspace Switch] Navigating to:', newPath);
      navigate(newPath);
      console.log('[Workspace Switch] Navigate called, new location:', window.location.pathname);
    },
    onError: (error) => {
      console.error('[Workspace Switch] Failed to switch workspace:', error);
      setWorkspaceSwitcherOpen(false);
    }
  });

  // Mark notification as read mutation
  const markNotificationReadMutation = useMutation({
    mutationFn: async ({ notificationId }: { notificationId: string }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');
      
      await axios.put(
        `${apiBaseUrl}/api/workspaces/${currentWorkspace.id}/notifications/${notificationId}`,
        {
          is_read: true,
          read_at: new Date().toISOString()
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
    },
    onSuccess: () => {
      refetchNotifications();
    }
  });

  // Calculate unread notification count
  const unreadNotificationCount = notificationsData?.data.filter(n => !n.is_read).length || 0;
  const recentNotifications = notificationsData?.data || [];

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

  // Platform options
  const platformOptions = [
    { id: 'tiktok', name: 'TikTok', color: 'bg-black text-white' },
    { id: 'facebook', name: 'Meta', color: 'bg-blue-600 text-white' },
    { id: 'snapchat', name: 'Snapchat', color: 'bg-yellow-400 text-black' }
  ];

  // Handle workspace switch
  const handleWorkspaceSwitch = (workspaceId: string) => {
    workspaceSwitchMutation.mutate(workspaceId);
  };

  // Handle notification click
  const handleNotificationClick = (notificationId: string) => {
    if (!recentNotifications.find(n => n.id === notificationId)?.is_read) {
      markNotificationReadMutation.mutate({ notificationId });
    }
  };

  // Handle date preset selection
  const handleDatePresetChange = (preset: string) => {
    const today = new Date();
    let dateFrom: string | null = null;
    let dateTo: string | null = null;

    switch (preset) {
      case 'today':
        dateFrom = dateTo = today.toISOString().split('T')[0];
        break;
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        dateFrom = dateTo = yesterday.toISOString().split('T')[0];
        break;
      }
      case 'last_7_days': {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateFrom = weekAgo.toISOString().split('T')[0];
        dateTo = today.toISOString().split('T')[0];
        break;
      }
      case 'last_30_days': {
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        dateFrom = monthAgo.toISOString().split('T')[0];
        dateTo = today.toISOString().split('T')[0];
        break;
      }
      case 'last_90_days': {
        const quarterAgo = new Date(today);
        quarterAgo.setDate(quarterAgo.getDate() - 90);
        dateFrom = quarterAgo.toISOString().split('T')[0];
        dateTo = today.toISOString().split('T')[0];
        break;
      }
      default:
        break;
    }

    updateDateRange(dateFrom, dateTo, preset);
    setDateRangePickerOpen(false);
  };

  // Handle platform toggle
  const handlePlatformToggle = (platformId: string) => {
    const currentPlatforms = platformFilter.selected_platforms;
    const newPlatforms = currentPlatforms.includes(platformId)
      ? currentPlatforms.filter(p => p !== platformId)
      : [...currentPlatforms, platformId];
    
    updatePlatformFilter(newPlatforms, platformFilter.selected_accounts);
  };

  // Handle logout
  const handleLogout = () => {
    logoutUser();
    setUserProfileDropdownOpen(false);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setUserProfileDropdownOpen(false);
      setWorkspaceSwitcherOpen(false);
      setNotificationDropdownOpen(false);
      setDateRangePickerOpen(false);
      setPlatformFilterOpen(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Get user initials
  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Format date range display
  const getDateRangeDisplay = () => {
    if (dateRangeFilter.date_preset && dateRangeFilter.date_preset !== 'custom') {
      const preset = datePresets.find(p => p.value === dateRangeFilter.date_preset);
      return preset?.label || 'Last 30 days';
    }
    if (dateRangeFilter.date_from && dateRangeFilter.date_to) {
      return `${dateRangeFilter.date_from} - ${dateRangeFilter.date_to}`;
    }
    return 'Last 30 days';
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
          {/* Left section - Logo and Workspace Switcher */}
          <div className="flex items-center space-x-4">
            {/* Logo */}
            <Link to={currentWorkspace ? `/w/${currentWorkspace.id}` : '/'} className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">PD</span>
              </div>
              <span className="ml-2 text-xl font-bold text-gray-900 hidden sm:block">PulseDeck</span>
            </Link>

            {/* Workspace Switcher */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setWorkspaceSwitcherOpen(!workspaceSwitcherOpen)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                disabled={workspacesLoading}
              >
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                  <span className="text-white text-xs font-medium">
                    {currentWorkspace?.name.charAt(0).toUpperCase() || 'W'}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-900 hidden md:block">
                  {currentWorkspace?.name || 'Select Workspace'}
                </span>
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Workspace Dropdown */}
              {workspaceSwitcherOpen && (
                <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                  <div className="px-4 py-2 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">Switch Workspace</p>
                  </div>
                  
                  {workspacesLoading ? (
                    <div className="px-4 py-3">
                      <div className="animate-pulse flex space-x-2">
                        <div className="w-6 h-6 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded flex-1"></div>
                      </div>
                    </div>
                  ) : (
                    availableWorkspaces.map((workspace) => (
                      <button
                        key={workspace.workspace.id}
                        onClick={() => handleWorkspaceSwitch(workspace.workspace.id)}
                        className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                          <span className="text-white text-xs font-medium">
                            {workspace.workspace.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-gray-900">{workspace.workspace.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{workspace.membership.role}</p>
                        </div>
                        {currentWorkspace?.id === workspace.workspace.id && (
                          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))
                  )}
                  
                  <div className="border-t border-gray-200 mt-2 pt-2">
                    <Link
                      to="/w/new"
                      className="flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors text-blue-600"
                      onClick={() => setWorkspaceSwitcherOpen(false)}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span className="text-sm font-medium">Create New Workspace</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center section - Controls */}
          <div className="hidden lg:flex items-center space-x-4">
            {/* Date Range Picker */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setDateRangePickerOpen(!dateRangePickerOpen)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-gray-700">{getDateRangeDisplay()}</span>
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Date Range Dropdown */}
              {dateRangePickerOpen && (
                <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                  <div className="px-4 py-2 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">Date Range</p>
                  </div>
                  
                  {datePresets.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => handleDatePresetChange(preset.value)}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors ${
                        dateRangeFilter.date_preset === preset.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      <span className="text-sm">{preset.label}</span>
                    </button>
                  ))}

                  {/* Comparison Mode */}
                  <div className="border-t border-gray-200 mt-2 pt-2 px-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">Compare to:</p>
                    <div className="space-y-1">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="comparison"
                          checked={dateRangeFilter.comparison_mode === 'vs_previous_period'}
                          onChange={() => updateComparisonMode('vs_previous_period')}
                          className="w-3 h-3 text-blue-600"
                        />
                        <span className="ml-2 text-xs text-gray-700">Previous period</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="comparison"
                          checked={dateRangeFilter.comparison_mode === 'vs_same_period_last_year'}
                          onChange={() => updateComparisonMode('vs_same_period_last_year')}
                          className="w-3 h-3 text-blue-600"
                        />
                        <span className="ml-2 text-xs text-gray-700">Same period last year</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="comparison"
                          checked={!dateRangeFilter.comparison_mode}
                          onChange={() => updateComparisonMode(null)}
                          className="w-3 h-3 text-blue-600"
                        />
                        <span className="ml-2 text-xs text-gray-700">No comparison</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Platform Filter */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setPlatformFilterOpen(!platformFilterOpen)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <div className="flex -space-x-1">
                  {platformFilter.selected_platforms.length > 0 ? (
                    platformFilter.selected_platforms.slice(0, 3).map((platformId) => {
                      const platform = platformOptions.find(p => p.id === platformId);
                      return (
                        <div
                          key={platformId}
                          className={`w-5 h-5 rounded-full ${platform?.color || 'bg-gray-400'} flex items-center justify-center text-xs font-medium border-2 border-white`}
                        >
                          {platform?.name.charAt(0)}
                        </div>
                      );
                    })
                  ) : (
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-700">
                  {platformFilter.selected_platforms.length > 0 
                    ? `${platformFilter.selected_platforms.length} platform${platformFilter.selected_platforms.length > 1 ? 's' : ''}`
                    : 'All platforms'
                  }
                </span>
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Platform Filter Dropdown */}
              {platformFilterOpen && (
                <div className="absolute left-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                  <div className="px-4 py-2 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">Platforms</p>
                  </div>
                  
                  {platformOptions.map((platform) => (
                    <button
                      key={platform.id}
                      onClick={() => handlePlatformToggle(platform.id)}
                      className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className={`w-5 h-5 rounded-full ${platform.color} flex items-center justify-center text-xs font-medium`}>
                        {platform.name.charAt(0)}
                      </div>
                      <span className="flex-1 text-left text-sm text-gray-700">{platform.name}</span>
                      {platformFilter.selected_platforms.includes(platform.id) && (
                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right section - Notifications and User Profile */}
          <div className="flex items-center space-x-3">
            {/* Notification Bell */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setNotificationDropdownOpen(!notificationDropdownOpen)}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {notificationDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                  <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">Notifications</p>
                    <Link
                      to={currentWorkspace ? `/w/${currentWorkspace.id}/alerts` : '/alerts'}
                      className="text-xs text-blue-600 hover:text-blue-700"
                      onClick={() => setNotificationDropdownOpen(false)}
                    >
                      View all
                    </Link>
                  </div>
                  
                  {recentNotifications.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      <p className="text-sm text-gray-500">No notifications</p>
                    </div>
                  ) : (
                    recentNotifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification.id)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-l-4 ${
                          notification.is_read 
                            ? 'border-transparent' 
                            : notification.priority === 'urgent' 
                              ? 'border-red-500' 
                              : notification.priority === 'high'
                                ? 'border-orange-500'
                                : 'border-blue-500'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`w-2 h-2 rounded-full mt-2 ${
                            notification.is_read ? 'bg-gray-300' : 'bg-blue-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${notification.is_read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(notification.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* User Profile Dropdown */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setUserProfileDropdownOpen(!userProfileDropdownOpen)}
                className="flex items-center space-x-2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {currentUser ? getUserInitials(currentUser.name) : 'U'}
                  </span>
                </div>
                <svg className="w-4 h-4 text-gray-500 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* User Profile Dropdown */}
              {userProfileDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">{currentUser?.name}</p>
                    <p className="text-xs text-gray-500">{currentUser?.email}</p>
                    {currentWorkspace && (
                      <p className="text-xs text-gray-500 mt-1">
                        {currentWorkspace.name} • {currentWorkspace.role}
                      </p>
                    )}
                  </div>
                  
                  <div className="py-1">
                    <Link
                      to={currentWorkspace ? `/w/${currentWorkspace.id}/settings` : '/settings'}
                      className="flex items-center space-x-3 px-4 py-2 hover:bg-gray-50 transition-colors text-gray-700"
                      onClick={() => setUserProfileDropdownOpen(false)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-sm">Profile Settings</span>
                    </Link>
                    
                    <Link
                      to={currentWorkspace ? `/w/${currentWorkspace.id}/settings` : '/settings'}
                      className="flex items-center space-x-3 px-4 py-2 hover:bg-gray-50 transition-colors text-gray-700"
                      onClick={() => setUserProfileDropdownOpen(false)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm">Workspace Settings</span>
                    </Link>
                    
                    <a
                      href="#"
                      className="flex items-center space-x-3 px-4 py-2 hover:bg-gray-50 transition-colors text-gray-700"
                      onClick={(e) => {
                        e.preventDefault();
                        setUserProfileDropdownOpen(false);
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm">Help & Documentation</span>
                    </a>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-1">
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-3 px-4 py-2 hover:bg-gray-50 transition-colors text-red-600 w-full text-left"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span className="text-sm">Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Controls - Hidden on desktop, shown on mobile when needed */}
        <div className="lg:hidden border-t border-gray-200 px-4 py-3 space-y-3">
          {/* Mobile Date Range */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setDateRangePickerOpen(!dateRangePickerOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-gray-700">{getDateRangeDisplay()}</span>
              </div>
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Mobile Platform Filter */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPlatformFilterOpen(!platformFilterOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <div className="flex -space-x-1">
                  {platformFilter.selected_platforms.length > 0 ? (
                    platformFilter.selected_platforms.slice(0, 3).map((platformId) => {
                      const platform = platformOptions.find(p => p.id === platformId);
                      return (
                        <div
                          key={platformId}
                          className={`w-5 h-5 rounded-full ${platform?.color || 'bg-gray-400'} flex items-center justify-center text-xs font-medium border-2 border-white`}
                        >
                          {platform?.name.charAt(0)}
                        </div>
                      );
                    })
                  ) : (
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-700">
                  {platformFilter.selected_platforms.length > 0 
                    ? `${platformFilter.selected_platforms.length} platform${platformFilter.selected_platforms.length > 1 ? 's' : ''}`
                    : 'All platforms'
                  }
                </span>
              </div>
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </header>
    </>
  );
};

export default GV_TopNavigation;