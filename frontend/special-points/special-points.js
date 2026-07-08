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
      { className: "page-header" },
      React.createElement("h1", { className: "page-title" }, "Special Points"),
      React.createElement(
        "p",
        { className: "page-subtitle" },
        "Award special points to students"
      )
    ),

    // Classes Grid
    React.createElement(
      "div",
      { className: "list-grid" },
      classes.map((cls) => {
        return React.createElement(
          "div",
          {
            key: cls.id,
            className: "list-card",
            onClick: () => handleClassClick(cls),
            style: { cursor: "pointer" },
          },
          // Card Header
          React.createElement(
            "div",
            { className: "list-card-header" },
            React.createElement(
              "div",
              { className: "list-card-title" },
              React.createElement("i", { className: "fas fa-star" }),
              cls.name
            ),
            React.createElement(
              "span",
              { className: "badge badge-info" },
              cls.subject || "General"
            )
          ),

          // Class Info
          React.createElement(
            "div",
            { className: "list-card-meta" },
            React.createElement(
              "div",
              null,
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
              null,
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
            { className: "list-card-actions" },
            // List Mode Button
            React.createElement(
              "button",
              {
                className: "btn btn-sm btn-primary",
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
                className: "btn btn-sm btn-ghost",
                onClick: (e) => handleVisualMode(e, cls),
                title: "Award points (visual seating view)",
              },
              React.createElement("i", { className: "fas fa-th" }),
              React.createElement("span", null, " Visual Mode")
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
