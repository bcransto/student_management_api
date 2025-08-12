// frontend/seating/SeatingEditor.js
// Integrated Seating Chart Editor

const { useState, useEffect } = React;

const SeatingEditor = ({ classId, onBack, onView }) => {
  // Get utility functions from shared module
  const { formatStudentName, formatStudentNameTwoLine, formatDate } = window.SharedUtils;
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
  const [studentSortBy, setStudentSortBy] = useState("name"); // "name" or "gender"
  const [deactivatedSeats, setDeactivatedSeats] = useState(new Set()); // Track deactivated seats
  const [isViewingCurrentPeriod, setIsViewingCurrentPeriod] = useState(true); // Track if viewing the actual current period

  // Load initial data
  useEffect(() => {
    loadClassData();
    // Clear deactivated seats when class changes
    setDeactivatedSeats(new Set());
    console.log("Cleared deactivated seats - class changed");
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

  // Clear deactivated seats when viewing non-current periods
  useEffect(() => {
    if (!isViewingCurrentPeriod) {
      // Clear deactivated seats when viewing historical periods
      setDeactivatedSeats(new Set());
      console.log("Cleared deactivated seats - viewing historical period");
    }
  }, [isViewingCurrentPeriod]);

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

      // Check if we're viewing the actual current period (one with no end_date)
      const viewingCurrent = classData.current_seating_period && 
                             classData.current_seating_period.end_date === null;
      setIsViewingCurrentPeriod(viewingCurrent);
      console.log(`Viewing current period: ${viewingCurrent}, Period end_date: ${classData.current_seating_period?.end_date}`);
      
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
    setAssignments((prev) => {
      const newAssignments = { ...prev };

      // Special case: if swapping within the same table, handle it differently
      if (tableA === tableB) {
        // Just swap the values directly without deleting the table
        if (newAssignments[tableA]) {
          const tempStudent = newAssignments[tableA][seatA];
          newAssignments[tableA][seatA] = newAssignments[tableA][seatB];
          newAssignments[tableA][seatB] = tempStudent;
        }
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
        periods.map((p) => ({ id: p.id, name: p.name, active: p.end_date === null }))
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

      // Update end_date to make periods current/not current
      // First, end the current period if it exists
      if (currentPeriodId) {
        await window.ApiModule.request(`/seating-periods/${currentPeriodId}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            end_date: new Date().toISOString().split("T")[0],
          }),
        });
      }
      
      // Then make the target period current by clearing its end_date
      await window.ApiModule.request(`/seating-periods/${targetPeriod.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          end_date: null,
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

      // Get or create seating period
      let seatingPeriodId;
      if (classInfo.current_seating_period) {
        seatingPeriodId = classInfo.current_seating_period.id;
      } else {

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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            class_assigned: classId,
            layout: layout.id, // Now required!
            name: `Seating Chart - ${new Date().toLocaleDateString()}`,
            start_date: new Date().toISOString().split("T")[0],
            end_date: null,
            notes: "Created from seating chart editor",
          }),
        });
        seatingPeriodId = newPeriod.id;
      }

      // Clear existing assignments ONLY for the current period
      console.log(`Checking for existing assignments for period ${seatingPeriodId}`);
      const currentAssignments = await window.ApiModule.request(
        `/seating-assignments/?seating_period=${seatingPeriodId}`
      );

      if (currentAssignments.results && currentAssignments.results.length > 0) {
        console.log(`Found ${currentAssignments.results.length} existing assignments to delete`);
        // Delete all assignments for this period
        for (const assignment of currentAssignments.results) {
          console.log(`Deleting assignment ${assignment.id}`);
          // The API already filtered by seating_period, so all these belong to our period
          await window.ApiModule.request(`/seating-assignments/${assignment.id}/`, {
            method: "DELETE",
          });
        }
        console.log("All existing assignments deleted");
      } else {
        console.log("No existing assignments found");
      }

      // Create new assignments
      const assignmentsToCreate = [];

      Object.keys(assignments).forEach((tableId) => {
        const tableAssignments = assignments[tableId];
        const table = layout.tables.find((t) => t.id == tableId);
        if (!table) {
          console.warn(`Table with id ${tableId} not found in layout`);
          return;
        }

        Object.keys(tableAssignments).forEach((seatNumber) => {
          const studentId = tableAssignments[seatNumber];
          const rosterEntry = classInfo.roster.find((r) => r.student == studentId);
          if (!rosterEntry) {
            console.warn(`Roster entry not found for student ${studentId}`);
            return;
          }

          assignmentsToCreate.push({
            seating_period: seatingPeriodId,
            roster_entry: rosterEntry.id,
            seat_id: `${table.table_number}-${seatNumber}`,
          });
        });
      });

      console.log(`Creating ${assignmentsToCreate.length} new assignments`);
      console.log("Assignment data:", assignmentsToCreate);

      // Create all assignments
      const createdAssignments = [];
      for (const assignmentData of assignmentsToCreate) {
        console.log("Creating assignment:", assignmentData);
        try {
          const created = await window.ApiModule.request("/seating-assignments/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(assignmentData),
          });
          createdAssignments.push(created);
          console.log("Successfully created assignment");
        } catch (error) {
          console.error("Failed to create assignment:", assignmentData);
          console.error("Error details:", error);
          throw error;
        }
      }

      alert(`✅ Seating chart saved successfully! ${createdAssignments.length} students assigned.`);

      // Mark as saved
      setHasUnsavedChanges(false);
      setInitialAssignments(assignments);

      // Stay in editor after saving - removed: if (onBack) onBack();
    } catch (error) {
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

  // Autofill helper functions
  const getAvailableSeats = () => {
    const availableSeats = [];
    if (!layout || !layout.tables) return availableSeats;
    
    layout.tables.forEach(table => {
      if (!table.seats) return;
      table.seats.forEach(seat => {
        // Check if seat is not already occupied
        if (!assignments[table.id] || !assignments[table.id][String(seat.seat_number)]) {
          availableSeats.push({
            tableId: table.id,
            seatNumber: String(seat.seat_number),
            table: table,
            seat: seat
          });
        }
      });
    });
    
    return availableSeats;
  };
  
  const handleAutofillAlphabetical = () => {
    const availableSeats = getAvailableSeats();
    const unassignedStudents = getUnassignedStudents();
    
    if (availableSeats.length === 0) {
      alert("No available seats to fill");
      return;
    }
    
    if (unassignedStudents.length === 0) {
      alert("All students are already assigned");
      return;
    }
    
    // Sort students alphabetically by nickname or first name, then last name
    const sortedStudents = [...unassignedStudents].sort((a, b) => {
      const nameA = `${a.nickname || a.first_name} ${a.last_name}`.toLowerCase();
      const nameB = `${b.nickname || b.first_name} ${b.last_name}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    // Sort seats by table number then seat number for consistent placement
    const sortedSeats = [...availableSeats].sort((a, b) => {
      if (a.table.table_number !== b.table.table_number) {
        return a.table.table_number - b.table.table_number;
      }
      return parseInt(a.seatNumber) - parseInt(b.seatNumber);
    });
    
    // Assign students to available seats
    const newAssignments = { ...assignments };
    const studentsToAssign = Math.min(sortedStudents.length, sortedSeats.length);
    
    for (let i = 0; i < studentsToAssign; i++) {
      const seat = sortedSeats[i];
      const student = sortedStudents[i];
      
      if (!newAssignments[seat.tableId]) {
        newAssignments[seat.tableId] = {};
      }
      newAssignments[seat.tableId][seat.seatNumber] = student.id;
    }
    
    setAssignments(newAssignments);
    setHasUnsavedChanges(true);
    
    alert(`Assigned ${studentsToAssign} students alphabetically to available seats`);
  };
  
  const handleAutofillRandom = () => {
    const availableSeats = getAvailableSeats();
    const unassignedStudents = getUnassignedStudents();
    
    if (availableSeats.length === 0) {
      alert("No available seats to fill");
      return;
    }
    
    if (unassignedStudents.length === 0) {
      alert("All students are already assigned");
      return;
    }
    
    // Shuffle students randomly
    const shuffledStudents = [...unassignedStudents].sort(() => Math.random() - 0.5);
    
    // Shuffle seats randomly
    const shuffledSeats = [...availableSeats].sort(() => Math.random() - 0.5);
    
    // Assign students to available seats
    const newAssignments = { ...assignments };
    const studentsToAssign = Math.min(shuffledStudents.length, shuffledSeats.length);
    
    for (let i = 0; i < studentsToAssign; i++) {
      const seat = shuffledSeats[i];
      const student = shuffledStudents[i];
      
      if (!newAssignments[seat.tableId]) {
        newAssignments[seat.tableId] = {};
      }
      newAssignments[seat.tableId][seat.seatNumber] = student.id;
    }
    
    setAssignments(newAssignments);
    setHasUnsavedChanges(true);
    
    alert(`Randomly assigned ${studentsToAssign} students to available seats`);
  };
  
  const handleAutofillBoyGirl = () => {
    const availableSeats = getAvailableSeats();
    const unassignedStudents = getUnassignedStudents();
    
    if (availableSeats.length === 0) {
      alert("No available seats to fill");
      return;
    }
    
    if (unassignedStudents.length === 0) {
      alert("All students are already assigned");
      return;
    }
    
    // Separate students by gender (database uses lowercase values)
    const boys = unassignedStudents.filter(s => s.gender === 'male' || s.gender === 'Male' || s.gender === 'M');
    const girls = unassignedStudents.filter(s => s.gender === 'female' || s.gender === 'Female' || s.gender === 'F');
    const others = unassignedStudents.filter(s => !['male', 'Male', 'M', 'female', 'Female', 'F'].includes(s.gender));
    
    console.log("Boy-Girl Autofill Debug:");
    console.log(`Unassigned students: ${unassignedStudents.length}`);
    console.log(`Boys: ${boys.length}`, boys.map(s => `${s.first_name} (${s.gender})`));
    console.log(`Girls: ${girls.length}`, girls.map(s => `${s.first_name} (${s.gender})`));
    console.log(`Others: ${others.length}`, others.map(s => `${s.first_name} (${s.gender})`));
    
    // Sort each group alphabetically
    boys.sort((a, b) => `${a.nickname || a.first_name} ${a.last_name}`.localeCompare(`${b.nickname || b.first_name} ${b.last_name}`));
    girls.sort((a, b) => `${a.nickname || a.first_name} ${a.last_name}`.localeCompare(`${b.nickname || b.first_name} ${b.last_name}`));
    others.sort((a, b) => `${a.nickname || a.first_name} ${a.last_name}`.localeCompare(`${b.nickname || b.first_name} ${b.last_name}`));
    
    // Sort seats by table then seat number
    const sortedSeats = [...availableSeats].sort((a, b) => {
      if (a.table.table_number !== b.table.table_number) {
        return a.table.table_number - b.table.table_number;
      }
      return parseInt(a.seatNumber) - parseInt(b.seatNumber);
    });
    
    // Create alternating pattern
    const orderedStudents = [];
    let boyIndex = 0, girlIndex = 0, otherIndex = 0;
    let lastWasBoy = false;
    
    // Alternate between boys and girls, then add others
    while (boyIndex < boys.length || girlIndex < girls.length) {
      if (lastWasBoy && girlIndex < girls.length) {
        orderedStudents.push(girls[girlIndex++]);
        lastWasBoy = false;
      } else if (!lastWasBoy && boyIndex < boys.length) {
        orderedStudents.push(boys[boyIndex++]);
        lastWasBoy = true;
      } else if (boyIndex < boys.length) {
        orderedStudents.push(boys[boyIndex++]);
      } else if (girlIndex < girls.length) {
        orderedStudents.push(girls[girlIndex++]);
      }
    }
    
    console.log("Alternating pattern created:");
    console.log(orderedStudents.map(s => `${s.first_name} (${s.gender})`).join(", "));
    
    // Add students without gender specification at the end
    while (otherIndex < others.length) {
      orderedStudents.push(others[otherIndex++]);
    }
    
    // Assign students to seats
    const newAssignments = { ...assignments };
    const studentsToAssign = Math.min(orderedStudents.length, sortedSeats.length);
    
    for (let i = 0; i < studentsToAssign; i++) {
      const seat = sortedSeats[i];
      const student = orderedStudents[i];
      
      if (!newAssignments[seat.tableId]) {
        newAssignments[seat.tableId] = {};
      }
      newAssignments[seat.tableId][seat.seatNumber] = student.id;
    }
    
    setAssignments(newAssignments);
    setHasUnsavedChanges(true);
    
    alert(`Assigned ${studentsToAssign} students in boy-girl pattern to available seats`);
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
        )
      )
    ),

    // Main content area with left sidebar, canvas in center, pool on right
    React.createElement(
      "div",
      { className: "editor-main-area" },

      React.createElement(
        "div",
        { className: "editor-content-wrapper" },

        // Left sidebar with controls
        React.createElement(
          "div",
          { className: "editor-left-sidebar" },
          
          // Actions section with Save/Reset
          React.createElement(
            "div",
            { className: "sidebar-section", style: { borderBottom: "1px solid #e5e7eb" } },
            React.createElement("h3", null, "Actions"),
            React.createElement(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "0.5rem" } },
              React.createElement(
                "button",
                {
                  className: "btn btn-sm",
                  style: { 
                    width: "100%",
                    ...(hasUnsavedChanges ? { backgroundColor: "#10b981", borderColor: "#10b981", color: "white" } : {})
                  },
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
                  style: { width: "100%" },
                  onClick: handleReset,
                },
                React.createElement("i", { className: "fas fa-undo" }),
                " Reset"
              )
            )
          ),
          
          // Help text for seat deactivation - only show for current period
          isViewingCurrentPeriod && React.createElement(
            "div",
            { 
              className: "sidebar-section", 
              style: { 
                borderBottom: "1px solid #e5e7eb",
                padding: "10px",
                backgroundColor: "#fef3c7",
                fontSize: "12px"
              } 
            },
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "5px" } },
              React.createElement("i", { className: "fas fa-info-circle", style: { color: "#f59e0b" } }),
              React.createElement("strong", null, "Tip:")
            ),
            React.createElement(
              "div",
              { style: { marginTop: "5px" } },
              "Hold Shift + Click on any seat to block/unblock it. Blocked seats cannot be assigned."
            ),
            deactivatedSeats.size > 0 && React.createElement(
              "div",
              { style: { marginTop: "5px", color: "#dc2626" } },
              `${deactivatedSeats.size} seat(s) blocked`
            )
          ),
          
          // Notice for historical periods
          !isViewingCurrentPeriod && React.createElement(
            "div",
            { 
              className: "sidebar-section", 
              style: { 
                borderBottom: "1px solid #e5e7eb",
                padding: "10px",
                backgroundColor: "#dbeafe",
                fontSize: "12px"
              } 
            },
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "5px" } },
              React.createElement("i", { className: "fas fa-history", style: { color: "#2563eb" } }),
              React.createElement("strong", null, "Historical Period")
            ),
            React.createElement(
              "div",
              { style: { marginTop: "5px" } },
              "You are viewing a past seating period. Seat deactivation is not available for historical periods."
            )
          ),
          
          // Layout selector
          React.createElement(
            "div",
            { className: "sidebar-section", style: { borderBottom: "1px solid #e5e7eb" } },
            React.createElement("h3", null, "Layout"),
            React.createElement(
              "button",
              {
                className: "btn btn-sm btn-secondary",
                style: { width: "100%" },
                onClick: () => alert("Layout selector coming soon"),
                title: "Select classroom layout",
              },
              React.createElement("i", { className: "fas fa-th" }),
              " Select Layout"
            )
          ),
          
          // Auto-fill section
          React.createElement(
            "div",
            { className: "sidebar-section", style: { borderBottom: "1px solid #e5e7eb" } },
            React.createElement("h3", null, "Auto-fill"),
            React.createElement(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "0.5rem" } },
              React.createElement(
                "button",
                {
                  className: "btn btn-sm btn-secondary",
                  style: { width: "100%", fontSize: "12px" },
                  onClick: handleAutofillAlphabetical,
                },
                React.createElement("i", { className: "fas fa-sort-alpha-down", style: { fontSize: "10px" } }),
                " ABC"
              ),
              React.createElement(
                "button",
                {
                  className: "btn btn-sm btn-secondary",
                  style: { width: "100%", fontSize: "12px" },
                  onClick: handleAutofillRandom,
                },
                React.createElement("i", { className: "fas fa-random", style: { fontSize: "10px" } }),
                " Random"
              ),
              React.createElement(
                "button",
                {
                  className: "btn btn-sm btn-secondary",
                  style: { width: "100%", fontSize: "12px" },
                  onClick: handleAutofillBoyGirl,
                },
                React.createElement("i", { className: "fas fa-venus-mars", style: { fontSize: "10px" } }),
                " Boy-Girl"
              )
            )
          ),
          
          // View options section
          React.createElement(
            "div",
            { className: "sidebar-section" },
            React.createElement("h3", null, "View"),
            React.createElement(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "0.5rem" } },
              React.createElement(
                "button",
                {
                  className: `btn btn-sm ${highlightMode === "none" ? "btn-primary" : "btn-secondary"}`,
                  style: { width: "100%", fontSize: "12px" },
                  onClick: () => {
                    console.log("Normal button clicked, setting highlightMode to 'none'");
                    setHighlightMode("none");
                  },
                },
                React.createElement("i", { className: "fas fa-eye", style: { fontSize: "10px" } }),
                " Normal"
              ),
              React.createElement(
                "button",
                {
                  className: `btn btn-sm ${highlightMode === "gender" ? "btn-primary" : "btn-secondary"}`,
                  style: { width: "100%", fontSize: "12px" },
                  onClick: () => {
                    console.log("Gender button clicked, setting highlightMode to 'gender'");
                    setHighlightMode("gender");
                  },
                },
                React.createElement("i", { className: "fas fa-venus-mars", style: { fontSize: "10px" } }),
                " Gender"
              ),
              React.createElement(
                "button",
                {
                  className: `btn btn-sm ${highlightMode === "previous" ? "btn-primary" : "btn-secondary"}`,
                  style: { width: "100%", fontSize: "12px" },
                  onClick: () => setHighlightMode("previous"),
                },
                React.createElement("i", { className: "fas fa-history", style: { fontSize: "10px" } }),
                " Previous"
              )
            )
          )
        ),

        // Canvas section (center)
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
              onSeatClick: (tableId, seatNumber, event) => {
                const seatId = `${tableId}-${seatNumber}`;
                const isModifierPressed = event && event.shiftKey;
                
                if (isModifierPressed && isViewingCurrentPeriod) {
                  // Only allow deactivation when viewing the current period
                  console.log(`Shift+click on seat ${seatId}`);
                  
                  const newDeactivatedSeats = new Set(deactivatedSeats);
                  
                  if (deactivatedSeats.has(seatId)) {
                    // Reactivate the seat
                    newDeactivatedSeats.delete(seatId);
                    console.log(`Reactivated seat ${seatId}`);
                  } else {
                    // Deactivate the seat
                    // First check if there's a student assigned
                    const tableIdStr = String(tableId);
                    const seatNumberStr = String(seatNumber);
                    
                    if (assignments[tableIdStr] && assignments[tableIdStr][seatNumberStr]) {
                      // Move student back to unassigned
                      const studentId = assignments[tableIdStr][seatNumberStr];
                      const student = students.find(s => s.id === studentId);
                      console.log(`Moving student ${student?.first_name} back to pool before deactivating seat`);
                      
                      // Remove the assignment
                      const newAssignments = { ...assignments };
                      delete newAssignments[tableIdStr][seatNumberStr];
                      if (Object.keys(newAssignments[tableIdStr]).length === 0) {
                        delete newAssignments[tableIdStr];
                      }
                      setAssignments(newAssignments);
                      setHasUnsavedChanges(true);
                    }
                    
                    // Add to deactivated seats
                    newDeactivatedSeats.add(seatId);
                    console.log(`Deactivated seat ${seatId}`);
                  }
                  
                  setDeactivatedSeats(newDeactivatedSeats);
                  console.log(`Total deactivated seats: ${newDeactivatedSeats.size}`, Array.from(newDeactivatedSeats));
                } else if (isModifierPressed && !isViewingCurrentPeriod) {
                  // Trying to deactivate in a historical period
                  console.log(`Cannot deactivate seats in historical periods`);
                  alert("Seat deactivation is only available for the current period");
                } else {
                  // Normal click - existing assignment logic would go here
                  console.log(`Normal click on seat ${seatId}`);
                }
              },
              onStudentDrop: handleSeatAssignment,
              onStudentUnassign: handleSeatUnassignment,
              onStudentSwap: handleSeatSwap,
              draggedStudent: draggedStudent,
              onDragStart: setDraggedStudent,
              onDragEnd: () => setDraggedStudent(null),
              deactivatedSeats: isViewingCurrentPeriod ? deactivatedSeats : new Set(),
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
          studentSortBy: studentSortBy,
          onSortChange: setStudentSortBy,
          highlightMode: highlightMode,
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
  deactivatedSeats,
}) => {
  // Get shared styles
  const { LayoutStyles } = window;
  const gridSize = 80; // Grid size for editor
  
  console.log("SeatingCanvas render - highlightMode:", highlightMode);
  
  // Use effect to force style updates when highlight mode changes
  React.useEffect(() => {
    if (highlightMode === "gender") {
      console.log("Applying gender styles via DOM manipulation");
      // Wait for next tick to ensure DOM is updated
      setTimeout(() => {
        // Find all occupied seats with gender classes
        const femaleSeat = document.querySelectorAll('.seat.gender-female');
        const maleSeats = document.querySelectorAll('.seat.gender-male');
        
        console.log(`Found ${femaleSeat.length} female seats and ${maleSeats.length} male seats`);
        
        femaleSeat.forEach(el => {
          console.log("Setting female seat style directly on element");
          el.style.setProperty('background-color', '#10b981', 'important');
          el.style.setProperty('border', '2px solid #059669', 'important');
          el.style.setProperty('color', 'white', 'important');
        });
        
        maleSeats.forEach(el => {
          console.log("Setting male seat style directly on element");
          el.style.setProperty('background-color', '#3b82f6', 'important');
          el.style.setProperty('border', '2px solid #2563eb', 'important');
          el.style.setProperty('color', 'white', 'important');
        });
      }, 100);
    }
  }, [highlightMode, assignments]);
  
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

          // Debug logging for gender highlighting
          if (assignedStudent && highlightMode === "gender") {
            console.log("=== Gender Highlight Debug ===");
            console.log("Assigned student full object:", assignedStudent);
            console.log(`Student: ${assignedStudent.first_name} ${assignedStudent.last_name}`);
            console.log(`Gender field value: "${assignedStudent.gender}"`);
            console.log(`Highlight mode: ${highlightMode}`);
          }

          // Debug: Check if we have a student ID but can't find the student
          if (assignedStudentId && !assignedStudent) {
            console.warn(
              `Student ${assignedStudentId} assigned to seat ${table.id}-${seatKey} but not found in students array`
            );
          }

          // Check if seat is deactivated
          const seatId = `${table.id}-${seat.seat_number}`;
          const isDeactivated = deactivatedSeats && deactivatedSeats.has(seatId);
          
          // Use shared seat styles
          const seatStyle = LayoutStyles.getSeatStyle(seat, {
            isOccupied: !!assignedStudent,
            isSelected: false,
            isAccessible: seat.is_accessible,
            gridSize: gridSize,
            showName: !!assignedStudent
          });

          // Apply deactivation styling
          if (isDeactivated) {
            seatStyle.backgroundColor = '#ef4444';  // Red background
            seatStyle.border = '2px solid #dc2626';  // Darker red border
            seatStyle.color = '#ffffff';            // White text
            seatStyle.opacity = 0.7;                // Slightly transparent
            seatStyle.cursor = 'not-allowed';       // Show it's not usable
            console.log(`Seat ${seatId} is deactivated - applying red styling`);
          } else if (!assignedStudent) {
            // Force empty seat colors from shared styles
            seatStyle.backgroundColor = '#e0f2fe';  // Very light blue
            seatStyle.border = '2px solid #7dd3fc';  // Light blue border
            seatStyle.color = '#0284c7';            // Blue text
          }

          // Determine gender class and create final styles
          let genderClass = "";
          let finalSeatStyle = {...seatStyle}; // Create a copy of the base style
          
          if (assignedStudent && highlightMode === "gender") {
            // Check for female gender (female, F or Female)
            const isFemale = assignedStudent.gender === "female" || assignedStudent.gender === "F" || assignedStudent.gender === "Female";
            console.log(`Gender highlighting applied - Student: ${assignedStudent.first_name}, Gender: "${assignedStudent.gender}", isFemale: ${isFemale}`);
            
            if (isFemale) {
              console.log("Applying FEMALE styling - green background");
              genderClass = "gender-female";
              // Override style properties in the copy
              finalSeatStyle.backgroundColor = "#10b981";  // Green
              finalSeatStyle.border = "2px solid #059669";
              finalSeatStyle.color = "white";
            } else {
              console.log("Applying MALE styling - blue background");
              genderClass = "gender-male";
              // Override style properties in the copy
              finalSeatStyle.backgroundColor = "#3b82f6";  // Blue
              finalSeatStyle.border = "2px solid #2563eb";
              finalSeatStyle.color = "white";
            }
            console.log("Gender class:", genderClass);
            console.log("Final seatStyle backgroundColor:", finalSeatStyle.backgroundColor);
            console.log("Final seatStyle border:", finalSeatStyle.border);
            console.log("Final seatStyle with gender:", finalSeatStyle);
          }

          const finalClassName = `seat ${assignedStudent ? "occupied" : "empty"} ${
            seat.is_accessible ? "accessible" : ""
          } ${genderClass}`.trim();
          
          if (genderClass) {
            console.log(`Seat ${table.id}-${seat.seat_number} final className: "${finalClassName}"`);
          }

          return React.createElement(
            "div",
            {
              key: seat.seat_number,
              className: finalClassName,
              style: {
                ...finalSeatStyle,
                cursor: "pointer",
              },
              onClick: (e) => onSeatClick(table.id, seat.seat_number, e),

              // ADD THESE NEW PROPERTIES FOR DRAGGING:
              draggable: assignedStudent && !isDeactivated ? true : false,
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
                // Don't allow drops on deactivated seats
                if (isDeactivated) {
                  e.dataTransfer.dropEffect = "none";
                  return;
                }
                
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
                // Don't allow drops on deactivated seats
                if (isDeactivated) {
                  console.log(`Cannot drop on deactivated seat ${seatId}`);
                  return;
                }
                
                e.preventDefault();
                e.currentTarget.classList.remove("drag-over");

                const studentId = parseInt(e.dataTransfer.getData("studentId"));
                const sourceType = e.dataTransfer.getData("sourceType");

                if (!studentId) {
                  return;
                }

                // If dropping on an empty seat
                if (!assignedStudent) {
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
                  const sourceTableId = parseInt(e.dataTransfer.getData("sourceTableId"));
                  const sourceSeatNumber = e.dataTransfer.getData("sourceSeatNumber"); // Keep as string!

                  // Don't swap with self (compare as strings to handle type differences)
                  if (
                    sourceTableId === table.id &&
                    String(sourceSeatNumber) === String(seat.seat_number)
                  ) {
                    return;
                  }

                  // Perform the swap (ensure seat numbers are strings)
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
              title: isDeactivated 
                ? `Seat ${seat.seat_number} - BLOCKED (Shift+click to unblock)`
                : assignedStudent
                ? `${assignedStudent.nickname || assignedStudent.first_name} ${assignedStudent.last_name}`
                : `Seat ${seat.seat_number}`,
            },
            isDeactivated
              ? React.createElement(
                  "div",
                  { style: { fontSize: "20px", fontWeight: "bold" } },
                  "✕"
                )
              : assignedStudent
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
  onStudentReturn,
  studentSortBy,
  onSortChange,
  highlightMode,
}) => {
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filter students based on search term
  const filteredStudents = React.useMemo(() => {
    if (!searchTerm) return students;
    
    const term = searchTerm.toLowerCase();
    return students.filter(student => {
      return (
        student.student_id?.toLowerCase().includes(term) ||
        student.first_name?.toLowerCase().includes(term) ||
        student.last_name?.toLowerCase().includes(term) ||
        student.nickname?.toLowerCase().includes(term) ||
        `${student.first_name} ${student.last_name}`.toLowerCase().includes(term)
      );
    });
  }, [students, searchTerm]);
  
  // Sort students based on selected sort option
  const sortedStudents = React.useMemo(() => {
    const sorted = [...filteredStudents];
    if (studentSortBy === "name") {
      sorted.sort((a, b) => {
        const nameA = `${a.nickname || a.first_name} ${a.last_name}`.toLowerCase();
        const nameB = `${b.nickname || b.first_name} ${b.last_name}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
    } else if (studentSortBy === "gender") {
      sorted.sort((a, b) => {
        // First sort by gender, then by name within gender
        if (a.gender !== b.gender) {
          return (a.gender || "").localeCompare(b.gender || "");
        }
        const nameA = `${a.nickname || a.first_name} ${a.last_name}`.toLowerCase();
        const nameB = `${b.nickname || b.first_name} ${b.last_name}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }
    return sorted;
  }, [filteredStudents, studentSortBy]);
  
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

    // Sort dropdown at top
    React.createElement(
      "div",
      { 
        className: "pool-actions",
        style: {
          padding: "1rem",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          backgroundColor: "white",
          position: "relative"
        }
      },
      React.createElement("h3", { style: { margin: "0 0 0.5rem 0", fontSize: "14px", fontWeight: "600" } }, "Student Pool"),
      
      // Search input
      React.createElement("input", {
        type: "text",
        className: "form-control",
        placeholder: "Search by name or nickname...",
        value: searchTerm,
        onChange: (e) => setSearchTerm(e.target.value),
        style: { 
          width: "100%",
          padding: "6px 10px",
          fontSize: "13px",
          marginBottom: "8px"
        }
      }),
      
      React.createElement(
        "div",
        { className: "dropdown", style: { position: "relative" } },
        React.createElement(
          "button",
          {
            className: "btn btn-sm btn-secondary dropdown-toggle",
            onClick: () => setShowSortDropdown(!showSortDropdown),
            style: { width: "100%" },
            title: "Sort students",
          },
          React.createElement("i", { className: "fas fa-sort" }),
          ` Sort: ${studentSortBy === "name" ? "Name" : "Gender"} `,
          React.createElement("i", { className: "fas fa-caret-down" })
        ),
        showSortDropdown && React.createElement(
          "div",
          { 
            className: "dropdown-menu show",
            style: {
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              marginTop: "4px",
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              zIndex: 1000
            }
          },
          React.createElement(
            "button",
            {
              className: "dropdown-item",
              onClick: () => {
                onSortChange("name");
                setShowSortDropdown(false);
              },
              style: {
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                padding: "8px 12px",
                border: "none",
                background: studentSortBy === "name" ? "#e0f2fe" : "transparent",
                textAlign: "left",
                cursor: "pointer",
                fontSize: "14px"
              },
            },
            React.createElement("i", { className: "fas fa-check", style: { width: "16px", opacity: studentSortBy === "name" ? 1 : 0 } }),
            "Sort by Name"
          ),
          React.createElement(
            "button",
            {
              className: "dropdown-item",
              onClick: () => {
                onSortChange("gender");
                setShowSortDropdown(false);
              },
              style: {
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                padding: "8px 12px",
                border: "none",
                background: studentSortBy === "gender" ? "#e0f2fe" : "transparent",
                textAlign: "left",
                cursor: "pointer",
                fontSize: "14px"
              },
            },
            React.createElement("i", { className: "fas fa-check", style: { width: "16px", opacity: studentSortBy === "gender" ? 1 : 0 } }),
            "Sort by Gender"
          )
        )
      )
    ),
    
    // Search results count
    searchTerm && React.createElement(
      "div",
      { 
        style: { 
          padding: "8px 16px",
          backgroundColor: "#f3f4f6",
          borderBottom: "1px solid #e5e7eb",
          fontSize: "13px",
          color: "#6b7280"
        }
      },
      `Found ${sortedStudents.length} student${sortedStudents.length !== 1 ? 's' : ''}`
    ),

    // Student grid - scrollable area
    React.createElement(
      "div",
      { className: "student-grid" },
      sortedStudents.map((student) => {
        // Determine if we should apply gender highlighting
        const isFemale = student.gender === "female" || student.gender === "Female" || student.gender === "F";
        const genderStyle = {};
        
        // Apply gender-specific styling when in gender highlight mode
        if (highlightMode === "gender" && isFemale) {
          genderStyle.border = "2px solid #10b981";  // Green border for females
          genderStyle.backgroundColor = "white";  // Keep white background
          genderStyle.color = "black";  // Keep black text
        }
        
        return React.createElement(
          "div",
          {
            key: student.id,
            className: `student-card ${
              selectedStudent?.id === student.id ? "selected" : ""
            } ${isFemale ? "female" : "male"}`,
            style: genderStyle,
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
          (() => {
            const { line1, line2 } = formatStudentNameTwoLine(student);
            return React.createElement(
              "div",
              { 
                className: "student-card-name",
                style: {
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  lineHeight: "1.2"
                }
              },
              React.createElement(
                "span",
                { style: { fontWeight: "bold" } },
                line1
              ),
              React.createElement(
                "span",
                { style: { fontSize: "0.9em", opacity: 0.8 } },
                line2
              )
            );
          })()
        );
      })
    )
  );
};

// Export
if (typeof window !== "undefined") {
  window.SeatingEditor = SeatingEditor;
}
