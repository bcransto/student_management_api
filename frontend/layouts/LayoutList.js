// frontend/layouts/LayoutList.js
// Layout list view component

const { useState, useEffect } = React;

const LayoutList = ({ onNavigate }) => {
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLayout, setSelectedLayout] = useState(null);

  useEffect(() => {
    loadLayouts();
  }, []);

  const loadLayouts = async () => {
    try {
      setLoading(true);
      const response = await ApiHelper.request("/layouts/");
      setLayouts(response);
    } catch (error) {
      console.error("Failed to load layouts:", error);
      alert("Failed to load layouts");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLayout = async (layoutId) => {
    if (!confirm("Are you sure you want to delete this layout?")) return;

    try {
      await ApiHelper.request(`/layouts/${layoutId}/`, {
        method: "DELETE",
      });
      await loadLayouts();
    } catch (error) {
      console.error("Failed to delete layout:", error);
      alert("Failed to delete layout");
    }
  };

  const handleCreateNew = () => {
    onNavigate("layout-editor", { action: "create" });
  };

  const handleEditLayout = (layoutId) => {
    onNavigate("layout-editor", { layoutId });
  };

  if (loading) {
    return React.createElement(
      "div",
      { className: "loading" },
      React.createElement("div", { className: "spinner" }),
      React.createElement("p", null, "Loading layouts...")
    );
  }

  return React.createElement(
    "div",
    { className: "content-area" },

    // Header
    React.createElement(
      "div",
      { className: "page-header" },
      React.createElement(
        "h1",
        { className: "page-title" },
        "Classroom Layouts"
      ),
      React.createElement(
        "p",
        { className: "page-subtitle" },
        "Create and manage classroom seating layouts"
      )
    ),

    // Actions bar
    React.createElement(
      "div",
      { className: "mb-6" },
      React.createElement(
        "button",
        {
          onClick: handleCreateNew,
          className: "btn btn-primary",
        },
        React.createElement("i", { className: "fas fa-plus mr-2" }),
        "Create New Layout"
      )
    ),

    // Layouts grid
    React.createElement(
      "div",
      { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" },

      layouts.length === 0
        ? React.createElement(
            "div",
            { className: "col-span-full text-center py-12 text-gray-500" },
            React.createElement("i", { className: "fas fa-th text-4xl mb-4" }),
            React.createElement("p", null, "No layouts created yet"),
            React.createElement(
              "p",
              { className: "text-sm mt-2" },
              "Create your first classroom layout to get started"
            )
          )
        : layouts.map((layout) =>
            React.createElement(
              "div",
              {
                key: layout.id,
                className:
                  "bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer",
                onClick: () => setSelectedLayout(layout),
              },

              // Layout preview
              React.createElement(
                "div",
                { className: "p-4 border-b border-gray-200" },
                React.createElement(
                  "div",
                  {
                    className:
                      "bg-gray-100 rounded-lg h-40 flex items-center justify-center relative overflow-hidden",
                  },
                  // Mini preview of the layout
                  React.createElement(
                    "div",
                    {
                      className: "absolute inset-0 p-4",
                      style: {
                        transform: `scale(${Math.min(
                          160 / (layout.room_width * 40),
                          140 / (layout.room_height * 40)
                        )})`,
                        transformOrigin: "top left",
                      },
                    },
                    // Mini tables
                    layout.tables &&
                      layout.tables.map((table) =>
                        React.createElement("div", {
                          key: table.id,
                          className: `absolute bg-blue-300 rounded ${
                            table.table_shape === "round" ? "rounded-full" : ""
                          }`,
                          style: {
                            left: table.x_position * 40,
                            top: table.y_position * 40,
                            width: table.width * 40,
                            height: table.height * 40,
                          },
                        })
                      )
                  )
                )
              ),

              // Layout info
              React.createElement(
                "div",
                { className: "p-4" },
                React.createElement(
                  "h3",
                  { className: "font-semibold text-lg mb-1" },
                  layout.name
                ),
                React.createElement(
                  "div",
                  { className: "text-sm text-gray-600 space-y-1" },
                  React.createElement(
                    "p",
                    null,
                    React.createElement("i", {
                      className: "fas fa-chair mr-1",
                    }),
                    `${layout.tables?.length || 0} tables`
                  ),
                  React.createElement(
                    "p",
                    null,
                    React.createElement("i", {
                      className: "fas fa-expand mr-1",
                    }),
                    `${layout.room_width}m × ${layout.room_height}m`
                  ),
                  layout.description &&
                    React.createElement(
                      "p",
                      { className: "italic" },
                      layout.description
                    )
                ),

                // Actions
                React.createElement(
                  "div",
                  { className: "flex gap-2 mt-4" },
                  React.createElement(
                    "button",
                    {
                      onClick: (e) => {
                        e.stopPropagation();
                        handleEditLayout(layout.id);
                      },
                      className:
                        "flex-1 px-3 py-1 bg-purple-100 text-purple-600 rounded hover:bg-purple-200",
                    },
                    React.createElement("i", { className: "fas fa-edit mr-1" }),
                    "Edit"
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: (e) => {
                        e.stopPropagation();
                        handleDeleteLayout(layout.id);
                      },
                      className:
                        "px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200",
                    },
                    React.createElement("i", { className: "fas fa-trash" })
                  )
                )
              )
            )
          )
    )
  );
};

// Export
if (typeof window !== "undefined") {
  window.LayoutList = LayoutList;
}
