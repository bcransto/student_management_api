// frontend/seating/SeatingEditor.js
// Integrated Seating Chart Editor

const { useState, useEffect } = React;

const SeatingEditor = ({ classId, onBack }) => {
  // Core state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data state
  const [classInfo, setClassInfo] = useState(null);
  const [layout, setLayout] = useState(null);
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState({}); // {tableId: {seatNumber: studentId}}

  // UI state
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [highlightMode, setHighlightMode] = useState("none"); // none, gender, previous
  const [draggedStudent, setDraggedStudent] = useState(null);

  // Load initial data
  useEffect(() => {
    loadClassData();
  }, [classId]);

  const loadClassData = async () => {
    try {
      setLoading(true);
      console.log("Loading data for class:", classId);

      // Load class info
      const classData = await window.ApiModule.request(`/classes/${classId}/`);
      console.log("Class data loaded:", classData);
      setClassInfo(classData);

      // Load the layout for this class
      if (classData.classroom_layout) {
        // The layout is already embedded in the class data
        console.log("Layout found in class data:", classData.classroom_layout);
        setLayout(classData.classroom_layout);
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
        classData.current_seating_period.seating_assignments.length > 0
      ) {
        console.log(
          "Loading seating assignments:",
          classData.current_seating_period.seating_assignments
        );
        // Convert assignments to our format: {tableId: {seatNumber: studentId}}
        const assignmentMap = {};

        classData.current_seating_period.seating_assignments.forEach(
          (assignment) => {
            // Find the table by table_number
            const table = classData.classroom_layout.tables.find(
              (t) => t.table_number === assignment.table_number
            );
            if (!table) {
              console.warn(
                `Table ${assignment.table_number} not found in layout`
              );
              return;
            }

            const tableId = table.id;
            const seatNumber = assignment.seat_number;

            // Find the student ID from the roster
            const rosterEntry = classData.roster.find(
              (r) => r.id === assignment.roster_entry
            );
            const studentId = rosterEntry ? rosterEntry.student : null;

            if (!studentId) {
              console.warn(
                `Student not found for roster entry ${assignment.roster_entry}`
              );
              return;
            }

            console.log(
              `Assignment: Table ${tableId} (number ${assignment.table_number}), Seat ${seatNumber}, Student ${studentId} (${assignment.student_name})`
            );

            if (!assignmentMap[tableId]) {
              assignmentMap[tableId] = {};
            }
            assignmentMap[tableId][seatNumber] = studentId;
          }
        );

        console.log("Assignment map:", assignmentMap);
        setAssignments(assignmentMap);
      } else {
        console.log("No seating assignments found");
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

  const handleSave = async () => {
    try {
      setSaving(true);
      // TODO: Implement save to API
      alert("Seating chart saved!");
      if (onBack) onBack();
    } catch (error) {
      console.error("Failed to save:", error);
      alert("Failed to save seating chart");
    } finally {
      setSaving(false);
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
      React.createElement(
        "p",
        null,
        "This class needs a layout before creating seating charts."
      ),
      React.createElement(
        "button",
        { className: "btn btn-primary", onClick: onBack },
        "Go Back"
      )
    );
  }

  return React.createElement(
    "div",
    { className: "seating-editor-integrated" },

    // Main editor area
    React.createElement(
      "div",
      { className: "editor-main-area" },

      // Canvas and student pool wrapper
      React.createElement(
        "div",
        { className: "editor-content-wrapper" },

        // Canvas area
        React.createElement(
          "div",
          { className: "editor-canvas-section" },

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
            React.createElement(
              "h2",
              { className: "editor-title" },
              `Seating Chart: ${classInfo?.class_name || "Loading..."}`
            )
          ),

          // Canvas
          React.createElement(
            "div",
            { className: "seating-canvas-container" },
            React.createElement(SeatingCanvas, {
              layout: layout,
              assignments: assignments,
              students: students,
              highlightMode: highlightMode,
              onSeatClick: (tableId, seatNumber) => {
                // Handle seat click for assignment
                if (selectedStudent) {
                  handleSeatAssignment(selectedStudent.id, tableId, seatNumber);
                  setSelectedStudent(null);
                }
              },
              onStudentDrop: handleSeatAssignment,
              draggedStudent: draggedStudent,
            })
          )
        ),

        // Student pool at bottom
        React.createElement(StudentPool, {
          students: getUnassignedStudents(),
          selectedStudent: selectedStudent,
          onSelectStudent: setSelectedStudent,
          onDragStart: setDraggedStudent,
          onDragEnd: () => setDraggedStudent(null),
        })
      ),

      // Right sidebar
      React.createElement(SeatingEditorSidebar, {
        classInfo: classInfo,
        totalStudents: students.length,
        assignedCount: getAssignedStudentIds().size,
        highlightMode: highlightMode,
        onHighlightModeChange: setHighlightMode,
        onAutoFill: (mode) => {
          // TODO: Implement auto-fill
          alert(`Auto-fill: ${mode}`);
        },
        onSave: handleSave,
        onCancel: onBack,
        saving: saving,
      })
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
  draggedStudent,
}) => {
  // This will render the layout with students assigned to seats
  return React.createElement(
    "div",
    {
      className: "seating-canvas",
      style: {
        width: layout.room_width * 40,
        height: layout.room_height * 40,
        position: "relative",
        backgroundColor: "white",
        border: "2px solid #e5e7eb",
        margin: "0 auto",
      },
    },

    // Render tables with seats
    layout.tables?.map((table) =>
      React.createElement(
        "div",
        {
          key: table.id,
          className: "seating-table",
          style: {
            position: "absolute",
            left: table.x_position * 40,
            top: table.y_position * 40,
            width: table.width * 40,
            height: table.height * 40,
          },
        },

        // Table background
        React.createElement(
          "div",
          {
            className: "table-shape",
            style: {
              width: "100%",
              height: "100%",
              backgroundColor: "#e0e7ff",
              border: "2px solid #6366f1",
              borderRadius: table.table_shape === "round" ? "50%" : "8px",
              position: "relative",
            },
          },

          // Table label
          React.createElement(
            "div",
            {
              style: {
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                fontSize: "14px",
                fontWeight: "bold",
                color: "#4c1d95",
              },
            },
            table.table_name || `T${table.table_number}`
          )
        ),

        // Render seats
        table.seats?.map((seat) => {
          const assignedStudentId = assignments[table.id]?.[seat.seat_number];
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
                left: `${seat.relative_x * 100}%`,
                top: `${seat.relative_y * 100}%`,
                transform: "translate(-50%, -50%)",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: assignedStudent
                  ? assignedStudent.gender === "F"
                    ? "#fbbf24"
                    : "#60a5fa"
                  : "#e5e7eb",
                border: "2px solid",
                borderColor: assignedStudent
                  ? assignedStudent.gender === "F"
                    ? "#f59e0b"
                    : "#3b82f6"
                  : "#d1d5db",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "all 0.2s",
              },
              onClick: () => onSeatClick(table.id, seat.seat_number),
              title: assignedStudent
                ? `${assignedStudent.first_name} ${assignedStudent.last_name}`
                : `Seat ${seat.seat_number}`,
            },
            assignedStudent
              ? `${assignedStudent.first_name[0]}${assignedStudent.last_name[0]}`
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
          onClick: onSave,
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
const StudentPool = ({
  students,
  selectedStudent,
  onSelectStudent,
  onDragStart,
  onDragEnd,
}) => {
  return React.createElement(
    "div",
    { className: "student-pool" },

    // Header
    React.createElement(
      "div",
      { className: "pool-header" },
      React.createElement(
        "h3",
        null,
        `Unassigned Students (${students.length})`
      ),
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
            onDragStart: () => onDragStart(student),
            onDragEnd: onDragEnd,
          },
          React.createElement(
            "div",
            { className: "student-avatar" },
            student.gender === "F" ? "👧" : "👦"
          ),
          React.createElement(
            "div",
            { className: "student-name" },
            `${student.first_name} ${student.last_name[0]}.`
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
