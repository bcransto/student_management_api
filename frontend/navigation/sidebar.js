// frontend/navigation/sidebar.js
const Sidebar = ({ currentView, onNavigate }) => {
  // Parse token and check if user is superuser
  const token = localStorage.getItem("token");
  let isSuperuser = false;
  
  if (token) {
    try {
      let payload = token.split(".")[1];
      payload = payload.replace(/-/g, '+').replace(/_/g, '/');
      while (payload.length % 4) {
        payload += '=';
      }
      const decoded = JSON.parse(atob(payload));
      console.log("Sidebar token check - is_superuser:", decoded.is_superuser, "full token:", decoded);
      isSuperuser = decoded.is_superuser === true;
    } catch (e) {
      console.error("Error parsing token:", e);
    }
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "fas fa-tachometer-alt" },
    { id: "classes", label: "Classes", icon: "fas fa-chalkboard-teacher" },
    { id: "students", label: "Students", icon: "fas fa-users" },
    { id: "seating", label: "Seating Charts", icon: "fas fa-chair" },
    { id: "attendance", label: "Attendance", icon: "fas fa-clipboard-check" },
    { id: "layouts", label: "Layouts", icon: "fas fa-th" },
  ];

  // Add Users menu for superusers
  if (isSuperuser) {
    navItems.push({ id: "users", label: "Users", icon: "fas fa-user-cog" });
  }

  // Add profile link for all users
  navItems.push({ id: "profile", label: "My Profile", icon: "fas fa-user-circle" });

  const getNavItemClass = (view) => {
    // Handle profile and user-edit as the same view
    if (view === "profile" && (currentView === "user-edit" || currentView === "profile")) {
      return "nav-item active";
    }
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
