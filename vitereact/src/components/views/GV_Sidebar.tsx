import React, { useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import {
  HomeIcon,
  ChartBarIcon,
  MegaphoneIcon,
  PhotoIcon,
  ArrowUpTrayIcon,
  BellIcon,
  Cog6ToothIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  QuestionMarkCircleIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';

// Interface for alert count response
interface AlertCountResponse {
  pagination: {
    total: number;
  };
}

const GV_Sidebar: React.FC = () => {
  // Local state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [helpDropdownOpen, setHelpDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Router hooks
  const location = useLocation();
  const { workspace_id } = useParams<{ workspace_id: string }>();

  // Global state - individual selectors to prevent infinite loops
  const currentWorkspace = useAppStore(state => state.current_workspace);
  const authToken = useAppStore(state => state.authentication_state.auth_token);

  // Determine active page from current route
  const getActivePage = (): string => {
    const path = location.pathname;
    if (path.includes('/channels')) return 'channels';
    if (path.includes('/campaigns')) return 'campaigns';
    if (path.includes('/creatives')) return 'creatives';
    if (path.includes('/uploads') || path.includes('/upload')) return 'uploads';
    if (path.includes('/alerts')) return 'alerts';
    if (path.includes('/settings')) return 'settings';
    return 'overview';
  };

  const activePage = getActivePage();

  // Fetch active alert count
  const { data: alertCountData } = useQuery<AlertCountResponse>({
    queryKey: ['alertCount', workspace_id],
    queryFn: async () => {
      if (!workspace_id || !authToken) {
        throw new Error('Missing workspace or auth token');
      }
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/workspaces/${workspace_id}/alert-triggers`,
        {
          params: {
            is_resolved: 'false',
            limit: 1
          },
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );
      return response.data;
    },
    enabled: !!workspace_id && !!authToken,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1
  });

  const activeAlertCount = alertCountData?.pagination?.total || 0;

  // Navigation items configuration
  const navigationItems = [
    {
      name: 'Overview',
      href: `/w/${workspace_id}`,
      icon: HomeIcon,
      active: activePage === 'overview',
      description: 'Dashboard and KPI overview'
    },
    {
      name: 'Channels',
      href: `/w/${workspace_id}/channels`,
      icon: ChartBarIcon,
      active: activePage === 'channels',
      description: 'Cross-platform comparison'
    },
    {
      name: 'Campaigns',
      href: `/w/${workspace_id}/campaigns`,
      icon: MegaphoneIcon,
      active: activePage === 'campaigns',
      description: 'Campaign management'
    },
    {
      name: 'Creatives',
      href: `/w/${workspace_id}/creatives`,
      icon: PhotoIcon,
      active: activePage === 'creatives',
      description: 'Creative performance'
    },
    {
      name: 'Uploads',
      href: `/w/${workspace_id}/uploads`,
      icon: ArrowUpTrayIcon,
      active: activePage === 'uploads',
      description: 'Data upload management'
    },
    {
      name: 'Alerts',
      href: `/w/${workspace_id}/alerts`,
      icon: BellIcon,
      active: activePage === 'alerts',
      description: 'Alert rules and notifications',
      badge: activeAlertCount > 0 ? activeAlertCount : null
    },
    {
      name: 'Settings',
      href: `/w/${workspace_id}/settings`,
      icon: Cog6ToothIcon,
      active: activePage === 'settings',
      description: 'Workspace and user settings'
    }
  ];

  // Toggle sidebar collapse
  const toggleSidebarCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (helpDropdownOpen) {
        setHelpDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [helpDropdownOpen]);

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={toggleMobileMenu}
          className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          aria-label="Toggle navigation menu"
        >
          {isMobileMenuOpen ? (
            <XMarkIcon className="h-6 w-6" />
          ) : (
            <Bars3Icon className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={toggleMobileMenu}
        />
      )}

      {/* Desktop sidebar */}
      <div className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 bg-white border-r border-gray-200 transition-all duration-300 ${
        isCollapsed ? 'lg:w-16' : 'lg:w-60'
      }`}>
        {/* Logo and workspace section */}
        <div className="flex items-center px-4 py-4 border-b border-gray-200">
          <Link
            to={`/w/${workspace_id}`}
            className="flex items-center space-x-3 text-gray-900 hover:text-blue-600 transition-colors"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="text-lg font-bold">PulseDeck</span>
                {currentWorkspace && (
                  <span className="text-xs text-gray-500 truncate max-w-[150px]">
                    {currentWorkspace.name}
                  </span>
                )}
              </div>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigationItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                  item.active
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
                title={isCollapsed ? item.description : undefined}
              >
                <div className="relative">
                  <IconComponent className={`flex-shrink-0 h-5 w-5 ${
                    item.active ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                  }`} />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                {!isCollapsed && (
                  <div className="ml-3 flex items-center justify-between w-full">
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Help section */}
        <div className="px-2 py-4 border-t border-gray-200">
          <div className="relative">
            <button
              onClick={() => setHelpDropdownOpen(!helpDropdownOpen)}
              className={`group flex items-center w-full px-2 py-2 text-sm font-medium rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors ${
                isCollapsed ? 'justify-center' : ''
              }`}
              title={isCollapsed ? 'Help & Support' : undefined}
            >
              <QuestionMarkCircleIcon className="flex-shrink-0 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
              {!isCollapsed && <span className="ml-3">Help & Support</span>}
            </button>

            {/* Help dropdown */}
            {helpDropdownOpen && !isCollapsed && (
              <div className="absolute bottom-full left-0 w-full mb-1 bg-white border border-gray-200 rounded-md shadow-lg py-1">
                <a
                  href="https://docs.pulsedeck.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Documentation
                </a>
                <a
                  href="mailto:support@pulsedeck.com"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Contact Support
                </a>
                <a
                  href="https://feedback.pulsedeck.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Feature Request
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Collapse button */}
        <div className="px-2 pb-4">
          <button
            onClick={toggleSidebarCollapse}
            className="group flex items-center w-full px-2 py-2 text-sm font-medium rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-500" />
            ) : (
              <>
                <ChevronLeftIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-500" />
                <span className="ml-3">Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile sidebar */}
      <div className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Mobile logo and workspace section */}
        <div className="flex items-center px-4 py-4 border-b border-gray-200">
          <Link
            to={`/w/${workspace_id}`}
            className="flex items-center space-x-3 text-gray-900"
            onClick={toggleMobileMenu}
          >
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold">PulseDeck</span>
              {currentWorkspace && (
                <span className="text-xs text-gray-500 truncate max-w-[150px]">
                  {currentWorkspace.name}
                </span>
              )}
            </div>
          </Link>
        </div>

        {/* Mobile navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigationItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={toggleMobileMenu}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                  item.active
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <div className="relative">
                  <IconComponent className={`flex-shrink-0 h-5 w-5 ${
                    item.active ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                  }`} />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <div className="ml-3 flex items-center justify-between w-full">
                  <span>{item.name}</span>
                  {item.badge && (
                    <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Mobile help section */}
        <div className="px-2 py-4 border-t border-gray-200 space-y-1">
          <a
            href="https://docs.pulsedeck.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <QuestionMarkCircleIcon className="flex-shrink-0 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
            <span className="ml-3">Documentation</span>
          </a>
          <a
            href="mailto:support@pulsedeck.com"
            className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <QuestionMarkCircleIcon className="flex-shrink-0 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
            <span className="ml-3">Contact Support</span>
          </a>
        </div>
      </div>

      {/* Bottom navigation for very small screens */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="grid grid-cols-4 gap-1 px-2 py-2">
          {navigationItems.slice(0, 4).map((item) => {
            const IconComponent = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex flex-col items-center p-2 text-xs font-medium rounded-md transition-colors ${
                  item.active
                    ? 'text-blue-700 bg-blue-50'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <div className="relative">
                  <IconComponent className={`h-5 w-5 ${
                    item.active ? 'text-blue-500' : 'text-gray-400'
                  }`} />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="mt-1 truncate">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom navigation spacer */}
      <div className="sm:hidden h-16" />
    </>
  );
};

export default GV_Sidebar;