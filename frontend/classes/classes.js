// classes.js - Updated to remove SeatingChart component (now in seating module)
console.log("Loading classes component - cleaned up version...");

const Classes = ({ data, refreshData, navigateTo, currentParams }) => {
  // Use NavigationService if available, fallback to navigateTo prop
  const nav = window.NavigationService || null;
  
  console.log("Classes component rendering with data:", data);
  console.log("Current params:", currentParams);
  console.log("navigateTo prop:", navigateTo);

  const { classes } = data || {};
  console.log("Classes array:", classes);
  
  // State for create modal
  const [showCreateModal, setShowCreateModal] = React.useState(false);

  if (!classes || !Array.isArray(classes)) {
    return React.createElement(
      "div",
      null,
      React.createElement("h1", null, "Classes - No Data"),
      React.createElement("p", null, "Classes data not available")
    );
  }

  const handleClassClick = (cls) => {
    console.log("Class card clicked:", cls.name);
    console.log("navigateTo available:", !!navigateTo, typeof navigateTo);
    
    if (nav?.toClassView) {
      console.log("Using NavigationService");
      nav.toClassView(cls.id);
    } else if (navigateTo && typeof navigateTo === 'function') {
      // Use the provided navigation function if available
      console.log("Using navigateTo function");
      navigateTo("classes/view/" + cls.id);
    } else {
      // Fallback: use hash navigation directly to show class details
      console.log("Using fallback navigation to:", `#classes/view/${cls.id}`);
      window.location.hash = `#classes/view/${cls.id}`;
    }
  };

  const handleNewClass = () => {
    console.log("New class button clicked");
    setShowCreateModal(true);
  };
  
  const handleCreateSuccess = (newClass) => {
    console.log("New class created:", newClass);
    setShowCreateModal(false);
    
    // Navigate to the new class view
    if (nav?.toClassView) {
      nav.toClassView(newClass.id);
    } else if (navigateTo && typeof navigateTo === 'function') {
      navigateTo(`classes/view/${newClass.id}`);
    } else {
      window.location.hash = Router?.buildHash ? Router.buildHash('classView', {id: newClass.id}) : `#classes/view/${newClass.id}`;
    }
    
    // Refresh data to show new class in list
    if (refreshData) {
      refreshData();
    }
  };

  return React.createElement(
    "div",
    { className: "classes-container" },
    // Page Header with New Class button
    React.createElement(
      "div",
      { className: "classes-header" },
      React.createElement(
        "div",
        { className: "classes-header-content" },
        React.createElement("h1", { className: "page-title" }, "Classes"),
        React.createElement(
          "p",
          { className: "page-subtitle" },
          "Manage your classroom assignments and layouts"
        )
      ),
      React.createElement(
        "button",
        {
          className: "btn btn-primary btn-new-class",
          onClick: handleNewClass,
        },
        React.createElement("i", { className: "fas fa-plus" }),
        " New Class"
      )
    ),

    // Classes Grid
    React.createElement(
      "div",
      { className: "classes-grid" },
      classes.map((cls) => {
        const enrollmentPercent = cls.max_enrollment 
          ? Math.round((cls.current_enrollment / cls.max_enrollment) * 100)
          : 0;
        
        return React.createElement(
          "div",
          { 
            key: cls.id, 
            className: "classes-list-card",
            onClick: () => handleClassClick(cls),
            style: { cursor: "pointer" }
          },
          // Card Header
          React.createElement(
            "div",
            { className: "classes-list-card-header" },
            React.createElement("h3", { className: "classes-list-card-title" }, cls.name),
            React.createElement(
              "span",
              { className: `classes-list-card-badge ${cls.subject ? cls.subject.toLowerCase().replace(/\s+/g, '-') : ''}` },
              cls.subject || "General"
            )
          ),
          
          // Card Body
          React.createElement(
            "div",
            { className: "classes-list-card-body" },
            cls.description && React.createElement(
              "p",
              { className: "classes-list-card-description" },
              cls.description
            ),
            
            // Class Info Grid
            React.createElement(
              "div",
              { className: "class-info-grid" },
              // Grade Level
              React.createElement(
                "div",
                { className: "class-info-item" },
                React.createElement("i", { className: "fas fa-graduation-cap" }),
                React.createElement(
                  "div",
                  null,
                  React.createElement("span", { className: "class-info-label" }, "Grade"),
                  React.createElement("span", { className: "class-info-value" }, cls.grade_level || "N/A")
                )
              ),
              
              // Enrollment
              React.createElement(
                "div",
                { className: "class-info-item" },
                React.createElement("i", { className: "fas fa-users" }),
                React.createElement(
                  "div",
                  null,
                  React.createElement("span", { className: "class-info-label" }, "Students"),
                  React.createElement(
                    "span",
                    { className: "class-info-value" },
                    cls.current_enrollment || 0,
                    cls.max_enrollment && ` / ${cls.max_enrollment}`
                  )
                )
              ),
              
              // Layout Status
              // Layout field removed - layouts are selected per seating period
            ),
            
            // Enrollment Progress Bar (if max_enrollment is set)
            cls.max_enrollment && React.createElement(
              "div",
              { className: "class-enrollment-progress" },
              React.createElement(
                "div",
                { className: "class-enrollment-bar" },
                React.createElement(
                  "div",
                  {
                    className: "class-enrollment-fill",
                    style: { width: `${enrollmentPercent}%` }
                  }
                )
              ),
              React.createElement(
                "span",
                { className: "class-enrollment-text" },
                `${enrollmentPercent}% Full`
              )
            )
          )
        );
      })
    ),
    
    // Create Class Modal
    React.createElement(window.ClassCreateModalComponent, {
      isOpen: showCreateModal,
      onClose: () => setShowCreateModal(false),
      onSuccess: handleCreateSuccess
    })
  );
};

// ClassView component for displaying individual class details with roster
const ClassView = ({ classId, data, navigateTo }) => {
  // Use NavigationService if available, fallback to navigateTo prop
  const nav = window.NavigationService || null;
  const [classDetails, setClassDetails] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  
  // Get current user info
  const currentUser = window.AuthModule?.getUserInfo();

  React.useEffect(() => {
    const fetchClassDetails = async () => {
      try {
        setLoading(true);
        console.log("Fetching details for class:", classId);
        
        // Fetch class details including roster
        const response = await window.ApiModule.request(`/classes/${classId}/`, {
          method: 'GET'
        });
        
        console.log("Class details fetched:", response);
        console.log("Roster data:", response.roster);
        setClassDetails(response);
        setError(null);
      } catch (err) {
        console.error("Error fetching class details:", err);
        setError("Failed to load class details");
      } finally {
        setLoading(false);
      }
    };

    if (classId) {
      fetchClassDetails();
    }
  }, [classId]);

  const handleBack = () => {
    if (nav?.toClasses) {
      nav.toClasses();
    } else if (navigateTo && typeof navigateTo === 'function') {
      navigateTo("classes");
    } else {
      window.location.hash = "#classes";
    }
  };

  const handleUnenroll = async (roster) => {
    const studentName = roster.student_nickname || roster.student_first_name || roster.student_name || 'this student';
    
    // Simple confirm dialog
    if (!window.confirm(`Are you sure you want to unenroll ${studentName} from this class?`)) {
      return;
    }
    
    try {
      // Soft delete - set is_active to false instead of deleting
      await window.ApiModule.request(`/roster/${roster.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false })
      });
      
      // Refresh class details to update the roster
      const response = await window.ApiModule.request(`/classes/${classId}/`, {
        method: 'GET'
      });
      
      setClassDetails(response);
      console.log(`Successfully unenrolled ${studentName}`);
    } catch (err) {
      console.error("Error unenrolling student:", err);
      alert(`Failed to unenroll student: ${err.message || 'Unknown error'}`);
    }
  };

  if (loading) {
    return React.createElement(
      "div",
      { className: "loading-container" },
      React.createElement("div", { className: "spinner" }),
      React.createElement("p", null, "Loading class details...")
    );
  }

  if (error) {
    return React.createElement(
      "div",
      { className: "error-container" },
      React.createElement("h2", null, "Error"),
      React.createElement("p", null, error),
      React.createElement(
        "button",
        { className: "btn btn-primary", onClick: handleBack },
        "Back to Classes"
      )
    );
  }

  if (!classDetails) {
    return React.createElement(
      "div",
      null,
      React.createElement("p", null, "No class details found"),
      React.createElement(
        "button",
        { className: "btn btn-primary", onClick: handleBack },
        "Back to Classes"
      )
    );
  }

  // Fetch roster entries for this class
  const roster = classDetails.roster || [];

  return React.createElement(
    "div",
    { className: "class-view-container" },
    
    // Header with back button
    React.createElement(
      "div",
      { className: "class-view-header" },
      React.createElement(
        "button",
        { 
          className: "btn btn-secondary btn-back",
          onClick: handleBack
        },
        React.createElement("i", { className: "fas fa-arrow-left" }),
        " Back"
      ),
      React.createElement(
        "div",
        { className: "class-view-title-section" },
        React.createElement("h1", { className: "class-view-title" }, classDetails.name),
        classDetails.subject && React.createElement(
          "span",
          { className: "class-view-subject" },
          classDetails.subject
        )
      ),
      // Edit button - only show if current user is the teacher
      currentUser && classDetails.teacher && currentUser.id === classDetails.teacher && React.createElement(
        "button",
        {
          className: "btn btn-primary",
          onClick: () => {
            // Navigate to edit page for this class
            if (navigateTo && typeof navigateTo === 'function') {
              navigateTo(`classes/edit/${classId}`);
            } else {
              window.location.hash = `#classes/edit/${classId}`;
            }
          }
        },
        React.createElement("i", { className: "fas fa-edit" }),
        " Edit Class"
      )
    ),

    // Class Information Card
    React.createElement(
      "div",
      { className: "class-info-card" },
      React.createElement("h2", null, "Class Information"),
      React.createElement(
        "div",
        { className: "class-details-grid" },
        React.createElement(
          "div",
          { className: "detail-item" },
          React.createElement("label", null, "Grade Level:"),
          React.createElement("span", null, classDetails.grade_level || "N/A")
        ),
        React.createElement(
          "div",
          { className: "detail-item" },
          React.createElement("label", null, "Description:"),
          React.createElement("span", null, classDetails.description || "No description")
        ),
        React.createElement(
          "div",
          { className: "detail-item" },
          React.createElement("label", null, "Enrollment:"),
          React.createElement(
            "span",
            null,
            `${classDetails.current_enrollment || 0} students`,
            classDetails.max_enrollment && ` (Max: ${classDetails.max_enrollment})`
          )
        )
        // Layout field removed - layouts are selected per seating period
      )
    ),

    // Roster Section
    React.createElement(
      "div",
      { className: "roster-card" },
      React.createElement(
        "div",
        { className: "roster-header" },
        React.createElement(
          "div",
          { className: "roster-header-left" },
          React.createElement("h2", null, "Class Roster"),
          React.createElement(
            "span",
            { className: "roster-count" },
            `${roster.length} students`
          )
        ),
        // Add Students button - only show if current user is the teacher
        currentUser && classDetails.teacher && currentUser.id === classDetails.teacher && React.createElement(
          "button",
          {
            className: "btn btn-primary",
            onClick: () => {
              // Navigate to student manager page for this class
              if (nav?.toClassAddStudents) {
                nav.toClassAddStudents(classId);
              } else if (navigateTo && typeof navigateTo === 'function') {
                navigateTo(`classes/${classId}/add-students`);
              } else {
                window.location.hash = Router?.buildHash ? Router.buildHash('classAddStudents', {id: classId}) : `#classes/${classId}/add-students`;
              }
            }
          },
          React.createElement("i", { className: "fas fa-user-plus" }),
          " Add Students"
        )
      ),
      
      roster.length > 0 ? React.createElement(
        "div",
        { className: "roster-grid" },
        roster.map((entry) => {
          // Debug what we're getting
          console.log("Roster entry:", entry);
          console.log("Current user:", currentUser);
          console.log("Class teacher ID:", classDetails?.teacher);
          console.log("Permission check:", currentUser && classDetails.teacher && currentUser.id === classDetails.teacher);
          
          // Use the flattened student fields from the serializer
          const firstName = entry.student_nickname || entry.student_first_name || "Unknown";
          const lastName = entry.student_last_name || "";
          const studentId = entry.student_id || "N/A";
          const email = entry.student_email || "";
          const gender = entry.student_gender || "";
          
          return React.createElement(
            "div",
            { key: entry.id, className: "student-card" },
            React.createElement(
              "div",
              { className: "student-card-header" },
              React.createElement(
                "h4",
                null,
                firstName
              ),
              React.createElement(
                "span",
                { className: "student-last-name" },
                lastName
              )
            ),
            React.createElement(
              "div",
              { className: "student-card-details" },
              React.createElement(
                "div",
                { className: "student-detail" },
                React.createElement("i", { className: "fas fa-id-card" }),
                React.createElement("span", null, studentId)
              ),
              email && React.createElement(
                "div",
                { className: "student-detail" },
                React.createElement("i", { className: "fas fa-envelope" }),
                React.createElement("span", null, email)
              ),
              gender && React.createElement(
                "div",
                { className: "student-detail" },
                React.createElement("i", { className: "fas fa-user" }),
                React.createElement("span", null, gender.charAt(0).toUpperCase() + gender.slice(1))
              ),
              entry.is_active && React.createElement(
                "div",
                { className: "student-detail" },
                React.createElement("i", { className: "fas fa-check-circle", style: { color: "#10b981" } }),
                React.createElement("span", null, "Active")
              )
            ),
            // Unenroll button - only show if current user is the teacher
            currentUser && classDetails.teacher && currentUser.id === classDetails.teacher && React.createElement(
              "button",
              {
                className: "btn btn-danger btn-sm btn-unenroll",
                onClick: (e) => {
                  e.stopPropagation(); // Prevent card click if it becomes clickable
                  handleUnenroll(entry);
                },
                title: "Unenroll student"
              },
              React.createElement("i", { className: "fas fa-user-minus" }),
              " Unenroll"
            )
          );
        })
      ) : React.createElement(
        "p",
        { className: "no-roster" },
        "No students enrolled in this class yet."
      )
    )
  );
};

// Export both components
if (typeof window !== "undefined") {
  window.ClassesComponent = Classes;
  window.ClassViewComponent = ClassView;
  console.log("Classes components loaded: Classes (list) and ClassView (detail)");
}
