import { useState } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, Link2 } from 'lucide-react';
import { apiPost } from '../../lib/api';

interface ZohoAPIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void; // Just refresh callback
}

export default function ZohoAPIModal({ isOpen, onClose, onSave }: ZohoAPIModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    zohoService: 'crm',
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    region: 'com',
    apiVersion: 'v2',
    modules: [] as string[],
  });

  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [autoFetch, setAutoFetch] = useState(true);

  if (!isOpen) return null;

  const zohoServices = [
    { value: 'crm', label: 'Zoho CRM' },
    { value: 'books', label: 'Zoho Books' },
    { value: 'analytics', label: 'Zoho Analytics' },
    { value: 'people', label: 'Zoho People' },
    { value: 'projects', label: 'Zoho Projects' },
  ];

  const crmModules = ['Leads', 'Contacts', 'Accounts', 'Deals', 'Tasks', 'Calls', 'Meetings'];
  const booksModules = ['Invoices', 'Bills', 'Customers', 'Vendors', 'Items', 'Expenses'];

  const getModulesForService = () => {
    if (formData.zohoService === 'crm') return crmModules;
    if (formData.zohoService === 'books') return booksModules;
    return [];
  };

  const toggleModule = (module: string) => {
    setFormData({
      ...formData,
      modules: formData.modules.includes(module)
        ? formData.modules.filter((m) => m !== module)
        : [...formData.modules, module],
    });
  };

  const getZohoBaseUrl = () => {
    const domain = formData.region === 'com' ? 'com' : formData.region;
    return `https://www.zohoapis.${domain}`;
  };

  const getZohoEndpoint = () => {
    const serviceMap: Record<string, string> = {
      crm: '/crm',
      books: '/books',
      analytics: '/analytics',
      people: '/people',
      projects: '/projects',
    };
    const servicePath = serviceMap[formData.zohoService] || '/crm';
    return `${servicePath}/api/${formData.apiVersion}`;
  };

  const handleTestConnection = async () => {
    if (!formData.name || !formData.clientId || !formData.clientSecret) {
      setTestStatus('error');
      setTestMessage('Please provide name, Client ID, and Client Secret');
      return;
    }

    setTestStatus('loading');
    setTestMessage('Testing Zoho connection...');

    try {
      const baseUrl = getZohoBaseUrl();
      const endpoint = getZohoEndpoint();

      // Use direct test endpoint
      const testRes = await apiPost<{ message: string }>('/api/admin/api-configs/test', {
        base_url: baseUrl,
        endpoint: endpoint || '',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        auth_type: 'bearer',
        auth_config: {
          token: formData.refreshToken || 'test-token',
          client_id: formData.clientId,
          client_secret: formData.clientSecret,
        },
        timeout_ms: 30000,
      });

      if (testRes.success) {
        setTestStatus('success');
        setTestMessage(testRes.message || 'Zoho API connection test successful!');
      } else {
        setTestStatus('error');
        setTestMessage(testRes.message || 'Connection test failed');
      }
    } catch (e) {
      setTestStatus('error');
      setTestMessage(e instanceof Error ? e.message : 'Connection test failed');
    }
  };

  const handleSaveDraft = async () => {
    if (!formData.name || !formData.clientId || !formData.clientSecret) {
      setTestStatus('error');
      setTestMessage('Please fill in all required fields.');
      return;
    }

    setSavingDraft(true);
    setTestMessage('');

    try {
      const baseUrl = getZohoBaseUrl();
      const endpoint = getZohoEndpoint();

      // Create API config (save as draft - no data fetch)
      const configRes = await apiPost<{ id: number }>('/api/admin/api-configs', {
        name: formData.name,
        base_url: baseUrl,
        endpoint: endpoint,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        auth_type: 'bearer',
        auth_config: {
          token: formData.refreshToken || '',
          client_id: formData.clientId,
          client_secret: formData.clientSecret,
          zoho_service: formData.zohoService,
          modules: formData.modules,
        },
        rate_limit_per_minute: 60,
        timeout_ms: 30000,
      });

      if (!configRes.success || !configRes.data) {
        throw new Error(configRes.message || 'Failed to create Zoho API configuration');
      }

      // Refresh data sources list
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
    if (!formData.name || !formData.clientId || !formData.clientSecret) {
      setTestStatus('error');
      setTestMessage('Please fill in all required fields.');
      return;
    }

    setSaving(true);
    setTestMessage('');

    try {
      const baseUrl = getZohoBaseUrl();
      const endpoint = getZohoEndpoint();

      // Create API config
      const configRes = await apiPost<{ id: number }>('/api/admin/api-configs', {
        name: formData.name,
        base_url: baseUrl,
        endpoint: endpoint,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        auth_type: 'bearer',
        auth_config: {
          token: formData.refreshToken || '',
          client_id: formData.clientId,
          client_secret: formData.clientSecret,
          zoho_service: formData.zohoService,
          modules: formData.modules,
        },
        rate_limit_per_minute: 60,
        timeout_ms: 30000,
      });

      if (!configRes.success || !configRes.data) {
        throw new Error(configRes.message || 'Failed to create Zoho API configuration');
      }

      const apiConfigId = (configRes.data as { id: number }).id;

      // Optionally fetch data to create dataset
      if (autoFetch) {
        try {
          await apiPost('/api/data/fetch-api', {
            api_config_id: apiConfigId,
            dataset_name: formData.name,
            description: `Zoho ${formData.zohoService} data`,
          });
        } catch (e) {
          console.error('Failed to fetch initial data:', e);
          // Continue even if fetch fails
        }
      }

      // Refresh data sources list
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Connect Zoho API</h2>
            <p className="text-sm text-gray-600 mt-1">Configure Zoho service integration</p>
          </div>
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
                placeholder="e.g., Zoho CRM - Sales Data"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zoho Service <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.zohoService}
                onChange={(e) =>
                  setFormData({ ...formData, zohoService: e.target.value, modules: [] })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              >
                {zohoServices.map((service) => (
                  <option key={service.value} value={service.value}>
                    {service.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* OAuth Configuration */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">OAuth 2.0 Configuration</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                placeholder="1000.XXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client Secret <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.clientSecret}
                onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                placeholder="Enter your client secret"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Refresh Token
              </label>
              <input
                type="password"
                value={formData.refreshToken}
                onChange={(e) => setFormData({ ...formData, refreshToken: e.target.value })}
                placeholder="Optional: Enter refresh token"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                If not provided, you'll need to authorize via OAuth flow
              </p>
            </div>
          </div>

          {/* Region & API Version */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Configuration</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Center</label>
                <select
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="com">US (.com)</option>
                  <option value="eu">Europe (.eu)</option>
                  <option value="in">India (.in)</option>
                  <option value="com.au">Australia (.com.au)</option>
                  <option value="jp">Japan (.jp)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">API Version</label>
                <select
                  value={formData.apiVersion}
                  onChange={(e) => setFormData({ ...formData, apiVersion: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="v2">Version 2</option>
                  <option value="v3">Version 3 (if available)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Modules Selection */}
          {getModulesForService().length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">
                Select {formData.zohoService === 'crm' ? 'CRM' : 'Books'} Modules
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {getModulesForService().map((module) => (
                  <label
                    key={module}
                    className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-purple-50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={formData.modules.includes(module)}
                      onChange={() => toggleModule(module)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <span className="ml-2 text-sm text-gray-900">{module}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Auto-fetch option */}
          <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg">
            <input
              type="checkbox"
              id="autoFetchZoho"
              checked={autoFetch}
              onChange={(e) => setAutoFetch(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <label htmlFor="autoFetchZoho" className="text-sm text-gray-700">
              Automatically fetch data after creating configuration (creates dataset)
            </label>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              How to get Zoho API credentials:
            </h4>
            <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
              <li>Go to Zoho API Console (api-console.zoho.{formData.region})</li>
              <li>Create a new "Server-based Application"</li>
              <li>Copy the Client ID and Client Secret</li>
              <li>Set the Redirect URI to your callback URL</li>
              <li>Generate a Refresh Token using the OAuth flow</li>
            </ol>
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
            className="px-4 py-2 text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {testStatus === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Link2 className="w-4 h-4" />
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
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
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
