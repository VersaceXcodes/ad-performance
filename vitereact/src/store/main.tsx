import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

// ========================
// TYPE DEFINITIONS
// ========================

interface User {
  id: string;
  email: string;
  name: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

interface Workspace {
  id: string;
  name: string;
  default_currency: string;
  default_revenue_per_conversion: number | null;
  timezone: string;
  data_retention_days: number;
  created_at: string;
  updated_at: string;
}

interface WorkspaceContext {
  id: string;
  name: string;
  role: string;
  created_at: string;
}

interface AuthenticationState {
  current_user: User | null;
  auth_token: string | null;
  authentication_status: {
    is_authenticated: boolean;
    is_loading: boolean;
  };
  error_message: string | null;
}

interface DateRangeFilter {
  date_from: string | null;
  date_to: string | null;
  date_preset: string | null;
  comparison_mode: string | null;
}

interface PlatformFilter {
  selected_platforms: string[];
  selected_accounts: string[];
}

interface AlertNotification {
  id: string;
  type: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface ToastNotification {
  id: string;
  type: string;
  message: string;
  auto_dismiss: boolean;
}

interface NotificationState {
  alerts: AlertNotification[];
  toast_notifications: ToastNotification[];
}

interface UploadProgress {
  id: string;
  filename: string;
  status: string;
  progress: number;
  platform: string;
}

interface RecentUpload {
  id: string;
  filename: string;
  status: string;
  completed_at: string;
}

interface UploadState {
  active_uploads: UploadProgress[];
  recent_uploads: RecentUpload[];
}

// ========================
// MAIN STORE INTERFACE
// ========================

interface AppStore {
  // State
  authentication_state: AuthenticationState;
  current_workspace: WorkspaceContext | null;
  date_range_filter: DateRangeFilter;
  platform_filter: PlatformFilter;
  notification_state: NotificationState;
  upload_state: UploadState;
  
  // WebSocket
  socket: Socket | null;
  is_connected: boolean;

  // Authentication Actions
  login_user: (email: string, password: string) => Promise<void>;
  logout_user: () => void;
  register_user: (email: string, password: string, name: string) => Promise<void>;
  initialize_auth: () => Promise<void>;
  clear_auth_error: () => void;
  update_user_profile: (userData: Partial<User>) => void;

  // Workspace Actions
  switch_workspace: (workspace_id: string) => Promise<void>;
  update_workspace_context: (workspace: WorkspaceContext) => void;
  clear_workspace: () => void;

  // Filter Actions
  update_date_range: (date_from: string | null, date_to: string | null, preset?: string | null) => void;
  update_comparison_mode: (mode: string | null) => void;
  update_platform_filter: (platforms: string[], accounts?: string[]) => void;
  clear_filters: () => void;

  // Notification Actions
  add_alert_notification: (alert: Omit<AlertNotification, 'id'>) => void;
  add_toast_notification: (toast: Omit<ToastNotification, 'id'>) => void;
  mark_alert_as_read: (alert_id: string) => void;
  remove_toast_notification: (toast_id: string) => void;
  clear_all_notifications: () => void;

  // Upload Actions
  add_active_upload: (upload: UploadProgress) => void;
  update_upload_progress: (upload_id: string, progress: number, status: string) => void;
  complete_upload: (upload_id: string, status: string) => void;
  remove_active_upload: (upload_id: string) => void;

  // WebSocket Actions
  connect_websocket: () => void;
  disconnect_websocket: () => void;
  handle_upload_progress: (data: any) => void;
  handle_notification: (data: any) => void;
}

// ========================
// UTILITY FUNCTIONS
// ========================

const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

const getApiBaseUrl = (): string => {
  // In production, use the same host as the frontend
  if (window.location.hostname.includes('launchpulse.ai') || window.location.hostname.includes('trycloudflare.com')) {
    return `${window.location.protocol}//${window.location.host}`;
  }
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
};

// Retry mechanism for failed requests
const retryRequest = async (fn: () => Promise<any>, maxRetries = 3, delay = 1000): Promise<any> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = i === maxRetries - 1;
      const shouldRetry = error.response?.status >= 500 || error.code === 'ECONNABORTED' || !error.response;
      
      if (isLastAttempt || !shouldRetry) {
        throw error;
      }
      
      console.warn(`Request failed, retrying in ${delay}ms... (attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1))); // Exponential backoff
    }
  }
};

// Configure axios defaults with enhanced browser testing support
axios.defaults.timeout = 45000; // 45 second timeout for better reliability
axios.defaults.headers.common['Content-Type'] = 'application/json';
axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.withCredentials = true;
axios.defaults.maxRedirects = 5; // Handle redirects
axios.defaults.validateStatus = (status) => status < 500; // Don't throw on 4xx

// Enhanced retry configuration for better reliability
axios.defaults.retry = 3;
axios.defaults.retryDelay = 1000;

// Enhanced browser testing detection and headers
if (typeof window !== 'undefined') {
  const userAgent = window.navigator.userAgent;
  const isBrowserTest = userAgent.includes('HeadlessChrome') ||
                       userAgent.includes('PhantomJS') ||
                       userAgent.includes('Selenium') ||
                       userAgent.includes('Playwright') ||
                       userAgent.includes('Puppeteer') ||
                       userAgent.includes('Chrome-Lighthouse') ||
                       userAgent.includes('jsdom') ||
                       window.location.hostname.includes('test') ||
                       window.location.search.includes('test=true');
  
  if (isBrowserTest) {
    axios.defaults.headers.common['X-Automation'] = 'true';
    axios.defaults.headers.common['X-Test-Mode'] = 'browser-testing';
    axios.defaults.headers.common['X-Browser-Test'] = 'true';
    axios.defaults.headers.common['X-Testing-Framework'] = 'browser-automation';
    
    console.log('Browser testing mode detected:', {
      userAgent: userAgent.substring(0, 50),
      hostname: window.location.hostname,
      testMode: 'active'
    });
  }
}

// Request interceptor to add auth token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('pulsedeck-app-storage');
    if (token) {
      try {
        const parsed = JSON.parse(token);
        const authToken = parsed?.state?.authentication_state?.auth_token;
        if (authToken) {
          config.headers.Authorization = `Bearer ${authToken}`;
        }
      } catch (error) {
        console.warn('Failed to parse stored auth token:', error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors consistently
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method
    });

    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      if (status === 401) {
        // Unauthorized - clear auth state
        localStorage.removeItem('pulsedeck-app-storage');
        // window.location.href = '/signin';
        return Promise.reject(new Error('Session expired. Please sign in again.'));
      }
      
      if (status === 403) {
        return Promise.reject(new Error(data?.message || 'Access denied'));
      }
      
      if (status === 429) {
        return Promise.reject(new Error('Too many requests. Please wait a moment and try again.'));
      }
      
      if (status >= 500) {
        return Promise.reject(new Error('Server error. Please try again later.'));
      }
      
      // Handle Cloudflare and proxy errors with more specific messages
      if (status === 502) {
        return Promise.reject(new Error('Bad Gateway (502) - Server connection failed. The backend server may be down or unreachable.'));
      }
      if (status === 503) {
        return Promise.reject(new Error('Service Unavailable (503) - Server is temporarily down. Please wait a moment and try again.'));
      }
      if (status === 504) {
        return Promise.reject(new Error('Gateway Timeout (504) - Server took too long to respond. This may indicate server overload.'));
      }
      if (status === 521) {
        return Promise.reject(new Error('Web Server Is Down (521) - Cloudflare could not connect to the origin server.'));
      }
      if (status === 522) {
        return Promise.reject(new Error('Connection Timed Out (522) - Cloudflare timed out connecting to the origin server.'));
      }
      if (status === 523) {
        return Promise.reject(new Error('Origin Is Unreachable (523) - Cloudflare could not reach the origin server.'));
      }
      if (status === 524) {
        return Promise.reject(new Error('A Timeout Occurred (524) - Cloudflare was able to complete a TCP connection but did not receive a timely HTTP response.'));
      }
      
      return Promise.reject(new Error(data?.message || `Request failed with status ${status}`));
    } else if (error.request) {
      // Network error or timeout
      if (error.code === 'ECONNABORTED') {
        return Promise.reject(new Error('Request timeout. Please try again.'));
      }
      return Promise.reject(new Error('Network error. Please check your connection and try again.'));
    } else {
      // Other error
      return Promise.reject(new Error(error.message || 'An unexpected error occurred'));
    }
  }
);

// ========================
// ZUSTAND STORE
// ========================

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ========================
      // INITIAL STATE
      // ========================
      authentication_state: {
        current_user: null,
        auth_token: null,
        authentication_status: {
          is_authenticated: false,
          is_loading: true,
        },
        error_message: null,
      },

      current_workspace: null,

      date_range_filter: {
        date_from: null,
        date_to: null,
        date_preset: 'last_30_days',
        comparison_mode: null,
      },

      platform_filter: {
        selected_platforms: [],
        selected_accounts: [],
      },

      notification_state: {
        alerts: [],
        toast_notifications: [],
      },

      upload_state: {
        active_uploads: [],
        recent_uploads: [],
      },

      socket: null,
      is_connected: false,

      // ========================
      // AUTHENTICATION ACTIONS
      // ========================
      login_user: async (email: string, password: string) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            authentication_status: {
              ...state.authentication_state.authentication_status,
              is_loading: true,
            },
            error_message: null,
          },
        }));

        try {
          // First test API connectivity with retry
          await retryRequest(async () => {
            const response = await axios.get(`${getApiBaseUrl()}/api/health`, { 
              timeout: 10000,
              headers: { 
                'X-Browser-Test': 'login-connectivity-check',
                'X-Test-Mode': 'pre-login-health-check'
              }
            });
            
            // Enhanced health check validation
            if (!response.data) {
              throw new Error('API health check returned no data');
            }
            
            if (response.data.status !== 'healthy' && !response.data.success) {
              throw new Error(`API health check failed: ${response.data.message || 'Unknown error'}`);
            }
            
            // Check specific health indicators
            if (response.data.checks && response.data.checks.database === false) {
              throw new Error('Database connection failed during health check');
            }
            
            console.log('API connectivity verified:', response.data.status || response.data.message);
          }, 3, 1500);

          // Perform login with retry
          const response = await retryRequest(async () => {
            return await axios.post(
              `${getApiBaseUrl()}/api/auth/login`,
              { email, password },
              { 
                headers: { 
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                timeout: 15000, // 15 second timeout for login
                validateStatus: (status) => status < 500 // Don't retry on 4xx errors
              }
            );
          }, 3, 1000);

          // Check if response indicates an error (4xx status codes)
          if (response.status >= 400 && response.status < 500) {
            const errorData = response.data;
            if (errorData && errorData.message) {
              throw new Error(errorData.message);
            } else {
              throw new Error(`Request failed with status ${response.status}`);
            }
          }

          const { user, token, workspace } = response.data;

          if (!user || !token) {
            throw new Error('Invalid response from server');
          }

          set(() => ({
            authentication_state: {
              current_user: user,
              auth_token: token,
              authentication_status: {
                is_authenticated: true,
                is_loading: false,
              },
              error_message: null,
            },
            current_workspace: workspace ? {
              id: workspace.id,
              name: workspace.name,
              role: 'owner', // Default role, should be from membership
              created_at: workspace.created_at,
            } : null,
          }));

          // Connect WebSocket after successful login
          get().connect_websocket();

        } catch (error: any) {
          console.error('Login error:', error);
          let errorMessage = 'Login failed';
          
          // Extract error message from server response if available
          if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
          } else if (error.message.includes('Network error') || error.message.includes('timeout')) {
            errorMessage = 'Connection failed. Please check your internet connection and try again.';
          } else if (error.message.includes('Service temporarily unavailable')) {
            errorMessage = 'Service is temporarily unavailable. Please try again in a few moments.';
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          set(() => ({
            authentication_state: {
              current_user: null,
              auth_token: null,
              authentication_status: {
                is_authenticated: false,
                is_loading: false,
              },
              error_message: errorMessage,
            },
          }));
          throw new Error(errorMessage);
        }
      },

      register_user: async (email: string, password: string, name: string) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            authentication_status: {
              ...state.authentication_state.authentication_status,
              is_loading: true,
            },
            error_message: null,
          },
        }));

        try {
          const response = await axios.post(
            `${getApiBaseUrl()}/api/auth/register`,
            { email, password, name },
            { headers: { 'Content-Type': 'application/json' } }
          );

          const { user, token, workspace } = response.data;

          set(() => ({
            authentication_state: {
              current_user: user,
              auth_token: token,
              authentication_status: {
                is_authenticated: true,
                is_loading: false,
              },
              error_message: null,
            },
            current_workspace: workspace ? {
              id: workspace.id,
              name: workspace.name,
              role: 'owner',
              created_at: workspace.created_at,
            } : null,
          }));

          // Connect WebSocket after successful registration
          get().connect_websocket();

        } catch (error: any) {
          const errorMessage = error.response?.data?.message || error.message || 'Registration failed';
          
          set(() => ({
            authentication_state: {
              current_user: null,
              auth_token: null,
              authentication_status: {
                is_authenticated: false,
                is_loading: false,
              },
              error_message: errorMessage,
            },
          }));
          throw new Error(errorMessage);
        }
      },

      initialize_auth: async () => {
        const { authentication_state } = get();
        const token = authentication_state.auth_token;
        
        if (!token) {
          set((state) => ({
            authentication_state: {
              ...state.authentication_state,
              authentication_status: {
                ...state.authentication_state.authentication_status,
                is_loading: false,
              },
            },
          }));
          return;
        }

        try {
          // Test API connectivity first
          await axios.get(`${getApiBaseUrl()}/api/health`, { 
            timeout: 8000,
            headers: { 'X-Browser-Test': 'auth-init-check' }
          });

          const response = await axios.get(
            `${getApiBaseUrl()}/api/auth/me`,
            { 
              headers: { Authorization: `Bearer ${token}` },
              timeout: 15000
            }
          );

          const user = response.data;
          
          if (!user || !user.id) {
            throw new Error('Invalid user data received');
          }
          
          set(() => ({
            authentication_state: {
              current_user: user,
              auth_token: token,
              authentication_status: {
                is_authenticated: true,
                is_loading: false,
              },
              error_message: null,
            },
          }));

          // Connect WebSocket after successful auth verification
          get().connect_websocket();

        } catch (error) {
          console.warn('Auth initialization failed:', error);
          // Token is invalid or server unreachable, clear auth state
          set(() => ({
            authentication_state: {
              current_user: null,
              auth_token: null,
              authentication_status: {
                is_authenticated: false,
                is_loading: false,
              },
              error_message: null,
            },
            current_workspace: null,
          }));
        }
      },

      logout_user: () => {
        // Disconnect WebSocket before logout
        get().disconnect_websocket();

        set(() => ({
          authentication_state: {
            current_user: null,
            auth_token: null,
            authentication_status: {
              is_authenticated: false,
              is_loading: false,
            },
            error_message: null,
          },
          current_workspace: null,
          // Clear sensitive data on logout
          notification_state: {
            alerts: [],
            toast_notifications: [],
          },
          upload_state: {
            active_uploads: [],
            recent_uploads: [],
          },
        }));
      },

      clear_auth_error: () => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            error_message: null,
          },
        }));
      },

      update_user_profile: (userData: Partial<User>) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            current_user: state.authentication_state.current_user 
              ? { ...state.authentication_state.current_user, ...userData }
              : null,
          },
        }));
      },

      // ========================
      // WORKSPACE ACTIONS
      // ========================
      switch_workspace: async (workspace_id: string) => {
        const { authentication_state } = get();
        const token = authentication_state.auth_token;

        if (!token) {
          throw new Error('No authentication token available');
        }

        try {
          const response = await axios.get(
            `${getApiBaseUrl()}/api/workspaces/${workspace_id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const workspace = response.data;
          
          set(() => ({
            current_workspace: {
              id: workspace.id,
              name: workspace.name,
              role: 'member', // Should be fetched from membership
              created_at: workspace.created_at,
            },
          }));

          // Reconnect WebSocket with new workspace context
          get().disconnect_websocket();
          get().connect_websocket();

        } catch (error: any) {
          const errorMessage = error.response?.data?.message || error.message || 'Failed to switch workspace';
          throw new Error(errorMessage);
        }
      },

      update_workspace_context: (workspace: WorkspaceContext) => {
        set(() => ({
          current_workspace: workspace,
        }));
      },

      clear_workspace: () => {
        set(() => ({
          current_workspace: null,
        }));
      },

      // ========================
      // FILTER ACTIONS
      // ========================
      update_date_range: (date_from: string | null, date_to: string | null, preset?: string | null) => {
        set((state) => ({
          date_range_filter: {
            ...state.date_range_filter,
            date_from,
            date_to,
            date_preset: preset || (date_from && date_to ? 'custom' : state.date_range_filter.date_preset),
          },
        }));
      },

      update_comparison_mode: (mode: string | null) => {
        set((state) => ({
          date_range_filter: {
            ...state.date_range_filter,
            comparison_mode: mode,
          },
        }));
      },

      update_platform_filter: (platforms: string[], accounts: string[] = []) => {
        set(() => ({
          platform_filter: {
            selected_platforms: platforms,
            selected_accounts: accounts,
          },
        }));
      },

      clear_filters: () => {
        set(() => ({
          date_range_filter: {
            date_from: null,
            date_to: null,
            date_preset: 'last_30_days',
            comparison_mode: null,
          },
          platform_filter: {
            selected_platforms: [],
            selected_accounts: [],
          },
        }));
      },

      // ========================
      // NOTIFICATION ACTIONS
      // ========================
      add_alert_notification: (alert: Omit<AlertNotification, 'id'>) => {
        const newAlert: AlertNotification = {
          ...alert,
          id: generateId(),
        };

        set((state) => ({
          notification_state: {
            ...state.notification_state,
            alerts: [newAlert, ...state.notification_state.alerts],
          },
        }));
      },

      add_toast_notification: (toast: Omit<ToastNotification, 'id'>) => {
        const newToast: ToastNotification = {
          ...toast,
          id: generateId(),
        };

        set((state) => ({
          notification_state: {
            ...state.notification_state,
            toast_notifications: [newToast, ...state.notification_state.toast_notifications],
          },
        }));

        // Auto-dismiss toast if needed
        if (toast.auto_dismiss) {
          setTimeout(() => {
            get().remove_toast_notification(newToast.id);
          }, 5000);
        }
      },

      mark_alert_as_read: (alert_id: string) => {
        set((state) => ({
          notification_state: {
            ...state.notification_state,
            alerts: state.notification_state.alerts.map(alert =>
              alert.id === alert_id ? { ...alert, is_read: true } : alert
            ),
          },
        }));
      },

      remove_toast_notification: (toast_id: string) => {
        set((state) => ({
          notification_state: {
            ...state.notification_state,
            toast_notifications: state.notification_state.toast_notifications.filter(
              toast => toast.id !== toast_id
            ),
          },
        }));
      },

      clear_all_notifications: () => {
        set(() => ({
          notification_state: {
            alerts: [],
            toast_notifications: [],
          },
        }));
      },

      // ========================
      // UPLOAD ACTIONS
      // ========================
      add_active_upload: (upload: UploadProgress) => {
        set((state) => ({
          upload_state: {
            ...state.upload_state,
            active_uploads: [upload, ...state.upload_state.active_uploads],
          },
        }));
      },

      update_upload_progress: (upload_id: string, progress: number, status: string) => {
        set((state) => ({
          upload_state: {
            ...state.upload_state,
            active_uploads: state.upload_state.active_uploads.map(upload =>
              upload.id === upload_id ? { ...upload, progress, status } : upload
            ),
          },
        }));
      },

      complete_upload: (upload_id: string, status: string) => {
        const { upload_state } = get();
        const completedUpload = upload_state.active_uploads.find(upload => upload.id === upload_id);

        if (completedUpload) {
          const recentUpload: RecentUpload = {
            id: completedUpload.id,
            filename: completedUpload.filename,
            status,
            completed_at: new Date().toISOString(),
          };

          set((state) => ({
            upload_state: {
              active_uploads: state.upload_state.active_uploads.filter(upload => upload.id !== upload_id),
              recent_uploads: [recentUpload, ...state.upload_state.recent_uploads.slice(0, 4)], // Keep last 5
            },
          }));
        }
      },

      remove_active_upload: (upload_id: string) => {
        set((state) => ({
          upload_state: {
            ...state.upload_state,
            active_uploads: state.upload_state.active_uploads.filter(upload => upload.id !== upload_id),
          },
        }));
      },

      // ========================
      // WEBSOCKET ACTIONS
      // ========================
      connect_websocket: () => {
        const { authentication_state, current_workspace, socket } = get();
        
        // Don't connect if not authenticated or already connected
        if (!authentication_state.auth_token || socket?.connected) {
          return;
        }

        try {
          const newSocket = io(getApiBaseUrl(), {
            auth: {
              token: authentication_state.auth_token,
              workspace_id: current_workspace?.id,
            },
            transports: ['websocket'],
          });

          newSocket.on('connect', () => {
            set(() => ({ is_connected: true }));
            
            // Join workspace room if available
            if (current_workspace?.id) {
              newSocket.emit('join_workspace', current_workspace.id);
            }
          });

          newSocket.on('disconnect', () => {
            set(() => ({ is_connected: false }));
          });

          newSocket.on('upload_progress', (data) => {
            get().handle_upload_progress(data);
          });

          newSocket.on('notification', (data) => {
            get().handle_notification(data);
          });

          newSocket.on('alert_triggered', (data) => {
            get().add_alert_notification({
              type: 'alert',
              message: data.message,
              created_at: data.triggered_at,
              is_read: false,
            });
          });

          set({ socket: newSocket });

        } catch (error) {
          console.error('WebSocket connection failed:', error);
        }
      },

      disconnect_websocket: () => {
        const { socket } = get();
        
        if (socket) {
          socket.disconnect();
          set({
            socket: null,
            is_connected: false,
          });
        }
      },

      handle_upload_progress: (data: any) => {
        const { id, progress, status } = data;
        
        if (status === 'completed' || status === 'failed') {
          get().complete_upload(id, status);
        } else {
          get().update_upload_progress(id, progress, status);
        }
      },

      handle_notification: (data: any) => {
        const { type, message, auto_dismiss = true } = data;
        
        get().add_toast_notification({
          type,
          message,
          auto_dismiss,
        });
      },
    }),
    {
      name: 'pulsedeck-app-storage',
      partialize: (state) => ({
        authentication_state: {
          current_user: state.authentication_state.current_user,
          auth_token: state.authentication_state.auth_token,
          authentication_status: {
            is_authenticated: state.authentication_state.authentication_status.is_authenticated,
            is_loading: false, // Never persist loading state
          },
          error_message: null, // Never persist errors
        },
        current_workspace: state.current_workspace,
        date_range_filter: state.date_range_filter,
        platform_filter: state.platform_filter,
        // Note: Don't persist notifications or uploads - they should be fresh on reload
      }),
    }
  )
);

// ========================
// EXPORT TYPES
// ========================
export type {
  User,
  Workspace,
  WorkspaceContext,
  AuthenticationState,
  DateRangeFilter,
  PlatformFilter,
  AlertNotification,
  ToastNotification,
  NotificationState,
  UploadProgress,
  RecentUpload,
  UploadState,
  AppStore,
};
