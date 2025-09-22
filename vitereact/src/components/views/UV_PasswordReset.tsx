import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { EyeIcon, EyeSlashIcon, CheckIcon, XMarkIcon, ShieldCheckIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

// Types for API responses
interface ForgotPasswordResponse {
  message: string;
}

interface ResetPasswordResponse {
  message: string;
}

interface ForgotPasswordRequest {
  email: string;
}

interface ResetPasswordRequest {
  token: string;
  password: string;
}

// Password validation function
const validatePassword = (password: string, confirmPassword: string) => {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const strengthScore = [hasMinLength, hasUppercase, hasLowercase, hasNumbers, hasSpecialChar].filter(Boolean).length;
  const requirements_met = strengthScore >= 4 && hasMinLength;
  const matches_confirmation = password === confirmPassword && confirmPassword.length > 0;
  
  return {
    strength_score: strengthScore,
    matches_confirmation,
    requirements_met,
    criteria: {
      hasMinLength,
      hasUppercase,
      hasLowercase,
      hasNumbers,
      hasSpecialChar
    }
  };
};

const UV_PasswordReset: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get token from URL params
  const token = searchParams.get('token');
  
  // Authentication state check
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  
  // Determine reset phase based on token presence
  const reset_phase = useMemo(() => {
    return token ? 'reset' : 'request';
  }, [token]);
  
  // State variables
  const [email_request_data, setEmailRequestData] = useState({ email: '' });
  const [new_password_data, setNewPasswordData] = useState({ password: '', confirm_password: '' });
  const [request_status, setRequestStatus] = useState<{
    status: 'idle' | 'sending' | 'sent' | 'resetting' | 'success' | 'failed';
    message: string | null;
  }>({ status: 'idle', message: null });
  const [token_validation, setTokenValidation] = useState({
    is_valid: true,
    is_expired: false,
    error_message: null as string | null
  });
  const [show_password, setShowPassword] = useState(false);
  const [show_confirm_password, setShowConfirmPassword] = useState(false);
  
  // Password validation
  const password_validation = useMemo(() => {
    return validatePassword(new_password_data.password, new_password_data.confirm_password);
  }, [new_password_data.password, new_password_data.confirm_password]);
  
  // Redirect authenticated users
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/w/default/settings', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);
  
  // API Base URL
  const getApiBaseUrl = () => {
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  };
  
  // Forgot password mutation
  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordRequest): Promise<ForgotPasswordResponse> => {
      const response = await axios.post(
        `${getApiBaseUrl()}/api/auth/forgot-password`,
        data,
        { headers: { 'Content-Type': 'application/json' } }
      );
      return response.data;
    },
    onMutate: () => {
      setRequestStatus({ status: 'sending', message: null });
    },
    onSuccess: (response) => {
      setRequestStatus({ 
        status: 'sent', 
        message: response.message || 'Password reset instructions have been sent to your email.' 
      });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to send password reset email. Please try again.';
      setRequestStatus({ status: 'failed', message: errorMessage });
    }
  });
  
  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordRequest): Promise<ResetPasswordResponse> => {
      const response = await axios.post(
        `${getApiBaseUrl()}/api/auth/reset-password`,
        data,
        { headers: { 'Content-Type': 'application/json' } }
      );
      return response.data;
    },
    onMutate: () => {
      setRequestStatus({ status: 'resetting', message: null });
    },
    onSuccess: (response) => {
      setRequestStatus({ 
        status: 'success', 
        message: response.message || 'Your password has been successfully reset.' 
      });
      // Redirect to sign-in after 2 seconds
      setTimeout(() => {
        navigate('/signin?message=Password reset successful. Please sign in with your new password.', { replace: true });
      }, 2000);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to reset password. Please try again.';
      
      // Handle token-specific errors
      if (error.response?.status === 400 || error.response?.status === 401) {
        setTokenValidation({
          is_valid: false,
          is_expired: true,
          error_message: 'This reset link has expired or is invalid. Please request a new password reset.'
        });
      }
      
      setRequestStatus({ status: 'failed', message: errorMessage });
    }
  });
  
  // Handle email form submission
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email_request_data.email) {
      setRequestStatus({ status: 'failed', message: 'Please enter your email address.' });
      return;
    }
    
    forgotPasswordMutation.mutate({ email: email_request_data.email });
  };
  
  // Handle password reset form submission
  const handlePasswordResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password_validation.requirements_met) {
      setRequestStatus({ status: 'failed', message: 'Please ensure your password meets all requirements.' });
      return;
    }
    
    if (!password_validation.matches_confirmation) {
      setRequestStatus({ status: 'failed', message: 'Passwords do not match.' });
      return;
    }
    
    if (!token) {
      setRequestStatus({ status: 'failed', message: 'Invalid reset token.' });
      return;
    }
    
    resetPasswordMutation.mutate({ token, password: new_password_data.password });
  };
  
  // Clear errors when inputs change
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailRequestData({ email: e.target.value });
    if (request_status.status === 'failed') {
      setRequestStatus({ status: 'idle', message: null });
    }
  };
  
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPasswordData(prev => ({ ...prev, password: e.target.value }));
    if (request_status.status === 'failed') {
      setRequestStatus({ status: 'idle', message: null });
    }
  };
  
  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPasswordData(prev => ({ ...prev, confirm_password: e.target.value }));
    if (request_status.status === 'failed') {
      setRequestStatus({ status: 'idle', message: null });
    }
  };
  
  // Show loading spinner during auth check
  if (isLoading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </>
    );
  }
  
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <ShieldCheckIcon className="w-5 h-5 text-white" />
              </div>
              <span className="ml-2 text-2xl font-bold text-gray-900">PulseDeck</span>
            </div>
          </div>
          
          {reset_phase === 'request' && (
            <>
              <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
                Reset your password
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </>
          )}
          
          {reset_phase === 'reset' && (
            <>
              <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
                Set new password
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                Create a strong password for your account.
              </p>
            </>
          )}
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-lg shadow-gray-200/50 sm:rounded-xl sm:px-10 border border-gray-100">
            
            {/* Success Phase */}
            {request_status.status === 'success' && (
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                  <CheckIcon className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {reset_phase === 'request' ? 'Email sent!' : 'Password reset successfully!'}
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  {request_status.message}
                </p>
                
                {reset_phase === 'request' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex">
                      <ClockIcon className="h-5 w-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="text-blue-700 font-medium">What happens next?</p>
                        <ul className="text-blue-600 mt-1 space-y-1">
                          <li>• Check your email inbox for reset instructions</li>
                          <li>• Click the reset link within 1 hour</li>
                          <li>• The link can only be used once for security</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-3">
                  {reset_phase === 'request' ? (
                    <>
                      <button
                        onClick={() => setRequestStatus({ status: 'idle', message: null })}
                        className="w-full flex justify-center py-3 px-4 border border-blue-300 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        Send another email
                      </button>
                      <Link
                        to="/signin"
                        className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        Back to sign in
                      </Link>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Redirecting to sign in page...
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* Token Error */}
            {token_validation.error_message && (
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Link expired</h3>
                <p className="text-sm text-gray-600 mb-6">{token_validation.error_message}</p>
                <Link
                  to="/reset-password"
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Request new reset link
                </Link>
              </div>
            )}
            
            {/* Request Phase Form */}
            {reset_phase === 'request' && request_status.status !== 'success' && (
              <form className="space-y-6" onSubmit={handleEmailSubmit}>
                {request_status.message && request_status.status === 'failed' && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    <div className="flex">
                      <XMarkIcon className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
                      <p className="text-sm">{request_status.message}</p>
                    </div>
                  </div>
                )}
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email_request_data.email}
                    onChange={handleEmailChange}
                    placeholder="Enter your email address"
                    className="block w-full px-4 py-3 border-2 border-gray-200 rounded-lg placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Security information</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Reset links expire after 1 hour for security</li>
                    <li>• Each link can only be used once</li>
                    <li>• Check your spam folder if you don't see the email</li>
                  </ul>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={request_status.status === 'sending'}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {request_status.status === 'sending' ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending email...
                      </span>
                    ) : (
                      'Send reset email'
                    )}
                  </button>
                </div>

                <div className="text-center">
                  <Link
                    to="/signin"
                    className="text-blue-600 hover:text-blue-500 text-sm font-medium transition-colors"
                  >
                    Back to sign in
                  </Link>
                </div>
              </form>
            )}
            
            {/* Reset Phase Form */}
            {reset_phase === 'reset' && request_status.status !== 'success' && !token_validation.error_message && (
              <form className="space-y-6" onSubmit={handlePasswordResetSubmit}>
                {request_status.message && request_status.status === 'failed' && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    <div className="flex">
                      <XMarkIcon className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
                      <p className="text-sm">{request_status.message}</p>
                    </div>
                  </div>
                )}
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={show_password ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={new_password_data.password}
                      onChange={handlePasswordChange}
                      placeholder="Create a strong password"
                      className="block w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-lg placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!show_password)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {show_password ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                  
                  {/* Password Requirements */}
                  {new_password_data.password && (
                    <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <h4 className="text-xs font-medium text-gray-900 mb-2">Password requirements:</h4>
                      <div className="grid grid-cols-1 gap-1 text-xs">
                        <div className={`flex items-center ${password_validation.criteria.hasMinLength ? 'text-green-600' : 'text-red-600'}`}>
                          {password_validation.criteria.hasMinLength ? (
                            <CheckIcon className="h-3 w-3 mr-1" />
                          ) : (
                            <XMarkIcon className="h-3 w-3 mr-1" />
                          )}
                          At least 8 characters
                        </div>
                        <div className={`flex items-center ${password_validation.criteria.hasUppercase ? 'text-green-600' : 'text-red-600'}`}>
                          {password_validation.criteria.hasUppercase ? (
                            <CheckIcon className="h-3 w-3 mr-1" />
                          ) : (
                            <XMarkIcon className="h-3 w-3 mr-1" />
                          )}
                          One uppercase letter
                        </div>
                        <div className={`flex items-center ${password_validation.criteria.hasLowercase ? 'text-green-600' : 'text-red-600'}`}>
                          {password_validation.criteria.hasLowercase ? (
                            <CheckIcon className="h-3 w-3 mr-1" />
                          ) : (
                            <XMarkIcon className="h-3 w-3 mr-1" />
                          )}
                          One lowercase letter
                        </div>
                        <div className={`flex items-center ${password_validation.criteria.hasNumbers ? 'text-green-600' : 'text-red-600'}`}>
                          {password_validation.criteria.hasNumbers ? (
                            <CheckIcon className="h-3 w-3 mr-1" />
                          ) : (
                            <XMarkIcon className="h-3 w-3 mr-1" />
                          )}
                          One number
                        </div>
                        <div className={`flex items-center ${password_validation.criteria.hasSpecialChar ? 'text-green-600' : 'text-red-600'}`}>
                          {password_validation.criteria.hasSpecialChar ? (
                            <CheckIcon className="h-3 w-3 mr-1" />
                          ) : (
                            <XMarkIcon className="h-3 w-3 mr-1" />
                          )}
                          One special character
                        </div>
                      </div>
                      
                      {/* Strength Indicator */}
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-600">Strength:</span>
                          <span className={`text-xs font-medium ${
                            password_validation.strength_score <= 2 ? 'text-red-600' :
                            password_validation.strength_score <= 3 ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {password_validation.strength_score <= 2 ? 'Weak' :
                             password_validation.strength_score <= 3 ? 'Medium' :
                             'Strong'}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full transition-all ${
                              password_validation.strength_score <= 2 ? 'bg-red-500' :
                              password_validation.strength_score <= 3 ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${(password_validation.strength_score / 5) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div>
                  <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <input
                      id="confirm_password"
                      name="confirm_password"
                      type={show_confirm_password ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={new_password_data.confirm_password}
                      onChange={handleConfirmPasswordChange}
                      placeholder="Confirm your password"
                      className="block w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-lg placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!show_confirm_password)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {show_confirm_password ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                  
                  {/* Password Match Indicator */}
                  {new_password_data.confirm_password && (
                    <div className={`mt-2 flex items-center text-xs ${
                      password_validation.matches_confirmation ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {password_validation.matches_confirmation ? (
                        <CheckIcon className="h-3 w-3 mr-1" />
                      ) : (
                        <XMarkIcon className="h-3 w-3 mr-1" />
                      )}
                      {password_validation.matches_confirmation ? 'Passwords match' : 'Passwords do not match'}
                    </div>
                  )}
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={request_status.status === 'resetting' || !password_validation.requirements_met || !password_validation.matches_confirmation}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {request_status.status === 'resetting' ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Updating password...
                      </span>
                    ) : (
                      'Update password'
                    )}
                  </button>
                </div>

                <div className="text-center">
                  <Link
                    to="/signin"
                    className="text-blue-600 hover:text-blue-500 text-sm font-medium transition-colors"
                  >
                    Back to sign in
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_PasswordReset;