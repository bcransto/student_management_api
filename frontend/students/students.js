// frontend/students/students.js
// Students Component - Extracted from frontend.html

const Students = ({ data, navigateTo }) => {
  const { students } = data;

  if (!students) {
    return React.createElement(
      "div",
      { className: "loading" },
      React.createElement("div", { className: "spinner" }),
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

    // Students Table
    React.createElement(
      "div",
      { className: "table-container" },
      React.createElement(
        "table",
        { className: "table" },
        // Table Header
        React.createElement(
          "thead",
          null,
          React.createElement(
            "tr",
            null,
            React.createElement("th", null, "Student ID"),
            React.createElement("th", null, "Name"),
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
          students.map((student) =>
            React.createElement(
              "tr",
              { key: student.id },
              React.createElement(
                "td",
                null,
                React.createElement("strong", null, student.student_id)
              ),
              React.createElement("td", null, `${student.first_name} ${student.last_name}`),
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
