// constants.js - All constants and configuration

// Grid and layout constants
const GRID_SIZE = 50;

// API configuration
const API_BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:8000/api"
    : "https://bcranston.pythonanywhere.com/api";

// Table shape options
const TABLE_SHAPES = [
  { id: "rectangular", name: "Rectangular", icon: "⬜" },
  { id: "round", name: "Round", icon: "⭕" },
  { id: "u_shaped", name: "U-Shaped", icon: "🔄" },
  { id: "individual", name: "Individual", icon: "📦" },
];

// Obstacle/object types
const OBSTACLE_TYPES = [
  { id: "teacher_desk", name: "Teacher Desk", color: "#8B4513", icon: "🪑" },
  { id: "cabinet", name: "Cabinet", color: "#654321", icon: "🗄️" },
  { id: "bookshelf", name: "Bookshelf", color: "#A0522D", icon: "📚" },
  { id: "door", name: "Door", color: "#228B22", icon: "🚪" },
  { id: "window", name: "Window", color: "#87CEEB", icon: "🪟" },
  { id: "whiteboard", name: "Whiteboard", color: "#F5F5F5", icon: "📋" },
  { id: "projector", name: "Projector", color: "#696969", icon: "📽️" },
  { id: "other", name: "Other", color: "#808080", icon: "⬛" },
];

// Tool modes
const TOOL_MODES = {
  SELECT: "select",
  TABLE: "table",
  OBSTACLE: "obstacle",
};

// Default layout settings
const DEFAULT_LAYOUT = {
  id: null,
  name: "New Classroom Layout",
  description: "",
  room_width: 15,
  room_height: 10,
  tables: [],
  obstacles: [],
};

// Room size constraints
const ROOM_CONSTRAINTS = {
  MIN_WIDTH: 5,
  MAX_WIDTH: 30,
  MIN_HEIGHT: 5,
  MAX_HEIGHT: 20,
};

// Table constraints
const TABLE_CONSTRAINTS = {
  MIN_WIDTH: 1,
  MAX_WIDTH: 5,
  MIN_HEIGHT: 1,
  MAX_HEIGHT: 5,
  MIN_SEATS: 1,
  MAX_SEATS: 8,
};

// Default table settings
const DEFAULT_TABLE = {
  width: 2,
  height: 2,
  max_seats: 4,
  table_shape: "rectangular",
  rotation: 0,
};

// Default obstacle settings
const DEFAULT_OBSTACLE = {
  width: 1,
  height: 1,
  color: "#808080",
};
