// frontend/navigation/sidebar.js
const Sidebar = ({ currentView, onNavigate }) => {
  const [currentUser, setCurrentUser] = React.useState(null);

  // Get current user info from JWT token
  React.useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setCurrentUser({
          is_superuser: payload.is_superuser || false
        });
      } catch (e) {
        console.error("Error parsing token:", e);
      }
    }
  }, []);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "fas fa-tachometer-alt" },
    { id: "classes", label: "Classes", icon: "fas fa-chalkboard-teacher" },
    { id: "students", label: "Students", icon: "fas fa-users" },
    { id: "seating", label: "Seating Charts", icon: "fas fa-chair" },
    { id: "layouts", label: "Layouts", icon: "fas fa-th" },
  ];

  // Add admin items if superuser
  if (currentUser?.is_superuser) {
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
