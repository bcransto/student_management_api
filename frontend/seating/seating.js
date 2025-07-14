// frontend/seating/seating.js - Main Seating Charts Management Component

const Seating = ({ data, navigateTo }) => {
  const [classes, setClasses] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  // Debug: Check what props we're receiving
  React.useEffect(() => {
    console.log("Seating component props:", { data, navigateTo: !!navigateTo });
    console.log("navigateTo type:", typeof navigateTo);
  }, [data, navigateTo]);

  React.useEffect(() => {
    console.log("Seating component mounted");
    fetchClassesWithSeatingCharts();
  }, []);

  const fetchClassesWithSeatingCharts = async () => {
    try {
      setLoading(true);
      setError("");

      if (window.ApiModule) {
        const data = await window.ApiModule.request("/classes/");
        console.log("Classes data received:", data);

        // Handle paginated response format
        if (data && data.results && Array.isArray(data.results)) {
          setClasses(data.results);
        } else if (Array.isArray(data)) {
          setClasses(data);
        } else {
          setClasses([]);
        }
      } else {
        throw new Error("API module not available");
      }
    } catch (err) {
      console.error("Error fetching classes:", err);
      setError("Unable to load classes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewChart = (classId, className) => {
    console.log("View chart for class:", classId, className);
    console.log("navigateTo function available:", !!navigateTo);

    // Navigate to seating chart view using the navigateTo prop from frontend.html
    if (navigateTo && typeof navigateTo === "function") {
      console.log("Calling navigateTo with:", "seating", {
        action: "view",
        classId: classId,
      });
      navigateTo("seating", { action: "view", classId: classId });
    } else {
      console.error(
        "navigateTo function not available or not a function:",
        navigateTo
      );
      // Fallback - try to use window functions if available
      if (window.showSeatingChart) {
        window.showSeatingChart(classId, className, "view");
      }
    }
  };

  const handleEditChart = (classId, className) => {
    console.log("Edit chart for class:", classId, className);
    // TODO: Navigate to edit mode - will implement interactive editor next
    if (navigateTo) {
      navigateTo("seating", { action: "edit", classId: classId });
    } else {
      console.error("navigateTo function not available");
    }
  };

  const handleNewChart = (classId, className) => {
    console.log("Create new chart for class:", classId, className);
    // TODO: Navigate to new chart mode - will implement interactive editor next
    if (navigateTo) {
      navigateTo("seating", { action: "new", classId: classId });
    } else {
      console.error("navigateTo function not available");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getSeatingStatus = (cls) => {
    // Determine if class has current seating chart
    if (cls.current_seating_period) {
      return "Active";
    }
    return "No Chart";
  };

  const getSeatingInfo = (cls) => {
    if (!cls.current_seating_period) {
      return {
        name: "No seating chart",
        lastModified: null,
        assignedCount: 0,
        totalSeats: 0,
      };
    }

    // Get seating chart data if available
    const period = cls.current_seating_period;
    const enrollment = cls.current_enrollment || 0;

    return {
      name: period.name || "Current",
      lastModified: period.updated_at,
      assignedCount: 0, // TODO: Calculate from seating assignments
      totalSeats: enrollment,
    };
  };

  if (loading) {
    return React.createElement(
      "div",
      { className: "seating-loading" },
      React.createElement("div", { className: "spinner" }),
      "Loading seating charts..."
    );
  }

  if (error) {
    return React.createElement(
      "div",
      { className: "seating-error" },
      React.createElement("h3", null, "Error Loading Seating Charts"),
      React.createElement("p", null, error),
      React.createElement(
        "button",
        {
          className: "btn btn-primary",
          onClick: fetchClassesWithSeatingCharts,
        },
        "Try Again"
      )
    );
  }

  return React.createElement(
    "div",
    { className: "seating-container" },

    // Header
    React.createElement(
      "div",
      { className: "seating-header" },
      React.createElement("h2", null, "My Seating Charts"),
      React.createElement(
        "p",
        { className: "seating-subtitle" },
        "Manage seating arrangements for your classes"
      )
    ),

    // Classes list
    React.createElement(
      "div",
      { className: "seating-list" },

      classes.length === 0
        ? React.createElement(
            "div",
            { className: "seating-empty" },
            React.createElement("h3", null, "No Classes Found"),
            React.createElement(
              "p",
              null,
              "You don't have any classes yet. Create a class first to manage seating charts."
            )
          )
        : [...classes]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((cls) => {
              const seatingInfo = getSeatingInfo(cls);
              const status = getSeatingStatus(cls);
              const hasChart = status !== "No Chart";

              return React.createElement(
                "div",
                {
                  key: cls.id,
                  className: `seating-card ${!hasChart ? "no-chart" : ""}`,
                },

                // Class info
                React.createElement(
                  "div",
                  { className: "seating-card-info" },
                  React.createElement(
                    "h3",
                    { className: "seating-card-title" },
                    cls.name
                  ),
                  React.createElement(
                    "p",
                    { className: "seating-card-subtitle" },
                    `${cls.subject || "General"} • Grade ${cls.grade || "N/A"}`
                  ),
                  React.createElement(
                    "p",
                    { className: "seating-card-subtitle" },
                    `${cls.current_enrollment || 0} students`
                  )
                ),

                // Status badge
                React.createElement(
                  "span",
                  {
                    className: `seating-card-status ${
                      hasChart ? "active" : "no-chart"
                    }`,
                  },
                  hasChart ? "ACTIVE" : "NO CHART"
                ),

                // Seating chart info (if exists)
                hasChart &&
                  React.createElement(
                    "div",
                    { className: "seating-card-chart" },
                    React.createElement(
                      "div",
                      { className: "seating-chart-name" },
                      seatingInfo.name
                    ),
                    React.createElement(
                      "div",
                      { className: "seating-chart-meta" },
                      React.createElement(
                        "div",
                        { className: "seating-meta-item" },
                        React.createElement("i", { className: "fas fa-users" }),
                        `${seatingInfo.assignedCount}/${
                          cls.current_enrollment || 0
                        } assigned`
                      ),
                      React.createElement(
                        "div",
                        { className: "seating-meta-item" },
                        React.createElement("i", {
                          className: "fas fa-calendar",
                        }),
                        `Modified: ${formatDate(seatingInfo.lastModified)}`
                      )
                    )
                  ),

                // Action buttons
                React.createElement(
                  "div",
                  { className: "seating-card-actions" },

                  hasChart &&
                    React.createElement(
                      "button",
                      {
                        className: "action-icon-btn view",
                        onClick: () => handleViewChart(cls.id, cls.name),
                        "data-tooltip": "View Chart",
                      },
                      React.createElement("i", { className: "fas fa-eye" })
                    ),

                  hasChart &&
                    React.createElement(
                      "button",
                      {
                        className: "action-icon-btn edit",
                        onClick: () => handleEditChart(cls.id, cls.name),
                        "data-tooltip": "Edit Chart",
                      },
                      React.createElement("i", { className: "fas fa-edit" })
                    ),

                  React.createElement(
                    "button",
                    {
                      className: `action-icon-btn new ${
                        !hasChart ? "primary" : ""
                      }`,
                      onClick: () => handleNewChart(cls.id, cls.name),
                      "data-tooltip": hasChart
                        ? "Create new seating chart"
                        : "",
                    },
                    !hasChart
                      ? [
                          React.createElement("i", {
                            key: "icon",
                            className: "fas fa-plus",
                          }),
                          React.createElement(
                            "span",
                            { key: "text" },
                            "Create Chart"
                          ),
                        ]
                      : React.createElement("i", { className: "fas fa-plus" })
                  )
                )
              );
            })
    )
  );
};

// Export the component
if (typeof window !== "undefined") {
  window.SeatingComponent = Seating;
  console.log("Seating component loaded");
}
