// components/CanvasArea.js - Canvas Area Component (No Tailwind)
// Get shared styles
const { LayoutStyles } = window;

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
  const [selectedSeat, setSelectedSeat] = useState(null); // {tableId, seatNumber}

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
    setSelectedSeat(null); // Clear seat selection when selecting table
  };

  const handleSeatClick = (e, tableId, seatNumber) => {
    if (selectedTool !== TOOL_MODES.SELECT) return;
    
    e.stopPropagation();
    setSelectedSeat({ tableId, seatNumber });
    setSelectedItem(null); // Clear table/obstacle selection
  };

  const nudgeSeat = (direction) => {
    if (!selectedSeat) return;

    const table = layout.tables.find(t => t.id === selectedSeat.tableId);
    if (!table) return;

    const nudgeAmount = 0.02; // 2% movement per key press
    
    const updatedSeats = table.seats.map(seat => {
      if (seat.seat_number === selectedSeat.seatNumber) {
        let newX = seat.relative_x;
        let newY = seat.relative_y;
        
        switch(direction) {
          case 'ArrowUp':
            newY = Math.max(0, newY - nudgeAmount);
            break;
          case 'ArrowDown':
            newY = Math.min(1, newY + nudgeAmount);
            break;
          case 'ArrowLeft':
            newX = Math.max(0, newX - nudgeAmount);
            break;
          case 'ArrowRight':
            newX = Math.min(1, newX + nudgeAmount);
            break;
        }
        
        return { ...seat, relative_x: newX, relative_y: newY };
      }
      return seat;
    });

    const updatedTable = { ...table, seats: updatedSeats };
    
    setLayout(prev => ({
      ...prev,
      tables: prev.tables.map(t => t.id === table.id ? updatedTable : t)
    }));
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

  // Handle keyboard events for nudging seats
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedSeat) return;
      
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        nudgeSeat(e.key);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedSeat, layout]);

  // Container styles
  const containerStyle = {
    flex: 1,
    position: 'relative',
    backgroundColor: '#f8f9fa',
    overflow: 'auto',
    padding: '32px'
  };

  // Canvas wrapper styles - use shared styles
  const canvasWrapperStyle = {
    ...LayoutStyles.getCanvasContainerStyle(layout.room_width, layout.room_height, GRID_SIZE),
    overflow: 'hidden',
    maxWidth: 'fit-content',
    maxHeight: 'fit-content'
  };

  // Canvas style
  const canvasStyle = {
    position: 'relative',
    cursor: selectedTool === TOOL_MODES.SELECT ? 'default' : 'crosshair',
    width: layout.room_width * GRID_SIZE,
    height: layout.room_height * GRID_SIZE
  };

  // Grid background style - use shared styles
  const gridStyle = LayoutStyles.getGridStyle(GRID_SIZE);

  // Table styles - use shared styles and add cursor
  const getTableStyle = (table, isSelected) => ({
    ...LayoutStyles.getTableStyle(table, isSelected, draggedItem?.item?.id === table.id, GRID_SIZE),
    cursor: selectedTool === TOOL_MODES.SELECT ? 'move' : 'pointer'
  });

  // Table label style - use shared styles
  const tableLabelStyle = LayoutStyles.getTableLabelStyle();

  // Seat styles - 80% of grid size (handled by shared styles)
  const getSeatStyle = (seat, tableId, isSelected) => ({
    ...LayoutStyles.getSeatStyle(seat, {
      isOccupied: false,
      isSelected: isSelected,
      isAccessible: false,
      gridSize: GRID_SIZE,
      showName: false
    }),
    cursor: selectedTool === TOOL_MODES.SELECT ? 'pointer' : 'default',
    pointerEvents: selectedTool === TOOL_MODES.SELECT ? 'auto' : 'none'
  });

  // Obstacle styles - use shared styles and add cursor
  const getObstacleStyle = (obstacle, isSelected) => ({
    ...LayoutStyles.getObstacleStyle(obstacle, isSelected, draggedItem?.item?.id === obstacle.id, GRID_SIZE),
    cursor: selectedTool === TOOL_MODES.SELECT ? 'move' : 'pointer'
  });

  // Obstacle label style - use shared styles
  const obstacleLabelStyle = LayoutStyles.getObstacleLabelStyle();

  return React.createElement(
    "div",
    { style: containerStyle },
    React.createElement(
      "div",
      { style: canvasWrapperStyle },
      React.createElement(
        "div",
        {
          ref: canvasRef,
          style: canvasStyle,
          onClick: handleCanvasClick,
        },

        // Grid background
        showGrid && React.createElement("div", { style: gridStyle }),

        // Selected seat indicator
        selectedSeat && React.createElement(
          "div",
          {
            style: {
              position: 'absolute',
              top: '10px',
              right: '10px',
              backgroundColor: '#fef3c7',
              border: '2px solid #f59e0b',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#92400e',
              zIndex: 100,
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }
          },
          `Selected: Table ${layout.tables.find(t => t.id === selectedSeat.tableId)?.table_number} - Seat ${selectedSeat.seatNumber}`,
          React.createElement(
            "div",
            { style: { fontSize: '12px', fontWeight: 'normal', marginTop: '4px' } },
            "Use arrow keys to nudge"
          )
        ),

        // Tables
        layout.tables.map((table) =>
          React.createElement(
            "div",
            {
              key: table.id,
              style: getTableStyle(table, selectedItem?.item?.id === table.id),
              onMouseDown: (e) => handleItemMouseDown(e, table, "table"),
              onClick: (e) => {
                e.stopPropagation();
                if (selectedTool === TOOL_MODES.SELECT) {
                  setSelectedItem({ item: table, type: "table" });
                }
              },
            },
            // Table label - centered, just number, white text
            React.createElement(
              "div",
              { style: tableLabelStyle },
              String(table.table_number)
            ),

            // Individual seats
            table.seats &&
              table.seats.map((seat) =>
                React.createElement(
                  "div",
                  {
                    key: seat.seat_number,
                    style: getSeatStyle(
                      seat, 
                      table.id,
                      selectedSeat?.tableId === table.id && selectedSeat?.seatNumber === seat.seat_number
                    ),
                    title: `Seat ${seat.seat_number} (Click to select, then use arrow keys to nudge)`,
                    onClick: (e) => handleSeatClick(e, table.id, seat.seat_number)
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
              style: getObstacleStyle(obstacle, selectedItem?.item?.id === obstacle.id),
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
              { style: obstacleLabelStyle },
              obstacle.name
            )
          )
        )
      )
    )
  );
};