// frontend/seating/seating.js - Updated Seating Charts Management Component

const Seating = ({ data, navigateTo }) => {
  const [classes, setClasses] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [currentView, setCurrentView] = React.useState("list"); // 'list', 'viewer', or 'editor'
  const [selectedClassId, setSelectedClassId] = React.useState(null);

  React.useEffect(() => {
    console.log("Seating component mounted");

    // Load the editor component if needed
    if (!window.SeatingEditor) {
      console.log("SeatingEditor not found, loading script...");
      const script = document.createElement("script");
      script.src = "/frontend/seating/SeatingEditor.js";
      script.type = "text/babel";
      script.onload = () => {
        console.log("SeatingEditor script loaded");
        // Force Babel to transform the newly loaded script
        if (window.Babel) {
          window.Babel.transformScriptTags();
        }
      };
      script.onerror = (error) => {
        console.error("Failed to load SeatingEditor script:", error);
      };
      document.body.appendChild(script);
    } else {
      console.log("SeatingEditor already loaded");
    }

    fetchClassesWithSeatingCharts();
  }, []);

  const fetchClassesWithSeatingCharts = async () => {
    try {
      setLoading(true);
      setError("");

      console.log("Fetching classes...");

      if (window.ApiModule) {
        const data = await window.ApiModule.request("/classes/");
        console.log("API response:", data);

        if (data && data.results && Array.isArray(data.results)) {
          setClasses(data.results);
          console.log("Classes loaded:", data.results);
        } else if (Array.isArray(data)) {
          setClasses(data);
          console.log("Classes loaded:", data);
        } else {
          setClasses([]);
          console.log("No classes found, data structure:", data);
        }
      } else {
        console.error("API module not available! window.ApiModule:", window.ApiModule);
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
    // Show viewer within the app
    setSelectedClassId(classId);
    setCurrentView("viewer");
  };

  const handleEditChart = (classId, className) => {
    console.log("Edit chart for class:", classId, className);
    // Show editor within the app
    setSelectedClassId(classId);
    setCurrentView("editor");
  };

  const handleNewChart = (classId, className) => {
    console.log("Create new chart for class:", classId, className);
    // Show editor for new chart within the app
    setSelectedClassId(classId);
    setCurrentView("editor");
  };

  const handleBackToList = () => {
    setCurrentView("list");
    setSelectedClassId(null);
    fetchClassesWithSeatingCharts(); // Refresh the list
  };

  // Add/remove seating-editor-page class based on current view
  React.useEffect(() => {
    if (currentView === "editor") {
      document.body.classList.add("seating-editor-page");
    } else {
      document.body.classList.remove("seating-editor-page");
    }

    return () => {
      document.body.classList.remove("seating-editor-page");
    };
  }, [currentView]);

  // Show viewer view
  if (currentView === "viewer") {
    console.log("Showing viewer for class:", selectedClassId);

    if (window.SeatingViewer) {
      return React.createElement(window.SeatingViewer, {
        classId: selectedClassId,
        onEdit: () => setCurrentView("editor"),
        onBack: handleBackToList,
      });
    } else {
      // Load SeatingViewer if not available
      const script = document.createElement("script");
      script.src = "/frontend/seating/SeatingViewer.js";
      script.onload = () => {
        console.log("SeatingViewer loaded");
        setCurrentView("list"); // Force re-render
        setCurrentView("viewer");
      };
      document.body.appendChild(script);

      return React.createElement(
        "div",
        { className: "loading" },
        React.createElement("div", { className: "spinner" }),
        "Loading seating viewer..."
      );
    }
  }

  // Show editor view
  if (currentView === "editor") {
    console.log("Trying to show editor, SeatingEditor available:", !!window.SeatingEditor);

    if (window.SeatingEditor) {
      return React.createElement(window.SeatingEditor, {
        classId: selectedClassId,
        onBack: handleBackToList,
        onView: () => setCurrentView("viewer"),
      });
    } else {
      // Try loading again
      setTimeout(() => {
        if (window.SeatingEditor) {
          setCurrentView("list"); // Force re-render
          setCurrentView("editor");
        }
      }, 1000);

      return React.createElement(
        "div",
        { className: "loading" },
        React.createElement("div", { className: "spinner" }),
        "Loading seating editor..."
      );
    }
  }

  // List view
  if (loading) {
    return React.createElement(
      "div",
      { className: "seating-loading" },
      React.createElement("div", { className: "spinner" }),
      "Loading classes..."
    );
  }

  if (error) {
    return React.createElement(
      "div",
      { className: "seating-error" },
      React.createElement("h3", null, "Error"),
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
      React.createElement("h2", null, "Seating Charts"),
      React.createElement(
        "p",
        { className: "seating-subtitle" },
        "Create and manage seating arrangements for your classes"
      )
    ),

    // Classes grid
    React.createElement(
      "div",
      { className: "seating-classes-grid" },

      classes.length === 0
        ? React.createElement(
            "div",
            { className: "empty-state" },
            React.createElement("i", { className: "fas fa-chair fa-3x" }),
            React.createElement("p", null, "No classes found"),
            React.createElement(
              "p",
              { className: "text-sm" },
              "Create a class first to start making seating charts"
            )
          )
        : classes.map((classItem) =>
            React.createElement(
              "div",
              {
                key: classItem.id,
                className: "class-card floating-card",
                onClick: () => {
                  if (classItem.current_seating_period?.seating_assignments?.length > 0) {
                    handleViewChart(classItem.id, classItem.name);
                  } else if (classItem.classroom_layout) {
                    handleNewChart(classItem.id, classItem.name);
                  }
                },
                style: { cursor: classItem.classroom_layout ? "pointer" : "not-allowed" },
              },

              // Class info
              React.createElement(
                "div",
                { className: "class-card-header" },
                React.createElement("h3", null, classItem.name),
                React.createElement(
                  "span",
                  { className: "class-period" },
                  classItem.grade_level
                    ? `Grade ${classItem.grade_level}`
                    : classItem.subject || "N/A"
                )
              ),

              // Stats
              React.createElement(
                "div",
                { className: "class-card-stats" },
                React.createElement(
                  "div",
                  { className: "stat" },
                  React.createElement("i", { className: "fas fa-users" }),
                  React.createElement("span", null, `${classItem.roster?.length || 0} students`)
                ),
                React.createElement(
                  "div",
                  { className: "stat" },
                  React.createElement("i", { className: "fas fa-th" }),
                  React.createElement(
                    "span",
                    null,
                    classItem.classroom_layout ? "Layout assigned" : "No layout"
                  )
                )
              ),

              // Status
              React.createElement(
                "div",
                { className: "class-card-status" },
                classItem.current_seating_period?.seating_assignments?.length > 0
                  ? React.createElement(
                      "span",
                      { className: "status-badge active" },
                      React.createElement("i", { className: "fas fa-check-circle" }),
                      " Active Chart"
                    )
                  : React.createElement(
                      "span",
                      { className: "status-badge inactive" },
                      React.createElement("i", { className: "fas fa-exclamation-circle" }),
                      " No Chart"
                    )
              )
            )
          )
    )
  );
};

// Export the component
if (typeof window !== "undefined") {
  window.SeatingComponent = Seating;
  console.log("Seating component loaded");
}
