// Step 3 that worked + careful navigation
console.log("Loading classes component - back to working step 3...");

const Classes = ({ data, navigateTo, currentParams }) => {
  console.log("Classes component rendering with data:", data);
  console.log("Current params:", currentParams);

  const { classes } = data || {};
  console.log("Classes array:", classes);

  if (!classes || !Array.isArray(classes)) {
    return React.createElement(
      "div",
      null,
      React.createElement("h1", null, "Classes - No Data"),
      React.createElement("p", null, "Classes data not available")
    );
  }

  const handleViewChart = (classId) => {
    console.log("View chart clicked for class:", classId);
    navigateTo("classes", { action: "chart", id: classId });
  };

  return React.createElement(
    "div",
    { className: "classes-container" },
    // Page Header
    React.createElement(
      "div",
      { className: "page-header" },
      React.createElement("h1", { className: "page-title" }, "Classes"),
      React.createElement(
        "p",
        { className: "page-subtitle" },
        "Manage your classroom assignments and layouts"
      )
    ),

    // Debug info
    React.createElement(
      "div",
      { className: "card" },
      React.createElement(
        "p",
        null,
        `Step 3 + Navigation: Rendering ${classes.length} classes`
      )
    ),

    // Full Table
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
            React.createElement("th", null, "Class Name"),
            React.createElement("th", null, "Subject"),
            React.createElement("th", null, "Grade Level"),
            React.createElement("th", null, "Enrollment"),
            React.createElement("th", null, "Actions")
          )
        ),

        // Table Body
        React.createElement(
          "tbody",
          null,
          classes.map((cls, index) => {
            console.log("Rendering class row:", cls.name);
            return React.createElement(
              "tr",
              { key: cls.id || index },
              React.createElement(
                "td",
                null,
                React.createElement("strong", null, cls.name || "Unknown")
              ),
              React.createElement("td", null, cls.subject || "N/A"),
              React.createElement("td", null, cls.grade_level || "N/A"),
              React.createElement(
                "td",
                null,
                React.createElement(
                  "span",
                  { className: "badge badge-info" },
                  `${cls.current_enrollment || 0} students`
                )
              ),
              React.createElement(
                "td",
                null,
                React.createElement(
                  "div",
                  { style: { display: "flex", gap: "0.5rem" } },
                  React.createElement(
                    "button",
                    {
                      className: "btn btn-primary btn-sm",
                      onClick: () => handleViewChart(cls.id),
                    },
                    "📊 Chart"
                  ),
                  React.createElement(
                    "button",
                    {
                      className: "btn btn-secondary btn-sm",
                      onClick: () =>
                        console.log("Manage clicked for:", cls.name),
                    },
                    "Manage"
                  )
                )
              )
            );
          })
        )
      )
    )
  );
};

// NO WRAPPER - use the component directly
if (typeof window !== "undefined") {
  window.ClassesComponent = Classes;
  console.log("Classes component (no wrapper) loaded");
}

// Simple SeatingChart Component
// Enhanced SeatingChart Component with Visual Rendering
const SeatingChart = ({ classId, className }) => {
  const [chartData, setChartData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    console.log("SeatingChart useEffect for classId:", classId);

    if (!classId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchSeatingChart = async () => {
      try {
        setLoading(true);
        setError("");

        if (window.ApiModule) {
          const data = await window.ApiModule.request(
            `/classes/${classId}/seating_chart/`
          );
          console.log("Seating chart data received:", data);

          if (!cancelled) {
            setChartData(data);
          }
        } else {
          throw new Error("API module not available");
        }
      } catch (err) {
        console.log("Seating chart error:", err);
        if (!cancelled) {
          setError("Unable to load seating chart.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchSeatingChart();

    return () => {
      cancelled = true;
    };
  }, [classId]);

  if (loading) {
    return React.createElement(
      "div",
      { className: "classes-loading" },
      React.createElement("div", { className: "spinner" }),
      "Loading seating chart..."
    );
  }

  if (error) {
    return React.createElement(
      "div",
      { className: "card" },
      React.createElement("h3", null, "Seating Chart Error"),
      React.createElement("p", null, error),
      React.createElement("p", null, `Class: ${className} (ID: ${classId})`)
    );
  }

  if (!chartData) {
    return React.createElement(
      "div",
      { className: "card" },
      React.createElement("h3", null, "No Seating Data"),
      React.createElement(
        "p",
        null,
        "This class doesn't have seating chart data available."
      )
    );
  }

  const { room_width, room_height, tables, obstacles } = chartData;

  // Helper function to get display name for seat
  const getDisplayName = (student) => {
    if (!student || !student.name) return "";
    const firstName = student.name.split(" ")[0];
    return firstName.length > 8 ? firstName.substring(0, 6) + ".." : firstName;
  };

  // Calculate statistics
  const totalSeats = tables.reduce(
    (total, table) => total + table.seats.length,
    0
  );
  const occupiedSeats = tables.reduce(
    (total, table) => total + table.seats.filter((seat) => seat.student).length,
    0
  );
  const uniqueGroups = [
    ...new Set(
      tables.flatMap((table) =>
        table.seats
          .filter((seat) => seat.student && seat.group_number)
          .map((seat) => seat.group_number)
      )
    ),
  ];

  // Grid settings
  const gridSize = 60;
  const containerWidth = room_width * gridSize;
  const containerHeight = room_height * gridSize;

  return React.createElement(
    "div",
    { className: "seating-chart-container" },
    // Statistics
    React.createElement(
      "div",
      { className: "seating-chart-stats" },
      React.createElement(
        "div",
        { className: "seating-stat" },
        React.createElement(
          "div",
          { className: "seating-stat-value" },
          tables.length
        ),
        React.createElement(
          "div",
          { className: "seating-stat-label" },
          "Tables"
        )
      ),
      React.createElement(
        "div",
        { className: "seating-stat" },
        React.createElement(
          "div",
          { className: "seating-stat-value" },
          totalSeats
        ),
        React.createElement(
          "div",
          { className: "seating-stat-label" },
          "Total Seats"
        )
      ),
      React.createElement(
        "div",
        { className: "seating-stat" },
        React.createElement(
          "div",
          { className: "seating-stat-value" },
          occupiedSeats
        ),
        React.createElement(
          "div",
          { className: "seating-stat-label" },
          "Occupied"
        )
      ),
      React.createElement(
        "div",
        { className: "seating-stat" },
        React.createElement(
          "div",
          { className: "seating-stat-value" },
          uniqueGroups.length
        ),
        React.createElement(
          "div",
          { className: "seating-stat-label" },
          "Groups"
        )
      )
    ),

    // Seating Grid
    React.createElement(
      "div",
      {
        className: "seating-grid",
        style: {
          width: `${containerWidth}px`,
          height: `${containerHeight}px`,
          margin: "2rem auto",
        },
      },
      // Render tables
      tables.map((table) =>
        React.createElement(
          "div",
          {
            key: table.id,
            className: `seating-table ${table.table_shape || "rectangular"}`,
            style: {
              left: `${table.x_position * gridSize}px`,
              top: `${table.y_position * gridSize}px`,
              width: `${table.width * gridSize}px`,
              height: `${table.height * gridSize}px`,
            },
          },
          // Render seats for this table
          table.seats.map((seat) =>
            React.createElement(
              "div",
              {
                key: seat.id,
                className: `seating-seat ${
                  seat.student ? "occupied" : "empty"
                }`,
                title: seat.student
                  ? seat.student.name
                  : `Seat ${seat.seat_number}`,
              },
              seat.student ? getDisplayName(seat.student) : seat.seat_number
            )
          )
        )
      ),

      // Render obstacles
      obstacles &&
        obstacles.map((obstacle) =>
          React.createElement(
            "div",
            {
              key: obstacle.id,
              className: "seating-obstacle",
              style: {
                left: `${obstacle.x_position * gridSize}px`,
                top: `${obstacle.y_position * gridSize}px`,
                width: `${obstacle.width * gridSize}px`,
                height: `${obstacle.height * gridSize}px`,
                backgroundColor: obstacle.color || "#ef4444",
              },
            },
            obstacle.name
          )
        )
    ),

    // Legend
    React.createElement(
      "div",
      { className: "seating-legend" },
      React.createElement(
        "div",
        { className: "seating-legend-item" },
        React.createElement("div", {
          className: "seating-legend-color",
          style: { backgroundColor: "#10b981" },
        }),
        "Occupied Seat"
      ),
      React.createElement(
        "div",
        { className: "seating-legend-item" },
        React.createElement("div", {
          className: "seating-legend-color",
          style: { backgroundColor: "#f3f4f6" },
        }),
        "Empty Seat"
      ),
      React.createElement(
        "div",
        { className: "seating-legend-item" },
        React.createElement("div", {
          className: "seating-legend-color",
          style: { backgroundColor: "#3b82f6" },
        }),
        "Table"
      ),
      obstacles &&
        obstacles.length > 0 &&
        React.createElement(
          "div",
          { className: "seating-legend-item" },
          React.createElement("div", {
            className: "seating-legend-color",
            style: { backgroundColor: "#ef4444" },
          }),
          "Obstacle"
        )
    )
  );
};

// Export SeatingChart component
if (typeof window !== "undefined") {
  window.SeatingChartComponent = SeatingChart;
  console.log("SeatingChart component loaded");
}
