// frontend/layouts/layouts.js - Classroom Layouts Management Component
// Now with hash-based routing for the editor

const Layouts = ({ data, navigateTo }) => {
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
      // For now, use mock data if API fails
      setLayouts([
        {
          id: 1,
          name: "Traditional Rows",
          description: "Classic classroom setup with rows of desks",
          room_width: 10,
          room_height: 8,
          table_count: 20,
          total_capacity: 20,
          created_at: "2025-06-15T10:00:00Z",
          updated_at: "2025-06-20T14:30:00Z",
          is_default: true,
          used_by_classes: 3,
        },
        {
          id: 2,
          name: "Group Tables",
          description: "Collaborative setup with group seating",
          room_width: 10,
          room_height: 8,
          table_count: 6,
          total_capacity: 24,
          created_at: "2025-06-10T09:00:00Z",
          updated_at: "2025-06-18T11:15:00Z",
          is_default: false,
          used_by_classes: 2,
        },
        {
          id: 3,
          name: "U-Shape Configuration",
          description: "U-shaped arrangement for discussions",
          room_width: 12,
          room_height: 10,
          table_count: 15,
          total_capacity: 30,
          created_at: "2025-06-05T08:00:00Z",
          updated_at: "2025-06-05T08:00:00Z",
          is_default: false,
          used_by_classes: 0,
        },
      ]);
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

  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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

                // Footer with date
                React.createElement(
                  "div",
                  { className: "layout-card-footer" },
                  React.createElement(
                    "span",
                    { className: "layout-date" },
                    React.createElement("i", { className: "fas fa-calendar" }),
                    `Modified: ${formatDate(layout.updated_at)}`
                  )
                ),

                // Action buttons
                React.createElement(
                  "div",
                  { className: "layout-card-actions" },

                  React.createElement(
                    "button",
                    {
                      className: "action-icon-btn view",
                      onClick: () => handleViewLayout(layout.id, layout.name),
                      "data-tooltip": "View Layout",
                    },
                    React.createElement("i", { className: "fas fa-eye" })
                  ),

                  React.createElement(
                    "button",
                    {
                      className: "action-icon-btn edit",
                      onClick: () => handleEditLayout(layout.id, layout.name),
                      "data-tooltip": "Edit Layout",
                    },
                    React.createElement("i", { className: "fas fa-edit" })
                  ),

                  !layout.is_default &&
                    layout.used_by_classes === 0 &&
                    React.createElement(
                      "button",
                      {
                        className: "action-icon-btn delete",
                        onClick: () => handleDeleteLayout(layout.id, layout.name),
                        "data-tooltip": "Delete Layout",
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
