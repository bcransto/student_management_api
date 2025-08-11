// frontend/seating/SeatingEditor.js
// Integrated Seating Chart Editor

const { useState, useEffect } = React;

const SeatingEditor = ({ classId, onBack, onView }) => {
  // Get utility functions from shared module
  const { formatStudentName, formatDate } = window.SharedUtils;
  // Core state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isCreatingPeriod, setIsCreatingPeriod] = useState(false);

  // Data state
  const [classInfo, setClassInfo] = useState(null);
  const [layout, setLayout] = useState(null);
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState({}); // {tableId: {seatNumber: studentId}}
  const [initialAssignments, setInitialAssignments] = useState({}); // Track original state

  // UI state
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [highlightMode, setHighlightMode] = useState("none"); // none, gender, previous
  const [draggedStudent, setDraggedStudent] = useState(null);
  const [showLayoutSelector, setShowLayoutSelector] = useState(false);
  const [availableLayouts, setAvailableLayouts] = useState([]);
  const [showAutofillDropdown, setShowAutofillDropdown] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);

  // Load initial data
  useEffect(() => {
    loadClassData();
  }, [classId]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside dropdown
      if (!event.target.closest('.dropdown')) {
        setShowAutofillDropdown(false);
        setShowViewDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return "You have unsaved changes. Are you sure you want to leave?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Add this inside your SeatingEditor component for debugging:
  // Debug helper - expose to window for console access
  useEffect(() => {
    window.debugSeating = {
      assignments,
      classInfo,
      layout,
      students,
      getState: () => ({
        assignments,
        classInfo,
        layout,
        students,
        currentPeriod: classInfo?.current_seating_period,
      }),
      testSave: () => handleSave(),
    };
  }, [assignments, classInfo, layout, students]);

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
        // Use layout from the seating period (new approach)
        console.log(
          "Layout found in seating period:",
          classData.current_seating_period.layout_details
        );
        currentLayout = classData.current_seating_period.layout_details;
        setLayout(currentLayout);
      } else if (classData.classroom_layout) {
        // Fallback to class layout for backward compatibility
        console.log("No period layout, using class layout:", classData.classroom_layout);
        currentLayout = classData.classroom_layout;
        setLayout(currentLayout);
      }

      // Load students from the roster that's already in the class data
      if (classData.roster && Array.isArray(classData.roster)) {
        console.log("Loading students from roster:", classData.roster.length);

        // Fetch full student details for gender info
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
        currentLayout // Make sure we have a layout
      ) {
        console.log(
          "Loading seating assignments:",
          classData.current_seating_period.seating_assignments
        );
        // Convert assignments to our format: {tableId: {seatNumber: studentId}}
        const assignmentMap = {};

        classData.current_seating_period.seating_assignments.forEach((assignment) => {
          // Use the currentLayout variable we set above
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
          const seatNumber = String(assignment.seat_number); // Ensure it's a string

          // Find the student ID from the roster
          const rosterEntry = classData.roster.find((r) => r.id === assignment.roster_entry);
          const studentId = rosterEntry ? rosterEntry.student : null;

          if (!studentId) {
            console.warn(`Student not found for roster entry ${assignment.roster_entry}`);
            return;
          }

          console.log(
            `Assignment: Table ${tableId} (number ${assignment.table_number}), Seat ${seatNumber}, Student ${studentId} (${assignment.student_name})`
          );

          if (!assignmentMap[tableId]) {
            assignmentMap[tableId] = {};
          }
          assignmentMap[tableId][seatNumber] = studentId;
        });

        console.log("Assignment map:", assignmentMap);
        setAssignments(assignmentMap);
        setInitialAssignments(assignmentMap); // Save initial state
        setHasUnsavedChanges(false);
      } else {
        console.log("No seating assignments found");
        setInitialAssignments({});
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error("Failed to load class data:", error);
      alert("Failed to load class data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSeatAssignment = (studentId, tableId, seatNumber) => {
    setAssignments((prev) => ({
      ...prev,
      [tableId]: {
        ...prev[tableId],
        [seatNumber]: studentId,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleSeatSwap = (studentA, tableA, seatA, studentB, tableB, seatB) => {
    console.log("handleSeatSwap called:", {
      studentA,
      tableA,
      seatA,
      studentB,
      tableB,
      seatB,
    });
    setAssignments((prev) => {
      console.log("Previous assignments:", JSON.parse(JSON.stringify(prev)));
      const newAssignments = { ...prev };

      // Special case: if swapping within the same table, handle it differently
      if (tableA === tableB) {
        // Just swap the values directly without deleting the table
        if (newAssignments[tableA]) {
          const tempStudent = newAssignments[tableA][seatA];
          newAssignments[tableA][seatA] = newAssignments[tableA][seatB];
          newAssignments[tableA][seatB] = tempStudent;
        }
        console.log("Same table swap result:", JSON.parse(JSON.stringify(newAssignments)));
        return newAssignments;
      }

      // Different tables: Remove both students from their current seats
      if (newAssignments[tableA]) {
        delete newAssignments[tableA][seatA];
        if (Object.keys(newAssignments[tableA]).length === 0) {
          delete newAssignments[tableA];
        }
      }
      if (newAssignments[tableB]) {
        delete newAssignments[tableB][seatB];
        if (Object.keys(newAssignments[tableB]).length === 0) {
          delete newAssignments[tableB];
        }
      }

      console.log("After removal:", JSON.parse(JSON.stringify(newAssignments)));

      // Assign students to their new seats (swapped)
      const result = {
        ...newAssignments,
        [tableA]: {
          ...(newAssignments[tableA] || {}),
          [seatA]: studentB,
        },
        [tableB]: {
          ...(newAssignments[tableB] || {}),
          [seatB]: studentA,
        },
      };

      console.log("Final result:", JSON.parse(JSON.stringify(result)));
      return result;
    });
    setHasUnsavedChanges(true);
  };

  const handleSeatUnassignment = (tableId, seatNumber) => {
    setAssignments((prev) => {
      const newAssignments = { ...prev };
      if (newAssignments[tableId]) {
        delete newAssignments[tableId][seatNumber];
        if (Object.keys(newAssignments[tableId]).length === 0) {
          delete newAssignments[tableId];
        }
      }
      return newAssignments;
    });
    setHasUnsavedChanges(true);
  };

  const getAssignedStudentIds = () => {
    const assigned = new Set();
    Object.values(assignments).forEach((tableAssignments) => {
      Object.values(tableAssignments).forEach((studentId) => {
        assigned.add(studentId);
      });
    });
    return assigned;
  };

  const getUnassignedStudents = () => {
    const assigned = getAssignedStudentIds();
    return students.filter((student) => !assigned.has(student.id));
  };

  // Build the title string
  const getEditorTitle = () => {
    if (!classInfo) return "Loading...";

    const className = classInfo.name || "Unknown Class";

    if (classInfo.current_seating_period) {
      const period = classInfo.current_seating_period;
      const periodName = period.name || "Untitled Period";
      const startDate = formatDate(period.start_date);
      const endDate = formatDate(period.end_date) || "Present";
      return `${className}: ${periodName} (${startDate} - ${endDate})`;
    }

    // No current period yet
    return `${className}: New Seating Chart`;
  };

  // Reset function - moves all students back to pool
  const handleReset = () => {
    if (
      window.confirm(
        "Are you sure you want to reset? This will move all students back to the pool."
      )
    ) {
      setAssignments({});
      setSelectedStudent(null);
      setHasUnsavedChanges(true);
    }
  };

  // Navigate to previous/next seating period
  const handlePeriodNavigation = async (direction) => {
    try {
      // Check for unsaved changes
      if (hasUnsavedChanges) {
        if (!window.confirm("You have unsaved changes. Do you want to continue without saving?")) {
          return;
        }
      }

      // Get all periods for this class
      const response = await window.ApiModule.request(
        `/seating-periods/?class_assigned=${classId}`
      );

      const periods = response.results || [];
      console.log(`Found ${periods.length} periods for class ${classId}:`, periods);

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
      console.log(
        "Sorted periods:",
        periods.map((p) => ({ id: p.id, name: p.name, active: p.is_active }))
      );

      // Find current period index
      const currentPeriodId = classInfo.current_seating_period?.id;
      const currentIndex = periods.findIndex((p) => p.id === currentPeriodId);

      let targetIndex;
      if (direction === "previous") {
        targetIndex = currentIndex > 0 ? currentIndex - 1 : periods.length - 1;
      } else {
        targetIndex = currentIndex < periods.length - 1 ? currentIndex + 1 : 0;
      }

      const targetPeriod = periods[targetIndex];

      console.log(`Navigating from period ${currentPeriodId} to ${targetPeriod.id}`);
      console.log("Target period:", targetPeriod);

      // Set the target period as active (this will deactivate others automatically in the backend)
      await window.ApiModule.request(`/seating-periods/${targetPeriod.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          is_active: true,
        }),
      });

      // Small delay to ensure backend has updated
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reload the data with the new period
      await loadClassData();
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to navigate periods:", error);
      alert("Failed to navigate to " + direction + " period");
    }
  };

  // Simple save function that works with the fixed ApiModule
  const handleSave = async () => {
    try {
      setSaving(true);

      console.log("Starting to save seating assignments...");
      console.log("Current assignments:", assignments);

      // Debug: Check all periods for this class
      try {
        const allPeriods = await window.ApiModule.request(
          `/seating-periods/?class_assigned=${classId}`
        );
        console.log("All periods for this class:", allPeriods);
        if (allPeriods?.results) {
          console.log("Period count:", allPeriods.results.length);
          allPeriods.results.forEach((period) => {
            console.log(
              `Period ${period.id}: "${period.name}" - Active: ${period.is_active}, Start: ${period.start_date}`
            );
          });
        }
        console.log(
          "Currently saving to period:",
          classInfo.current_seating_period?.id,
          classInfo.current_seating_period?.name
        );
      } catch (debugError) {
        console.error("Debug fetch failed:", debugError);
      }

      // Get or create seating period
      let seatingPeriodId;
      if (classInfo.current_seating_period) {
        seatingPeriodId = classInfo.current_seating_period.id;
        console.log("Using existing seating period:", seatingPeriodId);
        console.log("Period details:", {
          id: classInfo.current_seating_period.id,
          name: classInfo.current_seating_period.name,
          start_date: classInfo.current_seating_period.start_date,
          is_active: classInfo.current_seating_period.is_active,
        });
      } else {
        console.log("Creating new seating period...");

        // If no layout from class, need to select one
        if (!layout || !layout.id) {
          // Load available layouts if not already loaded
          if (availableLayouts.length === 0) {
            const layoutsResponse = await window.ApiModule.request("/classroom-layouts/");
            const layouts = layoutsResponse.results || [];

            if (layouts.length === 0) {
              alert("No classroom layouts available. Please create a layout first.");
              setSaving(false);
              return;
            }

            // Show layout selection dialog
            const layoutNames = layouts
              .map((l, i) => `${i + 1}. ${l.name} (${l.room_width}x${l.room_height})`)
              .join("\n");
            const selectedIndex = prompt(
              `Select a classroom layout for the new seating period:\n\n${layoutNames}\n\nEnter the number:`,
              "1"
            );

            if (!selectedIndex) {
              setSaving(false);
              return;
            }

            const selectedLayout = layouts[parseInt(selectedIndex) - 1];
            if (!selectedLayout) {
              alert("Invalid selection");
              setSaving(false);
              return;
            }

            setLayout(selectedLayout);
            layout = selectedLayout;
          }
        }

        const newPeriod = await window.ApiModule.request("/seating-periods/", {
          method: "POST",
          body: JSON.stringify({
            class_assigned: classId,
            layout: layout.id, // Now required!
            name: `Seating Chart - ${new Date().toLocaleDateString()}`,
            start_date: new Date().toISOString().split("T")[0],
            is_active: true,
            notes: "Created from seating chart editor",
          }),
        });
        seatingPeriodId = newPeriod.id;
        console.log("Created new seating period:", seatingPeriodId);
      }

      // Clear existing assignments ONLY for the current period
      console.log(`Fetching assignments for period ${seatingPeriodId}...`);
      const currentAssignments = await window.ApiModule.request(
        `/seating-assignments/?seating_period=${seatingPeriodId}`
      );

      console.log("Current assignments response:", currentAssignments);

      if (currentAssignments.results && currentAssignments.results.length > 0) {
        console.log(
          `Found ${currentAssignments.results.length} assignments to clear for period ${seatingPeriodId}`
        );
        console.log(
          "Assignments to delete:",
          currentAssignments.results.map((a) => ({
            id: a.id,
            seating_period: a.seating_period,
            seat_id: a.seat_id,
            roster_entry: a.roster_entry,
          }))
        );

        // Verify each assignment belongs to the correct period before deleting
        for (const assignment of currentAssignments.results) {
          if (assignment.seating_period !== seatingPeriodId) {
            console.error(
              `WARNING: Assignment ${assignment.id} belongs to period ${assignment.seating_period}, not ${seatingPeriodId}!`
            );
            console.error("Skipping deletion of wrong period assignment");
            continue;
          }
          await window.ApiModule.request(`/seating-assignments/${assignment.id}/`, {
            method: "DELETE",
          });
        }
        console.log(`Cleared ${currentAssignments.results.length} existing assignments`);
      }

      // Create new assignments
      const assignmentsToCreate = [];

      Object.keys(assignments).forEach((tableId) => {
        const tableAssignments = assignments[tableId];
        const table = layout.tables.find((t) => t.id == tableId);
        if (!table) return;

        Object.keys(tableAssignments).forEach((seatNumber) => {
          const studentId = tableAssignments[seatNumber];
          const rosterEntry = classInfo.roster.find((r) => r.student == studentId);
          if (!rosterEntry) return;

          assignmentsToCreate.push({
            seating_period: seatingPeriodId,
            roster_entry: rosterEntry.id,
            seat_id: `${table.table_number}-${seatNumber}`,
            group_number: null,
            group_role: "",
            assignment_notes: "",
          });
        });
      });

      console.log(`Creating ${assignmentsToCreate.length} new assignments...`);

      // Create all assignments
      const createdAssignments = [];
      for (const assignmentData of assignmentsToCreate) {
        const created = await window.ApiModule.request("/seating-assignments/", {
          method: "POST",
          body: JSON.stringify(assignmentData),
        });
        createdAssignments.push(created);
      }

      console.log(`Successfully created ${createdAssignments.length} seating assignments`);
      alert(`✅ Seating chart saved successfully! ${createdAssignments.length} students assigned.`);

      // Mark as saved
      setHasUnsavedChanges(false);
      setInitialAssignments(assignments);

      // Stay in editor after saving - removed: if (onBack) onBack();
    } catch (error) {
      console.error("Failed to save seating assignments:", error);
      alert(`❌ Failed to save seating chart: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Function to validate all assignments before saving
  const validateAssignments = () => {
    const errors = [];

    // Check for duplicate seat assignments
    const seatMap = new Map();
    Object.entries(assignments).forEach(([tableId, seatAssignments]) => {
      Object.entries(seatAssignments).forEach(([seatNumber, studentId]) => {
        const seatKey = `${tableId}-${seatNumber}`;
        if (seatMap.has(seatKey)) {
          errors.push(`Seat ${seatKey} is assigned to multiple students`);
        }
        seatMap.set(seatKey, studentId);
      });
    });

    // Check for students assigned to multiple seats
    const studentSeatMap = new Map();
    seatMap.forEach((studentId, seatKey) => {
      if (studentSeatMap.has(studentId)) {
        errors.push(`Student ${studentId} is assigned to multiple seats`);
      }
      studentSeatMap.set(studentId, seatKey);
    });

    return errors;
  };

  // Function to get a summary of the current assignments
  const getAssignmentSummary = () => {
    let totalAssigned = 0;
    const tablesSummary = {};

    Object.entries(assignments).forEach(([tableId, seatAssignments]) => {
      const table = layout.tables.find((t) => t.id === parseInt(tableId));
      const tableName = table?.table_name || `Table ${table?.table_number}`;
      const assignedCount = Object.keys(seatAssignments).length;
      totalAssigned += assignedCount;
      tablesSummary[tableName] = assignedCount;
    });

    return {
      totalAssigned,
      totalStudents: students.length,
      unassignedCount: students.length - totalAssigned,
      tablesSummary,
    };
  };

  // Handle creating a new seating period
  const handleNewPeriod = async () => {
    // Check for unsaved changes
    if (hasUnsavedChanges) {
      const saveFirst = confirm(
        "You have unsaved changes. Save them before creating a new period?"
      );
      if (saveFirst) {
        await handleSave();
      } else if (!confirm("Discard unsaved changes and create new period?")) {
        return;
      }
    }

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
        const today = new Date().toISOString().split("T")[0];
        await window.ApiModule.request(`/seating-periods/${classInfo.current_seating_period.id}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            end_date: today,
            is_active: false,
          }),
        });
      }

      // Calculate dates
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startDate = tomorrow.toISOString().split("T")[0];

      // Auto-generate period name
      const periodName = `Period starting ${tomorrow.toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "2-digit",
      })}`;

      // Create new period with layout from previous period or class
      const layoutId =
        classInfo?.current_seating_period?.layout || layout?.id || classInfo?.classroom_layout?.id;
      if (!layoutId) {
        alert("No layout available to create a new period");
        return;
      }

      const newPeriod = await window.ApiModule.request("/seating-periods/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_assigned: classId,
          layout: layoutId,
          name: periodName,
          start_date: startDate,
          end_date: null,
          is_active: true,
        }),
      });

      console.log("New period created:", newPeriod);

      // Reload data to show new period (will be empty seats)
      await loadClassData();

      // Clear any existing assignments for fresh start
      setAssignments({});
      setNewAssignments({});
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Error creating new period:", error);
      alert("Failed to create new seating period. Please try again.");
    } finally {
      setIsCreatingPeriod(false);
    }
  };

  // Optional: Add a confirmation dialog before saving
  const handleSaveWithConfirmation = async () => {
    const errors = validateAssignments();
    if (errors.length > 0) {
      const proceed = window.confirm(
        `Found ${errors.length} issue(s):\n${errors.join("\n")}\n\nProceed anyway?`
      );
      if (!proceed) return;
    }

    const summary = getAssignmentSummary();
    const message =
      `Save seating chart?\n\n` +
      `Students assigned: ${summary.totalAssigned}/${summary.totalStudents}\n` +
      `Unassigned: ${summary.unassignedCount}\n\n` +
      `Continue?`;

    if (window.confirm(message)) {
      await handleSave();
    }
  };

  if (loading) {
    return React.createElement(
      "div",
      { className: "loading" },
      React.createElement("div", { className: "spinner" }),
      React.createElement("p", null, "Loading class data...")
    );
  }

  if (!layout) {
    return React.createElement(
      "div",
      { className: "error-message" },
      React.createElement("h3", null, "No Layout Selected"),
      React.createElement("p", null, "This class needs a layout before creating seating charts."),
      React.createElement("button", { className: "btn btn-primary", onClick: onBack }, "Go Back")
    );
  }

  return React.createElement(
    "div",
    { className: "seating-editor-integrated" },

    // Top toolbar
    React.createElement(
      "div",
      { className: "canvas-toolbar" },
      React.createElement(
        "button",
        {
          onClick: onBack,
          className: "btn btn-secondary btn-sm",
        },
        React.createElement("i", { className: "fas fa-arrow-left" }),
        " Back"
      ),
      React.createElement("h2", { className: "editor-title", style: { flex: "1" } }, getEditorTitle()),

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
        // Add View button if onView prop is provided
        onView &&
          React.createElement(
            "button",
            {
              className: "btn btn-sm btn-secondary",
              onClick: onView,
              title: "Switch to view mode",
            },
            React.createElement("i", { className: "fas fa-eye" }),
            " View"
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
        ),
        
        // Autofill dropdown
        React.createElement(
          "div",
          { className: "dropdown", style: { position: "relative" } },
          React.createElement(
            "button",
            {
              className: "btn btn-sm btn-secondary dropdown-toggle",
              onClick: () => {
                setShowAutofillDropdown(!showAutofillDropdown);
                setShowViewDropdown(false);
              },
              title: "Auto-fill seating options",
            },
            React.createElement("i", { className: "fas fa-magic" }),
            " Auto-fill ",
            React.createElement("i", { className: "fas fa-caret-down" })
          ),
          showAutofillDropdown && React.createElement(
            "div",
            { 
              className: "dropdown-menu show",
              style: {
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "4px",
                minWidth: "160px",
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                zIndex: 1000
              }
            },
            React.createElement(
              "button",
              {
                className: "dropdown-item",
                onClick: () => {
                  alert("Auto-fill: Alphabetical");
                  setShowAutofillDropdown(false);
                },
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  background: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "14px"
                },
                onMouseEnter: (e) => e.target.style.background = "#f3f4f6",
                onMouseLeave: (e) => e.target.style.background = "transparent"
              },
              React.createElement("i", { className: "fas fa-sort-alpha-down", style: { width: "16px" } }),
              "Alphabetical"
            ),
            React.createElement(
              "button",
              {
                className: "dropdown-item",
                onClick: () => {
                  alert("Auto-fill: Random");
                  setShowAutofillDropdown(false);
                },
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  background: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "14px"
                },
                onMouseEnter: (e) => e.target.style.background = "#f3f4f6",
                onMouseLeave: (e) => e.target.style.background = "transparent"
              },
              React.createElement("i", { className: "fas fa-random", style: { width: "16px" } }),
              "Random"
            ),
            React.createElement(
              "button",
              {
                className: "dropdown-item",
                onClick: () => {
                  alert("Auto-fill: Boy-Girl Pattern");
                  setShowAutofillDropdown(false);
                },
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  background: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "14px"
                },
                onMouseEnter: (e) => e.target.style.background = "#f3f4f6",
                onMouseLeave: (e) => e.target.style.background = "transparent"
              },
              React.createElement("i", { className: "fas fa-venus-mars", style: { width: "16px" } }),
              "Boy-Girl Pattern"
            )
          )
        ),
        
        // View dropdown
        React.createElement(
          "div",
          { className: "dropdown", style: { position: "relative" } },
          React.createElement(
            "button",
            {
              className: "btn btn-sm btn-secondary dropdown-toggle",
              onClick: () => {
                setShowViewDropdown(!showViewDropdown);
                setShowAutofillDropdown(false);
              },
              title: "View options",
            },
            React.createElement("i", { className: "fas fa-eye" }),
            " View ",
            React.createElement("i", { className: "fas fa-caret-down" })
          ),
          showViewDropdown && React.createElement(
            "div",
            { 
              className: "dropdown-menu show",
              style: {
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "4px",
                minWidth: "160px",
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                zIndex: 1000
              }
            },
            React.createElement(
              "button",
              {
                className: "dropdown-item",
                onClick: () => {
                  setHighlightMode("none");
                  setShowViewDropdown(false);
                },
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  background: highlightMode === "none" ? "#e0f2fe" : "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "14px"
                },
                onMouseEnter: (e) => { if (highlightMode !== "none") e.target.style.background = "#f3f4f6"; },
                onMouseLeave: (e) => { if (highlightMode !== "none") e.target.style.background = "transparent"; }
              },
              React.createElement("i", { className: "fas fa-check", style: { width: "16px", opacity: highlightMode === "none" ? 1 : 0 } }),
              "Normal"
            ),
            React.createElement(
              "button",
              {
                className: "dropdown-item",
                onClick: () => {
                  setHighlightMode("gender");
                  setShowViewDropdown(false);
                },
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  background: highlightMode === "gender" ? "#e0f2fe" : "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "14px"
                },
                onMouseEnter: (e) => { if (highlightMode !== "gender") e.target.style.background = "#f3f4f6"; },
                onMouseLeave: (e) => { if (highlightMode !== "gender") e.target.style.background = "transparent"; }
              },
              React.createElement("i", { className: "fas fa-check", style: { width: "16px", opacity: highlightMode === "gender" ? 1 : 0 } }),
              "Gender"
            ),
            React.createElement(
              "button",
              {
                className: "dropdown-item",
                onClick: () => {
                  setHighlightMode("previous");
                  setShowViewDropdown(false);
                },
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  background: highlightMode === "previous" ? "#e0f2fe" : "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "14px"
                },
                onMouseEnter: (e) => { if (highlightMode !== "previous") e.target.style.background = "#f3f4f6"; },
                onMouseLeave: (e) => { if (highlightMode !== "previous") e.target.style.background = "transparent"; }
              },
              React.createElement("i", { className: "fas fa-check", style: { width: "16px", opacity: highlightMode === "previous" ? 1 : 0 } }),
              "Previous"
            )
          )
        ),
        
        // Action buttons (Save, Reset, Cancel)
        React.createElement(
          "div",
          { 
            className: "toolbar-actions",
            style: { 
              display: "flex", 
              gap: "0.5rem", 
              marginLeft: "1rem",
              borderLeft: "1px solid #e5e7eb",
              paddingLeft: "1rem"
            }
          },
          React.createElement(
            "button",
            {
              className: "btn btn-sm btn-primary",
              style: hasUnsavedChanges ? { backgroundColor: "#10b981", borderColor: "#10b981" } : {},
              onClick: handleSave,
              disabled: saving,
            },
            React.createElement("i", { className: "fas fa-save" }),
            saving ? " Saving..." : " Save"
          ),
          React.createElement(
            "button",
            {
              className: "btn btn-sm btn-secondary",
              onClick: handleReset,
            },
            React.createElement("i", { className: "fas fa-undo" }),
            " Reset"
          ),
          React.createElement(
            "button",
            {
              className: "btn btn-sm btn-secondary",
              onClick: () => {
                if (hasUnsavedChanges) {
                  if (window.confirm("You have unsaved changes. Are you sure you want to leave?")) {
                    onBack();
                  }
                } else {
                  onBack();
                }
              },
            },
            React.createElement("i", { className: "fas fa-times" }),
            " Cancel"
          )
        )
      )
    ),

    // Main content area with canvas on left, pool on right
    React.createElement(
      "div",
      { className: "editor-main-area" },

      React.createElement(
        "div",
        { className: "editor-content-wrapper" },

        // Canvas section (left)
        React.createElement(
          "div",
          { className: "editor-canvas-section" },
          React.createElement(
            "div",
            { className: "seating-canvas-container" },
            React.createElement(SeatingCanvas, {
              layout: layout,
              assignments: assignments,
              students: students,
              highlightMode: highlightMode,
              onSeatClick: (tableId, seatNumber) => {
                // existing code
              },
              onStudentDrop: handleSeatAssignment,
              onStudentUnassign: handleSeatUnassignment,
              onStudentSwap: handleSeatSwap,
              draggedStudent: draggedStudent,
              onDragStart: setDraggedStudent,
              onDragEnd: () => setDraggedStudent(null),
            })
          )
        ),

        // Student pool (right side)
        React.createElement(StudentPool, {
          students: getUnassignedStudents(),
          selectedStudent: selectedStudent,
          onSelectStudent: setSelectedStudent,
          onDragStart: setDraggedStudent,
          onDragEnd: () => setDraggedStudent(null),
          onStudentReturn: handleSeatUnassignment,
        })
      )
    )
  );
};

// Canvas component for seating
const SeatingCanvas = ({
  layout,
  assignments,
  students,
  highlightMode,
  onSeatClick,
  onStudentDrop,
  onStudentUnassign,
  onStudentSwap, // ADD THIS LINE
  draggedStudent,
  onDragStart,
  onDragEnd,
}) => {
  // Get shared styles
  const { LayoutStyles } = window;
  const gridSize = 80; // Grid size for editor
  
  // This will render the layout with students assigned to seats
  return React.createElement(
    "div",
    {
      className: `seating-canvas ${draggedStudent ? "drag-active" : ""}`,
      style: LayoutStyles.getCanvasContainerStyle(layout.room_width, layout.room_height, gridSize),
    },

    // Grid background (optional)
    React.createElement("div", { style: LayoutStyles.getGridStyle(gridSize) }),

    // Render obstacles
    layout.obstacles?.map((obstacle) =>
      React.createElement(
        "div",
        {
          key: obstacle.id,
          style: LayoutStyles.getObstacleStyle(obstacle, false, false, gridSize),
        },
        React.createElement(
          "div",
          { style: LayoutStyles.getObstacleLabelStyle() },
          obstacle.name
        )
      )
    ),

    // Render tables with seats
    layout.tables?.map((table) =>
      React.createElement(
        "div",
        {
          key: table.id,
          className: "seating-table",
          style: LayoutStyles.getTableStyle(table, false, false, gridSize),
        },

        // Table label - using shared style
        React.createElement(
          "div",
          { style: LayoutStyles.getTableLabelStyle() },
          String(table.table_number)
        )
        ,

        // Render seats
        table.seats?.map((seat) => {
          const seatKey = String(seat.seat_number);
          const assignedStudentId = assignments[table.id]?.[seatKey];
          const assignedStudent = assignedStudentId
            ? students.find((s) => s.id === assignedStudentId)
            : null;

          // Debug: Check if we have a student ID but can't find the student
          if (assignedStudentId && !assignedStudent) {
            console.warn(
              `Student ${assignedStudentId} assigned to seat ${table.id}-${seatKey} but not found in students array`
            );
          }

          // Use shared seat styles
          const seatStyle = LayoutStyles.getSeatStyle(seat, {
            isOccupied: !!assignedStudent,
            isSelected: false,
            isAccessible: seat.is_accessible,
            gridSize: gridSize,
            showName: !!assignedStudent
          });

          // Force empty seat colors from shared styles
          if (!assignedStudent) {
            seatStyle.backgroundColor = '#e0f2fe';  // Very light blue
            seatStyle.borderColor = '#7dd3fc';      // Light blue border
            seatStyle.color = '#0284c7';            // Blue text
          }

          // Override background color for gender highlighting if needed
          if (assignedStudent && highlightMode === "gender") {
            seatStyle.backgroundColor = assignedStudent.gender === "F" 
              ? "#fbbf24"  // Yellow for female
              : "#60a5fa"; // Blue for male
            seatStyle.borderColor = assignedStudent.gender === "F"
              ? "#f59e0b"
              : "#3b82f6";
          }

          return React.createElement(
            "div",
            {
              key: seat.seat_number,
              className: `seat ${assignedStudent ? "occupied" : "empty"} ${
                seat.is_accessible ? "accessible" : ""
              }`,
              style: {
                ...seatStyle,
                cursor: "pointer",
              },
              onClick: () => onSeatClick(table.id, seat.seat_number),

              // ADD THESE NEW PROPERTIES FOR DRAGGING:
              draggable: assignedStudent ? true : false,
              onDragStart: assignedStudent
                ? (e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("studentId", assignedStudent.id.toString());
                    e.dataTransfer.setData("sourceType", "seat");
                    e.dataTransfer.setData("sourceTableId", table.id.toString());
                    e.dataTransfer.setData("sourceSeatNumber", seat.seat_number.toString());

                    // Visual feedback
                    e.currentTarget.classList.add("dragging");

                    // Update parent state
                    if (onDragStart) onDragStart(assignedStudent);
                  }
                : undefined,
              onDragEnd: assignedStudent
                ? (e) => {
                    e.currentTarget.classList.remove("dragging");
                    if (onDragEnd) onDragEnd();
                  }
                : undefined,
              onDragOver: (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";

                const sourceType = e.dataTransfer.getData("sourceType");

                // Add different classes for different operations
                if (assignedStudent && sourceType === "seat") {
                  e.currentTarget.classList.add("drag-over", "swap-target");
                } else {
                  e.currentTarget.classList.add("drag-over");
                }
              },
              onDragLeave: (e) => {
                e.currentTarget.classList.remove("drag-over", "swap-target");
              },
              onDrop: (e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("drag-over");

                const studentId = parseInt(e.dataTransfer.getData("studentId"));
                const sourceType = e.dataTransfer.getData("sourceType");

                console.log("onDrop:", {
                  studentId,
                  sourceType,
                  sourceTypeIsString: typeof sourceType,
                  assignedStudent: assignedStudent ? assignedStudent.id : null,
                  assignedStudentTruthy: !!assignedStudent,
                  targetSeat: `${table.id}-${seat.seat_number}`,
                  willSwap: sourceType === "seat" && assignedStudent,
                });

                if (!studentId) {
                  console.log("No studentId - returning");
                  return;
                }

                // If dropping on an empty seat
                if (!assignedStudent) {
                  console.log("Branch: Empty seat");
                  // If the student is being moved from another seat, remove them first
                  if (sourceType === "seat") {
                    const sourceTableId = parseInt(e.dataTransfer.getData("sourceTableId"));
                    const sourceSeatNumber = e.dataTransfer.getData("sourceSeatNumber"); // Keep as string!

                    // First unassign from the original seat
                    onStudentUnassign(sourceTableId, sourceSeatNumber);
                  }

                  // Then assign to the new seat (ensure seat number is a string)
                  onStudentDrop(studentId, table.id, String(seat.seat_number));
                }
                // If dropping on an occupied seat AND coming from another seat = SWAP!
                else if (sourceType === "seat" && assignedStudent) {
                  console.log("Branch: Seat-to-seat SWAP");
                  const sourceTableId = parseInt(e.dataTransfer.getData("sourceTableId"));
                  const sourceSeatNumber = e.dataTransfer.getData("sourceSeatNumber"); // Keep as string!

                  console.log("Swap scenario detected:", {
                    sourceTableId,
                    sourceSeatNumber,
                    sourceSeatNumberType: typeof sourceSeatNumber,
                    targetTableId: table.id,
                    targetSeatNumber: seat.seat_number,
                    targetSeatNumberType: typeof seat.seat_number,
                  });

                  // Don't swap with self (compare as strings to handle type differences)
                  if (
                    sourceTableId === table.id &&
                    String(sourceSeatNumber) === String(seat.seat_number)
                  ) {
                    console.log("Attempting to swap with self - canceling");
                    return;
                  }

                  // Perform the swap (ensure seat numbers are strings)
                  console.log("Calling onStudentSwap");
                  onStudentSwap(
                    studentId, // Student A (being dragged)
                    sourceTableId, // Student A's original table
                    sourceSeatNumber, // Student A's original seat (already string)
                    assignedStudent.id, // Student B (in target seat)
                    table.id, // Student B's table
                    String(seat.seat_number) // Student B's seat (convert to string)
                  );
                }
                // If dropping from pool onto occupied seat - bump the seated student back to pool
                else if (sourceType === "pool" && assignedStudent) {
                  console.log("Branch: Pool-to-occupied-seat (bump)");
                  // First unassign the current student (send them back to pool)
                  onStudentUnassign(table.id, String(seat.seat_number));

                  // Then assign the new student to this seat (ensure seat number is a string)
                  onStudentDrop(studentId, table.id, String(seat.seat_number));
                }
                // Any other case (shouldn't happen with our current logic)
                else {
                  console.warn("Unexpected drop scenario");
                }
              },
              title: assignedStudent
                ? `${assignedStudent.first_name} ${assignedStudent.last_name}`
                : `Seat ${seat.seat_number}`,
            },
            assignedStudent
              ? (() => {
                  const { line1, line2 } = LayoutStyles.formatSeatName(
                    assignedStudent.first_name,
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

// Sidebar component
const SeatingEditorSidebar = ({
  classInfo,
  totalStudents,
  assignedCount,
  highlightMode,
  onHighlightModeChange,
  onAutoFill,
  onSave,
  onCancel,
  saving,
}) => {
  return React.createElement(
    "div",
    { className: "editor-right-sidebar" },

    // Class info
    React.createElement(
      "div",
      { className: "sidebar-section" },
      React.createElement("h3", null, "Class Information"),
      React.createElement(
        "p",
        null,
        React.createElement("strong", null, "Class: "),
        classInfo?.name
      ),
      React.createElement(
        "p",
        null,
        React.createElement("strong", null, "Subject: "),
        classInfo?.subject || "N/A"
      ),
      React.createElement(
        "p",
        null,
        React.createElement("strong", null, "Teacher: "),
        classInfo?.teacher_name || "N/A"
      ),
      React.createElement(
        "p",
        null,
        React.createElement("strong", null, "Students: "),
        `${assignedCount} / ${totalStudents} seated`
      )
    ),

    // Auto-fill options
    React.createElement(
      "div",
      { className: "sidebar-section" },
      React.createElement("h3", null, "Auto-Fill Options"),
      React.createElement(
        "div",
        { className: "auto-fill-buttons" },
        React.createElement(
          "button",
          {
            className: "btn btn-sm btn-outline",
            onClick: () => onAutoFill("alphabetical"),
          },
          React.createElement("i", { className: "fas fa-sort-alpha-down" }),
          " Alphabetical"
        ),
        React.createElement(
          "button",
          {
            className: "btn btn-sm btn-outline",
            onClick: () => onAutoFill("random"),
          },
          React.createElement("i", { className: "fas fa-random" }),
          " Random"
        ),
        React.createElement(
          "button",
          {
            className: "btn btn-sm btn-outline",
            onClick: () => onAutoFill("boy-girl"),
          },
          React.createElement("i", { className: "fas fa-venus-mars" }),
          " Boy-Girl"
        )
      )
    ),

    // View options
    React.createElement(
      "div",
      { className: "sidebar-section" },
      React.createElement("h3", null, "View Options"),
      React.createElement(
        "label",
        { className: "radio-label" },
        React.createElement("input", {
          type: "radio",
          name: "highlight",
          checked: highlightMode === "none",
          onChange: () => onHighlightModeChange("none"),
        }),
        " Normal View"
      ),
      React.createElement(
        "label",
        { className: "radio-label" },
        React.createElement("input", {
          type: "radio",
          name: "highlight",
          checked: highlightMode === "gender",
          onChange: () => onHighlightModeChange("gender"),
        }),
        " Highlight by Gender"
      ),
      React.createElement(
        "label",
        { className: "radio-label" },
        React.createElement("input", {
          type: "radio",
          name: "highlight",
          checked: highlightMode === "previous",
          onChange: () => onHighlightModeChange("previous"),
        }),
        " Show Previous Partners"
      )
    ),

    // Actions
    React.createElement(
      "div",
      { className: "sidebar-section mt-auto" },
      React.createElement(
        "button",
        {
          className: "btn btn-primary btn-block mb-2",
          onClick: onSave, // Simple direct call
          disabled: saving,
        },
        React.createElement("i", { className: "fas fa-save" }),
        saving ? " Saving..." : " Save Seating Chart"
      ),
      React.createElement(
        "button",
        {
          className: "btn btn-secondary btn-block",
          onClick: onCancel,
        },
        "Cancel"
      )
    )
  );
};

// Student pool component
// Replace the StudentPool component in SeatingEditor.js with this enhanced version:

const StudentPool = ({
  students,
  selectedStudent,
  onSelectStudent,
  onDragStart,
  onDragEnd,
  onStudentReturn, // NEW PROP
}) => {
  return React.createElement(
    "div",
    {
      className: "student-pool",
      // NEW DRAG HANDLERS FOR ACCEPTING DROPS:
      onDragOver: (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        // Add visual feedback
        e.currentTarget.classList.add("drag-over");
      },
      onDragLeave: (e) => {
        // Remove visual feedback
        e.currentTarget.classList.remove("drag-over");
      },
      onDrop: (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove("drag-over");

        // Get the drag data
        const studentId = parseInt(e.dataTransfer.getData("studentId"));
        const sourceType = e.dataTransfer.getData("sourceType");

        // Only accept drops from seats, not from the pool itself
        if (studentId && sourceType === "seat") {
          const sourceTableId = parseInt(e.dataTransfer.getData("sourceTableId"));
          const sourceSeatNumber = parseInt(e.dataTransfer.getData("sourceSeatNumber"));

          // Call the handler to unassign the student
          onStudentReturn(sourceTableId, sourceSeatNumber);
        }
      },
    },

    // Header
    React.createElement(
      "div",
      { className: "pool-header" },
      React.createElement("h3", null, `Unassigned Students (${students.length})`),
      React.createElement(
        "select",
        { className: "pool-sort" },
        React.createElement("option", null, "Sort: A-Z"),
        React.createElement("option", null, "Sort: Z-A"),
        React.createElement("option", null, "Sort: Random")
      )
    ),

    // Student grid
    React.createElement(
      "div",
      { className: "student-grid" },
      students.map((student) =>
        React.createElement(
          "div",
          {
            key: student.id,
            className: `student-card ${
              selectedStudent?.id === student.id ? "selected" : ""
            } ${student.gender === "F" ? "female" : "male"}`,
            onClick: () => onSelectStudent(student),
            draggable: true,
            onDragStart: (e) => {
              // Set the data that will be transferred
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("studentId", student.id.toString());
              e.dataTransfer.setData("sourceType", "pool"); // Mark as from pool

              // Call the parent's drag start handler
              onDragStart(student);

              // Add visual feedback
              e.currentTarget.classList.add("dragging");
            },
            onDragEnd: (e) => {
              // Remove visual feedback
              e.currentTarget.classList.remove("dragging");

              // Call the parent's drag end handler
              onDragEnd();
            },
          },
          React.createElement(
            "div",
            { className: "student-card-name" },
            formatStudentName(student.first_name, student.last_name)
          )
        )
      )
    )
  );
};

// Export
if (typeof window !== "undefined") {
  window.SeatingEditor = SeatingEditor;
}
