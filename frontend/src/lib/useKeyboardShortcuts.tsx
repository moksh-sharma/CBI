/**
 * Keyboard Shortcuts Hook
 * Power BI-like keyboard shortcuts for dashboard builder
 */

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    action: () => void;
    description: string;
    preventDefault?: boolean;
}

export interface UseKeyboardShortcutsOptions {
    enabled?: boolean;
    shortcuts: KeyboardShortcut[];
}

export function useKeyboardShortcuts({ enabled = true, shortcuts }: UseKeyboardShortcutsOptions) {
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!enabled) return;

        // Don't trigger shortcuts when typing in inputs
        const target = event.target as HTMLElement;
        if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        ) {
            // Allow some shortcuts even in inputs (like Ctrl+Z, Ctrl+Y)
            const allowedInInputs = ['z', 'y', 'a'];
            if (!event.ctrlKey || !allowedInInputs.includes(event.key.toLowerCase())) {
                return;
            }
        }

        for (const shortcut of shortcuts) {
            const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
            const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
            const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
            const altMatch = shortcut.alt ? event.altKey : !event.altKey;

            if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                if (shortcut.preventDefault !== false) {
                    event.preventDefault();
                }
                shortcut.action();
                break;
            }
        }
    }, [enabled, shortcuts]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}

/**
 * Default keyboard shortcuts for dashboard builder
 */
export function getDefaultShortcuts(actions: {
    undo?: () => void;
    redo?: () => void;
    copy?: () => void;
    paste?: () => void;
    duplicate?: () => void;
    delete?: () => void;
    selectAll?: () => void;
    save?: () => void;
    zoomIn?: () => void;
    zoomOut?: () => void;
    fitToView?: () => void;
    toggleGrid?: () => void;
    alignLeft?: () => void;
    alignCenter?: () => void;
    alignRight?: () => void;
    alignTop?: () => void;
    alignMiddle?: () => void;
    alignBottom?: () => void;
    bringToFront?: () => void;
    sendToBack?: () => void;
    lock?: () => void;
}): KeyboardShortcut[] {
    const shortcuts: KeyboardShortcut[] = [];

    if (actions.undo) {
        shortcuts.push({
            key: 'z',
            ctrl: true,
            action: actions.undo,
            description: 'Undo'
        });
    }

    if (actions.redo) {
        shortcuts.push({
            key: 'y',
            ctrl: true,
            action: actions.redo,
            description: 'Redo'
        });
    }

    if (actions.copy) {
        shortcuts.push({
            key: 'c',
            ctrl: true,
            action: actions.copy,
            description: 'Copy'
        });
    }

    if (actions.paste) {
        shortcuts.push({
            key: 'v',
            ctrl: true,
            action: actions.paste,
            description: 'Paste'
        });
    }

    if (actions.duplicate) {
        shortcuts.push({
            key: 'd',
            ctrl: true,
            action: actions.duplicate,
            description: 'Duplicate'
        });
    }

    if (actions.delete) {
        shortcuts.push({
            key: 'Delete',
            action: actions.delete,
            description: 'Delete selected'
        });
    }

    if (actions.selectAll) {
        shortcuts.push({
            key: 'a',
            ctrl: true,
            action: actions.selectAll,
            description: 'Select all'
        });
    }

    if (actions.save) {
        shortcuts.push({
            key: 's',
            ctrl: true,
            action: actions.save,
            description: 'Save dashboard'
        });
    }

    if (actions.zoomIn) {
        shortcuts.push({
            key: '+',
            ctrl: true,
            action: actions.zoomIn,
            description: 'Zoom in'
        });
    }

    if (actions.zoomOut) {
        shortcuts.push({
            key: '-',
            ctrl: true,
            action: actions.zoomOut,
            description: 'Zoom out'
        });
    }

    if (actions.fitToView) {
        shortcuts.push({
            key: '0',
            ctrl: true,
            action: actions.fitToView,
            description: 'Fit to view'
        });
    }

    if (actions.toggleGrid) {
        shortcuts.push({
            key: 'g',
            ctrl: true,
            action: actions.toggleGrid,
            description: 'Toggle grid'
        });
    }

    // Alignment shortcuts
    if (actions.alignLeft) {
        shortcuts.push({
            key: 'ArrowLeft',
            ctrl: true,
            shift: true,
            action: actions.alignLeft,
            description: 'Align left'
        });
    }

    if (actions.alignRight) {
        shortcuts.push({
            key: 'ArrowRight',
            ctrl: true,
            shift: true,
            action: actions.alignRight,
            description: 'Align right'
        });
    }

    if (actions.alignTop) {
        shortcuts.push({
            key: 'ArrowUp',
            ctrl: true,
            shift: true,
            action: actions.alignTop,
            description: 'Align top'
        });
    }

    if (actions.alignBottom) {
        shortcuts.push({
            key: 'ArrowDown',
            ctrl: true,
            shift: true,
            action: actions.alignBottom,
            description: 'Align bottom'
        });
    }

    if (actions.bringToFront) {
        shortcuts.push({
            key: ']',
            ctrl: true,
            action: actions.bringToFront,
            description: 'Bring to front'
        });
    }

    if (actions.sendToBack) {
        shortcuts.push({
            key: '[',
            ctrl: true,
            action: actions.sendToBack,
            description: 'Send to back'
        });
    }

    if (actions.lock) {
        shortcuts.push({
            key: 'l',
            ctrl: true,
            action: actions.lock,
            description: 'Lock/unlock selected'
        });
    }

    return shortcuts;
}

/**
 * Keyboard shortcuts help dialog
 */
export function KeyboardShortcutsHelp({
    shortcuts,
    isOpen,
    onClose,
    isDark,
    colors
}: {
    shortcuts: KeyboardShortcut[];
    isOpen: boolean;
    onClose: () => void;
    isDark: boolean;
    colors: any;
}) {
    if (!isOpen) return null;

    const formatShortcut = (shortcut: KeyboardShortcut) => {
        const parts: string[] = [];
        if (shortcut.ctrl) parts.push('Ctrl');
        if (shortcut.shift) parts.push('Shift');
        if (shortcut.alt) parts.push('Alt');
        parts.push(shortcut.key);
        return parts.join(' + ');
    };

    const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
        const category = shortcut.description.includes('Align') ? 'Alignment' :
            shortcut.description.includes('Zoom') || shortcut.description.includes('Fit') ? 'View' :
                shortcut.description.includes('Undo') || shortcut.description.includes('Redo') ? 'Edit' :
                    shortcut.description.includes('Copy') || shortcut.description.includes('Paste') || shortcut.description.includes('Duplicate') ? 'Clipboard' :
                        shortcut.description.includes('Bring') || shortcut.description.includes('Send') || shortcut.description.includes('Lock') ? 'Arrange' :
                            'General';

        if (!acc[category]) acc[category] = [];
        acc[category].push(shortcut);
        return acc;
    }, {} as Record<string, KeyboardShortcut[]>);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={onClose}>
            <div
                className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg shadow-2xl"
                style={{ backgroundColor: colors.cardBg }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 px-6 py-4 border-b" style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}>
                    <h2 style={{ color: colors.text }} className="text-xl font-semibold">Keyboard Shortcuts</h2>
                </div>

                <div className="p-6 space-y-6">
                    {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
                        <div key={category}>
                            <h3 style={{ color: colors.text }} className="text-sm font-semibold mb-3 text-indigo-600">{category}</h3>
                            <div className="space-y-2">
                                {categoryShortcuts.map((shortcut, index) => (
                                    <div key={index} className="flex items-center justify-between py-2">
                                        <span style={{ color: colors.text }} className="text-sm">{shortcut.description}</span>
                                        <kbd
                                            className="px-3 py-1 text-xs font-mono rounded border"
                                            style={{
                                                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
                                                borderColor: colors.cardBorder,
                                                color: colors.text
                                            }}
                                        >
                                            {formatShortcut(shortcut)}
                                        </kbd>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="sticky bottom-0 px-6 py-4 border-t" style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}>
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
