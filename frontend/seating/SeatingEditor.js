// frontend/seating/SeatingEditor.js
// Integrated Seating Chart Editor

const { useState, useEffect, useMemo } = React;

const SeatingEditor = ({ classId, periodId, onBack, onView, navigateTo }) => {
  // Use NavigationService if available
  const nav = window.NavigationService || null;
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
  const [fillMode, setFillMode] = useState("random"); // "random", "matchGender", "balanceGender"
  const [history, setHistory] = useState([]); // Undo history stack
  const [historyIndex, setHistoryIndex] = useState(-1); // Current position in history
  const [previousPeriodData, setPreviousPeriodData] = useState(null); // Previous period for duplicate detection
  const [duplicateWarning, setDuplicateWarning] = useState(null); // Warning message for duplicate seating

  // Load initial data when classId or periodId changes
  useEffect(() => {
    loadClassData();
    // Clear deactivated seats when class or period changes
    setDeactivatedSeats(new Set());
    console.log("Cleared deactivated seats - class or period changed");
  }, [classId, periodId]);

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

  // Create lookup structures for previous period data
  const previousPeriodLookup = useMemo(() => {
    if (!previousPeriodData?.assignments) {
      return {
        studentToSeat: {}, // {studentId: {table_number, seat_number}}
        seatToStudent: {}, // {"table-seat": studentId}
        tableStudents: {}, // {table_number: Set of studentIds}
      };
    }

    const lookup = {
      studentToSeat: {},
      seatToStudent: {},
      tableStudents: {},
    };

    previousPeriodData.assignments.forEach((assignment) => {
      const { student_id, table_number, seat_number } = assignment;
      
      // Map student to their previous seat
      lookup.studentToSeat[student_id] = {
        table_number,
        seat_number,
      };
      
      // Map seat to student (for exact seat check)
      const seatKey = `${table_number}-${seat_number}`;
      lookup.seatToStudent[seatKey] = student_id;
      
      // Track all students at each table
      if (!lookup.tableStudents[table_number]) {
        lookup.tableStudents[table_number] = new Set();
      }
      lookup.tableStudents[table_number].add(student_id);
    });

    console.log("Previous period lookup structures created:", lookup);
    return lookup;
  }, [previousPeriodData]);

  // Check for duplicate seating from previous period
  const checkForDuplicates = (studentId, tableNumber, seatNumber) => {
    if (!previousPeriodLookup || !previousPeriodData) {
      return { sameSeat: false, sameTablemates: [] };
    }

    const duplicates = {
      sameSeat: false,
      sameTablemates: [],
    };

    // Check if student is in the exact same seat
    const seatKey = `${tableNumber}-${seatNumber}`;
    // Convert both to numbers for comparison to handle type mismatches
    const previousStudentId = previousPeriodLookup.seatToStudent[seatKey];
    
    console.log(`Checking duplicate for student ${studentId} at Table ${tableNumber}, Seat ${seatNumber}`);
    console.log(`  Seat key: ${seatKey}, Previous student at this seat: ${previousStudentId}`);
    
    if (previousStudentId && Number(previousStudentId) === Number(studentId)) {
      duplicates.sameSeat = true;
      console.log(`Duplicate detected: Student ${studentId} in same seat as previous period`);
    }

    // Find current tablemates at the target table
    const currentTablemates = new Set();
    
    // Find table by table_number to get its ID
    const table = layout?.tables?.find(t => t.table_number === tableNumber);
    if (table) {
      const tableId = String(table.id);
      const tableAssignments = assignments[tableId] || {};
      
      Object.entries(tableAssignments).forEach(([seat, sid]) => {
        if (sid !== studentId) { // Don't include the student themselves
          currentTablemates.add(sid);
        }
      });
    }

    // Check if any current tablemates were also tablemates in previous period
    const previousTablemates = previousPeriodLookup.tableStudents[tableNumber] || new Set();
    
    currentTablemates.forEach(currentMateId => {
      // Convert IDs to numbers for comparison
      const currentMateNum = Number(currentMateId);
      const studentNum = Number(studentId);
      
      // Check if both students were at the same table in previous period
      let wereTogether = false;
      previousTablemates.forEach(prevId => {
        if (Number(prevId) === currentMateNum) {
          // This tablemate was at the table before
          // Now check if our current student was also there
          previousTablemates.forEach(prevId2 => {
            if (Number(prevId2) === studentNum) {
              wereTogether = true;
            }
          });
        }
      });
      
      if (wereTogether) {
        const student = students.find(s => s.id === currentMateId);
        if (student) {
          duplicates.sameTablemates.push({
            id: currentMateId,
            name: `${student.first_name} ${student.last_name}`,
          });
        }
      }
    });

    if (duplicates.sameTablemates.length > 0) {
      console.log(`Duplicate detected: Student ${studentId} has same tablemates as previous period:`, 
                  duplicates.sameTablemates.map(s => s.name));
    }

    return duplicates;
  };

  const loadClassData = async (preservedAssignments = null) => {
    try {
      setLoading(true);
      console.log("Loading data for class:", classId, "period:", periodId);

      // Load class info
      const classData = await window.ApiModule.request(`/classes/${classId}/`);
      console.log("Class data loaded:", classData);
      
      // If specific periodId provided, load that period
      let periodToEdit = null;
      
      if (periodId) {
        // Load the specific period requested
        periodToEdit = await window.ApiModule.request(`/seating-periods/${periodId}/`);
        console.log("Loading specific period for editing:", periodToEdit.name);
        // Replace the current_seating_period in classData with the one we're editing
        classData.current_seating_period = periodToEdit;
      } else {
        // Otherwise use current period from classData
        periodToEdit = classData.current_seating_period;
      }
      
      setClassInfo(classData);

      // Check if we're viewing the actual current period (one with no end_date)
      const viewingCurrent = periodToEdit && periodToEdit.end_date === null;
      setIsViewingCurrentPeriod(viewingCurrent);
      console.log(`Editing period: ${periodToEdit?.name}, Is current: ${viewingCurrent}, End date: ${periodToEdit?.end_date}`);
      
      // Load the layout from the period being edited (if exists) or auto-select
      let currentLayout = null;
      if (periodToEdit && periodToEdit.layout_details) {
        // Use layout from the seating period (new approach)
        console.log(
          "Layout found in seating period:",
          periodToEdit.layout_details
        );
        currentLayout = periodToEdit.layout_details;
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

      // Load previous period data for duplicate detection
      try {
        const previousPeriod = await window.ApiModule.request(
          `/seating-periods/previous_period/?class_assigned=${classId}`
        );
        
        if (previousPeriod) {
          console.log("Previous period loaded:", previousPeriod.id);
          console.log("Previous period assignments:", previousPeriod.assignments?.length || 0);
          setPreviousPeriodData(previousPeriod);
        } else {
          console.log("No previous period exists for this class");
          setPreviousPeriodData(null);
        }
      } catch (error) {
        console.error("Error loading previous period:", error);
        setPreviousPeriodData(null);
      }

      // Load existing seating assignments if any
      if (
        periodToEdit?.seating_assignments &&
        periodToEdit.seating_assignments.length > 0 &&
        currentLayout // Make sure we have a layout
      ) {
        console.log(
          "Loading seating assignments:",
          periodToEdit.seating_assignments
        );
        // Convert assignments to our format: {tableId: {seatNumber: studentId}}
        const assignmentMap = {};

        periodToEdit.seating_assignments.forEach((assignment) => {
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

          const tableId = String(table.id); // Ensure it's a string
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
        // If we have preserved assignments to apply, use them
        if (preservedAssignments) {
          console.log("Applying preserved assignments:", preservedAssignments);
          setAssignments(preservedAssignments);
          setInitialAssignments({});
          setHasUnsavedChanges(true);
        } else {
          setInitialAssignments({});
          setHasUnsavedChanges(false);
        }
      }
    } catch (error) {
      console.error("Failed to load class data:", error);
      alert("Failed to load class data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSeatAssignment = (studentId, tableId, seatNumber) => {
    const student = students.find(s => s.id === studentId);
    const studentName = student ? `${student.first_name} ${student.last_name}` : "Student";
    
    const newAssignments = {
      ...assignments,
      [tableId]: {
        ...assignments[tableId],
        [seatNumber]: studentId,
      },
    };
    
    addToHistory(newAssignments, `Place ${studentName}`);
    
    // Check for duplicates AFTER placement
    // Find table number from table ID
    const table = layout?.tables?.find(t => String(t.id) === String(tableId));
    if (table) {
      const duplicates = checkForDuplicates(studentId, table.table_number, seatNumber);
      
      if (duplicates.sameSeat || duplicates.sameTablemates.length > 0) {
        // Build warning message
        let warningMsg = `⚠️ ${studentName} `;
        
        if (duplicates.sameSeat) {
          warningMsg += "is in the same seat as the previous period";
          if (duplicates.sameTablemates.length > 0) {
            warningMsg += " and ";
          }
        }
        
        if (duplicates.sameTablemates.length > 0) {
          const names = duplicates.sameTablemates.map(s => s.name).join(", ");
          warningMsg += `is seated with the same tablemate${duplicates.sameTablemates.length > 1 ? 's' : ''} as before: ${names}`;
        }
        
        setDuplicateWarning(warningMsg);
      }
    }
  };

  const handleSeatSwap = (studentA, tableA, seatA, studentB, tableB, seatB) => {
    const studentAObj = students.find(s => s.id === studentA);
    const studentBObj = students.find(s => s.id === studentB);
    const nameA = studentAObj ? `${studentAObj.first_name} ${studentAObj.last_name}` : "Student A";
    const nameB = studentBObj ? `${studentBObj.first_name} ${studentBObj.last_name}` : "Student B";
    
    const newAssignments = { ...assignments };

    // Special case: if swapping within the same table, handle it differently
    if (tableA === tableB) {
      // Just swap the values directly without deleting the table
      if (newAssignments[tableA]) {
        const tempStudent = newAssignments[tableA][seatA];
        newAssignments[tableA][seatA] = newAssignments[tableA][seatB];
        newAssignments[tableA][seatB] = tempStudent;
      }
      addToHistory(newAssignments, `Swap ${nameA} and ${nameB}`);
      return;
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
    addToHistory(result, `Swap ${nameA} and ${nameB}`);
    
    // Check for duplicates for both swapped students
    const tableAObj = layout?.tables?.find(t => String(t.id) === String(tableA));
    const tableBObj = layout?.tables?.find(t => String(t.id) === String(tableB));
    
    const warnings = [];
    
    if (tableAObj) {
      const duplicatesB = checkForDuplicates(studentB, tableAObj.table_number, seatA);
      if (duplicatesB.sameSeat || duplicatesB.sameTablemates.length > 0) {
        let msg = `${nameB} `;
        if (duplicatesB.sameSeat) {
          msg += "is in the same seat as the previous period";
        }
        if (duplicatesB.sameTablemates.length > 0) {
          if (duplicatesB.sameSeat) msg += " and ";
          const names = duplicatesB.sameTablemates.map(s => s.name).join(", ");
          msg += `is with the same tablemate${duplicatesB.sameTablemates.length > 1 ? 's' : ''}: ${names}`;
        }
        warnings.push(msg);
      }
    }
    
    if (tableBObj) {
      const duplicatesA = checkForDuplicates(studentA, tableBObj.table_number, seatB);
      if (duplicatesA.sameSeat || duplicatesA.sameTablemates.length > 0) {
        let msg = `${nameA} `;
        if (duplicatesA.sameSeat) {
          msg += "is in the same seat as the previous period";
        }
        if (duplicatesA.sameTablemates.length > 0) {
          if (duplicatesA.sameSeat) msg += " and ";
          const names = duplicatesA.sameTablemates.map(s => s.name).join(", ");
          msg += `is with the same tablemate${duplicatesA.sameTablemates.length > 1 ? 's' : ''}: ${names}`;
        }
        warnings.push(msg);
      }
    }
    
    if (warnings.length > 0) {
      setDuplicateWarning(`⚠️ ${warnings.join(". ")}`);
    }
  };

  const handleSeatUnassignment = (tableId, seatNumber) => {
    const studentId = assignments[tableId]?.[seatNumber];
    const student = studentId ? students.find(s => s.id === studentId) : null;
    const studentName = student ? `${student.first_name} ${student.last_name}` : "Student";
    
    const newAssignments = { ...assignments };
    if (newAssignments[tableId]) {
      delete newAssignments[tableId][seatNumber];
      if (Object.keys(newAssignments[tableId]).length === 0) {
        delete newAssignments[tableId];
      }
    }
    
    addToHistory(newAssignments, `Remove ${studentName}`);
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

  // Get the gender of neighbors for a given seat
  const getNeighborGenders = (tableId, seatNumber) => {
    const tableIdStr = String(tableId);
    const neighbors = [];
    
    // Get the table from the layout
    const table = layout?.tables?.find(t => t.id === parseInt(tableId));
    if (!table || !table.seats) return neighbors;
    
    // Find seats that are adjacent (simplified - just check seat numbers +/- 1)
    const seatNum = parseInt(seatNumber);
    const checkSeats = [seatNum - 1, seatNum + 1];
    
    checkSeats.forEach(num => {
      const neighborSeat = table.seats.find(s => s.seat_number === num);
      if (neighborSeat) {
        const studentId = assignments[tableIdStr]?.[String(num)];
        if (studentId) {
          const student = students.find(s => s.id === studentId);
          if (student && student.gender) {
            neighbors.push(student.gender);
          }
        }
      }
    });
    
    return neighbors;
  };

  // Get current gender balance in the class
  const getGenderBalance = () => {
    const assigned = getAssignedStudentIds();
    let maleCount = 0;
    let femaleCount = 0;
    
    assigned.forEach(studentId => {
      const student = students.find(s => s.id === studentId);
      if (student && student.gender) {
        const isFemale = student.gender === "female" || student.gender === "F" || student.gender === "Female";
        if (isFemale) {
          femaleCount++;
        } else {
          maleCount++;
        }
      }
    });
    
    return { male: maleCount, female: femaleCount };
  };

  // Handle click-to-fill for empty seats
  const handleClickToFill = (tableId, seatNumber) => {
    const tableIdStr = String(tableId);
    const seatNumberStr = String(seatNumber);
    
    // Check if seat is already occupied
    if (assignments[tableIdStr]?.[seatNumberStr]) {
      console.log("Seat already occupied");
      return;
    }
    
    // Check if seat is deactivated
    const seatId = `${tableId}-${seatNumber}`;
    if (deactivatedSeats.has(seatId)) {
      console.log("Cannot fill deactivated seat");
      return;
    }
    
    // Get unassigned students
    const unassignedStudents = getUnassignedStudents();
    if (unassignedStudents.length === 0) {
      console.log("No unassigned students available");
      return;
    }
    
    let selectedStudent = null;
    
    // Select student based on fill mode
    if (fillMode === "random") {
      // Random selection
      const randomIndex = Math.floor(Math.random() * unassignedStudents.length);
      selectedStudent = unassignedStudents[randomIndex];
      console.log(`Random fill: Selected ${selectedStudent.first_name} ${selectedStudent.last_name}`);
      
    } else if (fillMode === "matchGender") {
      // Match Gender - try to match neighboring students' gender
      const neighborGenders = getNeighborGenders(tableId, seatNumber);
      console.log(`Match Gender mode - Neighbor genders:`, neighborGenders);
      
      if (neighborGenders.length > 0) {
        // Get the most common gender among neighbors
        const targetGender = neighborGenders[0]; // Simple: use first neighbor's gender
        
        // Filter unassigned students by gender
        const matchingStudents = unassignedStudents.filter(student => {
          if (!student.gender) return false;
          const isFemale = student.gender === "female" || student.gender === "F" || student.gender === "Female";
          const targetIsFemale = targetGender === "female" || targetGender === "F" || targetGender === "Female";
          return isFemale === targetIsFemale;
        });
        
        if (matchingStudents.length > 0) {
          // Random selection from matching gender
          const randomIndex = Math.floor(Math.random() * matchingStudents.length);
          selectedStudent = matchingStudents[randomIndex];
          console.log(`Match Gender: Selected ${selectedStudent.first_name} ${selectedStudent.last_name} (${selectedStudent.gender}) to match neighbors`);
        } else {
          // No matching gender available, fall back to random
          console.log("No students of matching gender available, using random");
          const randomIndex = Math.floor(Math.random() * unassignedStudents.length);
          selectedStudent = unassignedStudents[randomIndex];
        }
      } else {
        // No neighbors to match, use random
        console.log("No neighbors to match gender with, using random");
        const randomIndex = Math.floor(Math.random() * unassignedStudents.length);
        selectedStudent = unassignedStudents[randomIndex];
      }
      
    } else if (fillMode === "balanceGender") {
      // Balance Gender - try to balance overall gender distribution
      const balance = getGenderBalance();
      console.log(`Balance Gender mode - Current balance: Male=${balance.male}, Female=${balance.female}`);
      
      // Determine which gender we need more of
      let targetIsFemale = balance.male > balance.female;
      
      // Filter unassigned students by the needed gender
      const targetStudents = unassignedStudents.filter(student => {
        if (!student.gender) return false;
        const isFemale = student.gender === "female" || student.gender === "F" || student.gender === "Female";
        return isFemale === targetIsFemale;
      });
      
      if (targetStudents.length > 0) {
        // Random selection from target gender
        const randomIndex = Math.floor(Math.random() * targetStudents.length);
        selectedStudent = targetStudents[randomIndex];
        console.log(`Balance Gender: Selected ${selectedStudent.first_name} ${selectedStudent.last_name} (${selectedStudent.gender}) to balance distribution`);
      } else {
        // No students of needed gender, use any available
        console.log("No students of needed gender for balance, using random");
        const randomIndex = Math.floor(Math.random() * unassignedStudents.length);
        selectedStudent = unassignedStudents[randomIndex];
      }
      
    } else {
      // Unknown mode, fall back to random
      console.log(`Unknown fill mode "${fillMode}", using random`);
      const randomIndex = Math.floor(Math.random() * unassignedStudents.length);
      selectedStudent = unassignedStudents[randomIndex];
    }
    
    if (selectedStudent) {
      // Use the existing handleSeatAssignment function which includes history tracking
      handleSeatAssignment(selectedStudent.id, tableId, seatNumber);
    }
  };

  // Handle auto-fill all empty seats
  const handleAutoFill = () => {
    console.log(`Starting auto-fill with mode: ${fillMode}`);
    
    // Get all empty seats
    const emptySeats = [];
    if (layout && layout.tables) {
      layout.tables.forEach(table => {
        if (table.seats) {
          table.seats.forEach(seat => {
            const tableIdStr = String(table.id);
            const seatNumberStr = String(seat.seat_number);
            const seatId = `${table.id}-${seat.seat_number}`;
            
            // Check if seat is empty and not deactivated
            const isOccupied = assignments[tableIdStr]?.[seatNumberStr];
            const isDeactivated = deactivatedSeats.has(seatId);
            
            if (!isOccupied && !isDeactivated) {
              emptySeats.push({
                tableId: table.id,
                seatNumber: seat.seat_number,
                tableNumber: table.table_number
              });
            }
          });
        }
      });
    }
    
    console.log(`Found ${emptySeats.length} empty seats to fill`);
    
    if (emptySeats.length === 0) {
      alert("No empty seats to fill!");
      return;
    }
    
    // Get unassigned students
    const unassignedStudents = getUnassignedStudents();
    if (unassignedStudents.length === 0) {
      alert("No unassigned students available!");
      return;
    }
    
    // Create a copy of current assignments for batch update
    const newAssignments = JSON.parse(JSON.stringify(assignments));
    const placedStudents = [];
    
    // Fill seats based on mode
    if (fillMode === "random") {
      // Random mode - shuffle and assign
      const shuffledStudents = [...unassignedStudents].sort(() => Math.random() - 0.5);
      
      emptySeats.forEach((seat, index) => {
        if (index < shuffledStudents.length) {
          const student = shuffledStudents[index];
          const tableIdStr = String(seat.tableId);
          const seatNumberStr = String(seat.seatNumber);
          
          if (!newAssignments[tableIdStr]) {
            newAssignments[tableIdStr] = {};
          }
          newAssignments[tableIdStr][seatNumberStr] = student.id;
          placedStudents.push(student.first_name);
        }
      });
      
    } else if (fillMode === "matchGender") {
      // Match Gender mode - try to group similar genders
      const remainingStudents = [...unassignedStudents];
      
      emptySeats.forEach(seat => {
        if (remainingStudents.length === 0) return;
        
        // Get neighbor genders for this seat (check both existing and newly placed)
        const neighborGenders = [];
        const tableIdStr = String(seat.tableId);
        const table = layout?.tables?.find(t => t.id === seat.tableId);
        if (table && table.seats) {
          const seatNum = parseInt(seat.seatNumber);
          const checkSeats = [seatNum - 1, seatNum + 1];
          
          checkSeats.forEach(num => {
            const neighborSeat = table.seats.find(s => s.seat_number === num);
            if (neighborSeat) {
              // Check new assignments first, then existing
              const studentId = newAssignments[tableIdStr]?.[String(num)] || assignments[tableIdStr]?.[String(num)];
              if (studentId) {
                const student = students.find(s => s.id === studentId);
                if (student && student.gender) {
                  neighborGenders.push(student.gender);
                }
              }
            }
          });
        }
        let selectedStudent = null;
        let selectedIndex = -1;
        
        if (neighborGenders.length > 0) {
          // Try to find a student matching neighbor gender
          const targetGender = neighborGenders[0];
          const targetIsFemale = targetGender === "female" || targetGender === "F" || targetGender === "Female";
          
          for (let i = 0; i < remainingStudents.length; i++) {
            const student = remainingStudents[i];
            if (student.gender) {
              const isFemale = student.gender === "female" || student.gender === "F" || student.gender === "Female";
              if (isFemale === targetIsFemale) {
                selectedStudent = student;
                selectedIndex = i;
                break;
              }
            }
          }
        }
        
        // If no match found, take any student
        if (!selectedStudent && remainingStudents.length > 0) {
          selectedStudent = remainingStudents[0];
          selectedIndex = 0;
        }
        
        if (selectedStudent) {
          const tableIdStr = String(seat.tableId);
          const seatNumberStr = String(seat.seatNumber);
          
          if (!newAssignments[tableIdStr]) {
            newAssignments[tableIdStr] = {};
          }
          newAssignments[tableIdStr][seatNumberStr] = selectedStudent.id;
          placedStudents.push(selectedStudent.first_name);
          remainingStudents.splice(selectedIndex, 1);
        }
      });
      
    } else if (fillMode === "balanceGender") {
      // Balance Gender mode - alternate genders
      const remainingStudents = [...unassignedStudents];
      const males = remainingStudents.filter(s => s.gender && (s.gender === "male" || s.gender === "M" || s.gender === "Male"));
      const females = remainingStudents.filter(s => s.gender && (s.gender === "female" || s.gender === "F" || s.gender === "Female"));
      const unknownGender = remainingStudents.filter(s => !s.gender || (s.gender !== "male" && s.gender !== "M" && s.gender !== "Male" && s.gender !== "female" && s.gender !== "F" && s.gender !== "Female"));
      
      console.log(`Balance Gender: ${males.length} males, ${females.length} females, ${unknownGender.length} unknown`);
      
      // Get current balance to determine starting gender
      const currentBalance = getGenderBalance();
      let preferFemale = currentBalance.male > currentBalance.female;
      
      emptySeats.forEach(seat => {
        let selectedStudent = null;
        
        // Try to select from preferred gender
        if (preferFemale && females.length > 0) {
          selectedStudent = females.shift();
        } else if (!preferFemale && males.length > 0) {
          selectedStudent = males.shift();
        } else if (females.length > 0) {
          selectedStudent = females.shift();
        } else if (males.length > 0) {
          selectedStudent = males.shift();
        } else if (unknownGender.length > 0) {
          selectedStudent = unknownGender.shift();
        }
        
        if (selectedStudent) {
          const tableIdStr = String(seat.tableId);
          const seatNumberStr = String(seat.seatNumber);
          
          if (!newAssignments[tableIdStr]) {
            newAssignments[tableIdStr] = {};
          }
          newAssignments[tableIdStr][seatNumberStr] = selectedStudent.id;
          placedStudents.push(selectedStudent.first_name);
          
          // Alternate preference for next seat
          preferFemale = !preferFemale;
        }
      });
    }
    
    // Add to history as a single batch operation
    const numPlaced = placedStudents.length;
    const description = `Auto-fill ${numPlaced} seats (${fillMode})`;
    console.log(`Auto-fill complete: Placed ${numPlaced} students`);
    
    if (numPlaced > 0) {
      addToHistory(newAssignments, description);
    } else {
      alert("No students were placed!");
    }
  };

  // Handle layout selection from modal
  const handleLayoutSelection = async (layoutId) => {
    console.log("Selecting layout:", layoutId);
    
    // Don't do anything if selecting the same layout
    if (layoutId === layout?.id) {
      console.log("Same layout selected, no change needed");
      setShowLayoutSelector(false);
      return;
    }
    
    // Check if there are existing assignments
    const hasAssignments = Object.keys(assignments).length > 0;
    console.log("Has assignments:", hasAssignments, assignments);
    
    if (hasAssignments) {
      // Stage 4: Warning for existing assignments
      const confirmChange = window.confirm(
        "Current seat assignments might be lost. Continue?"
      );
      if (!confirmChange) {
        console.log("User cancelled layout change");
        return; // User cancelled
      }
    }
    
    try {
      // Close modal immediately for better UX
      setShowLayoutSelector(false);
      
      // Stage 3: Update the seating period with new layout
      if (!classInfo?.current_seating_period?.id) {
        console.error("No current seating period found!");
        alert("No current seating period to update");
        return;
      }
      
      const periodId = classInfo.current_seating_period.id;
      console.log(`Updating period ${periodId} with new layout ${layoutId}`);
      
      // PATCH the seating period with new layout
      const response = await window.ApiModule.request(
        `/seating-periods/${periodId}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ layout: layoutId }),
        }
      );
      
      console.log("PATCH response:", response);
      console.log("Layout updated successfully");
      
      // Stage 5: Collect current assignments before reload
      const oldAssignments = [];
      const preservedAssignments = { ...assignments }; // Save a copy
      const preservedLayout = layout; // Save current layout reference
      
      if (hasAssignments && preservedLayout?.tables) {
        // Collect all seated students in order (by table number, then seat number)
        preservedLayout.tables.forEach(table => {
          const tableId = String(table.id);
          const tableAssignments = preservedAssignments[tableId] || {};
          
          // Get seats for this table and sort by seat number
          const seats = table.seats || [];
          seats.sort((a, b) => a.seat_number - b.seat_number);
          
          seats.forEach(seat => {
            const seatNumber = String(seat.seat_number);
            const studentId = tableAssignments[seatNumber];
            if (studentId) {
              oldAssignments.push({
                studentId,
                oldTable: table.table_number,
                oldSeat: seat.seat_number,
              });
            }
          });
        });
        
        // Sort by table number, then seat number
        oldAssignments.sort((a, b) => {
          if (a.oldTable !== b.oldTable) {
            return a.oldTable - b.oldTable;
          }
          return a.oldSeat - b.oldSeat;
        });
        
        console.log("Collected assignments to remap:", oldAssignments);
      }
      
      // Get the new layout data to build remapped assignments
      let remappedAssignments = {};
      
      if (oldAssignments.length > 0) {
        const newLayoutData = await window.ApiModule.request(`/layouts/${layoutId}/`);
        console.log("New layout data for mapping:", newLayoutData);
        
        // Collect all available seats in the new layout
        const availableSeats = [];
        if (newLayoutData?.tables) {
          newLayoutData.tables.forEach(table => {
            const seats = table.seats || [];
            seats.sort((a, b) => a.seat_number - b.seat_number);
            
            seats.forEach(seat => {
              availableSeats.push({
                tableId: String(table.id),
                seatNumber: String(seat.seat_number),
                tableNumber: table.table_number,
              });
            });
          });
          
          // Sort available seats by table number, then seat number
          availableSeats.sort((a, b) => {
            if (a.tableNumber !== b.tableNumber) {
              return a.tableNumber - b.tableNumber;
            }
            return parseInt(a.seatNumber) - parseInt(b.seatNumber);
          });
          
          console.log("Available seats in new layout:", availableSeats.length);
          
          // Map students sequentially
          const mappedCount = Math.min(oldAssignments.length, availableSeats.length);
          
          for (let i = 0; i < mappedCount; i++) {
            const student = oldAssignments[i];
            const seat = availableSeats[i];
            
            if (!remappedAssignments[seat.tableId]) {
              remappedAssignments[seat.tableId] = {};
            }
            remappedAssignments[seat.tableId][seat.seatNumber] = student.studentId;
          }
          
          console.log(`Mapped ${mappedCount} students to remappedAssignments`);
          console.log("Remapped assignments:", remappedAssignments);
          
          if (oldAssignments.length > availableSeats.length) {
            console.log(`${oldAssignments.length - availableSeats.length} students returned to pool (not enough seats)`);
          }
        }
      }
      
      // Reload class data with the remapped assignments
      await loadClassData(remappedAssignments);
      
      console.log("=== Layout Selection Complete ===");
      
    } catch (error) {
      console.error("Failed to update layout:", error);
      console.error("Error details:", error.message, error.response);
      alert("Failed to update layout. Please try again.");
    }
  };

  // Build the title string
  const getEditorTitle = () => {
    if (!classInfo) {
      return React.createElement("span", null, "Loading...");
    }

    const className = classInfo.name || "Unknown Class";

    if (classInfo.current_seating_period) {
      const period = classInfo.current_seating_period;
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

    // No current period yet
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
        "New Seating Chart"
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

  // History management functions for undo/redo
  const addToHistory = (newAssignments, description = "action") => {
    // Create a history entry
    const entry = {
      assignments: JSON.parse(JSON.stringify(assignments)), // Deep copy current state
      newAssignments: JSON.parse(JSON.stringify(newAssignments)), // Deep copy new state
      description: description,
      timestamp: Date.now()
    };
    
    // If we're not at the end of history, truncate everything after current position
    const newHistory = history.slice(0, historyIndex + 1);
    
    // Add new entry and limit history size to prevent memory issues
    newHistory.push(entry);
    if (newHistory.length > 50) { // Keep max 50 undo levels
      newHistory.shift();
    }
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    // Apply the new assignments
    setAssignments(newAssignments);
    setHasUnsavedChanges(true);
    
    console.log(`History: Added "${description}", stack size: ${newHistory.length}`);
  };

  const handleUndo = () => {
    if (historyIndex >= 0 && history[historyIndex]) {
      const entry = history[historyIndex];
      setAssignments(entry.assignments); // Restore previous state
      setHistoryIndex(historyIndex - 1);
      setHasUnsavedChanges(true);
      console.log(`Undo: "${entry.description}"`);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const entry = history[nextIndex];
      setAssignments(entry.newAssignments); // Apply the redone state
      setHistoryIndex(nextIndex);
      setHasUnsavedChanges(true);
      console.log(`Redo: "${entry.description}"`);
    }
  };

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  // Navigate to previous/next seating period (VIEW ONLY - does not modify database)
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

      // Find the currently viewed period index (not necessarily the active one)
      const currentlyViewedPeriodId = classInfo.current_seating_period?.id;
      const currentIndex = periods.findIndex((p) => p.id === currentlyViewedPeriodId);

      let targetIndex;
      if (direction === "previous") {
        targetIndex = currentIndex > 0 ? currentIndex - 1 : periods.length - 1;
      } else {
        targetIndex = currentIndex < periods.length - 1 ? currentIndex + 1 : 0;
      }

      const targetPeriod = periods[targetIndex];

      console.log(`Navigating from period ${currentlyViewedPeriodId} to ${targetPeriod.id}`);
      console.log("Target period:", targetPeriod);
      console.log("Note: This is VIEW-ONLY navigation, not changing active period in database");

      // Get full details of the target period
      const fullTargetPeriod = await window.ApiModule.request(`/seating-periods/${targetPeriod.id}/`);

      // Update URL to reflect the new period being edited
      if (nav?.toSeatingEditPeriod) {
        nav.toSeatingEditPeriod(classId, targetPeriod.id);
      } else if (navigateTo) {
        navigateTo(`seating/edit/${classId}/period/${targetPeriod.id}`);
      } else {
        // Fallback: just update the UI state
        setClassInfo(prevInfo => ({
          ...prevInfo,
          current_seating_period: fullTargetPeriod
        }));
      }

      // Clear deactivated seats when viewing a historical period
      if (fullTargetPeriod.end_date !== null) {
        console.log("Viewing historical period - clearing deactivated seats");
        setDeactivatedSeats(new Set());
        setIsViewingCurrentPeriod(false);
      } else {
        console.log("Viewing the true current period");
        setIsViewingCurrentPeriod(true);
      }

      // Update layout first if the period has a different one
      let currentLayout = layout;
      if (fullTargetPeriod.layout_details) {
        currentLayout = fullTargetPeriod.layout_details;
        setLayout(currentLayout);
      }

      // Load assignments for the target period
      if (fullTargetPeriod.seating_assignments && fullTargetPeriod.seating_assignments.length > 0 && currentLayout) {
        const assignmentMap = {};
        fullTargetPeriod.seating_assignments.forEach((assignment) => {
          // Find the table in the layout by table_number to get its ID
          const table = currentLayout.tables?.find(
            (t) => t.table_number === assignment.table_number
          );
          
          if (!table) {
            console.warn(`Table ${assignment.table_number} not found in layout`);
            return;
          }

          const tableId = String(table.id);  // Use the table's ID, not table_number
          const seatNumber = String(assignment.seat_number);
          const rosterEntry = classInfo.roster.find((r) => r.id === assignment.roster_entry);
          const studentId = rosterEntry ? rosterEntry.student : null;

          if (studentId) {
            if (!assignmentMap[tableId]) {
              assignmentMap[tableId] = {};
            }
            assignmentMap[tableId][seatNumber] = studentId;
          }
        });
        console.log("Loaded assignments for period:", assignmentMap);
        setAssignments(assignmentMap);
      } else {
        setAssignments({});
      }

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
            const layoutsResponse = await window.ApiModule.request("/layouts/");
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

      // Get all periods for this class to determine the chart number
      let chartNumber = 1;
      try {
        const allPeriods = await window.ApiModule.request(`/seating-periods/?class_assigned=${classId}`);
        console.log("All periods response:", allPeriods);
        
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

      // Create new period with layout (use current layout or fetch user's most recent)
      let layoutId = layout?.id;
      
      if (!layoutId) {
        // Try to get the user's most recent layout
        try {
          const layoutsResponse = await window.ApiModule.request("/layouts/");
          const userLayouts = layoutsResponse.results || layoutsResponse;
          if (userLayouts.length > 0) {
            layoutId = userLayouts[0].id;
          }
        } catch (error) {
          console.error("Failed to fetch layouts:", error);
        }
      }
      
      if (!layoutId) {
        alert("No layout available. Please create a classroom layout first.");
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
      
      // Show success message
      console.log(`Successfully created new period: ${periodName}`);
    } catch (error) {
      console.error("Error in new period creation process:", error);
      
      // Check if the period was actually created despite the error
      try {
        await loadClassData();
        // If we successfully reloaded and have a new period, don't show error
        console.log("Period may have been created despite error, data reloaded");
      } catch (reloadError) {
        // Only show error if we truly failed
        alert("Failed to create new seating period. Please try again.");
      }
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
    { 
      className: "seating-editor-integrated",
      style: {
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }
    },

    // Top toolbar
    React.createElement(
      "div",
      { className: "canvas-toolbar" },
      React.createElement(
        "button",
        {
          onClick: () => {
            console.log("SeatingEditor back button clicked");
            console.log("onBack prop:", onBack);
            if (onBack) {
              onBack();
            } else {
              console.error("No onBack handler provided to SeatingEditor");
            }
          },
          className: "btn btn-secondary btn-sm",
        },
        React.createElement("i", { className: "fas fa-arrow-left" }),
        " Back"
      ),
      React.createElement(
        "div", 
        { 
          className: "editor-title", 
          style: { 
            flex: "1",
            display: "flex",
            alignItems: "center",
            minHeight: "40px"
          } 
        }, 
        getEditorTitle()
      ),

      // Period navigation buttons (right-justified)
      React.createElement(
        "div",
        {
          className: "period-navigation",
          style: { display: "flex", gap: "0.5rem", marginLeft: "auto" },
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

    // Duplicate warning display
    duplicateWarning && React.createElement(
      "div",
      {
        className: "duplicate-warning",
        style: {
          backgroundColor: "#fef3c7",
          color: "#92400e",
          padding: "0.75rem 1rem",
          borderRadius: "0.375rem",
          marginTop: "0.5rem",
          marginBottom: "0.5rem",
          marginLeft: "1rem",
          marginRight: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.95rem",
          fontWeight: "500",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          animation: "slideDown 0.3s ease-out",
          cursor: "pointer",
        },
        onClick: () => setDuplicateWarning(null),
        title: "Click to dismiss"
      },
      React.createElement("i", { 
        className: "fas fa-exclamation-triangle",
        style: { color: "#f59e0b" }
      }),
      React.createElement("span", { style: { flex: 1 } }, duplicateWarning),
      React.createElement(
        "button",
        {
          style: {
            background: "none",
            border: "none",
            color: "#92400e",
            fontSize: "1.2rem",
            cursor: "pointer",
            padding: "0 0 0 0.5rem",
            opacity: "0.7",
          },
          onClick: (e) => {
            e.stopPropagation();
            setDuplicateWarning(null);
          },
          title: "Dismiss warning"
        },
        "×"
      )
    ),

    // Main content area with left sidebar, canvas in center, pool on right
    React.createElement(
      "div",
      { 
        className: "editor-main-area",
        style: {
          display: "flex",
          flex: 1,
          overflow: "hidden",
        }
      },

      React.createElement(
        "div",
        { 
          className: "editor-content-wrapper",
          style: {
            display: "flex",
            flex: 1,
            overflow: "hidden",
            position: "relative",
          }
        },

        // Left sidebar with controls - fixed width
        React.createElement(
          "div",
          { 
            className: "editor-left-sidebar",
            style: {
              width: "250px",
              flexShrink: 0,
              overflowY: "auto",
              borderRight: "1px solid #e5e7eb",
              backgroundColor: "#f9fafb",
              padding: 0,
            }
          },
          
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
                onClick: () => setShowLayoutSelector(true),
                disabled: !isViewingCurrentPeriod,
                title: isViewingCurrentPeriod ? "Select classroom layout" : "Cannot change layout for historical periods",
              },
              React.createElement("i", { className: "fas fa-th" }),
              " Select Layout"
            )
          ),
          
          // Fill section (updated from Auto-fill)
          React.createElement(
            "div",
            { className: "sidebar-section", style: { borderBottom: "1px solid #e5e7eb" } },
            React.createElement("h3", null, "Fill"),
            React.createElement(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "0.5rem" } },
              // Mode dropdown
              React.createElement(
                "div",
                null,
                React.createElement(
                  "label",
                  { 
                    style: { 
                      display: "block", 
                      marginBottom: "0.25rem",
                      fontSize: "11px",
                      color: "#6b7280",
                      textTransform: "uppercase",
                      fontWeight: "600"
                    } 
                  },
                  "Mode"
                ),
                React.createElement(
                  "select",
                  {
                    className: "form-select",
                    value: fillMode,
                    onChange: (e) => {
                      setFillMode(e.target.value);
                      console.log("Fill mode changed to:", e.target.value);
                    },
                    style: {
                      width: "100%",
                      padding: "0.375rem 0.5rem",
                      fontSize: "12px",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.25rem",
                      backgroundColor: "white",
                      cursor: "pointer"
                    }
                  },
                  React.createElement("option", { value: "random" }, "Random"),
                  React.createElement("option", { value: "matchGender" }, "Match Gender"),
                  React.createElement("option", { value: "balanceGender" }, "Balance Gender")
                )
              ),
              // Auto button
              React.createElement(
                "button",
                {
                  className: "btn btn-sm btn-secondary",
                  style: { 
                    width: "100%", 
                    fontSize: "12px",
                    marginTop: "0.5rem"
                  },
                  onClick: handleAutoFill,
                },
                React.createElement("i", { className: "fas fa-magic", style: { fontSize: "10px" } }),
                " Auto"
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
              { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" } },
              React.createElement(
                "button",
                {
                  className: "btn btn-sm btn-secondary",
                  style: { 
                    fontSize: "12px",
                    ...(highlightMode === "none" ? { backgroundColor: "#3b82f6", borderColor: "#3b82f6", color: "white" } : {})
                  },
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
                  className: "btn btn-sm btn-secondary",
                  style: { 
                    fontSize: "12px",
                    ...(highlightMode === "gender" ? { backgroundColor: "#3b82f6", borderColor: "#3b82f6", color: "white" } : {})
                  },
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
                  className: "btn btn-sm btn-secondary",
                  style: { 
                    fontSize: "12px", 
                    gridColumn: "span 2",
                    ...(highlightMode === "previous" ? { backgroundColor: "#3b82f6", borderColor: "#3b82f6", color: "white" } : {})
                  },
                  onClick: () => setHighlightMode("previous"),
                },
                React.createElement("i", { className: "fas fa-history", style: { fontSize: "10px" } }),
                " Previous"
              )
            )
          )
        ),

        // Canvas section (center) - with proper flex layout
        React.createElement(
          "div",
          { 
            className: "editor-canvas-section",
            style: {
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "auto",
              position: "relative",
              minWidth: 0, // Important for flex shrinking
            }
          },
          React.createElement(
            "div",
            { 
              className: "seating-canvas-container",
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
                width: "100%",
                height: "100%",
              }
            },
            React.createElement(SeatingCanvas, {
              layout: layout,
              assignments: assignments,
              students: students,
              highlightMode: highlightMode,
              deactivatedSeats: deactivatedSeats,  // Pass deactivated seats to canvas
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
                  // Normal click - handle click-to-fill for empty seats
                  console.log(`Normal click on seat ${seatId}`);
                  handleClickToFill(tableId, seatNumber);
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

        // Student pool (right side) with action buttons
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
          // Pass action button props
          onSave: handleSave,
          onUndo: handleUndo,
          onReset: handleReset,
          hasUnsavedChanges: hasUnsavedChanges,
          canUndo: canUndo,
          saving: saving,
          historyIndex: historyIndex,
          history: history,
        })
      )
    ),
    
    // Layout Selector Modal
    showLayoutSelector && React.createElement(LayoutSelectorModal, {
      onClose: () => setShowLayoutSelector(false),
      onSelect: handleLayoutSelection,
      availableLayouts: availableLayouts,
      setAvailableLayouts: setAvailableLayouts,
      currentLayoutId: layout?.id,
    })
  );
};

// Layout Selector Modal Component
const LayoutSelectorModal = ({ onClose, onSelect, availableLayouts, setAvailableLayouts, currentLayoutId }) => {
  const [loading, setLoading] = useState(true);

  // Load available layouts when modal opens
  useEffect(() => {
    loadLayouts();
  }, []);

  const loadLayouts = async () => {
    try {
      setLoading(true);
      const response = await window.ApiModule.request("/layouts/");
      console.log("Available layouts:", response);
      // Handle paginated response
      const layouts = response.results || response;
      setAvailableLayouts(Array.isArray(layouts) ? layouts : []);
    } catch (error) {
      console.error("Failed to load layouts:", error);
      alert("Failed to load layouts");
    } finally {
      setLoading(false);
    }
  };

  return React.createElement(
    "div",
    {
      className: "modal-overlay",
      onClick: onClose,
      style: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }
    },
    React.createElement(
      "div",
      {
        className: "modal-content",
        onClick: (e) => e.stopPropagation(),
        style: {
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "500px",
          width: "90%",
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
        }
      },
      // Modal Header
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }
        },
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "10px" } },
          React.createElement("h2", { style: { margin: 0 } }, "Select Layout"),
          React.createElement(
            "button",
            {
              onClick: () => {
                setLoading(true);
                loadLayouts();
              },
              disabled: loading,
              style: {
                background: "none",
                border: "1px solid #e5e7eb",
                borderRadius: "4px",
                padding: "4px 8px",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "14px",
                color: loading ? "#9ca3af" : "#374151",
              },
              title: "Refresh layout list"
            },
            React.createElement("i", { 
              className: loading ? "fas fa-spinner fa-spin" : "fas fa-sync-alt" 
            })
          )
        ),
        React.createElement(
          "button",
          {
            onClick: onClose,
            style: {
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              padding: "0",
              color: "#666",
            }
          },
          "×"
        )
      ),
      
      // Modal Body
      React.createElement(
        "div",
        {
          style: {
            flex: 1,
            overflowY: "auto",
            marginBottom: "20px",
          }
        },
        loading
          ? React.createElement("div", { style: { textAlign: "center", padding: "20px" } }, "Loading layouts...")
          : availableLayouts.length === 0
          ? React.createElement("div", { style: { textAlign: "center", padding: "20px", color: "#666" } }, 
              "No layouts available. Create a new layout to get started.")
          : React.createElement(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "8px" } },
              availableLayouts.map(layout => {
                const isCurrent = layout.id === currentLayoutId;
                return React.createElement(
                  "div",
                  {
                    key: layout.id,
                    onClick: () => !isCurrent && onSelect(layout.id),
                    style: {
                      padding: "12px",
                      border: isCurrent ? "2px solid #3b82f6" : "1px solid #e5e7eb",
                      borderRadius: "4px",
                      cursor: isCurrent ? "default" : "pointer",
                      transition: "background-color 0.2s",
                      backgroundColor: isCurrent ? "#eff6ff" : "white",
                      position: "relative",
                    },
                    onMouseEnter: (e) => !isCurrent && (e.currentTarget.style.backgroundColor = "#f3f4f6"),
                    onMouseLeave: (e) => !isCurrent && (e.currentTarget.style.backgroundColor = "white"),
                  },
                  React.createElement(
                    "div", 
                    { style: { display: "flex", alignItems: "center", gap: "8px" } },
                    React.createElement("div", { style: { fontWeight: "500" } }, layout.name),
                    isCurrent && React.createElement(
                      "span",
                      { 
                        style: { 
                          fontSize: "0.75rem", 
                          backgroundColor: "#3b82f6",
                          color: "white",
                          padding: "2px 6px",
                          borderRadius: "4px",
                        } 
                      },
                      "Current"
                    )
                  ),
                  layout.description && React.createElement(
                    "div", 
                    { style: { fontSize: "0.875rem", color: "#6b7280", marginTop: "4px" } }, 
                    layout.description
                  )
                );
              })
            )
      ),
      
      // Modal Footer with New Layout button
      React.createElement(
        "div",
        {
          style: {
            borderTop: "1px solid #e5e7eb",
            paddingTop: "16px",
          }
        },
        React.createElement(
          "button",
          {
            className: "btn btn-primary",
            onClick: () => {
              // Open layout editor in new tab
              const layoutEditorUrl = window.location.origin + "/#layouts";
              window.open(layoutEditorUrl, "_blank");
              // Close modal - user will need to refresh to see new layout
              setShowLayoutSelector(false);
            },
            style: { width: "100%" },
            title: "Create a new layout in the layout editor"
          },
          React.createElement("i", { className: "fas fa-plus" }),
          " New Layout"
        )
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
  const [gridSize, setGridSize] = React.useState(80); // Dynamic grid size
  const canvasRef = React.useRef(null);
  
  // Calculate optimal grid size to fit the available space
  React.useEffect(() => {
    const calculateOptimalGridSize = () => {
      // Get the canvas section element
      const canvasSection = document.querySelector('.editor-canvas-section');
      if (!canvasSection || !layout) return;
      
      // Get available dimensions
      const rect = canvasSection.getBoundingClientRect();
      // Account for padding and margins (40px total)
      const availableWidth = rect.width - 40;
      const availableHeight = rect.height - 80; // Extra space for toolbar
      
      // Calculate grid size needed to fit width and height
      const gridSizeByWidth = Math.floor(availableWidth / layout.room_width);
      const gridSizeByHeight = Math.floor(availableHeight / layout.room_height);
      
      // Use the smaller of the two to ensure entire grid fits
      const optimalGridSize = Math.min(gridSizeByWidth, gridSizeByHeight);
      
      // Clamp between min and max values
      const finalGridSize = Math.max(40, Math.min(optimalGridSize, 120));
      
      console.log('Grid calculation:', {
        available: { width: availableWidth, height: availableHeight },
        room: { width: layout.room_width, height: layout.room_height },
        gridSizes: { byWidth: gridSizeByWidth, byHeight: gridSizeByHeight },
        final: finalGridSize
      });
      
      setGridSize(finalGridSize);
    };
    
    // Calculate on mount and when layout changes
    calculateOptimalGridSize();
    
    // Recalculate on window resize
    const handleResize = () => {
      calculateOptimalGridSize();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [layout]);
  
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
      ref: canvasRef,
      className: `seating-canvas ${draggedStudent ? "drag-active" : ""}`,
      style: {
        ...LayoutStyles.getCanvasContainerStyle(layout.room_width, layout.room_height, gridSize),
        position: "relative",
        margin: "auto",
      },
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
            
            // Add hover effect for empty seats (visual feedback for click-to-fill)
            seatStyle.transition = 'all 0.2s ease';
            seatStyle.cursor = 'pointer';
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
          } ${genderClass} ${!assignedStudent && !isDeactivated ? "fillable" : ""}`.trim();
          
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
                cursor: isDeactivated ? "not-allowed" : "pointer",
              },
              onClick: (e) => onSeatClick(table.id, seat.seat_number, e),
              onMouseEnter: !assignedStudent && !isDeactivated ? (e) => {
                // Visual feedback on hover for fillable seats
                e.currentTarget.style.backgroundColor = '#bfdbfe';  // Darker blue on hover
                e.currentTarget.style.borderColor = '#3b82f6';      // Brighter blue border
                e.currentTarget.style.transform = 'scale(1.05)';    // Slight grow effect
              } : undefined,
              onMouseLeave: !assignedStudent && !isDeactivated ? (e) => {
                // Reset styles on mouse leave
                e.currentTarget.style.backgroundColor = '#e0f2fe';
                e.currentTarget.style.borderColor = '#7dd3fc';
                e.currentTarget.style.transform = 'scale(1)';
              } : undefined,

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
  // Action button props
  onSave,
  onUndo,
  onReset,
  hasUnsavedChanges,
  canUndo,
  saving,
  historyIndex,
  history,
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
      style: {
        width: "250px",
        flexShrink: 0,
        borderLeft: "1px solid #e5e7eb",
        backgroundColor: "#f9fafb",
        padding: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
      },
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

    // Sort dropdown at top (fixed)
    React.createElement(
      "div",
      { 
        className: "pool-actions",
        style: {
          padding: "0.5rem",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          backgroundColor: "white",
          position: "relative",
          flexShrink: 0,
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

    // Student grid - fixed height and scrollable
    React.createElement(
      "div",
      { 
        className: "student-grid",
        style: {
          height: "420px",
          overflowY: "auto",
          overflowX: "hidden",
        }
      },
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
    ),
    
    // Action buttons fixed at bottom
    React.createElement(
      "div",
      {
        style: {
          padding: "0.5rem",
          borderTop: "1px solid #e5e7eb",
          backgroundColor: "white",
          display: "flex",
          gap: "0.5rem",
          flexShrink: 0,
        }
      },
      React.createElement(
        "button",
        {
          className: "btn btn-sm",
          style: { 
            flex: 1,
            ...(hasUnsavedChanges ? { backgroundColor: "#10b981", borderColor: "#10b981", color: "white" } : {})
          },
          onClick: onSave,
          disabled: saving,
        },
        React.createElement("i", { className: "fas fa-save" }),
        saving ? " Saving..." : " Save"
      ),
      React.createElement(
        "button",
        {
          className: `btn btn-sm ${canUndo ? "btn-warning" : "btn-secondary"}`,
          style: { flex: 1 },
          onClick: onUndo,
          disabled: !canUndo,
          title: canUndo ? `Undo: ${history[historyIndex]?.description}` : "Nothing to undo",
        },
        React.createElement("i", { className: "fas fa-undo" }),
        " Undo"
      ),
      React.createElement(
        "button",
        {
          className: "btn btn-sm btn-secondary",
          style: { flex: 1 },
          onClick: onReset,
        },
        React.createElement("i", { className: "fas fa-times" }),
        " Reset"
      )
    )
  );
};

// Export
if (typeof window !== "undefined") {
  window.SeatingEditor = SeatingEditor;
}
