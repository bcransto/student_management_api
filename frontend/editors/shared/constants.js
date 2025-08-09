// frontend/editors/shared/constants.js
// Shared constants for all editor components

export const GRID_SIZE = 40;

export const TOOL_MODES = {
  SELECT: "select",
  TABLE: "table",
  OBSTACLE: "obstacle",
};

export const TABLE_SHAPES = [
  { id: "rectangular", name: "Rectangular", icon: "⬜" },
  { id: "round", name: "Round", icon: "⭕" },
  { id: "u_shaped", name: "U-Shaped", icon: "🔄" },
  { id: "individual", name: "Individual", icon: "📦" },
];

export const OBSTACLE_TYPES = [
  { id: "pillar", name: "Pillar", color: "#6B7280" },
  { id: "wall_section", name: "Wall Section", color: "#4B5563" },
  { id: "equipment", name: "Equipment", color: "#9333EA" },
  { id: "storage", name: "Storage", color: "#7C3AED" },
  { id: "door", name: "Door", color: "#10B981" },
];

export const ROOM_CONSTRAINTS = {
  MIN_WIDTH: 5,
  MAX_WIDTH: 30,
  MIN_HEIGHT: 5,
  MAX_HEIGHT: 20,
};

export const DEFAULT_TABLE = {
  width: 2,
  height: 2,
  max_seats: 4,
  table_shape: "rectangular",
  rotation: 0,
};

export const DEFAULT_OBSTACLE = {
  width: 1,
  height: 1,
};

// Helper function to generate seats based on table shape
export const generateSeats = (shape, maxSeats, width, height) => {
  const seats = [];

  switch (shape) {
    case "rectangular":
      const seatsPerSide = Math.ceil(maxSeats / 4);
      let seatNumber = 1;

      // Top side
      for (let i = 0; i < Math.min(seatsPerSide, maxSeats); i++) {
        seats.push({
          seat_number: seatNumber++,
          relative_x: (i + 1) / (seatsPerSide + 1),
          relative_y: -0.15,
          is_accessible: false,
        });
      }

      // Right side
      for (let i = 0; i < Math.min(seatsPerSide, maxSeats - seats.length); i++) {
        seats.push({
          seat_number: seatNumber++,
          relative_x: 1.15,
          relative_y: (i + 1) / (seatsPerSide + 1),
          is_accessible: false,
        });
      }

      // Bottom side
      for (let i = 0; i < Math.min(seatsPerSide, maxSeats - seats.length); i++) {
        seats.push({
          seat_number: seatNumber++,
          relative_x: 1 - (i + 1) / (seatsPerSide + 1),
          relative_y: 1.15,
          is_accessible: false,
        });
      }

      // Left side
      for (let i = 0; i < Math.min(seatsPerSide, maxSeats - seats.length); i++) {
        seats.push({
          seat_number: seatNumber++,
          relative_x: -0.15,
          relative_y: 1 - (i + 1) / (seatsPerSide + 1),
          is_accessible: false,
        });
      }
      break;

    case "round":
      for (let i = 0; i < maxSeats; i++) {
        const angle = (i / maxSeats) * 2 * Math.PI - Math.PI / 2;
        seats.push({
          seat_number: i + 1,
          relative_x: 0.5 + Math.cos(angle) * 0.65,
          relative_y: 0.5 + Math.sin(angle) * 0.65,
          is_accessible: false,
        });
      }
      break;

    case "u_shaped":
      const sideSeats = Math.floor((maxSeats - 2) / 2);
      let uSeatNumber = 1;

      // Left side
      for (let i = 0; i < sideSeats; i++) {
        seats.push({
          seat_number: uSeatNumber++,
          relative_x: -0.15,
          relative_y: (i + 1) / (sideSeats + 1),
          is_accessible: false,
        });
      }

      // Bottom
      for (let i = 0; i < Math.min(2, maxSeats - seats.length); i++) {
        seats.push({
          seat_number: uSeatNumber++,
          relative_x: (i + 1) / 3,
          relative_y: 1.15,
          is_accessible: false,
        });
      }

      // Right side
      for (let i = 0; i < Math.min(sideSeats, maxSeats - seats.length); i++) {
        seats.push({
          seat_number: uSeatNumber++,
          relative_x: 1.15,
          relative_y: 1 - (i + 1) / (sideSeats + 1),
          is_accessible: false,
        });
      }
      break;

    case "individual":
      seats.push({
        seat_number: 1,
        relative_x: 0.5,
        relative_y: 0.5,
        is_accessible: false,
      });
      break;
  }

  return seats;
};

// Export everything to window for browser usage
if (typeof window !== "undefined") {
  window.GRID_SIZE = GRID_SIZE;
  window.TOOL_MODES = TOOL_MODES;
  window.TABLE_SHAPES = TABLE_SHAPES;
  window.OBSTACLE_TYPES = OBSTACLE_TYPES;
  window.ROOM_CONSTRAINTS = ROOM_CONSTRAINTS;
  window.DEFAULT_TABLE = DEFAULT_TABLE;
  window.DEFAULT_OBSTACLE = DEFAULT_OBSTACLE;
  window.generateSeats = generateSeats;
}
