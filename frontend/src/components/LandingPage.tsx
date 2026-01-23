import { Link } from 'react-router';
import { LayoutDashboard, Shield, Code, Eye } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <LayoutDashboard className="w-16 h-16 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Enterprise Dashboard Suite</h1>
          <p className="text-xl text-gray-600">Comprehensive analytics and management platform</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Admin Portal */}
          <Link to="/admin/login" className="group">
            <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="bg-red-100 w-16 h-16 rounded-lg flex items-center justify-center mb-4 group-hover:bg-red-200 transition-colors">
                <Shield className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Admin Dashboard</h2>
              <p className="text-gray-600 mb-4">Full system control and configuration</p>
              <ul className="text-sm text-gray-500 space-y-1 mb-6">
                <li>• User & Role Management</li>
                <li>• Data Source Configuration</li>
                <li>• System Analytics</li>
                <li>• Audit Logs</li>
              </ul>
              <div className="text-red-600 font-medium group-hover:text-red-700">
                Access Admin Portal →
              </div>
            </div>
          </Link>

          {/* Developer Portal */}
          <Link to="/developer/login" className="group">
            <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="bg-indigo-100 w-16 h-16 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-200 transition-colors">
                <Code className="w-8 h-8 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Developer Dashboard</h2>
              <p className="text-gray-600 mb-4">Build and manage visualizations</p>
              <ul className="text-sm text-gray-500 space-y-1 mb-6">
                <li>• Dashboard Builder</li>
                <li>• Data Mapping Tools</li>
                <li>• API Configuration</li>
                <li>• Preview & Publish</li>
              </ul>
              <div className="text-indigo-600 font-medium group-hover:text-indigo-700">
                Access Developer Portal →
              </div>
            </div>
          </Link>

          {/* Viewer Portal */}
          <Link to="/viewer/login" className="group">
            <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="bg-green-100 w-16 h-16 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                <Eye className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Viewer Dashboard</h2>
              <p className="text-gray-600 mb-4">View and interact with dashboards</p>
              <ul className="text-sm text-gray-500 space-y-1 mb-6">
                <li>• Interactive Charts</li>
                <li>• Global Search & Filters</li>
                <li>• Mobile Responsive</li>
                <li>• Read-Only Access</li>
              </ul>
              <div className="text-green-600 font-medium group-hover:text-green-700">
                Access Viewer Portal →
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}