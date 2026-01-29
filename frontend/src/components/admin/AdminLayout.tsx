import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  Users,
  Database,
  Shield,
  FileText,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import type { User } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import ThemeToggle from '../shared/ThemeToggle';
import { useState } from 'react';

interface AdminLayoutProps {
  user: User;
  onLogout: () => void;
  children: ReactNode;
}

export default function AdminLayout({ user, onLogout, children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const navItems = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Overview' },
    { to: '/admin/users', icon: Users, label: 'User Management' },
    { to: '/admin/data-sources', icon: Database, label: 'Data Sources' },
    { to: '/admin/access-control', icon: Shield, label: 'Access Control' },
    { to: '/admin/audit-logs', icon: FileText, label: 'Audit Logs' }
  ];

  // Theme colors
  const colors = {
    bg: isDark ? '#0f0f1a' : '#f1f5f9',
    sidebar: isDark ? 'rgba(26, 26, 46, 0.95)' : '#ffffff',
    sidebarBorder: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
    header: isDark ? 'rgba(26, 26, 46, 0.95)' : '#ffffff',
    text: isDark ? '#f1f5f9' : '#1e293b',
    textMuted: isDark ? '#94a3b8' : '#64748b',
    textSecondary: isDark ? '#cbd5e1' : '#475569',
    accent: '#ef4444',
    accentBg: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
    accentHover: isDark ? 'rgba(239, 68, 68, 0.25)' : '#fee2e2',
    accentText: isDark ? '#fca5a5' : '#dc2626',
    navHover: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
    navActive: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
    cardBg: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
    cardBorder: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    cardShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.05)',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: isDark
        ? 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)'
        : colors.bg,
      display: 'flex',
    }}>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 20,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        position: sidebarOpen ? 'fixed' : undefined,
        inset: sidebarOpen ? '0 auto 0 0' : undefined,
        width: '260px',
        background: colors.sidebar,
        borderRight: `1px solid ${colors.sidebarBorder}`,
        backdropFilter: isDark ? 'blur(20px)' : undefined,
        zIndex: 30,
        transform: sidebarOpen ? 'translateX(0)' : undefined,
        transition: 'transform 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          borderBottom: `1px solid ${colors.sidebarBorder}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              background: colors.accentBg,
              padding: '10px',
              borderRadius: '12px',
            }}>
              <Shield style={{ width: '24px', height: '24px', color: colors.accent }} />
            </div>
            <span style={{
              marginLeft: '12px',
              fontWeight: 600,
              color: colors.text,
              fontSize: '16px',
            }}>
              Admin Portal
            </span>
          </div>
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: colors.textMuted,
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X style={{ width: '20px', height: '20px' }} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav style={{
          flex: 1,
          padding: '16px 12px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                borderRadius: '10px',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                background: isActive ? colors.accentBg : 'transparent',
                color: isActive ? colors.accent : colors.textMuted,
                fontWeight: isActive ? 500 : 400,
              })}
            >
              <item.icon style={{ width: '20px', height: '20px', marginRight: '12px' }} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User Profile */}
        <div style={{
          padding: '16px',
          borderTop: `1px solid ${colors.sidebarBorder}`,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: colors.accentBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ color: colors.accent, fontWeight: 500 }}>
                {user.first_name.charAt(0)}
              </span>
            </div>
            <div style={{ marginLeft: '12px', flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '14px',
                fontWeight: 500,
                color: colors.text,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user.first_name} {user.last_name}
              </p>
              <p style={{
                fontSize: '12px',
                color: colors.textMuted,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px',
              fontSize: '14px',
              color: colors.accent,
              background: 'transparent',
              border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca'}`,
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.accentBg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <LogOut style={{ width: '16px', height: '16px', marginRight: '8px' }} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Bar */}
        <header style={{
          height: '64px',
          background: colors.header,
          borderBottom: `1px solid ${colors.sidebarBorder}`,
          backdropFilter: isDark ? 'blur(20px)' : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                display: 'none',
                background: 'none',
                border: 'none',
                color: colors.textMuted,
                cursor: 'pointer',
                padding: '8px',
              }}
            >
              <Menu style={{ width: '24px', height: '24px' }} />
            </button>
            <h1 style={{
              fontSize: '20px',
              fontWeight: 600,
              color: colors.text,
              margin: 0,
            }}>
              Admin Dashboard
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <ThemeToggle size="sm" />
            <span style={{ fontSize: '14px', color: colors.textMuted }}>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          background: isDark ? 'transparent' : colors.bg,
        }}>
          <style>{`
            /* Override styles for child components */
            .admin-card {
              background: ${colors.cardBg} !important;
              border: 1px solid ${colors.sidebarBorder} !important;
              color: ${colors.text} !important;
            }
          `}</style>
          {children}
        </main>
      </div>
    </div>
  );
}