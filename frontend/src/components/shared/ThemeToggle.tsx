import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface ThemeToggleProps {
    size?: 'sm' | 'md' | 'lg';
}

export default function ThemeToggle({ size = 'md' }: ThemeToggleProps) {
    const { isDark, toggleTheme } = useTheme();

    const sizes = {
        sm: { toggle: 44, circle: 18, icon: 12, translate: 22 },
        md: { toggle: 52, circle: 22, icon: 14, translate: 26 },
        lg: { toggle: 60, circle: 26, icon: 16, translate: 30 },
    };

    const s = sizes[size];

    return (
        <button
            onClick={toggleTheme}
            style={{
                width: `${s.toggle}px`,
                height: `${s.circle + 4}px`,
                borderRadius: '9999px',
                background: isDark
                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                    : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                padding: '2px',
                cursor: 'pointer',
                border: 'none',
                position: 'relative',
                transition: 'all 0.3s ease',
                boxShadow: isDark
                    ? '0 2px 10px rgba(99, 102, 241, 0.4)'
                    : '0 2px 10px rgba(251, 191, 36, 0.4)',
            }}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            <div
                style={{
                    width: `${s.circle}px`,
                    height: `${s.circle}px`,
                    borderRadius: '50%',
                    background: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: `translateX(${isDark ? s.translate : 0}px)`,
                    transition: 'transform 0.3s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
            >
                {isDark ? (
                    <Moon style={{ width: `${s.icon}px`, height: `${s.icon}px`, color: '#6366f1' }} />
                ) : (
                    <Sun style={{ width: `${s.icon}px`, height: `${s.icon}px`, color: '#f59e0b' }} />
                )}
            </div>
        </button>
    );
}
