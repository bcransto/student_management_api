// Main App Component for Student Management System
const { useState, useEffect } = React;

// Component references from global scope
const Components = {
  Login: window.LoginComponent,
  Dashboard: window.DashboardComponent,
  Students: window.StudentsComponent,
  Classes: window.ClassesComponent,
  Seating: window.SeatingComponent,
  Layouts: window.LayoutsComponent,
  Header: window.Header,
  Sidebar: window.Sidebar,
};

// Main App Component
const App = () => {
  // Authentication state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Navigation state - initialize from URL hash
  const getInitialView = () => {
    const hash = window.location.hash.slice(1); // Remove the #
    const validViews = [
      "dashboard",
      "students",
      "classes",
      "seating",
      "layouts",
    ];
    return validViews.includes(hash) ? hash : "dashboard";
  };

  const [currentView, setCurrentView] = useState(getInitialView());

  // Application data
  const [appData, setAppData] = useState({
    classes: [],
    students: [],
    layouts: [],
    periods: [],
    assignments: [],
    roster: [],
  });

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    const token = window.AuthModule?.getToken();
    if (token) {
      setIsLoggedIn(true);
      setCurrentUser("Teacher"); // In real app, decode from token
      fetchData();
    }
  }, []);

  // Handle hash changes (browser back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      const validViews = [
        "dashboard",
        "students",
        "classes",
        "seating",
        "layouts",
      ];
      if (validViews.includes(hash)) {
        setCurrentView(hash);
      } else {
        setCurrentView("dashboard");
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Fetch all application data
  const fetchData = async () => {
    console.log("Fetching application data...");
    setIsLoading(true);

    try {
      const data = await window.ApiModule.fetchAllData();

      // Normalize the data structure
      setAppData({
        classes: Array.isArray(data.classes) ? data.classes : [],
        students: Array.isArray(data.students) ? data.students : [],
        layouts: Array.isArray(data.layouts) ? data.layouts : [],
        periods: Array.isArray(data.periods) ? data.periods : [],
        assignments: Array.isArray(data.assignments) ? data.assignments : [],
        roster: Array.isArray(data.roster) ? data.roster : [],
      });

      console.log("Data fetched successfully:", {
        classes: data.classes?.length || 0,
        students: data.students?.length || 0,
        layouts: data.layouts?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching data:", error);
      // Show user-friendly error message
      alert("Unable to load data. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle login
  const handleLogin = (token) => {
    window.AuthModule.setToken(token);
    setIsLoggedIn(true);
    setCurrentUser("Teacher"); // In real app, decode from token
    // Clear hash on login to go to dashboard
    window.location.hash = "dashboard";
    fetchData();
  };

  // Handle logout
  const handleLogout = () => {
    window.AuthModule.logout();
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentView("dashboard");
    // Clear hash on logout
    window.location.hash = "";
    setAppData({
      classes: [],
      students: [],
      layouts: [],
      periods: [],
      assignments: [],
      roster: [],
    });
  };

  // Handle navigation
  const handleNavigate = (view) => {
    console.log("Navigating to:", view);
    setCurrentView(view);
    // Update URL hash
    window.location.hash = view;
  };

  // Render the current view
  const renderCurrentView = () => {
    if (isLoading) {
      return React.createElement(
        "div",
        { className: "loading-container" },
        React.createElement("div", { className: "spinner" }),
        React.createElement("p", null, "Loading...")
      );
    }

    console.log("Rendering view:", currentView);

    switch (currentView) {
      case "students":
        return React.createElement(Components.Students, {
          data: appData,
          refreshData: fetchData,
        });

      case "classes":
        return React.createElement(Components.Classes, {
          data: appData,
          refreshData: fetchData,
        });

      case "seating":
        return React.createElement(Components.Seating, {
          data: appData,
          refreshData: fetchData,
        });

      case "layouts":
        return React.createElement(Components.Layouts, {
          data: appData,
          refreshData: fetchData,
        });

      case "dashboard":
      default:
        return React.createElement(Components.Dashboard, {
          data: appData,
          navigateTo: handleNavigate,
        });
    }
  };

  // Show login screen if not authenticated
  if (!isLoggedIn) {
    return React.createElement(Components.Login, {
      onLogin: handleLogin,
    });
  }

  // Main app layout
  return React.createElement(
    "div",
    { className: "app" },

    // Header
    React.createElement(Components.Header, {
      currentUser,
      onLogout: handleLogout,
      onNavigate: handleNavigate,
    }),

    // Main container with sidebar and content
    React.createElement(
      "div",
      { className: "main-container" },

      // Sidebar navigation
      React.createElement(Components.Sidebar, {
        currentView,
        onNavigate: handleNavigate,
      }),

      // Content area
      React.createElement(
        "main",
        { className: "content-area" },
        renderCurrentView()
      )
    )
  );
};

// Initialize the app when DOM is ready
const initializeApp = () => {
  // Verify all required components are loaded
  const requiredComponents = [
    "LoginComponent",
    "DashboardComponent",
    "StudentsComponent",
    "ClassesComponent",
    "SeatingComponent",
    "LayoutsComponent",
    "Header",
    "Sidebar",
    "AuthModule",
    "ApiModule",
  ];

  const missingComponents = requiredComponents.filter((comp) => !window[comp]);

  if (missingComponents.length > 0) {
    console.error("Missing required components:", missingComponents);
    console.log(
      "Available components:",
      Object.keys(window).filter(
        (key) => key.includes("Component") || key.includes("Module")
      )
    );

    // Show error to user
    document.getElementById("root").innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h2>Loading Error</h2>
        <p>Some components failed to load. Please refresh the page.</p>
        <p style="color: red;">Missing: ${missingComponents.join(", ")}</p>
      </div>
    `;
    return;
  }

  console.log("All components loaded successfully. Initializing app...");

  // Render the app
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(React.createElement(App));
};

// Wait for DOM content to be loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  // DOM is already loaded
  initializeApp();
}
