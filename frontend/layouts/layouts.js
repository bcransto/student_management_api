// frontend/layouts/layouts.js - Classroom Layouts Management Component
// Now with hash-based routing for the editor

const Layouts = ({ data, navigateTo }) => {
  // Use NavigationService if available, fallback to navigateTo prop
  const nav = window.NavigationService || null;

  // Get formatDateLong from shared utils for layouts date display
  const formatDate = window.SharedUtils.formatDateLong;

  const [layouts, setLayouts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    console.log("Layouts component mounted");
    fetchLayouts();
  }, []);

  // Refetch when restored from the browser back-forward cache (bfcache) -
  // e.g. navigating back from the layout editor after a save leaves this
  // page's data stale otherwise, since bfcache restores it without re-running
  // the mount effect.
  React.useEffect(() => {
    const handlePageShow = (event) => {
      if (event.persisted) {
        console.log("Layouts page restored from bfcache - refetching");
        fetchLayouts();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
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
    // Open layout editor in view mode
    window.open(`/layout-editor/?layout=${layoutId}`, '_blank');
  };

  const handleEditLayout = (layoutId, layoutName) => {
    console.log("Edit layout:", layoutId, layoutName);
    // Navigate to layout editor in the same window
    window.location.href = `/layout-editor/?layout=${layoutId}&mode=edit`;
  };

  const handleNewLayout = () => {
    console.log("Create new layout");
    // Navigate to layout editor in the same window
    window.location.href = "/layout-editor/?mode=new";
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
      { className: "page-header-row" },
      React.createElement(
        "div",
        { className: "page-header" },
        React.createElement("h1", { className: "page-title" }, "Classroom Layouts"),
        React.createElement(
          "p",
          { className: "page-subtitle" },
          "Design and manage physical classroom configurations"
        )
      ),
      React.createElement(
        "button",
        {
          className: "btn btn-primary btn-lg",
          onClick: handleNewLayout,
        },
        React.createElement("i", { className: "fas fa-plus" }),
        " New Layout"
      )
    ),

    // Layouts grid
    React.createElement(
      "div",
      { className: "list-grid" },

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
                  className: "list-card layout-card",
                  style: { cursor: "pointer" },
                  onClick: () => handleEditLayout(layout.id, layout.name),
                },

                // Header: title + badges
                React.createElement(
                  "div",
                  { className: "list-card-header" },
                  React.createElement(
                    "div",
                    { className: "list-card-title" },
                    React.createElement("i", { className: "fas fa-th-large" }),
                    layout.name
                  ),
                  React.createElement(
                    "div",
                    { className: "layout-card-badges" },
                    layout.is_default &&
                      React.createElement("span", { className: "badge badge-info" }, "DEFAULT"),
                    React.createElement(
                      "span",
                      {
                        className: `badge ${layout.used_by_classes > 0 ? "badge-success" : "badge-neutral"}`,
                      },
                      layout.used_by_classes > 0
                        ? `Used by ${layout.used_by_classes} ${
                            layout.used_by_classes === 1 ? "class" : "classes"
                          }`
                        : "Not in use"
                    )
                  )
                ),

                layout.description &&
                  React.createElement(
                    "p",
                    { className: "layout-card-description" },
                    layout.description
                  ),

                // Meta rows
                React.createElement(
                  "div",
                  { className: "list-card-meta" },
                  React.createElement(
                    "div",
                    null,
                    React.createElement("i", { className: "fas fa-expand" }),
                    `${layout.room_width}×${layout.room_height} grid`
                  ),
                  React.createElement(
                    "div",
                    null,
                    React.createElement("i", { className: "fas fa-th" }),
                    `${layout.table_count || 0} tables`
                  ),
                  React.createElement(
                    "div",
                    null,
                    React.createElement("i", { className: "fas fa-users" }),
                    `${layout.total_capacity || 0} seats`
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
                        className: "btn btn-sm btn-ghost layout-delete-btn",
                        onClick: (e) => {
                          e.stopPropagation();
                          handleDeleteLayout(layout.id, layout.name);
                        },
                        title: "Delete Layout",
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
