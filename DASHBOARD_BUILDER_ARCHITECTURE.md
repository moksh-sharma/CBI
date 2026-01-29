# Dashboard Builder Architecture

## Component Hierarchy

```
DashboardBuilder (Main Component)
│
├── Top Navigation Bar
│   ├── Back Button
│   ├── Dashboard Name Input
│   ├── Preview Button
│   ├── Save Button
│   └── Publish Button
│
├── AlignmentTools Toolbar ✨ NEW
│   ├── Clipboard Operations (Copy/Paste/Duplicate)
│   ├── Horizontal Alignment (Left/Center/Right)
│   ├── Vertical Alignment (Top/Middle/Bottom)
│   ├── Distribution (Horizontal/Vertical)
│   ├── Layer Controls (Front/Back)
│   └── Lock/Delete
│
├── Main Content (PanelGroup)
│   │
│   ├── Left Panel (Data Sources & Columns)
│   │   ├── Data Sources Section
│   │   │   ├── Dataset List
│   │   │   └── Selection Checkboxes
│   │   │
│   │   └── Columns Section
│   │       ├── Field Search
│   │       └── Draggable Column List
│   │
│   ├── Center Panel (Canvas)
│   │   ├── Zoom Controls
│   │   ├── Pan & Zoom Stage
│   │   └── Widget Container
│   │       ├── Draggable Widgets
│   │       ├── Resizable Widgets
│   │       └── ChartRenderer
│   │
│   └── Right Panel (Visualizations & Fields)
│       ├── Tab Selector (Build/Fields/Format)
│       │
│       ├── Build Tab
│       │   └── Chart Type Grid
│       │
│       ├── Fields Tab
│       │   ├── Dataset Selector
│       │   ├── Field Buckets (X-axis/Y-axis/Legend)
│       │   └── Validation Errors
│       │
│       └── Format Tab
│           ├── Title Input
│           ├── Aggregation Selector
│           └── Accent Color Picker
│
├── FilterPane ✨ NEW (Optional Panel)
│   ├── Visual Level Filters
│   ├── Page Level Filters
│   └── Report Level Filters
│
├── DataPreview ✨ NEW (Modal/Panel)
│   ├── Search Bar
│   ├── Data Table
│   │   ├── Column Headers (sortable)
│   │   ├── Column Filters
│   │   └── Data Rows
│   └── Pagination Controls
│
├── Modals
│   ├── DashboardDetailsModal
│   ├── UserAssignmentModal
│   └── KeyboardShortcutsHelp ✨ NEW
│
└── Hooks & State Management
    ├── useUndoRedo ✨ NEW
    ├── useKeyboardShortcuts ✨ NEW
    ├── useAuth
    └── useTheme
```

## Data Flow

```
User Actions
    │
    ├─→ Keyboard Shortcuts ──→ useKeyboardShortcuts ──→ Action Handlers
    │
    ├─→ Widget Manipulation ──→ useUndoRedo ──→ State History
    │
    ├─→ Alignment Tools ──→ Widget Position/Size Updates ──→ Canvas Re-render
    │
    ├─→ Filter Pane ──→ Filter State ──→ Data Filtering ──→ Chart Re-render
    │
    └─→ Data Preview ──→ Dataset Selection ──→ Data Fetch ──→ Table Display
```

## State Management

```
Dashboard State
│
├── widgets: Widget[]                    ← Managed by useUndoRedo
├── selectedWidgetIds: string[]          ← Multi-selection
├── selectedDatasets: Set<number>        ← Active data sources
├── datasetData: Record<number, any[]>   ← Cached data
├── columns: Record<number, Column[]>    ← Schema info
├── globalFilters: Record<string, any>   ← Cross-filtering
├── filters: FilterRule[]                ← Filter pane state ✨ NEW
├── clipboard: Widget[]                  ← Copy/paste buffer ✨ NEW
├── zoom: number                         ← Canvas zoom level
├── pan: { x: number; y: number }        ← Canvas pan offset
└── history: HistoryState[]              ← Undo/redo stack ✨ NEW
```

## Widget Lifecycle

```
1. User clicks chart type in Build tab
   ↓
2. addWidget() creates new Widget object
   ↓
3. Widget added to canvas with auto-layout position
   ↓
4. User drags fields to buckets (X-axis, Y-axis, Legend)
   ↓
5. updateWidget() updates widget configuration
   ↓
6. ChartRenderer processes data and renders chart
   ↓
7. User can:
   - Move widget (Draggable)
   - Resize widget (Resizable)
   - Format widget (Format tab)
   - Align widget (AlignmentTools) ✨ NEW
   - Lock widget (AlignmentTools) ✨ NEW
   - Copy/Paste widget (AlignmentTools) ✨ NEW
   ↓
8. All changes tracked in undo/redo history ✨ NEW
   ↓
9. Save dashboard to backend
```

## Filter Flow

```
Filter Pane
    │
    ├─→ Visual Level Filter
    │   └─→ Affects single widget
    │
    ├─→ Page Level Filter
    │   └─→ Affects all widgets on page
    │
    └─→ Report Level Filter
        └─→ Affects entire dashboard
            │
            ↓
        Global Filters State
            │
            ↓
        applyGlobalFilters()
            │
            ↓
        Filtered Data
            │
            ↓
        Chart Re-render
```

## Keyboard Shortcut Flow

```
User presses key combination
    │
    ↓
useKeyboardShortcuts hook intercepts
    │
    ├─→ Check if input field is focused
    │   └─→ If yes, allow only specific shortcuts (Ctrl+Z, Ctrl+Y)
    │
    ├─→ Match key combination to registered shortcuts
    │
    └─→ Execute action handler
        │
        ├─→ Undo/Redo actions
        ├─→ Clipboard actions
        ├─→ Alignment actions
        ├─→ View actions (zoom, pan)
        └─→ Selection actions
```

## Undo/Redo Flow

```
User makes change
    │
    ↓
pushState(newWidgets)
    │
    ├─→ Add to history array
    ├─→ Increment currentIndex
    └─→ Trim history if > maxHistory (50)
        │
        ↓
    History Stack Updated
        │
        ├─→ Ctrl+Z pressed
        │   └─→ undo() ──→ currentIndex-- ──→ Restore previous state
        │
        └─→ Ctrl+Y pressed
            └─→ redo() ──→ currentIndex++ ──→ Restore next state
```

## Alignment Algorithm

```
User selects multiple widgets
    │
    ↓
Clicks alignment button (e.g., Align Left)
    │
    ↓
alignWidgets('left')
    │
    ├─→ Calculate bounding box of all selected widgets
    ├─→ Find leftmost widget's X position
    ├─→ Update all selected widgets to that X position
    └─→ pushState(newWidgets) to save in history
        │
        ↓
    Canvas re-renders with aligned widgets
```

## Distribution Algorithm

```
User selects 3+ widgets
    │
    ↓
Clicks distribute button (e.g., Distribute Horizontally)
    │
    ↓
distributeWidgets('horizontal')
    │
    ├─→ Sort widgets by X position
    ├─→ Calculate total space between first and last widget
    ├─→ Calculate total widget widths
    ├─→ Calculate even spacing: (totalSpace - totalWidths) / (count - 1)
    ├─→ Position widgets with calculated spacing
    └─→ pushState(newWidgets) to save in history
        │
        ↓
    Canvas re-renders with distributed widgets
```

## Performance Optimizations

```
1. Memoization
   ├─→ useMemo for filtered data
   ├─→ useMemo for sorted data
   └─→ useCallback for event handlers

2. Lazy Loading
   ├─→ Dataset data fetched on demand
   └─→ Columns fetched when dataset selected

3. Debouncing
   ├─→ Search inputs debounced
   └─→ Filter inputs debounced

4. Virtual Scrolling
   └─→ Data Preview uses pagination

5. Efficient Re-renders
   ├─→ React.memo for expensive components
   └─→ Minimal state updates
```

## Integration Points

```
Backend API
    │
    ├─→ GET /api/data/datasets
    │   └─→ Fetch available datasets
    │
    ├─→ GET /api/data/datasets/:id
    │   └─→ Fetch dataset data and schema
    │
    ├─→ POST /api/dashboards
    │   └─→ Create new dashboard
    │
    ├─→ PUT /api/dashboards/:id
    │   └─→ Update dashboard (includes widgets, filters, etc.)
    │
    └─→ POST /api/dashboards/:id/assign
        └─→ Assign dashboard to users
```

## Component Dependencies

```
DashboardBuilder
    │
    ├── Dependencies
    │   ├── react
    │   ├── react-router
    │   ├── react-draggable
    │   ├── re-resizable
    │   ├── react-resizable-panels
    │   └── lucide-react
    │
    ├── Custom Hooks
    │   ├── useAuth
    │   ├── useTheme
    │   ├── useUndoRedo ✨ NEW
    │   └── useKeyboardShortcuts ✨ NEW
    │
    ├── Custom Components
    │   ├── ChartRenderer
    │   ├── UserAssignmentModal
    │   ├── DashboardDetailsModal
    │   ├── AlignmentTools ✨ NEW
    │   ├── FilterPane ✨ NEW
    │   └── DataPreview ✨ NEW
    │
    └── Utilities
        ├── chartRegistry
        ├── dashboardFilters
        ├── themeColors
        └── widgetDataUtils
```

## Future Architecture Enhancements

```
Planned Additions
    │
    ├── Cross-Highlighting System
    │   └─→ Widget interaction events ──→ Filter propagation
    │
    ├── Drill-Down Manager
    │   └─→ Hierarchy navigation ──→ Dynamic data fetching
    │
    ├── Bookmark System
    │   └─→ State snapshots ──→ Quick view switching
    │
    ├── Export Engine
    │   └─→ PDF/Excel generation ──→ Server-side rendering
    │
    └── Collaboration Layer
        └─→ Real-time updates ──→ Socket.IO integration
```

---

This architecture provides:
- ✅ Scalable component structure
- ✅ Clear data flow
- ✅ Efficient state management
- ✅ Performance optimizations
- ✅ Easy integration points
- ✅ Future-proof design
