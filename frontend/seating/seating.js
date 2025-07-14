// seating.js - Main Seating Charts Management Component

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
    if (navigateTo && typeof navigateTo === 'function') {
      console.log("Calling navigateTo with:", "seating", { action: "view", classId: classId });
      navigateTo("seating", { action: "view", classId: classId });
    } else {
      console.error("navigateTo function not available or not a function:", navigateTo);
      // Fallback - try to use window functions if available
      if (window.showSeatingChart) {
        window.showSeatingChart(classId, className, 'view');
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
        totalSeats: 0
      };
    }

    // Get seating chart data if available
    const period = cls.current_seating_period;
    const enrollment = cls.current_enrollment || 0;
    
    return {
      name: period.name || "Current",
      lastModified: period.updated_at,
      assignedCount: 0, // TODO: Calculate from seating assignments
      totalSeats: enrollment
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
          onClick: fetchClassesWithSeatingCharts
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
      
      classes.length === 0 ? 
        React.createElement(
          "div",
          { className: "seating-empty" },
          React.createElement("h3", null, "No Classes Found"),
          React.createElement("p", null, "You don't have any classes yet. Create a class first to manage seating charts.")
        ) :
        
        classes.map(cls => {
          const seatingInfo = getSeatingInfo(cls);
          const status = getSeatingStatus(cls);
          const hasChart = status !== "No Chart";
          
          return React.createElement(
            "div",
            {
              key: cls.id,
              className: `seating-card ${!hasChart ? 'seating-card-empty' : ''}`
            },
            
            // Class info column
            React.createElement(
              "div",
              { className: "seating-card-info" },
              React.createElement(
                "h3",
                { className: "seating-class-name" },
                cls.name
              ),
              React.createElement(
                "div",
                { className: "seating-class-details" },
                React.createElement("span", null, `${cls.subject} • Grade ${cls.grade_level}`),
                React.createElement("span", null, `${cls.current_enrollment || 0} students`)
              )
            ),

            // Seating chart info column
            React.createElement(
              "div",
              { className: "seating-card-chart" },
              React.createElement(
                "div",
                { className: "seating-chart-name" },
                seatingInfo.name
              ),
              hasChart && React.createElement(
                "div",
                { className: "seating-chart-details" },
                React.createElement(
                  "span",
                  null,
                  `${seatingInfo.assignedCount}/${seatingInfo.totalSeats} assigned`
                ),
                React.createElement(
                  "span",
                  null,
                  `Modified: ${formatDate(seatingInfo.lastModified)}`
                )
              )
            ),

            // Status column
            React.createElement(
              "div",
              { className: "seating-card-status" },
              React.createElement(
                "span",
                {
                  className: `seating-status seating-status-${status.toLowerCase().replace(' ', '-')}`
                },
                status
              )
            ),

            // Actions column
            React.createElement(
              "div",
              { className: "seating-card-actions" },
              
              hasChart && React.createElement(
                "button",
                {
                  className: "btn btn-outline-secondary btn-sm",
                  onClick: () => handleViewChart(cls.id, cls.name),
                  title: "View seating chart"
                },
                "View"
              ),
              
              hasChart && React.createElement(
                "button",
                {
                  className: "btn btn-outline-primary btn-sm",
                  onClick: () => handleEditChart(cls.id, cls.name),
                  title: "Edit current seating chart"
                },
                "Edit"
              ),
              
              React.createElement(
                "button",
                {
                  className: "btn btn-primary btn-sm",
                  onClick: () => handleNewChart(cls.id, cls.name),
                  title: hasChart ? "Create new seating chart" : "Create first seating chart"
                },
                hasChart ? "New" : "Create Chart"
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