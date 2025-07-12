// components/TableProperties.js - Table Properties Panel Component
const TablePropertiesPanel = ({
  selectedItem,
  layout,
  setLayout,
  setSelectedItem,
}) => {
  if (!selectedItem || selectedItem.type !== "table") return null;

  const table = selectedItem.item;

  const updateTableProperty = (property, value) => {
    const updatedTable = { ...table, [property]: value };

    // If changing shape or max_seats, regenerate seats
    if (property === "table_shape" || property === "max_seats") {
      updatedTable.seats = generateSeats(
        property === "table_shape" ? value : table.table_shape,
        property === "max_seats" ? value : table.max_seats,
        table.width,
        table.height
      );
    }

    // If changing dimensions, constrain position and regenerate seats
    if (property === "width" || property === "height") {
      // Ensure table doesn't go outside room bounds
      if (property === "width") {
        updatedTable.x_position = Math.min(
          table.x_position,
          layout.room_width - value
        );
      }
      if (property === "height") {
        updatedTable.y_position = Math.min(
          table.y_position,
          layout.room_height - value
        );
      }

      // Regenerate seats with new dimensions
      updatedTable.seats = generateSeats(
        table.table_shape,
        table.max_seats,
        property === "width" ? value : table.width,
        property === "height" ? value : table.height
      );
    }

    setLayout((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => (t.id === table.id ? updatedTable : t)),
    }));

    // Update selected item to reflect changes
    setSelectedItem((prev) => ({
      ...prev,
      item: updatedTable,
    }));
  };

  return React.createElement(
    "div",
    {
      className: "p-4 border-b border-gray-200",
    },
    React.createElement(
      "h3",
      {
        className: "text-lg font-semibold text-gray-800 mb-3",
      },
      "Table Properties"
    ),

    React.createElement(
      "div",
      {
        className: "space-y-3",
      },
      // Table Name
      React.createElement(
        "div",
        null,
        React.createElement(
          "label",
          {
            className: "block text-sm font-medium text-gray-700 mb-1",
          },
          "Table Name"
        ),
        React.createElement("input", {
          type: "text",
          value: table.table_name,
          onChange: (e) => updateTableProperty("table_name", e.target.value),
          className:
            "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
          placeholder: "Enter table name",
        })
      ),

      // Table Shape
      React.createElement(
        "div",
        null,
        React.createElement(
          "label",
          {
            className: "block text-sm font-medium text-gray-700 mb-1",
          },
          "Shape"
        ),
        React.createElement(
          "select",
          {
            value: table.table_shape,
            onChange: (e) => updateTableProperty("table_shape", e.target.value),
            className:
              "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
          },
          TABLE_SHAPES.map((shape) =>
            React.createElement(
              "option",
              {
                key: shape.id,
                value: shape.id,
              },
              `${shape.icon} ${shape.name}`
            )
          )
        )
      ),

      // Dimensions
      React.createElement(
        "div",
        {
          className: "grid grid-cols-2 gap-2",
        },
        React.createElement(
          "div",
          null,
          React.createElement(
            "label",
            {
              className: "block text-sm font-medium text-gray-700 mb-1",
            },
            "Width"
          ),
          React.createElement("input", {
            type: "number",
            value: table.width,
            onChange: (e) => {
              const newWidth =
                parseInt(e.target.value) || TABLE_CONSTRAINTS.MIN_WIDTH;
              const constrainedWidth = Math.max(
                TABLE_CONSTRAINTS.MIN_WIDTH,
                Math.min(newWidth, TABLE_CONSTRAINTS.MAX_WIDTH)
              );
              updateTableProperty("width", constrainedWidth);
            },
            className:
              "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            min: TABLE_CONSTRAINTS.MIN_WIDTH,
            max: TABLE_CONSTRAINTS.MAX_WIDTH,
          })
        ),
        React.createElement(
          "div",
          null,
          React.createElement(
            "label",
            {
              className: "block text-sm font-medium text-gray-700 mb-1",
            },
            "Height"
          ),
          React.createElement("input", {
            type: "number",
            value: table.height,
            onChange: (e) => {
              const newHeight =
                parseInt(e.target.value) || TABLE_CONSTRAINTS.MIN_HEIGHT;
              const constrainedHeight = Math.max(
                TABLE_CONSTRAINTS.MIN_HEIGHT,
                Math.min(newHeight, TABLE_CONSTRAINTS.MAX_HEIGHT)
              );
              updateTableProperty("height", constrainedHeight);
            },
            className:
              "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            min: TABLE_CONSTRAINTS.MIN_HEIGHT,
            max: TABLE_CONSTRAINTS.MAX_HEIGHT,
          })
        )
      ),

      // Max Seats
      React.createElement(
        "div",
        null,
        React.createElement(
          "label",
          {
            className: "block text-sm font-medium text-gray-700 mb-1",
          },
          "Max Seats"
        ),
        React.createElement("input", {
          type: "number",
          value: table.max_seats,
          onChange: (e) => {
            const newMaxSeats =
              parseInt(e.target.value) || TABLE_CONSTRAINTS.MIN_SEATS;
            const constrainedMaxSeats = Math.max(
              TABLE_CONSTRAINTS.MIN_SEATS,
              Math.min(newMaxSeats, TABLE_CONSTRAINTS.MAX_SEATS)
            );
            updateTableProperty("max_seats", constrainedMaxSeats);
          },
          className:
            "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
          min: TABLE_CONSTRAINTS.MIN_SEATS,
          max: TABLE_CONSTRAINTS.MAX_SEATS,
        })
      ),

      // Position Controls
      React.createElement(
        "div",
        {
          className: "grid grid-cols-2 gap-2",
        },
        React.createElement(
          "div",
          null,
          React.createElement(
            "label",
            {
              className: "block text-sm font-medium text-gray-700 mb-1",
            },
            "X Position"
          ),
          React.createElement("input", {
            type: "number",
            value: table.x_position,
            onChange: (e) => {
              const newX = parseInt(e.target.value) || 0;
              const constrainedX = Math.max(
                0,
                Math.min(newX, layout.room_width - table.width)
              );
              updateTableProperty("x_position", constrainedX);
            },
            className:
              "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            min: "0",
            max: layout.room_width - table.width,
          })
        ),
        React.createElement(
          "div",
          null,
          React.createElement(
            "label",
            {
              className: "block text-sm font-medium text-gray-700 mb-1",
            },
            "Y Position"
          ),
          React.createElement("input", {
            type: "number",
            value: table.y_position,
            onChange: (e) => {
              const newY = parseInt(e.target.value) || 0;
              const constrainedY = Math.max(
                0,
                Math.min(newY, layout.room_height - table.height)
              );
              updateTableProperty("y_position", constrainedY);
            },
            className:
              "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            min: "0",
            max: layout.room_height - table.height,
          })
        )
      ),

      // Rotation Control
      React.createElement(
        "div",
        null,
        React.createElement(
          "label",
          {
            className: "block text-sm font-medium text-gray-700 mb-1",
          },
          "Rotation"
        ),
        React.createElement(
          "select",
          {
            value: table.rotation || 0,
            onChange: (e) =>
              updateTableProperty("rotation", parseInt(e.target.value)),
            className:
              "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
          },
          React.createElement("option", { value: 0 }, "0° (Normal)"),
          React.createElement("option", { value: 90 }, "90° (Clockwise)"),
          React.createElement("option", { value: 180 }, "180° (Upside down)"),
          React.createElement(
            "option",
            { value: 270 },
            "270° (Counter-clockwise)"
          )
        )
      ),

      // Seat Information (Preview for Step 1)
      table.seats &&
        table.seats.length > 0 &&
        React.createElement(
          "div",
          null,
          React.createElement(
            "label",
            {
              className: "block text-sm font-medium text-gray-700 mb-2",
            },
            `Seats (${table.seats.length})`
          ),
          React.createElement(
            "div",
            {
              className:
                "bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-32 overflow-y-auto",
            },
            table.seats.map((seat) =>
              React.createElement(
                "div",
                {
                  key: seat.seat_number,
                  className: "flex items-center justify-between py-1 text-xs",
                },
                React.createElement(
                  "span",
                  {
                    className: "font-medium",
                  },
                  `Seat ${seat.seat_number}`
                ),
                React.createElement(
                  "span",
                  {
                    className: "text-gray-500",
                  },
                  `ID: ${table.table_number}-${seat.seat_number}`
                ),
                React.createElement(
                  "span",
                  {
                    className: `text-xs px-2 py-1 rounded ${
                      seat.is_accessible
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`,
                  },
                  seat.is_accessible ? "♿ Accessible" : "Regular"
                )
              )
            )
          ),

          // Regenerate seats button
          React.createElement(
            "button",
            {
              onClick: () =>
                updateTableProperty(
                  "seats",
                  generateSeats(
                    table.table_shape,
                    table.max_seats,
                    table.width,
                    table.height
                  )
                ),
              className:
                "w-full mt-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium",
            },
            "🔄 Regenerate Seats"
          )
        ),

      // Table Summary
      React.createElement(
        "div",
        {
          className: "bg-blue-50 border border-blue-200 rounded-lg p-3",
        },
        React.createElement(
          "h4",
          {
            className: "text-sm font-semibold text-blue-800 mb-2",
          },
          "Table Summary"
        ),
        React.createElement(
          "div",
          {
            className: "text-xs text-blue-700 space-y-1",
          },
          React.createElement(
            "div",
            null,
            `Size: ${table.width} × ${table.height} grid units`
          ),
          React.createElement(
            "div",
            null,
            `Position: (${table.x_position}, ${table.y_position})`
          ),
          React.createElement(
            "div",
            null,
            `Capacity: ${table.max_seats} students`
          ),
          React.createElement(
            "div",
            null,
            `Shape: ${
              TABLE_SHAPES.find((s) => s.id === table.table_shape)?.name ||
              "Unknown"
            }`
          ),
          React.createElement("div", null, `Rotation: ${table.rotation || 0}°`)
        )
      ),

      // Delete Button
      React.createElement(
        "button",
        {
          onClick: () => {
            if (
              confirm(`Are you sure you want to delete "${table.table_name}"?`)
            ) {
              setLayout((prev) => ({
                ...prev,
                tables: prev.tables.filter((t) => t.id !== table.id),
              }));
              setSelectedItem(null);
            }
          },
          className:
            "w-full px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium",
        },
        "🗑️ Delete Table"
      )
    )
  );
};
