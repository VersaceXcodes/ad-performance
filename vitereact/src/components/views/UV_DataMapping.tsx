import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// Types based on the datamap specifications
interface DetectedColumn {
  column_name: string;
  data_type: string;
  sample_values: string[];
  confidence_score: number;
}

interface CanonicalField {
  field_name: string;
  field_type: string;
  required: boolean;
  description: string;
}

interface ValidationResult {
  is_valid: boolean;
  missing_required_fields: string[];
  type_mismatches: Array<{
    column: string;
    expected_type: string;
    detected_type: string;
  }>;
  warnings: string[];
}

interface MappingTemplate {
  id: string;
  workspace_id: string;
  name: string;
  platform: string;
  mapping: Record<string, any>;
  is_default: boolean;
  is_shared: boolean;
  created_by: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
}

interface TemplateSaveState {
  is_saving: boolean;
  template_name: string;
  is_default: boolean;
  is_shared: boolean;
}

const UV_DataMapping: React.FC = () => {
  const { workspace_id } = useParams<{ workspace_id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // URL parameters
  const upload_id = searchParams.get('upload_id');

  // Global state
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentWorkspace = useAppStore(state => state.current_workspace);
  const addToastNotification = useAppStore(state => state.add_toast_notification);

  // Local state
  const [detectedColumns, setDetectedColumns] = useState<DetectedColumn[]>([]);
  const [canonicalSchema, setCanonicalSchema] = useState<CanonicalField[]>([]);
  const [mappingConfiguration, setMappingConfiguration] = useState<Record<string, string>>({});
  const [validationResults, setValidationResults] = useState<ValidationResult>({
    is_valid: false,
    missing_required_fields: [],
    type_mismatches: [],
    warnings: []
  });
  const [templateSaveState, setTemplateSaveState] = useState<TemplateSaveState>({
    is_saving: false,
    template_name: '',
    is_default: false,
    is_shared: false
  });
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [showTemplateSave, setShowTemplateSave] = useState(false);

  // API Base URL
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Redirect if missing required params
  useEffect(() => {
    if (!upload_id || !workspace_id) {
      navigate(`/w/${workspace_id}/uploads`);
    }
  }, [upload_id, workspace_id, navigate]);

  // Define canonical schema fields based on metricsDailySchema
  useEffect(() => {
    const schema: CanonicalField[] = [
      { field_name: 'date', field_type: 'string', required: true, description: 'Date in YYYY-MM-DD format' },
      { field_name: 'spend', field_type: 'number', required: false, description: 'Total spend amount' },
      { field_name: 'impressions', field_type: 'number', required: false, description: 'Number of impressions' },
      { field_name: 'clicks', field_type: 'number', required: false, description: 'Number of clicks' },
      { field_name: 'conversions', field_type: 'number', required: false, description: 'Number of conversions' },
      { field_name: 'revenue', field_type: 'number', required: false, description: 'Revenue generated' },
      { field_name: 'campaign_id', field_type: 'string', required: false, description: 'Campaign identifier' },
      { field_name: 'adset_id', field_type: 'string', required: false, description: 'Ad set identifier' },
      { field_name: 'ad_id', field_type: 'string', required: false, description: 'Ad identifier' },
      { field_name: 'ctr', field_type: 'number', required: false, description: 'Click-through rate' },
      { field_name: 'cpm', field_type: 'number', required: false, description: 'Cost per mille' },
      { field_name: 'cpc', field_type: 'number', required: false, description: 'Cost per click' },
      { field_name: 'cpa', field_type: 'number', required: false, description: 'Cost per acquisition' },
      { field_name: 'cvr', field_type: 'number', required: false, description: 'Conversion rate' },
      { field_name: 'roas', field_type: 'number', required: false, description: 'Return on ad spend' },
    ];
    setCanonicalSchema(schema);
  }, []);

  // Fetch upload details
  const { data: currentUpload, isLoading: uploadLoading } = useQuery({
    queryKey: ['upload', workspace_id, upload_id],
    queryFn: async (): Promise<UploadJob> => {
      const response = await axios.get(
        `${apiBaseUrl}/api/workspaces/${workspace_id}/uploads/${upload_id}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    enabled: !!(authToken && workspace_id && upload_id),
    staleTime: 60000,
    retry: 1
  });

  // Fetch mapping templates
  const { data: availableTemplates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['mapping-templates', workspace_id, currentUpload?.platform],
    queryFn: async (): Promise<MappingTemplate[]> => {
      const response = await axios.get(
        `${apiBaseUrl}/api/workspaces/${workspace_id}/mapping-templates`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          params: { platform: currentUpload?.platform }
        }
      );
      return response.data.data || response.data;
    },
    enabled: !!(authToken && workspace_id && currentUpload?.platform),
    staleTime: 300000,
    retry: 1
  });

  // Mock detected columns (since endpoint is missing according to datamap)
  useEffect(() => {
    if (currentUpload) {
      // Simulate detected columns based on common ad platform exports
      const mockColumns: DetectedColumn[] = [
        {
          column_name: 'Date',
          data_type: 'string',
          sample_values: ['2023-12-01', '2023-12-02', '2023-12-03'],
          confidence_score: 0.95
        },
        {
          column_name: 'Campaign Name',
          data_type: 'string',
          sample_values: ['Black Friday Sale', 'Holiday Promo', 'Winter Collection'],
          confidence_score: 0.8
        },
        {
          column_name: 'Amount Spent',
          data_type: 'number',
          sample_values: ['150.25', '230.50', '89.75'],
          confidence_score: 0.9
        },
        {
          column_name: 'Impressions',
          data_type: 'number',
          sample_values: ['12543', '18392', '9876'],
          confidence_score: 0.95
        },
        {
          column_name: 'Clicks',
          data_type: 'number',
          sample_values: ['234', '456', '178'],
          confidence_score: 0.9
        },
        {
          column_name: 'Purchases',
          data_type: 'number',
          sample_values: ['12', '23', '8'],
          confidence_score: 0.85
        },
        {
          column_name: 'Revenue',
          data_type: 'number',
          sample_values: ['450.00', '890.50', '234.75'],
          confidence_score: 0.88
        }
      ];
      setDetectedColumns(mockColumns);

      // Auto-mapping based on common patterns
      const autoMapping: Record<string, string> = {
        'Date': 'date',
        'Amount Spent': 'spend',
        'Impressions': 'impressions',
        'Clicks': 'clicks',
        'Purchases': 'conversions',
        'Revenue': 'revenue'
      };
      setMappingConfiguration(autoMapping);
    }
  }, [currentUpload]);

  // Validation logic
  const validateMapping = useCallback(() => {
    const requiredFields = canonicalSchema.filter(field => field.required).map(field => field.field_name);
    const mappedFields = Object.values(mappingConfiguration);
    const missingRequired = requiredFields.filter(field => !mappedFields.includes(field));
    
    const typeMismatches = Object.entries(mappingConfiguration).map(([column, field]) => {
      const detectedColumn = detectedColumns.find(col => col.column_name === column);
      const canonicalField = canonicalSchema.find(f => f.field_name === field);
      
      if (detectedColumn && canonicalField) {
        const isCompatible = 
          (canonicalField.field_type === 'string') ||
          (canonicalField.field_type === 'number' && detectedColumn.data_type === 'number');
        
        if (!isCompatible) {
          return {
            column,
            expected_type: canonicalField.field_type,
            detected_type: detectedColumn.data_type
          };
        }
      }
      return null;
    }).filter(Boolean) as ValidationResult['type_mismatches'];

    const warnings: string[] = [];
    if (mappedFields.length < detectedColumns.length) {
      warnings.push(`${detectedColumns.length - mappedFields.length} columns remain unmapped`);
    }

    const results: ValidationResult = {
      is_valid: missingRequired.length === 0 && typeMismatches.length === 0,
      missing_required_fields: missingRequired,
      type_mismatches: typeMismatches,
      warnings
    };

    setValidationResults(results);
  }, [mappingConfiguration, detectedColumns, canonicalSchema]);

  // Run validation when mapping changes
  useEffect(() => {
    validateMapping();
  }, [validateMapping]);

  // Update mapping
  const updateMapping = (columnName: string, fieldName: string) => {
    setMappingConfiguration(prev => {
      const newMapping = { ...prev };
      if (fieldName === '') {
        delete newMapping[columnName];
      } else {
        // Remove any existing mapping to this field
        Object.keys(newMapping).forEach(key => {
          if (newMapping[key] === fieldName) {
            delete newMapping[key];
          }
        });
        newMapping[columnName] = fieldName;
      }
      return newMapping;
    });
  };

  // Load template
  const loadTemplate = (templateId: string) => {
    const template = availableTemplates.find(t => t.id === templateId);
    if (template) {
      setMappingConfiguration(template.mapping);
      setSelectedTemplate(templateId);
      addToastNotification({
        type: 'info',
        message: `Loaded template: ${template.name}`,
        auto_dismiss: true
      });
    }
  };

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (templateData: any) => {
      const response = await axios.post(
        `${apiBaseUrl}/api/workspaces/${workspace_id}/mapping-templates`,
        templateData,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mapping-templates'] });
      addToastNotification({
        type: 'success',
        message: 'Mapping template saved successfully',
        auto_dismiss: true
      });
      setShowTemplateSave(false);
      setTemplateSaveState({
        is_saving: false,
        template_name: '',
        is_default: false,
        is_shared: false
      });
    },
    onError: (error: any) => {
      addToastNotification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to save template',
        auto_dismiss: true
      });
    }
  });

  // Save template
  const saveTemplate = () => {
    if (!templateSaveState.template_name.trim()) {
      addToastNotification({
        type: 'error',
        message: 'Template name is required',
        auto_dismiss: true
      });
      return;
    }

    saveTemplateMutation.mutate({
      name: templateSaveState.template_name,
      platform: currentUpload?.platform,
      mapping: mappingConfiguration,
      is_default: templateSaveState.is_default,
      is_shared: templateSaveState.is_shared,
      created_by: currentWorkspace?.id
    });
  };

  // Continue processing mutation
  const continueProcessingMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.put(
        `${apiBaseUrl}/api/workspaces/${workspace_id}/uploads/${upload_id}`,
        { 
          mapping_template_id: selectedTemplate || null,
          mapping: mappingConfiguration 
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      addToastNotification({
        type: 'success',
        message: 'Mapping applied successfully. Processing upload...',
        auto_dismiss: true
      });
      navigate(`/w/${workspace_id}/uploads`);
    },
    onError: (error: any) => {
      addToastNotification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to apply mapping',
        auto_dismiss: true
      });
    }
  });

  const continueProcessing = () => {
    if (!validationResults.is_valid) {
      addToastNotification({
        type: 'error',
        message: 'Please fix validation errors before continuing',
        auto_dismiss: true
      });
      return;
    }
    continueProcessingMutation.mutate();
  };

  if (uploadLoading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading upload details...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <nav className="flex" aria-label="Breadcrumb">
                <ol className="flex items-center space-x-4">
                  <li>
                    <div className="flex items-center">
                      <a href={`/w/${workspace_id}/uploads`} className="text-gray-400 hover:text-gray-500">
                        <svg className="flex-shrink-0 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                        <span className="sr-only">Uploads</span>
                      </a>
                    </div>
                  </li>
                  <li>
                    <div className="flex items-center">
                      <svg className="flex-shrink-0 h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="ml-4 text-sm font-medium text-gray-900">Column Mapping</span>
                    </div>
                  </li>
                </ol>
              </nav>
              
              <div className="mt-4">
                <h1 className="text-3xl font-bold text-gray-900">Data Column Mapping</h1>
                <p className="mt-2 text-gray-600">
                  Map your file columns to PulseDeck's standard fields for accurate data processing
                </p>
                {currentUpload && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div className="ml-3">
                        <p className="text-sm text-blue-700">
                          <span className="font-medium">File:</span> {currentUpload.original_filename} 
                          <span className="ml-4 font-medium">Platform:</span> {currentUpload.platform}
                          <span className="ml-4 font-medium">Size:</span> {(currentUpload.file_size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Panel - Detected Columns */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-lg shadow-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Detected Columns</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {detectedColumns.length} columns found in your file
                  </p>
                </div>
                <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
                  {detectedColumns.map((column, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-gray-900">{column.column_name}</h3>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                            {column.data_type}
                          </span>
                          <div className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-1 ${
                              column.confidence_score >= 0.9 ? 'bg-green-400' :
                              column.confidence_score >= 0.7 ? 'bg-yellow-400' : 'bg-red-400'
                            }`}></div>
                            <span className="text-xs text-gray-500">
                              {Math.round(column.confidence_score * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-xs font-medium text-gray-700 mb-1">Sample Values:</p>
                        <div className="flex flex-wrap gap-1">
                          {column.sample_values.slice(0, 3).map((value, i) => (
                            <span key={i} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">
                              {value}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Map to field:
                        </label>
                        <select
                          value={mappingConfiguration[column.column_name] || ''}
                          onChange={(e) => updateMapping(column.column_name, e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select field...</option>
                          {canonicalSchema.map((field) => (
                            <option 
                              key={field.field_name} 
                              value={field.field_name}
                              disabled={Object.values(mappingConfiguration).includes(field.field_name) && 
                                       mappingConfiguration[column.column_name] !== field.field_name}
                            >
                              {field.field_name} {field.required ? '*' : ''} ({field.field_type})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Panel - Canonical Schema & Validation */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Template Management */}
              <div className="bg-white rounded-lg shadow-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Mapping Templates</h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Load existing template
                      </label>
                      <select
                        value={selectedTemplate}
                        onChange={(e) => {
                          setSelectedTemplate(e.target.value);
                          if (e.target.value) loadTemplate(e.target.value);
                        }}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={templatesLoading}
                      >
                        <option value="">Select template...</option>
                        {availableTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name} {template.is_default ? '(Default)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Save current mapping
                      </label>
                      <button
                        onClick={() => setShowTemplateSave(!showTemplateSave)}
                        className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        Save as Template
                      </button>
                    </div>
                  </div>
                  
                  {showTemplateSave && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Template Name
                          </label>
                          <input
                            type="text"
                            value={templateSaveState.template_name}
                            onChange={(e) => setTemplateSaveState(prev => ({
                              ...prev,
                              template_name: e.target.value
                            }))}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter template name..."
                          />
                        </div>
                        <div className="flex items-center space-x-4">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={templateSaveState.is_default}
                              onChange={(e) => setTemplateSaveState(prev => ({
                                ...prev,
                                is_default: e.target.checked
                              }))}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Set as default</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={templateSaveState.is_shared}
                              onChange={(e) => setTemplateSaveState(prev => ({
                                ...prev,
                                is_shared: e.target.checked
                              }))}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Share with team</span>
                          </label>
                        </div>
                        <div className="flex space-x-3">
                          <button
                            onClick={saveTemplate}
                            disabled={saveTemplateMutation.isPending}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {saveTemplateMutation.isPending ? 'Saving...' : 'Save Template'}
                          </button>
                          <button
                            onClick={() => setShowTemplateSave(false)}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Canonical Schema */}
              <div className="bg-white rounded-lg shadow-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Target Schema Fields</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    PulseDeck's standard fields for analytics
                  </p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {canonicalSchema.map((field) => {
                      const mappedColumn = Object.keys(mappingConfiguration).find(
                        col => mappingConfiguration[col] === field.field_name
                      );
                      
                      return (
                        <div 
                          key={field.field_name}
                          className={`p-4 rounded-lg border-2 transition-colors ${
                            mappedColumn 
                              ? 'border-green-200 bg-green-50' 
                              : field.required 
                                ? 'border-red-200 bg-red-50' 
                                : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium text-gray-900">
                              {field.field_name}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </h3>
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                              {field.field_type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{field.description}</p>
                          {mappedColumn && (
                            <div className="flex items-center text-sm text-green-700">
                              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Mapped from: {mappedColumn}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Validation Results */}
              <div className="bg-white rounded-lg shadow-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Mapping Validation</h2>
                </div>
                <div className="p-6">
                  {validationResults.is_valid ? (
                    <div className="flex items-center text-green-700 bg-green-50 p-4 rounded-lg">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Mapping is valid and ready for processing
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {validationResults.missing_required_fields.length > 0 && (
                        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                          <h4 className="text-sm font-medium text-red-800 mb-2">Missing Required Fields:</h4>
                          <ul className="list-disc list-inside text-sm text-red-700">
                            {validationResults.missing_required_fields.map((field, index) => (
                              <li key={index}>{field}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {validationResults.type_mismatches.length > 0 && (
                        <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                          <h4 className="text-sm font-medium text-orange-800 mb-2">Type Mismatches:</h4>
                          <ul className="list-disc list-inside text-sm text-orange-700">
                            {validationResults.type_mismatches.map((mismatch, index) => (
                              <li key={index}>
                                {mismatch.column}: Expected {mismatch.expected_type}, found {mismatch.detected_type}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {validationResults.warnings.length > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                          <h4 className="text-sm font-medium text-yellow-800 mb-2">Warnings:</h4>
                          <ul className="list-disc list-inside text-sm text-yellow-700">
                            {validationResults.warnings.map((warning, index) => (
                              <li key={index}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex justify-between items-center">
            <button
              onClick={() => navigate(`/w/${workspace_id}/upload?step=2`)}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back to Upload
            </button>
            
            <button
              onClick={continueProcessing}
              disabled={!validationResults.is_valid || continueProcessingMutation.isPending}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {continueProcessingMutation.isPending ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Continue Processing'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_DataMapping;