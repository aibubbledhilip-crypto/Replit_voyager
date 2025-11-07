# Voyager Design Guidelines

## Design Approach

**Selected System:** Carbon Design System (IBM)  
**Justification:** Carbon is purpose-built for data-intensive enterprise applications with complex data tables, dashboards, and form-heavy interfaces. It provides robust patterns for query builders, data visualization, and admin controls.

**Core Principles:**
- Clarity over aesthetics: Information hierarchy is paramount
- Efficiency: Minimize clicks and cognitive load for frequent tasks
- Professional credibility: Enterprise-grade appearance instills trust
- Data-first: Tables and query results are the hero elements

---

## Typography

**Font Family:** IBM Plex Sans (via Google Fonts CDN)

**Hierarchy:**
- Page Titles: text-3xl font-semibold (Admin Dashboard, Query Execution)
- Section Headers: text-xl font-medium (Usage Logs, Query Settings)
- Card Titles: text-lg font-medium
- Body Text: text-base font-normal
- Table Headers: text-sm font-semibold uppercase tracking-wide
- Table Data: text-sm font-normal
- Helper Text: text-xs
- Buttons: text-sm font-medium

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, and 8 (p-4, mb-6, gap-8)

**Container Strategy:**
- Max-width: max-w-7xl for main content areas
- Padding: px-6 on desktop, px-4 on mobile
- Section spacing: mb-8 between major sections

**Grid System:**
- Admin dashboard: 2-column layout (sidebar + main content)
- Query interface: Single column with expandable results panel
- Tables: Full-width within container for maximum data visibility

---

## Component Library

### Navigation
**Top Navigation Bar:**
- Fixed header with app logo "Voyager", user profile dropdown, logout button
- Height: h-16
- Contains role indicator badge (Admin/User)

**Sidebar (Admin Only):**
- Width: w-64
- Navigation items: Dashboard, User Management, Usage Logs, Query Limits
- Active state with left border accent

### Authentication
**Login Page:**
- Centered card (max-w-md) on clean background
- Replit Auth integration buttons stacked vertically
- "Voyager" wordmark above login card
- Spacing: p-8 for card padding

### Query Execution Interface
**Query Builder Card:**
- SQL text area with monospace font (font-mono)
- Minimum height: h-64
- Action buttons: "Execute Query", "Clear", "Save Query"
- Connection status indicator (connected/disconnected badge)

**Results Display:**
- Data table with zebra striping for rows
- Sticky header for scrolling
- Pagination controls below table
- Export to CSV button (top-right of table)
- Row limit indicator showing "Showing X of Y rows (limit: Z)"

### Admin Dashboard
**Statistics Cards:**
- 4-column grid on desktop (grid-cols-4), 2-column on tablet, 1-column on mobile
- Metrics: Total Queries, Active Users, Avg Query Time, Data Extracted
- Card padding: p-6

**Query Limit Control:**
- Prominent card at top of settings
- Number input with increment/decrement buttons
- "Update Limit" primary button
- Current limit displayed prominently

**User Management Table:**
- Columns: Username, Email, Role, Last Active, Actions
- Inline edit for role assignment
- Actions: Edit, Deactivate/Activate

### Usage Logs
**Log Table:**
- Columns: Timestamp, User, Query Preview, Rows Returned, Execution Time
- Filters: Date range picker, user dropdown, export button
- Expandable rows showing full query text
- Search functionality above table

### Forms
**Input Fields:**
- Standard height: h-10
- Label above input: text-sm font-medium mb-2
- Focus states with border emphasis
- Error messages in red below field

**Buttons:**
- Primary: Solid background (Query Execute, Save)
- Secondary: Outlined (Cancel, Clear)
- Destructive: Red treatment (Delete, Deactivate)
- Height: h-10, padding: px-6

---

## Data Visualization

**Table Treatment:**
- Cell padding: px-4 py-3
- Border between rows
- Hover state for entire row
- Sortable column headers with arrow indicators
- Loading skeleton while fetching data

**Status Indicators:**
- Query Status: Green (Success), Red (Error), Yellow (Warning), Gray (Pending)
- Connection Status: Dot indicator in top nav
- Badge style: Rounded pill with subtle background

---

## Page Layouts

**Query Page:**
- Connection details card (collapsible) at top
- Query builder occupying 40% of viewport
- Results table expanding below
- No distracting animations

**Admin Dashboard:**
- Left sidebar navigation
- Main content area with statistics cards row
- Usage graph (simple line chart showing queries over time)
- Recent activity feed

**Usage Logs Page:**
- Full-width table with filtering controls above
- Export and date range controls in top-right
- Pagination at bottom

---

## Animations

Minimal animations for professional context:
- Smooth transitions for sidebar expansion (transition-all duration-200)
- Loading spinners for data fetches
- Subtle hover states (no elaborate effects)

---

## Images

**Login Page:**
- Abstract data visualization background (blurred, low opacity) behind login card
- Suggests database connectivity and data flow theme

**Empty States:**
- Illustration for "No queries executed yet" in usage logs
- Simple line art style, not photographic

No hero images required - this is a utility application where data tables and forms are primary content.