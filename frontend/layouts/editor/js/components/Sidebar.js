// components/Sidebar.js - Sidebar Component (Tailwind-free version)
const LayoutEditorSidebar = ({
  layout,
  setLayout,
  selectedTool,
  setSelectedTool,
  onSave,
  showGrid,
  setShowGrid,
  selectedItem,
  setSelectedItem,
}) => {
  console.log('LayoutEditorSidebar rendered, onSave is:', typeof onSave, onSave);
  
  return React.createElement(
    "div",
    {
      className: "layout-sidebar",
    },
    // Header
    React.createElement(
      "div",
      {
        className: "layout-sidebar-header",
      },
      React.createElement(
        "h2",
        {
          className: "layout-sidebar-title",
        },
        "Layout Editor"
      ),

      // Layout Info
      React.createElement(
        "div",
        {
          className: "layout-form-group",
        },
        React.createElement(
          "div",
          {
            className: "layout-form-group",
          },
          React.createElement(
            "label",
            {
              className: "layout-form-label",
            },
            "Layout Name"
          ),
          React.createElement("input", {
            type: "text",
            value: layout.name,
            onChange: (e) =>
              setLayout((prev) => ({ ...prev, name: e.target.value })),
            className: "layout-form-input",
          })
        ),
        React.createElement(
          "div",
          {
            className: "layout-form-row",
          },
          React.createElement(
            "div",
            null,
            React.createElement(
              "label",
              {
                className: "layout-form-label",
              },
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
              className: "layout-form-input",
              min: ROOM_CONSTRAINTS.MIN_WIDTH,
              max: ROOM_CONSTRAINTS.MAX_WIDTH,
            })
          ),
          React.createElement(
            "div",
            null,
            React.createElement(
              "label",
              {
                className: "layout-form-label",
              },
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
              className: "layout-form-input",
              min: ROOM_CONSTRAINTS.MIN_HEIGHT,
              max: ROOM_CONSTRAINTS.MAX_HEIGHT,
            })
          )
        )
      )
    ),

    // Tools Section
    React.createElement(
      "div",
      {
        className: "layout-tools",
      },
      React.createElement(
        "h3",
        {
          className: "layout-tools-title",
        },
        "Tools"
      ),
      React.createElement(
        "div",
        {
          className: "layout-tools-grid",
        },
        // Select Tool
        React.createElement(
          "button",
          {
            onClick: () => setSelectedTool(TOOL_MODES.SELECT),
            className: `layout-tool-btn ${
              selectedTool === TOOL_MODES.SELECT ? "active" : ""
            }`,
          },
          React.createElement(
            "div",
            {
              className: "layout-tool-icon",
            },
            "👆"
          ),
          React.createElement("div", null, "Select")
        ),
        // Table Tool
        React.createElement(
          "button",
          {
            onClick: () => setSelectedTool(TOOL_MODES.TABLE),
            className: `layout-tool-btn ${
              selectedTool === TOOL_MODES.TABLE ? "active table" : ""
            }`,
          },
          React.createElement(
            "div",
            {
              className: "layout-tool-icon",
            },
            "🪑"
          ),
          React.createElement("div", null, "Table")
        ),
        // Obstacle Tool
        React.createElement(
          "button",
          {
            onClick: () => setSelectedTool(TOOL_MODES.OBSTACLE),
            className: `layout-tool-btn ${
              selectedTool === TOOL_MODES.OBSTACLE ? "active obstacle" : ""
            }`,
          },
          React.createElement(
            "div",
            {
              className: "layout-tool-icon",
            },
            "📦"
          ),
          React.createElement("div", null, "Object")
        )
      ),

      // Grid toggle
      React.createElement(
        "button",
        {
          onClick: () => {
            console.log('Grid toggle clicked, current state:', showGrid);
            setShowGrid(!showGrid);
          },
          className: `layout-grid-toggle ${showGrid ? "active" : ""}`,
          type: "button"
        },
        React.createElement("i", { className: "fas fa-th" }),
        " ",
        React.createElement("span", null, showGrid ? "Hide Grid" : "Show Grid")
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

    // Statistics
    React.createElement(
      "div",
      {
        className: "layout-stats",
      },
      React.createElement(
        "h3",
        {
          className: "layout-stats-title",
        },
        "Statistics"
      ),
      React.createElement(
        "div",
        {
          className: "layout-stats-list",
        },
        React.createElement(
          "div",
          {
            className: "layout-stat-row",
          },
          React.createElement("span", null, "Tables:"),
          React.createElement(
            "span",
            {
              className: "layout-stat-value",
            },
            layout.tables.length
          )
        ),
        React.createElement(
          "div",
          {
            className: "layout-stat-row",
          },
          React.createElement("span", null, "Total Seats:"),
          React.createElement(
            "span",
            {
              className: "layout-stat-value",
            },
            layout.tables.reduce((sum, t) => sum + (t.max_seats || 0), 0)
          )
        ),
        React.createElement(
          "div",
          {
            className: "layout-stat-row",
          },
          React.createElement("span", null, "Obstacles:"),
          React.createElement(
            "span",
            {
              className: "layout-stat-value",
            },
            layout.obstacles.length
          )
        ),
        React.createElement(
          "div",
          {
            className: "layout-stat-row",
          },
          React.createElement("span", null, "Room Size:"),
          React.createElement(
            "span",
            {
              className: "layout-stat-value",
            },
            `${layout.room_width} × ${layout.room_height}`
          )
        )
      )
    ),

    // Save Button
    React.createElement(
      "div",
      {
        className: "layout-save-section",
      },
      React.createElement(
        "button",
        {
          onClick: () => {
            console.log('Save button in sidebar clicked!');
            console.log('onSave type:', typeof onSave);
            try {
              if (onSave) {
                console.log('Calling onSave...');
                onSave();
              } else {
                console.log('onSave is not defined!');
              }
            } catch (error) {
              console.error('Error calling onSave:', error);
            }
          },
          className: "layout-btn layout-btn-primary",
        },
        React.createElement("i", { className: "fas fa-save" }),
        layout.id ? "Update Layout" : "Save Layout"
      )
    )
  );
};