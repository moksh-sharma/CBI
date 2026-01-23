import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import {
  Users,
  LayoutDashboard,
  Database,
  Activity,
  Key,
  Shield,
  Loader2,
} from 'lucide-react';
import { apiGet } from '../../lib/api';

interface OverviewCounts {
  users: number;
  dashboards: number;
  datasets: number;
  apiConfigs: number;
}

export default function AdminOverview() {
  const [counts, setCounts] = useState<OverviewCounts>({
    users: 0,
    dashboards: 0,
    datasets: 0,
    apiConfigs: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, dashRes, dataRes, apiRes] = await Promise.all([
        apiGet<unknown[]>('/api/users'),
        apiGet<unknown[]>('/api/dashboards'),
        apiGet<unknown[]>('/api/data/datasets'),
        apiGet<unknown[]>('/api/admin/api-configs'),
      ]);
      setCounts({
        users: Array.isArray(usersRes.data) ? usersRes.data.length : 0,
        dashboards: Array.isArray(dashRes.data) ? dashRes.data.length : 0,
        datasets: Array.isArray(dataRes.data) ? dataRes.data.length : 0,
        apiConfigs: Array.isArray(apiRes.data) ? apiRes.data.length : 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; icon: string }> = {
      blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'bg-blue-100' },
      purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'bg-purple-100' },
      green: { bg: 'bg-green-50', text: 'text-green-600', icon: 'bg-green-100' },
      red: { bg: 'bg-red-50', text: 'text-red-600', icon: 'bg-red-100' },
      orange: { bg: 'bg-orange-50', text: 'text-orange-600', icon: 'bg-orange-100' },
    };
    return colors[color];
  };

  const kpiCards = [
    {
      title: 'Total Users',
      value: loading ? '—' : counts.users.toLocaleString(),
      icon: Users,
      color: 'blue',
      description: 'Registered system users',
    },
    {
      title: 'Active Dashboards',
      value: loading ? '—' : counts.dashboards,
      icon: LayoutDashboard,
      color: 'purple',
      description: 'Published dashboards',
    },
    {
      title: 'Data Sources',
      value: loading ? '—' : counts.datasets,
      icon: Database,
      color: 'green',
      description: 'Connected data sources',
    },
    {
      title: 'API Configurations',
      value: loading ? '—' : counts.apiConfigs,
      icon: Key,
      color: 'orange',
      description: 'Configured API connections',
    },
  ];

  const managementSections = [
    {
      title: 'User Management',
      icon: Users,
      description: 'Manage users, roles, and permissions',
      link: '/admin/users',
      count: counts.users,
      color: 'blue',
    },
    {
      title: 'Data Sources',
      icon: Database,
      description: 'Configure and manage data connections',
      link: '/admin/data-sources',
      count: counts.datasets,
      color: 'green',
    },
    {
      title: 'Access Control',
      icon: Shield,
      description: 'Control dashboard and feature access',
      link: '/admin/access-control',
      count: counts.dashboards,
      color: 'purple',
    },
    {
      title: 'API Configuration',
      icon: Key,
      description: 'Manage API keys and endpoints',
      link: '/admin/api-config',
      count: counts.apiConfigs,
      color: 'orange',
    },
  ];

  if (loading && counts.users === 0 && counts.dashboards === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-1">System Overview</h2>
        <p className="text-gray-600">Manage your enterprise dashboard system</p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((kpi) => {
          const colors = getColorClasses(kpi.color);
          return (
            <div
              key={kpi.title}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`${colors.icon} p-3 rounded-lg`}>
                  <kpi.icon className={`w-6 h-6 ${colors.text}`} />
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">{kpi.title}</h3>
              <p className="text-3xl font-bold text-gray-900 mb-2">{kpi.value}</p>
              <p className="text-sm text-gray-500">{kpi.description}</p>
            </div>
          );
        })}
      </div>

      {/* Management Sections */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {managementSections.map((section) => {
            const colors = getColorClasses(section.color);
            return (
              <Link
                key={section.title}
                to={section.link}
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-lg transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`${colors.icon} p-3 rounded-lg group-hover:scale-110 transition-transform`}
                  >
                    <section.icon className={`w-6 h-6 ${colors.text}`} />
                  </div>
                  <span className={`text-2xl font-bold ${colors.text}`}>
                    {loading ? '—' : section.count}
                  </span>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-red-600 transition-colors">
                  {section.title}
                </h4>
                <p className="text-sm text-gray-600">{section.description}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* System Status */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                  <Activity className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">API Services</h4>
                  <p className="text-sm text-gray-600">All services operational</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                Online
              </span>
            </div>
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <Database className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Database Connection</h4>
                  <p className="text-sm text-gray-600">All connections stable</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                Healthy
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                  <Key className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">API Authentication</h4>
                  <p className="text-sm text-gray-600">JWT-secured endpoints</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Logs CTA */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Audit Logs</h3>
          <Link
            to="/admin/audit-logs"
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            View All Logs →
          </Link>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          <LayoutDashboard className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>View full audit history and system activity in Audit Logs.</p>
        </div>
      </div>
    </div>
  );
}
