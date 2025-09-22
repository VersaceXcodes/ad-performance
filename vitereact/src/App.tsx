import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

// Import all views
import GV_TopNavigation from '@/components/views/GV_TopNavigation';
import GV_Sidebar from '@/components/views/GV_Sidebar';
import GV_Footer from '@/components/views/GV_Footer';
import GV_NotificationSystem from '@/components/views/GV_NotificationSystem';
import UV_Landing from '@/components/views/UV_Landing';
import UV_SignUp from '@/components/views/UV_SignUp';
import UV_SignIn from '@/components/views/UV_SignIn';
import UV_EmailVerification from '@/components/views/UV_EmailVerification';
import UV_PasswordReset from '@/components/views/UV_PasswordReset';
import UV_EmptyState from '@/components/views/UV_EmptyState';
import UV_Overview from '@/components/views/UV_Overview';
import UV_ChannelsCompare from '@/components/views/UV_ChannelsCompare';
import UV_Campaigns from '@/components/views/UV_Campaigns';
import UV_Creatives from '@/components/views/UV_Creatives';
import UV_Uploads from '@/components/views/UV_Uploads';
import UV_DataMapping from '@/components/views/UV_DataMapping';
import UV_UploadWizard from '@/components/views/UV_UploadWizard';
import UV_Alerts from '@/components/views/UV_Alerts';
import UV_Settings from '@/components/views/UV_Settings';
import UV_TeamManagement from '@/components/views/UV_TeamManagement';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Loading spinner component
const LoadingSpinner: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    <span className="ml-3 text-gray-600">Loading...</span>
  </div>
);

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }
  
  return <>{children}</>;
};

// Public route wrapper (redirects authenticated users)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const currentWorkspace = useAppStore(state => state.current_workspace);
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (isAuthenticated) {
    // Redirect to workspace overview if available, otherwise to empty state
    const redirectPath = currentWorkspace ? `/w/${currentWorkspace.id}` : '/w/default';
    return <Navigate to={redirectPath} replace />;
  }
  
  return <>{children}</>;
};

// Authenticated layout wrapper
const AuthenticatedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <GV_TopNavigation />
      
      <div className="flex">
        {/* Sidebar */}
        <GV_Sidebar />
        
        {/* Main Content Area */}
        <main className="flex-1 ml-0 lg:ml-240 pt-16">
          <div className="min-h-[calc(100vh-4rem)]">
            {children}
          </div>
        </main>
      </div>
      
      {/* Footer */}
      <GV_Footer />
      
      {/* Global Notification System */}
      <GV_NotificationSystem />
    </div>
  );
};

// Public layout wrapper
const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1">
        {children}
      </main>
      <GV_Footer />
    </div>
  );
};

const App: React.FC = () => {
  // Individual selectors to prevent infinite loops
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const currentWorkspace = useAppStore(state => state.current_workspace);
  const initializeAuth = useAppStore(state => state.initialize_auth);
  
  useEffect(() => {
    // Initialize auth state when app loads
    initializeAuth();
  }, [initializeAuth]);
  
  // Show loading spinner during initial auth check
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App">
          <Routes>
            {/* Public Routes */}
            <Route 
              path="/" 
              element={
                <PublicRoute>
                  <PublicLayout>
                    <UV_Landing />
                  </PublicLayout>
                </PublicRoute>
              } 
            />
            
            <Route 
              path="/signup" 
              element={
                <PublicRoute>
                  <PublicLayout>
                    <UV_SignUp />
                  </PublicLayout>
                </PublicRoute>
              } 
            />
            
            <Route 
              path="/signin" 
              element={
                <PublicRoute>
                  <PublicLayout>
                    <UV_SignIn />
                  </PublicLayout>
                </PublicRoute>
              } 
            />
            
            <Route 
              path="/verify-email" 
              element={
                <PublicLayout>
                  <UV_EmailVerification />
                </PublicLayout>
              } 
            />
            
            <Route 
              path="/reset-password" 
              element={
                <PublicLayout>
                  <UV_PasswordReset />
                </PublicLayout>
              } 
            />
            
            {/* Protected Workspace Routes */}
            <Route 
              path="/w/:workspace_id" 
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <UV_Overview />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/w/:workspace_id/channels" 
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <UV_ChannelsCompare />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/w/:workspace_id/campaigns" 
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <UV_Campaigns />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/w/:workspace_id/campaigns/:campaign_id" 
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <UV_Campaigns />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/w/:workspace_id/creatives" 
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <UV_Creatives />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/w/:workspace_id/uploads" 
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <UV_Uploads />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/w/:workspace_id/upload" 
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <UV_UploadWizard />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/w/:workspace_id/upload/mapping" 
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <UV_DataMapping />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/w/:workspace_id/alerts" 
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <UV_Alerts />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/w/:workspace_id/settings" 
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <UV_Settings />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/w/:workspace_id/settings/team" 
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <UV_TeamManagement />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } 
            />
            
            {/* Empty State Route for authenticated users without workspace */}
            <Route 
              path="/w/default" 
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <UV_EmptyState />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              } 
            />
            
            {/* Catch-all redirect */}
            <Route 
              path="*" 
              element={
                isAuthenticated 
                  ? <Navigate to={currentWorkspace ? `/w/${currentWorkspace.id}` : '/w/default'} replace />
                  : <Navigate to="/" replace />
              } 
            />
          </Routes>
        </div>
      </Router>
    </QueryClientProvider>
  );
};

export default App;