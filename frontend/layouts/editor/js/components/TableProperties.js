// components/TableProperties.js - Table Properties Panel (No Tailwind)
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

  // Styles
  const containerStyle = {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    maxHeight: '384px',
    overflowY: 'auto'
  };

  const headerStyle = {
    padding: '16px',
    position: 'sticky',
    top: 0,
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #f3f4f6',
    zIndex: 10
  };

  const titleStyle = {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const sectionStyle = {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  };

  const sectionTitleStyle = {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '4px'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '4px'
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  };

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
  };

  const buttonStyle = (variant) => {
    const baseStyle = {
      width: '100%',
      padding: '8px 12px',
      borderRadius: '6px',
      border: 'none',
      fontWeight: '500',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      outline: 'none'
    };

    if (variant === 'primary') {
      return {
        ...baseStyle,
        backgroundColor: '#dbeafe',
        color: '#1e40af'
      };
    } else if (variant === 'danger') {
      return {
        ...baseStyle,
        backgroundColor: '#fee2e2',
        color: '#991b1b'
      };
    } else if (variant === 'success') {
      return {
        ...baseStyle,
        backgroundColor: '#d1fae5',
        color: '#065f46'
      };
    }
    return baseStyle;
  };

  const seatItemStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: '#ffffff',
    borderRadius: '6px',
    border: '1px solid #f3f4f6'
  };

  const summaryBoxStyle = {
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    padding: '12px'
  };

  return React.createElement(
    "div",
    { style: containerStyle },
    
    // Header
    React.createElement(
      "div",
      { style: headerStyle },
      React.createElement(
        "h3",
        { style: titleStyle },
        React.createElement("span", null, "🪑"),
        "Table Properties"
      )
    ),

    React.createElement(
      "div",
      { style: sectionStyle },

      // Basic Information Section
      React.createElement(
        "div",
        { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        React.createElement(
          "h4",
          { style: sectionTitleStyle },
          "Basic Information"
        ),

        // Table Name
        React.createElement(
          "div",
          null,
          React.createElement(
            "label",
            { style: labelStyle },
            "Table Name"
          ),
          React.createElement("input", {
            type: "text",
            value: table.table_name,
            onChange: (e) => updateTableProperty("table_name", e.target.value),
            style: inputStyle,
            placeholder: "Enter table name",
            onFocus: (e) => e.target.style.borderColor = '#3b82f6',
            onBlur: (e) => e.target.style.borderColor = '#d1d5db'
          })
        ),

        // Table Shape
        React.createElement(
          "div",
          null,
          React.createElement(
            "label",
            { style: labelStyle },
            "Shape"
          ),
          React.createElement(
            "select",
            {
              value: table.table_shape,
              onChange: (e) => updateTableProperty("table_shape", e.target.value),
              style: selectStyle,
              onFocus: (e) => e.target.style.borderColor = '#3b82f6',
              onBlur: (e) => e.target.style.borderColor = '#d1d5db'
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
            { style: labelStyle },
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
            style: inputStyle,
            min: TABLE_CONSTRAINTS.MIN_SEATS,
            max: TABLE_CONSTRAINTS.MAX_SEATS,
            onFocus: (e) => e.target.style.borderColor = '#3b82f6',
            onBlur: (e) => e.target.style.borderColor = '#d1d5db'
          })
        )
      ),

      // Size & Position Section
      React.createElement(
        "div",
        { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        React.createElement(
          "h4",
          { style: sectionTitleStyle },
          "Size & Position"
        ),

        // Dimensions
        React.createElement(
          "div",
          { style: gridStyle },
          React.createElement(
            "div",
            null,
            React.createElement(
              "label",
              { style: labelStyle },
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
              style: inputStyle,
              min: TABLE_CONSTRAINTS.MIN_WIDTH,
              max: TABLE_CONSTRAINTS.MAX_WIDTH,
              onFocus: (e) => e.target.style.borderColor = '#3b82f6',
              onBlur: (e) => e.target.style.borderColor = '#d1d5db'
            })
          ),
          React.createElement(
            "div",
            null,
            React.createElement(
              "label",
              { style: labelStyle },
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
              style: inputStyle,
              min: TABLE_CONSTRAINTS.MIN_HEIGHT,
              max: TABLE_CONSTRAINTS.MAX_HEIGHT,
              onFocus: (e) => e.target.style.borderColor = '#3b82f6',
              onBlur: (e) => e.target.style.borderColor = '#d1d5db'
            })
          )
        ),

        // Position Controls
        React.createElement(
          "div",
          { style: gridStyle },
          React.createElement(
            "div",
            null,
            React.createElement(
              "label",
              { style: labelStyle },
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
              style: inputStyle,
              min: "0",
              max: layout.room_width - table.width,
              onFocus: (e) => e.target.style.borderColor = '#3b82f6',
              onBlur: (e) => e.target.style.borderColor = '#d1d5db'
            })
          ),
          React.createElement(
            "div",
            null,
            React.createElement(
              "label",
              { style: labelStyle },
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
              style: inputStyle,
              min: "0",
              max: layout.room_height - table.height,
              onFocus: (e) => e.target.style.borderColor = '#3b82f6',
              onBlur: (e) => e.target.style.borderColor = '#d1d5db'
            })
          )
        ),

        // Rotation Control
        React.createElement(
          "div",
          null,
          React.createElement(
            "label",
            { style: labelStyle },
            "Rotation"
          ),
          React.createElement(
            "select",
            {
              value: table.rotation || 0,
              onChange: (e) => updateTableProperty("rotation", parseInt(e.target.value)),
              style: selectStyle,
              onFocus: (e) => e.target.style.borderColor = '#3b82f6',
              onBlur: (e) => e.target.style.borderColor = '#d1d5db'
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
          { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
          React.createElement(
            "div",
            { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            React.createElement(
              "h4",
              { style: { ...sectionTitleStyle, flex: 1 } },
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
                style: {
                  marginLeft: '8px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  backgroundColor: '#d1fae5',
                  color: '#065f46',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                },
                title: "Regenerate seat positions",
                onMouseEnter: (e) => e.target.style.backgroundColor = '#a7f3d0',
                onMouseLeave: (e) => e.target.style.backgroundColor = '#d1fae5'
              },
              "🔄 Regenerate"
            )
          ),

          React.createElement(
            "div",
            {
              style: {
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px',
                maxHeight: '192px',
                overflowY: 'auto'
              }
            },
            React.createElement(
              "div",
              { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
              table.seats.map((seat) =>
                React.createElement(
                  "div",
                  {
                    key: seat.seat_number,
                    style: seatItemStyle
                  },
                  React.createElement(
                    "div",
                    { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
                    React.createElement(
                      "span",
                      { style: { fontWeight: '500', fontSize: '14px', color: '#374151', minWidth: '60px' } },
                      `Seat ${seat.seat_number}`
                    ),
                    React.createElement(
                      "span",
                      {
                        style: {
                          fontSize: '12px',
                          color: '#6b7280',
                          backgroundColor: '#f3f4f6',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontFamily: 'monospace'
                        }
                      },
                      `${table.table_number}-${seat.seat_number}`
                    )
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: () => toggleSeatAccessibility(seat.seat_number),
                      style: {
                        fontSize: '14px',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        fontWeight: '500',
                        transition: 'background-color 0.2s',
                        backgroundColor: seat.is_accessible ? '#d1fae5' : '#f3f4f6',
                        color: seat.is_accessible ? '#065f46' : '#6b7280',
                        border: 'none',
                        cursor: 'pointer'
                      },
                      title: seat.is_accessible
                        ? "Click to make regular seat"
                        : "Click to make accessible seat",
                      onMouseEnter: (e) => {
                        e.target.style.backgroundColor = seat.is_accessible ? '#a7f3d0' : '#e5e7eb';
                      },
                      onMouseLeave: (e) => {
                        e.target.style.backgroundColor = seat.is_accessible ? '#d1fae5' : '#f3f4f6';
                      }
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
        { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        React.createElement(
          "h4",
          { style: sectionTitleStyle },
          "Summary"
        ),
        React.createElement(
          "div",
          { style: summaryBoxStyle },
          React.createElement(
            "div",
            { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' } },
            React.createElement(
              "div",
              { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
              React.createElement(
                "div",
                { style: { color: '#1e40af', fontWeight: '500' } },
                "Physical"
              ),
              React.createElement(
                "div",
                { style: { color: '#1d4ed8' } },
                `Size: ${table.width} × ${table.height}`
              ),
              React.createElement(
                "div",
                { style: { color: '#1d4ed8' } },
                `Position: (${table.x_position}, ${table.y_position})`
              ),
              React.createElement(
                "div",
                { style: { color: '#1d4ed8' } },
                `Rotation: ${table.rotation || 0}°`
              )
            ),
            React.createElement(
              "div",
              { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
              React.createElement(
                "div",
                { style: { color: '#1e40af', fontWeight: '500' } },
                "Seating"
              ),
              React.createElement(
                "div",
                { style: { color: '#1d4ed8' } },
                `Capacity: ${table.max_seats}`
              ),
              React.createElement(
                "div",
                { style: { color: '#1d4ed8' } },
                `Shape: ${TABLE_SHAPES.find((s) => s.id === table.table_shape)?.name || "Unknown"}`
              ),
              React.createElement(
                "div",
                { style: { color: '#1d4ed8' } },
                `Accessible: ${table.seats?.filter((s) => s.is_accessible).length || 0}`
              )
            )
          )
        )
      ),

      // Action Buttons Section
      React.createElement(
        "div",
        { style: { display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' } },
        
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
            style: buttonStyle('primary'),
            onMouseEnter: (e) => e.target.style.backgroundColor = '#bfdbfe',
            onMouseLeave: (e) => e.target.style.backgroundColor = '#dbeafe'
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
            style: buttonStyle('danger'),
            onMouseEnter: (e) => e.target.style.backgroundColor = '#fecaca',
            onMouseLeave: (e) => e.target.style.backgroundColor = '#fee2e2'
          },
          "🗑️ Delete Table"
        )
      )
    )
  );
};