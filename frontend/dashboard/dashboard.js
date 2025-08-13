// frontend/dashboard/dashboard.js

const Dashboard = ({ data, navigateTo }) => {
  // Use NavigationService if available, fallback to navigateTo prop
  const nav = window.NavigationService || null;
  
  // Get formatDateLong from shared utils for dashboard date display
  const formatDate = window.SharedUtils.formatDateLong;

  console.log("Dashboard rendering with data:", data);

  const { classes, students, layouts } = data;

  // Add null checks and default to empty arrays
  const classesArray = Array.isArray(classes) ? classes : [];
  const studentsArray = Array.isArray(students) ? students : [];
  const layoutsArray = Array.isArray(layouts) ? layouts : [];

  const totalEnrollment = classesArray.reduce((sum, cls) => sum + (cls.current_enrollment || 0), 0);
  const activeStudents = studentsArray.filter((s) => s.is_active).length;

  // Get recent classes (last 5)
  const recentClasses = [...classesArray]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 5);

  return React.createElement(
    "div",
    { className: "dashboard-container" },

    // Page Header
    React.createElement(
      "div",
      { className: "page-header" },
      React.createElement("h1", { className: "page-title" }, "Dashboard"),
      React.createElement(
        "p",
        { className: "page-subtitle" },
        "Overview of your classroom management system"
      )
    ),

    // Statistics Grid
    React.createElement(
      "div",
      { className: "dashboard-stats-grid" },

      // Total Classes
      React.createElement(
        "div",
        {
          className: "dashboard-stat-card",
          onClick: () => nav?.toClasses ? nav.toClasses() : navigateTo("classes"),
          title: "Click to view all classes",
        },
        React.createElement(
          "div",
          { className: "dashboard-stat-icon" },
          React.createElement("i", { className: "fas fa-chalkboard-teacher" })
        ),
        React.createElement(
          "div",
          { className: "dashboard-stat-content" },
          React.createElement("div", { className: "dashboard-stat-value" }, classesArray.length),
          React.createElement("div", { className: "dashboard-stat-label" }, "Total Classes")
        )
      ),

      // Active Students
      React.createElement(
        "div",
        {
          className: "dashboard-stat-card",
          onClick: () => nav?.toStudents ? nav.toStudents() : navigateTo("students"),
          title: "Click to view all students",
        },
        React.createElement(
          "div",
          { className: "dashboard-stat-icon" },
          React.createElement("i", { className: "fas fa-users" })
        ),
        React.createElement(
          "div",
          { className: "dashboard-stat-content" },
          React.createElement("div", { className: "dashboard-stat-value" }, activeStudents),
          React.createElement("div", { className: "dashboard-stat-label" }, "Active Students")
        )
      ),

      // Total Enrollments
      React.createElement(
        "div",
        {
          className: "dashboard-stat-card",
          title: "Total student enrollments across all classes",
        },
        React.createElement(
          "div",
          { className: "dashboard-stat-icon" },
          React.createElement("i", { className: "fas fa-user-graduate" })
        ),
        React.createElement(
          "div",
          { className: "dashboard-stat-content" },
          React.createElement("div", { className: "dashboard-stat-value" }, totalEnrollment),
          React.createElement("div", { className: "dashboard-stat-label" }, "Total Enrollments")
        )
      ),

      // Classroom Layouts
      React.createElement(
        "div",
        {
          className: "dashboard-stat-card",
          onClick: () => nav?.toLayouts ? nav.toLayouts() : navigateTo("layouts"),
          title: "Click to view classroom layouts",
        },
        React.createElement(
          "div",
          { className: "dashboard-stat-icon" },
          React.createElement("i", { className: "fas fa-th-large" })
        ),
        React.createElement(
          "div",
          { className: "dashboard-stat-content" },
          React.createElement("div", { className: "dashboard-stat-value" }, layoutsArray.length),
          React.createElement("div", { className: "dashboard-stat-label" }, "Classroom Layouts")
        )
      )
    ),

    // Recent Classes Section
    React.createElement(
      "div",
      { className: "dashboard-section" },
      React.createElement(
        "div",
        { className: "dashboard-section-header" },
        React.createElement("h2", { className: "dashboard-section-title" }, "Recent Classes"),
        React.createElement(
          "button",
          {
            className: "btn btn-secondary",
            onClick: () => nav?.toClasses ? nav.toClasses() : navigateTo("classes"),
          },
          React.createElement("i", { className: "fas fa-arrow-right" }),
          " View All"
        )
      ),

      recentClasses.length > 0
        ? React.createElement(
            "div",
            { className: "recent-classes-grid" },
            recentClasses.map((cls) =>
              React.createElement(
                "div",
                {
                  key: cls.id,
                  className: "recent-class-card",
                  onClick: () => nav?.toClassView ? nav.toClassView(cls.id) : navigateTo("classes", { action: "view", classId: cls.id }),
                },
                React.createElement(
                  "div",
                  { className: "dashboard-class-header" },
                  React.createElement("h3", { className: "dashboard-class-name" }, cls.name),
                  React.createElement(
                    "span",
                    {
                      className: `dashboard-class-status ${cls.is_active ? "active" : "inactive"}`,
                    },
                    cls.is_active ? "Active" : "Inactive"
                  )
                ),
                React.createElement(
                  "div",
                  { className: "dashboard-class-info" },
                  React.createElement(
                    "div",
                    { className: "dashboard-info-item" },
                    React.createElement("i", { className: "fas fa-users" }),
                    React.createElement("span", null, `${cls.current_enrollment || 0} students`)
                  ),
                  React.createElement(
                    "div",
                    { className: "dashboard-info-item" },
                    React.createElement("i", { className: "fas fa-calendar" }),
                    React.createElement("span", null, formatDate(cls.updated_at))
                  )
                ),
                cls.teacher &&
                  React.createElement(
                    "div",
                    { className: "dashboard-class-teacher" },
                    React.createElement("i", { className: "fas fa-user-tie" }),
                    React.createElement("span", null, cls.teacher.name)
                  )
              )
            )
          )
        : React.createElement(
            "div",
            { className: "empty-state" },
            React.createElement("i", {
              className: "fas fa-chalkboard-teacher",
            }),
            React.createElement("p", null, "No classes created yet"),
            React.createElement(
              "button",
              {
                className: "btn btn-primary",
                onClick: () => navigateTo("classes", { action: "new" }),
              },
              "Create Your First Class"
            )
          )
    ),

    // Quick Actions Section
    React.createElement(
      "div",
      { className: "dashboard-section" },
      React.createElement("h2", { className: "dashboard-section-title" }, "Quick Actions"),
      React.createElement(
        "div",
        { className: "quick-actions-grid" },

        React.createElement(
          "button",
          {
            className: "quick-action-btn",
            onClick: () => navigateTo("classes", { action: "new" }),
          },
          React.createElement("i", { className: "fas fa-plus-circle" }),
          React.createElement("span", null, "Add New Class")
        ),

        React.createElement(
          "button",
          {
            className: "quick-action-btn",
            onClick: () => navigateTo("students", { action: "new" }),
          },
          React.createElement("i", { className: "fas fa-user-plus" }),
          React.createElement("span", null, "Add New Student")
        ),

        React.createElement(
          "button",
          {
            className: "quick-action-btn",
            onClick: () => nav?.toSeating ? nav.toSeating() : navigateTo("seating"),
          },
          React.createElement("i", { className: "fas fa-chair" }),
          React.createElement("span", null, "Manage Seating")
        ),

        React.createElement(
          "button",
          {
            className: "quick-action-btn",
            onClick: () => nav?.toLayoutEditor ? nav.toLayoutEditor() : window.open("/layout-editor/", "_blank"),
          },
          React.createElement("i", { className: "fas fa-edit" }),
          React.createElement("span", null, "Layout Editor")
        )
      )
    )
  );
};

// Export the component
if (typeof window !== "undefined") {
  window.DashboardComponent = Dashboard;
  console.log("Dashboard component loaded");
}
