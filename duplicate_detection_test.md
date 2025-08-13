# Duplicate Seating Detection - Testing Guide

## Feature Overview
The seating editor now detects when students are placed in the same seats or with the same tablemates as the previous seating period. This helps teachers vary seating arrangements for better classroom dynamics.

## How It Works
1. When the editor loads, it fetches the most recent completed seating period
2. After any student placement (click-to-fill or drag-and-drop), the system checks:
   - Is this student in the exact same seat as before?
   - Are any of their new tablemates the same as before?
3. If duplicates are found, a warning appears for 5 seconds
4. The warning is informational only - teachers can choose to keep or change the placement

## Test Scenarios

### Prerequisites
- Navigate to: http://127.0.0.1:8000/#seating
- Select "Blue" class (has previous period data)
- Click "Edit" button

### Test 1: Same Seat Detection
1. Look in console for "Previous period loaded" message
2. Note which students were seated where in the previous period
3. Place a student in their exact same seat from before
4. **Expected**: Warning appears: "⚠️ [Student Name] is in the same seat as the previous period"

### Test 2: Same Tablemate Detection
1. Place two students at the same table who were tablemates before
2. **Expected**: Warning appears: "⚠️ [Student Name] is seated with the same tablemate as before: [Other Student]"

### Test 3: Multiple Tablemates
1. Place a student at a table with multiple students they sat with before
2. **Expected**: Warning lists all duplicate tablemates

### Test 4: Combined Warning
1. Place a student in same seat AND with same tablemates
2. **Expected**: Warning shows both issues: "is in the same seat as the previous period and is seated with the same tablemates..."

### Test 5: Swap Detection
1. Swap two students who will end up in duplicate situations
2. **Expected**: Warnings for both students if applicable

### Test 6: No Previous Period
1. Create a new class or use one without previous periods
2. Place students anywhere
3. **Expected**: No warnings appear (no previous data to compare)

### Test 7: Click-to-Fill
1. Use click-to-fill on an empty seat
2. If the randomly selected student creates a duplicate
3. **Expected**: Warning appears after placement

### Test 8: Auto-Fill
1. Use Auto button to fill multiple seats
2. **Expected**: No warnings during batch fill (would be too many)
3. Individual placements after auto-fill should still check

## Console Messages
Open browser console to see:
- "Previous period loaded: [ID]"
- "Previous period assignments: [count]"
- "Previous period lookup structures created"
- "Duplicate detected: Student [ID] in same seat as previous period"
- "Duplicate detected: Student [ID] has same tablemates as previous period"

## Warning Display
- Yellow background with warning icon
- Appears below toolbar
- Auto-dismisses after 5 seconds
- Smooth slide-down animation
- Non-blocking (doesn't prevent further actions)

## Edge Cases Handled
- No previous period exists (new class)
- Previous period has no assignments
- Student wasn't in previous period
- Table/seat numbering changed between periods
- Partial data (some students missing gender info)

## Implementation Details
- Efficient lookup structures using Maps and Sets
- React useMemo for performance
- Checks run AFTER placement (non-blocking)
- Works with all placement methods (drag, click, swap)