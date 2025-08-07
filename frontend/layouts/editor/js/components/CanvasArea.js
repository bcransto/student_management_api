// components/CanvasArea.js - Canvas Area Component
const CanvasArea = ({
  layout,
  setLayout,
  selectedTool,
  showGrid,
  selectedItem,
  setSelectedItem,
}) => {
  const canvasRef = useRef(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleCanvasClick = (e) => {
    // Don't create new items if we're in the middle of a drag
    if (draggedItem) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const gridX = Math.floor(x / GRID_SIZE);
    const gridY = Math.floor(y / GRID_SIZE);

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
      // Clear selection if clicking on empty space
      setSelectedItem(null);
    }
  };

  const handleItemMouseDown = (e, item, type) => {
    if (selectedTool !== TOOL_MODES.SELECT) return;

    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    setDraggedItem({ item, type });
    setDragOffset({
      x: startX - item.x_position * GRID_SIZE,
      y: startY - item.y_position * GRID_SIZE,
    });
    setSelectedItem({ item, type });
  };

  const handleMouseMove = useCallback(
    (e) => {
      if (!draggedItem) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const newX = Math.floor((currentX - dragOffset.x) / GRID_SIZE);
      const newY = Math.floor((currentY - dragOffset.y) / GRID_SIZE);

      // Constrain to grid bounds
      const constrainedX = Math.max(0, Math.min(newX, layout.room_width - draggedItem.item.width));
      const constrainedY = Math.max(
        0,
        Math.min(newY, layout.room_height - draggedItem.item.height)
      );

      const updatedItem = {
        ...draggedItem.item,
        x_position: constrainedX,
        y_position: constrainedY,
      };

      if (draggedItem.type === "table") {
        setLayout((prev) => ({
          ...prev,
          tables: prev.tables.map((t) => (t.id === draggedItem.item.id ? updatedItem : t)),
        }));
      } else if (draggedItem.type === "obstacle") {
        setLayout((prev) => ({
          ...prev,
          obstacles: prev.obstacles.map((o) => (o.id === draggedItem.item.id ? updatedItem : o)),
        }));
      }

      setSelectedItem((prev) => (prev ? { ...prev, item: updatedItem } : null));
    },
    [draggedItem, dragOffset, layout.room_width, layout.room_height, setLayout, setSelectedItem]
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

  return React.createElement(
    "div",
    {
      className: "flex-1 relative bg-gray-50 overflow-auto p-8",
    },
    React.createElement(
      "div",
      {
        className: "bg-white border-2 border-gray-300 shadow-lg rounded-lg overflow-hidden",
        style: {
          width: layout.room_width * GRID_SIZE,
          height: layout.room_height * GRID_SIZE,
          maxWidth: "fit-content",
          maxHeight: "fit-content",
        },
      },
      React.createElement(
        "div",
        {
          ref: canvasRef,
          className: "relative cursor-crosshair",
          style: {
            width: layout.room_width * GRID_SIZE,
            height: layout.room_height * GRID_SIZE,
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
        layout.tables.map((table) =>
          React.createElement(
            "div",
            {
              key: table.id,
              className: `absolute border-2 bg-blue-100 transition-all duration-200 ${
                table.table_shape === "round" ? "rounded-full" : "rounded-lg"
              } ${
                selectedItem?.item?.id === table.id
                  ? "border-blue-500 shadow-lg ring-2 ring-blue-300 z-10"
                  : "border-blue-400 hover:border-blue-500 hover:shadow-md"
              } ${selectedTool === TOOL_MODES.SELECT ? "cursor-move" : "cursor-pointer"}`,
              style: {
                left: table.x_position * GRID_SIZE,
                top: table.y_position * GRID_SIZE,
                width: table.width * GRID_SIZE,
                height: table.height * GRID_SIZE,
                transform: draggedItem?.item?.id === table.id ? "scale(1.05)" : "scale(1)",
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
                className:
                  "absolute -top-6 left-0 bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold pointer-events-none",
              },
              table.table_name
            ),

            // Individual seat circles - RESTORED!
            table.seats &&
              table.seats.map((seat) =>
                React.createElement(
                  "div",
                  {
                    key: seat.seat_number,
                    className: `absolute w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold pointer-events-none transition-colors ${
                      seat.is_accessible
                        ? "bg-green-400 border-2 border-green-600 text-green-800 hover:bg-green-500"
                        : "bg-blue-300 border-2 border-blue-500 text-blue-800 hover:bg-blue-400"
                    }`,
                    style: {
                      left: `calc(${seat.relative_x * 100}% - 12px)`, // Center the 24px circle
                      top: `calc(${seat.relative_y * 100}% - 12px)`, // Center the 24px circle
                    },
                    title: `Seat ${seat.seat_number}${seat.is_accessible ? " (Accessible)" : ""}`,
                  },
                  seat.seat_number
                )
              )
          )
        ),

        // Obstacles
        layout.obstacles.map((obstacle) =>
          React.createElement(
            "div",
            {
              key: obstacle.id,
              className: `absolute border-2 transition-all duration-200 ${
                selectedItem?.item?.id === obstacle.id
                  ? "border-orange-500 shadow-lg ring-2 ring-orange-300 z-10"
                  : "border-gray-400 hover:border-gray-500 hover:shadow-md"
              } ${selectedTool === TOOL_MODES.SELECT ? "cursor-move" : "cursor-pointer"}`,
              style: {
                left: obstacle.x_position * GRID_SIZE,
                top: obstacle.y_position * GRID_SIZE,
                width: obstacle.width * GRID_SIZE,
                height: obstacle.height * GRID_SIZE,
                backgroundColor: obstacle.color,
                transform: draggedItem?.item?.id === obstacle.id ? "scale(1.05)" : "scale(1)",
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
