// utils.js - Utility functions and API helper
const { useState, useRef, useEffect } = React;

// Icon components
const Save = (props) =>
  React.createElement(
    "svg",
    {
      width: 24,
      height: 24,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props,
    },
    React.createElement("path", {
      d: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z",
    })
  );

const Eye = (props) =>
  React.createElement(
    "svg",
    {
      width: 24,
      height: 24,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props,
    },
    React.createElement("path", {
      d: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z",
    }),
    React.createElement("circle", { cx: 12, cy: 12, r: 3 })
  );

const EyeOff = (props) =>
  React.createElement(
    "svg",
    {
      width: 24,
      height: 24,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props,
    },
    React.createElement("path", { d: "M9.88 9.88a3 3 0 1 0 4.24 4.24" }),
    React.createElement("path", {
      d: "M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68",
    }),
    React.createElement("path", {
      d: "M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61",
    }),
    React.createElement("line", { x1: 2, x2: 22, y1: 2, y2: 22 })
  );

const Grid = (props) =>
  React.createElement(
    "svg",
    {
      width: 24,
      height: 24,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props,
    },
    React.createElement("rect", { width: 18, height: 18, x: 3, y: 3, rx: 2 }),
    React.createElement("path", { d: "M9 3v18" }),
    React.createElement("path", { d: "M15 3v18" }),
    React.createElement("path", { d: "M3 9h18" }),
    React.createElement("path", { d: "M3 15h18" })
  );

// Utility functions for seat generation (will be needed for Step 1)
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
            is_accessible: true,
            notes: "",
          },
          {
            seat_number: 2,
            relative_x: 0.75,
            relative_y: 0.5,
            is_accessible: true,
            notes: "",
          }
        );
      } else if (maxSeats <= 4) {
        seats.push(
          {
            seat_number: 1,
            relative_x: 0.25,
            relative_y: 0.25,
            is_accessible: true,
            notes: "",
          },
          {
            seat_number: 2,
            relative_x: 0.75,
            relative_y: 0.25,
            is_accessible: true,
            notes: "",
          },
          {
            seat_number: 3,
            relative_x: 0.25,
            relative_y: 0.75,
            is_accessible: true,
            notes: "",
          },
          {
            seat_number: 4,
            relative_x: 0.75,
            relative_y: 0.75,
            is_accessible: true,
            notes: "",
          }
        );
      } else if (maxSeats <= 6) {
        seats.push(
          {
            seat_number: 1,
            relative_x: 0.2,
            relative_y: 0.2,
            is_accessible: true,
            notes: "",
          },
          {
            seat_number: 2,
            relative_x: 0.5,
            relative_y: 0.1,
            is_accessible: true,
            notes: "",
          },
          {
            seat_number: 3,
            relative_x: 0.8,
            relative_y: 0.2,
            is_accessible: true,
            notes: "",
          },
          {
            seat_number: 4,
            relative_x: 0.2,
            relative_y: 0.8,
            is_accessible: true,
            notes: "",
          },
          {
            seat_number: 5,
            relative_x: 0.5,
            relative_y: 0.9,
            is_accessible: true,
            notes: "",
          },
          {
            seat_number: 6,
            relative_x: 0.8,
            relative_y: 0.8,
            is_accessible: true,
            notes: "",
          }
        );
      } else {
        // 8 seats - around perimeter
        seats.push(
          {
            seat_number: 1,
            relative_x: 0.15,
            relative_y: 0.15,
            is_accessible: true,
            notes: "",
          },
          {
            seat_number: 2,
            relative_x: 0.5,
            relative_y: 0.1,
            is_accessible: true,
            notes: "",
          },
          {
            seat_number: 3,
            relative_x: 0.85,
            relative_y: 0.15,
            is_accessible: true,
            notes: "",
          },
          {
            seat_number: 4,
            relative_x: 0.9,
            relative_y: 0.5,
            is_accessible: true,
            notes: "",
          },
          {
            seat_number: 5,
            relative_x: 0.85,
            relative_y: 0.85,
            is_accessible: true,
            notes: "",
          },
          {
            seat_number: 6,
            relative_x: 0.5,
            relative_y: 0.9,
            is_accessible: true,
            notes: "",
          },
          {
            seat_number: 7,
            relative_x: 0.15,
            relative_y: 0.85,
            is_accessible: true,
            notes: "",
          },
          {
            seat_number: 8,
            relative_x: 0.1,
            relative_y: 0.5,
            is_accessible: true,
            notes: "",
          }
        );
      }
      break;

    case "round":
      // Arrange seats in a circle
      for (let i = 0; i < maxSeats; i++) {
        const angle = (i * 2 * Math.PI) / maxSeats - Math.PI / 2; // Start from top
        const radius = 0.35; // Distance from center
        const x = 0.5 + radius * Math.cos(angle);
        const y = 0.5 + radius * Math.sin(angle);
        seats.push({
          seat_number: i + 1,
          relative_x: Math.max(0.1, Math.min(0.9, x)),
          relative_y: Math.max(0.1, Math.min(0.9, y)),
          is_accessible: true,
          notes: "",
        });
      }
      break;

    case "u_shaped":
      // U-shaped arrangement
      if (maxSeats <= 4) {
        seats.push(
          {
            seat_number: 1,
            relative_x: 0.2,
            relative_y: 0.8,
            is_accessible: true,
            notes: "",
          },
          {
            seat_number: 2,
            relative_x: 0.2,
            relative_y: 0.2,
            is_accessible: true,
            notes: "",
          },
          {
            seat_number: 3,
            relative_x: 0.8,
            relative_y: 0.2,
            is_accessible: true,
            notes: "",
          },
          {
            seat_number: 4,
            relative_x: 0.8,
            relative_y: 0.8,
            is_accessible: true,
            notes: "",
          }
        );
      } else {
        // More seats for larger U-shape
        for (let i = 0; i < maxSeats; i++) {
          let x, y;
          const seatsPerSide = Math.ceil(maxSeats / 3);

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
            is_accessible: true,
            notes: "",
          });
        }
      }
      break;

    case "individual":
      // Single seat in center
      seats.push({
        seat_number: 1,
        relative_x: 0.5,
        relative_y: 0.5,
        is_accessible: true,
        notes: "",
      });
      break;
  }

  return seats.slice(0, maxSeats); // Ensure we don't exceed max_seats
};

// Layout utility functions
const getAllSeatIds = (layout) => {
  const seatIds = [];
  layout.tables.forEach((table) => {
    table.seats?.forEach((seat) => {
      seatIds.push(`${table.table_number}-${seat.seat_number}`);
    });
  });
  return seatIds;
};

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
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token");
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
