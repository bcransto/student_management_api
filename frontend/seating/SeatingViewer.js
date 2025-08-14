// SeatingViewer.js - Read-only seating chart viewer using standard app layout
const SeatingViewer = ({ classId, periodId, onEdit, onBack, navigateTo }) => {
  // Use NavigationService if available
  const nav = window.NavigationService || null;
  // Get utility functions from shared module
  const { formatStudentName, formatDate } = window.SharedUtils;

  const [loading, setLoading] = React.useState(true);
  const [classInfo, setClassInfo] = React.useState(null);
  const [viewedPeriod, setViewedPeriod] = React.useState(null); // Track which period is being viewed
  const [layout, setLayout] = React.useState(null);
  const [students, setStudents] = React.useState([]);
  const [assignments, setAssignments] = React.useState({});
  const [isCreatingPeriod, setIsCreatingPeriod] = React.useState(false);

  // Load class data
  const loadClassData = async () => {
    try {
      setLoading(true);
      console.log("Loading data for class:", classId, "period:", periodId);

      // Load class info
      const classData = await window.ApiModule.request(`/classes/${classId}/`);
      console.log("Class data loaded:", classData);
      
      // If specific periodId provided, load that period
      let periodToShow = null;
      
      if (periodId) {
        // Load the specific period requested
        periodToShow = await window.ApiModule.request(`/seating-periods/${periodId}/`);
        console.log("Loading specific period:", periodToShow.name);
      } else {
        // Otherwise use current period or most recent
        periodToShow = classData.current_seating_period;
      }
      
      if (!periodToShow && !periodId) {
        // Get all periods and find the most recent one
        const periodsResponse = await window.ApiModule.request(
          `/seating-periods/?class_assigned=${classId}`
        );
        const periods = periodsResponse.results || [];
        
        if (periods.length > 0) {
          // Sort by start date descending and take the first
          periods.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
          
          // Get full details for the most recent period
          const periodId = periods[0].id;
          periodToShow = await window.ApiModule.request(`/seating-periods/${periodId}/`);
          console.log("No current period, showing most recent:", periodToShow.name);
        }
      }
      
      setClassInfo(classData);
      setViewedPeriod(periodToShow); // Track the period being viewed separately

      // Load the layout from the period (if exists) or auto-select
      let currentLayout = null;
      if (periodToShow && periodToShow.layout_details) {
        console.log(
          "Layout found in seating period:",
          periodToShow.layout_details
        );
        currentLayout = periodToShow.layout_details;
        setLayout(currentLayout);
      } else {
        // Auto-select the user's most recent layout
        console.log("No period layout, fetching user's layouts...");
        try {
          const layoutsResponse = await window.ApiModule.request("/layouts/");
          const userLayouts = layoutsResponse.results || layoutsResponse;
          
          if (userLayouts.length > 0) {
            // Select the most recent layout (first in the list, assuming sorted by date)
            currentLayout = userLayouts[0];
            console.log("Auto-selected most recent layout:", currentLayout.name);
            setLayout(currentLayout);
          } else {
            console.log("No layouts available - user needs to create one");
            // The component will handle showing a message to create a layout
          }
        } catch (error) {
          console.error("Failed to fetch user layouts:", error);
        }
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
        periodToShow?.seating_assignments &&
        periodToShow.seating_assignments.length > 0 &&
        currentLayout
      ) {
        console.log("Loading seating assignments");
        const assignmentMap = {};

        periodToShow.seating_assignments.forEach((assignment) => {
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

  // Navigate to previous/next seating period (VIEW ONLY - does not modify database)
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

      // Find the currently viewed period index (use viewedPeriod, not current_seating_period)
      const currentlyViewedPeriodId = viewedPeriod?.id;
      const currentIndex = periods.findIndex((p) => p.id === currentlyViewedPeriodId);

      let targetIndex;
      if (direction === "previous") {
        // Wrap around: if at first period, go to last
        targetIndex = currentIndex > 0 ? currentIndex - 1 : periods.length - 1;
      } else {
        // Wrap around: if at last period, go to first
        targetIndex = currentIndex < periods.length - 1 ? currentIndex + 1 : 0;
      }

      const targetPeriod = periods[targetIndex];

      console.log(`Navigating from period ${currentlyViewedPeriodId} (index ${currentIndex}) to ${targetPeriod.id} (index ${targetIndex})`);
      console.log("Note: This is VIEW-ONLY navigation, not changing active period in database");

      // Get full details of the target period
      const fullTargetPeriod = await window.ApiModule.request(`/seating-periods/${targetPeriod.id}/`);

      // Update the viewed period state
      setViewedPeriod(fullTargetPeriod);

      // Update URL to reflect the new period being viewed
      if (nav?.toSeatingViewPeriod) {
        nav.toSeatingViewPeriod(classId, targetPeriod.id);
      } else if (navigateTo) {
        navigateTo(`seating/view/${classId}/period/${targetPeriod.id}`);
      }

      // Update layout if the period has a different one
      let currentLayout = layout;
      if (fullTargetPeriod.layout_details) {
        currentLayout = fullTargetPeriod.layout_details;
        setLayout(currentLayout);
      }

      // Load assignments for the target period
      if (fullTargetPeriod.seating_assignments && fullTargetPeriod.seating_assignments.length > 0 && currentLayout) {
        const assignmentMap = {};
        fullTargetPeriod.seating_assignments.forEach((assignment) => {
          const table = currentLayout.tables.find(
            (t) => t.table_number === assignment.table_number
          );
          if (!table) {
            console.warn(`Table ${assignment.table_number} not found in layout`);
            return;
          }

          const tableId = String(table.id);
          const seatNumber = String(assignment.seat_number);

          // Find the student ID from the roster
          const rosterEntry = classInfo.roster.find((r) => r.id === assignment.roster_entry);
          const studentId = rosterEntry ? rosterEntry.student : null;

          if (studentId) {
            if (!assignmentMap[tableId]) {
              assignmentMap[tableId] = {};
            }
            assignmentMap[tableId][seatNumber] = studentId;
          }
        });
        setAssignments(assignmentMap);
      } else {
        setAssignments({});
      }
    } catch (error) {
      console.error("Failed to navigate periods:", error);
      alert("Failed to navigate to " + direction + " period");
    }
  };


  // Handle creating a new seating period
  const handleNewPeriod = async () => {
    console.log("handleNewPeriod called");
    console.log("Current classInfo:", classInfo);
    console.log("Current layout:", layout);

    // Find the actual current period (end_date = null)
    let currentActivePeriod = null;
    try {
      const response = await window.ApiModule.request(
        `/seating-periods/?class_assigned=${classId}`
      );
      const periods = response.results || [];
      currentActivePeriod = periods.find(p => p.end_date === null);
    } catch (error) {
      console.error("Error fetching periods:", error);
    }

    // Confirmation dialog
    const confirmMessage = currentActivePeriod
      ? "Create a new seating period? This will end the current period as of today."
      : "Create a new seating period?";

    if (!confirm(confirmMessage)) {
      return;
    }

    setIsCreatingPeriod(true);

    try {
      // If there's a current active period, update its end date to today
      if (currentActivePeriod) {
        const today = new Date().toISOString().split("T")[0];
        console.log(
          "Ending current period:",
          currentActivePeriod.id,
          "with date:",
          today
        );

        const endResponse = await window.ApiModule.request(
          `/seating-periods/${currentActivePeriod.id}/`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              end_date: today,
            }),
          }
        );
        console.log("End period response:", endResponse);
      }

      // Calculate dates
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startDate = tomorrow.toISOString().split("T")[0];

      // Get all periods for this class to determine the chart number
      let chartNumber = 1;
      try {
        const allPeriods = await window.ApiModule.request(`/seating-periods/?class_assigned=${classId}`);
        console.log("All periods for numbering:", allPeriods);
        
        // Handle both array and object responses
        if (Array.isArray(allPeriods)) {
          chartNumber = allPeriods.length + 1;
        } else if (allPeriods && typeof allPeriods === 'object') {
          // If it's a paginated response with results array
          if (allPeriods.results && Array.isArray(allPeriods.results)) {
            chartNumber = allPeriods.results.length + 1;
          } else if (allPeriods.count !== undefined) {
            chartNumber = allPeriods.count + 1;
          }
        }
      } catch (error) {
        console.error("Error fetching periods for chart numbering:", error);
        // Fall back to 1 if we can't get the count
        chartNumber = 1;
      }
      
      // Auto-generate period name as "Chart N"
      const periodName = `Chart ${chartNumber}`;

      // Create new period with layout from previous period or class
      const requestBody = {
        class_assigned: classId,
        layout: layout.id, // Use current layout (from previous period or class)
        name: periodName,
        start_date: startDate,
        end_date: null,
      };

      console.log("Creating new period with data:", requestBody);

      const newPeriod = await window.ApiModule.request("/seating-periods/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
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
  }, [classId, periodId]);

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

  // Build title element with two lines for toolbar
  const getTitle = () => {
    if (!classInfo) {
      return React.createElement("span", null, "Loading...");
    }
    
    const className = classInfo.name || "Unknown Class";
    
    if (viewedPeriod) {
      const period = viewedPeriod;
      const periodName = period.name || "Untitled Period";
      const startDate = formatDate(period.start_date);
      const endDate = formatDate(period.end_date) || "Present";
      
      // Return a two-line element
      return React.createElement(
        "div",
        { 
          style: { 
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            lineHeight: "1.2"
          } 
        },
        // Top line - Period name (large)
        React.createElement(
          "div",
          { 
            style: { 
              fontSize: "1.25rem",
              fontWeight: "600",
              color: "#1f2937"
            } 
          },
          periodName
        ),
        // Bottom line - Class name and dates (small)
        React.createElement(
          "div",
          { 
            style: { 
              fontSize: "0.875rem",
              color: "#6b7280",
              fontWeight: "400"
            } 
          },
          `${className} • ${startDate} - ${endDate}`
        )
      );
    }
    
    // No seating period case
    return React.createElement(
      "div",
      { 
        style: { 
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          lineHeight: "1.2"
        } 
      },
      React.createElement(
        "div",
        { 
          style: { 
            fontSize: "1.25rem",
            fontWeight: "600",
            color: "#1f2937"
          } 
        },
        "No Seating Period"
      ),
      React.createElement(
        "div",
        { 
          style: { 
            fontSize: "0.875rem",
            color: "#6b7280",
            fontWeight: "400"
          } 
        },
        className
      )
    );
  };

  return React.createElement(
    "div",
    { className: "seating-viewer-integrated" },

    // Top toolbar (matching editor style)
    React.createElement(
      "div",
      { className: "canvas-toolbar" },
      
      // Back button
      React.createElement(
        "button",
        {
          onClick: () => {
            console.log("SeatingViewer back button clicked");
            console.log("onBack prop:", onBack);
            if (onBack) {
              onBack();
            } else {
              console.error("No onBack handler provided to SeatingViewer");
            }
          },
          className: "btn btn-secondary btn-sm",
        },
        React.createElement("i", { className: "fas fa-arrow-left" }),
        " Back"
      ),
      
      // Title
      React.createElement(
        "div", 
        { 
          className: "viewer-title", 
          style: { 
            flex: "1",
            display: "flex",
            alignItems: "center",
            minHeight: "40px"
          } 
        }, 
        getTitle()
      ),

      // Period navigation buttons (right-justified)
      React.createElement(
        "div",
        {
          className: "period-navigation",
          style: { display: "flex", gap: "0.5rem", marginLeft: "1rem" },
        },
        React.createElement(
          "button",
          {
            className: "btn btn-sm btn-secondary",
            onClick: () => handlePeriodNavigation("previous"),
            title: "View previous seating period",
          },
          React.createElement("i", { className: "fas fa-chevron-left" }),
          " Previous"
        ),
        React.createElement(
          "button",
          {
            className: "btn btn-sm btn-secondary",
            onClick: () => handlePeriodNavigation("next"),
            title: "View next seating period",
          },
          "Next ",
          React.createElement("i", { className: "fas fa-chevron-right" })
        ),
        // Edit button
        React.createElement(
          "button",
          {
            className: "btn btn-sm btn-secondary",
            onClick: onEdit,
            title: "Switch to edit mode",
          },
          React.createElement("i", { className: "fas fa-edit" }),
          " Edit"
        ),
        // New Period button
        React.createElement(
          "button",
          {
            className: "btn btn-sm btn-secondary",
            onClick: handleNewPeriod,
            disabled: isCreatingPeriod || !layout,
            title: layout ? "Start a new seating period" : "No layout available",
          },
          React.createElement("i", { className: "fas fa-calendar-plus" }),
          " New Period"
        )
      )
    ),

    // Main content area
    React.createElement(
      "div",
      { 
        className: "canvas-container",
        style: {
          flex: 1,
          display: "flex",
          overflow: "hidden",
          position: "relative"
        }
      },
      
      // Canvas wrapper
      React.createElement(
        "div",
        { 
          className: "seating-canvas-wrapper",
          style: {
            flex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: "20px",
            overflow: "auto"
          }
        },
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
    )
  ); // Close main div
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
  // Get format function from shared utils
  const { formatStudentName } = window.SharedUtils;
  const containerRef = React.useRef(null);
  const [gridSize, setGridSize] = React.useState(80);

  // Calculate grid size based on container
  React.useEffect(() => {
    const calculateGridSize = () => {
      if (!containerRef.current) return;
      
      const container = containerRef.current.parentElement?.parentElement; // Go up two levels to get main container
      if (!container) return;
      
      // Get available space more accurately
      const containerRect = container.getBoundingClientRect();
      const availableWidth = containerRect.width - 40; // Small padding
      const availableHeight = window.innerHeight - containerRect.top - 100; // Use viewport height minus top position
      
      // Calculate optimal grid size to fit the layout
      const gridSizeByWidth = Math.floor(availableWidth / layout.room_width);
      const gridSizeByHeight = Math.floor(availableHeight / layout.room_height);
      
      // Use the smaller of the two to ensure it fits
      const optimalGridSize = Math.min(gridSizeByWidth, gridSizeByHeight, 120); // Increased cap to 120px
      const finalGridSize = Math.max(optimalGridSize, 50); // Increased min to 50px
      
      setGridSize(finalGridSize);
    };
    
    // Add small delay to ensure DOM is ready
    setTimeout(calculateGridSize, 100);
    window.addEventListener('resize', calculateGridSize);
    return () => window.removeEventListener('resize', calculateGridSize);
  }, [layout.room_width, layout.room_height]);

  return React.createElement(
    "div",
    {
      ref: containerRef,
      className: `seating-canvas ${draggedStudent ? "drag-active" : ""}`,
      style: {
        width: `${layout.room_width * gridSize}px`,
        height: `${layout.room_height * gridSize}px`,
        position: "relative",
        backgroundColor: "#ffffff",
        border: "2px solid #e5e7eb",
        borderRadius: "8px",
        overflow: "visible",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
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
            left: `${obstacle.x_position * gridSize}px`,
            top: `${obstacle.y_position * gridSize}px`,
            width: `${obstacle.width * gridSize}px`,
            height: `${obstacle.height * gridSize}px`,
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
            left: `${table.x_position * gridSize}px`,
            top: `${table.y_position * gridSize}px`,
            width: `${table.width * gridSize}px`,
            height: `${table.height * gridSize}px`,
            backgroundColor: "#dbeafe",
            border: "2px solid #60a5fa",
            borderRadius: table.table_shape === "round" ? "50%" : "8px",
            transform: `rotate(${table.rotation || 0}deg)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          },
        },
        // Table label - centered, just number, white text
        React.createElement(
          "div",
          {
            style: {
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: "28px",
              fontWeight: "bold",
              color: "#ffffff",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
              pointerEvents: "none",
              zIndex: 5,
            },
          },
          String(table.table_number)
        ),

        // Render seats
        table.seats?.map((seat) => {
          const seatKey = String(seat.seat_number);
          const assignedStudentId = assignments[table.id]?.[seatKey];
          const assignedStudent = assignedStudentId
            ? students.find((s) => s.id === assignedStudentId)
            : null;

          // Use consistent seat size - 80% of grid
          const seatStyle = LayoutStyles.getSeatStyle(seat, {
            isOccupied: !!assignedStudent,
            isSelected: false,
            isAccessible: false,
            gridSize: gridSize,
            showName: !!assignedStudent
          });
          
          return React.createElement(
            "div",
            {
              key: seat.seat_number,
              className: "",
              style: {
                ...seatStyle,
                cursor: onSeatClick ? "pointer" : "default",
              },
              draggable: assignedStudent && onDragStart ? true : false,
              onDragStart:
                assignedStudent && onDragStart
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
              onDragEnd:
                assignedStudent && onDragEnd
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
              ? (() => {
                  const { line1, line2 } = LayoutStyles.formatSeatName(
                    assignedStudent.nickname || assignedStudent.first_name,
                    assignedStudent.last_name
                  );
                  return React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                      "div",
                      {
                        style: {
                          fontSize: "11px",
                          fontWeight: "bold",
                          lineHeight: "1.1",
                        },
                      },
                      line1
                    ),
                    React.createElement(
                      "div",
                      {
                        style: {
                          fontSize: "10px",
                          lineHeight: "1.1",
                        },
                      },
                      line2
                    )
                  );
                })()
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
