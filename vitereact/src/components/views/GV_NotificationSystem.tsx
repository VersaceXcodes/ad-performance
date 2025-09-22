import React, { useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, ExternalLink } from 'lucide-react';

// Interfaces for notification types
interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  auto_dismiss: boolean;
  actions?: Array<{
    label: string;
    action: string;
  }>;
}

interface AlertBanner {
  id: string;
  type: 'alert' | 'system' | 'info' | 'warning';
  message: string;
  severity: 'low' | 'normal' | 'high' | 'urgent';
  dismissible: boolean;
  action_url?: string | null;
}

interface ProcessingIndicator {
  id: string;
  type: 'upload' | 'export' | 'processing';
  message: string;
  progress: number;
  estimated_completion?: string | null;
}

const GV_NotificationSystem: React.FC = () => {
  // Zustand selectors - individual selectors to prevent infinite loops
  const toastNotifications = useAppStore(state => state.notification_state.toast_notifications);
  const alertNotifications = useAppStore(state => state.notification_state.alerts);
  const activeUploads = useAppStore(state => state.upload_state.active_uploads);
  const currentWorkspace = useAppStore(state => state.current_workspace);
  const authToken = useAppStore(state => state.authentication_state.auth_token);

  // Zustand actions
  const removeToastNotification = useAppStore(state => state.remove_toast_notification);
  const markAlertAsRead = useAppStore(state => state.mark_alert_as_read);
  const addToastNotification = useAppStore(state => state.add_toast_notification);

  // API mutation for marking notifications as read
  const markNotificationAsReadMutation = useMutation({
    mutationFn: async ({ workspaceId, notificationId }: { workspaceId: string; notificationId: string }) => {
      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/workspaces/${workspaceId}/notifications/${notificationId}`,
        {
          is_read: true,
          read_at: new Date().toISOString()
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    }
  });

  // Auto-dismiss toast notifications
  useEffect(() => {
    toastNotifications.forEach(notification => {
      if (notification.auto_dismiss) {
        const duration = notification.duration || 5000;
        const timer = setTimeout(() => {
          removeToastNotification(notification.id);
        }, duration);

        return () => clearTimeout(timer);
      }
    });
  }, [toastNotifications, removeToastNotification]);

  // Handle toast dismissal
  const handleDismissToast = useCallback((id: string) => {
    removeToastNotification(id);
  }, [removeToastNotification]);

  // Handle alert dismissal
  const handleDismissAlert = useCallback(async (alertId: string) => {
    markAlertAsRead(alertId);
    
    // If this is a server notification, mark it as read
    if (currentWorkspace?.id) {
      try {
        await markNotificationAsReadMutation.mutateAsync({
          workspaceId: currentWorkspace.id,
          notificationId: alertId
        });
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }
  }, [markAlertAsRead, currentWorkspace, markNotificationAsReadMutation]);

  // Handle notification actions
  const handleNotificationAction = useCallback((action: string) => {
    if (action.startsWith('/')) {
      // It's a route - this would be handled by the parent component or router
      window.location.href = action;
    } else if (action.startsWith('http')) {
      // External URL
      window.open(action, '_blank');
    } else {
      // Custom action - could trigger other store actions
      addToastNotification({
        type: 'info',
        message: `Action triggered: ${action}`,
        auto_dismiss: true
      });
    }
  }, [addToastNotification]);

  // Get icon for notification type
  const getNotificationIcon = (type: string, severity?: string) => {
    const iconSize = "h-5 w-5";
    
    switch (type) {
      case 'success':
        return <CheckCircle className={`${iconSize} text-green-500`} />;
      case 'error':
        return <AlertCircle className={`${iconSize} text-red-500`} />;
      case 'warning':
        return <AlertTriangle className={`${iconSize} text-yellow-500`} />;
      case 'alert':
        const alertColor = severity === 'urgent' || severity === 'high' ? 'text-red-500' : 
                          severity === 'normal' ? 'text-yellow-500' : 'text-blue-500';
        return <AlertTriangle className={`${iconSize} ${alertColor}`} />;
      default:
        return <Info className={`${iconSize} text-blue-500`} />;
    }
  };

  // Get styling classes for notification type
  const getNotificationClasses = (type: string, severity?: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'alert':
        if (severity === 'urgent' || severity === 'high') {
          return 'bg-red-50 border-red-200 text-red-800';
        } else if (severity === 'normal') {
          return 'bg-yellow-50 border-yellow-200 text-yellow-800';
        }
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  return (
    <>
      {/* Toast Notifications - Top Right */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
        {toastNotifications.map((notification) => (
          <div
            key={notification.id}
            className={`
              transform transition-all duration-300 ease-in-out
              bg-white rounded-lg shadow-lg border-l-4 p-4
              ${notification.type === 'success' ? 'border-l-green-500' : ''}
              ${notification.type === 'error' ? 'border-l-red-500' : ''}
              ${notification.type === 'warning' ? 'border-l-yellow-500' : ''}
              ${notification.type === 'info' ? 'border-l-blue-500' : ''}
              animate-slide-in-right
            `}
            role="alert"
            aria-live="polite"
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                {getNotificationIcon(notification.type)}
              </div>
              
              <div className="ml-3 flex-1">
                {notification.title && (
                  <h4 className="text-sm font-medium text-gray-900 mb-1">
                    {notification.title}
                  </h4>
                )}
                <p className="text-sm text-gray-600">
                  {notification.message}
                </p>
                
                {notification.actions && notification.actions.length > 0 && (
                  <div className="mt-3 flex space-x-2">
                    {notification.actions.map((action, index) => (
                      <button
                        key={index}
                        onClick={() => handleNotificationAction(action.action)}
                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded transition-colors duration-200"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="ml-4 flex-shrink-0">
                <button
                  onClick={() => handleDismissToast(notification.id)}
                  className="rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Alert Banners - Full Width Below Header */}
      {alertNotifications.filter(alert => !alert.is_read).length > 0 && (
        <div className="fixed top-16 left-0 right-0 z-40">
          {alertNotifications
            .filter(alert => !alert.is_read)
            .slice(0, 3) // Show max 3 alert banners
            .map((alert) => (
              <div
                key={alert.id}
                className={`
                  ${getNotificationClasses(alert.type)} 
                  border-b px-4 py-3 sm:px-6 lg:px-8
                `}
                role="alert"
                aria-live="assertive"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {getNotificationIcon(alert.type)}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium">
                        {alert.message}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {alert.action_url && (
                      <Link
                        to={alert.action_url}
                        className="inline-flex items-center text-sm font-medium underline hover:no-underline"
                      >
                        View Details
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    )}
                    
                    <button
                      onClick={() => handleDismissAlert(alert.id)}
                      className="rounded-md inline-flex text-current hover:text-opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current"
                      aria-label="Dismiss alert"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Processing Indicators - Top Right Below Toast Notifications */}
      {activeUploads.length > 0 && (
        <div className="fixed top-4 right-4 z-40 space-y-2 max-w-sm w-full" style={{ marginTop: `${(toastNotifications.length * 80) + 16}px` }}>
          {activeUploads.map((upload) => (
            <div
              key={upload.id}
              className="bg-white rounded-lg shadow-lg border p-4 animate-slide-in-right"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                </div>
                
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Processing {upload.platform} data
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {upload.filename}
                  </p>
                  
                  {/* Progress Bar */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{upload.status}</span>
                      <span>{upload.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${upload.progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default GV_NotificationSystem;