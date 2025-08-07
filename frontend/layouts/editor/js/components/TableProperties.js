// components/TableProperties.js - Improved Table Properties Panel Component
const TablePropertiesPanel = ({ selectedItem, layout, setLayout, setSelectedItem }) => {
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
        updatedTable.x_position = Math.min(table.x_position, layout.room_width - value);
      }
      if (property === "height") {
        updatedTable.y_position = Math.min(table.y_position, layout.room_height - value);
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

  const toggleSeatAccessibility = (seatNumber) => {
    const newSeats = table.seats.map((seat) =>
      seat.seat_number === seatNumber ? { ...seat, is_accessible: !seat.is_accessible } : seat
    );
    updateTableProperty("seats", newSeats);
  };

  return React.createElement(
    "div",
    {
      className: "bg-white border-b border-gray-200 max-h-96 overflow-y-auto",
    },
    React.createElement(
      "div",
      {
        className: "p-4 sticky top-0 bg-white border-b border-gray-100 z-10",
      },
      React.createElement(
        "h3",
        {
          className: "text-lg font-semibold text-gray-800 flex items-center gap-2",
        },
        React.createElement("span", null, "🪑"),
        "Table Properties"
      )
    ),

    React.createElement(
      "div",
      {
        className: "p-4 space-y-4",
      },

      // Basic Information Section
      React.createElement(
        "div",
        {
          className: "space-y-3",
        },
        React.createElement(
          "h4",
          {
            className: "text-sm font-semibold text-gray-700 border-b border-gray-200 pb-1",
          },
          "Basic Information"
        ),

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
              "w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
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
                "w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
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

        // Max Seats
        React.createElement(
          "div",
          null,
          React.createElement(
            "label",
            {
              className: "block text-sm font-medium text-gray-700 mb-1",
            },
            "Maximum Seats"
          ),
          React.createElement("input", {
            type: "number",
            value: table.max_seats,
            onChange: (e) => {
              const newMaxSeats = parseInt(e.target.value) || TABLE_CONSTRAINTS.MIN_SEATS;
              const constrainedMaxSeats = Math.max(
                TABLE_CONSTRAINTS.MIN_SEATS,
                Math.min(newMaxSeats, TABLE_CONSTRAINTS.MAX_SEATS)
              );
              updateTableProperty("max_seats", constrainedMaxSeats);
            },
            className:
              "w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            min: TABLE_CONSTRAINTS.MIN_SEATS,
            max: TABLE_CONSTRAINTS.MAX_SEATS,
          })
        )
      ),

      // Size & Position Section
      React.createElement(
        "div",
        {
          className: "space-y-3",
        },
        React.createElement(
          "h4",
          {
            className: "text-sm font-semibold text-gray-700 border-b border-gray-200 pb-1",
          },
          "Size & Position"
        ),

        // Dimensions
        React.createElement(
          "div",
          {
            className: "grid grid-cols-2 gap-3",
          },
          React.createElement(
            "div",
            null,
            React.createElement(
              "label",
              {
                className: "block text-sm font-medium text-gray-700 mb-1",
              },
              "Width (grid units)"
            ),
            React.createElement("input", {
              type: "number",
              value: table.width,
              onChange: (e) => {
                const newWidth = parseInt(e.target.value) || TABLE_CONSTRAINTS.MIN_WIDTH;
                const constrainedWidth = Math.max(
                  TABLE_CONSTRAINTS.MIN_WIDTH,
                  Math.min(newWidth, TABLE_CONSTRAINTS.MAX_WIDTH)
                );
                updateTableProperty("width", constrainedWidth);
              },
              className:
                "w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
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
              "Height (grid units)"
            ),
            React.createElement("input", {
              type: "number",
              value: table.height,
              onChange: (e) => {
                const newHeight = parseInt(e.target.value) || TABLE_CONSTRAINTS.MIN_HEIGHT;
                const constrainedHeight = Math.max(
                  TABLE_CONSTRAINTS.MIN_HEIGHT,
                  Math.min(newHeight, TABLE_CONSTRAINTS.MAX_HEIGHT)
                );
                updateTableProperty("height", constrainedHeight);
              },
              className:
                "w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
              min: TABLE_CONSTRAINTS.MIN_HEIGHT,
              max: TABLE_CONSTRAINTS.MAX_HEIGHT,
            })
          )
        ),

        // Position Controls
        React.createElement(
          "div",
          {
            className: "grid grid-cols-2 gap-3",
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
                const constrainedX = Math.max(0, Math.min(newX, layout.room_width - table.width));
                updateTableProperty("x_position", constrainedX);
              },
              className:
                "w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
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
                const constrainedY = Math.max(0, Math.min(newY, layout.room_height - table.height));
                updateTableProperty("y_position", constrainedY);
              },
              className:
                "w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
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
              onChange: (e) => updateTableProperty("rotation", parseInt(e.target.value)),
              className:
                "w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            },
            React.createElement("option", { value: 0 }, "0° (Normal)"),
            React.createElement("option", { value: 90 }, "90° (Clockwise)"),
            React.createElement("option", { value: 180 }, "180° (Upside down)"),
            React.createElement("option", { value: 270 }, "270° (Counter-clockwise)")
          )
        )
      ),

      // Seats Section
      table.seats &&
        table.seats.length > 0 &&
        React.createElement(
          "div",
          {
            className: "space-y-3",
          },
          React.createElement(
            "div",
            {
              className: "flex items-center justify-between",
            },
            React.createElement(
              "h4",
              {
                className:
                  "text-sm font-semibold text-gray-700 border-b border-gray-200 pb-1 flex-1",
              },
              `Seats Configuration (${table.seats.length})`
            ),
            React.createElement(
              "button",
              {
                onClick: () =>
                  updateTableProperty(
                    "seats",
                    generateSeats(table.table_shape, table.max_seats, table.width, table.height)
                  ),
                className:
                  "ml-2 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors font-medium",
                title: "Regenerate seat positions",
              },
              "🔄 Regenerate"
            )
          ),

          React.createElement(
            "div",
            {
              className:
                "bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto",
            },
            React.createElement(
              "div",
              {
                className: "space-y-2",
              },
              table.seats.map((seat) =>
                React.createElement(
                  "div",
                  {
                    key: seat.seat_number,
                    className:
                      "flex items-center justify-between py-2 px-3 bg-white rounded border border-gray-100",
                  },
                  React.createElement(
                    "div",
                    {
                      className: "flex items-center gap-3",
                    },
                    React.createElement(
                      "span",
                      {
                        className: "font-medium text-sm text-gray-700 min-w-[60px]",
                      },
                      `Seat ${seat.seat_number}`
                    ),
                    React.createElement(
                      "span",
                      {
                        className: "text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded font-mono",
                      },
                      `${table.table_number}-${seat.seat_number}`
                    )
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: () => toggleSeatAccessibility(seat.seat_number),
                      className: `text-sm px-3 py-1 rounded font-medium transition-colors ${
                        seat.is_accessible
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`,
                      title: seat.is_accessible
                        ? "Click to make regular seat"
                        : "Click to make accessible seat",
                    },
                    seat.is_accessible
                      ? React.createElement("span", null, "♿ Accessible")
                      : React.createElement("span", null, "👤 Regular")
                  )
                )
              )
            )
          )
        ),

      // Table Summary Section
      React.createElement(
        "div",
        {
          className: "space-y-3",
        },
        React.createElement(
          "h4",
          {
            className: "text-sm font-semibold text-gray-700 border-b border-gray-200 pb-1",
          },
          "Summary"
        ),
        React.createElement(
          "div",
          {
            className: "bg-blue-50 border border-blue-200 rounded-lg p-3",
          },
          React.createElement(
            "div",
            {
              className: "grid grid-cols-2 gap-3 text-sm",
            },
            React.createElement(
              "div",
              {
                className: "space-y-1",
              },
              React.createElement(
                "div",
                {
                  className: "text-blue-800 font-medium",
                },
                "Physical"
              ),
              React.createElement(
                "div",
                {
                  className: "text-blue-700",
                },
                `Size: ${table.width} × ${table.height}`
              ),
              React.createElement(
                "div",
                {
                  className: "text-blue-700",
                },
                `Position: (${table.x_position}, ${table.y_position})`
              ),
              React.createElement(
                "div",
                {
                  className: "text-blue-700",
                },
                `Rotation: ${table.rotation || 0}°`
              )
            ),
            React.createElement(
              "div",
              {
                className: "space-y-1",
              },
              React.createElement(
                "div",
                {
                  className: "text-blue-800 font-medium",
                },
                "Seating"
              ),
              React.createElement(
                "div",
                {
                  className: "text-blue-700",
                },
                `Capacity: ${table.max_seats}`
              ),
              React.createElement(
                "div",
                {
                  className: "text-blue-700",
                },
                `Shape: ${TABLE_SHAPES.find((s) => s.id === table.table_shape)?.name || "Unknown"}`
              ),
              React.createElement(
                "div",
                {
                  className: "text-blue-700",
                },
                `Accessible: ${table.seats?.filter((s) => s.is_accessible).length || 0}`
              )
            )
          )
        )
      ),

      // Action Buttons Section
      React.createElement(
        "div",
        {
          className: "space-y-2 pt-2 border-t border-gray-200",
        },
        // Duplicate Button
        React.createElement(
          "button",
          {
            onClick: () => {
              const newTable = {
                ...table,
                id: Date.now(),
                table_number: layout.tables.length + 1,
                table_name: `${table.table_name} Copy`,
                x_position: Math.min(table.x_position + 1, layout.room_width - table.width),
                y_position: Math.min(table.y_position + 1, layout.room_height - table.height),
              };

              setLayout((prev) => ({
                ...prev,
                tables: [...prev.tables, newTable],
              }));
              setSelectedItem({ type: "table", item: newTable });
            },
            className:
              "w-full px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium text-sm",
          },
          "📋 Duplicate Table"
        ),

        // Delete Button
        React.createElement(
          "button",
          {
            onClick: () => {
              if (confirm(`Are you sure you want to delete "${table.table_name}"?`)) {
                setLayout((prev) => ({
                  ...prev,
                  tables: prev.tables.filter((t) => t.id !== table.id),
                }));
                setSelectedItem(null);
              }
            },
            className:
              "w-full px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors font-medium text-sm",
          },
          "🗑️ Delete Table"
        )
      )
    )
  );
};
