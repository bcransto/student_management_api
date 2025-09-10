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
  Users: window.UsersModule?.UsersList,
  UserEditor: window.UsersModule?.UserEditor,
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

    // Check for password reset pattern
    if (hash.startsWith("password-reset/")) {
      return "password-reset";
    }

    // Check for student edit pattern
    if (hash.startsWith("students/edit/")) {
      return "student-edit";
    }

    // Check for user patterns
    if (hash === "users") {
      return "users";
    }
    if (hash.startsWith("users/edit/")) {
      return "user-edit";
    }
    if (hash === "profile") {
      return "user-edit"; // Profile is user editing self
    }

    // Check for class view pattern
    if (hash.startsWith("classes/view/")) {
      return "class-view";
    }
    
    // Check for class edit pattern
    if (hash.startsWith("classes/edit/")) {
      return "class-edit";
    }
    
    // Check for class student manager pattern
    if (hash.includes("/add-students")) {
      return "class-add-students";
    }

    // Check for seating patterns
    if (hash.startsWith("seating/view/") || hash.startsWith("seating/edit/")) {
      return "seating";
    }

    // Check for attendance patterns
    if (hash === "attendance" || hash.startsWith("attendance/")) {
      return "attendance";
    }

    const validViews = ["dashboard", "students", "classes", "seating", "attendance", "layouts", "users"];
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

      // Check for password reset pattern
      if (hash.startsWith("password-reset/")) {
        setCurrentView("password-reset");
        return;
      }

      // Check for student edit pattern
      if (hash.startsWith("students/edit/")) {
        const id = hash.replace("students/edit/", "");
        setEditingStudentId(id);
        setCurrentView("student-edit");
        return;
      }

      // Check for user patterns
      if (hash === "users") {
        setCurrentView("users");
        return;
      }
      if (hash.startsWith("users/edit/")) {
        setCurrentView("user-edit");
        return;
      }
      if (hash === "profile") {
        setCurrentView("user-edit");
        return;
      }

      // Check for class view pattern
      if (hash.startsWith("classes/view/")) {
        setCurrentView("class-view");
        return;
      }
      
      // Check for class edit pattern
      if (hash.startsWith("classes/edit/")) {
        setCurrentView("class-edit");
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

      // Check for attendance patterns
      if (hash === "attendance" || hash.startsWith("attendance/")) {
        console.log("Hash change detected for attendance:", hash);
        setCurrentView("attendance");
        // Force update to ensure proper re-render when leaving visual mode
        if (window.location.hash === "#attendance") {
          console.log("Navigating back to attendance list from visual mode");
        }
        return;
      }

      // Clear editing state if navigating away
      setEditingStudentId(null);

      const validViews = ["dashboard", "students", "classes", "seating", "attendance", "layouts", "users"];
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
    
    // Handle class edit navigation
    if (view.startsWith("classes/edit/")) {
      setCurrentView("class-edit");
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

    // Handle attendance navigation specifically (especially when coming back from visual mode)
    if (view === "attendance") {
      console.log("Navigating to attendance list view");
      console.log("Current hash before:", window.location.hash);
      
      // Update the hash
      window.location.hash = "attendance";
      
      // Update state
      setCurrentView("attendance");
      setEditingStudentId(null);
      
      // Force a re-render
      forceUpdate();
      
      console.log("Hash after update:", window.location.hash);
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
        
      case "class-edit":
        const classIdToEdit = window.location.hash.replace("#classes/edit/", "");
        return React.createElement(window.ClassEditorComponent, {
          classId: classIdToEdit,
          navigateTo: handleNavigate,
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

      case "attendance":
        // Parse the URL to determine if we're in list, editor, or visual mode
        const attendanceHash = window.location.hash.slice(1);
        
        // Check if we're in visual mode for a specific class
        if (attendanceHash.startsWith("attendance/visual/")) {
          const visualParts = attendanceHash.replace("attendance/visual/", "").split("/");
          const visualClassId = visualParts[0];
          const visualDate = visualParts[1] || null; // Optional date parameter
          
          return React.createElement(window.AttendanceVisual, {
            classId: visualClassId,
            date: visualDate,
            navigateTo: handleNavigate,
            onBack: () => handleNavigate("attendance")
          });
        }
        
        // Check if we're viewing attendance report
        if (attendanceHash.startsWith("attendance/report/")) {
          const reportClassId = attendanceHash.replace("attendance/report/", "").split("/")[0];
          
          return React.createElement(window.AttendanceReport, {
            classId: reportClassId,
            data: appData,
            refreshData: fetchData,
            navigateTo: handleNavigate
          });
        }
        
        // Check if we're editing attendance for a specific class (list mode)
        if (attendanceHash.startsWith("attendance/") && attendanceHash.split("/").length >= 2) {
          const attendanceClassId = attendanceHash.split("/")[1];
          const attendanceDate = attendanceHash.split("/")[2] || null; // Optional date parameter
          
          return React.createElement(window.AttendanceEditor, {
            classId: attendanceClassId,
            date: attendanceDate,
            navigateTo: handleNavigate,
            onBack: () => handleNavigate("attendance")
          });
        }
        
        // Otherwise show the attendance list
        return React.createElement(window.Attendance, {
          data: appData,
          refreshData: fetchData,
          navigateTo: handleNavigate,
          currentParams: null,
        });
      case "layouts":
        return React.createElement(Components.Layouts, {
          data: appData,
          refreshData: fetchData,
        });

      case "users":
        return React.createElement(Components.Users, {
          data: appData,
          refreshData: fetchData,
        });

      case "profile":
        // Profile is editing current user
        return React.createElement(Components.UserEditor, {
          userId: "me",
          refreshData: fetchData,
        });

      case "user-edit":
        const hash = window.location.hash.slice(1);
        let userId = "me"; // Default to current user
        if (hash.startsWith("users/edit/")) {
          userId = hash.replace("users/edit/", "");
        }
        return React.createElement(Components.UserEditor, {
          userId: userId,
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

  // Show password reset screen if on password-reset route
  if (currentView === "password-reset") {
    const resetHash = window.location.hash.slice(1);
    const resetParts = resetHash.split("/");
    if (resetParts.length === 3) {
      const [, uid, token] = resetParts;
      return React.createElement(window.PasswordResetConfirm, {
        uid: uid,
        token: token,
        onSuccess: () => {
          window.location.hash = "";
          window.location.reload();
        }
      });
    }
  }

  // Show login screen if not authenticated
  if (!isLoggedIn) {
    return React.createElement(Components.Login, {
      onLogin: handleLogin,
    });
  }

  // Debug log to track renders
  console.log("App render - currentView:", currentView, "hash:", window.location.hash);
  
  // Check if we're in visual attendance mode (fullscreen, no sidebar/header)
  const isVisualAttendanceMode = window.location.hash.includes("attendance/visual/");
  
  // For visual attendance mode, render only the component (fullscreen)
  if (isVisualAttendanceMode) {
    return React.createElement(
      "div",
      { className: "app app-fullscreen" },
      renderCurrentView()
    );
  }
  
  // Main app layout (normal mode with header and sidebar)
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
