import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Heart, Clock, Zap } from 'lucide-react';
import { useAppStore } from '@/store/main';
import axios from 'axios';

interface ApiStatus {
  status: string;
  last_check: string;
  response_time: number;
}

interface AppVersion {
  version: string;
  build: string;
  release_date: string;
}

const GV_Footer: React.FC = () => {
  // Global state access - individual selectors to prevent infinite loops
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const authToken = useAppStore(state => state.authentication_state.auth_token);

  // Local state for component data
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
    status: 'unknown',
    last_check: '',
    response_time: 0
  });

  const [appVersion] = useState<AppVersion>({
    version: '1.0.0',
    build: import.meta.env.VITE_BUILD_ID || 'development',
    release_date: '2024-01-15'
  });

  // API status check using React Query
  const { data: apiHealthData, isError: isApiError } = useQuery({
    queryKey: ['api-status-check'],
    queryFn: async () => {
      const startTime = performance.now();
      
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/me`,
          {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
            timeout: 10000
          }
        );
        
        const responseTime = performance.now() - startTime;
        
        return {
          status: response.status === 200 ? 'operational' : 'degraded',
          response_time: Math.round(responseTime),
          last_check: new Date().toISOString()
        };
      } catch (error) {
        const responseTime = performance.now() - startTime;
        
        // If not authenticated, API returning 401 is still "operational"
        if (axios.isAxiosError(error) && error.response?.status === 401 && !authToken) {
          return {
            status: 'operational',
            response_time: Math.round(responseTime),
            last_check: new Date().toISOString()
          };
        }
        
        return {
          status: 'degraded',
          response_time: Math.round(responseTime),
          last_check: new Date().toISOString()
        };
      }
    },
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 4 * 60 * 1000, // 4 minutes
    retry: 1,
    refetchOnWindowFocus: false
  });

  // Update api status when query data changes
  useEffect(() => {
    if (apiHealthData) {
      setApiStatus(apiHealthData);
    }
  }, [apiHealthData]);

  // Handle external link opening
  const openExternalLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Get status indicator color and text
  const getStatusIndicator = () => {
    switch (apiStatus.status) {
      case 'operational':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          dotColor: 'bg-green-600',
          text: 'Operational'
        };
      case 'degraded':
        return {
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          dotColor: 'bg-yellow-600',
          text: 'Degraded'
        };
      default:
        return {
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          dotColor: 'bg-gray-600',
          text: 'Unknown'
        };
    }
  };

  const statusIndicator = getStatusIndicator();

  return (
    <>
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Main Footer Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            
            {/* Support Links */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                Support
              </h3>
              <ul className="space-y-3">
                <li>
                  <button
                    onClick={() => openExternalLink('https://docs.pulsedeck.com')}
                    className="text-gray-600 hover:text-gray-900 text-sm flex items-center group transition-colors"
                  >
                    Help Center
                    <ExternalLink className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openExternalLink('mailto:support@pulsedeck.com')}
                    className="text-gray-600 hover:text-gray-900 text-sm flex items-center group transition-colors"
                  >
                    Contact Support
                    <ExternalLink className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openExternalLink('https://feedback.pulsedeck.com')}
                    className="text-gray-600 hover:text-gray-900 text-sm flex items-center group transition-colors"
                  >
                    Feature Requests
                    <ExternalLink className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openExternalLink('https://status.pulsedeck.com')}
                    className="text-gray-600 hover:text-gray-900 text-sm flex items-center group transition-colors"
                  >
                    System Status
                    <ExternalLink className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </li>
              </ul>
            </div>

            {/* Legal Links */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                Legal
              </h3>
              <ul className="space-y-3">
                <li>
                  <button
                    onClick={() => openExternalLink('https://pulsedeck.com/privacy')}
                    className="text-gray-600 hover:text-gray-900 text-sm flex items-center group transition-colors"
                  >
                    Privacy Policy
                    <ExternalLink className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openExternalLink('https://pulsedeck.com/terms')}
                    className="text-gray-600 hover:text-gray-900 text-sm flex items-center group transition-colors"
                  >
                    Terms of Service
                    <ExternalLink className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openExternalLink('https://pulsedeck.com/cookies')}
                    className="text-gray-600 hover:text-gray-900 text-sm flex items-center group transition-colors"
                  >
                    Cookie Policy
                    <ExternalLink className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openExternalLink('https://pulsedeck.com/gdpr')}
                    className="text-gray-600 hover:text-gray-900 text-sm flex items-center group transition-colors"
                  >
                    GDPR Information
                    <ExternalLink className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </li>
              </ul>
            </div>

            {/* Application Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                Application
              </h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center">
                  <Zap className="h-4 w-4 mr-2 text-blue-600" />
                  <span>Version {appVersion.version}</span>
                </div>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-gray-500" />
                  <span>Released {appVersion.release_date}</span>
                </div>
                <div className="flex items-center">
                  <div className={`h-2 w-2 rounded-full mr-2 ${statusIndicator.dotColor}`}></div>
                  <span className={statusIndicator.color}>
                    API {statusIndicator.text}
                  </span>
                </div>
                {apiStatus.response_time > 0 && (
                  <div className="text-xs text-gray-500">
                    Response: {apiStatus.response_time}ms
                  </div>
                )}
              </div>
            </div>

            {/* Social & Resources */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                Resources
              </h3>
              <ul className="space-y-3">
                <li>
                  <button
                    onClick={() => openExternalLink('https://docs.pulsedeck.com/api')}
                    className="text-gray-600 hover:text-gray-900 text-sm flex items-center group transition-colors"
                  >
                    API Documentation
                    <ExternalLink className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openExternalLink('https://community.pulsedeck.com')}
                    className="text-gray-600 hover:text-gray-900 text-sm flex items-center group transition-colors"
                  >
                    Community Forum
                    <ExternalLink className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openExternalLink('https://github.com/pulsedeck')}
                    className="text-gray-600 hover:text-gray-900 text-sm flex items-center group transition-colors"
                  >
                    Developer Resources
                    <ExternalLink className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openExternalLink('https://twitter.com/pulsedeck')}
                    className="text-gray-600 hover:text-gray-900 text-sm flex items-center group transition-colors"
                  >
                    Follow Updates
                    <ExternalLink className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center space-y-4 md:space-y-0">
              
              {/* Copyright */}
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>© 2024 PulseDeck Analytics.</span>
                <span className="hidden sm:inline">All rights reserved.</span>
                <Heart className="h-4 w-4 text-red-500 ml-1" />
              </div>

              {/* Build Information - Only show to authenticated users */}
              {isAuthenticated && (
                <div className="text-xs text-gray-500 space-x-3">
                  <span>Build: {appVersion.build}</span>
                  {apiStatus.last_check && (
                    <span>
                      Last health check: {new Date(apiStatus.last_check).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default GV_Footer;