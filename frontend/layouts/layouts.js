// frontend/layouts/layouts.js - Classroom Layouts Management Component
// Now with hash-based routing for the editor

const Layouts = ({ data, navigateTo }) => {
  // Get formatDateLong from shared utils for layouts date display
  const formatDate = window.SharedUtils.formatDateLong;

  const [layouts, setLayouts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    console.log("Layouts component mounted");
    fetchLayouts();
  }, []);

  const fetchLayouts = async () => {
    try {
      setLoading(true);
      setError("");

      if (window.ApiModule) {
        const data = await window.ApiModule.request("/layouts/");
        console.log("Layouts data received:", data);

        if (data && data.results && Array.isArray(data.results)) {
          setLayouts(data.results);
        } else if (Array.isArray(data)) {
          setLayouts(data);
        } else {
          setLayouts([]);
        }
      } else {
        throw new Error("API module not available");
      }
    } catch (err) {
      console.error("Error fetching layouts:", err);
      setError("Failed to load layouts. Please try again.");
      setLayouts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewLayout = (layoutId, layoutName) => {
    console.log("View layout:", layoutId, layoutName);
    // Directly redirect to the editor
    window.location.href = `/frontend/layouts/editor/?layout=${layoutId}`;
  };

  const handleEditLayout = (layoutId, layoutName) => {
    console.log("Edit layout:", layoutId, layoutName);
    // Directly redirect to the editor
    window.location.href = `/frontend/layouts/editor/?layout=${layoutId}&mode=edit`;
  };

  const handleNewLayout = () => {
    console.log("Create new layout");
    // Directly redirect to the editor
    window.location.href = "/frontend/layouts/editor/?mode=new";
  };

  const handleDeleteLayout = async (layoutId, layoutName) => {
    if (confirm(`Are you sure you want to delete the layout "${layoutName}"?`)) {
      try {
        await window.ApiModule.request(`/layouts/${layoutId}/`, {
          method: "DELETE",
        });
        fetchLayouts(); // Refresh the list
      } catch (err) {
        console.error("Error deleting layout:", err);
        alert("Failed to delete layout. Please try again.");
      }
    }
  };

  if (loading) {
    return React.createElement(
      "div",
      { className: "layouts-loading" },
      React.createElement("div", { className: "spinner" }),
      "Loading classroom layouts..."
    );
  }

  if (error) {
    return React.createElement(
      "div",
      { className: "layouts-error" },
      React.createElement("h3", null, "Error Loading Layouts"),
      React.createElement("p", null, error),
      React.createElement(
        "button",
        {
          className: "btn btn-primary",
          onClick: fetchLayouts,
        },
        "Try Again"
      )
    );
  }

  return React.createElement(
    "div",
    { className: "layouts-container" },

    // Header
    React.createElement(
      "div",
      { className: "layouts-header" },
      React.createElement(
        "div",
        { className: "layouts-header-content" },
        React.createElement("h2", null, "Classroom Layouts"),
        React.createElement(
          "p",
          { className: "layouts-subtitle" },
          "Design and manage physical classroom configurations"
        )
      ),
      React.createElement(
        "button",
        {
          className: "btn btn-primary",
          onClick: handleNewLayout,
        },
        React.createElement("i", { className: "fas fa-plus" }),
        " New Layout"
      )
    ),

    // Layouts grid
    React.createElement(
      "div",
      { className: "layouts-list" },

      layouts.length === 0
        ? React.createElement(
            "div",
            { className: "layouts-empty" },
            React.createElement("i", {
              className: "fas fa-th-large empty-icon",
            }),
            React.createElement("p", null, "No classroom layouts created yet"),
            React.createElement(
              "button",
              {
                className: "btn btn-primary",
                onClick: handleNewLayout,
              },
              React.createElement("i", { className: "fas fa-plus" }),
              " Create First Layout"
            )
          )
        : [...layouts]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((layout) =>
              React.createElement(
                "div",
                {
                  key: layout.id,
                  className: "layout-card",
                  style: { cursor: "pointer" },
                  onClick: () => handleEditLayout(layout.id, layout.name),
                },

                // Layout info
                React.createElement(
                  "div",
                  { className: "layout-card-info" },
                  React.createElement("h3", { className: "layout-card-title" }, layout.name),
                  layout.description &&
                    React.createElement(
                      "p",
                      { className: "layout-card-description" },
                      layout.description
                    ),
                  React.createElement(
                    "div",
                    { className: "layout-card-meta" },
                    React.createElement(
                      "span",
                      { className: "layout-meta-item" },
                      React.createElement("i", { className: "fas fa-expand" }),
                      `${layout.room_width}×${layout.room_height} grid`
                    ),
                    React.createElement(
                      "span",
                      { className: "layout-meta-item" },
                      React.createElement("i", { className: "fas fa-th" }),
                      `${layout.table_count || 0} tables`
                    ),
                    React.createElement(
                      "span",
                      { className: "layout-meta-item" },
                      React.createElement("i", { className: "fas fa-users" }),
                      `${layout.total_capacity || 0} seats`
                    )
                  )
                ),

                // Status badges
                React.createElement(
                  "div",
                  { className: "layout-card-badges" },
                  layout.is_default &&
                    React.createElement("span", { className: "layout-badge default" }, "DEFAULT"),
                  React.createElement(
                    "span",
                    {
                      className: `layout-badge ${layout.used_by_classes > 0 ? "in-use" : "unused"}`,
                    },
                    layout.used_by_classes > 0
                      ? `Used by ${layout.used_by_classes} ${
                          layout.used_by_classes === 1 ? "class" : "classes"
                        }`
                      : "Not in use"
                  )
                ),

                // Footer with date and delete button
                React.createElement(
                  "div",
                  { className: "layout-card-footer" },
                  React.createElement(
                    "span",
                    { className: "layout-date" },
                    React.createElement("i", { className: "fas fa-calendar" }),
                    `Modified: ${formatDate(layout.updated_at)}`
                  ),
                  !layout.is_default &&
                    layout.used_by_classes === 0 &&
                    React.createElement(
                      "button",
                      {
                        className: "action-icon-btn delete",
                        onClick: (e) => {
                          e.stopPropagation();
                          handleDeleteLayout(layout.id, layout.name);
                        },
                        "data-tooltip": "Delete Layout",
                        style: { marginLeft: "auto" }
                      },
                      React.createElement("i", { className: "fas fa-trash" })
                    )
                )
              )
            )
    )
  );
};

// Export the component
if (typeof window !== "undefined") {
  window.LayoutsComponent = Layouts;
  console.log("Layouts component loaded");
}
