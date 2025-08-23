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
  const [currentDate, setCurrentDate] = useState(date || new Date().toISOString().split('T')[0]);
  const [gridSize, setGridSize] = useState(60); // Base grid size for scaling
  
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
      
      // TODO: Load attendance data for the date
      
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
      
      // TODO: Implement save logic
      
      setHasUnsavedChanges(false);
      alert("Attendance saved successfully!");
      
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
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
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
              
              // Debug logging
              console.log(`Table ${table.table_number}, Seat ${seat.seat_number}:`, {
                relative_x: seat.relative_x,
                relative_y: seat.relative_y,
                hasStudent: !!student
              });
              
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
              if (student) {
                seatStyle.backgroundColor = "#d4f4dd";
                seatStyle.border = "2px solid #10b981";
              }
              
              return React.createElement(
                "div",
                {
                  key: seat.seat_number,
                  className: "av-seat",
                  style: seatStyle,
                  onClick: () => {
                    // TODO: Handle attendance marking (Phase 3)
                    console.log("Seat clicked:", seat.seat_number, student);
                  },
                  title: student ? 
                    `${student.first_name} ${student.last_name}` : 
                    `Seat ${seat.seat_number}`
                },
                
                // Student name or seat number
                student ? React.createElement(
                  "div",
                  { style: { textAlign: "center", width: "100%" } },
                  React.createElement(
                    "div",
                    { style: { fontWeight: "bold", fontSize: `${gridSize * 0.2}px`, lineHeight: "1.1" } },
                    student.nickname
                  ),
                  React.createElement(
                    "div",
                    { style: { fontSize: `${gridSize * 0.15}px`, lineHeight: "1.1" } },
                    student.last_name.substring(0, 3) + "."
                  )
                ) : React.createElement(
                  "div",
                  { style: { color: "#9ca3af", fontSize: `${gridSize * 0.25}px` } },
                  seat.seat_number
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
    )
  );
};

// Export for use
window.AttendanceVisual = AttendanceVisual;
console.log("AttendanceVisual component loaded and exported to window.AttendanceVisual");