# Frontend Utilities Migration Guide

## Overview
A new shared utilities module has been created at `/frontend/shared/utils.js` to eliminate code duplication across the frontend. This guide shows how to migrate each file to use the shared utilities.

## Available Shared Functions

```javascript
// From window.SharedUtils:
- formatStudentName(firstName, lastName)  // Returns "FirstName L." (max 8 chars)
- formatDate(dateString)                  // Alias for formatDateShort
- formatDateShort(dateString)             // Returns "MM/DD/YY"
- formatDateLong(dateString)              // Returns "Jan 15, 2024"
- truncateText(text, maxLength)           // Truncates with "..."
- getInitials(firstName, lastName)        // Returns "JD"
- formatTime(dateString)                  // Returns "2:30 PM"
- getRelativeTime(dateString)             // Returns "2 hours ago"
```

## Migration Steps for Each File

### 1. **SeatingEditor.js** (Line 7-25 & 287-294)
**Remove:**
```javascript
const formatStudentName = (firstName, lastName) => { ... };  // Lines 7-25
const formatDate = (dateString) => { ... };                  // Lines 287-294
```

**Replace with:**
```javascript
// At the top of the component, get utilities from window
const { formatStudentName, formatDate } = window.SharedUtils;
```

### 2. **SeatingViewer.js** (Lines 156-164, 167-174, 419-427)
**Remove:**
```javascript
const formatStudentName = (firstName, lastName) => { ... };  // Lines 156-164
const formatDate = (dateString) => { ... };                  // Lines 167-174
// AND inside SeatingViewerCanvas component:
const formatStudentName = (firstName, lastName) => { ... };  // Lines 419-427
```

**Replace with:**
```javascript
// In main component:
const { formatStudentName, formatDate } = window.SharedUtils;

// In SeatingViewerCanvas component:
const { formatStudentName } = window.SharedUtils;
```

### 3. **dashboard.js** (Lines 21-28)
**Remove:**
```javascript
const formatDate = (dateString) => { ... };  // Lines 21-28
```

**Replace with:**
```javascript
// Use formatDateLong for the dashboard's date format
const formatDate = window.SharedUtils.formatDateLong;
```

### 4. **layouts.js** (Lines 114-122)
**Remove:**
```javascript
const formatDate = (dateString) => { ... };  // Lines 114-122
```

**Replace with:**
```javascript
// Use formatDateLong for the layouts' date format
const formatDate = window.SharedUtils.formatDateLong;
```

## Complete Example - SeatingEditor.js Migration

### Before:
```javascript
// Name truncation function - max 8 characters
const formatStudentName = (firstName, lastName) => {
  if (!firstName) return '';
  const lastInitial = lastName ? lastName[0] : '';
  const baseName = `${firstName} ${lastInitial}.`;
  if (baseName.length <= 8) {
    return baseName;
  }
  const maxFirstNameLength = 5;
  const truncatedFirst = firstName.substring(0, maxFirstNameLength);
  return `${truncatedFirst} ${lastInitial}.`;
};

const SeatingEditor = ({ classId, onBack }) => {
  // ... rest of component
  
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear().toString().slice(-2);
    return `${month}/${day}/${year}`;
  };
  
  // ... rest of component
};
```

### After:
```javascript
const SeatingEditor = ({ classId, onBack }) => {
  // Get utilities from shared module
  const { formatStudentName, formatDate } = window.SharedUtils;
  
  // ... rest of component (no changes needed to usage)
};
```

## Benefits

1. **Code Reduction**: Removes ~80 lines of duplicate code
2. **Consistency**: All components use the same formatting logic
3. **Maintainability**: Single source of truth for utility functions
4. **Extensibility**: Easy to add new utilities that all components can use
5. **Testing**: Can unit test utilities in one place

## Additional Utilities Available

The shared utils module also provides these additional functions you can use:

- `truncateText(text, maxLength)` - Useful for truncating long descriptions
- `getInitials(firstName, lastName)` - For avatar displays
- `formatTime(dateString)` - For showing times in "2:30 PM" format
- `getRelativeTime(dateString)` - For showing "2 hours ago" style times

## Implementation Order

1. ✅ Created `/frontend/shared/utils.js`
2. ✅ Added script tag to `index.html`
3. ⏳ Update SeatingEditor.js
4. ⏳ Update SeatingViewer.js
5. ⏳ Update dashboard.js
6. ⏳ Update layouts.js
7. ⏳ Test all components still work
8. ⏳ Remove old implementations

## Testing

After migration, test:
1. Seating editor still shows student names correctly (truncated to 8 chars)
2. Dates display correctly in all components
3. No console errors about undefined functions
4. All components load and render properly