// frontend/editors/shared/Table.js
// Shared Table component for both Layout and Seating editors

// Import from window in browser environment
const { GRID_SIZE } = window;

const Table = ({
  table,
  isSelected = false,
  isDragging = false,
  onMouseDown,
  onClick,
  onSeatClick,
  showSeatNumbers = true,
  highlightedSeats = [],
  assignedSeats = {}, // { seatNumber: studentInfo }
  mode = "layout", // 'layout' or 'seating'
}) => {
  const handleSeatClick = (e, seat) => {
    e.stopPropagation();
    if (onSeatClick) {
      onSeatClick(seat, table);
    }
  };

  const getSeatContent = (seat) => {
    if (mode === "seating" && assignedSeats[seat.seat_number]) {
      // Show student initials or abbreviated name
      const student = assignedSeats[seat.seat_number];
      const initials = student.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase();
      return initials;
    }
    return showSeatNumbers ? seat.seat_number : "";
  };

  const getSeatClassName = (seat) => {
    const baseClasses =
      "absolute w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold cursor-pointer transition-all duration-200";

    let colorClasses = "";
    if (mode === "seating" && assignedSeats[seat.seat_number]) {
      colorClasses = "bg-purple-500 text-white hover:bg-purple-600";
    } else if (highlightedSeats.includes(seat.seat_number)) {
      colorClasses = "bg-yellow-400 text-gray-800 hover:bg-yellow-500";
    } else if (seat.is_accessible) {
      colorClasses = "bg-green-500 text-white hover:bg-green-600";
    } else {
      colorClasses = "bg-gray-300 text-gray-700 hover:bg-gray-400";
    }

    const scaleClass = isDragging ? "scale-90" : "scale-100";

    return `${baseClasses} ${colorClasses} ${scaleClass}`;
  };

  return React.createElement(
    "div",
    {
      className: `absolute border-2 bg-blue-100 transition-all duration-200 ${
        table.table_shape === "round" ? "rounded-full" : "rounded-lg"
      } ${
        isSelected
          ? "border-blue-500 shadow-lg ring-2 ring-blue-300 z-10"
          : "border-blue-300 hover:border-blue-400 hover:shadow-md"
      } ${mode === "layout" ? "cursor-move" : "cursor-pointer"}`,
      style: {
        left: table.x_position * GRID_SIZE,
        top: table.y_position * GRID_SIZE,
        width: table.width * GRID_SIZE,
        height: table.height * GRID_SIZE,
        transform: isDragging ? "scale(1.05)" : "scale(1)",
      },
      onMouseDown: mode === "layout" ? onMouseDown : undefined,
      onClick: onClick,
    },

    // Table number/name
    React.createElement(
      "div",
      {
        className:
          "absolute inset-0 flex items-center justify-center pointer-events-none",
      },
      React.createElement(
        "span",
        {
          className: "text-sm font-bold text-blue-700 shadow-text",
        },
        table.table_name || `Table ${table.table_number}`
      )
    ),

    // Seats
    table.seats &&
      table.seats.map((seat) =>
        React.createElement(
          "div",
          {
            key: seat.seat_number,
            className: getSeatClassName(seat),
            style: {
              left: `${seat.relative_x * 100}%`,
              top: `${seat.relative_y * 100}%`,
              transform: "translate(-50%, -50%)",
            },
            onClick: (e) => handleSeatClick(e, seat),
            title:
              mode === "seating" && assignedSeats[seat.seat_number]
                ? `${assignedSeats[seat.seat_number].name}${
                    seat.is_accessible ? " (Accessible)" : ""
                  }`
                : `Seat ${seat.seat_number}${
                    seat.is_accessible ? " (Accessible)" : ""
                  }`,
          },
          getSeatContent(seat)
        )
      ),

    // Rotation indicator (if rotated)
    table.rotation > 0 &&
      React.createElement(
        "div",
        {
          className:
            "absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-500",
        },
        `${table.rotation}°`
      )
  );
};

// Export for use in other modules
if (typeof window !== "undefined") {
  window.Table = Table;
}

export default Table;
