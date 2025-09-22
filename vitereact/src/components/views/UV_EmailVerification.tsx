import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// Types for API responses
interface VerifyEmailResponse {
  message: string;
  user?: {
    id: string;
    email: string;
    name: string;
    email_verified: boolean;
    created_at: string;
    updated_at: string;
  };
}

interface VerificationState {
  status: 'pending' | 'verifying' | 'success' | 'failed' | 'expired';
  message: string | null;
}

const UV_EmailVerification: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Extract token from URL
  const token = searchParams.get('token');
  
  // Local state
  const [verificationStatus, setVerificationStatus] = useState<VerificationState>({
    status: 'pending',
    message: null
  });
  const [autoRedirectCountdown, setAutoRedirectCountdown] = useState(5);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Global state selectors (individual selectors to avoid infinite loops)
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const updateUserProfile = useAppStore(state => state.update_user_profile);
  
  // API base URL
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Verify email token mutation
  const verifyEmailMutation = useMutation({
    mutationFn: async (verificationToken: string): Promise<VerifyEmailResponse> => {
      const response = await axios.post(
        `${apiBaseUrl}/api/auth/verify-email`,
        { token: verificationToken },
        { headers: { 'Content-Type': 'application/json' } }
      );
      return response.data;
    },
    onSuccess: (data) => {
      setVerificationStatus({
        status: 'success',
        message: data.message || 'Email verified successfully! Redirecting...'
      });
      
      // Update global user state if user data is returned
      if (data.user) {
        updateUserProfile({
          email_verified: true,
          updated_at: data.user.updated_at
        });
      }
      
      // Start countdown for auto-redirect
      setAutoRedirectCountdown(5);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || 'Verification failed';
      
      // Determine if token is expired or just invalid
      const isExpired = errorMessage.toLowerCase().includes('expired') || 
                      errorMessage.toLowerCase().includes('expire');
      
      setVerificationStatus({
        status: isExpired ? 'expired' : 'failed',
        message: errorMessage
      });
    }
  });

  // Resend verification email mutation
  const resendEmailMutation = useMutation({
    mutationFn: async (email: string): Promise<{ message: string }> => {
      const response = await axios.post(
        `${apiBaseUrl}/api/auth/verify-email`,
        { email },
        { headers: { 'Content-Type': 'application/json' } }
      );
      return response.data;
    },
    onSuccess: (data) => {
      setVerificationStatus({
        status: 'pending',
        message: data.message || 'Verification email sent! Please check your inbox.'
      });
      
      // Start cooldown timer
      setResendCooldown(60);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to send verification email';
      setVerificationStatus({
        status: 'failed',
        message: errorMessage
      });
    }
  });

  // Verify token on component mount
  useEffect(() => {
    if (token) {
      setVerificationStatus({ status: 'verifying', message: null });
      verifyEmailMutation.mutate(token);
    } else {
      setVerificationStatus({
        status: 'failed',
        message: 'No verification token provided. Please check your email for the verification link.'
      });
    }
  }, [token]);

  // Auto-redirect countdown effect
  useEffect(() => {
    if (verificationStatus.status === 'success' && autoRedirectCountdown > 0) {
      const timer = setTimeout(() => {
        setAutoRedirectCountdown(prev => prev - 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else if (verificationStatus.status === 'success' && autoRedirectCountdown === 0) {
      // Redirect to overview
      navigate('/');
    }
  }, [verificationStatus.status, autoRedirectCountdown, navigate]);

  // Resend cooldown effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Handle resend verification email
  const handleResendEmail = useCallback(() => {
    if (currentUser?.email && resendCooldown === 0) {
      resendEmailMutation.mutate(currentUser.email);
    }
  }, [currentUser?.email, resendCooldown, resendEmailMutation]);

  // Render status icon
  const renderStatusIcon = () => {
    switch (verificationStatus.status) {
      case 'verifying':
        return (
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
        );
      case 'success':
        return (
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case 'failed':
      case 'expired':
        return (
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-8 w-8 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
        );
    }
  };

  // Render main content based on status
  const renderMainContent = () => {
    switch (verificationStatus.status) {
      case 'verifying':
        return (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 text-center mb-4">
              Verifying Your Email
            </h1>
            <p className="text-lg text-gray-600 text-center mb-8">
              Please wait while we verify your email address...
            </p>
          </div>
        );

      case 'success':
        return (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 text-center mb-4">
              Email Verified Successfully!
            </h1>
            <p className="text-lg text-gray-600 text-center mb-6">
              Welcome to PulseDeck! Your account has been activated and you're ready to start analyzing your ad performance.
            </p>
            {verificationStatus.message && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-green-700 text-center text-sm">
                  {verificationStatus.message}
                </p>
              </div>
            )}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <p className="text-blue-700 mb-2">
                Redirecting to dashboard in {autoRedirectCountdown} seconds...
              </p>
              <Link
                to="/"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Go to Dashboard Now
              </Link>
            </div>
          </div>
        );

      case 'expired':
        return (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 text-center mb-4">
              Verification Link Expired
            </h1>
            <p className="text-lg text-gray-600 text-center mb-6">
              Your verification link has expired for security reasons. Don't worry, we can send you a new one!
            </p>
            {verificationStatus.message && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-700 text-center text-sm">
                  {verificationStatus.message}
                </p>
              </div>
            )}
            {currentUser?.email && (
              <div className="text-center">
                <button
                  onClick={handleResendEmail}
                  disabled={resendCooldown > 0 || resendEmailMutation.isPending}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {resendEmailMutation.isPending ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </span>
                  ) : resendCooldown > 0 ? (
                    `Resend in ${resendCooldown}s`
                  ) : (
                    'Send New Verification Email'
                  )}
                </button>
                <p className="text-sm text-gray-500 mt-2">
                  We'll send a new verification link to {currentUser.email}
                </p>
              </div>
            )}
          </div>
        );

      case 'failed':
        return (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 text-center mb-4">
              Verification Failed
            </h1>
            <p className="text-lg text-gray-600 text-center mb-6">
              We couldn't verify your email with the provided link. This might be due to an invalid or expired token.
            </p>
            {verificationStatus.message && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-700 text-center text-sm">
                  {verificationStatus.message}
                </p>
              </div>
            )}
            <div className="space-y-4">
              {currentUser?.email && (
                <div className="text-center">
                  <button
                    onClick={handleResendEmail}
                    disabled={resendCooldown > 0 || resendEmailMutation.isPending}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {resendEmailMutation.isPending ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending...
                      </span>
                    ) : resendCooldown > 0 ? (
                      `Resend in ${resendCooldown}s`
                    ) : (
                      'Send New Verification Email'
                    )}
                  </button>
                  <p className="text-sm text-gray-500 mt-2">
                    We'll send a new verification link to {currentUser.email}
                  </p>
                </div>
              )}
              <div className="text-center">
                <Link
                  to="/signin"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 text-center mb-4">
              Email Verification
            </h1>
            <p className="text-lg text-gray-600 text-center mb-6">
              Please check your email for the verification link.
            </p>
          </div>
        );
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-lg shadow-gray-200/50 sm:rounded-xl sm:px-10 border border-gray-100">
            {/* Status Icon */}
            {renderStatusIcon()}
            
            {/* Main Content */}
            {renderMainContent()}
            
            {/* Help Section */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-3">
                  Need help with verification?
                </p>
                <div className="space-y-2">
                  <Link
                    to="/signup"
                    className="block text-sm text-blue-600 hover:text-blue-500 font-medium transition-colors"
                  >
                    Create a new account
                  </Link>
                  <a
                    href="mailto:support@pulsedeck.com"
                    className="block text-sm text-gray-600 hover:text-gray-700 transition-colors"
                  >
                    Contact support
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="mt-6 text-center">
            <Link
              to="/"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← Back to PulseDeck
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_EmailVerification;