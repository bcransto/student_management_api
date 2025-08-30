// frontend/attendance/AttendanceVisual.js
// Visual attendance editor using seating chart layout

const { useState, useEffect, useRef } = React;

const AttendanceVisual = ({ classId, date, onBack, navigateTo }) => {
  // Core state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Data state
  const [classInfo, setClassInfo] = useState(null);
  const [layout, setLayout] = useState(null);
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState({});
  // Use local date instead of UTC to avoid timezone issues
  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const [currentDate, setCurrentDate] = useState(date || getLocalDateString());
  const [gridSize, setGridSize] = useState(60); // Base grid size for scaling
  
  // Attendance state - track status for each student
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [statusAnnouncements, setStatusAnnouncements] = useState([]);
  
  // State for static historical data (never changes based on today's attendance)
  const [consecutiveAbsences, setConsecutiveAbsences] = useState({}); // rosterId -> count (historical only)
  const [birthdayStudents, setBirthdayStudents] = useState(new Set()); // Set of student IDs with birthdays today
  
  // Container ref for auto-scaling
  const containerRef = useRef(null);
  
  // Load initial data
  useEffect(() => {
    if (classId) {
      loadClassData();
    }
  }, [classId, currentDate]);
  
  // Auto-scale to fit container
  useEffect(() => {
    const calculateGridSize = () => {
      if (!containerRef.current || !layout) return;
      
      const container = containerRef.current;
      const containerWidth = container.clientWidth - 20; // Padding
      const containerHeight = container.clientHeight - 20;
      
      // Calculate scale to fit
      const scaleX = containerWidth / (layout.room_width * 60);
      const scaleY = containerHeight / (layout.room_height * 60);
      const scale = Math.min(scaleX, scaleY, 1.5); // Cap at 1.5x to avoid too large
      
      setGridSize(Math.floor(60 * scale));
    };
    
    calculateGridSize();
    window.addEventListener('resize', calculateGridSize);
    return () => window.removeEventListener('resize', calculateGridSize);
  }, [layout]);
  
  // Load class data
  const loadClassData = async () => {
    try {
      setLoading(true);
      console.log("Loading visual attendance for class:", classId, "date:", currentDate);
      
      // Load class info with roster
      const classData = await window.ApiModule.request(`/classes/${classId}/`);
      console.log("Class data loaded:", classData);
      setClassInfo(classData);
      
      // Extract students from roster
      if (classData.roster && Array.isArray(classData.roster)) {
        const studentList = classData.roster.map(roster => ({
          id: roster.student,
          rosterId: roster.id,
          first_name: roster.student_first_name,
          last_name: roster.student_last_name,
          nickname: roster.student_nickname || roster.student_first_name,
          student_id: roster.student_id
        }));
        setStudents(studentList);
        console.log("Loaded", studentList.length, "students");
      }
      
      // Load seating period and layout
      let layoutData = null;
      let currentPeriod = null;
      
      try {
        // Get all periods for this class
        const periodsResponse = await window.ApiModule.request(
          `/seating-periods/?class_assigned=${classId}`
        );
        const periods = periodsResponse.results || [];
        
        // Find current period (end_date === null) or most recent
        currentPeriod = periods.find(p => p.end_date === null);
        if (!currentPeriod && periods.length > 0) {
          // No current period, use most recent
          periods.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
          currentPeriod = periods[0];
        }
        
        // Get full period details if we have one
        if (currentPeriod) {
          const fullPeriod = await window.ApiModule.request(`/seating-periods/${currentPeriod.id}/`);
          currentPeriod = fullPeriod;
          
          // Get layout from period
          if (fullPeriod.layout_details) {
            layoutData = fullPeriod.layout_details;
            console.log("Layout loaded from period:", layoutData);
            console.log("Tables in layout:", layoutData.tables?.length || 0);
            if (layoutData.tables) {
              layoutData.tables.forEach(table => {
                console.log(`Table ${table.table_number} (ID: ${table.id}): ${table.seats?.length || 0} seats`);
              });
            }
            setLayout(layoutData);
          }
        }
        
        // If still no layout, try to auto-select user's most recent layout
        if (!layoutData) {
          console.log("No period layout, fetching user's layouts...");
          const layoutsResponse = await window.ApiModule.request("/layouts/");
          const userLayouts = layoutsResponse.results || layoutsResponse;
          
          if (userLayouts.length > 0) {
            // Get full layout details
            const layoutId = userLayouts[0].id;
            layoutData = await window.ApiModule.request(`/layouts/${layoutId}/`);
            console.log("Auto-selected most recent layout:", layoutData);
            console.log("Tables in auto-selected layout:", layoutData.tables?.length || 0);
            if (layoutData.tables) {
              layoutData.tables.forEach(table => {
                console.log(`Table ${table.table_number} (ID: ${table.id}): ${table.seats?.length || 0} seats`);
                if (table.seats) {
                  console.log(`  Seats for table ${table.table_number}:`, table.seats);
                }
              });
            }
            setLayout(layoutData);
          } else {
            console.log("No layouts available for this user");
          }
        }
        
        // Load seating assignments if we have both period and layout
        if (currentPeriod && currentPeriod.seating_assignments && layoutData) {
            // Convert assignments to our format {tableId: {seatNumber: studentId}}
            const assignmentMap = {};
            currentPeriod.seating_assignments.forEach(assignment => {
              const table = layoutData.tables?.find(
                t => t.table_number === assignment.table_number
              );
              if (table) {
                const tableId = String(table.id);
                const seatNumber = String(assignment.seat_number);
                const rosterEntry = classData.roster.find(r => r.id === assignment.roster_entry);
                
                if (rosterEntry) {
                  if (!assignmentMap[tableId]) {
                    assignmentMap[tableId] = {};
                  }
                  assignmentMap[tableId][seatNumber] = rosterEntry.student;
                }
              }
            });
            setAssignments(assignmentMap);
            console.log("Loaded seating assignments:", assignmentMap);
        } else {
          console.log("No seating assignments to load");
        }
      } catch (error) {
        console.log("Error loading seating data:", error);
      }
      
      // Load attendance data for the date
      try {
        console.log("Loading attendance for date:", currentDate);
        const attendanceResponse = await window.ApiModule.request(
          `/attendance/by-class/${classId}/${currentDate}/`
        );
        console.log("Attendance data loaded:", attendanceResponse);
        
        // Convert to our format keyed by roster ID
        const records = {};
        // The API returns an array directly, not wrapped in an object
        if (Array.isArray(attendanceResponse)) {
          attendanceResponse.forEach(record => {
            // The record contains class_roster ID and student info
            const rosterId = record.class_roster;
            if (rosterId) {
              records[rosterId] = {
                status: record.status || 'present',
                notes: record.notes || ''
              };
            }
          });
        }
        
        // Initialize all students as present if no existing record
        classData.roster.forEach(roster => {
          if (!records[roster.id]) {
            records[roster.id] = {
              status: 'present',
              notes: ''
            };
          }
        });
        
        setAttendanceRecords(records);
        console.log("Initialized attendance records:", records);
        
        // Now fetch recent history for static historical absences and birthdays
        try {
          console.log("Fetching recent attendance history...");
          const recentResponse = await window.ApiModule.request(
            `/attendance/recent/${classId}/${currentDate}/`
          );
          console.log("Recent history response:", recentResponse);
          
          // Set birthday students
          if (recentResponse.birthday_students && Array.isArray(recentResponse.birthday_students)) {
            setBirthdayStudents(new Set(recentResponse.birthday_students));
            console.log("Birthday students for today:", recentResponse.birthday_students);
          }
          
          // Calculate STATIC historical consecutive absences (excluding today)
          const historicalAbsences = {};
          
          // For each student in the roster
          classData.roster.forEach(roster => {
            const studentId = roster.student;
            const rosterId = roster.id;
            let consecutiveCount = 0;
            
            // Look through historical records ONLY (not today)
            // The attendance_history from API is already sorted most recent first
            for (const dateEntry of recentResponse.attendance_history || []) {
              // Find this student's record for this historical date
              const histRecord = dateEntry.records.find(r => r.student_id === studentId);
              
              if (histRecord && histRecord.status === 'absent') {
                consecutiveCount++;
              } else {
                // Break on first non-absence or missing record
                break;
              }
              
              // Cap at 11 for display purposes (will show as >10)
              if (consecutiveCount >= 11) {
                break;
              }
            }
            
            // Only store if there are historical consecutive absences
            if (consecutiveCount > 0) {
              historicalAbsences[rosterId] = consecutiveCount;
              console.log(`Student ${studentId} (roster ${rosterId}): ${consecutiveCount} historical consecutive absences`);
            }
          });
          
          setConsecutiveAbsences(historicalAbsences);
          console.log("Static historical consecutive absences:", historicalAbsences);
          
        } catch (error) {
          console.log("Could not load recent history:", error);
          // Continue without history data - not critical for basic functionality
          // Leave consecutiveAbsences and birthdayStudents as empty
        }
        
      } catch (error) {
        console.log("No existing attendance data, initializing all as present");
        // Initialize all students as present
        const records = {};
        classData.roster.forEach(roster => {
          records[roster.id] = {
            status: 'present',
            notes: ''
          };
        });
        setAttendanceRecords(records);
        
        // Still try to fetch historical data even if no current attendance
        try {
          const recentResponse = await window.ApiModule.request(
            `/attendance/recent/${classId}/${currentDate}/`
          );
          
          // Set birthdays
          if (recentResponse.birthday_students) {
            setBirthdayStudents(new Set(recentResponse.birthday_students));
          }
          
          // Calculate historical absences (same logic as above)
          const historicalAbsences = {};
          classData.roster.forEach(roster => {
            const studentId = roster.student;
            const rosterId = roster.id;
            let consecutiveCount = 0;
            
            for (const dateEntry of recentResponse.attendance_history || []) {
              const histRecord = dateEntry.records.find(r => r.student_id === studentId);
              if (histRecord && histRecord.status === 'absent') {
                consecutiveCount++;
              } else {
                break;
              }
              if (consecutiveCount >= 11) break;
            }
            
            if (consecutiveCount > 0) {
              historicalAbsences[rosterId] = consecutiveCount;
            }
          });
          
          setConsecutiveAbsences(historicalAbsences);
        } catch (err) {
          console.log("Could not load recent history:", err);
        }
      }
      
    } catch (error) {
      console.error("Failed to load class data:", error);
      alert("Failed to load class information. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Handle save
  const handleSave = async () => {
    if (!hasUnsavedChanges) {
      console.log("No changes to save");
      return;
    }
    
    try {
      setSaving(true);
      console.log("Saving visual attendance...");
      
      // Build attendance records for API
      const recordsToSave = [];
      Object.keys(attendanceRecords).forEach(rosterId => {
        const record = attendanceRecords[rosterId];
        recordsToSave.push({
          class_roster_id: parseInt(rosterId),
          status: record.status,
          notes: record.notes || ''
        });
      });
      
      // Save via bulk API
      const response = await window.ApiModule.request('/attendance/bulk-save/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: currentDate,
          attendance_records: recordsToSave
        })
      });
      
      console.log("Attendance saved:", response);
      setHasUnsavedChanges(false);
      
      // Show success briefly (no alert)
      const saveBtn = document.querySelector('.av-btn-save');
      if (saveBtn) {
        saveBtn.textContent = '✓ Saved';
        setTimeout(() => {
          saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
        }, 2000);
      }
      
    } catch (error) {
      console.error("Failed to save attendance:", error);
      alert("Failed to save attendance. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  
  // Handle back navigation
  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (!confirm("You have unsaved changes. Do you want to leave without saving?")) {
        return;
      }
    }
    
    // Navigate back to attendance list
    // First try the callback if provided
    if (onBack && typeof onBack === 'function') {
      console.log("Using onBack callback");
      onBack();
    } else {
      console.log("Using direct hash navigation");
      // Set the hash which should trigger hashchange event
      window.location.hash = 'attendance';
      // Also dispatch a custom event to ensure the app updates
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  };
  
  // Format date for display
  const formatDateDisplay = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // Status cycle order
  const statusCycle = ['present', 'absent', 'tardy', 'early_dismissal'];
  
  // Handle seat click - cycle through statuses
  const handleSeatClick = (e, student, rosterId) => {
    if (!student || !rosterId) return;
    
    e.stopPropagation();
    
    // Get current status
    const currentStatus = attendanceRecords[rosterId]?.status || 'present';
    
    // Find next status in cycle
    const currentIndex = statusCycle.indexOf(currentStatus);
    const nextIndex = (currentIndex + 1) % statusCycle.length;
    const nextStatus = statusCycle[nextIndex];
    
    // Update attendance record
    setAttendanceRecords(prev => ({
      ...prev,
      [rosterId]: {
        ...prev[rosterId],
        status: nextStatus
      }
    }));
    
    setHasUnsavedChanges(true);
    
    // Add brief visual feedback
    const seatElement = e.currentTarget;
    seatElement.style.transform = 'scale(1.15)';
    setTimeout(() => {
      seatElement.style.transform = '';
    }, 200);
    
    // Create floating status announcement
    const rect = seatElement.getBoundingClientRect();
    const announcementId = `${rosterId}-${Date.now()}`;
    const statusLabels = {
      'present': 'Present',
      'absent': 'Absent',
      'tardy': 'Tardy',
      'early_dismissal': 'Early Dismissal'
    };
    
    setStatusAnnouncements(prev => [...prev, {
      id: announcementId,
      text: statusLabels[nextStatus],
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      color: getStatusColor(nextStatus).border
    }]);
    
    // Remove announcement after animation
    setTimeout(() => {
      setStatusAnnouncements(prev => prev.filter(a => a.id !== announcementId));
    }, 1500);
    
    console.log(`Updated ${student.first_name} from ${currentStatus} to ${nextStatus}`);
  };
  
  // Get status color
  const getStatusColor = (status) => {
    switch(status) {
      case 'present':
        return { bg: '#d4f4dd', border: '#10b981' }; // Green
      case 'absent':
        return { bg: '#fee2e2', border: '#ef4444' }; // Red
      case 'tardy':
        return { bg: '#fef3c7', border: '#f59e0b' }; // Yellow
      case 'early_dismissal':
        return { bg: '#fed7aa', border: '#fb923c' }; // Orange
      default:
        return { bg: '#f3f4f6', border: '#d1d5db' }; // Gray
    }
  };
  
  
  // Render loading state
  if (loading) {
    return React.createElement(
      "div",
      { className: "attendance-visual-container" },
      React.createElement(
        "div",
        { className: "attendance-visual-loading" },
        React.createElement("i", { className: "fas fa-spinner fa-spin fa-3x" }),
        React.createElement("p", null, "Loading visual attendance...")
      )
    );
  }
  
  // Render main component
  return React.createElement(
    "div",
    { className: "attendance-visual-container" },
    
    // Minimal header
    React.createElement(
      "div",
      { className: "attendance-visual-header" },
      
      // Back button
      React.createElement(
        "button",
        { 
          className: "av-btn-back",
          onClick: handleBack,
          title: "Back to class list"
        },
        React.createElement("i", { className: "fas fa-arrow-left" })
      ),
      
      // Class and date info
      React.createElement(
        "div",
        { className: "av-header-info" },
        React.createElement(
          "span",
          { className: "av-class-name" },
          classInfo?.name || "Class"
        ),
        React.createElement(
          "span",
          { className: "av-date" },
          formatDateDisplay(currentDate)
        )
      ),
      
      // Save button
      React.createElement(
        "button",
        { 
          className: `av-btn-save ${hasUnsavedChanges ? 'has-changes' : ''}`,
          onClick: handleSave,
          disabled: saving || !hasUnsavedChanges,
          title: hasUnsavedChanges ? "Save changes" : "No changes to save"
        },
        saving ? 
          React.createElement("i", { className: "fas fa-spinner fa-spin" }) :
          React.createElement("i", { className: "fas fa-save" }),
        saving ? " Saving" : " Save"
      )
    ),
    
    // Legend for attendance statuses
    React.createElement(
      "div",
      { 
        className: "av-legend",
        style: {
          position: "absolute",
          bottom: "10px",
          left: "10px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          padding: "8px 12px",
          borderRadius: "6px",
          border: "1px solid #e5e7eb",
          fontSize: "11px",
          zIndex: 10
        }
      },
      // Status items
      [
        { status: 'present', label: 'Present' },
        { status: 'absent', label: 'Absent' },
        { status: 'tardy', label: 'Tardy' },
        { status: 'early_dismissal', label: 'Early' }
      ].map(item => {
        const colors = getStatusColor(item.status);
        return React.createElement(
          "div",
          { 
            key: item.status,
            style: { 
              display: "flex", 
              alignItems: "center", 
              gap: "4px"
            }
          },
          React.createElement("div", {
            style: {
              width: "12px",
              height: "12px",
              backgroundColor: colors.bg,
              border: `2px solid ${colors.border}`,
              borderRadius: "50%"
            }
          }),
          React.createElement("span", null, item.label)
        );
      })
    ),
    
    // Seating grid area
    React.createElement(
      "div",
      { 
        className: "attendance-visual-canvas-container",
        ref: containerRef
      },
      
      // Show layout if available
      layout ? React.createElement(
        "div",
        {
          className: "attendance-visual-grid",
          style: {
            position: "relative",
            width: `${layout.room_width * gridSize}px`,
            height: `${layout.room_height * gridSize}px`,
            background: "white",
            border: "1px solid #d0d0d0",
            borderRadius: "4px",
            margin: "auto"
          }
        },
        
        // Render tables
        layout.tables?.map(table => 
          React.createElement(
            "div",
            {
              key: table.id,
              className: "av-table",
              style: {
                position: "absolute",
                left: `${table.x_position * gridSize}px`,
                top: `${table.y_position * gridSize}px`,
                width: `${table.width * gridSize}px`,
                height: `${table.height * gridSize}px`,
                backgroundColor: "#e8f4f8",
                border: "2px solid #9ca3af",
                borderRadius: table.table_shape === "round" ? "50%" : "6px"
              }
            },
            
            // Table number - positioned at center
            React.createElement(
              "div",
              {
                style: {
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  fontSize: `${gridSize * 0.35}px`,
                  fontWeight: "bold",
                  color: "#6b7280",
                  opacity: 0.3,
                  pointerEvents: "none",
                  zIndex: 0
                }
              },
              table.table_number
            ),
            
            // Render seats
            table.seats?.map(seat => {
              const seatKey = String(seat.seat_number);
              const tableKey = String(table.id);
              const studentId = assignments[tableKey]?.[seatKey];
              const student = studentId ? students.find(s => s.id === studentId) : null;
              const rosterId = student ? students.find(s => s.id === studentId)?.rosterId : null;
              
              // Get attendance status for this student
              const attendanceStatus = rosterId && attendanceRecords[rosterId] 
                ? attendanceRecords[rosterId].status 
                : 'present';
              
              // Use LayoutStyles helper for consistent styling
              const seatStyle = window.LayoutStyles?.getSeatStyle ? 
                window.LayoutStyles.getSeatStyle(seat, {
                  isOccupied: !!student,
                  isSelected: false,
                  isAccessible: false,
                  gridSize: gridSize,
                  showName: !!student
                }) : {
                  // Fallback if LayoutStyles not available
                  position: "absolute",
                  left: seat.relative_x !== undefined 
                    ? `calc(${seat.relative_x * 100}% - ${gridSize * 0.4}px)`
                    : `${seat.x_position * gridSize}px`,
                  top: seat.relative_y !== undefined
                    ? `calc(${seat.relative_y * 100}% - ${gridSize * 0.4}px)`
                    : `${seat.y_position * gridSize}px`,
                  width: `${gridSize * 0.8}px`,
                  height: `${gridSize * 0.8}px`,
                  backgroundColor: student ? "#d4f4dd" : "#f3f4f6",
                  border: student ? "2px solid #10b981" : "2px solid #d1d5db",
                  borderRadius: "50%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: `${gridSize * 0.18}px`,
                  lineHeight: "1.2",
                  padding: "2px",
                  overflow: "hidden",
                  transition: "all 0.2s",
                  zIndex: 1
                };
              
              // Override colors for attendance status
              if (student && rosterId) {
                const statusColors = getStatusColor(attendanceStatus);
                seatStyle.backgroundColor = statusColors.bg;
                seatStyle.border = `2px solid ${statusColors.border}`;
                seatStyle.cursor = 'pointer';
              }
              
              // PHASE 3A: Ensure seat container is properly positioned
              // The seat uses absolute positioning relative to the table for placement
              // We add position: relative to enable absolute positioning of badges within
              const finalSeatStyle = {
                ...seatStyle,
                position: seatStyle.position || "absolute", // Keep absolute for seat placement
                overflow: "visible", // Allow badges to extend outside seat boundary
                zIndex: 1 // Base z-index for seat
              };
              
              return React.createElement(
                "div",
                {
                  key: seat.seat_number,
                  className: "av-seat",
                  style: finalSeatStyle,
                  onClick: (e) => handleSeatClick(e, student, rosterId),
                  title: student ? 
                    `${student.first_name} ${student.last_name} - ${attendanceStatus}` : 
                    `Seat ${seat.seat_number}`
                },
                
                // Inner container with relative positioning for badge placement
                React.createElement(
                  "div",
                  { 
                    style: { 
                      position: "relative", 
                      width: "100%", 
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "visible"  // Allow badges to extend outside
                    } 
                  },
                  
                  // PHASE 3B: Consecutive absence counter badge (top-left)
                  // Only show if there are historical consecutive absences
                  rosterId && consecutiveAbsences[rosterId] && consecutiveAbsences[rosterId] > 0 ? 
                    React.createElement(
                      "div",
                      {
                        style: {
                          position: "absolute",
                          top: "-6px",  // Further outside for better separation
                          left: "-6px", // Further outside for better separation
                          width: `${gridSize * 0.25}px`,
                          height: `${gridSize * 0.25}px`,
                          backgroundColor: "#dc2626",
                          color: "white",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: `${gridSize * 0.15}px`,
                          fontWeight: "bold",
                          zIndex: 10,  // Increased from 2 to ensure it's on top
                          border: "1px solid white",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.2)"
                        },
                        title: `${consecutiveAbsences[rosterId]} consecutive absence${consecutiveAbsences[rosterId] > 1 ? 's' : ''} before today`
                      },
                      // Display count or >10 for 11+
                      consecutiveAbsences[rosterId] >= 11 ? ">10" : String(consecutiveAbsences[rosterId])
                    ) : null,
                  
                  // PHASE 3C: Birthday indicator badge (top-right)
                  // Only show if student has birthday today
                  student && birthdayStudents.has(student.id) ?
                    React.createElement(
                      "div",
                      {
                        style: {
                          position: "absolute",
                          top: "-6px",   // Further outside for better separation
                          right: "-6px", // Further outside for better separation
                          width: `${gridSize * 0.22}px`,
                          height: `${gridSize * 0.22}px`,
                          backgroundColor: "#fbbf24",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: `${gridSize * 0.16}px`,
                          zIndex: 10,  // Increased from 2 to ensure it's on top
                          border: "1px solid white",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.2)"
                        },
                        title: "Birthday today!"
                      },
                      "🎂"
                    ) : null,
                  
                  // Student name or seat number
                  student ? React.createElement(
                    "div",
                    { 
                      style: { 
                        textAlign: "center", 
                        width: "100%",
                        overflow: "hidden",  // Prevent text overflow
                        padding: "2px"       // Small padding to keep text from edge
                      } 
                    },
                    React.createElement(
                      "div",
                      { 
                        style: { 
                          fontWeight: "bold", 
                          fontSize: `${gridSize * 0.2}px`, 
                          lineHeight: "1.1",
                          overflow: "hidden",
                          whiteSpace: "nowrap",  // Keep on single line, clip if too long
                          color: "#374151"  // Dark gray for softer appearance
                        } 
                      },
                      student.nickname
                    ),
                    React.createElement(
                      "div",
                      { 
                        style: { 
                          fontSize: `${gridSize * 0.15}px`, 
                          lineHeight: "1.1",
                          overflow: "hidden",
                          color: "#374151"  // Dark gray for softer appearance
                        } 
                      },
                      student.last_name.substring(0, 3) + "."
                    )
                  ) : React.createElement(
                    "div",
                    { style: { color: "#9ca3af", fontSize: `${gridSize * 0.25}px` } },
                    seat.seat_number
                  )
                )
              );
            })
          )
        )
      ) : React.createElement(
        "div",
        { className: "av-no-layout" },
        React.createElement("i", { className: "fas fa-th fa-3x" }),
        React.createElement("h3", null, "No Seating Layout"),
        React.createElement("p", null, "This class needs a seating layout for visual attendance.")
      )
    ),
    
    // Floating status announcements
    statusAnnouncements.map(announcement =>
      React.createElement(
        "div",
        {
          key: announcement.id,
          className: "av-status-announcement",
          style: {
            position: "fixed",
            left: `${announcement.x}px`,
            top: `${announcement.y}px`,
            transform: "translateX(-50%)",
            backgroundColor: "white",
            color: announcement.color,
            border: `2px solid ${announcement.color}`,
            borderRadius: "16px",
            padding: "4px 12px",
            fontSize: "14px",
            fontWeight: "600",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            zIndex: 1000,
            pointerEvents: "none",
            animation: "floatUp 1.5s ease-out forwards"
          }
        },
        announcement.text
      )
    )
  );
};

// Export for use
window.AttendanceVisual = AttendanceVisual;
console.log("AttendanceVisual component loaded and exported to window.AttendanceVisual");