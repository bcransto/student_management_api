// frontend/special-points/SpecialPointsVisual.js
// Visual special points editor using seating chart layout

const { useState, useEffect, useRef } = React;

const SpecialPointsVisual = ({ classId, onBack, navigateTo }) => {
  // Core state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Data state
  const [classInfo, setClassInfo] = useState(null);
  const [layout, setLayout] = useState(null);
  const [students, setStudents] = useState([]);
  const [roster, setRoster] = useState([]); // Full roster entries with emails
  const [assignments, setAssignments] = useState({});
  const [gridSize, setGridSize] = useState(60);

  // Points state
  const [pointTotals, setPointTotals] = useState({}); // email -> {points}
  const [pendingAwards, setPendingAwards] = useState({}); // rosterId -> number
  const [pointsLoading, setPointsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState(null); // null or error message string
  const [pointAnnouncements, setPointAnnouncements] = useState([]);

  // Class dropdown state
  const [teacherClasses, setTeacherClasses] = useState([]);
  const [showClassDropdown, setShowClassDropdown] = useState(false);

  // Refs
  const containerRef = useRef(null);
  const pressTimerRef = useRef(null);
  const isLongPressRef = useRef(false);

  // Load initial data
  useEffect(() => {
    if (classId) {
      loadClassData();
    }
  }, [classId]);

  // Load teacher's classes for dropdown
  useEffect(() => {
    loadTeacherClasses();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showClassDropdown && !event.target.closest(".spv-class-dropdown-btn")) {
        setShowClassDropdown(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showClassDropdown]);

  // Auto-scale to fit container
  useEffect(() => {
    const calculateGridSize = () => {
      if (!containerRef.current || !layout) return;

      const container = containerRef.current;
      const containerWidth = container.clientWidth - 20;
      const containerHeight = container.clientHeight - 20;

      const scaleX = containerWidth / (layout.room_width * 60);
      const scaleY = containerHeight / (layout.room_height * 60);
      const scale = Math.min(scaleX, scaleY, 1.5);

      setGridSize(Math.floor(60 * scale));
    };

    calculateGridSize();
    window.addEventListener("resize", calculateGridSize);
    return () => window.removeEventListener("resize", calculateGridSize);
  }, [layout]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved point changes. Are you sure you want to leave?";
        return "You have unsaved point changes. Are you sure you want to leave?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Load class data, seating layout, and point totals
  const loadClassData = async () => {
    try {
      setLoading(true);
      setConnectionError(false);

      // Check cache for shared data (layout, students, assignments)
      if (!window._visualDataCache) window._visualDataCache = {};
      const cached = window._visualDataCache[classId];
      let classData;

      if (cached) {
        console.log("Using cached visual data for class:", classId);
        classData = { ...cached.classInfo, roster: cached.roster };
        setClassInfo(cached.classInfo);
        setRoster(cached.roster || []);
        setStudents(cached.students);
        setLayout(cached.layout);
        setAssignments(cached.assignments);
      } else {
        // Load class info with roster
        classData = await window.ApiModule.request(`/classes/${classId}/`);
        setClassInfo(classData);
        setRoster(classData.roster || []);

        // Extract students from roster
        let studentList = [];
        if (classData.roster && Array.isArray(classData.roster)) {
          studentList = classData.roster.map((r) => ({
            id: r.student,
            rosterId: r.id,
            first_name: r.student_first_name,
            last_name: r.student_last_name,
            nickname: r.student_nickname || r.student_first_name,
            student_id: r.student_id,
            email: r.student_email,
          }));
          setStudents(studentList);
        }

        // Load seating period and layout
        let layoutData = null;
        let currentPeriod = null;
        let assignmentMap = {};

        try {
          const periodsResponse = await window.ApiModule.request(
            `/seating-periods/?class_assigned=${classId}`
          );
          const periods = periodsResponse.results || [];

          currentPeriod = periods.find((p) => p.end_date === null);
          if (!currentPeriod && periods.length > 0) {
            periods.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
            currentPeriod = periods[0];
          }

          if (currentPeriod) {
            const fullPeriod = await window.ApiModule.request(
              `/seating-periods/${currentPeriod.id}/`
            );
            currentPeriod = fullPeriod;

            if (fullPeriod.layout_details) {
              layoutData = fullPeriod.layout_details;
              setLayout(layoutData);
            }
          }

          // Fallback to user's most recent layout
          if (!layoutData) {
            const layoutsResponse = await window.ApiModule.request("/layouts/");
            const userLayouts = layoutsResponse.results || layoutsResponse;

            if (userLayouts.length > 0) {
              layoutData = await window.ApiModule.request(`/layouts/${userLayouts[0].id}/`);
              setLayout(layoutData);
            }
          }

          // Load seating assignments
          if (currentPeriod && currentPeriod.seating_assignments && layoutData) {
            currentPeriod.seating_assignments.forEach((assignment) => {
              const table = layoutData.tables?.find(
                (t) => t.table_number === assignment.table_number
              );
              if (table) {
                const tableId = String(table.id);
                const seatNumber = String(assignment.seat_number);
                const rosterEntry = classData.roster.find((r) => r.id === assignment.roster_entry);

                if (rosterEntry) {
                  if (!assignmentMap[tableId]) {
                    assignmentMap[tableId] = {};
                  }
                  assignmentMap[tableId][seatNumber] = rosterEntry.student;
                }
              }
            });
            setAssignments(assignmentMap);
          }
        } catch (error) {
          console.log("Error loading seating data:", error);
        }

        // Cache shared data for fast mode switching
        window._visualDataCache[classId] = {
          classInfo: classData,
          layout: layoutData,
          assignments: assignmentMap,
          students: studentList,
          roster: classData.roster,
          timestamp: Date.now(),
        };
      }

      // Fetch point totals
      await fetchPointTotals(classData.roster || []);
    } catch (error) {
      console.error("Failed to load class data:", error);
      alert("Failed to load class information. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch point totals from Cranston Commons
  const fetchPointTotals = async (rosterList) => {
    const emails = rosterList.map((r) => r.student_email).filter((email) => email && email.trim());

    if (emails.length === 0) {
      setPointTotals({});
      return;
    }

    try {
      setPointsLoading(true);
      setConnectionError(null);

      const response = await window.ApiModule.request("/special-points/fetch/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });

      if (response.error) {
        setConnectionError(response.error);
        setPointTotals({});
        return;
      }

      setPointTotals(response.students || {});
    } catch (error) {
      console.error("Failed to fetch point totals:", error);
      setConnectionError("Unable to connect to Cranston Commons");
      setPointTotals({});
    } finally {
      setPointsLoading(false);
    }
  };

  // Load teacher's classes for dropdown
  const loadTeacherClasses = async () => {
    try {
      const response = await window.ApiModule.request("/classes/");
      const classes = response.results || response;
      setTeacherClasses(classes);
    } catch (error) {
      console.error("Failed to load teacher's classes:", error);
    }
  };

  // Handle class selection from dropdown
  const handleClassSelect = (selectedClassId) => {
    setShowClassDropdown(false);

    if (selectedClassId !== parseInt(classId)) {
      const newHash = `special-points/visual/${selectedClassId}`;
      window.location.hash = newHash;
      window.location.reload();
    }
  };

  // Get student info by looking up assignments
  const getStudentForSeat = (tableId, seatNumber) => {
    const studentId = assignments[String(tableId)]?.[String(seatNumber)];
    if (!studentId) return null;
    return students.find((s) => s.id === studentId) || null;
  };

  // Get roster entry for a student
  const getRosterForStudent = (studentId) => {
    return roster.find((r) => r.student === studentId) || null;
  };

  // Track whether current interaction started from touch (to ignore emulated mouse events)
  const isTouchRef = useRef(false);
  // Store the seat element for long-press animation (e.currentTarget is stale in setTimeout)
  const seatElementRef = useRef(null);

  // Handle seat mouse/touch down (start press timer)
  const handleSeatPointerDown = (e, student, rosterId, source) => {
    if (!student || !rosterId) return;

    // If this is a mouse event but we already handled touch, skip (emulated event)
    if (source === "mouse" && isTouchRef.current) return;
    if (source === "touch") isTouchRef.current = true;

    const rosterEntry = getRosterForStudent(student.id);
    if (!rosterEntry || !rosterEntry.student_email) return;

    e.preventDefault();
    isLongPressRef.current = false;
    // Capture the element now since e.currentTarget will be null in setTimeout
    seatElementRef.current = e.currentTarget;

    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      // Long press = -1 (use stored element for animation)
      updatePendingAward(rosterId, -1, student, seatElementRef.current);
    }, 500);
  };

  // Handle seat mouse/touch up (short tap = +1)
  const handleSeatPointerUp = (e, student, rosterId, source) => {
    if (!student || !rosterId) return;

    // If this is a mouse event but we already handled touch, skip (emulated event)
    if (source === "mouse" && isTouchRef.current) return;

    clearTimeout(pressTimerRef.current);

    if (!isLongPressRef.current) {
      const rosterEntry = getRosterForStudent(student.id);
      if (!rosterEntry || !rosterEntry.student_email) return;

      // Short tap = +1
      updatePendingAward(rosterId, 1, student, e.currentTarget);
    }

    // Reset touch flag after a brief delay (after emulated mouse events have fired)
    if (source === "touch") {
      setTimeout(() => {
        isTouchRef.current = false;
      }, 300);
    }
  };

  // Cancel press on pointer leave or touch move (prevents accidental triggers while scrolling)
  const handleSeatPointerLeave = () => {
    clearTimeout(pressTimerRef.current);
  };

  const handleSeatTouchMove = () => {
    clearTimeout(pressTimerRef.current);
  };

  // Update pending award and show announcement
  // seatEl is the DOM element (passed directly, not from event)
  const updatePendingAward = (rosterId, delta, student, seatEl) => {
    setPendingAwards((prev) => {
      const newAwards = {
        ...prev,
        [rosterId]: (prev[rosterId] || 0) + delta,
      };

      // Check if any non-zero
      const hasChanges = Object.values(newAwards).some((v) => v !== 0);
      setHasUnsavedChanges(hasChanges);

      return newAwards;
    });

    // Visual feedback
    if (seatEl) {
      seatEl.style.transform = "scale(1.15)";
      setTimeout(() => {
        seatEl.style.transform = "";
      }, 200);
    }

    // Show floating announcement
    if (seatEl) {
      const rect = seatEl.getBoundingClientRect();
      const announcementId = `${rosterId}-${Date.now()}`;
      const sign = delta > 0 ? "+" : "";
      const text = `${student.nickname} ${sign}${delta}`;
      const color = delta > 0 ? "#10b981" : "#ef4444";

      setPointAnnouncements((prev) => [
        ...prev,
        {
          id: announcementId,
          text,
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
          color,
        },
      ]);

      setTimeout(() => {
        setPointAnnouncements((prev) => prev.filter((a) => a.id !== announcementId));
      }, 1500);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!hasUnsavedChanges) return;

    try {
      setSaving(true);

      // Build awards array from non-zero pending awards
      const awards = [];
      Object.keys(pendingAwards).forEach((rosterId) => {
        const value = pendingAwards[rosterId];
        if (value === 0) return;

        // Find the student's email
        const rosterEntry = roster.find((r) => r.id === parseInt(rosterId));
        if (rosterEntry && rosterEntry.student_email) {
          awards.push({
            email: rosterEntry.student_email,
            points: value,
            reason: "",
          });
        }
      });

      if (awards.length === 0) {
        setSaving(false);
        return;
      }

      const response = await window.ApiModule.request("/special-points/award/batch/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ awards }),
      });

      if (response.error) {
        alert("Failed to save: " + response.error);
        setSaving(false);
        return;
      }

      // Update totals from response
      if (response.results && Array.isArray(response.results)) {
        const newTotals = { ...pointTotals };
        response.results.forEach((result) => {
          if (newTotals[result.email]) {
            newTotals[result.email].points = result.new_total;
          } else {
            newTotals[result.email] = { points: result.new_total };
          }
        });
        setPointTotals(newTotals);
      }

      // Reset pending awards
      setPendingAwards({});
      setHasUnsavedChanges(false);

      // Show success on button
      const saveBtn = document.querySelector(".spv-btn-save");
      if (saveBtn) {
        saveBtn.textContent = "\u2713 Saved";
        setTimeout(() => {
          saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
        }, 2000);
      }
    } catch (error) {
      console.error("Failed to save points:", error);
      alert("Failed to save points. Please try again.");
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

    if (onBack && typeof onBack === "function") {
      onBack();
    } else {
      window.location.hash = "special-points";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  };

  // Render loading state
  if (loading) {
    return React.createElement(
      "div",
      { className: "spv-container" },
      React.createElement(
        "div",
        { className: "spv-loading" },
        React.createElement("i", {
          className: "fas fa-spinner fa-spin fa-3x",
        }),
        React.createElement("p", null, "Loading special points...")
      )
    );
  }

  // Render main component
  return React.createElement(
    "div",
    { className: "spv-container" },

    // Header
    React.createElement(
      "div",
      { className: "spv-header" },

      // Back button
      React.createElement(
        "button",
        {
          className: "spv-btn-back",
          onClick: handleBack,
          title: "Back to class list",
        },
        React.createElement("i", { className: "fas fa-arrow-left" })
      ),

      // Class info with dropdown
      React.createElement(
        "div",
        { className: "spv-header-info" },
        // Class dropdown
        React.createElement(
          "div",
          { style: { position: "relative", display: "inline-block" } },
          React.createElement(
            "button",
            {
              className: "spv-class-dropdown-btn",
              onClick: () => setShowClassDropdown(!showClassDropdown),
              style: {
                background: "transparent",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                padding: "6px 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#374151",
              },
            },
            React.createElement("span", null, classInfo?.name || "Class"),
            React.createElement("i", {
              className: `fas fa-chevron-${showClassDropdown ? "up" : "down"}`,
              style: { fontSize: "12px" },
            })
          ),
          // Dropdown menu
          showClassDropdown &&
            React.createElement(
              "div",
              {
                style: {
                  position: "absolute",
                  top: "100%",
                  left: "0",
                  marginTop: "4px",
                  background: "white",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                  minWidth: "200px",
                  maxHeight: "300px",
                  overflowY: "auto",
                  zIndex: 100,
                },
              },
              teacherClasses.length > 0
                ? teacherClasses.map((cls) =>
                    React.createElement(
                      "button",
                      {
                        key: cls.id,
                        onClick: () => handleClassSelect(cls.id),
                        style: {
                          display: "block",
                          width: "100%",
                          padding: "8px 12px",
                          textAlign: "left",
                          border: "none",
                          background: cls.id === parseInt(classId) ? "#f3f4f6" : "transparent",
                          cursor: "pointer",
                          fontSize: "14px",
                          color: "#374151",
                          borderBottom: "1px solid #f3f4f6",
                        },
                        onMouseEnter: (e) => (e.target.style.background = "#f9fafb"),
                        onMouseLeave: (e) =>
                          (e.target.style.background =
                            cls.id === parseInt(classId) ? "#f3f4f6" : "transparent"),
                      },
                      React.createElement(
                        "div",
                        null,
                        React.createElement("div", { style: { fontWeight: "600" } }, cls.name),
                        React.createElement(
                          "div",
                          {
                            style: { fontSize: "12px", color: "#6b7280" },
                          },
                          cls.subject
                        )
                      )
                    )
                  )
                : React.createElement(
                    "div",
                    {
                      style: {
                        padding: "12px",
                        color: "#6b7280",
                        fontSize: "14px",
                      },
                    },
                    "No classes available"
                  )
            )
        ),
        // "Special Points" label
        React.createElement(
          "span",
          {
            style: {
              marginLeft: "12px",
              color: "#6366f1",
              fontWeight: "600",
              fontSize: "14px",
            },
          },
          "Special Points"
        )
      ),

      // Mode toggle button (only for authorized user)
      window.AuthModule.getUserInfo()?.email === "bcranston@carlisle.k12.ma.us" &&
        React.createElement(
          "button",
          {
            onClick: () => {
              if (
                hasUnsavedChanges &&
                !confirm("You have unsaved point changes. Switch to Attendance mode?")
              )
                return;
              window.location.hash = "attendance/visual/" + classId;
            },
            style: {
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "6px",
              padding: "6px 12px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "14px",
              fontWeight: "500",
              marginLeft: "auto",
            },
            title: "Switch to Attendance mode",
          },
          React.createElement("i", { className: "fas fa-clipboard-check" }),
          "Attendance"
        ),

      // Save button
      React.createElement(
        "button",
        {
          className: `spv-btn-save ${hasUnsavedChanges ? "has-changes" : ""}`,
          onClick: handleSave,
          disabled: saving || !hasUnsavedChanges,
          title: hasUnsavedChanges ? "Save changes" : "No changes to save",
        },
        saving
          ? React.createElement("i", {
              className: "fas fa-spinner fa-spin",
            })
          : React.createElement("i", { className: "fas fa-save" }),
        saving ? " Saving" : " Save"
      )
    ),

    // Connection error banner
    connectionError &&
      React.createElement(
        "div",
        {
          style: {
            background: "#fef2f2",
            border: "1px solid #fecaca",
            padding: "6px 12px",
            color: "#991b1b",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
          },
        },
        React.createElement("i", {
          className: "fas fa-exclamation-triangle",
        }),
        connectionError
      ),

    // Legend
    React.createElement(
      "div",
      {
        className: "spv-legend",
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
          zIndex: 10,
        },
      },
      [
        { color: "#6366f1", label: "Total Points" },
        { color: "#10b981", label: "Positive" },
        { color: "#ef4444", label: "Negative" },
      ].map((item) =>
        React.createElement(
          "div",
          {
            key: item.label,
            style: {
              display: "flex",
              alignItems: "center",
              gap: "4px",
            },
          },
          React.createElement("div", {
            style: {
              width: "12px",
              height: "12px",
              backgroundColor: item.color,
              borderRadius: "50%",
            },
          }),
          React.createElement("span", null, item.label)
        )
      )
    ),

    // Seating grid area
    React.createElement(
      "div",
      {
        className: "spv-canvas-container",
        ref: containerRef,
      },

      layout
        ? React.createElement(
            "div",
            {
              className: "spv-grid",
              style: {
                position: "relative",
                width: `${layout.room_width * gridSize}px`,
                height: `${layout.room_height * gridSize}px`,
                background: "white",
                border: "1px solid #d0d0d0",
                borderRadius: "4px",
                margin: "auto",
              },
            },

            // Render tables
            layout.tables?.map((table) =>
              React.createElement(
                "div",
                {
                  key: table.id,
                  className: "spv-table",
                  style: {
                    position: "absolute",
                    left: `${table.x_position * gridSize}px`,
                    top: `${table.y_position * gridSize}px`,
                    width: `${table.width * gridSize}px`,
                    height: `${table.height * gridSize}px`,
                    backgroundColor: "#e8f4f8",
                    border: "2px solid #9ca3af",
                    borderRadius: table.table_shape === "round" ? "50%" : "6px",
                  },
                },

                // Table number
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
                      zIndex: 0,
                    },
                  },
                  table.table_number
                ),

                // Render seats
                table.seats?.map((seat) => {
                  const seatKey = String(seat.seat_number);
                  const tableKey = String(table.id);
                  const studentId = assignments[tableKey]?.[seatKey];
                  const student = studentId ? students.find((s) => s.id === studentId) : null;
                  const rosterId = student ? student.rosterId : null;
                  const hasEmail = student && student.email;

                  // Get point totals for this student
                  const studentPoints =
                    student && student.email ? pointTotals[student.email] : null;
                  const pending = rosterId ? pendingAwards[rosterId] || 0 : 0;

                  // Seat styling
                  const seatStyle = window.LayoutStyles?.getSeatStyle
                    ? window.LayoutStyles.getSeatStyle(seat, {
                        isOccupied: !!student,
                        isSelected: false,
                        isAccessible: false,
                        gridSize: gridSize,
                        showName: !!student,
                      })
                    : {
                        position: "absolute",
                        left:
                          seat.relative_x !== undefined
                            ? `calc(${seat.relative_x * 100}% - ${gridSize * 0.4}px)`
                            : `${seat.x_position * gridSize}px`,
                        top:
                          seat.relative_y !== undefined
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
                        zIndex: 1,
                      };

                  // Color seats based on whether student has points
                  if (student && hasEmail && studentPoints) {
                    seatStyle.backgroundColor = "#ede9fe"; // Light purple
                    seatStyle.border = "2px solid #6366f1";
                  } else if (student && !hasEmail) {
                    seatStyle.backgroundColor = "#f3f4f6";
                    seatStyle.border = "2px solid #d1d5db";
                  }

                  const finalSeatStyle = {
                    ...seatStyle,
                    position: seatStyle.position || "absolute",
                    overflow: "visible",
                    zIndex: 1,
                  };

                  return React.createElement(
                    "div",
                    {
                      key: seat.seat_number,
                      className: "spv-seat",
                      style: finalSeatStyle,
                      onMouseDown: (e) => handleSeatPointerDown(e, student, rosterId, "mouse"),
                      onMouseUp: (e) => handleSeatPointerUp(e, student, rosterId, "mouse"),
                      onMouseLeave: handleSeatPointerLeave,
                      onTouchStart: (e) => handleSeatPointerDown(e, student, rosterId, "touch"),
                      onTouchEnd: (e) => handleSeatPointerUp(e, student, rosterId, "touch"),
                      onTouchMove: handleSeatTouchMove,
                      onContextMenu: (e) => e.preventDefault(),
                      title: student
                        ? `${student.first_name} ${student.last_name}${
                            studentPoints ? ` - ${studentPoints.points} pts` : ""
                          }`
                        : `Seat ${seat.seat_number}`,
                    },

                    // Inner container for badge placement
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
                          overflow: "visible",
                        },
                      },

                      // Total points badge (top-left, purple)
                      student && hasEmail && !connectionError
                        ? React.createElement(
                            "div",
                            {
                              style: {
                                position: "absolute",
                                top: "-6px",
                                left: "-6px",
                                minWidth: `${gridSize * 0.25}px`,
                                height: `${gridSize * 0.25}px`,
                                backgroundColor: "#6366f1",
                                color: "white",
                                borderRadius: `${gridSize * 0.125}px`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: `${gridSize * 0.13}px`,
                                fontWeight: "bold",
                                zIndex: 10,
                                border: "1px solid white",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                                padding: "0 3px",
                              },
                              title: studentPoints
                                ? `${studentPoints.points} total points`
                                : "Loading...",
                            },
                            pointsLoading
                              ? "..."
                              : studentPoints
                                ? String(studentPoints.points)
                                : "?"
                          )
                        : null,

                      // Pending award badge (top-right, green/red)
                      rosterId && pending !== 0
                        ? React.createElement(
                            "div",
                            {
                              style: {
                                position: "absolute",
                                top: "-6px",
                                right: "-6px",
                                minWidth: `${gridSize * 0.25}px`,
                                height: `${gridSize * 0.25}px`,
                                backgroundColor: pending > 0 ? "#10b981" : "#ef4444",
                                color: "white",
                                borderRadius: `${gridSize * 0.125}px`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: `${gridSize * 0.13}px`,
                                fontWeight: "bold",
                                zIndex: 10,
                                border: "1px solid white",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                                padding: "0 3px",
                              },
                              title: `Pending: ${pending > 0 ? "+" : ""}${pending}`,
                            },
                            `${pending > 0 ? "+" : ""}${pending}`
                          )
                        : null,

                      // Student name or seat number
                      student
                        ? React.createElement(
                            "div",
                            {
                              style: {
                                textAlign: "center",
                                width: "100%",
                                overflow: "hidden",
                                padding: "2px",
                              },
                            },
                            React.createElement(
                              "div",
                              {
                                style: {
                                  fontWeight: "bold",
                                  fontSize: `${gridSize * 0.2}px`,
                                  lineHeight: "1.1",
                                  overflow: "hidden",
                                  whiteSpace: "nowrap",
                                  color: "#374151",
                                },
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
                                  color: "#374151",
                                },
                              },
                              student.last_name.substring(0, 3) + "."
                            )
                          )
                        : React.createElement(
                            "div",
                            {
                              style: {
                                color: "#9ca3af",
                                fontSize: `${gridSize * 0.25}px`,
                              },
                            },
                            seat.seat_number
                          )
                    )
                  );
                })
              )
            )
          )
        : React.createElement(
            "div",
            { className: "spv-no-layout" },
            React.createElement("i", {
              className: "fas fa-th fa-3x",
            }),
            React.createElement("h3", null, "No Seating Layout"),
            React.createElement("p", null, "This class needs a seating layout for visual points.")
          )
    ),

    // Floating point announcements
    pointAnnouncements.map((announcement) =>
      React.createElement(
        "div",
        {
          key: announcement.id,
          className: "spv-announcement",
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
            animation: "floatUp 1.5s ease-out forwards",
          },
        },
        announcement.text
      )
    )
  );
};

window.SpecialPointsVisual = SpecialPointsVisual;
console.log("SpecialPointsVisual component loaded and exported to window.SpecialPointsVisual");
