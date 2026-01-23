import { useState, useEffect } from 'react';
import { X, Link2, CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { apiPost, apiGet, apiPut } from '../../lib/api';

interface ApiConfig {
  id: number;
  name: string;
  base_url: string;
  endpoint: string | null;
  method: string;
  headers: string | object;
  auth_type: string;
  auth_config: string | object;
  rate_limit_per_minute: number;
  timeout_ms: number;
}

interface APIConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void; // Just refresh callback
  editingConfig?: ApiConfig | null; // Config to edit
}

export default function APIConfigModal({ isOpen, onClose, onSave, editingConfig }: APIConfigModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    method: 'GET',
    url: '',
    endpoint: '',
    headers: [{ key: '', value: '' }],
    queryParams: [{ key: '', value: '' }],
    bodyType: 'none',
    body: '',
    authType: 'none',
    authToken: '',
    authUsername: '',
    authPassword: '',
    apiKeyHeader: '',
    responseDataPath: '',
    refreshInterval: '',
  });

  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [autoFetch, setAutoFetch] = useState(true);
  const [isCustomHeader, setIsCustomHeader] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showBearerToken, setShowBearerToken] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Load config for editing
  useEffect(() => {
    if (editingConfig && isOpen) {
      const loadConfig = async () => {
        try {
          const res = await apiGet<ApiConfig>(`/api/admin/api-configs/${editingConfig.id}`);
          if (res.success && res.data) {
            const config = res.data;
            // Parse headers
            let headersObj: Record<string, string> = {};
            try {
              if (typeof config.headers === 'string') {
                headersObj = JSON.parse(config.headers || '{}');
              } else if (typeof config.headers === 'object') {
                headersObj = config.headers as Record<string, string>;
              }
            } catch {}

            // Parse auth config
            let authConfig: Record<string, string> = {};
            try {
              if (typeof config.auth_config === 'string') {
                authConfig = JSON.parse(config.auth_config || '{}');
              } else if (typeof config.auth_config === 'object') {
                authConfig = config.auth_config as Record<string, string>;
              }
            } catch {}

            // Build URL - split into base URL and endpoint for display
            setFormData({
              name: config.name,
              method: config.method || '',
              url: config.base_url || '',
              endpoint: config.endpoint || '',
              headers: Object.keys(headersObj).length > 0
                ? Object.entries(headersObj).map(([key, value]) => ({ key, value }))
                : [{ key: '', value: '' }],
              queryParams: [{ key: '', value: '' }],
              bodyType: 'none',
              body: '',
              authType: config.auth_type || 'none',
              authToken: authConfig.token || authConfig.key || '',
              authUsername: authConfig.username || '',
              authPassword: authConfig.password || '',
              apiKeyHeader: authConfig.header_name || '',
              responseDataPath: '',
              refreshInterval: String(config.rate_limit_per_minute || 60),
            });
            // Check if loaded header name is custom (not in predefined list)
            const predefinedHeaders = [
              'X-API-Key', 'X-Api-Key', 'X-API-KEY', 'Api-Key', 'API-Key',
              'X-Auth-Token', 'X-AuthToken', 'X-Token', 'Authorization',
              'api-key', 'apikey', 'X-RapidAPI-Key', 'X-Application-Key',
              'X-Client-Key', 'X-Secret-Key', 'X-Access-Key', 'X-Project-Key',
              'X-Subscription-Key', 'Ocp-Apim-Subscription-Key'
            ];
            const loadedHeader = authConfig.header_name || '';
            setIsCustomHeader(loadedHeader !== '' && !predefinedHeaders.includes(loadedHeader));
          }
        } catch (e) {
          console.error('Failed to load config:', e);
        }
      };
      loadConfig();
    } else if (!editingConfig && isOpen) {
      // Reset form for new config
      setFormData({
        name: '',
        method: '',
        url: '',
        endpoint: '',
        headers: [{ key: '', value: '' }],
        queryParams: [{ key: '', value: '' }],
        bodyType: 'none',
        body: '',
        authType: 'none',
        authToken: '',
        authUsername: '',
        authPassword: '',
        apiKeyHeader: '',
        responseDataPath: '',
        refreshInterval: '',
      });
      setIsCustomHeader(false);
      setTestStatus('idle');
      setTestMessage('');
    }
  }, [editingConfig, isOpen]);

  if (!isOpen) return null;

  const addHeader = () => {
    setFormData({
      ...formData,
      headers: [...formData.headers, { key: '', value: '' }],
    });
  };

  const removeHeader = (index: number) => {
    setFormData({
      ...formData,
      headers: formData.headers.filter((_, i) => i !== index),
    });
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...formData.headers];
    newHeaders[index][field] = value;
    setFormData({ ...formData, headers: newHeaders });
  };

  const addQueryParam = () => {
    setFormData({
      ...formData,
      queryParams: [...formData.queryParams, { key: '', value: '' }],
    });
  };

  const removeQueryParam = (index: number) => {
    setFormData({
      ...formData,
      queryParams: formData.queryParams.filter((_, i) => i !== index),
    });
  };

  const updateQueryParam = (index: number, field: 'key' | 'value', value: string) => {
    const newParams = [...formData.queryParams];
    newParams[index][field] = value;
    setFormData({ ...formData, queryParams: newParams });
  };

  const handleTestConnection = async () => {
    if (!formData.url) {
      setTestStatus('error');
      setTestMessage('Please provide a URL.');
      return;
    }
    
    if (!formData.method || formData.method.trim() === '') {
      setTestStatus('error');
      setTestMessage('Please select an HTTP method.');
      return;
    }

    setTestStatus('loading');
    setTestMessage('Testing connection...');

    try {
      // Build headers object
      const headersObj: Record<string, string> = {};
      formData.headers.forEach((h) => {
        if (h.key && h.value) headersObj[h.key] = h.value;
      });

      // Build auth config
      let authConfig: Record<string, string> = {};
      let authType = formData.authType || 'none';
      
      if (formData.authType === 'bearer' && formData.authToken) {
        authConfig = { token: formData.authToken };
        authType = 'bearer';
      } else if (formData.authType === 'api_key' && formData.authToken) {
        // Require header name - no defaults
        if (!formData.apiKeyHeader || formData.apiKeyHeader.trim() === '') {
          setTestStatus('error');
          setTestMessage('Header name is required for API key authentication');
          return;
        }
        authConfig = { key: formData.authToken, header_name: formData.apiKeyHeader.trim() };
        authType = 'api_key';
      } else if (formData.authType === 'basic' && formData.authUsername && formData.authPassword) {
        authConfig = { username: formData.authUsername, password: formData.authPassword };
        authType = 'basic';
      } else {
        authType = 'none';
      }

      // Use EXACT URL as provided - NO parsing, NO splitting, NO modification
      // User provides full URL or base_url + endpoint separately
      const baseUrl = formData.url.trim();
      const endpoint = formData.endpoint ? formData.endpoint.trim() : '';
      
      // Build query string from form params if provided
      const queryParams = formData.queryParams.filter(p => p.key && p.value);
      let queryString = '';
      if (queryParams.length > 0) {
        queryString = '?' + queryParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
      }
      // Append query string to endpoint if provided, otherwise to base URL
      const finalEndpoint = endpoint + queryString;

      // Debug logging - show exactly what we're sending
      console.log('Frontend sending to backend:', {
        base_url: baseUrl,
        endpoint: finalEndpoint,
        method: formData.method || 'GET',
        auth_type: authType,
        auth_config: authConfig,
        hasAuthConfig: Object.keys(authConfig).length > 0,
        headers: Object.keys(headersObj).length > 0 ? Object.keys(headersObj) : 'none',
        formAuthType: formData.authType,
        apiKeyHeader: formData.apiKeyHeader,
        authToken: formData.authToken ? '***SET***' : 'NOT SET'
      });

      // Use direct test endpoint (doesn't create config)
      const testRes = await apiPost<{ 
        message: string; 
        data?: { 
          status: number; 
          statusText?: string;
          url?: string;
          method?: string;
          headers?: string[];
          responseData?: unknown;
        };
        error?: string;
        details?: unknown;
      }>(
        '/api/admin/api-configs/test',
        {
          base_url: baseUrl,
          endpoint: finalEndpoint,
          method: formData.method.trim().toUpperCase(), // Use EXACT method from form - NO default
          headers: Object.keys(headersObj).length > 0 ? headersObj : {},
          auth_type: authType,
          auth_config: Object.keys(authConfig).length > 0 ? authConfig : (authType !== 'none' ? {} : undefined),
          timeout_ms: formData.refreshInterval && formData.refreshInterval.trim() !== '' 
            ? parseInt(formData.refreshInterval) * 1000 
            : 30000, // Use form timeout if provided
        }
      );

      if (testRes.success) {
        setTestStatus('success');
        setTestMessage(testRes.message || 'Connection successful!');
      } else {
        setTestStatus('error');
        // Show EXACT error details from API - no masking
        let errorMsg = testRes.message || 'Connection test failed';
        
        // Add request details
        if (testRes.data) {
          const data = testRes.data;
          errorMsg += `\n\nRequest Details:`;
          errorMsg += `\nStatus: ${data.status} ${data.statusText || ''}`;
          if (data.url) errorMsg += `\nURL: ${data.url}`;
          if (data.method) errorMsg += `\nMethod: ${data.method}`;
          if (data.headers && data.headers.length > 0) {
            errorMsg += `\nHeaders: ${data.headers.join(', ')}`;
          }
          if (data.responseData) {
            try {
              const responseStr = typeof data.responseData === 'string' 
                ? data.responseData 
                : JSON.stringify(data.responseData);
              errorMsg += `\nResponse: ${responseStr.substring(0, 500)}`;
            } catch {
              errorMsg += `\nResponse: ${String(data.responseData).substring(0, 500)}`;
            }
          }
        }
        
        // Add error details if available
        if (testRes.details) {
          const details = testRes.details as any;
          errorMsg += `\n\nError Details:`;
          if (details.status) errorMsg += `\nHTTP Status: ${details.status} ${details.statusText || ''}`;
          if (details.url) errorMsg += `\nRequested URL: ${details.url}`;
          if (details.method) errorMsg += `\nRequest Method: ${details.method}`;
          if (details.responseData) {
            try {
              const responseStr = typeof details.responseData === 'string'
                ? details.responseData
                : JSON.stringify(details.responseData);
              errorMsg += `\nAPI Response: ${responseStr.substring(0, 500)}`;
            } catch {
              errorMsg += `\nAPI Response: ${String(details.responseData).substring(0, 500)}`;
            }
          }
        }
        
        setTestMessage(errorMsg);
      }
    } catch (e) {
      setTestStatus('error');
      // Show exact error
      const errorMsg = e instanceof Error ? e.message : 'Connection test failed';
      setTestMessage(`Error: ${errorMsg}`);
    }
  };

  const handleSaveDraft = async () => {
    if (!formData.name || !formData.url) {
      setTestStatus('error');
      setTestMessage('Please provide a name and URL.');
      return;
    }
    
    if (!formData.method || formData.method.trim() === '') {
      setTestStatus('error');
      setTestMessage('Please select an HTTP method.');
      return;
    }

    setSavingDraft(true);
    setTestMessage('');

    try {
      // Build headers object
      const headersObj: Record<string, string> = {};
      formData.headers.forEach((h) => {
        if (h.key && h.value) headersObj[h.key] = h.value;
      });

      // Build auth config
      let authConfig: Record<string, string> = {};
      let authType = formData.authType || 'none';
      
      if (formData.authType === 'bearer' && formData.authToken) {
        authConfig = { token: formData.authToken };
        authType = 'bearer';
      } else if (formData.authType === 'api_key' && formData.authToken) {
        // Require header name - no defaults
        if (!formData.apiKeyHeader || formData.apiKeyHeader.trim() === '') {
          setTestStatus('error');
          setTestMessage('Header name is required for API key authentication');
          return;
        }
        authConfig = { key: formData.authToken, header_name: formData.apiKeyHeader.trim() };
        authType = 'api_key';
      } else if (formData.authType === 'basic' && formData.authUsername && formData.authPassword) {
        authConfig = { username: formData.authUsername, password: formData.authPassword };
        authType = 'basic';
      } else {
        authType = 'none';
      }

      // Use EXACT values - NO URL parsing or modification
      const baseUrl = formData.url.trim();
      
      // Build endpoint with query params if provided
      let endpoint = formData.endpoint ? formData.endpoint.trim() : '';
      const queryParams = formData.queryParams.filter(p => p.key && p.value);
      if (queryParams.length > 0) {
        const queryString = '?' + queryParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
        endpoint = endpoint + queryString;
      }

      // Create or update API config (save as draft - no data fetch)
      if (editingConfig) {
        const updateRes = await apiPut(`/api/admin/api-configs/${editingConfig.id}`, {
          name: formData.name,
          base_url: baseUrl,
          endpoint: endpoint || null,
          method: formData.method.trim().toUpperCase(), // Use EXACT method from form
          headers: Object.keys(headersObj).length > 0 ? headersObj : null,
          auth_type: authType,
          auth_config: Object.keys(authConfig).length > 0 ? authConfig : null,
          rate_limit_per_minute: formData.refreshInterval && formData.refreshInterval.trim() !== '' 
            ? parseInt(formData.refreshInterval, 10) 
            : 60, // Use form value if provided
          timeout_ms: formData.refreshInterval && formData.refreshInterval.trim() !== '' 
            ? parseInt(formData.refreshInterval, 10) * 1000 
            : 30000, // Use form timeout if provided (convert seconds to ms)
        });
        if (!updateRes.success) {
          throw new Error(updateRes.message || 'Failed to update configuration');
        }
      } else {
        const configRes = await apiPost<{ id: number }>('/api/admin/api-configs', {
          name: formData.name,
          base_url: baseUrl,
          endpoint: endpoint || null,
          method: formData.method.trim().toUpperCase(), // Use EXACT method from form
          headers: Object.keys(headersObj).length > 0 ? headersObj : null,
          auth_type: authType,
          auth_config: Object.keys(authConfig).length > 0 ? authConfig : null,
          rate_limit_per_minute: formData.refreshInterval && formData.refreshInterval.trim() !== '' 
            ? parseInt(formData.refreshInterval, 10) 
            : 60, // Use form value if provided
          timeout_ms: formData.refreshInterval && formData.refreshInterval.trim() !== '' 
            ? parseInt(formData.refreshInterval, 10) * 1000 
            : 30000, // Use form timeout if provided (convert seconds to ms)
        });

        if (!configRes.success || !configRes.data) {
          throw new Error(configRes.message || 'Failed to save configuration');
        }
      }

      // Refresh data sources list to show new config
      onSave();
      onClose();
    } catch (e) {
      setTestStatus('error');
      setTestMessage(e instanceof Error ? e.message : 'Failed to save configuration');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.url) {
      setTestStatus('error');
      setTestMessage('Please provide a name and URL.');
      return;
    }

    setSaving(true);
    setTestMessage('');

    try {
      // Build headers object
      const headersObj: Record<string, string> = {};
      formData.headers.forEach((h) => {
        if (h.key && h.value) headersObj[h.key] = h.value;
      });

      // Build auth config
      let authConfig: Record<string, string> = {};
      let authType = formData.authType || 'none';
      
      if (formData.authType === 'bearer' && formData.authToken) {
        authConfig = { token: formData.authToken };
        authType = 'bearer';
      } else if (formData.authType === 'api_key' && formData.authToken) {
        // Require header name - no defaults
        if (!formData.apiKeyHeader || formData.apiKeyHeader.trim() === '') {
          setTestStatus('error');
          setTestMessage('Header name is required for API key authentication');
          return;
        }
        authConfig = { key: formData.authToken, header_name: formData.apiKeyHeader.trim() };
        authType = 'api_key';
      } else if (formData.authType === 'basic' && formData.authUsername && formData.authPassword) {
        authConfig = { username: formData.authUsername, password: formData.authPassword };
        authType = 'basic';
      } else {
        authType = 'none';
      }

      // Use EXACT values - NO URL parsing or modification
      const baseUrl = formData.url.trim();
      
      // Build endpoint with query params if provided
      let endpoint = formData.endpoint ? formData.endpoint.trim() : '';
      const queryParams = formData.queryParams.filter(p => p.key && p.value);
      if (queryParams.length > 0) {
        const queryString = '?' + queryParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
        endpoint = endpoint + queryString;
      }

      // Create or update API config
      let apiConfigId: number;
      if (editingConfig) {
        const updateRes = await apiPut<{ id: number }>(`/api/admin/api-configs/${editingConfig.id}`, {
          name: formData.name,
          base_url: baseUrl,
          endpoint: endpoint || null,
          method: formData.method.trim().toUpperCase(), // Use EXACT method from form
          headers: Object.keys(headersObj).length > 0 ? headersObj : null,
          auth_type: authType,
          auth_config: Object.keys(authConfig).length > 0 ? authConfig : null,
          rate_limit_per_minute: formData.refreshInterval && formData.refreshInterval.trim() !== '' 
            ? parseInt(formData.refreshInterval, 10) 
            : 60, // Use form value if provided
          timeout_ms: formData.refreshInterval && formData.refreshInterval.trim() !== '' 
            ? parseInt(formData.refreshInterval, 10) * 1000 
            : 30000, // Use form timeout if provided (convert seconds to ms)
        });
        if (!updateRes.success) {
          throw new Error(updateRes.message || 'Failed to update API configuration');
        }
        apiConfigId = editingConfig.id;
      } else {
        const configRes = await apiPost<{ id: number }>('/api/admin/api-configs', {
          name: formData.name,
          base_url: baseUrl,
          endpoint: endpoint || null,
          method: formData.method.trim().toUpperCase(), // Use EXACT method from form
          headers: Object.keys(headersObj).length > 0 ? headersObj : null,
          auth_type: authType,
          auth_config: Object.keys(authConfig).length > 0 ? authConfig : null,
          rate_limit_per_minute: formData.refreshInterval && formData.refreshInterval.trim() !== '' 
            ? parseInt(formData.refreshInterval, 10) 
            : 60, // Use form value if provided
          timeout_ms: formData.refreshInterval && formData.refreshInterval.trim() !== '' 
            ? parseInt(formData.refreshInterval, 10) * 1000 
            : 30000, // Use form timeout if provided (convert seconds to ms)
        });

        if (!configRes.success || !configRes.data) {
          throw new Error(configRes.message || 'Failed to create API configuration');
        }

        apiConfigId = (configRes.data as { id: number }).id;
      }

      // Optionally fetch data to create dataset
      if (autoFetch) {
        try {
          await apiPost('/api/data/fetch-api', {
            api_config_id: apiConfigId,
            dataset_name: formData.name,
            description: `Data from ${formData.name} API`,
          });
        } catch (e) {
          console.error('Failed to fetch initial data:', e);
          // Continue even if fetch fails - config is created
        }
      }

      // Refresh data sources list to show new config
      onSave();
      onClose();
    } catch (e) {
      setTestStatus('error');
      setTestMessage(e instanceof Error ? e.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {editingConfig ? 'Edit API Configuration' : 'Configure API Data Source'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Basic Information</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Source Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Customer API"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Method</label>
                <select
                  value={formData.method}
                  onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  required
                >
                  <option value="">Select method...</option>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div className="col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => {
                    const fullUrl = e.target.value;
                    // Auto-parse URL: if full URL is provided, split into base URL and endpoint
                    try {
                      const urlObj = new URL(fullUrl);
                      const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
                      const endpoint = urlObj.pathname + urlObj.search;
                      
                      setFormData({ 
                        ...formData, 
                        url: baseUrl,
                        endpoint: endpoint || formData.endpoint // Only update if endpoint exists in URL
                      });
                    } catch {
                      // If URL parsing fails, just update the URL field
                      setFormData({ ...formData, url: fullUrl });
                    }
                  }}
                  placeholder="Enter API URL (e.g., https://api.yourservice.com/data)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter full URL to auto-split into base URL and endpoint
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Endpoint (optional, if not in URL)
              </label>
              <input
                type="text"
                value={formData.endpoint}
                onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                placeholder="/api/v1/data"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Authentication */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Authentication</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Auth Type</label>
              <select
                value={formData.authType}
                onChange={(e) => setFormData({ ...formData, authType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
              >
                <option value="none">None</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
                <option value="api_key">API Key</option>
              </select>
            </div>

            {formData.authType === 'bearer' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bearer Token</label>
                <div className="relative">
                  <input
                    type={showBearerToken ? 'text' : 'password'}
                    value={formData.authToken}
                    onChange={(e) => setFormData({ ...formData, authToken: e.target.value })}
                    placeholder="Enter your bearer token"
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBearerToken(!showBearerToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    aria-label={showBearerToken ? 'Hide bearer token' : 'Show bearer token'}
                  >
                    {showBearerToken ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {formData.authType === 'basic' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                  <input
                    type="text"
                    value={formData.authUsername}
                    onChange={(e) => setFormData({ ...formData, authUsername: e.target.value })}
                    placeholder="Username"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.authPassword}
                      onChange={(e) => setFormData({ ...formData, authPassword: e.target.value })}
                      placeholder="Password"
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {formData.authType === 'api_key' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Key <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={formData.authToken}
                      onChange={(e) => setFormData({ ...formData, authToken: e.target.value })}
                      placeholder="Enter your API key"
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                      aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                    >
                      {showApiKey ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Header Name <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={isCustomHeader ? '__custom__' : formData.apiKeyHeader}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomHeader(true);
                        setFormData({ ...formData, apiKeyHeader: '' });
                      } else {
                        setIsCustomHeader(false);
                        setFormData({ ...formData, apiKeyHeader: e.target.value });
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  >
                    <option value="">Select header name...</option>
                    <option value="X-API-Key">X-API-Key</option>
                    <option value="X-Api-Key">X-Api-Key</option>
                    <option value="X-API-KEY">X-API-KEY</option>
                    <option value="Api-Key">Api-Key</option>
                    <option value="API-Key">API-Key</option>
                    <option value="X-Auth-Token">X-Auth-Token</option>
                    <option value="X-AuthToken">X-AuthToken</option>
                    <option value="X-Token">X-Token</option>
                    <option value="Authorization">Authorization</option>
                    <option value="api-key">api-key</option>
                    <option value="apikey">apikey</option>
                    <option value="X-RapidAPI-Key">X-RapidAPI-Key</option>
                    <option value="X-Application-Key">X-Application-Key</option>
                    <option value="X-Client-Key">X-Client-Key</option>
                    <option value="X-Secret-Key">X-Secret-Key</option>
                    <option value="X-Access-Key">X-Access-Key</option>
                    <option value="X-Project-Key">X-Project-Key</option>
                    <option value="X-Subscription-Key">X-Subscription-Key</option>
                    <option value="Ocp-Apim-Subscription-Key">Ocp-Apim-Subscription-Key</option>
                    <option value="__custom__">Custom (enter below)</option>
                  </select>
                  {isCustomHeader && (
                    <input
                      type="text"
                      value={formData.apiKeyHeader}
                      onChange={(e) => setFormData({ ...formData, apiKeyHeader: e.target.value })}
                      placeholder="Enter custom header name (e.g., My-Custom-Header)"
                      className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    />
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Select from common header names or choose "Custom" to enter your own
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Headers */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Headers</h3>
              <button
                onClick={addHeader}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                + Add Header
              </button>
            </div>

            {formData.headers.map((header, index) => (
              <div key={index} className="flex gap-3">
                <input
                  type="text"
                  value={header.key}
                  onChange={(e) => updateHeader(index, 'key', e.target.value)}
                  placeholder="Header name"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                />
                <input
                  type="text"
                  value={header.value}
                  onChange={(e) => updateHeader(index, 'value', e.target.value)}
                  placeholder="Header value"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                />
                <button
                  onClick={() => removeHeader(index)}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Auto-fetch option */}
          <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg">
            <input
              type="checkbox"
              id="autoFetch"
              checked={autoFetch}
              onChange={(e) => setAutoFetch(e.target.checked)}
              className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
            />
            <label htmlFor="autoFetch" className="text-sm text-gray-700">
              Automatically fetch data after creating configuration (creates dataset)
            </label>
          </div>

          {/* Status Messages */}
          {testStatus === 'success' && (
            <div className="flex items-center text-sm text-green-700 bg-green-50 px-4 py-3 rounded-lg">
              <CheckCircle className="w-5 h-5 mr-2" />
              {testMessage}
            </div>
          )}

          {testStatus === 'error' && testMessage && (
            <div className="flex items-center text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg">
              <AlertCircle className="w-5 h-5 mr-2" />
              {testMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleTestConnection}
            disabled={testStatus === 'loading'}
            className="px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center disabled:opacity-50"
          >
            {testStatus === 'loading' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Link2 className="w-4 h-4 mr-2" />
            )}
            Test Connection
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={saving || savingDraft}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDraft}
              disabled={saving || savingDraft}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {savingDraft && <Loader2 className="w-4 h-4 animate-spin" />}
              Save as Draft
            </button>
            <button
              onClick={handleSave}
              disabled={saving || savingDraft}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save & Fetch Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
