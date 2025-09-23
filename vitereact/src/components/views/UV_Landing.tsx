import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// Interface for workspace creation API response
interface CreateWorkspaceResponse {
  workspace: {
    id: string;
    name: string;
    default_currency: string;
    timezone: string;
    data_retention_days: number;
    created_at: string;
    updated_at: string;
  };
  membership: {
    id: string;
    role: string;
    status: string;
  };
}

const UV_Landing: React.FC = () => {
  const navigate = useNavigate();
  
  // Individual Zustand selectors to avoid infinite loops
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  
  // Local state for demo creation
  const [demoCreationError, setDemoCreationError] = useState<string | null>(null);
  
  // Static testimonials data
  const featuredTestimonials = [
    {
      name: "Sarah Chen",
      company: "Growth Marketing Agency",
      testimonial: "PulseDeck reduced our reporting time from hours to minutes. The cross-platform insights are game-changing.",
      avatar_url: "https://picsum.photos/64/64?random=1"
    },
    {
      name: "Marcus Johnson",
      company: "E-commerce Startup",
      testimonial: "Finally, a tool that gives us unified analytics across TikTok, Meta, and Snapchat. ROI visibility has never been clearer.",
      avatar_url: "https://picsum.photos/64/64?random=2"
    },
    {
      name: "Emily Rodriguez",
      company: "Digital Agency",
      testimonial: "The automated insights save us so much time. We can focus on optimization instead of data compilation.",
      avatar_url: "https://picsum.photos/64/64?random=3"
    }
  ];
  
  // Static platform integrations data
  const platformIntegrations = [
    {
      name: "TikTok",
      logo_url: "https://picsum.photos/80/80?random=tiktok",
      description: "TikTok Ads Manager"
    },
    {
      name: "Meta",
      logo_url: "https://picsum.photos/80/80?random=meta", 
      description: "Facebook & Instagram Ads"
    },
    {
      name: "Snapchat",
      logo_url: "https://picsum.photos/80/80?random=snapchat",
      description: "Snapchat Ads Manager"
    }
  ];

  // Demo workspace creation mutation
  const demoWorkspaceMutation = useMutation({
    mutationFn: async (): Promise<CreateWorkspaceResponse> => {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/workspaces`,
        {
          name: "Demo Workspace",
          default_currency: "USD",
          timezone: "UTC",
          data_retention_days: 730
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { Authorization: `Bearer ${authToken}` })
          }
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      setDemoCreationError(null);
      // Redirect to the created workspace
      navigate(`/w/${data.workspace.id}`);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create demo workspace';
      setDemoCreationError(errorMessage);
    }
  });

  const handleCreateDemo = () => {
    setDemoCreationError(null);
    demoWorkspaceMutation.mutate();
  };

  const clearDemoError = () => {
    setDemoCreationError(null);
  };

  return (
    <>
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 bg-gradient-to-br from-blue-50 to-indigo-100 sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
            <div className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <div className="sm:text-center lg:text-left">
                <h1 className="text-4xl tracking-tight font-bold text-gray-900 sm:text-5xl md:text-6xl">
                  <span className="block xl:inline">Cross-platform ad</span>
                  <span className="block text-blue-600 xl:inline"> analytics made simple</span>
                </h1>
                <p className="mt-3 text-base text-gray-600 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0 leading-relaxed">
                  Get unified analytics across TikTok, Meta, and Snapchat in under 60 seconds. 
                  Automated insights, cross-platform comparison, and proactive alerts – all in one dashboard.
                </p>
                <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                  <div className="rounded-md shadow">
                    <Link
                      to="/signup"
                      className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-all duration-200 md:py-4 md:text-lg md:px-10 shadow-lg hover:shadow-xl"
                    >
                      Start Free Today
                    </Link>
                  </div>
                  <div className="mt-3 sm:mt-0 sm:ml-3">
                    <button
                      onClick={handleCreateDemo}
                      disabled={demoWorkspaceMutation.isPending}
                      className="w-full flex items-center justify-center px-8 py-3 border border-gray-300 text-base font-medium rounded-lg text-gray-900 bg-white hover:bg-gray-50 transition-all duration-200 md:py-4 md:text-lg md:px-10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {demoWorkspaceMutation.isPending ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating demo...
                        </span>
                      ) : (
                        'View Live Demo'
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Demo Error Message */}
                {demoCreationError && (
                  <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <p className="text-sm">{demoCreationError}</p>
                      <button
                        onClick={clearDemoError}
                        className="ml-2 text-red-500 hover:text-red-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="mt-6 text-sm text-gray-500 sm:text-center lg:text-left">
                  Already have an account? 
                  <Link to="/signin" className="ml-1 text-blue-600 hover:text-blue-500 font-medium">
                    Sign in
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
          <div className="h-56 w-full bg-gray-100 sm:h-72 md:h-96 lg:w-full lg:h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-32 h-32 bg-blue-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
                <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">Dashboard Preview</p>
            </div>
          </div>
        </div>
      </div>

      {/* Value Proposition Section */}
      <div className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Everything you need to optimize cross-platform campaigns
            </h2>
            <p className="mt-4 max-w-2xl text-xl text-gray-600 lg:mx-auto leading-relaxed">
              Stop switching between platforms. Get unified analytics, automated insights, and proactive alerts in one place.
            </p>
          </div>

          <div className="mt-10">
            <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-3 md:gap-x-8 md:gap-y-10">
              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-lg bg-blue-600 text-white">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Unified Analytics</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-600">
                  Connect TikTok, Meta, and Snapchat data in one dashboard. No more manual exports or spreadsheet juggling.
                </dd>
              </div>

              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-lg bg-blue-600 text-white">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Automated Insights</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-600">
                  AI-powered insights highlight performance anomalies, optimization opportunities, and winning creative patterns.
                </dd>
              </div>

              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-lg bg-blue-600 text-white">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Time Savings</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-600">
                  From upload to insights in under 60 seconds. Spend time optimizing campaigns, not compiling reports.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Platform Integration Section */}
      <div className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Seamless platform integration
            </h2>
            <p className="mt-4 max-w-2xl text-xl text-gray-600 lg:mx-auto leading-relaxed">
              Simply export your campaign data and upload to PulseDeck. We handle the rest.
            </p>
          </div>

          <div className="mt-10">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              {platformIntegrations.map((platform, index) => (
                <div key={platform.name} className="text-center">
                  <div className="flex justify-center">
                    <img
                      className="h-20 w-20 rounded-xl shadow-lg"
                      src={platform.logo_url}
                      alt={platform.name}
                    />
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">{platform.name}</h3>
                  <p className="mt-2 text-base text-gray-600">{platform.description}</p>
                  {index < platformIntegrations.length - 1 && (
                    <div className="hidden sm:block mt-6">
                      <svg className="mx-auto h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-10 text-center">
              <div className="inline-flex items-center px-6 py-3 bg-blue-600 rounded-lg">
                <svg className="h-8 w-8 text-white mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-white font-medium text-lg">PulseDeck Dashboard</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Social Proof Section */}
      <div className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Trusted by marketing teams worldwide
            </h2>
            <p className="mt-4 max-w-2xl text-xl text-gray-600 lg:mx-auto leading-relaxed">
              Join hundreds of marketers who have transformed their cross-platform analytics workflow.
            </p>
          </div>

          <div className="mt-10">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {featuredTestimonials.map((testimonial) => (
                <div key={testimonial.name} className="bg-gray-50 rounded-xl p-6 shadow-lg border border-gray-100">
                  <p className="text-gray-900 leading-relaxed">"{testimonial.testimonial}"</p>
                  <div className="mt-6 flex items-center">
                    <img
                      className="h-12 w-12 rounded-full"
                      src={testimonial.avatar_url}
                      alt={testimonial.name}
                    />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">{testimonial.name}</p>
                      <p className="text-sm text-gray-600">{testimonial.company}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 text-center">
            <div className="flex justify-center items-center space-x-8">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">500+</p>
                <p className="text-sm text-gray-600">Active Users</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">10M+</p>
                <p className="text-sm text-gray-600">Ad Spend Analyzed</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">99.9%</p>
                <p className="text-sm text-gray-600">Uptime</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600">
        <div className="max-w-2xl mx-auto text-center py-16 px-4 sm:py-20 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            <span className="block">Ready to transform your</span>
            <span className="block">ad analytics workflow?</span>
          </h2>
          <p className="mt-4 text-lg leading-6 text-blue-200">
            Start free today. No credit card required. Set up in under 5 minutes.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-lg text-blue-600 bg-white hover:bg-gray-50 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Get Started Free
            </Link>
            <button
              onClick={handleCreateDemo}
              disabled={demoWorkspaceMutation.isPending}
              className="inline-flex items-center justify-center px-8 py-3 border border-white text-base font-medium rounded-lg text-white bg-transparent hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {demoWorkspaceMutation.isPending ? 'Creating demo...' : 'Try Live Demo'}
            </button>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-12 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Frequently asked questions
            </h2>
          </div>

          <div className="mt-10 space-y-8">
            <div>
              <h3 className="text-lg font-medium text-gray-900">How secure is my campaign data?</h3>
              <p className="mt-2 text-gray-600">Your data is encrypted at rest and in transit. We use industry-standard security practices and never store your platform credentials. Data is processed locally and deleted after analysis.</p>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900">Which platforms do you support?</h3>
              <p className="mt-2 text-gray-600">Currently we support TikTok Ads Manager, Meta Ads Manager (Facebook & Instagram), and Snapchat Ads Manager. More platforms coming soon.</p>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900">How long does setup take?</h3>
              <p className="mt-2 text-gray-600">Setup takes under 5 minutes. Simply export your campaign data from each platform and upload to PulseDeck. Our intelligent mapping handles the rest automatically.</p>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900">Can I customize the analytics dashboard?</h3>
              <p className="mt-2 text-gray-600">Yes! You can customize metrics, date ranges, comparison periods, and create custom alerts based on your specific KPIs and performance thresholds.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_Landing;