// frontend/seating/seating.js

const SeatingComponent = ({ data, navigateTo }) => {
  const [seatingCharts, setSeatingCharts] = useState([]);
  const [loading, setLoading] = useState(false);

  const { classes = [], periods = [], assignments = [], students = [] } = data;

  useEffect(() => {
    if (data && periods.length > 0) {
      processSeatingCharts();
    }
  }, [data]);

  const processSeatingCharts = () => {
    try {
      setLoading(true);

      // Process the periods data with their associated classes
      const enrichedCharts = periods.map((period) => {
        // Find the associated class
        const classData = classes.find((c) => c.id === period.class_assigned);

        // Count assignments for this period
        const periodAssignments = assignments.filter(
          (a) => a.seating_period === period.id
        );
        const assignedCount = periodAssignments.length;

        // Calculate total students in the class
        let totalStudents = 0;
        if (classData) {
          // Count students enrolled in this class
          totalStudents = students.filter(
            (student) =>
              student.classes && student.classes.includes(classData.id)
          ).length;
        }

        return {
          ...period,
          class_name: classData?.name || "Unknown Class",
          class_subject: classData?.subject || "Unknown Subject",
          class_grade: classData?.grade_level || "null",
          student_count: totalStudents,
          assigned_count: assignedCount,
          total_seats: totalStudents, // Using student count as total seats for now
        };
      });

      setSeatingCharts(enrichedCharts);
      setLoading(false);
    } catch (error) {
      console.error("Error processing seating charts:", error);
      setLoading(false);
    }
  };

  const handleView = (chart) => {
    navigateTo("seating", {
      action: "view",
      classId: chart.class_assigned.toString(),
    });
  };

  const handleEdit = (chart) => {
    navigateTo("seating", {
      action: "edit",
      classId: chart.class_assigned.toString(),
      periodId: chart.id.toString(),
    });
  };

  const handleNew = (chart) => {
    navigateTo("seating", {
      action: "new",
      classId: chart.class_assigned.toString(),
    });
  };

  return React.createElement(
    "div",
    { className: "seating-main-container" },
    React.createElement(
      "div",
      { className: "page-header" },
      React.createElement(
        "h1",
        { className: "page-title" },
        "My Seating Charts"
      ),
      React.createElement(
        "p",
        { className: "page-subtitle" },
        "Manage seating arrangements for your classes"
      )
    ),
    React.createElement(
      "div",
      { className: "seating-charts-list" },
      loading &&
        React.createElement("div", { className: "loading" }, "Loading..."),
      !loading &&
        seatingCharts.length === 0 &&
        React.createElement(
          "div",
          { className: "empty-state" },
          React.createElement("p", null, "No seating charts created yet.")
        ),
      !loading &&
        seatingCharts.map((chart) =>
          React.createElement(
            "div",
            { key: chart.id, className: "seating-chart-card" },
            React.createElement(
              "div",
              { className: "chart-info" },
              React.createElement(
                "div",
                { className: "chart-class-info" },
                React.createElement(
                  "h3",
                  { className: "chart-class-name" },
                  chart.class_name
                ),
                React.createElement(
                  "p",
                  { className: "chart-class-details" },
                  `${chart.class_subject} • Grade ${chart.class_grade}`,
                  React.createElement("br"),
                  `${chart.student_count} students`
                )
              ),
              React.createElement(
                "div",
                { className: "chart-period-info" },
                React.createElement(
                  "h4",
                  { className: "chart-period-name" },
                  chart.name
                ),
                React.createElement(
                  "p",
                  { className: "chart-assignments" },
                  `${chart.assigned_count}/${chart.total_seats} assigned`
                ),
                React.createElement(
                  "p",
                  { className: "chart-modified" },
                  `Modified: ${new Date(
                    chart.updated_at || chart.created_at
                  ).toLocaleDateString()}`
                )
              ),
              React.createElement(
                "div",
                { className: "chart-status" },
                React.createElement(
                  "span",
                  { className: "status-badge active" },
                  "ACTIVE"
                )
              )
            ),
            React.createElement(
              "div",
              { className: "chart-actions" },
              React.createElement(
                "button",
                {
                  className: "btn btn-secondary",
                  onClick: () => handleView(chart),
                },
                "View"
              ),
              React.createElement(
                "button",
                {
                  className: "btn btn-secondary",
                  onClick: () => handleEdit(chart),
                },
                "Edit"
              ),
              React.createElement(
                "button",
                {
                  className: "btn btn-primary",
                  onClick: () => handleNew(chart),
                },
                "New"
              )
            )
          )
        )
    )
  );
};

// Attach to window
window.SeatingComponent = SeatingComponent;
