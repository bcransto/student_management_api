// frontend/students/students.js
// Students Component - Extracted from frontend.html

const Students = ({ data, navigateTo, apiModule }) => {
  const { students } = data;
  const [searchTerm, setSearchTerm] = React.useState("");

  // Handle student row click - navigate to edit view
  const handleStudentClick = (studentId) => {
    console.log("Navigating to edit student:", studentId);
    navigateTo("student-edit", { studentId });
  };

  // Filter students based on search term
  const filteredStudents = React.useMemo(() => {
    if (!students || !searchTerm) return students || [];
    
    const term = searchTerm.toLowerCase();
    return students.filter(student => {
      return (
        student.student_id?.toLowerCase().includes(term) ||
        student.first_name?.toLowerCase().includes(term) ||
        student.last_name?.toLowerCase().includes(term) ||
        student.nickname?.toLowerCase().includes(term) ||
        student.email?.toLowerCase().includes(term) ||
        `${student.first_name} ${student.last_name}`.toLowerCase().includes(term)
      );
    });
  }, [students, searchTerm]);

  if (!students) {
    return React.createElement(
      "div",
      { className: "students-loading" },
      React.createElement("div", { className: "students-spinner" }),
      "Loading students..."
    );
  }

  return React.createElement(
    "div",
    null,
    // Page Header
    React.createElement(
      "div",
      { className: "page-header" },
      React.createElement("h1", { className: "page-title" }, "Students"),
      React.createElement(
        "p",
        { className: "page-subtitle" },
        "View and manage student information"
      )
    ),

    // Search Bar
    React.createElement(
      "div",
      { 
        className: "students-search-container",
        style: { 
          marginBottom: "20px",
          padding: "0 20px"
        }
      },
      React.createElement("input", {
        type: "text",
        className: "students-search-input",
        placeholder: "Search by name, nickname, student ID, or email...",
        value: searchTerm,
        onChange: (e) => setSearchTerm(e.target.value),
        style: { 
          width: "100%",
          maxWidth: "400px",
          padding: "8px 12px",
          fontSize: "14px"
        }
      }),
      searchTerm && React.createElement(
        "span",
        { 
          style: { 
            marginLeft: "10px",
            color: "#666",
            fontSize: "14px"
          }
        },
        `Found ${filteredStudents.length} student${filteredStudents.length !== 1 ? 's' : ''}`
      )
    ),

    // Students Table
    React.createElement(
      "div",
      { className: "students-table-container" },
      React.createElement(
        "table",
        { className: "students-table" },
        // Table Header
        React.createElement(
          "thead",
          null,
          React.createElement(
            "tr",
            null,
            React.createElement("th", null, "Student ID"),
            React.createElement("th", null, "Name"),
            React.createElement("th", null, "Nickname"),
            React.createElement("th", null, "Email"),
            React.createElement("th", null, "Status"),
            React.createElement("th", null, "Enrolled"),
            React.createElement("th", null, "Classes")
          )
        ),

        // Table Body
        React.createElement(
          "tbody",
          null,
          filteredStudents.map((student) =>
            React.createElement(
              "tr",
              {
                key: student.id,
                className: "student-row",
                onClick: () => handleStudentClick(student.id),
                style: { cursor: "pointer" },
                title: "Click to edit",
              },
              React.createElement(
                "td",
                null,
                React.createElement("strong", null, student.student_id)
              ),
              React.createElement("td", null, `${student.first_name} ${student.last_name}`),
              React.createElement("td", null, student.nickname || student.first_name),
              React.createElement("td", null, student.email || "N/A"),
              React.createElement(
                "td",
                null,
                React.createElement(
                  "span",
                  {
                    className: `badge ${student.is_active ? "badge-success" : "badge-warning"}`,
                  },
                  student.is_active ? "Active" : "Inactive"
                )
              ),
              React.createElement(
                "td",
                null,
                new Date(student.enrollment_date).toLocaleDateString()
              ),
              React.createElement(
                "td",
                null,
                React.createElement(
                  "span",
                  {
                    className: "badge badge-info",
                  },
                  `${student.active_classes?.length || 0} classes`
                )
              )
            )
          )
        )
      )
    )
  );
};

// Export for use in other modules
if (typeof window !== "undefined") {
  window.StudentsComponent = Students;
}
