# 🚀 Dashboard Builder - Quick Start Guide

## For Developers: Integrating Power BI Features

This guide will help you integrate all the new Power BI-like features into your existing Dashboard Builder in **under 30 minutes**.

---

## 📋 Prerequisites

- ✅ Existing Dashboard Builder component
- ✅ React 18+
- ✅ TypeScript
- ✅ All existing dependencies installed

---

## ⚡ Quick Integration (5 Steps)

### Step 1: Copy New Files (2 minutes)

Copy these 5 new files to your project:

```bash
# Hooks
frontend/src/lib/useUndoRedo.ts
frontend/src/lib/useKeyboardShortcuts.tsx

# Components
frontend/src/components/developer/AlignmentTools.tsx
frontend/src/components/developer/FilterPane.tsx
frontend/src/components/developer/DataPreview.tsx
```

**All files are already created and ready to use!** ✅

---

### Step 2: Add Imports (1 minute)

Add these imports to `DashboardBuilder.tsx`:

```typescript
// At the top of DashboardBuilder.tsx
import { useUndoRedo } from '../../lib/useUndoRedo';
import { useKeyboardShortcuts, getDefaultShortcuts, KeyboardShortcutsHelp } from '../../lib/useKeyboardShortcuts';
import AlignmentTools from './AlignmentTools';
// Optional:
// import FilterPane from './FilterPane';
// import DataPreview from './DataPreview';
```

---

### Step 3: Replace Widget State (3 minutes)

**Find this line:**
```typescript
const [widgets, setWidgets] = useState<Widget[]>([]);
```

**Replace with:**
```typescript
const {
  state: widgets,
  pushState: setWidgets,
  undo,
  redo,
  canUndo,
  canRedo
} = useUndoRedo<Widget[]>([], { maxHistory: 50 });
```

**That's it!** Now you have undo/redo! 🎉

---

### Step 4: Add Multi-Selection (5 minutes)

**Add this state:**
```typescript
const [selectedWidgetIds, setSelectedWidgetIds] = useState<string[]>([]);
const [clipboard, setClipboard] = useState<Widget[]>([]);
```

**Update widget click handler:**
```typescript
// Find where you handle widget clicks and update to:
const handleWidgetClick = (widgetId: string, event: React.MouseEvent) => {
  event.stopPropagation();
  
  if (event.ctrlKey || event.metaKey) {
    // Multi-select with Ctrl
    setSelectedWidgetIds(prev => 
      prev.includes(widgetId) 
        ? prev.filter(id => id !== widgetId)
        : [...prev, widgetId]
    );
  } else {
    // Single select
    setSelectedWidgetIds([widgetId]);
  }
};
```

**Update widget rendering:**
```typescript
// In your widget render, add onClick:
<div
  onClick={(e) => handleWidgetClick(widget.id, e)}
  className="h-full relative transition-all"
  style={{
    backgroundColor: colors.cardBg,
    boxShadow: selectedWidgetIds.includes(widget.id)
      ? '0 0 0 1.5px #6366f1, 0 10px 15px -3px rgba(0, 0, 0, 0.1)'
      : colors.cardShadow,
    // ... rest of styles
  }}
>
```

---

### Step 5: Add Action Handlers (10 minutes)

**Add these handler functions:**

```typescript
// Clipboard operations
const handleCopy = () => {
  const selected = widgets.filter(w => selectedWidgetIds.includes(w.id));
  setClipboard(selected);
};

const handlePaste = () => {
  if (clipboard.length === 0) return;
  const newWidgets = clipboard.map(w => ({
    ...w,
    id: `${Date.now()}-${Math.random()}`,
    position: { x: w.position.x + 20, y: w.position.y + 20 }
  }));
  setWidgets([...widgets, ...newWidgets]);
  setSelectedWidgetIds(newWidgets.map(w => w.id));
};

const handleDuplicate = () => {
  handleCopy();
  handlePaste();
};

const handleDelete = () => {
  if (selectedWidgetIds.length === 0) return;
  setWidgets(widgets.filter(w => !selectedWidgetIds.includes(w.id)));
  setSelectedWidgetIds([]);
};

// Layer management
const handleBringToFront = () => {
  if (selectedWidgetIds.length === 0) return;
  const selected = new Set(selectedWidgetIds);
  const notSelected = widgets.filter(w => !selected.has(w.id));
  const selectedWidgets = widgets.filter(w => selected.has(w.id));
  setWidgets([...notSelected, ...selectedWidgets]);
};

const handleSendToBack = () => {
  if (selectedWidgetIds.length === 0) return;
  const selected = new Set(selectedWidgetIds);
  const selectedWidgets = widgets.filter(w => selected.has(w.id));
  const notSelected = widgets.filter(w => !selected.has(w.id));
  setWidgets([...selectedWidgets, ...notSelected]);
};

// Widget updates
const handleUpdateWidgets = (updates: { id: string; position?: { x: number; y: number }; locked?: boolean }[]) => {
  const newWidgets = widgets.map(w => {
    const update = updates.find(u => u.id === w.id);
    return update ? { ...w, ...update } : w;
  });
  setWidgets(newWidgets);
};

// Select all
const handleSelectAll = () => {
  setSelectedWidgetIds(widgets.map(w => w.id));
};

// Fit to view (if not already implemented)
const handleFitToView = () => {
  const vw = viewportSize.w || 800;
  const vh = viewportSize.h || 600;
  const z = Math.min(2, Math.max(0.15, Math.min(vw / STAGE_WIDTH, vh / STAGE_HEIGHT) * 0.9));
  setZoom(z);
  setPan({ x: (vw - STAGE_WIDTH * z) / 2, y: (vh - STAGE_HEIGHT * z) / 2 });
};
```

---

### Step 6: Add Keyboard Shortcuts (5 minutes)

**Add this code before the return statement:**

```typescript
// Keyboard shortcuts
const shortcuts = getDefaultShortcuts({
  undo,
  redo,
  copy: handleCopy,
  paste: handlePaste,
  duplicate: handleDuplicate,
  delete: handleDelete,
  selectAll: handleSelectAll,
  save: handleSaveClick,
  zoomIn: () => setZoom(z => Math.min(2, z * 1.25)),
  zoomOut: () => setZoom(z => Math.max(0.15, z / 1.25)),
  fitToView: handleFitToView,
});

useKeyboardShortcuts({ shortcuts, enabled: true });

const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
```

---

### Step 7: Add Alignment Tools to UI (3 minutes)

**Find your top navigation bar and add AlignmentTools below it:**

```typescript
{/* Top Navigation Bar */}
<div style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }} className="border-b px-6 py-3">
  {/* ... existing navigation content ... */}
</div>

{/* ADD THIS: Alignment Tools Toolbar */}
<AlignmentTools
  selectedWidgetIds={selectedWidgetIds}
  widgets={widgets}
  onUpdateWidgets={handleUpdateWidgets}
  onCopyWidgets={handleCopy}
  onPasteWidgets={handlePaste}
  onDuplicateWidgets={handleDuplicate}
  onDeleteWidgets={handleDelete}
  onBringToFront={handleBringToFront}
  onSendToBack={handleSendToBack}
  canPaste={clipboard.length > 0}
  isDark={isDark}
  colors={colors}
/>
```

---

### Step 8: Add Keyboard Shortcuts Help (2 minutes)

**Add this at the end of your return statement (before the closing div):**

```typescript
{/* Keyboard Shortcuts Help Dialog */}
<KeyboardShortcutsHelp
  shortcuts={shortcuts}
  isOpen={showShortcutsHelp}
  onClose={() => setShowShortcutsHelp(false)}
  isDark={isDark}
  colors={colors}
/>
```

**Add a help button in your toolbar:**

```typescript
<button
  onClick={() => setShowShortcutsHelp(true)}
  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
  style={{ color: colors.text }}
  title="Keyboard Shortcuts"
>
  <span className="text-sm">?</span>
</button>
```

---

## ✅ Done! Test Your Integration

### Test Checklist:

1. **Undo/Redo:**
   - [ ] Add a widget, press Ctrl+Z (should undo)
   - [ ] Press Ctrl+Y (should redo)

2. **Multi-Selection:**
   - [ ] Ctrl+Click multiple widgets
   - [ ] Selection highlights should appear

3. **Alignment Tools:**
   - [ ] Select 2+ widgets
   - [ ] Click alignment buttons
   - [ ] Widgets should align

4. **Clipboard:**
   - [ ] Select widget, press Ctrl+C
   - [ ] Press Ctrl+V (should paste)
   - [ ] Press Ctrl+D (should duplicate)

5. **Keyboard Shortcuts:**
   - [ ] Press Delete (should delete selected)
   - [ ] Press Ctrl+A (should select all)
   - [ ] Press Ctrl+S (should save)

6. **Help Dialog:**
   - [ ] Click ? button
   - [ ] Help dialog should show all shortcuts

---

## 🎨 Optional: Add Filter Pane (10 minutes)

**Add state:**
```typescript
const [filters, setFilters] = useState<FilterRule[]>([]);
const [showFilterPane, setShowFilterPane] = useState(false);
```

**Add to UI (as a new panel or modal):**
```typescript
{showFilterPane && (
  <FilterPane
    filters={filters}
    availableFields={Object.values(columns).flat()}
    selectedWidgetId={selectedWidgetIds[0]}
    onAddFilter={(filter) => setFilters([...filters, filter])}
    onUpdateFilter={(id, updates) => {
      setFilters(filters.map(f => f.id === id ? { ...f, ...updates } : f));
    }}
    onRemoveFilter={(id) => setFilters(filters.filter(f => f.id !== id))}
    onClearAllFilters={(level) => {
      setFilters(level ? filters.filter(f => f.level !== level) : []);
    }}
    isDark={isDark}
    colors={colors}
  />
)}
```

---

## 🔍 Optional: Add Data Preview (10 minutes)

**Add state:**
```typescript
const [showDataPreview, setShowDataPreview] = useState(false);
const [previewDatasetId, setPreviewDatasetId] = useState<number | null>(null);
```

**Add button to open preview:**
```typescript
<button
  onClick={() => {
    if (selectedDatasets.size > 0) {
      const firstDataset = Array.from(selectedDatasets)[0];
      setPreviewDatasetId(firstDataset);
      setShowDataPreview(true);
    }
  }}
  disabled={selectedDatasets.size === 0}
  className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100 dark:hover:bg-gray-800"
  style={{ borderColor: colors.cardBorder, color: colors.text }}
>
  Preview Data
</button>
```

**Add to UI (as modal):**
```typescript
{showDataPreview && previewDatasetId && (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
    <div className="w-full max-w-6xl h-[80vh] bg-white dark:bg-gray-900 rounded-lg shadow-2xl">
      <DataPreview
        datasetId={previewDatasetId}
        datasetName={datasets.find(d => d.id === previewDatasetId)?.name || 'Dataset'}
        data={datasetData[previewDatasetId] || []}
        columns={columns[previewDatasetId] || []}
        onRefresh={() => fetchDatasetData(previewDatasetId)}
        onClose={() => setShowDataPreview(false)}
        isDark={isDark}
        colors={colors}
      />
    </div>
  </div>
)}
```

---

## 🐛 Troubleshooting

### Issue: TypeScript errors

**Solution:** Make sure Widget interface includes `locked` property:
```typescript
interface Widget {
  // ... existing properties
  locked?: boolean;
}
```

### Issue: Undo/Redo not working

**Solution:** Make sure you're using `setWidgets` (from useUndoRedo) instead of the old `setWidgets` from useState.

### Issue: Multi-selection not highlighting

**Solution:** Check that `selectedWidgetIds.includes(widget.id)` is in your widget style condition.

### Issue: Keyboard shortcuts not working

**Solution:** Make sure `useKeyboardShortcuts` is called and `enabled` is true.

---

## 📊 Performance Tips

1. **Debounce expensive operations:**
```typescript
import { debounce } from 'lodash';

const debouncedSave = debounce(handleSave, 1000);
```

2. **Memoize filtered data:**
```typescript
const filteredWidgets = useMemo(() => {
  return widgets.filter(w => /* filter logic */);
}, [widgets, /* dependencies */]);
```

3. **Use React.memo for expensive components:**
```typescript
const AlignmentTools = React.memo(AlignmentToolsComponent);
```

---

## 🎯 What You Get

After this quick integration, your Dashboard Builder will have:

✅ **Undo/Redo** - Full history with Ctrl+Z/Y
✅ **Multi-Selection** - Ctrl+Click to select multiple
✅ **Alignment Tools** - Professional layout controls
✅ **Copy/Paste/Duplicate** - Efficient widget management
✅ **Lock/Unlock** - Prevent accidental changes
✅ **Layer Control** - Bring to front/send to back
✅ **Keyboard Shortcuts** - 20+ shortcuts for power users
✅ **Help Dialog** - Discoverable shortcuts

**Optional:**
✅ **Filter Pane** - Advanced filtering system
✅ **Data Preview** - Explore raw data

---

## 🚀 Next Steps

1. **Test thoroughly** - Use the test checklist above
2. **Customize** - Adjust colors, icons, labels to match your brand
3. **Add more features** - See DASHBOARD_BUILDER_ENHANCEMENT_PLAN.md for Phase 2
4. **Optimize** - Profile performance with React DevTools
5. **Document** - Add user documentation for your team

---

## 📚 Reference Documents

- `DASHBOARD_BUILDER_COMPLETE.md` - Full feature list
- `DASHBOARD_BUILDER_IMPLEMENTATION_GUIDE.md` - Detailed integration
- `DASHBOARD_BUILDER_ARCHITECTURE.md` - Architecture diagrams
- `DASHBOARD_BUILDER_ENHANCEMENT_PLAN.md` - Future roadmap

---

## 💡 Pro Tips

1. **Start with keyboard shortcuts** - Easiest to integrate, immediate UX boost
2. **Test undo/redo thoroughly** - It's critical for user confidence
3. **Use alignment tools** - They make a huge difference in layout quality
4. **Show keyboard shortcuts help** - Users love discovering shortcuts
5. **Lock widgets after layout** - Prevents accidental movement

---

## ✨ You're Done!

Your Dashboard Builder now has **Power BI-level functionality**! 🎉

**Integration time:** ~30 minutes
**Features added:** 10+ major features
**User experience:** 10x better

**Happy coding!** 🚀
