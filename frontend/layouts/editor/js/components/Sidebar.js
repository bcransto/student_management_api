// components/Sidebar.js - Sidebar Component
const Sidebar = ({
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
  return React.createElement(
    "div",
    {
      className: "w-80 bg-white shadow-lg flex flex-col",
    },
    // Header
    React.createElement(
      "div",
      {
        className: "p-4 border-b border-gray-200",
      },
      React.createElement(
        "h2",
        {
          className: "text-xl font-bold text-gray-800 mb-4",
        },
        "Layout Editor"
      ),

      // Layout Info
      React.createElement(
        "div",
        {
          className: "space-y-3",
        },
        React.createElement(
          "div",
          null,
          React.createElement(
            "label",
            {
              className: "block text-sm font-medium text-gray-700 mb-1",
            },
            "Layout Name"
          ),
          React.createElement("input", {
            type: "text",
            value: layout.name,
            onChange: (e) => setLayout((prev) => ({ ...prev, name: e.target.value })),
            className:
              "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
          })
        ),
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
              className: "w-full px-3 py-2 border border-gray-300 rounded-lg",
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
                className: "block text-sm font-medium text-gray-700 mb-1",
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
              className: "w-full px-3 py-2 border border-gray-300 rounded-lg",
              min: ROOM_CONSTRAINTS.MIN_HEIGHT,
              max: ROOM_CONSTRAINTS.MAX_HEIGHT,
            })
          )
        )
      )
    ),

    // Tools
    React.createElement(
      "div",
      {
        className: "p-4 border-b border-gray-200",
      },
      React.createElement(
        "h3",
        {
          className: "text-lg font-semibold text-gray-800 mb-3",
        },
        "Tools"
      ),
      React.createElement(
        "div",
        {
          className: "grid grid-cols-3 gap-2",
        },
        React.createElement(
          "button",
          {
            onClick: () => setSelectedTool(TOOL_MODES.SELECT),
            className: `p-3 rounded-lg transition-colors ${
              selectedTool === TOOL_MODES.SELECT
                ? "bg-blue-100 text-blue-600 border-2 border-blue-300"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100 border-2 border-transparent"
            }`,
          },
          React.createElement(
            "div",
            {
              className: "text-center",
            },
            React.createElement(
              "div",
              {
                className: "text-xl mb-1",
              },
              "👆"
            ),
            React.createElement(
              "div",
              {
                className: "text-xs",
              },
              "Select"
            )
          )
        ),
        React.createElement(
          "button",
          {
            onClick: () => setSelectedTool(TOOL_MODES.TABLE),
            className: `p-3 rounded-lg transition-colors ${
              selectedTool === TOOL_MODES.TABLE
                ? "bg-green-100 text-green-600 border-2 border-green-300"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100 border-2 border-transparent"
            }`,
          },
          React.createElement(
            "div",
            {
              className: "text-center",
            },
            React.createElement(
              "div",
              {
                className: "text-xl mb-1",
              },
              "🪑"
            ),
            React.createElement(
              "div",
              {
                className: "text-xs",
              },
              "Table"
            )
          )
        ),
        React.createElement(
          "button",
          {
            onClick: () => setSelectedTool(TOOL_MODES.OBSTACLE),
            className: `p-3 rounded-lg transition-colors ${
              selectedTool === TOOL_MODES.OBSTACLE
                ? "bg-orange-100 text-orange-600 border-2 border-orange-300"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100 border-2 border-transparent"
            }`,
          },
          React.createElement(
            "div",
            {
              className: "text-center",
            },
            React.createElement(
              "div",
              {
                className: "text-xl mb-1",
              },
              "📦"
            ),
            React.createElement(
              "div",
              {
                className: "text-xs",
              },
              "Object"
            )
          )
        )
      ),

      // Grid toggle
      React.createElement(
        "div",
        {
          className: "mt-3",
        },
        React.createElement(
          "button",
          {
            onClick: () => setShowGrid(!showGrid),
            className: `flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg transition-colors ${
              showGrid
                ? "bg-green-100 text-green-600"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`,
          },
          React.createElement(Grid, { size: 16 }),
          React.createElement(
            "span",
            {
              className: "text-sm",
            },
            showGrid ? "Hide Grid" : "Show Grid"
          )
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
    React.createElement("div", { className: "flex-1" }),

    // Save Button
    React.createElement(
      "div",
      {
        className: "p-4 border-t border-gray-200",
      },
      React.createElement(
        "button",
        {
          onClick: onSave,
          className:
            "w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium",
        },
        React.createElement(Save, { size: 18 }),
        layout.id ? "Update Layout" : "Save Layout"
      )
    )
  );
};
