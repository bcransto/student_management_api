// SeatingEditor with Updated Layout
// Secondary toolbar below main toolbar, student pool on right side

const SeatingEditorUpdated = ({ classId, onBack }) => {
  // ... (keep all the existing state and functions from original)
  // Only showing the modified render structure here
  
  // Main render with new layout
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
      React.createElement(
        "h2",
        { className: "editor-title" },
        `Seating Chart: ${classInfo?.name || "Loading..."}`
      ),
      // Student count status badge
      React.createElement(
        "div",
        { className: "status-badge", style: { marginLeft: "auto" } },
        `${getAssignedStudentIds().size} / ${students.length} seated`
      )
    ),

    // Secondary toolbar (replaces right sidebar content)
    React.createElement(
      "div",
      { className: "secondary-toolbar" },
      
      // Auto-fill section
      React.createElement(
        "div",
        { className: "toolbar-section" },
        React.createElement("span", { className: "toolbar-label" }, "Auto-fill:"),
        React.createElement(
          "div",
          { className: "auto-fill-buttons" },
          React.createElement(
            "button",
            {
              className: "btn btn-sm btn-outline",
              onClick: () => handleAutoFill("alphabetical"),
            },
            React.createElement("i", { className: "fas fa-sort-alpha-down" }),
            " A-Z"
          ),
          React.createElement(
            "button",
            {
              className: "btn btn-sm btn-outline",
              onClick: () => handleAutoFill("random"),
            },
            React.createElement("i", { className: "fas fa-random" }),
            " Random"
          ),
          React.createElement(
            "button",
            {
              className: "btn btn-sm btn-outline",
              onClick: () => handleAutoFill("boy-girl"),
            },
            React.createElement("i", { className: "fas fa-venus-mars" }),
            " Boy-Girl"
          )
        )
      ),

      // View options section
      React.createElement(
        "div",
        { className: "toolbar-section" },
        React.createElement("span", { className: "toolbar-label" }, "View:"),
        React.createElement(
          "div",
          { className: "view-options" },
          React.createElement(
            "label",
            { className: "radio-label" },
            React.createElement("input", {
              type: "radio",
              name: "highlight",
              checked: highlightMode === "none",
              onChange: () => setHighlightMode("none"),
            }),
            " Normal"
          ),
          React.createElement(
            "label",
            { className: "radio-label" },
            React.createElement("input", {
              type: "radio",
              name: "highlight",
              checked: highlightMode === "gender",
              onChange: () => setHighlightMode("gender"),
            }),
            " Gender"
          ),
          React.createElement(
            "label",
            { className: "radio-label" },
            React.createElement("input", {
              type: "radio",
              name: "highlight",
              checked: highlightMode === "previous",
              onChange: () => setHighlightMode("previous"),
            }),
            " Previous"
          )
        )
      ),

      // Action buttons
      React.createElement(
        "div",
        { className: "toolbar-actions" },
        React.createElement(
          "button",
          {
            className: "btn btn-sm btn-secondary",
            onClick: onBack,
          },
          "Cancel"
        ),
        React.createElement(
          "button",
          {
            className: "btn btn-sm btn-primary",
            onClick: handleSave,
            disabled: saving,
          },
          saving ? "Saving..." : "Save"
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
              onSeatClick: handleSeatClick,
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
        React.createElement(StudentPoolSide, {
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

// Updated Student Pool component for side layout
const StudentPoolSide = ({
  students,
  selectedStudent,
  onSelectStudent,
  onDragStart,
  onDragEnd,
  onStudentReturn,
}) => {
  return React.createElement(
    "div",
    {
      className: "student-pool",
      // Accept drops from seats
      onDragOver: (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        e.currentTarget.classList.add("drop-target");
      },
      onDragLeave: (e) => {
        e.currentTarget.classList.remove("drop-target");
      },
      onDrop: (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove("drop-target");

        const studentId = parseInt(e.dataTransfer.getData("studentId"));
        const sourceType = e.dataTransfer.getData("sourceType");

        if (studentId && sourceType === "seat") {
          const sourceTableId = parseInt(e.dataTransfer.getData("sourceTableId"));
          const sourceSeatNumber = parseInt(e.dataTransfer.getData("sourceSeatNumber"));
          onStudentReturn(sourceTableId, sourceSeatNumber);
        }
      },
    },

    // Header
    React.createElement(
      "div",
      { className: "pool-header" },
      React.createElement("h3", null, `Students (${students.length})`),
      React.createElement(
        "select",
        { className: "pool-sort" },
        React.createElement("option", null, "A → Z"),
        React.createElement("option", null, "Z → A"),
        React.createElement("option", null, "Random")
      )
    ),

    // Student list (vertical for side panel)
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
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("studentId", student.id.toString());
              e.dataTransfer.setData("sourceType", "pool");
              onDragStart(student);
              e.currentTarget.classList.add("dragging");
            },
            onDragEnd: (e) => {
              e.currentTarget.classList.remove("dragging");
              onDragEnd();
            },
          },
          React.createElement(
            "div",
            { className: "student-avatar" },
            student.gender === "F" ? "👧" : "👦"
          ),
          React.createElement(
            "div",
            { className: "student-name" },
            `${student.first_name} ${student.last_name}`
          )
        )
      )
    )
  );
};

// Helper function for auto-fill
const handleAutoFill = (mode) => {
  // Implementation for auto-fill
  if (mode === "alphabetical") {
    // Sort students alphabetically and assign to seats
    const sortedStudents = [...getUnassignedStudents()].sort((a, b) => 
      a.last_name.localeCompare(b.last_name)
    );
    autoAssignStudents(sortedStudents);
  } else if (mode === "random") {
    // Randomly shuffle and assign
    const shuffled = [...getUnassignedStudents()].sort(() => Math.random() - 0.5);
    autoAssignStudents(shuffled);
  } else if (mode === "boy-girl") {
    // Alternate boy-girl pattern
    const boys = getUnassignedStudents().filter(s => s.gender === "M");
    const girls = getUnassignedStudents().filter(s => s.gender === "F");
    const alternated = [];
    const maxLength = Math.max(boys.length, girls.length);
    
    for (let i = 0; i < maxLength; i++) {
      if (i < boys.length) alternated.push(boys[i]);
      if (i < girls.length) alternated.push(girls[i]);
    }
    autoAssignStudents(alternated);
  }
};

const autoAssignStudents = (studentList) => {
  const newAssignments = { ...assignments };
  let studentIndex = 0;
  
  // Get all available seats
  if (layout && layout.tables) {
    for (const table of layout.tables) {
      if (!newAssignments[table.id]) {
        newAssignments[table.id] = {};
      }
      
      for (let seatNum = 1; seatNum <= table.max_seats; seatNum++) {
        if (!newAssignments[table.id][seatNum] && studentIndex < studentList.length) {
          newAssignments[table.id][seatNum] = studentList[studentIndex].id;
          studentIndex++;
        }
      }
    }
  }
  
  setAssignments(newAssignments);
};

// Export
if (typeof window !== "undefined") {
  window.SeatingEditorUpdated = SeatingEditorUpdated;
}