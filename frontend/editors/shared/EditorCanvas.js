// frontend/editors/shared/EditorCanvas.js
// Shared Canvas component for all editors

// Import from window in browser environment
const { GRID_SIZE, TOOL_MODES } = window;
const Table = window.Table;

const { useState, useRef, useEffect, useCallback } = React;

const EditorCanvas = ({
  roomWidth,
  roomHeight,
  tables = [],
  obstacles = [],
  onItemMove,
  onItemSelect,
  onCanvasClick,
  selectedItem,
  selectedTool = TOOL_MODES.SELECT,
  showGrid = true,
  mode = "layout", // 'layout' or 'seating'
  // Seating-specific props
  assignedSeats = {},
  onSeatClick,
  highlightedSeats = [],
}) => {
  const canvasRef = useRef(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleCanvasClick = (e) => {
    if (draggedItem) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const gridX = Math.floor(x / GRID_SIZE);
    const gridY = Math.floor(y / GRID_SIZE);

    if (onCanvasClick) {
      onCanvasClick(gridX, gridY);
    }
  };

  const handleItemMouseDown = (e, item, type) => {
    if (mode !== "layout" || selectedTool !== TOOL_MODES.SELECT) return;

    e.stopPropagation();
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    setDraggedItem({ item, type });
    setDragOffset({
      x: startX - item.x_position * GRID_SIZE,
      y: startY - item.y_position * GRID_SIZE,
    });

    if (onItemSelect) {
      onItemSelect(item, type);
    }
  };

  const handleMouseMove = useCallback(
    (e) => {
      if (!draggedItem || !onItemMove) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const newX = Math.floor((currentX - dragOffset.x) / GRID_SIZE);
      const newY = Math.floor((currentY - dragOffset.y) / GRID_SIZE);

      // Constrain to grid bounds
      const constrainedX = Math.max(
        0,
        Math.min(newX, roomWidth - draggedItem.item.width)
      );
      const constrainedY = Math.max(
        0,
        Math.min(newY, roomHeight - draggedItem.item.height)
      );

      onItemMove(
        draggedItem.item,
        draggedItem.type,
        constrainedX,
        constrainedY
      );
    },
    [draggedItem, dragOffset, roomWidth, roomHeight, onItemMove]
  );

  const handleMouseUp = useCallback(() => {
    setDraggedItem(null);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (draggedItem) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [draggedItem, handleMouseMove, handleMouseUp]);

  const getCursorStyle = () => {
    if (mode === "seating") return "cursor-default";
    if (selectedTool === TOOL_MODES.SELECT) return "cursor-default";
    return "cursor-crosshair";
  };

  return React.createElement(
    "div",
    {
      className: "flex-1 relative bg-gray-50 overflow-auto p-8",
    },
    React.createElement(
      "div",
      {
        className:
          "bg-white border-2 border-gray-300 shadow-lg rounded-lg overflow-hidden",
        style: {
          width: roomWidth * GRID_SIZE,
          height: roomHeight * GRID_SIZE,
          maxWidth: "fit-content",
          maxHeight: "fit-content",
        },
      },
      React.createElement(
        "div",
        {
          ref: canvasRef,
          className: getCursorStyle(),
          style: {
            width: roomWidth * GRID_SIZE,
            height: roomHeight * GRID_SIZE,
            position: "relative",
          },
          onClick: handleCanvasClick,
        },

        // Grid background
        showGrid &&
          React.createElement("div", {
            className: "absolute inset-0 pointer-events-none",
            style: {
              backgroundImage: `
                linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
              `,
              backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
            },
          }),

        // Tables
        tables.map((table) =>
          React.createElement(Table, {
            key: table.id,
            table: table,
            isSelected:
              selectedItem?.type === "table" &&
              selectedItem?.item?.id === table.id,
            isDragging: draggedItem?.item?.id === table.id,
            onMouseDown: (e) => handleItemMouseDown(e, table, "table"),
            onClick: (e) => {
              e.stopPropagation();
              if (
                mode === "layout" &&
                selectedTool === TOOL_MODES.SELECT &&
                onItemSelect
              ) {
                onItemSelect(table, "table");
              }
            },
            onSeatClick: onSeatClick,
            showSeatNumbers: true,
            highlightedSeats: highlightedSeats,
            assignedSeats: assignedSeats[table.id] || {},
            mode: mode,
          })
        ),

        // Obstacles (only in layout mode)
        mode === "layout" &&
          obstacles.map((obstacle) =>
            React.createElement(
              "div",
              {
                key: obstacle.id,
                className: `absolute border-2 transition-all duration-200 ${
                  selectedItem?.item?.id === obstacle.id
                    ? "border-orange-500 shadow-lg ring-2 ring-orange-300 z-10"
                    : "border-gray-400 hover:border-gray-500 hover:shadow-md"
                } ${
                  selectedTool === TOOL_MODES.SELECT
                    ? "cursor-move"
                    : "cursor-pointer"
                }`,
                style: {
                  left: obstacle.x_position * GRID_SIZE,
                  top: obstacle.y_position * GRID_SIZE,
                  width: obstacle.width * GRID_SIZE,
                  height: obstacle.height * GRID_SIZE,
                  backgroundColor: obstacle.color,
                  transform:
                    draggedItem?.item?.id === obstacle.id
                      ? "scale(1.05)"
                      : "scale(1)",
                },
                onMouseDown: (e) =>
                  handleItemMouseDown(e, obstacle, "obstacle"),
                onClick: (e) => {
                  e.stopPropagation();
                  if (selectedTool === TOOL_MODES.SELECT && onItemSelect) {
                    onItemSelect(obstacle, "obstacle");
                  }
                },
              },
              React.createElement(
                "div",
                {
                  className:
                    "absolute inset-0 flex items-center justify-center text-xs font-semibold text-white pointer-events-none",
                  style: { textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)" },
                },
                obstacle.name
              )
            )
          )
      )
    )
  );
};

// Export for use in other modules
if (typeof window !== "undefined") {
  window.EditorCanvas = EditorCanvas;
}

export default EditorCanvas;
