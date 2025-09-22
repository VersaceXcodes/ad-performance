import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

interface CreateDemoWorkspaceResponse {
  workspace: {
    id: string;
    name: string;
  };
}

const UV_EmptyState: React.FC = () => {
  const navigate = useNavigate();
  const { workspace_id } = useParams<{ workspace_id: string }>();
  const [isCreatingDemo, setIsCreatingDemo] = useState(false);

  // Zustand state selectors (individual selectors to prevent infinite loops)
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const updateWorkspaceContext = useAppStore(state => state.update_workspace_context);
  const addToastNotification = useAppStore(state => state.add_toast_notification);

  // Demo workspace creation mutation
  const createDemoWorkspaceMutation = useMutation({
    mutationFn: async (): Promise<CreateDemoWorkspaceResponse> => {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/workspaces`,
        {
          name: `${currentUser?.name || 'Demo'} Workspace`,
          default_currency: 'USD',
          timezone: 'UTC',
          data_retention_days: 730
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Update workspace context
      updateWorkspaceContext({
        id: data.workspace.id,
        name: data.workspace.name,
        role: 'owner',
        created_at: new Date().toISOString()
      });

      // Show success notification
      addToastNotification({
        type: 'success',
        message: 'Demo workspace created successfully! Exploring sample data...',
        auto_dismiss: true
      });

      // Navigate to the new workspace
      navigate(`/w/${data.workspace.id}`);
    },
    onError: (error: any) => {
      console.error('Demo workspace creation failed:', error);
      addToastNotification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to create demo workspace. Please try again.',
        auto_dismiss: true
      });
      setIsCreatingDemo(false);
    }
  });

  const handleCreateDemo = async () => {
    setIsCreatingDemo(true);
    createDemoWorkspaceMutation.mutate();
  };

  const handleDownloadSample = (platform: string) => {
    // Create sample CSV content based on platform
    const sampleData = {
      tiktok: `Date,Campaign Name,Ad Group,Ad Name,Impressions,Clicks,Spend,Conversions,Revenue
2023-11-01,Black Friday Campaign,Audience 1,Video Ad 1,50000,2500,250.00,125,1250.00
2023-11-02,Black Friday Campaign,Audience 1,Video Ad 1,45000,2200,220.00,110,1100.00`,
      meta: `Date,Campaign Name,Ad Set Name,Ad Name,Impressions,Clicks,Amount Spent,Purchases,Purchase ROAS
2023-11-01,Holiday Sale,Interest Targeting,Carousel Ad,60000,3000,300.00,150,1500.00
2023-11-02,Holiday Sale,Interest Targeting,Carousel Ad,55000,2750,275.00,140,1400.00`,
      snapchat: `Date,Campaign,Ad Squad,Ad,Impressions,Swipes,Spend,Purchases,Revenue
2023-11-01,Winter Collection,Lookalike Audience,Story Ad,40000,2000,200.00,100,1000.00
2023-11-02,Winter Collection,Lookalike Audience,Story Ad,38000,1900,190.00,95,950.00`
    };

    const content = sampleData[platform as keyof typeof sampleData];
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample_${platform}_data.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addToastNotification({
      type: 'success',
      message: `Sample ${platform.charAt(0).toUpperCase() + platform.slice(1)} data downloaded!`,
      auto_dismiss: true
    });
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Welcome to PulseDeck,{' '}
                <span className="text-blue-600">{currentUser?.name || 'there'}!</span>
              </h1>
              <p className="mt-6 text-xl md:text-2xl text-gray-600 leading-relaxed max-w-4xl mx-auto">
                Your unified cross-platform analytics dashboard is ready. Get insights from TikTok, Meta, and Snapchat campaigns all in one place.
              </p>
              
              {/* Value Proposition */}
              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                <div className="text-center">
                  <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Unified Analytics</h3>
                  <p className="text-gray-600">Compare performance across all platforms in one dashboard</p>
                </div>
                <div className="text-center">
                  <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Real-time Insights</h3>
                  <p className="text-gray-600">Get automated insights and anomaly detection</p>
                </div>
                <div className="text-center">
                  <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Save Time & Money</h3>
                  <p className="text-gray-600">Zero-to-insights in under 60 seconds</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Actions */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            
            {/* Upload Your First File */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-200">
              <div className="p-8">
                <div className="text-center mb-6">
                  <div className="bg-blue-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Your First File</h2>
                  <p className="text-gray-600">Import your campaign data and start analyzing performance</p>
                </div>

                {/* Upload Preview */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-6 bg-gray-50">
                  <div className="text-center">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-gray-600 mb-2">Drag and drop your files here</p>
                    <p className="text-xs text-gray-500">Supports CSV, XLSX files up to 50MB</p>
                  </div>
                </div>

                {/* Supported Platforms */}
                <div className="mb-6">
                  <p className="text-sm font-medium text-gray-700 mb-3">Supported Platforms:</p>
                  <div className="flex justify-center space-x-6">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center mb-2">
                        <span className="text-white font-bold text-lg">T</span>
                      </div>
                      <p className="text-xs text-gray-600">TikTok</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-2">
                        <span className="text-white font-bold text-lg">f</span>
                      </div>
                      <p className="text-xs text-gray-600">Meta</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-yellow-400 rounded-lg flex items-center justify-center mb-2">
                        <span className="text-white font-bold text-lg">S</span>
                      </div>
                      <p className="text-xs text-gray-600">Snapchat</p>
                    </div>
                  </div>
                </div>

                <Link
                  to={`/w/${workspace_id || 'default'}/upload`}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-xl text-center block"
                >
                  Start Upload Process
                </Link>
              </div>
            </div>

            {/* Load Demo Workspace */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-200">
              <div className="p-8">
                <div className="text-center mb-6">
                  <div className="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Load Demo Workspace</h2>
                  <p className="text-gray-600">Explore PulseDeck with realistic sample data</p>
                </div>

                {/* Demo Features */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-start space-x-3">
                    <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                      <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">90 Days of Realistic Data</p>
                      <p className="text-xs text-gray-600">Complete campaign performance history</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                      <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Multi-Platform Campaigns</p>
                      <p className="text-xs text-gray-600">TikTok, Meta, and Snapchat data</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                      <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Seasonal Variations</p>
                      <p className="text-xs text-gray-600">Black Friday, holiday trends included</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                      <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Ready-to-Explore Insights</p>
                      <p className="text-xs text-gray-600">Anomalies, trends, and recommendations</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCreateDemo}
                  disabled={isCreatingDemo}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isCreatingDemo ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating Demo Workspace...
                    </span>
                  ) : (
                    'Load Demo Workspace'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Getting Started Guide */}
        <div className="bg-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Getting Started in 3 Easy Steps</h2>
              <p className="text-xl text-gray-600">From zero to insights in under 60 seconds</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 font-bold text-lg">1</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Upload or Demo</h3>
                <p className="text-gray-600">Choose to upload your own data or explore with our demo workspace</p>
                <p className="text-sm text-blue-600 mt-2">~ 30 seconds</p>
              </div>
              <div className="text-center">
                <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 font-bold text-lg">2</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Review & Map</h3>
                <p className="text-gray-600">Our intelligent system maps your data columns automatically</p>
                <p className="text-sm text-blue-600 mt-2">~ 15 seconds</p>
              </div>
              <div className="text-center">
                <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 font-bold text-lg">3</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Analyze & Optimize</h3>
                <p className="text-gray-600">Get instant insights, comparisons, and performance recommendations</p>
                <p className="text-sm text-blue-600 mt-2">~ 15 seconds</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sample Files Section */}
        <div className="bg-gray-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Download Sample Files</h2>
              <p className="text-xl text-gray-600">Test PulseDeck with example data from each platform</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <div className="w-16 h-16 bg-black rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-2xl">T</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">TikTok Sample</h3>
                <p className="text-sm text-gray-600 mb-4">Example TikTok Ads Manager export with campaign, ad group, and performance data</p>
                <button
                  onClick={() => handleDownloadSample('tiktok')}
                  className="bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  Download CSV
                </button>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-2xl">f</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Meta Sample</h3>
                <p className="text-sm text-gray-600 mb-4">Example Facebook/Instagram Ads Manager export with complete metrics</p>
                <button
                  onClick={() => handleDownloadSample('meta')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Download CSV
                </button>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <div className="w-16 h-16 bg-yellow-400 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-2xl">S</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Snapchat Sample</h3>
                <p className="text-sm text-gray-600 mb-4">Example Snapchat Ads Manager export with campaign and performance data</p>
                <button
                  onClick={() => handleDownloadSample('snapchat')}
                  className="bg-yellow-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-yellow-600 transition-colors"
                >
                  Download CSV
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Help Resources */}
        <div className="bg-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Need Help Getting Started?</h2>
              <p className="text-xl text-gray-600">We're here to support your analytics journey</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <a
                href="#"
                className="bg-gray-50 rounded-lg p-6 text-center hover:shadow-md transition-all duration-200 hover:scale-105"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.832 18.477 19.246 18 17.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Documentation</h3>
                <p className="text-sm text-gray-600">Complete guides and tutorials</p>
              </a>

              <a
                href="#"
                className="bg-gray-50 rounded-lg p-6 text-center hover:shadow-md transition-all duration-200 hover:scale-105"
              >
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Video Tutorials</h3>
                <p className="text-sm text-gray-600">Step-by-step video guides</p>
              </a>

              <a
                href="#"
                className="bg-gray-50 rounded-lg p-6 text-center hover:shadow-md transition-all duration-200 hover:scale-105"
              >
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Live Chat</h3>
                <p className="text-sm text-gray-600">Real-time support chat</p>
              </a>

              <a
                href="#"
                className="bg-gray-50 rounded-lg p-6 text-center hover:shadow-md transition-all duration-200 hover:scale-105"
              >
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Email Support</h3>
                <p className="text-sm text-gray-600">Get help via email</p>
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_EmptyState;