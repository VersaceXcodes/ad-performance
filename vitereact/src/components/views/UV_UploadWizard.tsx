import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// Types and Interfaces
interface FileWithValidation {
  file: File;
  validation_status: 'valid' | 'invalid' | 'pending';
  error_message: string | null;
  size: number;
  type: string;
}

interface UploadProgress {
  current_step: string;
  progress_percentage: number;
  estimated_completion: string | null;
  rows_processed: number;
  rows_total: number;
}

interface MappingTemplate {
  id: string;
  name: string;
  platform: string;
  mapping: Record<string, any>;
  is_default: boolean;
}

interface UploadJob {
  id: string;
  workspace_id: string;
  user_id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  platform: string;
  status: string;
  progress: number;
  rows_processed: number;
  rows_total: number;
  rows_success: number;
  rows_error: number;
  error_text: string | null;
  error_log_url?: string | null;
  created_at: string;
  updated_at: string;
}

const PLATFORMS = [
  { id: 'facebook', name: 'Meta (Facebook)', icon: '📘', description: 'Facebook Ads Manager exports' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', description: 'TikTok Ads Manager exports' },
  { id: 'snapchat', name: 'Snapchat', icon: '👻', description: 'Snapchat Ads Manager exports' },
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['.csv', '.xlsx'];

const UV_UploadWizard: React.FC = () => {
  const { workspace_id } = useParams<{ workspace_id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global state
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const addActiveUpload = useAppStore(state => state.add_active_upload);
  const updateUploadProgress = useAppStore(state => state.update_upload_progress);
  const completeUpload = useAppStore(state => state.complete_upload);
  const addToastNotification = useAppStore(state => state.add_toast_notification);

  // Local state
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [selectedFiles, setSelectedFiles] = useState<FileWithValidation[]>([]);
  const [platformSelection, setPlatformSelection] = useState<string>('');
  const [dateRangeConfig, setDateRangeConfig] = useState<{
    date_from: string | null;
    date_to: string | null;
  }>({ date_from: null, date_to: null });
  const [mappingTemplateSelection, setMappingTemplateSelection] = useState<MappingTemplate | null>(null);
  const [uploadJob, setUploadJob] = useState<UploadJob | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    current_step: '',
    progress_percentage: 0,
    estimated_completion: null,
    rows_processed: 0,
    rows_total: 0,
  });
  const [isDragOver, setIsDragOver] = useState(false);

  // Initialize from URL params
  useEffect(() => {
    const step = searchParams.get('step');
    
    if (step) {
      const stepNumber = parseInt(step);
      if (stepNumber >= 1 && stepNumber <= 5) {
        setWizardStep(stepNumber);
      }
    }
  }, [searchParams]);

  // API Base URL
  const getApiBaseUrl = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Fetch mapping templates
  const { data: mappingTemplates = [] } = useQuery({
    queryKey: ['mapping-templates', workspace_id, platformSelection],
    queryFn: async () => {
      if (!platformSelection) return [];
      
      const response = await axios.get(
        `${getApiBaseUrl()}/api/workspaces/${workspace_id}/mapping-templates`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          params: { platform: platformSelection, limit: 50 }
        }
      );
      return response.data.data || [];
    },
    enabled: !!platformSelection && !!authToken && !!workspace_id,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch upload job
  const fetchUploadJob = useCallback(async (uploadId: string) => {
    try {
      const response = await axios.get(
        `${getApiBaseUrl()}/api/workspaces/${workspace_id}/uploads/${uploadId}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      setUploadJob(response.data);
      setUploadProgress({
        current_step: response.data.status,
        progress_percentage: response.data.progress,
        estimated_completion: null,
        rows_processed: response.data.rows_processed,
        rows_total: response.data.rows_total,
      });
    } catch (error) {
      console.error('Failed to fetch upload job:', error);
    }
  }, [workspace_id, authToken]);

  // Fetch existing upload job if upload_id is in URL
  useEffect(() => {
    const uploadId = searchParams.get('upload_id');
    if (uploadId && !uploadJob) {
      fetchUploadJob(uploadId);
    }
  }, [searchParams, fetchUploadJob, uploadJob]);

  // Create upload mutation
  const createUploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFiles.length || !platformSelection) {
        throw new Error('Missing required data');
      }

      const formData = new FormData();
      formData.append('file', selectedFiles[0].file);
      formData.append('platform', platformSelection);
      
      if (mappingTemplateSelection?.id) {
        formData.append('mapping_template_id', mappingTemplateSelection.id);
      }
      
      if (dateRangeConfig.date_from) {
        formData.append('date_from', dateRangeConfig.date_from);
      }
      
      if (dateRangeConfig.date_to) {
        formData.append('date_to', dateRangeConfig.date_to);
      }

      const response = await axios.post(
        `${getApiBaseUrl()}/api/workspaces/${workspace_id}/uploads`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data;
    },
    onSuccess: (data) => {
      setUploadJob(data);
      setUploadProgress({
        current_step: data.status,
        progress_percentage: data.progress,
        estimated_completion: null,
        rows_processed: data.rows_processed,
        rows_total: data.rows_total,
      });

      addActiveUpload({
        id: data.id,
        filename: data.original_filename,
        status: data.status,
        progress: data.progress,
        platform: data.platform,
      });

      setSearchParams(prev => {
        prev.set('upload_id', data.id);
        prev.set('step', '4');
        return prev;
      });
      setWizardStep(4);

      addToastNotification({
        type: 'success',
        message: 'Upload started successfully',
        auto_dismiss: true,
      });
    },
    onError: (error: any) => {
      addToastNotification({
        type: 'error',
        message: error.response?.data?.message || 'Upload failed',
        auto_dismiss: true,
      });
    },
  });

  // Progress tracking query
  const { data: progressData } = useQuery({
    queryKey: ['upload-progress', uploadJob?.id],
    queryFn: async () => {
      if (!uploadJob?.id) return null;
      
      const response = await axios.get(
        `${getApiBaseUrl()}/api/workspaces/${workspace_id}/uploads/${uploadJob.id}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    enabled: !!uploadJob?.id && !!authToken,
    refetchInterval: (query) => {
      // Stop polling if completed or failed
      if (query?.state?.data?.status === 'completed' || query?.state?.data?.status === 'failed') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
  });

  // Update progress when data changes
  useEffect(() => {
    if (progressData) {
      setUploadJob(progressData);
      setUploadProgress({
        current_step: progressData.status,
        progress_percentage: progressData.progress,
        estimated_completion: null,
        rows_processed: progressData.rows_processed,
        rows_total: progressData.rows_total,
      });

      updateUploadProgress(progressData.id, progressData.progress, progressData.status);

      if (progressData.status === 'completed' || progressData.status === 'failed') {
        completeUpload(progressData.id, progressData.status);
        setWizardStep(5);
        setSearchParams(prev => {
          prev.set('step', '5');
          return prev;
        });
      }
    }
  }, [progressData, completeUpload, setSearchParams, updateUploadProgress]);

  // File validation
  const validateFile = (file: File): { isValid: boolean; error: string | null } => {
    if (file.size > MAX_FILE_SIZE) {
      return { isValid: false, error: 'File size exceeds 50MB limit' };
    }

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(extension)) {
      return { isValid: false, error: 'Only CSV and XLSX files are allowed' };
    }

    return { isValid: true, error: null };
  };

  // File handlers
  const handleFileSelect = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    if (fileArray.length === 0) {
      addToastNotification({
        type: 'error',
        message: 'No files selected',
        auto_dismiss: true,
      });
      return;
    }
    
    const validatedFiles: FileWithValidation[] = fileArray.map(file => {
      const validation = validateFile(file);
      return {
        file,
        validation_status: validation.isValid ? 'valid' : 'invalid',
        error_message: validation.error,
        size: file.size,
        type: file.type,
      };
    });

    setSelectedFiles(validatedFiles);
    
    const invalidFiles = validatedFiles.filter(f => f.validation_status === 'invalid');
    if (invalidFiles.length > 0) {
      addToastNotification({
        type: 'warning',
        message: `${invalidFiles.length} file(s) failed validation`,
        auto_dismiss: true,
      });
    }
  }, [addToastNotification]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    } else {
      addToastNotification({
        type: 'error',
        message: 'No files were dropped',
        auto_dismiss: true,
      });
    }
  }, [handleFileSelect, addToastNotification]);

  // Navigation helpers
  const updateStep = (step: number) => {
    setWizardStep(step);
    setSearchParams(prev => {
      prev.set('step', step.toString());
      return prev;
    });
  };

  const canProceedToStep = (step: number): boolean => {
    switch (step) {
      case 2: return selectedFiles.length > 0 && selectedFiles[0].validation_status === 'valid';
      case 3: return !!platformSelection;
      case 4: return !!platformSelection && selectedFiles.length > 0;
      default: return true;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__testHelpers = {
        ...(window as any).__testHelpers,
        selectTestFile: (filename: string = 'test-data.csv', content: string = 'campaign_name,impressions,clicks\nTest,1000,50') => {
          const blob = new Blob([content], { type: 'text/csv' });
          const file = new File([blob], filename, { type: 'text/csv' });
          handleFileSelect([file]);
        },
        getCurrentStep: () => wizardStep,
        hasValidFiles: () => selectedFiles.length > 0 && selectedFiles[0].validation_status === 'valid'
      };
    }
  }, [handleFileSelect, wizardStep, selectedFiles]);

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <nav className="text-sm text-gray-500 mb-4">
              <Link to={`/w/${workspace_id}`} className="hover:text-blue-600 transition-colors">
                Dashboard
              </Link>
              <span className="mx-2">/</span>
              <Link to={`/w/${workspace_id}/uploads`} className="hover:text-blue-600 transition-colors">
                Uploads
              </Link>
              <span className="mx-2">/</span>
              <span className="text-gray-900">Upload Wizard</span>
            </nav>
            
            <h1 className="text-3xl font-bold text-gray-900">Upload Data</h1>
            <p className="mt-2 text-gray-600">
              Follow the steps below to upload and process your advertising data
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            <nav aria-label="Progress">
              <ol className="flex items-center">
                {[
                  { id: 1, name: 'Select Files', desc: 'Choose your data files' },
                  { id: 2, name: 'Choose Platform', desc: 'Select data source' },
                  { id: 3, name: 'Configure', desc: 'Set options and mapping' },
                  { id: 4, name: 'Processing', desc: 'Upload and process data' },
                  { id: 5, name: 'Complete', desc: 'Review results' },
                ].map((step, stepIdx) => (
                  <li key={step.id} className={`relative ${stepIdx !== 4 ? 'pr-8 sm:pr-20' : ''}`}>
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      {stepIdx !== 4 && (
                        <div className={`h-0.5 w-full ${wizardStep > step.id ? 'bg-blue-600' : 'bg-gray-200'}`} />
                      )}
                    </div>
                    <button
                      onClick={() => canProceedToStep(step.id) && updateStep(step.id)}
                      disabled={!canProceedToStep(step.id)}
                      className={`relative w-8 h-8 flex items-center justify-center rounded-full border-2 ${
                        wizardStep === step.id
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : wizardStep > step.id
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-gray-300 bg-white text-gray-500'
                      } ${canProceedToStep(step.id) ? 'hover:border-blue-400 cursor-pointer' : 'cursor-not-allowed'}`}
                    >
                      {wizardStep > step.id ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span className="text-sm font-medium">{step.id}</span>
                      )}
                    </button>
                    <div className="ml-10 sm:ml-4 mt-2 sm:mt-0 sm:absolute sm:top-0 sm:left-10">
                      <p className="text-sm font-medium text-gray-900">{step.name}</p>
                      <p className="text-xs text-gray-500">{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </nav>
          </div>

          {/* Step Content */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Step 1: File Selection */}
            {wizardStep === 1 && (
              <div className="p-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">Select Your Data Files</h2>
                
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragOver
                      ? 'border-blue-500 bg-blue-50'
                      : selectedFiles.length > 0
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  data-testid="file-drop-zone"
                  data-has-files={selectedFiles.length > 0}
                >
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-lg font-medium text-gray-900">Drop your files here</p>
                      <p className="text-gray-600">or click to browse</p>
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        aria-label="Choose files to upload"
                        data-testid="file-upload-button"
                        id="file-upload-trigger-button"
                      >
                        Choose Files
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".csv,.xlsx"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleFileSelect(e.target.files);
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        aria-label="File upload input"
                        data-testid="file-upload-input"
                        id="file-upload-input"
                        name="file"
                        title="Upload file"
                        style={{ width: '100%', height: '100%' }}
                      />
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-gray-500">
                    Supports CSV and XLSX files up to 50MB
                  </p>
                </div>

                {/* File List */}
                {selectedFiles.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Selected Files</h3>
                    <div className="space-y-3">
                      {selectedFiles.map((fileWithValidation, index) => (
                        <div key={index} className={`flex items-center justify-between p-4 rounded-lg border ${
                          fileWithValidation.validation_status === 'valid'
                            ? 'border-green-200 bg-green-50'
                            : 'border-red-200 bg-red-50'
                        }`}>
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              fileWithValidation.validation_status === 'valid'
                                ? 'bg-green-100 text-green-600'
                                : 'bg-red-100 text-red-600'
                            }`}>
                              {fileWithValidation.validation_status === 'valid' ? (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{fileWithValidation.file.name}</p>
                              <p className="text-sm text-gray-600">{formatFileSize(fileWithValidation.size)}</p>
                              {fileWithValidation.error_message && (
                                <p className="text-sm text-red-600">{fileWithValidation.error_message}</p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedFiles(files => files.filter((_, i) => i !== index))}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end mt-8">
                  <button
                    type="button"
                    onClick={() => updateStep(2)}
                    disabled={!canProceedToStep(2)}
                    aria-label="Continue to platform selection"
                    aria-disabled={!canProceedToStep(2)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    id="continue-to-platform-button"
                    data-testid="continue-button"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Platform Selection */}
            {wizardStep === 2 && (
              <div className="p-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">Choose Data Platform</h2>
                <p className="text-gray-600 mb-8">
                  Select the advertising platform where your data originated from
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {PLATFORMS.map((platform) => (
                    <label key={platform.id} className="relative cursor-pointer">
                      <input
                        type="radio"
                        name="platform"
                        value={platform.id}
                        checked={platformSelection === platform.id}
                        onChange={(e) => setPlatformSelection(e.target.value)}
                        className="sr-only"
                      />
                      <div className={`p-6 rounded-xl border-2 transition-all hover:shadow-md ${
                        platformSelection === platform.id
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <div className="text-center">
                          <div className="text-4xl mb-4">{platform.icon}</div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">{platform.name}</h3>
                          <p className="text-sm text-gray-600">{platform.description}</p>
                        </div>
                        {platformSelection === platform.id && (
                          <div className="absolute top-4 right-4">
                            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex justify-between mt-8">
                  <button
                    type="button"
                    onClick={() => updateStep(1)}
                    aria-label="Go back to file selection"
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStep(3)}
                    disabled={!canProceedToStep(3)}
                    aria-label="Continue to configuration"
                    aria-disabled={!canProceedToStep(3)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Configuration */}
            {wizardStep === 3 && (
              <div className="p-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">Configure Upload</h2>
                
                <div className="space-y-8">
                  {/* Date Range */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Date Range (Optional)</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Specify the date range for data validation and filtering
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="date_from" className="block text-sm font-medium text-gray-700 mb-2">
                          From Date
                        </label>
                        <input
                          type="date"
                          id="date_from"
                          value={dateRangeConfig.date_from || ''}
                          onChange={(e) => setDateRangeConfig(prev => ({ ...prev, date_from: e.target.value || null }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="date_to" className="block text-sm font-medium text-gray-700 mb-2">
                          To Date
                        </label>
                        <input
                          type="date"
                          id="date_to"
                          value={dateRangeConfig.date_to || ''}
                          onChange={(e) => setDateRangeConfig(prev => ({ ...prev, date_to: e.target.value || null }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Mapping Templates */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Mapping Template (Optional)</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Choose a pre-configured mapping template for faster processing
                    </p>
                    
                    {mappingTemplates.length > 0 ? (
                      <div className="space-y-3">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="mapping_template"
                            checked={!mappingTemplateSelection}
                            onChange={() => setMappingTemplateSelection(null)}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <span className="ml-3 text-sm text-gray-700">Auto-detect columns (recommended)</span>
                        </label>
                        
                        {mappingTemplates.map((template) => (
                          <label key={template.id} className="flex items-start">
                            <input
                              type="radio"
                              name="mapping_template"
                              checked={mappingTemplateSelection?.id === template.id}
                              onChange={() => setMappingTemplateSelection(template)}
                              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 mt-1"
                            />
                            <div className="ml-3">
                              <span className="text-sm font-medium text-gray-900">{template.name}</span>
                              {template.is_default && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  Default
                                </span>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                Platform: {template.platform}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        No mapping templates available for {platformSelection}. Auto-detection will be used.
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between mt-8">
                  <button
                    type="button"
                    onClick={() => updateStep(2)}
                    aria-label="Go back to platform selection"
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => createUploadMutation.mutate()}
                    disabled={createUploadMutation.isPending}
                    aria-label="Start upload process"
                    aria-disabled={createUploadMutation.isPending}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {createUploadMutation.isPending ? 'Starting Upload...' : 'Start Upload'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Processing */}
            {wizardStep === 4 && (
              <div className="p-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">Processing Upload</h2>
                
                <div className="space-y-6">
                  {/* Overall Progress */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                      <span className="text-sm text-gray-500">{uploadProgress.progress_percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress.progress_percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Status Information */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Current Status</h4>
                        <p className="text-lg font-semibold text-gray-900 capitalize">
                          {uploadProgress.current_step.replace('_', ' ')}
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Rows Processed</h4>
                        <p className="text-lg font-semibold text-gray-900">
                          {uploadProgress.rows_processed.toLocaleString()} / {uploadProgress.rows_total.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* File Information */}
                  {uploadJob && (
                    <div className="bg-blue-50 rounded-lg p-6">
                      <h4 className="text-sm font-medium text-blue-700 mb-4">Upload Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-blue-600">Filename:</span>
                          <span className="text-blue-900 font-medium">{uploadJob.original_filename}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-600">Platform:</span>
                          <span className="text-blue-900 font-medium capitalize">{uploadJob.platform}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-600">File Size:</span>
                          <span className="text-blue-900 font-medium">{formatFileSize(uploadJob.file_size)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-600">Started:</span>
                          <span className="text-blue-900 font-medium">
                            {new Date(uploadJob.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Processing Stages */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-4">Processing Stages</h4>
                    <div className="space-y-3">
                      {[
                        { stage: 'queued', label: 'Queued', desc: 'Upload queued for processing' },
                        { stage: 'processing', label: 'Processing', desc: 'Parsing and validating data' },
                        { stage: 'completed', label: 'Completed', desc: 'Data successfully processed' },
                      ].map((stage) => {
                        const isActive = uploadProgress.current_step === stage.stage;
                        const isCompleted = ['processing', 'completed'].includes(uploadProgress.current_step) && 
                                          (['queued'].includes(stage.stage) || 
                                           (stage.stage === 'processing' && uploadProgress.current_step === 'completed'));
                        
                        return (
                          <div key={stage.stage} className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              isCompleted
                                ? 'bg-green-100 text-green-600'
                                : isActive
                                ? 'bg-blue-100 text-blue-600'
                                : 'bg-gray-100 text-gray-400'
                            }`}>
                              {isCompleted ? (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              ) : isActive ? (
                                <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
                              ) : (
                                <div className="w-2 h-2 bg-current rounded-full" />
                              )}
                            </div>
                            <div className="ml-4">
                              <p className={`text-sm font-medium ${
                                isCompleted || isActive ? 'text-gray-900' : 'text-gray-500'
                              }`}>
                                {stage.label}
                              </p>
                              <p className="text-xs text-gray-500">{stage.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Completion */}
            {wizardStep === 5 && uploadJob && (
              <div className="p-8">
                <div className="text-center mb-8">
                  {uploadJob.status === 'completed' ? (
                    <>
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <h2 className="text-2xl font-semibold text-gray-900 mb-2">Upload Completed!</h2>
                      <p className="text-gray-600">Your data has been successfully processed and is now available in your dashboard.</p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <h2 className="text-2xl font-semibold text-gray-900 mb-2">Upload Failed</h2>
                      <p className="text-gray-600">There was an issue processing your data. Please check the details below.</p>
                    </>
                  )}
                </div>

                {/* Results Summary */}
                <div className="bg-gray-50 rounded-lg p-6 mb-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Processing Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{uploadJob.rows_total.toLocaleString()}</p>
                      <p className="text-sm text-gray-600">Total Rows</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{uploadJob.rows_success.toLocaleString()}</p>
                      <p className="text-sm text-gray-600">Successful</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{uploadJob.rows_error.toLocaleString()}</p>
                      <p className="text-sm text-gray-600">Errors</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{uploadJob.progress}%</p>
                      <p className="text-sm text-gray-600">Processed</p>
                    </div>
                  </div>
                </div>

                {/* Error Information */}
                {uploadJob.status === 'failed' && uploadJob.error_text && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
                    <h3 className="text-lg font-medium text-red-800 mb-2">Error Details</h3>
                    <p className="text-red-700">{uploadJob.error_text}</p>
                    {uploadJob.error_log_url && (
                      <a
                        href={uploadJob.error_log_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center mt-4 text-sm text-red-600 hover:text-red-500"
                      >
                        Download Error Log
                        <svg className="ml-1 w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </a>
                    )}
                  </div>
                )}

                {/* Next Steps */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  {uploadJob.status === 'completed' ? (
                    <>
                      <Link
                        to={`/w/${workspace_id}`}
                        className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        View Dashboard
                      </Link>
                      <Link
                        to={`/w/${workspace_id}/campaigns`}
                        className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        View Campaigns
                      </Link>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setWizardStep(1);
                          setSelectedFiles([]);
                          setPlatformSelection('');
                          setUploadJob(null);
                          setSearchParams({});
                        }}
                        className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        Try Again
                      </button>
                      <Link
                        to={`/w/${workspace_id}/uploads`}
                        className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        View All Uploads
                      </Link>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_UploadWizard;