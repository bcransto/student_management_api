// frontend/navigation/sidebar.js
const Sidebar = ({ currentView, onNavigate }) => {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "fas fa-tachometer-alt" },
    { id: "classes", label: "Classes", icon: "fas fa-chalkboard-teacher" },
    { id: "students", label: "Students", icon: "fas fa-users" },
    { id: "seating", label: "Seating Charts", icon: "fas fa-chair" },
    { id: "layouts", label: "Classroom Layouts", icon: "fas fa-th-large" },
  ];

  const getNavItemClass = (view) => {
    return `nav-item ${currentView === view ? "active" : ""}`;
  };

  const handleLayoutEditorClick = () => {
    window.open("/frontend/layouts/editor/", "_blank");
  };

  return React.createElement(
    "nav",
    { className: "sidebar" },
    React.createElement("h3", null, "Navigation"),

    // Regular navigation items
    ...navItems.map((item) =>
      React.createElement(
        "div",
        {
          key: item.id,
          className: getNavItemClass(item.id),
          onClick: () => onNavigate(item.id),
        },
        React.createElement("i", { className: item.icon }),
        item.label
      )
    ),

    // Layout Editor (external link)
    React.createElement(
      "div",
      {
        className: "nav-item",
        onClick: handleLayoutEditorClick,
      },
      React.createElement("i", { className: "fas fa-edit" }),
      "Layout Editor"
    )
  );
};

// Attach to window for use in index.html
window.Sidebar = Sidebar;
