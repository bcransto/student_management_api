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

    // Check for student edit pattern
    if (hash.startsWith("students/edit/")) {
      return "student-edit";
    }

    const validViews = ["dashboard", "students", "classes", "seating", "layouts"];
    return validViews.includes(hash) ? hash : "dashboard";
  };

  const [currentView, setCurrentView] = useState(getInitialView());
  const [editingStudentId, setEditingStudentId] = useState(null);

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

      // Get user info from the token
      const userInfo = window.AuthModule.getUserInfo();
      console.log("User info from token:", userInfo); // Debug logging

      if (userInfo) {
        // Prefer full name if available
        if (userInfo.firstName || userInfo.lastName) {
          const fullName = [userInfo.firstName, userInfo.lastName].filter(Boolean).join(" ");
          setCurrentUser(fullName || "Teacher");
        } else if (userInfo.email) {
          // Fallback to email-based name
          const emailName = userInfo.email.split("@")[0];
          // Capitalize first letter and replace dots/underscores with spaces
          const displayName = emailName
            .replace(/[._]/g, " ")
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
          setCurrentUser(displayName);
        } else {
          setCurrentUser("Teacher");
        }
      } else {
        setCurrentUser("Teacher");
      }

      fetchData();
    }
  }, []);

  // Parse student ID from hash on initial load
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash.startsWith("students/edit/")) {
      const id = hash.replace("students/edit/", "");
      setEditingStudentId(id);
    }
  }, []);

  // Handle hash changes (browser back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);

      // Check for student edit pattern
      if (hash.startsWith("students/edit/")) {
        const id = hash.replace("students/edit/", "");
        setEditingStudentId(id);
        setCurrentView("student-edit");
        return;
      }

      // Clear editing state if navigating away
      setEditingStudentId(null);

      const validViews = ["dashboard", "students", "classes", "seating", "layouts"];
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

    // Get user info from the token
    const userInfo = window.AuthModule.getUserInfo();
    if (userInfo && userInfo.email) {
      // Extract name from email (part before @)
      const emailName = userInfo.email.split("@")[0];
      // Capitalize first letter and replace dots/underscores with spaces
      const displayName = emailName
        .replace(/[._]/g, " ")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      setCurrentUser(displayName);
    } else {
      setCurrentUser("Teacher");
    }

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
  const handleNavigate = (view, params = {}) => {
    console.log("Navigating to:", view, params);

    // Handle student edit navigation
    if (view === "student-edit" && params.studentId) {
      setCurrentView("student-edit");
      setEditingStudentId(params.studentId);
      window.location.hash = `students/edit/${params.studentId}`;
      return;
    }

    // Regular navigation
    setCurrentView(view);
    setEditingStudentId(null);
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
      case "student-edit":
        return React.createElement(window.StudentEditor, {
          studentId: editingStudentId,
          navigateTo: handleNavigate,
          apiModule: window.ApiModule,
        });

      case "students":
        return React.createElement(Components.Students, {
          data: appData,
          refreshData: fetchData,
          navigateTo: handleNavigate,
          apiModule: window.ApiModule,
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
      React.createElement("main", { className: "content-area" }, renderCurrentView())
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
      Object.keys(window).filter((key) => key.includes("Component") || key.includes("Module"))
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
