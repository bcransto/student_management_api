// seating-chart.js - Visual Seating Chart Component (moved from classes.js)

const SeatingChart = ({ classId, className, mode = "view" }) => {
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
      { className: "seating-chart-loading" },
      React.createElement("div", { className: "spinner" }),
      "Loading seating chart..."
    );
  }

  if (error) {
    return React.createElement(
      "div",
      { className: "seating-chart-error" },
      React.createElement("h3", null, "Seating Chart Error"),
      React.createElement("p", null, error),
      React.createElement("p", null, `Class: ${className} (ID: ${classId})`)
    );
  }

  if (!chartData) {
    return React.createElement(
      "div",
      { className: "seating-chart-empty" },
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

    // Header (only show in standalone mode)
    mode === "standalone" &&
      React.createElement(
        "div",
        { className: "seating-chart-header" },
        React.createElement("h2", null, `Seating Chart: ${className}`),
        React.createElement(
          "button",
          {
            className: "btn btn-secondary",
            onClick: () => window.history.back(),
          },
          "← Back"
        )
      ),

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

    // Seating Chart
    React.createElement(
      "div",
      {
        className: "seating-chart-room",
        style: {
          width: `${containerWidth}px`,
          height: `${containerHeight}px`,
          position: "relative",
          border: "2px solid #333",
          backgroundColor: "#f8f9fa",
          margin: "20px auto",
        },
      },

      // Render tables
      tables.map((table) =>
        React.createElement(
          "div",
          {
            key: table.table_number,
            className: "seating-table",
            style: {
              position: "absolute",
              left: `${table.x_position * gridSize}px`,
              top: `${table.y_position * gridSize}px`,
              width: `${table.width * gridSize}px`,
              height: `${table.height * gridSize}px`,
              backgroundColor: "#3b82f6",
              border: "2px solid #1d4ed8",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: "bold",
              fontSize: "0.9rem",
            },
          },
          table.table_name || `Table ${table.table_number}`,

          // Render seats
          table.seats.map((seat) =>
            React.createElement(
              "div",
              {
                key: seat.absolute_seat_id,
                className: `seating-seat ${
                  seat.student ? "occupied" : "empty"
                }`,
                style: {
                  position: "absolute",
                  left: `${seat.relative_x * table.width * gridSize - 15}px`,
                  top: `${seat.relative_y * table.height * gridSize - 15}px`,
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  border: "2px solid #374151",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.7rem",
                  fontWeight: "600",
                  cursor: mode === "edit" ? "pointer" : "default",
                  backgroundColor: seat.student ? "#10b981" : "#f3f4f6",
                  color: seat.student ? "white" : "#374151",
                  transition: "all 0.2s ease",
                },
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
                position: "absolute",
                left: `${obstacle.x_position * gridSize}px`,
                top: `${obstacle.y_position * gridSize}px`,
                width: `${obstacle.width * gridSize}px`,
                height: `${obstacle.height * gridSize}px`,
                backgroundColor: obstacle.color || "#ef4444",
                border: "2px solid #dc2626",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: "bold",
                fontSize: "0.8rem",
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
          style: { backgroundColor: "#f3f4f6", border: "1px solid #d1d5db" },
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
