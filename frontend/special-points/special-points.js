// special-points.js - Main special points overview showing class cards
console.log("Loading special points component...");

const SpecialPoints = ({ data, refreshData, navigateTo, currentParams }) => {
  const nav = window.NavigationService || null;

  const { classes } = data || {};

  if (!classes || !Array.isArray(classes)) {
    return React.createElement(
      "div",
      null,
      React.createElement("h1", null, "Special Points - No Data"),
      React.createElement("p", null, "Classes data not available")
    );
  }

  const handleClassClick = (cls) => {
    if (navigateTo && typeof navigateTo === "function") {
      navigateTo(`special-points/${cls.id}`);
    } else {
      window.location.hash = `#special-points/${cls.id}`;
    }
  };

  const handleVisualMode = (e, cls) => {
    e.stopPropagation();
    if (navigateTo && typeof navigateTo === "function") {
      navigateTo(`special-points/visual/${cls.id}`);
    } else {
      window.location.hash = `#special-points/visual/${cls.id}`;
    }
  };

  return React.createElement(
    "div",
    { className: "sp-container" },
    // Page Header
    React.createElement(
      "div",
      { className: "sp-header" },
      React.createElement(
        "div",
        { className: "sp-header-content" },
        React.createElement("h1", { className: "page-title" }, "Special Points"),
        React.createElement(
          "p",
          { className: "page-subtitle" },
          "Award special points to students"
        )
      )
    ),

    // Classes Grid
    React.createElement(
      "div",
      { className: "sp-grid" },
      classes.map((cls) => {
        return React.createElement(
          "div",
          {
            key: cls.id,
            className: "sp-card",
            onClick: () => handleClassClick(cls),
            style: { cursor: "pointer" },
          },
          // Card Header
          React.createElement(
            "div",
            { className: "sp-card-header" },
            React.createElement(
              "h3",
              { className: "sp-card-title" },
              cls.name
            ),
            React.createElement(
              "span",
              {
                className: `sp-card-badge ${
                  cls.subject
                    ? cls.subject.toLowerCase().replace(/\s+/g, "-")
                    : ""
                }`,
              },
              cls.subject || "General"
            )
          ),

          // Card Body
          React.createElement(
            "div",
            { className: "sp-card-body" },

            // Class Info
            React.createElement(
              "div",
              { className: "sp-info-grid" },
              React.createElement(
                "div",
                { className: "sp-info-item" },
                React.createElement("i", {
                  className: "fas fa-graduation-cap",
                }),
                React.createElement(
                  "span",
                  null,
                  " Grade ",
                  cls.grade_level || "N/A"
                )
              ),
              React.createElement(
                "div",
                { className: "sp-info-item" },
                React.createElement("i", { className: "fas fa-users" }),
                React.createElement(
                  "span",
                  null,
                  " ",
                  cls.current_enrollment || 0,
                  " Students"
                )
              )
            ),

            // Action Buttons
            React.createElement(
              "div",
              { className: "sp-card-footer" },
              // List Mode Button
              React.createElement(
                "button",
                {
                  className: "sp-action-btn sp-list-mode",
                  onClick: (e) => {
                    e.stopPropagation();
                    handleClassClick(cls);
                  },
                  title: "Award points (list view)",
                },
                React.createElement("i", { className: "fas fa-list" }),
                React.createElement("span", null, " List Mode")
              ),
              // Visual Mode Button
              React.createElement(
                "button",
                {
                  className: "sp-action-btn sp-visual-mode",
                  onClick: (e) => handleVisualMode(e, cls),
                  title: "Award points (visual seating view)",
                },
                React.createElement("i", { className: "fas fa-th" }),
                React.createElement("span", null, " Visual Mode")
              )
            )
          )
        );
      })
    ),

    // Empty State
    classes.length === 0 &&
      React.createElement(
        "div",
        { className: "empty-state" },
        React.createElement("i", { className: "fas fa-star fa-3x" }),
        React.createElement("h3", null, "No Classes Found"),
        React.createElement(
          "p",
          null,
          "You don't have any classes assigned yet."
        )
      )
  );
};

window.SpecialPoints = SpecialPoints;
console.log("SpecialPoints component loaded and exported to window.SpecialPoints");
