// frontend/navigation/sidebar.js
const Sidebar = ({ currentView, onNavigate }) => {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "fas fa-tachometer-alt" },
    { id: "classes", label: "Classes", icon: "fas fa-chalkboard-teacher" },
    { id: "students", label: "Students", icon: "fas fa-users" },
    { id: "seating", label: "Seating Charts", icon: "fas fa-chair" },
    { id: "layouts", label: "Layouts", icon: "fas fa-th" },
  ];

  const getNavItemClass = (view) => {
    return `nav-item ${currentView === view ? "active" : ""}`;
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
    )
  );
};

// Attach to window for use in index.html
window.Sidebar = Sidebar;
