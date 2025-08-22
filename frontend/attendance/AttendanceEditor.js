// frontend/attendance/AttendanceEditor.js
// Attendance taking/editing component

const { useState, useEffect } = React;

const AttendanceEditor = ({ classId, date, onBack, navigateTo }) => {
  // Use NavigationService if available
  const nav = window.NavigationService || null;
  
  // Core state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Data state
  const [classInfo, setClassInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState({}); // {studentId: {status, notes}}
  const [initialRecords, setInitialRecords] = useState({}); // Track original state
  const [currentDate, setCurrentDate] = useState(date || new Date().toISOString().split('T')[0]);
  
  // Navigation state
  const [availableDates, setAvailableDates] = useState([]);
  const [canGoPrevious, setCanGoPrevious] = useState(false);
  const [canGoNext, setCanGoNext] = useState(false);
  
  // Load initial data when component mounts or classId changes
  useEffect(() => {
    if (classId) {
      loadClassData();
    }
  }, [classId, currentDate]);
  
  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved attendance changes. Are you sure you want to leave?";
        return "You have unsaved attendance changes. Are you sure you want to leave?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);
  
  // Load class and attendance data
  const loadClassData = async () => {
    try {
      setLoading(true);
      console.log("Loading attendance data for class:", classId, "date:", currentDate);
      
      // Load class info with roster
      const classData = await window.ApiModule.request(`/classes/${classId}/`);
      console.log("Class data loaded:", classData);
      setClassInfo(classData);
      
      // Extract and sort students from roster
      if (classData.roster && Array.isArray(classData.roster)) {
        // Sort students alphabetically by last name, then first name
        const sortedStudents = classData.roster.sort((a, b) => {
          const lastNameCompare = (a.student_last_name || '').localeCompare(b.student_last_name || '');
          if (lastNameCompare !== 0) return lastNameCompare;
          return (a.student_first_name || '').localeCompare(b.student_first_name || '');
        });
        setStudents(sortedStudents);
        console.log("Loaded and sorted", sortedStudents.length, "students");
        console.log("Sample roster entry:", sortedStudents[0]); // Debug log
        
        // Initialize attendance records (all present by default)
        const defaultRecords = {};
        sortedStudents.forEach(roster => {
          defaultRecords[roster.student] = {
            status: 'present',
            notes: ''
          };
        });
        
        // Try to load existing attendance for this date
        try {
          const attendanceData = await window.ApiModule.request(
            `/attendance/by-class/${classId}/${currentDate}/`
          );
          console.log("Existing attendance data:", attendanceData);
          
          // Merge existing records with defaults
          if (attendanceData.attendance_records && Array.isArray(attendanceData.attendance_records)) {
            attendanceData.attendance_records.forEach(record => {
              if (defaultRecords[record.student]) {
                defaultRecords[record.student] = {
                  status: record.status,
                  notes: record.notes || ''
                };
              }
            });
          }
        } catch (error) {
          console.log("No existing attendance for this date (this is normal for first time)");
        }
        
        setAttendanceRecords(defaultRecords);
        setInitialRecords(JSON.parse(JSON.stringify(defaultRecords))); // Deep copy for comparison
      }
      
      // Load available dates for navigation
      try {
        const datesData = await window.ApiModule.request(
          `/attendance/dates/${classId}/`
        );
        console.log("Available dates:", datesData);
        if (datesData.dates && Array.isArray(datesData.dates)) {
          setAvailableDates(datesData.dates);
          updateNavigationState(datesData.dates, currentDate);
        }
      } catch (error) {
        console.error("Failed to load attendance dates:", error);
        setAvailableDates([]);
      }
      
    } catch (error) {
      console.error("Failed to load class data:", error);
      alert("Failed to load class information. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Update navigation button states
  const updateNavigationState = (dates, current) => {
    const currentIndex = dates.indexOf(current);
    const today = new Date().toISOString().split('T')[0];
    
    // Can go previous if there are earlier dates with attendance
    setCanGoPrevious(currentIndex > 0 || (dates.length > 0 && dates[0] < current));
    
    // Can go next if there are later dates with attendance, but not beyond today
    setCanGoNext(
      (currentIndex >= 0 && currentIndex < dates.length - 1) || 
      (dates.length > 0 && dates[dates.length - 1] > current && current < today)
    );
  };
  
  // Handle attendance status change
  const handleStatusChange = (studentId, newStatus) => {
    const newRecords = {
      ...attendanceRecords,
      [studentId]: {
        ...attendanceRecords[studentId],
        status: newStatus
      }
    };
    setAttendanceRecords(newRecords);
    
    // Check if there are unsaved changes
    const hasChanges = JSON.stringify(newRecords) !== JSON.stringify(initialRecords);
    setHasUnsavedChanges(hasChanges);
  };
  
  // Handle notes change
  const handleNotesChange = (studentId, newNotes) => {
    const newRecords = {
      ...attendanceRecords,
      [studentId]: {
        ...attendanceRecords[studentId],
        notes: newNotes
      }
    };
    setAttendanceRecords(newRecords);
    
    // Check if there are unsaved changes
    const hasChanges = JSON.stringify(newRecords) !== JSON.stringify(initialRecords);
    setHasUnsavedChanges(hasChanges);
  };
  
  // Save attendance
  const handleSave = async () => {
    if (!hasUnsavedChanges) {
      console.log("No changes to save");
      return;
    }
    
    try {
      setSaving(true);
      
      // Prepare data for bulk save
      const recordsToSave = [];
      students.forEach(roster => {
        const record = attendanceRecords[roster.student];
        if (record) {
          recordsToSave.push({
            roster_entry: roster.id,
            date: currentDate,
            status: record.status,
            notes: record.notes || ''
          });
        }
      });
      
      console.log("Saving attendance records:", recordsToSave);
      
      const response = await window.ApiModule.request('/attendance/bulk-save/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: currentDate,
          attendance_records: recordsToSave.map(record => ({
            class_roster_id: record.roster_entry,
            status: record.status,
            notes: record.notes || ''
          }))
        })
      });
      
      console.log("Save response:", response);
      
      // Update initial records to match saved state
      setInitialRecords(JSON.parse(JSON.stringify(attendanceRecords)));
      setHasUnsavedChanges(false);
      
      // Show success message
      alert("Attendance saved successfully!");
      
    } catch (error) {
      console.error("Failed to save attendance:", error);
      alert("Failed to save attendance. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  
  // Navigate to previous date
  const handlePrevious = () => {
    if (!canGoPrevious) return;
    
    if (hasUnsavedChanges) {
      if (!confirm("You have unsaved changes. Do you want to continue without saving?")) {
        return;
      }
    }
    
    // Find previous date
    const currentIndex = availableDates.indexOf(currentDate);
    if (currentIndex > 0) {
      setCurrentDate(availableDates[currentIndex - 1]);
    }
  };
  
  // Navigate to next date
  const handleNext = () => {
    if (!canGoNext) return;
    
    if (hasUnsavedChanges) {
      if (!confirm("You have unsaved changes. Do you want to continue without saving?")) {
        return;
      }
    }
    
    // Find next date
    const currentIndex = availableDates.indexOf(currentDate);
    if (currentIndex >= 0 && currentIndex < availableDates.length - 1) {
      setCurrentDate(availableDates[currentIndex + 1]);
    }
  };
  
  // Handle back navigation
  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (!confirm("You have unsaved changes. Do you want to leave without saving?")) {
        return;
      }
    }
    
    if (onBack) {
      onBack();
    } else if (navigateTo) {
      navigateTo('attendance');
    } else {
      window.location.hash = '#attendance';
    }
  };
  
  // Format date for display
  const formatDateDisplay = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };
  
  // Format student name for display
  const formatStudentDisplay = (roster) => {
    const nickname = roster.student_nickname || roster.student_first_name;
    return `${nickname} ${roster.student_last_name}`;
  };
  
  // Get status color class
  const getStatusClass = (status) => {
    switch (status) {
      case 'present': return 'status-present';
      case 'absent': return 'status-absent';
      case 'tardy': return 'status-tardy';
      case 'early_dismissal': return 'status-early-dismissal';
      default: return '';
    }
  };
  
  // Render loading state
  if (loading) {
    return React.createElement(
      "div",
      { className: "attendance-editor-container" },
      React.createElement(
        "div",
        { className: "loading-spinner" },
        React.createElement("i", { className: "fas fa-spinner fa-spin fa-3x" }),
        React.createElement("p", null, "Loading attendance...")
      )
    );
  }
  
  // Render main component
  return React.createElement(
    "div",
    { className: "attendance-editor-container" },
    
    // Header with class info and navigation
    React.createElement(
      "div",
      { className: "attendance-editor-header" },
      
      // Back button and title
      React.createElement(
        "div",
        { className: "attendance-header-left" },
        React.createElement(
          "button",
          { 
            className: "btn btn-secondary btn-back",
            onClick: handleBack
          },
          React.createElement("i", { className: "fas fa-arrow-left" }),
          " Back"
        ),
        React.createElement(
          "div",
          { className: "attendance-title" },
          React.createElement("h1", null, classInfo?.name || "Class"),
          React.createElement("span", { className: "attendance-subtitle" }, "Attendance")
        )
      ),
      
      // Date display and navigation
      React.createElement(
        "div",
        { className: "attendance-header-center" },
        React.createElement(
          "div",
          { className: "date-navigation" },
          React.createElement(
            "button",
            { 
              className: "btn btn-secondary btn-nav",
              onClick: handlePrevious,
              disabled: !canGoPrevious
            },
            React.createElement("i", { className: "fas fa-chevron-left" }),
            " Previous"
          ),
          React.createElement(
            "div",
            { className: "current-date" },
            formatDateDisplay(currentDate)
          ),
          React.createElement(
            "button",
            { 
              className: "btn btn-secondary btn-nav",
              onClick: handleNext,
              disabled: !canGoNext
            },
            "Next ",
            React.createElement("i", { className: "fas fa-chevron-right" })
          )
        )
      ),
      
      // Save button
      React.createElement(
        "div",
        { className: "attendance-header-right" },
        React.createElement(
          "button",
          { 
            className: `btn btn-primary btn-save ${hasUnsavedChanges ? 'has-changes' : ''}`,
            onClick: handleSave,
            disabled: saving || !hasUnsavedChanges
          },
          saving ? 
            React.createElement("i", { className: "fas fa-spinner fa-spin" }) :
            React.createElement("i", { className: "fas fa-save" }),
          saving ? " Saving..." : " Save"
        )
      )
    ),
    
    // Student list with attendance controls
    React.createElement(
      "div",
      { className: "attendance-editor-body" },
      
      // Column headers
      React.createElement(
        "div",
        { className: "attendance-table-header" },
        React.createElement("div", { className: "col-student" }, "Student"),
        React.createElement("div", { className: "col-status" }, "Status"),
        React.createElement("div", { className: "col-notes" }, "Notes")
      ),
      
      // Student rows
      React.createElement(
        "div",
        { className: "attendance-table-body" },
        students.map((roster, index) => {
          const record = attendanceRecords[roster.student] || { status: 'present', notes: '' };
          
          return React.createElement(
            "div",
            { 
              key: roster.id,
              className: `attendance-row ${index % 2 === 0 ? 'even' : 'odd'}`
            },
            
            // Student name
            React.createElement(
              "div",
              { className: "col-student" },
              React.createElement(
                "span",
                { className: "student-name" },
                formatStudentDisplay(roster)
              ),
              React.createElement(
                "span",
                { className: "student-id" },
                ` (${roster.student_id})`
              )
            ),
            
            // Status dropdown
            React.createElement(
              "div",
              { className: "col-status" },
              React.createElement(
                "select",
                {
                  className: `status-select ${getStatusClass(record.status)}`,
                  value: record.status,
                  onChange: (e) => handleStatusChange(roster.student, e.target.value)
                },
                React.createElement("option", { key: "present", value: "present" }, "Present"),
                React.createElement("option", { key: "absent", value: "absent" }, "Absent"),
                React.createElement("option", { key: "tardy", value: "tardy" }, "Tardy"),
                React.createElement("option", { key: "early_dismissal", value: "early_dismissal" }, "Early Dismissal")
              )
            ),
            
            // Notes field
            React.createElement(
              "div",
              { className: "col-notes" },
              React.createElement("input", {
                type: "text",
                className: "notes-input",
                placeholder: "Add notes...",
                value: record.notes,
                onChange: (e) => handleNotesChange(roster.student, e.target.value)
              })
            )
          );
        })
      )
    ),
    
    // Empty state if no students
    students.length === 0 && React.createElement(
      "div",
      { className: "empty-state" },
      React.createElement("i", { className: "fas fa-user-slash fa-3x" }),
      React.createElement("h3", null, "No Students Enrolled"),
      React.createElement("p", null, "This class has no students enrolled yet.")
    )
  );
};

// Export for use in other modules
window.AttendanceEditor = AttendanceEditor;
console.log("AttendanceEditor component loaded and exported to window.AttendanceEditor");