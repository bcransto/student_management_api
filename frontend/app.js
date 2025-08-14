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
  const { useState, useEffect, useCallback, useReducer } = React;
  
  // Authentication state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Force update counter to trigger re-renders
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Navigation state - initialize from URL hash
  const getInitialView = () => {
    const hash = window.location.hash.slice(1); // Remove the #

    // Check for student edit pattern
    if (hash.startsWith("students/edit/")) {
      return "student-edit";
    }

    // Check for class view pattern
    if (hash.startsWith("classes/view/")) {
      return "class-view";
    }
    
    // Check for class student manager pattern
    if (hash.includes("/add-students")) {
      return "class-add-students";
    }

    // Check for seating patterns
    if (hash.startsWith("seating/view/") || hash.startsWith("seating/edit/")) {
      return "seating";
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

      // Check for class view pattern
      if (hash.startsWith("classes/view/")) {
        setCurrentView("class-view");
        return;
      }
      
      // Check for class student manager pattern
      if (hash.includes("/add-students")) {
        setCurrentView("class-add-students");
        return;
      }

      // Check for seating patterns (pass to seating component to handle)
      if (hash.startsWith("seating/view/") || hash.startsWith("seating/edit/")) {
        setCurrentView("seating");
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
  const handleNavigate = useCallback((view, params = {}) => {
    console.log("Navigating to:", view, params);

    // Handle student edit navigation
    if (view === "student-edit" && params.studentId) {
      setCurrentView("student-edit");
      setEditingStudentId(params.studentId);
      window.location.hash = `students/edit/${params.studentId}`;
      return;
    }

    // Handle class view navigation
    if (view.startsWith("classes/view/")) {
      setCurrentView("class-view");
      window.location.hash = view;
      return;
    }
    
    // Handle class student manager navigation
    if (view.includes("/add-students")) {
      setCurrentView("class-add-students");
      window.location.hash = view;
      return;
    }

    // Handle seating navigation specifically
    if (view === "seating") {
      console.log("Setting currentView to 'seating' for list view");
      console.log("Current hash before:", window.location.hash);
      
      // First update the hash
      window.location.hash = "seating";
      console.log("Hash after update:", window.location.hash);
      
      // Then update state
      setCurrentView("seating");
      setEditingStudentId(null);
      
      // Force a re-render
      forceUpdate();
      
      // Debug callback
      setTimeout(() => {
        console.log("Timeout check - currentView should be 'seating', hash:", window.location.hash);
      }, 0);
      
      return;
    }

    // Regular navigation
    setCurrentView(view);
    setEditingStudentId(null);
    window.location.hash = view;
  }, [forceUpdate]); // Include forceUpdate in dependencies so we can use it

  // Initialize NavigationService with handleNavigate
  useEffect(() => {
    if (window.NavigationService && typeof handleNavigate === 'function') {
      window.NavigationService.init(handleNavigate);
      console.log("NavigationService initialized with app navigation");
    }
  }, [handleNavigate]); // Re-initialize when handleNavigate changes

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
    console.log("Current hash:", window.location.hash);

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
          navigateTo: handleNavigate,
        });

      case "class-view":
        const classId = window.location.hash.replace("#classes/view/", "");
        return React.createElement(window.ClassViewComponent, {
          classId: classId,
          navigateTo: handleNavigate,
          data: appData,
        });
        
      case "class-add-students":
        const classIdForStudents = window.location.hash.match(/classes\/(\d+)\/add-students/)?.[1];
        return React.createElement(window.ClassStudentManagerComponent, {
          classId: classIdForStudents,
          navigateTo: handleNavigate,
        });

      case "seating":
        // Parse the URL to determine view/edit mode and IDs
        const seatingHash = window.location.hash.slice(1);
        let seatingInitialView = "list";
        let seatingClassId = null;
        let seatingPeriodId = null;
        
        // Only parse detailed routes if the hash is more than just "seating"
        if (seatingHash === "seating") {
          // Explicitly show list view
          seatingInitialView = "list";
          seatingClassId = null;
          seatingPeriodId = null;
        } else if (seatingHash.startsWith("seating/view/")) {
          const viewMatch = seatingHash.match(/seating\/view\/(\d+)(?:\/period\/(\d+))?/);
          seatingInitialView = "viewer";
          seatingClassId = viewMatch?.[1];
          seatingPeriodId = viewMatch?.[2];
        } else if (seatingHash.startsWith("seating/edit/")) {
          const editMatch = seatingHash.match(/seating\/edit\/(\d+)(?:\/period\/(\d+))?/);
          seatingInitialView = "editor";
          seatingClassId = editMatch?.[1];
          seatingPeriodId = editMatch?.[2];
        }
        
        console.log("Seating case - hash:", seatingHash, "view:", seatingInitialView, "classId:", seatingClassId);
        
        return React.createElement(Components.Seating, {
          data: appData,
          refreshData: fetchData,
          navigateTo: handleNavigate,
          initialView: seatingInitialView,
          classId: seatingClassId,
          periodId: seatingPeriodId,
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

  // Debug log to track renders
  console.log("App render - currentView:", currentView, "hash:", window.location.hash);
  
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
