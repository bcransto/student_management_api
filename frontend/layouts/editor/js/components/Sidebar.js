// components/Sidebar.js - Sidebar Component (No Tailwind)
const Sidebar = ({
  layout,
  setLayout,
  selectedTool,
  setSelectedTool,
  onSave,
  onDelete,
  showGrid,
  setShowGrid,
  selectedItem,
  setSelectedItem,
}) => {
  // Sidebar container style
  const sidebarStyle = {
    width: '320px',
    backgroundColor: '#ffffff',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%'
  };

  // Header section style
  const headerStyle = {
    padding: '16px',
    borderBottom: '1px solid #e5e7eb'
  };

  // Title style
  const titleStyle = {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: '16px'
  };

  // Label style
  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '4px'
  };

  // Input style
  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  };

  // Tool button styles
  const getToolButtonStyle = (isActive) => ({
    padding: '12px',
    borderRadius: '8px',
    transition: 'all 0.2s',
    backgroundColor: isActive ? '#dbeafe' : '#f9fafb',
    color: isActive ? '#2563eb' : '#6b7280',
    border: isActive ? '2px solid #93c5fd' : '2px solid transparent',
    cursor: 'pointer',
    textAlign: 'center',
    outline: 'none'
  });

  // Grid toggle button style
  const gridButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    transition: 'all 0.2s',
    backgroundColor: showGrid ? '#d1fae5' : '#f3f4f6',
    color: showGrid ? '#059669' : '#6b7280',
    border: 'none',
    cursor: 'pointer',
    marginTop: '12px',
    outline: 'none'
  };

  // Save button style
  const saveButtonStyle = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '16px',
    transition: 'background-color 0.2s',
    outline: 'none'
  };

  // Delete button style
  const deleteButtonStyle = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: '#dc2626',
    color: '#ffffff',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '16px',
    transition: 'background-color 0.2s',
    outline: 'none'
  };

  // Section style
  const sectionStyle = {
    padding: '16px',
    borderBottom: '1px solid #e5e7eb'
  };

  // Grid container style
  const gridContainerStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
  };

  // Tool grid style
  const toolGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px'
  };

  return React.createElement(
    "div",
    { style: sidebarStyle },
    
    // Header
    React.createElement(
      "div",
      { style: headerStyle },
      React.createElement(
        "h2",
        { style: titleStyle },
        "Layout Editor"
      ),

      // Layout Info
      React.createElement(
        "div",
        { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        React.createElement(
          "div",
          null,
          React.createElement(
            "label",
            { style: labelStyle },
            "Layout Name"
          ),
          React.createElement("input", {
            type: "text",
            value: layout.name,
            onChange: (e) => setLayout((prev) => ({ ...prev, name: e.target.value })),
            style: inputStyle,
            onFocus: (e) => e.target.style.borderColor = '#3b82f6',
            onBlur: (e) => e.target.style.borderColor = '#d1d5db'
          })
        ),
        React.createElement(
          "div",
          { style: gridContainerStyle },
          React.createElement(
            "div",
            null,
            React.createElement(
              "label",
              { style: labelStyle },
              "Width"
            ),
            React.createElement("input", {
              type: "number",
              value: layout.room_width,
              onChange: (e) =>
                setLayout((prev) => ({
                  ...prev,
                  room_width: parseInt(e.target.value) || 15,
                })),
              style: inputStyle,
              min: ROOM_CONSTRAINTS.MIN_WIDTH,
              max: ROOM_CONSTRAINTS.MAX_WIDTH,
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
              "Height"
            ),
            React.createElement("input", {
              type: "number",
              value: layout.room_height,
              onChange: (e) =>
                setLayout((prev) => ({
                  ...prev,
                  room_height: parseInt(e.target.value) || 10,
                })),
              style: inputStyle,
              min: ROOM_CONSTRAINTS.MIN_HEIGHT,
              max: ROOM_CONSTRAINTS.MAX_HEIGHT,
              onFocus: (e) => e.target.style.borderColor = '#3b82f6',
              onBlur: (e) => e.target.style.borderColor = '#d1d5db'
            })
          )
        )
      )
    ),

    // Tools
    React.createElement(
      "div",
      { style: sectionStyle },
      React.createElement(
        "h3",
        { style: { fontSize: '18px', fontWeight: '600', color: '#1f2937', marginBottom: '12px' } },
        "Tools"
      ),
      React.createElement(
        "div",
        { style: toolGridStyle },
        React.createElement(
          "button",
          {
            onClick: () => setSelectedTool(TOOL_MODES.SELECT),
            style: getToolButtonStyle(selectedTool === TOOL_MODES.SELECT),
            onMouseEnter: (e) => {
              if (selectedTool !== TOOL_MODES.SELECT) {
                e.target.style.backgroundColor = '#e5e7eb';
              }
            },
            onMouseLeave: (e) => {
              if (selectedTool !== TOOL_MODES.SELECT) {
                e.target.style.backgroundColor = '#f9fafb';
              }
            }
          },
          React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { style: { fontSize: '20px', marginBottom: '4px' } },
              "👆"
            ),
            React.createElement(
              "div",
              { style: { fontSize: '12px' } },
              "Select"
            )
          )
        ),
        React.createElement(
          "button",
          {
            onClick: () => setSelectedTool(TOOL_MODES.TABLE),
            style: getToolButtonStyle(selectedTool === TOOL_MODES.TABLE),
            onMouseEnter: (e) => {
              if (selectedTool !== TOOL_MODES.TABLE) {
                e.target.style.backgroundColor = '#e5e7eb';
              }
            },
            onMouseLeave: (e) => {
              if (selectedTool !== TOOL_MODES.TABLE) {
                e.target.style.backgroundColor = '#f9fafb';
              }
            }
          },
          React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { style: { fontSize: '20px', marginBottom: '4px' } },
              "🪑"
            ),
            React.createElement(
              "div",
              { style: { fontSize: '12px' } },
              "Table"
            )
          )
        ),
        React.createElement(
          "button",
          {
            onClick: () => setSelectedTool(TOOL_MODES.OBSTACLE),
            style: getToolButtonStyle(selectedTool === TOOL_MODES.OBSTACLE),
            onMouseEnter: (e) => {
              if (selectedTool !== TOOL_MODES.OBSTACLE) {
                e.target.style.backgroundColor = '#e5e7eb';
              }
            },
            onMouseLeave: (e) => {
              if (selectedTool !== TOOL_MODES.OBSTACLE) {
                e.target.style.backgroundColor = '#f9fafb';
              }
            }
          },
          React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { style: { fontSize: '20px', marginBottom: '4px' } },
              "📦"
            ),
            React.createElement(
              "div",
              { style: { fontSize: '12px' } },
              "Object"
            )
          )
        )
      ),

      // Grid toggle
      React.createElement(
        "button",
        {
          onClick: () => setShowGrid(!showGrid),
          style: gridButtonStyle,
          onMouseEnter: (e) => {
            e.target.style.backgroundColor = showGrid ? '#a7f3d0' : '#e5e7eb';
          },
          onMouseLeave: (e) => {
            e.target.style.backgroundColor = showGrid ? '#d1fae5' : '#f3f4f6';
          }
        },
        React.createElement(Grid, { size: 16 }),
        React.createElement(
          "span",
          { style: { fontSize: '14px' } },
          showGrid ? "Hide Grid" : "Show Grid"
        )
      )
    ),

    // Table Properties Panel (conditionally rendered)
    selectedItem &&
      selectedItem.type === "table" &&
      React.createElement(TablePropertiesPanel, {
        selectedItem: selectedItem,
        layout: layout,
        setLayout: setLayout,
        setSelectedItem: setSelectedItem,
      }),

    // Spacer to push save button to bottom
    React.createElement("div", { style: { flex: 1 } }),

    // Save and Delete Buttons
    React.createElement(
      "div",
      { style: { padding: '16px', borderTop: '1px solid #e5e7eb' } },
      React.createElement(
        "div",
        { style: { display: 'flex', gap: '8px' } },
        // Save Button
        React.createElement(
          "button",
          {
            onClick: onSave,
            style: saveButtonStyle,
            onMouseEnter: (e) => {
              e.target.style.backgroundColor = '#1d4ed8';
            },
            onMouseLeave: (e) => {
              e.target.style.backgroundColor = '#2563eb';
            }
          },
          React.createElement(Save, { size: 18 }),
          layout.id ? "Update" : "Save"
        ),
        // Delete Button (only show if layout has been saved)
        layout.id && React.createElement(
          "button",
          {
            onClick: onDelete,
            style: deleteButtonStyle,
            onMouseEnter: (e) => {
              e.target.style.backgroundColor = '#b91c1c';
            },
            onMouseLeave: (e) => {
              e.target.style.backgroundColor = '#dc2626';
            }
          },
          React.createElement(Trash2, { size: 18 }),
          "Delete"
        )
      )
    )
  );
};