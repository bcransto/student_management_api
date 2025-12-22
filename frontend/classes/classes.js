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

  // Build subtitle parts
  const subtitleParts = [];
  if (classDetails.subject) subtitleParts.push(classDetails.subject);
  if (classDetails.grade_level) subtitleParts.push(`Grade ${classDetails.grade_level}`);
  subtitleParts.push(`${roster.length} student${roster.length !== 1 ? 's' : ''}`);

  // Check if user is the teacher (for showing management buttons)
  const isTeacher = currentUser && classDetails.teacher && currentUser.id === classDetails.teacher;

  return React.createElement(
    "div",
    null,

    // Page Header (simple style like students page)
    React.createElement(
      "div",
      { className: "page-header" },
      React.createElement("h1", { className: "page-title" }, classDetails.name),
      React.createElement(
        "p",
        { className: "page-subtitle" },
        subtitleParts.join(" • ")
      )
    ),

    // Toolbar with small buttons
    React.createElement(
      "div",
      {
        style: {
          marginBottom: "20px",
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap"
        }
      },
      // Back button
      React.createElement(
        "button",
        {
          onClick: handleBack,
          style: {
            padding: "6px 12px",
            backgroundColor: "#6b7280",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px"
          }
        },
        React.createElement("i", { className: "fas fa-arrow-left" }),
        " Back"
      ),
      // Edit button - only show if current user is the teacher
      isTeacher && React.createElement(
        "button",
        {
          onClick: () => {
            if (navigateTo && typeof navigateTo === 'function') {
              navigateTo(`classes/edit/${classId}`);
            } else {
              window.location.hash = `#classes/edit/${classId}`;
            }
          },
          style: {
            padding: "6px 12px",
            backgroundColor: "#667eea",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px"
          }
        },
        React.createElement("i", { className: "fas fa-edit" }),
        " Edit"
      ),
      // Add Students button - only show if current user is the teacher
      isTeacher && React.createElement(
        "button",
        {
          onClick: () => {
            if (nav?.toClassAddStudents) {
              nav.toClassAddStudents(classId);
            } else if (navigateTo && typeof navigateTo === 'function') {
              navigateTo(`classes/${classId}/add-students`);
            } else {
              window.location.hash = Router?.buildHash ? Router.buildHash('classAddStudents', {id: classId}) : `#classes/${classId}/add-students`;
            }
          },
          style: {
            padding: "6px 12px",
            backgroundColor: "#10b981",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px"
          }
        },
        React.createElement("i", { className: "fas fa-user-plus" }),
        " Add Students"
      )
    ),

    // Students Table (like students list page)
    React.createElement(
      "div",
      { className: "students-table-container" },
      roster.length > 0 ? React.createElement(
        "table",
        { className: "students-table" },
        // Table Header
        React.createElement(
          "thead",
          null,
          React.createElement(
            "tr",
            null,
            React.createElement("th", null, "Name"),
            React.createElement("th", null, "Student ID"),
            React.createElement("th", null, "Email"),
            React.createElement("th", null, "Status"),
            isTeacher && React.createElement("th", { style: { width: "100px" } }, "Actions")
          )
        ),
        // Table Body
        React.createElement(
          "tbody",
          null,
          roster.map((entry) => {
            // Use the flattened student fields from the serializer
            const firstName = entry.student_nickname || entry.student_first_name || "Unknown";
            const lastName = entry.student_last_name || "";
            const fullName = `${firstName} ${lastName}`.trim();
            const studentId = entry.student_id || "N/A";
            const email = entry.student_email || "N/A";

            return React.createElement(
              "tr",
              {
                key: entry.id,
                className: "student-row",
                onClick: () => {
                  // Navigate to student edit
                  if (nav?.toStudentEdit) {
                    nav.toStudentEdit(entry.student);
                  } else {
                    window.location.hash = `#students/edit/${entry.student}`;
                  }
                },
                style: { cursor: "pointer" },
                title: "Click to view student"
              },
              React.createElement("td", null, fullName),
              React.createElement(
                "td",
                null,
                React.createElement("strong", null, studentId)
              ),
              React.createElement("td", null, email),
              React.createElement(
                "td",
                null,
                React.createElement(
                  "span",
                  {
                    className: `badge ${entry.is_active ? "badge-success" : "badge-warning"}`
                  },
                  entry.is_active ? "Active" : "Inactive"
                )
              ),
              isTeacher && React.createElement(
                "td",
                null,
                React.createElement(
                  "button",
                  {
                    className: "btn btn-sm btn-danger",
                    onClick: (e) => {
                      e.stopPropagation();
                      handleUnenroll(entry);
                    },
                    title: "Unenroll student",
                    style: { padding: "4px 8px", fontSize: "12px" }
                  },
                  React.createElement("i", { className: "fas fa-user-minus" }),
                  " Unenroll"
                )
              )
            );
          })
        )
      ) : React.createElement(
        "div",
        {
          className: "empty-state",
          style: { padding: "40px", textAlign: "center" }
        },
        React.createElement("i", { className: "fas fa-users", style: { fontSize: "48px", color: "#ccc", marginBottom: "16px" } }),
        React.createElement("p", null, "No students enrolled in this class yet."),
        isTeacher && React.createElement(
          "button",
          {
            className: "btn btn-primary",
            onClick: () => {
              if (nav?.toClassAddStudents) {
                nav.toClassAddStudents(classId);
              } else if (navigateTo && typeof navigateTo === 'function') {
                navigateTo(`classes/${classId}/add-students`);
              } else {
                window.location.hash = `#classes/${classId}/add-students`;
              }
            }
          },
          React.createElement("i", { className: "fas fa-user-plus" }),
          " Add Students"
        )
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
