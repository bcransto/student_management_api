// components/CanvasArea.js - Canvas Area Component (Tailwind-free version)
// Extract React hooks at the top
const { useState, useEffect, useRef } = React;

const CanvasArea = ({
  layout,
  setLayout,
  selectedTool,
  showGrid,
  selectedItem,
  setSelectedItem,
}) => {
  console.log("CanvasArea render, showGrid:", showGrid);
  const canvasRef = useRef(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Canvas click handler for adding new items
  const handleCanvasClick = (e) => {
    if (
      selectedTool === TOOL_MODES.TABLE ||
      selectedTool === TOOL_MODES.OBSTACLE
    ) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / GRID_SIZE);
      const y = Math.floor((e.clientY - rect.top) / GRID_SIZE);

      if (selectedTool === TOOL_MODES.TABLE) {
        const newTable = createTable(x, y);
        setLayout((prev) => ({
          ...prev,
          tables: [...prev.tables, newTable],
        }));
      } else if (selectedTool === TOOL_MODES.OBSTACLE) {
        const newObstacle = createObstacle(x, y);
        setLayout((prev) => ({
          ...prev,
          obstacles: [...prev.obstacles, newObstacle],
        }));
      }
    }
  };

  // Mouse handlers for dragging
  const handleItemMouseDown = (e, item, type) => {
    if (selectedTool === TOOL_MODES.SELECT) {
      e.stopPropagation();
      const rect = canvasRef.current.getBoundingClientRect();
      setDraggedItem({ item, type });
      setDragOffset({
        x: e.clientX - rect.left - item.x_position * GRID_SIZE,
        y: e.clientY - rect.top - item.y_position * GRID_SIZE,
      });
      setSelectedItem({ item, type });
    }
  };

  const handleMouseMove = (e) => {
    if (draggedItem && selectedTool === TOOL_MODES.SELECT) {
      const rect = canvasRef.current.getBoundingClientRect();
      const newX = Math.round(
        (e.clientX - rect.left - dragOffset.x) / GRID_SIZE
      );
      const newY = Math.round(
        (e.clientY - rect.top - dragOffset.y) / GRID_SIZE
      );

      if (draggedItem.type === "table") {
        setLayout((prev) => ({
          ...prev,
          tables: prev.tables.map((t) =>
            t.id === draggedItem.item.id
              ? {
                  ...t,
                  x_position: Math.max(0, newX),
                  y_position: Math.max(0, newY),
                }
              : t
          ),
        }));
      } else if (draggedItem.type === "obstacle") {
        setLayout((prev) => ({
          ...prev,
          obstacles: prev.obstacles.map((o) =>
            o.id === draggedItem.item.id
              ? {
                  ...o,
                  x_position: Math.max(0, newX),
                  y_position: Math.max(0, newY),
                }
              : o
          ),
        }));
      }
    }
  };

  const handleMouseUp = () => {
    setDraggedItem(null);
  };

  React.useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggedItem, dragOffset]);

  return React.createElement(
    "div",
    {
      className: "layout-canvas-container",
    },
    // Canvas Header
    React.createElement(
      "div",
      {
        className: "layout-canvas-header",
      },
      React.createElement(
        "div",
        null,
        React.createElement(
          "h3",
          {
            className: "layout-canvas-title",
          },
          layout.name || "Untitled Layout"
        ),
        React.createElement(
          "p",
          {
            className: "layout-canvas-subtitle",
          },
          selectedTool === TOOL_MODES.SELECT &&
            "Click to select items, drag to move",
          selectedTool === TOOL_MODES.TABLE && "Click to place a new table",
          selectedTool === TOOL_MODES.OBSTACLE &&
            "Click to place a new obstacle"
        )
      ),
      selectedItem &&
        React.createElement(
          "div",
          {
            className: "layout-selected-badge",
          },
          `${selectedItem.type === "table" ? "🪑" : "📦"} ${
            selectedItem.item.table_name || selectedItem.item.name
          }`
        )
    ),

    // Canvas Wrapper
    React.createElement(
      "div",
      {
        className: "layout-canvas-wrapper",
      },
      React.createElement(
        "div",
        {
          ref: canvasRef,
          className: showGrid ? "layout-canvas seating-grid" : "layout-canvas",
          style: {
            width: layout.room_width * GRID_SIZE,
            height: layout.room_height * GRID_SIZE,
            cursor:
              selectedTool === TOOL_MODES.SELECT ? "default" : "crosshair",
          },
          onClick: handleCanvasClick,
        },
        // Render Tables
        layout.tables.map((table) =>
          React.createElement(
            "div",
            {
              key: table.id,
              className: `seating-table ${table.table_shape} ${
                selectedItem?.item?.id === table.id ? "selected" : ""
              } ${draggedItem?.item?.id === table.id ? "dragging" : ""}`,
              style: {
                left: table.x_position * GRID_SIZE,
                top: table.y_position * GRID_SIZE,
                width: table.width * GRID_SIZE,
                height: table.height * GRID_SIZE,
              },
              onMouseDown: (e) => handleItemMouseDown(e, table, "table"),
              onClick: (e) => {
                e.stopPropagation();
                if (selectedTool === TOOL_MODES.SELECT) {
                  setSelectedItem({ item: table, type: "table" });
                }
              },
            },
            // Table label
            React.createElement(
              "div",
              {
                className: "layout-table-label",
              },
              table.table_name
            ),

            // Table number display
            React.createElement(
              "div",
              {
                className: "seating-table-number",
              },
              table.table_number
            ),

            // Individual seat circles
            table.seats &&
              table.seats.map((seat) =>
                React.createElement(
                  "div",
                  {
                    key: seat.seat_number,
                    className: `seating-seat ${
                      seat.is_accessible ? "accessible" : "empty"
                    }`,
                    style: {
                      left: `calc(${seat.relative_x * 100}% - 14px)`,
                      top: `calc(${seat.relative_y * 100}% - 14px)`,
                    },
                    title: `Seat ${seat.seat_number}${
                      seat.is_accessible ? " (Accessible)" : ""
                    }`,
                  },
                  seat.seat_number
                )
              )
          )
        ),

        // Render Obstacles
        layout.obstacles.map((obstacle) =>
          React.createElement(
            "div",
            {
              key: obstacle.id,
              className: `seating-obstacle ${obstacle.obstacle_type} ${
                selectedItem?.item?.id === obstacle.id ? "selected" : ""
              } ${draggedItem?.item?.id === obstacle.id ? "dragging" : ""}`,
              style: {
                left: obstacle.x_position * GRID_SIZE,
                top: obstacle.y_position * GRID_SIZE,
                width: obstacle.width * GRID_SIZE,
                height: obstacle.height * GRID_SIZE,
                backgroundColor: obstacle.color || "#6b7280",
              },
              onMouseDown: (e) => handleItemMouseDown(e, obstacle, "obstacle"),
              onClick: (e) => {
                e.stopPropagation();
                if (selectedTool === TOOL_MODES.SELECT) {
                  setSelectedItem({ item: obstacle, type: "obstacle" });
                }
              },
            },
            React.createElement(
              "div",
              {
                className: "seating-obstacle-label",
              },
              obstacle.name
            )
          )
        )
      )
    )
  );
};
