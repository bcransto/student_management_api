// frontend/layouts/LayoutEditorIntegration.js
// Integration wrapper for the Layout Editor in the main app

const { useState, useEffect } = React;

const LayoutEditorIntegration = ({ params, onNavigate }) => {
  const [loading, setLoading] = useState(false);

  const handleSave = async (layoutData) => {
    try {
      const method = layoutData.id ? "PUT" : "POST";
      const url = layoutData.id ? `/layouts/${layoutData.id}/` : "/layouts/";

      const response = await window.ApiModule.request(url, {
        method: method,
        body: JSON.stringify(layoutData),
      });

      alert(
        layoutData.id
          ? "Layout updated successfully!"
          : "Layout created successfully!"
      );
      onNavigate("layouts"); // Go back to list
    } catch (error) {
      console.error("Failed to save layout:", error);
      throw error;
    }
  };

  const handleCancel = () => {
    onNavigate("layouts");
  };

  // For now, show a message that the editor needs to be loaded
  // In production, you'd load the actual editor here
  return React.createElement(
    "div",
    { className: "content-area" },
    React.createElement(
      "div",
      {
        style: {
          textAlign: "center",
          padding: "2rem",
        },
      },
      React.createElement("h2", null, "Layout Editor"),
      React.createElement(
        "p",
        null,
        "Layout ID: ",
        params?.layoutId || "New Layout"
      ),
      React.createElement(
        "div",
        {
          style: {
            marginTop: "2rem",
            padding: "2rem",
            background: "#f3f4f6",
            borderRadius: "8px",
          },
        },
        React.createElement(
          "p",
          null,
          "The layout editor will be integrated here."
        ),
        React.createElement(
          "p",
          null,
          "For now, you can use the standalone editor."
        )
      ),
      React.createElement(
        "div",
        {
          style: {
            marginTop: "2rem",
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
          },
        },
        React.createElement(
          "button",
          {
            className: "btn btn-primary",
            onClick: () =>
              window.open(
                `/frontend/layouts/editor/?layout=${params?.layoutId || "new"}`,
                "_blank"
              ),
          },
          "Open Editor in New Window"
        ),
        React.createElement(
          "button",
          {
            className: "btn btn-secondary",
            onClick: handleCancel,
          },
          "Back to List"
        )
      )
    )
  );
};

// Export
if (typeof window !== "undefined") {
  window.LayoutEditorIntegration = LayoutEditorIntegration;
}
