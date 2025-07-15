// utils.js - Utility functions for the layout editor

// Seat generation function
const generateSeats = (tableShape, maxSeats, width = 2, height = 2) => {
  const seats = [];

  switch (tableShape) {
    case "rectangular":
      if (maxSeats <= 2) {
        seats.push(
          {
            seat_number: 1,
            relative_x: 0.25,
            relative_y: 0.5,
            is_accessible: false,
            notes: "",
          },
          {
            seat_number: 2,
            relative_x: 0.75,
            relative_y: 0.5,
            is_accessible: false,
            notes: "",
          }
        );
      } else if (maxSeats <= 4) {
        seats.push(
          {
            seat_number: 1,
            relative_x: 0.25,
            relative_y: 0.25,
            is_accessible: false,
            notes: "",
          },
          {
            seat_number: 2,
            relative_x: 0.75,
            relative_y: 0.25,
            is_accessible: false,
            notes: "",
          },
          {
            seat_number: 3,
            relative_x: 0.25,
            relative_y: 0.75,
            is_accessible: false,
            notes: "",
          },
          {
            seat_number: 4,
            relative_x: 0.75,
            relative_y: 0.75,
            is_accessible: false,
            notes: "",
          }
        );
      } else if (maxSeats <= 6) {
        // 2 on each long side, 1 on each short side
        seats.push(
          {
            seat_number: 1,
            relative_x: 0.2,
            relative_y: 0.2,
            is_accessible: false,
          },
          {
            seat_number: 2,
            relative_x: 0.5,
            relative_y: 0.1,
            is_accessible: false,
          },
          {
            seat_number: 3,
            relative_x: 0.8,
            relative_y: 0.2,
            is_accessible: false,
          },
          {
            seat_number: 4,
            relative_x: 0.2,
            relative_y: 0.8,
            is_accessible: false,
          },
          {
            seat_number: 5,
            relative_x: 0.5,
            relative_y: 0.9,
            is_accessible: false,
          },
          {
            seat_number: 6,
            relative_x: 0.8,
            relative_y: 0.8,
            is_accessible: false,
          }
        );
      } else {
        // Distribute seats evenly around the perimeter
        const perimeter = 2 * (width + height);
        const spacing = perimeter / maxSeats;

        for (let i = 0; i < maxSeats; i++) {
          const distance = i * spacing;
          let x, y;

          if (distance < width) {
            // Top edge
            x = distance / width;
            y = 0.1;
          } else if (distance < width + height) {
            // Right edge
            x = 0.9;
            y = (distance - width) / height;
          } else if (distance < 2 * width + height) {
            // Bottom edge
            x = 1 - (distance - width - height) / width;
            y = 0.9;
          } else {
            // Left edge
            x = 0.1;
            y = 1 - (distance - 2 * width - height) / height;
          }

          seats.push({
            seat_number: i + 1,
            relative_x: Math.max(0.1, Math.min(0.9, x)),
            relative_y: Math.max(0.1, Math.min(0.9, y)),
            is_accessible: false,
          });
        }
      }
      break;

    case "round":
      // Arrange seats in a circle
      const angleStep = (2 * Math.PI) / maxSeats;
      for (let i = 0; i < maxSeats; i++) {
        const angle = i * angleStep - Math.PI / 2; // Start from top
        seats.push({
          seat_number: i + 1,
          relative_x: 0.5 + 0.4 * Math.cos(angle),
          relative_y: 0.5 + 0.4 * Math.sin(angle),
          is_accessible: false,
        });
      }
      break;

    case "u_shaped":
      // Arrange seats around three sides
      const seatsPerSide = Math.ceil(maxSeats / 3);
      for (let i = 0; i < maxSeats; i++) {
        let x, y;
        if (i < seatsPerSide) {
          // Left side
          x = 0.15;
          y = 0.2 + (i * 0.6) / (seatsPerSide - 1);
        } else if (i < seatsPerSide * 2) {
          // Bottom
          const bottomIndex = i - seatsPerSide;
          x = 0.15 + (bottomIndex * 0.7) / (seatsPerSide - 1);
          y = 0.85;
        } else {
          // Right side
          const rightIndex = i - seatsPerSide * 2;
          x = 0.85;
          y = 0.8 - (rightIndex * 0.6) / (maxSeats - seatsPerSide * 2 - 1);
        }

        seats.push({
          seat_number: i + 1,
          relative_x: Math.max(0.1, Math.min(0.9, x)),
          relative_y: Math.max(0.1, Math.min(0.9, y)),
          is_accessible: false,
        });
      }
      break;

    case "individual":
      // Single seat in center
      seats.push({
        seat_number: 1,
        relative_x: 0.5,
        relative_y: 0.5,
        is_accessible: false,
      });
      break;
  }

  return seats.slice(0, maxSeats);
};

// Alias for backward compatibility
const generateSeatsForTable = generateSeats;

// Create a new table
const createTable = (x, y) => {
  const newTable = {
    id: Date.now() + Math.random(),
    table_number: 1, // Will be set by the component
    table_name: "New Table",
    x_position: x,
    y_position: y,
    width: DEFAULT_TABLE.width,
    height: DEFAULT_TABLE.height,
    max_seats: DEFAULT_TABLE.max_seats,
    table_shape: DEFAULT_TABLE.table_shape,
    rotation: DEFAULT_TABLE.rotation || 0,
    seats: generateSeats(
      DEFAULT_TABLE.table_shape,
      DEFAULT_TABLE.max_seats,
      DEFAULT_TABLE.width,
      DEFAULT_TABLE.height
    ),
  };

  return newTable;
};

// Create a new obstacle
const createObstacle = (x, y) => {
  const obstacleType = OBSTACLE_TYPES[0]; // Default to first type
  const newObstacle = {
    id: Date.now() + Math.random(),
    name: obstacleType.name,
    obstacle_type: obstacleType.id,
    x_position: x,
    y_position: y,
    width: DEFAULT_OBSTACLE.width,
    height: DEFAULT_OBSTACLE.height,
    color: obstacleType.color,
  };

  return newObstacle;
};

// Validate layout
const validateLayout = (layout) => {
  const errors = [];

  // Check layout name
  if (!layout.name || layout.name.trim() === "") {
    errors.push("Layout name is required");
  }

  // Check room dimensions
  if (
    layout.room_width < ROOM_CONSTRAINTS.MIN_WIDTH ||
    layout.room_width > ROOM_CONSTRAINTS.MAX_WIDTH
  ) {
    errors.push(
      `Room width must be between ${ROOM_CONSTRAINTS.MIN_WIDTH} and ${ROOM_CONSTRAINTS.MAX_WIDTH}`
    );
  }

  if (
    layout.room_height < ROOM_CONSTRAINTS.MIN_HEIGHT ||
    layout.room_height > ROOM_CONSTRAINTS.MAX_HEIGHT
  ) {
    errors.push(
      `Room height must be between ${ROOM_CONSTRAINTS.MIN_HEIGHT} and ${ROOM_CONSTRAINTS.MAX_HEIGHT}`
    );
  }

  // Check for at least one table
  if (layout.tables.length === 0) {
    errors.push("Layout must have at least one table");
  }

  // Check table positions
  layout.tables.forEach((table, index) => {
    if (
      table.x_position < 0 ||
      table.x_position + table.width > layout.room_width
    ) {
      errors.push(`Table ${table.table_name} is outside room bounds (X axis)`);
    }
    if (
      table.y_position < 0 ||
      table.y_position + table.height > layout.room_height
    ) {
      errors.push(`Table ${table.table_name} is outside room bounds (Y axis)`);
    }
  });

  // Check obstacle positions
  layout.obstacles.forEach((obstacle) => {
    if (
      obstacle.x_position < 0 ||
      obstacle.x_position + obstacle.width > layout.room_width
    ) {
      errors.push(`Obstacle ${obstacle.name} is outside room bounds (X axis)`);
    }
    if (
      obstacle.y_position < 0 ||
      obstacle.y_position + obstacle.height > layout.room_height
    ) {
      errors.push(`Obstacle ${obstacle.name} is outside room bounds (Y axis)`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
};

// Get all seat IDs in the layout
const getAllSeatIds = (layout) => {
  const seatIds = [];
  if (layout && layout.tables) {
    layout.tables.forEach((table) => {
      table.seats?.forEach((seat) => {
        seatIds.push(`${table.table_number}-${seat.seat_number}`);
      });
    });
  }
  return seatIds;
};

// Get seat information
const getSeatInfo = (layout, seatId) => {
  const [tableNum, seatNum] = seatId.split("-").map(Number);
  const table = layout.tables.find((t) => t.table_number === tableNum);
  if (!table) return null;
  const seat = table.seats?.find((s) => s.seat_number === seatNum);
  if (!seat) return null;

  return {
    table: table,
    seat: seat,
    seatId: seatId,
    isAccessible: seat.is_accessible,
    tableShape: table.table_shape,
    tableName: table.table_name,
  };
};

// API Helper
const ApiHelper = {
  getAuthHeaders: () => {
    const token =
      localStorage.getItem("token") || localStorage.getItem("access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  request: async (endpoint, options = {}) => {
    const headers = {
      "Content-Type": "application/json",
      ...ApiHelper.getAuthHeaders(),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  },
};
