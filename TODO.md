# TODO List - Student Management System

## 🔴 High Priority Fixes

### 1. Fix Student Card Formatting in Seating Pool
- **Issue**: Student cards in seating editor pool are too large
- **Expected**: 65x45px compact cards
- **Location**: `/frontend/seating/SeatingEditor.js` - student pool sidebar
- **Action**: 
  - Check if CSS styles were overridden or removed
  - Restore original compact card dimensions
  - Ensure two-line name format fits properly

### 2. Remove classroom_layout Field from UI
- **Issue**: Redundant field causing confusion
- **Locations**:
  - Class creation form
  - Class edit form (once created)
  - Class model serializer
- **Action**:
  - Remove from forms but keep in DB for backwards compatibility
  - Update ClassSerializer to exclude this field
  - Ensure no UI references to default layout

### 3. Fix Seating Card Click Behavior
- **Issue**: "No layout" message prevents creating first seating period
- **Expected Behavior**:
  - Click card → auto-select user's most recent layout
  - If no layouts exist → show modal "Create a layout first" → redirect to layouts
  - Card should show "No current period" not "No layout"
- **Location**: `/frontend/seating/seating.js`

## 🟡 Core Features to Add

### 4. Class Edit View
- **Description**: Allow users to edit existing classes
- **Features**:
  - Edit: name, subject, grade_level, description
  - Access from class card (edit icon)
  - No layout selection
- **Locations**:
  - New component: `/frontend/classes/ClassEditor.js`
  - Add route handling in navigation
  - Add edit button to class cards

### 5. Batch Filter for Students
- **Description**: Filter multiple students by pasting IDs/emails
- **Features**:
  - Checkbox "Batch filter" in Students section
  - When checked, search becomes textarea
  - Accept any delimiter (space, comma, tab, newline)
  - Show "Not found" items
  - "Select All" for filtered results
- **Use Cases**:
  - Add multiple students to class roster
  - Select specific students for seating
- **Location**: `/frontend/students/students.js`

### 6. CSV Batch Import (Superuser Only)
- **Description**: Bulk import students via CSV/Excel
- **Features**:
  - Upload CSV/Excel file
  - Column mapping interface
  - Preview before import
  - Duplicate detection by student_id
  - Error reporting per row
  - Download template option
- **Access**: Superusers only
- **Location**: New component `/frontend/students/StudentImport.js`

## 🟢 Data Isolation & Security

### 7. Verify Ownership Filtering
- **Description**: Ensure users only see their own data
- **Check all ViewSets**:
  - Classes: `filter(teacher=request.user)`
  - Layouts: `filter(created_by=request.user)`
  - SeatingPeriods: `filter(class_assigned__teacher=request.user)`
  - SeatingAssignments: Filter through period → class → teacher
- **Note**: Superusers should also see only their own teaching data
- **Location**: `/students/views.py`

### 8. Layout Dropdown Filtering
- **Description**: Dropdowns should show only user's layouts
- **Locations**:
  - Seating Editor layout selector
  - Any other layout dropdowns
- **Action**: Verify API calls include user filtering

## 📋 Implementation Order

1. **Quick Fixes First** (1-2 hours)
   - [ ] Fix student card size (Priority #1)
   - [ ] Remove classroom_layout from forms (Priority #2)

2. **Core Flow Improvements** (2-3 hours)
   - [ ] Fix seating card behavior (Priority #3)
   - [ ] Add class edit view (Priority #4)

3. **Enhanced Features** (3-4 hours)
   - [ ] Batch filter implementation (Priority #5)
   - [ ] Verify data isolation (Priority #7)

4. **Advanced Features** (4-5 hours)
   - [ ] CSV import for superusers (Priority #6)
   - [ ] Layout dropdown filtering (Priority #8)

## 💭 Design Decisions

### Why Remove classroom_layout?
- SeatingPeriods already have layouts
- Layouts can change between periods
- Reduces confusion and complexity
- Cleaner data model

### Batch Filter vs CSV Upload
- Batch filter is more user-friendly
- No file creation needed
- Instant feedback
- Works for all users, not just superusers
- CSV upload still useful for initial data load

### Data Isolation Philosophy
- "Superuser" = can manage users
- "Superuser" ≠ can see all teaching data
- Each teacher's classroom data is private
- Students are shared resources

## 🔄 Future Considerations

- **Archive/Restore**: Soft delete for classes and layouts
- **Copy/Template**: Duplicate layouts and seating arrangements
- **Export**: Download seating charts as PDF/image
- **History**: Track seating changes over time
- **Bulk Operations**: Select multiple students for actions
- **Permissions**: More granular role-based access

## 📝 Notes

- All changes should maintain backwards compatibility
- Test filtering with both regular users and superusers
- Consider mobile responsiveness for new features
- Maintain consistent UI patterns across components
- Document API changes for deployment