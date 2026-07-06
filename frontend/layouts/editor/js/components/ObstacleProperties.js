// components/ObstacleProperties.js - Obstacle/Object Properties Panel (No Tailwind)
const ObstaclePropertiesPanel = ({ selectedItem, layout, setLayout, setSelectedItem }) => {
  if (!selectedItem || selectedItem.type !== "obstacle") return null;

  const obstacle = selectedItem.item;

  const updateObstacleProperty = (property, value) => {
    const updatedObstacle = { ...obstacle, [property]: value };

    // Changing type resets color to the type default, and updates the name
    // if the user hasn't customized it (name still matches a type default)
    if (property === "obstacle_type") {
      const newType = OBSTACLE_TYPES.find((t) => t.id === value);
      if (newType) {
        updatedObstacle.color = newType.color;
        const isDefaultName = OBSTACLE_TYPES.some((t) => t.name === obstacle.name);
        if (isDefaultName) {
          updatedObstacle.name = newType.name;
        }
      }
    }

    // If changing dimensions, keep the obstacle inside room bounds
    if (property === "width") {
      updatedObstacle.x_position = Math.min(obstacle.x_position, layout.room_width - value);
    }
    if (property === "height") {
      updatedObstacle.y_position = Math.min(obstacle.y_position, layout.room_height - value);
    }

    setLayout((prev) => ({
      ...prev,
      obstacles: prev.obstacles.map((o) => (o.id === obstacle.id ? updatedObstacle : o)),
    }));

    // Update selected item to reflect changes
    setSelectedItem((prev) => ({
      ...prev,
      item: updatedObstacle,
    }));
  };

  // Styles (matching TableProperties.js)
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
    }
    return baseStyle;
  };

  const summaryBoxStyle = {
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    padding: '12px'
  };

  const obstacleType = OBSTACLE_TYPES.find((t) => t.id === obstacle.obstacle_type);

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
        React.createElement("span", null, obstacleType?.icon || "📦"),
        "Object Properties"
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

        // Object Name
        React.createElement(
          "div",
          null,
          React.createElement(
            "label",
            { style: labelStyle },
            "Object Name"
          ),
          React.createElement("input", {
            type: "text",
            value: obstacle.name,
            onChange: (e) => updateObstacleProperty("name", e.target.value),
            style: inputStyle,
            placeholder: "Enter object name",
            onFocus: (e) => e.target.style.borderColor = '#3b82f6',
            onBlur: (e) => e.target.style.borderColor = '#d1d5db'
          })
        ),

        // Object Type
        React.createElement(
          "div",
          null,
          React.createElement(
            "label",
            { style: labelStyle },
            "Type"
          ),
          React.createElement(
            "select",
            {
              value: obstacle.obstacle_type,
              onChange: (e) => updateObstacleProperty("obstacle_type", e.target.value),
              style: selectStyle,
              onFocus: (e) => e.target.style.borderColor = '#3b82f6',
              onBlur: (e) => e.target.style.borderColor = '#d1d5db'
            },
            OBSTACLE_TYPES.map((type) =>
              React.createElement(
                "option",
                {
                  key: type.id,
                  value: type.id,
                },
                `${type.icon} ${type.name}`
              )
            )
          )
        ),

        // Color
        React.createElement(
          "div",
          null,
          React.createElement(
            "label",
            { style: labelStyle },
            "Color"
          ),
          React.createElement(
            "div",
            { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            React.createElement("input", {
              type: "color",
              value: obstacle.color || "#808080",
              onChange: (e) => updateObstacleProperty("color", e.target.value),
              style: {
                width: '48px',
                height: '36px',
                padding: '2px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: '#ffffff'
              }
            }),
            React.createElement(
              "span",
              { style: { fontSize: '14px', color: '#6b7280', fontFamily: 'monospace' } },
              obstacle.color || "#808080"
            )
          )
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
              value: obstacle.width,
              onChange: (e) => {
                const newWidth = parseInt(e.target.value) || OBSTACLE_CONSTRAINTS.MIN_WIDTH;
                const constrainedWidth = Math.max(
                  OBSTACLE_CONSTRAINTS.MIN_WIDTH,
                  Math.min(newWidth, OBSTACLE_CONSTRAINTS.MAX_WIDTH, layout.room_width)
                );
                updateObstacleProperty("width", constrainedWidth);
              },
              style: inputStyle,
              min: OBSTACLE_CONSTRAINTS.MIN_WIDTH,
              max: Math.min(OBSTACLE_CONSTRAINTS.MAX_WIDTH, layout.room_width),
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
              value: obstacle.height,
              onChange: (e) => {
                const newHeight = parseInt(e.target.value) || OBSTACLE_CONSTRAINTS.MIN_HEIGHT;
                const constrainedHeight = Math.max(
                  OBSTACLE_CONSTRAINTS.MIN_HEIGHT,
                  Math.min(newHeight, OBSTACLE_CONSTRAINTS.MAX_HEIGHT, layout.room_height)
                );
                updateObstacleProperty("height", constrainedHeight);
              },
              style: inputStyle,
              min: OBSTACLE_CONSTRAINTS.MIN_HEIGHT,
              max: Math.min(OBSTACLE_CONSTRAINTS.MAX_HEIGHT, layout.room_height),
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
              value: obstacle.x_position,
              onChange: (e) => {
                const newX = parseInt(e.target.value) || 0;
                const constrainedX = Math.max(0, Math.min(newX, layout.room_width - obstacle.width));
                updateObstacleProperty("x_position", constrainedX);
              },
              style: inputStyle,
              min: "0",
              max: layout.room_width - obstacle.width,
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
              value: obstacle.y_position,
              onChange: (e) => {
                const newY = parseInt(e.target.value) || 0;
                const constrainedY = Math.max(0, Math.min(newY, layout.room_height - obstacle.height));
                updateObstacleProperty("y_position", constrainedY);
              },
              style: inputStyle,
              min: "0",
              max: layout.room_height - obstacle.height,
              onFocus: (e) => e.target.style.borderColor = '#3b82f6',
              onBlur: (e) => e.target.style.borderColor = '#d1d5db'
            })
          )
        )
      ),

      // Summary Section
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
            { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px' } },
            React.createElement(
              "div",
              { style: { color: '#1d4ed8' } },
              `Type: ${obstacleType?.name || "Unknown"}`
            ),
            React.createElement(
              "div",
              { style: { color: '#1d4ed8' } },
              `Size: ${obstacle.width} × ${obstacle.height}`
            ),
            React.createElement(
              "div",
              { style: { color: '#1d4ed8' } },
              `Position: (${obstacle.x_position}, ${obstacle.y_position})`
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
              const newObstacle = {
                ...obstacle,
                id: Date.now(),
                x_position: Math.min(obstacle.x_position + 1, layout.room_width - obstacle.width),
                y_position: Math.min(obstacle.y_position + 1, layout.room_height - obstacle.height),
              };

              setLayout((prev) => ({
                ...prev,
                obstacles: [...prev.obstacles, newObstacle],
              }));
              setSelectedItem({ type: "obstacle", item: newObstacle });
            },
            style: buttonStyle('primary'),
            onMouseEnter: (e) => e.target.style.backgroundColor = '#bfdbfe',
            onMouseLeave: (e) => e.target.style.backgroundColor = '#dbeafe'
          },
          "📋 Duplicate Object"
        ),

        // Delete Button
        React.createElement(
          "button",
          {
            onClick: () => {
              if (confirm(`Are you sure you want to delete "${obstacle.name}"?`)) {
                setLayout((prev) => ({
                  ...prev,
                  obstacles: prev.obstacles.filter((o) => o.id !== obstacle.id),
                }));
                setSelectedItem(null);
              }
            },
            style: buttonStyle('danger'),
            onMouseEnter: (e) => e.target.style.backgroundColor = '#fecaca',
            onMouseLeave: (e) => e.target.style.backgroundColor = '#fee2e2'
          },
          "🗑️ Delete Object"
        )
      )
    )
  );
};
