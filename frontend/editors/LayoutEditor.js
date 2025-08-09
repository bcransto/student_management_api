// frontend/editors/LayoutEditor.js
// Main Layout Editor component using shared components

// Import from window in browser environment
const {
  GRID_SIZE,
  TOOL_MODES,
  TABLE_SHAPES,
  OBSTACLE_TYPES,
  ROOM_CONSTRAINTS,
  DEFAULT_TABLE,
  DEFAULT_OBSTACLE,
  generateSeats,
} = window;
const EditorCanvas = window.EditorCanvas;
const Table = window.Table;

const { useState, useEffect } = React;

const LayoutEditor = ({ layoutId = null, onSave, onCancel }) => {
  const [layout, setLayout] = useState({
    id: layoutId,
    name: "New Classroom Layout",
    description: "",
    room_width: 15,
    room_height: 10,
    tables: [],
    obstacles: [],
  });

  const [selectedTool, setSelectedTool] = useState(TOOL_MODES.SELECT);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [loading, setLoading] = useState(false);

  // Load layout if editing
  useEffect(() => {
    if (layoutId) {
      loadLayout(layoutId);
    }
  }, [layoutId]);

  const loadLayout = async (id) => {
    try {
      setLoading(true);
      const response = await ApiHelper.request(`/layouts/${id}/`);
      setLayout(response);
    } catch (error) {
      console.error("Failed to load layout:", error);
      alert("Failed to load layout");
    } finally {
      setLoading(false);
    }
  };

  const handleCanvasClick = (gridX, gridY) => {
    if (selectedTool === TOOL_MODES.TABLE) {
      const newTable = {
        id: Date.now(),
        table_number: layout.tables.length + 1,
        table_name: `Table ${layout.tables.length + 1}`,
        x_position: Math.max(0, Math.min(gridX, layout.room_width - DEFAULT_TABLE.width)),
        y_position: Math.max(0, Math.min(gridY, layout.room_height - DEFAULT_TABLE.height)),
        width: DEFAULT_TABLE.width,
        height: DEFAULT_TABLE.height,
        max_seats: DEFAULT_TABLE.max_seats,
        table_shape: DEFAULT_TABLE.table_shape,
        rotation: DEFAULT_TABLE.rotation,
        seats: generateSeats(
          DEFAULT_TABLE.table_shape,
          DEFAULT_TABLE.max_seats,
          DEFAULT_TABLE.width,
          DEFAULT_TABLE.height
        ),
      };

      setLayout((prev) => ({
        ...prev,
        tables: [...prev.tables, newTable],
      }));
      setSelectedItem({ type: "table", item: newTable });
    } else if (selectedTool === TOOL_MODES.OBSTACLE) {
      const obstacleType = OBSTACLE_TYPES[0];
      const newObstacle = {
        id: Date.now(),
        name: obstacleType.name,
        obstacle_type: obstacleType.id,
        x_position: Math.max(0, Math.min(gridX, layout.room_width - DEFAULT_OBSTACLE.width)),
        y_position: Math.max(0, Math.min(gridY, layout.room_height - DEFAULT_OBSTACLE.height)),
        width: DEFAULT_OBSTACLE.width,
        height: DEFAULT_OBSTACLE.height,
        color: obstacleType.color,
      };

      setLayout((prev) => ({
        ...prev,
        obstacles: [...prev.obstacles, newObstacle],
      }));
      setSelectedItem({ type: "obstacle", item: newObstacle });
    } else if (selectedTool === TOOL_MODES.SELECT) {
      setSelectedItem(null);
    }
  };

  const handleItemMove = (item, type, newX, newY) => {
    const updatedItem = {
      ...item,
      x_position: newX,
      y_position: newY,
    };

    if (type === "table") {
      setLayout((prev) => ({
        ...prev,
        tables: prev.tables.map((t) => (t.id === item.id ? updatedItem : t)),
      }));
    } else if (type === "obstacle") {
      setLayout((prev) => ({
        ...prev,
        obstacles: prev.obstacles.map((o) => (o.id === item.id ? updatedItem : o)),
      }));
    }

    setSelectedItem((prev) => (prev ? { ...prev, item: updatedItem } : null));
  };

  const handleItemSelect = (item, type) => {
    setSelectedItem({ item, type });
  };

  const handleDeleteSelected = () => {
    if (!selectedItem) return;

    if (selectedItem.type === "table") {
      setLayout((prev) => ({
        ...prev,
        tables: prev.tables.filter((t) => t.id !== selectedItem.item.id),
      }));
    } else if (selectedItem.type === "obstacle") {
      setLayout((prev) => ({
        ...prev,
        obstacles: prev.obstacles.filter((o) => o.id !== selectedItem.item.id),
      }));
    }

    setSelectedItem(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === "Delete" && selectedItem) {
        handleDeleteSelected();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [selectedItem]);

  const handleSave = async () => {
    try {
      setLoading(true);
      await onSave(layout);
    } catch (error) {
      console.error("Save failed:", error);
      alert("Failed to save layout");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return React.createElement(
      "div",
      { className: "flex items-center justify-center h-full" },
      React.createElement(
        "div",
        { className: "text-center" },
        React.createElement("div", {
          className:
            "animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4",
        }),
        React.createElement("p", { className: "text-gray-600" }, "Loading...")
      )
    );
  }

  return React.createElement(
    "div",
    { className: "flex h-full bg-white rounded-lg shadow-lg overflow-hidden" },

    // Sidebar
    React.createElement(
      "div",
      { className: "w-80 bg-gray-50 border-r border-gray-200 flex flex-col" },

      // Header
      React.createElement(
        "div",
        { className: "p-4 border-b border-gray-200" },
        React.createElement(
          "h2",
          { className: "text-xl font-bold text-gray-800 mb-4" },
          layoutId ? "Edit Layout" : "Create Layout"
        ),

        // Layout Info
        React.createElement(
          "div",
          { className: "space-y-3" },
          React.createElement(
            "div",
            null,
            React.createElement(
              "label",
              { className: "block text-sm font-medium text-gray-700 mb-1" },
              "Layout Name"
            ),
            React.createElement("input", {
              type: "text",
              value: layout.name,
              onChange: (e) => setLayout((prev) => ({ ...prev, name: e.target.value })),
              className:
                "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500",
            })
          ),

          // Room dimensions
          React.createElement(
            "div",
            { className: "grid grid-cols-2 gap-3" },
            React.createElement(
              "div",
              null,
              React.createElement(
                "label",
                { className: "block text-sm font-medium text-gray-700 mb-1" },
                "Width"
              ),
              React.createElement("input", {
                type: "number",
                value: layout.room_width,
                onChange: (e) =>
                  setLayout((prev) => ({
                    ...prev,
                    room_width: parseInt(e.target.value) || 15,
                  })),
                className: "w-full px-3 py-2 border border-gray-300 rounded-lg",
                min: ROOM_CONSTRAINTS.MIN_WIDTH,
                max: ROOM_CONSTRAINTS.MAX_WIDTH,
              })
            ),
            React.createElement(
              "div",
              null,
              React.createElement(
                "label",
                { className: "block text-sm font-medium text-gray-700 mb-1" },
                "Height"
              ),
              React.createElement("input", {
                type: "number",
                value: layout.room_height,
                onChange: (e) =>
                  setLayout((prev) => ({
                    ...prev,
                    room_height: parseInt(e.target.value) || 10,
                  })),
                className: "w-full px-3 py-2 border border-gray-300 rounded-lg",
                min: ROOM_CONSTRAINTS.MIN_HEIGHT,
                max: ROOM_CONSTRAINTS.MAX_HEIGHT,
              })
            )
          )
        )
      ),

      // Tools
      React.createElement(
        "div",
        { className: "p-4 border-b border-gray-200" },
        React.createElement(
          "h3",
          { className: "text-lg font-semibold text-gray-800 mb-3" },
          "Tools"
        ),
        React.createElement(
          "div",
          { className: "grid grid-cols-3 gap-2" },

          // Tool buttons
          Object.entries(TOOL_MODES).map(([key, value]) =>
            React.createElement(
              "button",
              {
                key: value,
                onClick: () => setSelectedTool(value),
                className: `p-3 rounded-lg transition-colors ${
                  selectedTool === value
                    ? "bg-purple-100 text-purple-600 border-2 border-purple-300"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100 border-2 border-transparent"
                }`,
              },
              React.createElement(
                "div",
                { className: "text-center" },
                React.createElement(
                  "div",
                  { className: "text-xl mb-1" },
                  value === TOOL_MODES.SELECT ? "👆" : value === TOOL_MODES.TABLE ? "🪑" : "📦"
                ),
                React.createElement("div", { className: "text-xs capitalize" }, value)
              )
            )
          )
        ),

        // Grid toggle
        React.createElement(
          "div",
          { className: "mt-3" },
          React.createElement(
            "button",
            {
              onClick: () => setShowGrid(!showGrid),
              className: `flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg ${
                showGrid ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-600"
              }`,
            },
            React.createElement("span", null, showGrid ? "Hide Grid" : "Show Grid")
          )
        )
      ),

      // Selected item properties
      selectedItem &&
        React.createElement(
          "div",
          { className: "p-4 flex-1 overflow-y-auto" },
          React.createElement(
            "h3",
            { className: "text-lg font-semibold text-gray-800 mb-3" },
            selectedItem.type === "table" ? "Table Properties" : "Obstacle Properties"
          ),

          // Properties form would go here
          React.createElement(
            "button",
            {
              onClick: handleDeleteSelected,
              className:
                "w-full px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 mt-4",
            },
            "Delete Selected"
          )
        ),

      // Actions
      React.createElement(
        "div",
        { className: "p-4 border-t border-gray-200 bg-white" },
        React.createElement(
          "div",
          { className: "flex gap-2" },
          React.createElement(
            "button",
            {
              onClick: handleSave,
              className: "flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700",
            },
            layoutId ? "Update Layout" : "Save Layout"
          ),
          React.createElement(
            "button",
            {
              onClick: onCancel,
              className: "flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300",
            },
            "Cancel"
          )
        )
      )
    ),

    // Canvas
    React.createElement(EditorCanvas, {
      roomWidth: layout.room_width,
      roomHeight: layout.room_height,
      tables: layout.tables,
      obstacles: layout.obstacles,
      onItemMove: handleItemMove,
      onItemSelect: handleItemSelect,
      onCanvasClick: handleCanvasClick,
      selectedItem: selectedItem,
      selectedTool: selectedTool,
      showGrid: showGrid,
      mode: "layout",
    })
  );
};

// Export for use in other modules
if (typeof window !== "undefined") {
  window.LayoutEditor = LayoutEditor;
}

export default LayoutEditor;
