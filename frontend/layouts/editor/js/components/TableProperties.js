// components/TableProperties.js - Table Properties Panel (Tailwind-free version)
const TablePropertiesPanel = ({
  selectedItem,
  layout,
  setLayout,
  setSelectedItem,
}) => {
  if (!selectedItem || selectedItem.type !== "table") return null;

  const table = selectedItem.item;

  const updateTable = (updates) => {
    setLayout((prev) => ({
      ...prev,
      tables: prev.tables.map((t) =>
        t.id === table.id ? { ...t, ...updates } : t
      ),
    }));
    setSelectedItem({ item: { ...table, ...updates }, type: "table" });
  };

  const deleteTable = () => {
    if (confirm("Are you sure you want to delete this table?")) {
      setLayout((prev) => ({
        ...prev,
        tables: prev.tables.filter((t) => t.id !== table.id),
      }));
      setSelectedItem(null);
    }
  };

  const regenerateSeats = () => {
    const seats = generateSeats(
      table.table_shape,
      table.max_seats,
      table.width,
      table.height
    ); // Changed from generateSeatsForTable
    updateTable({ seats });
  };

  const toggleSeatAccessibility = (seatNumber) => {
    const updatedSeats = table.seats.map((seat) =>
      seat.seat_number === seatNumber
        ? { ...seat, is_accessible: !seat.is_accessible }
        : seat
    );
    updateTable({ seats: updatedSeats });
  };

  return React.createElement(
    "div",
    { className: "layout-properties" },

    React.createElement(
      "h3",
      { className: "layout-properties-title" },
      "🪑 Table Properties"
    ),

    React.createElement(
      "div",
      { className: "layout-form-group" },

      // Table Name
      React.createElement(
        "div",
        { className: "layout-form-group" },
        React.createElement(
          "label",
          { className: "layout-form-label" },
          "Table Name"
        ),
        React.createElement("input", {
          type: "text",
          value: table.table_name,
          onChange: (e) => updateTable({ table_name: e.target.value }),
          className: "layout-form-input",
        })
      ),

      // Table Number
      React.createElement(
        "div",
        { className: "layout-form-group" },
        React.createElement(
          "label",
          { className: "layout-form-label" },
          "Table Number"
        ),
        React.createElement("input", {
          type: "number",
          value: table.table_number,
          onChange: (e) =>
            updateTable({ table_number: parseInt(e.target.value) || 1 }),
          className: "layout-form-input",
          min: 1,
        })
      ),

      // Table Shape
      React.createElement(
        "div",
        { className: "layout-form-group" },
        React.createElement(
          "label",
          { className: "layout-form-label" },
          "Shape"
        ),
        React.createElement(
          "div",
          { className: "layout-shape-select" },
          TABLE_SHAPES.map((shape) =>
            React.createElement(
              "button",
              {
                key: shape.id,
                onClick: () => {
                  updateTable({ table_shape: shape.id });
                  regenerateSeats();
                },
                className: `layout-shape-option ${
                  table.table_shape === shape.id ? "selected" : ""
                }`,
              },
              shape.icon
            )
          )
        )
      ),

      // Size Controls
      React.createElement(
        "div",
        { className: "layout-properties-grid" },
        React.createElement(
          "div",
          null,
          React.createElement(
            "label",
            { className: "layout-form-label" },
            "Width"
          ),
          React.createElement("input", {
            type: "number",
            value: table.width,
            onChange: (e) => {
              updateTable({
                width: Math.max(1, parseInt(e.target.value) || 1),
              });
              regenerateSeats();
            },
            className: "layout-form-input",
            min: 1,
            max: 10,
          })
        ),
        React.createElement(
          "div",
          null,
          React.createElement(
            "label",
            { className: "layout-form-label" },
            "Height"
          ),
          React.createElement("input", {
            type: "number",
            value: table.height,
            onChange: (e) => {
              updateTable({
                height: Math.max(1, parseInt(e.target.value) || 1),
              });
              regenerateSeats();
            },
            className: "layout-form-input",
            min: 1,
            max: 10,
          })
        )
      ),

      // Max Seats
      React.createElement(
        "div",
        { className: "layout-form-group" },
        React.createElement(
          "label",
          { className: "layout-form-label" },
          "Max Seats"
        ),
        React.createElement("input", {
          type: "number",
          value: table.max_seats,
          onChange: (e) => {
            updateTable({
              max_seats: Math.max(1, parseInt(e.target.value) || 1),
            });
            regenerateSeats();
          },
          className: "layout-form-input",
          min: 1,
          max: 20,
        })
      ),

      // Seats Management
      React.createElement(
        "div",
        { className: "layout-form-group" },
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            },
          },
          React.createElement(
            "label",
            { className: "layout-form-label" },
            `Seats (${table.seats?.length || 0})`
          ),
          React.createElement(
            "button",
            {
              onClick: regenerateSeats,
              className: "btn btn-secondary btn-sm",
              title: "Regenerate seat positions",
            },
            "🔄 Regenerate"
          )
        ),

        React.createElement(
          "div",
          {
            className: "card",
            style: {
              maxHeight: "200px",
              overflowY: "auto",
              padding: "0.75rem",
              marginTop: "0.5rem",
            },
          },
          table.seats &&
            table.seats.map((seat) =>
              React.createElement(
                "div",
                {
                  key: seat.seat_number,
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.5rem",
                    borderBottom: "1px solid #e5e7eb",
                    backgroundColor: "white",
                    borderRadius: "4px",
                    marginBottom: "0.25rem",
                  },
                },
                React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                    },
                  },
                  React.createElement(
                    "span",
                    {
                      style: {
                        fontWeight: "500",
                        fontSize: "0.875rem",
                        minWidth: "60px",
                      },
                    },
                    `Seat ${seat.seat_number}`
                  ),
                  React.createElement(
                    "span",
                    {
                      className: "badge",
                      style: { fontSize: "0.75rem", fontFamily: "monospace" },
                    },
                    `${table.table_number}-${seat.seat_number}`
                  )
                ),
                React.createElement(
                  "button",
                  {
                    onClick: () => toggleSeatAccessibility(seat.seat_number),
                    className: seat.is_accessible
                      ? "btn btn-success btn-sm"
                      : "btn btn-secondary btn-sm",
                    title: seat.is_accessible
                      ? "Click to make regular seat"
                      : "Click to make accessible seat",
                  },
                  seat.is_accessible ? "♿ Accessible" : "Regular"
                )
              )
            )
        )
      ),

      // Delete Button
      React.createElement(
        "button",
        {
          onClick: deleteTable,
          className: "layout-btn layout-btn-danger",
          style: { marginTop: "1rem" },
        },
        React.createElement("i", { className: "fas fa-trash" }),
        " Delete Table"
      )
    )
  );
};
