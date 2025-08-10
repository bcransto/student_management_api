// SeatingViewer.js - Read-only seating chart viewer using standard app layout
const SeatingViewer = ({ classId, onEdit, onBack }) => {
  const [loading, setLoading] = React.useState(true);
  const [classInfo, setClassInfo] = React.useState(null);
  const [layout, setLayout] = React.useState(null);
  const [students, setStudents] = React.useState([]);
  const [assignments, setAssignments] = React.useState({});
  const [isCreatingPeriod, setIsCreatingPeriod] = React.useState(false);

  // Load class data
  const loadClassData = async () => {
    try {
      setLoading(true);
      console.log("Loading data for class:", classId);

      // Load class info
      const classData = await window.ApiModule.request(`/classes/${classId}/`);
      console.log("Class data loaded:", classData);
      setClassInfo(classData);

      // Load the layout from the current seating period (if exists) or class
      let currentLayout = null;
      if (classData.current_seating_period && classData.current_seating_period.layout_details) {
        console.log("Layout found in seating period:", classData.current_seating_period.layout_details);
        currentLayout = classData.current_seating_period.layout_details;
        setLayout(currentLayout);
      } else if (classData.classroom_layout) {
        console.log("No period layout, using class layout:", classData.classroom_layout);
        currentLayout = classData.classroom_layout;
        setLayout(currentLayout);
      }

      // Load students from the roster
      if (classData.roster && Array.isArray(classData.roster)) {
        console.log("Loading students from roster:", classData.roster.length);
        const studentPromises = classData.roster.map((rosterItem) =>
          window.ApiModule.request(`/students/${rosterItem.student}/`)
        );
        const fullStudentData = await Promise.all(studentPromises);
        console.log("Student data loaded:", fullStudentData.length);
        setStudents(fullStudentData);
      }

      // Load existing seating assignments if any
      if (
        classData.current_seating_period?.seating_assignments &&
        classData.current_seating_period.seating_assignments.length > 0 &&
        currentLayout
      ) {
        console.log("Loading seating assignments");
        const assignmentMap = {};

        classData.current_seating_period.seating_assignments.forEach((assignment) => {
          if (!currentLayout.tables) {
            console.warn("No tables in layout");
            return;
          }
          
          const table = currentLayout.tables.find(
            (t) => t.table_number === assignment.table_number
          );
          if (!table) {
            console.warn(`Table ${assignment.table_number} not found in layout`);
            return;
          }

          const tableId = table.id;
          const seatNumber = String(assignment.seat_number);

          // Find the student ID from the roster
          const rosterEntry = classData.roster.find((r) => r.id === assignment.roster_entry);
          const studentId = rosterEntry ? rosterEntry.student : null;

          if (!studentId) {
            console.warn(`Student not found for roster entry ${assignment.roster_entry}`);
            return;
          }

          if (!assignmentMap[tableId]) {
            assignmentMap[tableId] = {};
          }
          assignmentMap[tableId][seatNumber] = studentId;
        });

        console.log("Assignment map:", assignmentMap);
        setAssignments(assignmentMap);
      }
    } catch (error) {
      console.error("Failed to load class data:", error);
      alert("Failed to load class data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Navigate to previous/next seating period
  const handlePeriodNavigation = async (direction) => {
    try {
      // Get all periods for this class
      const response = await window.ApiModule.request(
        `/seating-periods/?class_assigned=${classId}`
      );
      
      const periods = response.results || [];
      console.log(`Found ${periods.length} periods for class ${classId}`);
      
      if (periods.length === 0) {
        alert("No seating periods found for this class");
        return;
      }
      
      if (periods.length === 1) {
        alert("This class only has one seating period");
        return;
      }

      // Sort by start date
      periods.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

      // Find current period index
      const currentPeriodId = classInfo.current_seating_period?.id;
      const currentIndex = periods.findIndex(p => p.id === currentPeriodId);
      
      let targetIndex;
      if (direction === 'previous') {
        targetIndex = currentIndex > 0 ? currentIndex - 1 : periods.length - 1;
      } else {
        targetIndex = currentIndex < periods.length - 1 ? currentIndex + 1 : 0;
      }

      const targetPeriod = periods[targetIndex];
      
      console.log(`Navigating from period ${currentPeriodId} to ${targetPeriod.id}`);
      
      // Set the target period as active
      await window.ApiModule.request(`/seating-periods/${targetPeriod.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          is_active: true
        }),
      });

      // Small delay to ensure backend has updated
      await new Promise(resolve => setTimeout(resolve, 100));

      // Reload the data with the new period
      await loadClassData();
      
    } catch (error) {
      console.error("Failed to navigate periods:", error);
      alert("Failed to navigate to " + direction + " period");
    }
  };

  // Format student name with truncation
  const formatStudentName = (firstName, lastName) => {
    if (!firstName) return '';
    const lastInitial = lastName ? lastName[0] : '';
    const baseName = `${firstName} ${lastInitial}.`;
    if (baseName.length <= 8) return baseName;
    const maxFirstNameLength = 5;
    const truncatedFirst = firstName.substring(0, maxFirstNameLength);
    return `${truncatedFirst} ${lastInitial}.`;
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear().toString().slice(-2);
    return `${month}/${day}/${year}`;
  };

  // Build the title string
  const getTitle = () => {
    if (!classInfo) return "Loading...";
    
    const className = classInfo.name || "Unknown Class";
    
    if (classInfo.current_seating_period) {
      const period = classInfo.current_seating_period;
      const periodName = period.name || "Untitled Period";
      const startDate = formatDate(period.start_date);
      const endDate = formatDate(period.end_date) || 'Present';
      return `${className}: ${periodName} (${startDate} - ${endDate})`;
    }
    
    return `${className}: No Seating Period`;
  };

  // Handle creating a new seating period
  const handleNewPeriod = async () => {
    console.log("handleNewPeriod called");
    console.log("Current classInfo:", classInfo);
    console.log("Current layout:", layout);
    
    // Confirmation dialog
    const confirmMessage = classInfo?.current_seating_period 
      ? "Create a new seating period? This will end the current period as of today."
      : "Create a new seating period?";
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setIsCreatingPeriod(true);
    
    try {
      // If there's a current period, update its end date to today
      if (classInfo?.current_seating_period) {
        const today = new Date().toISOString().split('T')[0];
        console.log("Ending current period:", classInfo.current_seating_period.id, "with date:", today);
        
        const endResponse = await window.ApiModule.request(
          `/seating-periods/${classInfo.current_seating_period.id}/`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              end_date: today,
              is_active: false
            })
          }
        );
        console.log("End period response:", endResponse);
      }

      // Calculate dates
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startDate = tomorrow.toISOString().split('T')[0];
      
      // Auto-generate period name
      const periodName = `Period starting ${tomorrow.toLocaleDateString('en-US', { 
        month: 'numeric', 
        day: 'numeric', 
        year: '2-digit' 
      })}`;

      // Create new period with layout from previous period or class
      const requestBody = {
        class_assigned: classId,
        layout: layout.id,  // Use current layout (from previous period or class)
        name: periodName,
        start_date: startDate,
        end_date: null,
        is_active: true
      };
      
      console.log("Creating new period with data:", requestBody);
      
      const newPeriod = await window.ApiModule.request('/seating-periods/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      console.log("New period created:", newPeriod);
      
      // Switch to edit mode for the new period
      onEdit();
      
      // Reload data to show new period
      await loadClassData();
      
    } catch (error) {
      console.error("Error creating new period:", error);
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
      alert(`Failed to create new seating period: ${error.message}`);
    } finally {
      setIsCreatingPeriod(false);
    }
  };

  // Initialize on mount
  React.useEffect(() => {
    loadClassData();
  }, [classId]);

  if (loading) {
    return React.createElement(
      "div",
      { className: "loading" },
      React.createElement("div", { className: "spinner" }),
      React.createElement("p", null, "Loading seating chart...")
    );
  }

  if (!layout) {
    return React.createElement(
      "div",
      { className: "error-message" },
      React.createElement("h3", null, "No Layout Available"),
      React.createElement("p", null, "This class needs a layout to view seating charts.")
    );
  }

  return React.createElement(
    "div",
    { className: "content" },
    
    // Viewer container
    React.createElement(
      "div",
      { className: "seating-viewer-container floating-card" },
      
      // Top toolbar with navigation (matching editor style)
      React.createElement(
        "div",
        { className: "canvas-toolbar" },
        
        // Back button on the left
        React.createElement(
          "button",
          {
            className: "btn btn-secondary btn-sm",
            onClick: onBack,
            title: "Back to class list"
          },
          React.createElement("i", { className: "fas fa-arrow-left" }),
          " Back"
        ),
        
        // Title in the center
        React.createElement(
          "div",
          { className: "toolbar-title" },
          getTitle()
        ),
        
        // Navigation and edit buttons on the right
        React.createElement(
          "div",
          { className: "toolbar-actions" },
          React.createElement(
            "button",
            {
              className: "btn btn-secondary btn-sm",
              onClick: () => handlePeriodNavigation('previous'),
              title: "View previous seating period"
            },
            React.createElement("i", { className: "fas fa-chevron-left" }),
            " Previous"
          ),
          React.createElement(
            "button",
            {
              className: "btn btn-secondary btn-sm",
              onClick: () => handlePeriodNavigation('next'),
              title: "View next seating period"
            },
            "Next ",
            React.createElement("i", { className: "fas fa-chevron-right" })
          ),
          React.createElement(
            "button",
            {
              className: "btn btn-secondary btn-sm",
              onClick: onEdit,
              title: "Switch to edit mode"
            },
            React.createElement("i", { className: "fas fa-edit" }),
            " Edit"
          ),
          React.createElement(
            "button",
            {
              className: "btn btn-secondary btn-sm",
              onClick: handleNewPeriod,
              disabled: isCreatingPeriod || !layout,
              title: layout ? "Start a new seating period" : "No layout available"
            },
            React.createElement("i", { className: "fas fa-calendar-plus" }),
            " New Period"
          )
        )
      ),
    
    // Canvas container
    React.createElement(
      "div",
      { className: "seating-canvas-wrapper" },
      React.createElement(SeatingViewerCanvas, {
        layout: layout,
        assignments: assignments,
        students: students,
        highlightMode: "none",
        onSeatClick: () => {}, // No-op for viewer
        onStudentDrop: () => {}, // No-op for viewer
        onStudentUnassign: () => {}, // No-op for viewer
        onStudentSwap: () => {}, // No-op for viewer
        draggedStudent: null,
        onDragStart: () => {}, // No-op for viewer
        onDragEnd: () => {}, // No-op for viewer
      })
    )
    )  // Close seating-viewer-container
  );  // Close content div
};

// Canvas component (shared between viewer and editor)
const SeatingViewerCanvas = ({
  layout,
  assignments,
  students,
  highlightMode,
  onSeatClick,
  onStudentDrop,
  onStudentUnassign,
  onStudentSwap,
  draggedStudent,
  onDragStart,
  onDragEnd,
}) => {
  // Format student name helper
  const formatStudentName = (firstName, lastName) => {
    if (!firstName) return '';
    const lastInitial = lastName ? lastName[0] : '';
    const baseName = `${firstName} ${lastInitial}.`;
    if (baseName.length <= 8) return baseName;
    const maxFirstNameLength = 5;
    const truncatedFirst = firstName.substring(0, maxFirstNameLength);
    return `${truncatedFirst} ${lastInitial}.`;
  };

  return React.createElement(
    "div",
    {
      className: `seating-canvas ${draggedStudent ? "drag-active" : ""}`,
      style: {
        width: `${layout.room_width * 80}px`,
        height: `${layout.room_height * 80}px`,
        position: "relative",
        backgroundColor: "#f8f9fa",
        border: "1px solid #dee2e6",
        borderRadius: "8px",
        overflow: "hidden",
      },
    },

    // Render obstacles
    layout.obstacles?.map((obstacle) =>
      React.createElement(
        "div",
        {
          key: obstacle.id,
          className: "layout-obstacle",
          style: {
            position: "absolute",
            left: `${obstacle.x_position * 80}px`,
            top: `${obstacle.y_position * 80}px`,
            width: `${obstacle.width * 80}px`,
            height: `${obstacle.height * 80}px`,
            backgroundColor: obstacle.color || "#6c757d",
            opacity: 0.3,
            borderRadius: "4px",
            pointerEvents: "none",
          },
        },
        obstacle.name
      )
    ),

    // Render tables
    layout.tables?.map((table) =>
      React.createElement(
        "div",
        {
          key: table.id,
          className: "classroom-table",
          style: {
            position: "absolute",
            left: `${table.x_position * 80}px`,
            top: `${table.y_position * 80}px`,
            width: `${table.width * 80}px`,
            height: `${table.height * 80}px`,
            backgroundColor: "#e9ecef",
            border: "2px solid #adb5bd",
            borderRadius: table.table_shape === "round" ? "50%" : "8px",
            transform: `rotate(${table.rotation || 0}deg)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          },
        },
        React.createElement(
          "div",
          {
            className: "table-label",
            style: {
              position: "absolute",
              top: "-20px",
              fontSize: "12px",
              fontWeight: "bold",
              color: "#495057",
            },
          },
          table.table_name || `T${table.table_number}`
        ),

        // Render seats
        table.seats?.map((seat) => {
          const seatKey = String(seat.seat_number);
          const assignedStudentId = assignments[table.id]?.[seatKey];
          const assignedStudent = assignedStudentId
            ? students.find((s) => s.id === assignedStudentId)
            : null;

          return React.createElement(
            "div",
            {
              key: seat.seat_number,
              className: `seat ${assignedStudent ? "occupied" : "empty"} ${
                seat.is_accessible ? "accessible" : ""
              }`,
              style: {
                position: "absolute",
                left: `${seat.relative_x * 80}px`,
                top: `${seat.relative_y * 80}px`,
                width: "65px",
                height: "45px",
                backgroundColor: assignedStudent ? "#007bff" : "#ffffff",
                color: assignedStudent ? "#ffffff" : "#6c757d",
                border: assignedStudent ? "2px solid #0056b3" : "2px solid #dee2e6",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11px",
                fontWeight: assignedStudent ? "500" : "normal",
                cursor: onSeatClick ? "pointer" : "default",
                transition: "all 0.2s",
              },
              draggable: assignedStudent && onDragStart ? true : false,
              onDragStart: assignedStudent && onDragStart
                ? (e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("studentId", assignedStudent.id.toString());
                    e.dataTransfer.setData("sourceType", "seat");
                    e.dataTransfer.setData("sourceTableId", table.id.toString());
                    e.dataTransfer.setData("sourceSeatNumber", seat.seat_number.toString());
                    e.currentTarget.classList.add("dragging");
                    if (onDragStart) onDragStart(assignedStudent);
                  }
                : undefined,
              onDragEnd: assignedStudent && onDragEnd
                ? (e) => {
                    e.currentTarget.classList.remove("dragging");
                    if (onDragEnd) onDragEnd();
                  }
                : undefined,
              onClick: onSeatClick ? () => onSeatClick(table.id, seat.seat_number) : undefined,
              title: assignedStudent
                ? `${assignedStudent.first_name} ${assignedStudent.last_name}`
                : `Seat ${seat.seat_number}`,
            },
            assignedStudent
              ? React.createElement(
                  "div",
                  { 
                    className: "seat-name",
                    style: {
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "57px"
                    }
                  },
                  formatStudentName(assignedStudent.first_name, assignedStudent.last_name)
                )
              : seat.seat_number
          );
        })
      )
    )
  );
};

// Export the component for use in the app
if (typeof window !== "undefined") {
  window.SeatingViewer = SeatingViewer;
  console.log("SeatingViewer component loaded");
}