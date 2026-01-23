import { ReactNode, useState } from 'react';
import { useNavigate, NavLink } from 'react-router';
import { Eye, LayoutDashboard, LogOut, Menu, X, User as UserIcon } from 'lucide-react';
import type { User } from '../../contexts/AuthContext';

interface ViewerLayoutProps {
  user: User;
  onLogout: () => void;
  children: ReactNode;
}

export default function ViewerLayout({ user, onLogout, children }: ViewerLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden mr-3 text-gray-500 hover:text-gray-700"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <div className="flex items-center">
                <div className="bg-green-100 p-2 rounded-lg">
                  <Eye className="w-6 h-6 text-green-600" />
                </div>
                <span className="ml-3 text-xl font-semibold text-gray-900">Analytics Portal</span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-8">
              <NavLink
                to="/viewer/dashboard"
                className={({ isActive }) => `
                  flex items-center px-3 py-2 rounded-lg transition-colors
                  ${isActive ? 'text-green-600 bg-green-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}
                `}
              >
                <LayoutDashboard className="w-5 h-5 mr-2" />
                My Dashboards
              </NavLink>
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-green-600 font-medium text-sm">
                    {user.first_name.charAt(0)}
                  </span>
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-gray-900">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-xs text-gray-500">Viewer</p>
                </div>
              </button>

              {/* User Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                  <div className="px-4 py-2 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-4 space-y-2">
              <NavLink
                to="/viewer/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => `
                  flex items-center px-3 py-2 rounded-lg transition-colors
                  ${isActive ? 'text-green-600 bg-green-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}
                `}
              >
                <LayoutDashboard className="w-5 h-5 mr-2" />
                My Dashboards
              </NavLink>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}