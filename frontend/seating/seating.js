// frontend/seating/seating.js - Updated Seating Charts Management Component

const Seating = ({ data, navigateTo, initialView, classId, periodId }) => {
  // Use NavigationService if available, fallback to navigateTo prop
  const nav = window.NavigationService || null;
  const [classes, setClasses] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [currentView, setCurrentView] = React.useState(initialView || "list"); // 'list', 'viewer', or 'editor'
  const [selectedClassId, setSelectedClassId] = React.useState(classId || null);
  const [selectedPeriodId, setSelectedPeriodId] = React.useState(periodId || null);
  const [showNoLayoutModal, setShowNoLayoutModal] = React.useState(false);
  const [userLayouts, setUserLayouts] = React.useState([]);

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
    fetchUserLayouts();
  }, []);

  // Handle when component is loaded with initialView and classId from URL
  React.useEffect(() => {
    console.log(`Seating props changed - view: ${initialView}, classId: ${classId}, periodId: ${periodId}`);
    
    // Always update the view based on props
    setCurrentView(initialView || "list");
    setSelectedClassId(classId || null);
    setSelectedPeriodId(periodId || null);
    
    // If we're going back to list view, ensure we refresh the list
    if (initialView === "list" || (!initialView && !classId)) {
      fetchClassesWithSeatingCharts();
    }
  }, [initialView, classId, periodId]);

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

  const fetchUserLayouts = async () => {
    try {
      const response = await window.ApiModule.request('/layouts/', {
        method: 'GET'
      });
      const layoutData = response.results || response;
      setUserLayouts(layoutData);
      console.log("User layouts:", layoutData);
    } catch (err) {
      console.error("Error fetching layouts:", err);
      setUserLayouts([]);
    }
  };

  const handleClassCardClick = (classItem) => {
    console.log("Class card clicked:", classItem);
    
    // Check if user has any layouts
    if (userLayouts.length === 0) {
      // Show modal to create a layout first
      setShowNoLayoutModal(true);
    } else {
      // Go to viewer - it will auto-select the most recent layout
      handleViewChart(classItem.id, classItem.name);
    }
  };

  const handleViewChart = (classId, className) => {
    console.log("View chart for class:", classId, className);
    // Update URL when viewing chart
    if (nav?.toSeatingView) {
      nav.toSeatingView(classId);
    } else if (navigateTo) {
      navigateTo(`seating/view/${classId}`);
    } else {
      // Fallback to internal state change
      setSelectedClassId(classId);
      setCurrentView("viewer");
    }
  };

  const handleEditChart = (classId, className) => {
    console.log("Edit chart for class:", classId, className);
    // Update URL when editing chart
    if (nav?.toSeatingEdit) {
      nav.toSeatingEdit(classId);
    } else if (navigateTo) {
      navigateTo(`seating/edit/${classId}`);
    } else {
      // Fallback to internal state change
      setSelectedClassId(classId);
      setCurrentView("editor");
    }
  };

  const handleNewChart = (classId, className) => {
    console.log("Create new chart for class:", classId, className);
    // Update URL when creating new chart
    if (nav?.toSeatingEdit) {
      nav.toSeatingEdit(classId);
    } else if (navigateTo) {
      navigateTo(`seating/edit/${classId}`);
    } else {
      // Fallback to internal state change
      setSelectedClassId(classId);
      setCurrentView("editor");
    }
  };

  const handleBackToList = () => {
    console.log("handleBackToList called");
    console.log("nav:", nav);
    console.log("navigateTo:", navigateTo);
    
    // Navigate back to seating list
    if (nav?.toSeating) {
      console.log("Using NavigationService.toSeating()");
      nav.toSeating();
    } else if (navigateTo) {
      console.log("Using navigateTo prop");
      navigateTo("seating");
    } else {
      console.log("Using fallback state change");
      // Fallback to internal state change
      setCurrentView("list");
      setSelectedClassId(null);
      setSelectedPeriodId(null);
      fetchClassesWithSeatingCharts(); // Refresh the list
    }
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

  console.log("Seating component render - currentView:", currentView, "selectedClassId:", selectedClassId);
  
  // Show viewer view
  if (currentView === "viewer") {
    console.log("Showing viewer for class:", selectedClassId);

    if (window.SeatingViewer) {
      return React.createElement(window.SeatingViewer, {
        classId: selectedClassId,
        periodId: selectedPeriodId,
        onEdit: () => handleEditChart(selectedClassId, "Edit"),
        onBack: handleBackToList,
        navigateTo: navigateTo,
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
        periodId: selectedPeriodId,
        onBack: handleBackToList,
        onView: () => handleViewChart(selectedClassId, "View"),
        navigateTo: navigateTo,
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
                className: "seating-class-card floating-card",
                onClick: () => handleClassCardClick(classItem),
                style: { cursor: "pointer" },
              },

              // Class info
              React.createElement(
                "div",
                { className: "seating-class-card-header" },
                React.createElement("h3", null, classItem.name),
                React.createElement(
                  "span",
                  { className: "seating-class-period" },
                  classItem.grade_level
                    ? `Grade ${classItem.grade_level}`
                    : classItem.subject || "N/A"
                )
              ),

              // Stats
              React.createElement(
                "div",
                { className: "seating-class-card-stats" },
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
                    classItem.current_seating_period ? "Active period" : "No current period"
                  )
                )
              ),

              // Status
              React.createElement(
                "div",
                { className: "seating-class-card-status" },
                classItem.current_seating_period
                  ? React.createElement(
                      "span",
                      { className: "status-badge active" },
                      React.createElement("i", { className: "fas fa-check-circle" }),
                      classItem.current_seating_period.seating_assignments?.length > 0
                        ? ` ${classItem.current_seating_period.seating_assignments.length} Seated`
                        : " Empty Period"
                    )
                  : React.createElement(
                      "span",
                      { className: "status-badge inactive" },
                      React.createElement("i", { className: "fas fa-calendar-times" }),
                      " No Current Period"
                    )
              )
            )
          )
    ),

    // Modal for no layouts
    showNoLayoutModal && React.createElement(
      "div",
      {
        className: "modal-overlay",
        onClick: () => setShowNoLayoutModal(false)
      },
      React.createElement(
        "div",
        {
          className: "modal-content",
          onClick: (e) => e.stopPropagation()
        },
        React.createElement(
          "div",
          { className: "modal-header" },
          React.createElement("h3", null, "Layout Required"),
          React.createElement(
            "button",
            {
              className: "modal-close",
              onClick: () => setShowNoLayoutModal(false)
            },
            React.createElement("i", { className: "fas fa-times" })
          )
        ),
        React.createElement(
          "div",
          { className: "modal-body" },
          React.createElement(
            "p",
            null,
            "You need to create a classroom layout before you can start arranging seats."
          ),
          React.createElement(
            "p",
            null,
            "Layouts define the physical arrangement of tables and seats in your classroom."
          )
        ),
        React.createElement(
          "div",
          { className: "modal-footer" },
          React.createElement(
            "button",
            {
              className: "btn btn-secondary",
              onClick: () => setShowNoLayoutModal(false)
            },
            "Cancel"
          ),
          React.createElement(
            "button",
            {
              className: "btn btn-primary",
              onClick: () => {
                setShowNoLayoutModal(false);
                // Navigate to layouts page
                if (nav?.toLayouts) {
                  nav.toLayouts();
                } else if (navigateTo) {
                  navigateTo("layouts");
                } else {
                  window.location.hash = "#layouts";
                }
              }
            },
            React.createElement("i", { className: "fas fa-th" }),
            " Create Layout"
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
