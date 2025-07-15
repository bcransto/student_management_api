// app.js - Main Layout Editor Component (Tailwind-free version)
// Extract React hooks at the top
const { useState, useEffect, useRef } = React;

const LayoutEditor = () => {
  const [layout, setLayout] = useState({ ...DEFAULT_LAYOUT });
  const [selectedTool, setSelectedTool] = useState(TOOL_MODES.SELECT);
  const [showGrid, setShowGrid] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Load layout from URL parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const layoutId = urlParams.get("layout");

    if (layoutId) {
      loadLayout(layoutId);
    }
  }, []);

  const loadLayout = async (layoutId) => {
    try {
      setLoading(true);
      const layoutData = await ApiHelper.request(`/layouts/${layoutId}/`);

      setLayout({
        id: layoutData.id,
        name: layoutData.name,
        description: layoutData.description || "",
        room_width: layoutData.room_width,
        room_height: layoutData.room_height,
        tables: layoutData.tables.map((table) => ({
          id: table.id || Date.now() + Math.random(),
          table_number: table.table_number,
          table_name: table.table_name,
          x_position: table.x_position,
          y_position: table.y_position,
          width: table.width,
          height: table.height,
          max_seats: table.max_seats,
          table_shape: table.table_shape,
          rotation: table.rotation,
          seats: table.seats || [],
        })),
        obstacles: layoutData.obstacles.map((obstacle) => ({
          id: obstacle.id || Date.now() + Math.random(),
          name: obstacle.name,
          obstacle_type: obstacle.obstacle_type,
          x_position: obstacle.x_position,
          y_position: obstacle.y_position,
          width: obstacle.width,
          height: obstacle.height,
          color: obstacle.color,
        })),
      });

      document.title = `Edit Layout: ${layoutData.name}`;
    } catch (error) {
      console.error("Error loading layout:", error);
      alert("Failed to load layout. Please check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate layout
    const validation = validateLayout(layout);
    if (!validation.isValid) {
      alert(`Please fix the following issues:\n${validation.errors.join("\n")}`);
      return;
    }

    setLoading(true);
    try {
      // Prepare data for API
      const layoutData = {
        name: layout.name,
        description: layout.description,
        room_width: layout.room_width,
        room_height: layout.room_height,
        tables: layout.tables.map((table) => ({
          table_number: table.table_number,
          table_name: table.table_name,
          x_position: table.x_position,
          y_position: table.y_position,
          width: table.width,
          height: table.height,
          max_seats: table.max_seats,
          table_shape: table.table_shape,
          rotation: table.rotation || 0,
          seats: table.seats.map((seat) => ({
            seat_number: seat.seat_number,
            relative_x: seat.relative_x,
            relative_y: seat.relative_y,
            is_accessible: seat.is_accessible,
          })),
        })),
        obstacles: layout.obstacles.map((obstacle) => ({
          name: obstacle.name,
          obstacle_type: obstacle.obstacle_type,
          x_position: obstacle.x_position,
          y_position: obstacle.y_position,
          width: obstacle.width,
          height: obstacle.height,
          color: obstacle.color,
        })),
      };

      let response;
      if (layout.id) {
        // Update existing layout
        response = await ApiHelper.request(`/layouts/${layout.id}/`, {
          method: "PATCH",
          body: JSON.stringify(layoutData),
        });
      } else {
        // Create new layout
        response = await ApiHelper.request("/layouts/", {
          method: "POST",
          body: JSON.stringify(layoutData),
        });
        // Update layout with the new ID
        setLayout((prev) => ({ ...prev, id: response.id }));
      }

      alert(
        layout.id
          ? "✅ Layout updated successfully!"
          : "✅ Layout created successfully!"
      );
    } catch (error) {
      console.error("Save error:", error);
      alert("❌ Error saving layout. Please check console for details.");
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return React.createElement(
      "div",
      {
        className: "layout-loading",
      },
      React.createElement(
        "div",
        {
          className: "layout-loading-content",
        },
        React.createElement("div", {
          className: "layout-loading-spinner",
        }),
        React.createElement(
          "p",
          {
            className: "layout-loading-text",
          },
          "Loading layout editor..."
        )
      )
    );
  }

  // Main layout editor render
  return React.createElement(
    "div",
    {
      className: "layout-editor-container",
    },
    React.createElement(LayoutEditorSidebar, {
      layout,
      setLayout,
      selectedTool,
      setSelectedTool,
      onSave: handleSave,
      showGrid,
      setShowGrid,
      selectedItem,
      setSelectedItem,
    }),
    React.createElement(CanvasArea, {
      layout,
      setLayout,
      selectedTool,
      showGrid,
      selectedItem,
      setSelectedItem,
    })
  );
};

// Initialize the app
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(LayoutEditor));