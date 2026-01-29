import { ReactNode, useState } from 'react';
import { useNavigate, NavLink } from 'react-router';
import { Eye, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import type { User } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import ThemeToggle from '../shared/ThemeToggle';

interface ViewerLayoutProps {
  user: User;
  onLogout: () => void;
  children: ReactNode;
}

export default function ViewerLayout({ user, onLogout, children }: ViewerLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  // Theme colors - Green accent for Viewer
  const colors = {
    bg: isDark ? '#0f0f1a' : '#f1f5f9',
    header: isDark ? 'rgba(26, 26, 46, 0.95)' : '#ffffff',
    headerBorder: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
    text: isDark ? '#f1f5f9' : '#1e293b',
    textMuted: isDark ? '#94a3b8' : '#64748b',
    textSecondary: isDark ? '#cbd5e1' : '#475569',
    accent: '#22c55e',
    accentBg: isDark ? 'rgba(34, 197, 94, 0.15)' : '#f0fdf4',
    accentHover: isDark ? 'rgba(34, 197, 94, 0.25)' : '#dcfce7',
    accentText: isDark ? '#86efac' : '#16a34a',
    navHover: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
    navActive: isDark ? 'rgba(34, 197, 94, 0.15)' : '#f0fdf4',
    dropdownBg: isDark ? 'rgba(26, 26, 46, 0.98)' : '#ffffff',
    dropdownBorder: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
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
    }}>
      {/* Top Navigation Bar */}
      <nav style={{
        background: colors.header,
        borderBottom: `1px solid ${colors.headerBorder}`,
        backdropFilter: isDark ? 'blur(20px)' : undefined,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 24px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '64px',
          }}>
            {/* Logo and Brand */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                style={{
                  display: 'none',
                  marginRight: '12px',
                  background: 'none',
                  border: 'none',
                  color: colors.textMuted,
                  cursor: 'pointer',
                  padding: '8px',
                }}
              >
                {mobileMenuOpen ? <X style={{ width: '24px', height: '24px' }} /> : <Menu style={{ width: '24px', height: '24px' }} />}
              </button>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  background: colors.accentBg,
                  padding: '10px',
                  borderRadius: '12px',
                }}>
                  <Eye style={{ width: '24px', height: '24px', color: colors.accent }} />
                </div>
                <span style={{
                  marginLeft: '12px',
                  fontSize: '18px',
                  fontWeight: 600,
                  color: colors.text,
                }}>
                  Analytics Portal
                </span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '32px'
            }}>
              <NavLink
                to="/viewer/dashboard"
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                  background: isActive ? colors.accentBg : 'transparent',
                  color: isActive ? colors.accent : colors.textMuted,
                  fontWeight: isActive ? 500 : 400,
                })}
              >
                <LayoutDashboard style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                My Dashboards
              </NavLink>
            </div>

            {/* Right Section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <ThemeToggle size="sm" />

              {/* User Menu */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.navHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: colors.accentBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <span style={{ color: colors.accent, fontWeight: 500, fontSize: '14px' }}>
                      {user.first_name.charAt(0)}
                    </span>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: colors.text,
                      margin: 0,
                    }}>
                      {user.first_name} {user.last_name}
                    </p>
                    <p style={{
                      fontSize: '12px',
                      color: colors.textMuted,
                      margin: 0,
                    }}>
                      Viewer
                    </p>
                  </div>
                </button>

                {/* User Dropdown */}
                {userMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    marginTop: '8px',
                    width: '220px',
                    background: colors.dropdownBg,
                    borderRadius: '12px',
                    boxShadow: isDark
                      ? '0 10px 40px rgba(0,0,0,0.5)'
                      : '0 10px 40px rgba(0,0,0,0.1)',
                    border: `1px solid ${colors.headerBorder}`,
                    backdropFilter: isDark ? 'blur(20px)' : undefined,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '16px',
                      borderBottom: `1px solid ${colors.headerBorder}`,
                    }}>
                      <p style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: colors.text,
                        margin: 0,
                      }}>
                        {user.first_name} {user.last_name}
                      </p>
                      <p style={{
                        fontSize: '12px',
                        color: colors.textMuted,
                        margin: '4px 0 0 0',
                      }}>
                        {user.email}
                      </p>
                    </div>
                    <button
                      onClick={handleLogout}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px 16px',
                        fontSize: '14px',
                        color: '#ef4444',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isDark
                          ? 'rgba(239, 68, 68, 0.15)'
                          : '#fef2f2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <LogOut style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div style={{
            borderTop: `1px solid ${colors.headerBorder}`,
            background: colors.header,
            padding: '16px 24px',
          }}>
            <NavLink
              to="/viewer/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                borderRadius: '10px',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                background: isActive ? colors.accentBg : 'transparent',
                color: isActive ? colors.accent : colors.textMuted,
              })}
            >
              <LayoutDashboard style={{ width: '20px', height: '20px', marginRight: '8px' }} />
              My Dashboards
            </NavLink>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '32px 24px',
      }}>
        {children}
      </main>
    </div>
  );
}