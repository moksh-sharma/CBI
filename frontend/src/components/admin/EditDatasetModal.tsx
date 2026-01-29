import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeColors } from '../../lib/themeColors';

interface Dataset {
  id: number;
  name: string;
  description: string | null;
}

interface EditDatasetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  dataset: Dataset | null;
}

export default function EditDatasetModal({ isOpen, onClose, onSave, dataset }: EditDatasetModalProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (dataset) {
      setName(dataset.name || '');
      setDescription(dataset.description || '');
    }
  }, [dataset]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Name is required');
      return;
    }
    onSave(name.trim(), description.trim() || '');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ backgroundColor: colors.cardBg, borderRadius: '0.5rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', width: '100%', maxWidth: '28rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: colors.text }}>Edit Data Source</h2>
          <button
            onClick={onClose}
            style={{ color: colors.muted, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: colors.text, marginBottom: '0.5rem' }}>
              Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Data source name"
              style={{ width: '100%', padding: '0.5rem 1rem', border: `1px solid ${colors.inputBorder}`, borderRadius: '0.5rem', outline: 'none', backgroundColor: colors.inputBg, color: colors.text }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: colors.text, marginBottom: '0.5rem' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Data source description"
              rows={3}
              style={{ width: '100%', padding: '0.5rem 1rem', border: `1px solid ${colors.inputBorder}`, borderRadius: '0.5rem', outline: 'none', backgroundColor: colors.inputBg, color: colors.text, resize: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '0.5rem 1rem', color: colors.text, backgroundColor: 'transparent', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', transition: 'background-color 0.2s' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '0.5rem 1rem', backgroundColor: '#dc2626', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s' }}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
