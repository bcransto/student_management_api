// ClassStudentManager.js - Component for adding/managing students in a class
console.log("Loading ClassStudentManager component...");

const ClassStudentManager = ({ classId, navigateTo }) => {
  // Use NavigationService if available, fallback to navigateTo prop
  const nav = window.NavigationService || null;
  const [classDetails, setClassDetails] = React.useState(null);
  const [allStudents, setAllStudents] = React.useState([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedStudents, setSelectedStudents] = React.useState(new Set());
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [showInactive, setShowInactive] = React.useState(false);
  
  // Get current user info
  const currentUser = window.AuthModule?.getUserInfo();

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch class details
        const classResponse = await window.ApiModule.request(`/classes/${classId}/`, {
          method: 'GET'
        });
        setClassDetails(classResponse);
        
        // Fetch all students
        const studentsResponse = await window.ApiModule.request('/students/', {
          method: 'GET'
        });
        
        // Process students to mark which ones are already enrolled
        const studentsData = studentsResponse.results || studentsResponse;
        const processedStudents = studentsData.map(student => {
          // Check if student is in current roster (active or inactive)
          const rosterEntry = classResponse.roster?.find(r => r.student === student.id);
          return {
            ...student,
            isEnrolled: rosterEntry && rosterEntry.is_active,
            isInactive: rosterEntry && !rosterEntry.is_active,
            rosterId: rosterEntry?.id
          };
        });
        
        setAllStudents(processedStudents);
        setError(null);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    if (classId) {
      fetchData();
    }
  }, [classId]);

  const handleBack = () => {
    if (nav?.toClassView) {
      nav.toClassView(classId);
    } else if (navigateTo && typeof navigateTo === 'function') {
      navigateTo(`classes/view/${classId}`);
    } else {
      window.location.hash = Router?.buildHash ? Router.buildHash('classView', {id: classId}) : `#classes/view/${classId}`;
    }
  };

  const handleToggleStudent = (studentId) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const handleSelectAll = () => {
    const filteredStudents = getFilteredStudents();
    const availableStudents = filteredStudents.filter(s => !s.isEnrolled);
    
    if (selectedStudents.size === availableStudents.length) {
      // Deselect all
      setSelectedStudents(new Set());
    } else {
      // Select all available
      setSelectedStudents(new Set(availableStudents.map(s => s.id)));
    }
  };

  const handleEnrollSelected = async () => {
    if (selectedStudents.size === 0) {
      alert("Please select at least one student to enroll");
      return;
    }

    const studentNames = Array.from(selectedStudents).map(id => {
      const student = allStudents.find(s => s.id === id);
      return student?.first_name + " " + student?.last_name;
    }).join(", ");

    if (!window.confirm(`Enroll ${selectedStudents.size} student(s) in ${classDetails?.name}?\n\nStudents: ${studentNames}`)) {
      return;
    }

    try {
      // Enroll each selected student
      const enrollPromises = Array.from(selectedStudents).map(studentId => 
        window.ApiModule.request('/roster/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            class_assigned: classId,
            student: studentId,
            is_active: true
          })
        })
      );

      await Promise.all(enrollPromises);
      
      alert(`Successfully enrolled ${selectedStudents.size} student(s)`);
      
      // Navigate back to class view
      handleBack();
    } catch (err) {
      console.error("Error enrolling students:", err);
      alert(`Failed to enroll students: ${err.message || 'Unknown error'}`);
    }
  };

  const handleReactivateStudent = async (student) => {
    if (!window.confirm(`Re-enroll ${student.first_name} ${student.last_name} in this class?`)) {
      return;
    }

    try {
      // Reactivate the existing roster entry
      await window.ApiModule.request(`/roster/${student.rosterId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true })
      });
      
      alert(`Successfully re-enrolled ${student.first_name} ${student.last_name}`);
      
      // Refresh data
      window.location.reload();
    } catch (err) {
      console.error("Error reactivating student:", err);
      alert(`Failed to re-enroll student: ${err.message || 'Unknown error'}`);
    }
  };

  const getFilteredStudents = () => {
    let filtered = allStudents;
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(student => 
        student.first_name?.toLowerCase().includes(query) ||
        student.last_name?.toLowerCase().includes(query) ||
        student.nickname?.toLowerCase().includes(query) ||
        student.student_id?.toLowerCase().includes(query) ||
        student.email?.toLowerCase().includes(query)
      );
    }
    
    // Filter by enrollment status
    if (!showInactive) {
      filtered = filtered.filter(s => !s.isInactive);
    }
    
    return filtered;
  };

  if (loading) {
    return React.createElement(
      "div",
      { className: "loading-container" },
      React.createElement("div", { className: "spinner" }),
      React.createElement("p", null, "Loading students...")
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
        "Back to Class"
      )
    );
  }

  const filteredStudents = getFilteredStudents();
  const availableStudents = filteredStudents.filter(s => !s.isEnrolled);
  const enrolledStudents = filteredStudents.filter(s => s.isEnrolled);
  const inactiveStudents = filteredStudents.filter(s => s.isInactive);

  return React.createElement(
    "div",
    { className: "student-manager-container" },
    
    // Header
    React.createElement(
      "div",
      { className: "student-manager-header" },
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
        { className: "student-manager-title-section" },
        React.createElement("h1", null, "Add Students"),
        React.createElement("p", null, `${classDetails?.name || 'Class'}`)
      )
    ),

    // Controls
    React.createElement(
      "div",
      { className: "student-manager-controls" },
      
      // Search bar
      React.createElement(
        "div",
        { className: "search-section" },
        React.createElement("input", {
          type: "text",
          className: "search-input",
          placeholder: "Search students by name, ID, or email...",
          value: searchQuery,
          onChange: (e) => setSearchQuery(e.target.value)
        }),
        React.createElement(
          "button",
          {
            className: "btn btn-secondary",
            onClick: () => setSearchQuery("")
          },
          "Clear"
        )
      ),

      // Filters and actions
      React.createElement(
        "div",
        { className: "filter-actions" },
        React.createElement(
          "label",
          { className: "checkbox-label" },
          React.createElement("input", {
            type: "checkbox",
            checked: showInactive,
            onChange: (e) => setShowInactive(e.target.checked)
          }),
          " Show previously enrolled"
        ),
        selectedStudents.size > 0 && React.createElement(
          "button",
          {
            className: "btn btn-primary",
            onClick: handleEnrollSelected
          },
          React.createElement("i", { className: "fas fa-user-plus" }),
          ` Enroll ${selectedStudents.size} Selected`
        )
      )
    ),

    // Student lists
    React.createElement(
      "div",
      { className: "student-lists" },
      
      // Available students
      React.createElement(
        "div",
        { className: "student-list-section" },
        React.createElement(
          "div",
          { className: "section-header" },
          React.createElement("h2", null, "Available Students"),
          React.createElement("span", { className: "count-badge" }, `${availableStudents.length} students`),
          availableStudents.length > 0 && React.createElement(
            "button",
            {
              className: "btn btn-link btn-sm",
              onClick: handleSelectAll
            },
            selectedStudents.size === availableStudents.length ? "Deselect All" : "Select All"
          )
        ),
        
        React.createElement(
          "div",
          { className: "student-list" },
          availableStudents.length === 0 
            ? React.createElement("p", { className: "no-students" }, "No available students found")
            : availableStudents.map(student => 
                React.createElement(
                  "div",
                  { 
                    key: student.id,
                    className: `student-item ${selectedStudents.has(student.id) ? 'selected' : ''}`,
                    onClick: () => handleToggleStudent(student.id)
                  },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: selectedStudents.has(student.id),
                    onChange: () => {},
                    onClick: (e) => e.stopPropagation()
                  }),
                  React.createElement(
                    "div",
                    { className: "student-info" },
                    React.createElement(
                      "div",
                      { className: "student-name" },
                      `${student.nickname || student.first_name} ${student.last_name}`
                    ),
                    React.createElement(
                      "div",
                      { className: "student-details" },
                      `ID: ${student.student_id}`,
                      student.email && ` • ${student.email}`
                    )
                  )
                )
              )
        )
      ),

      // Already enrolled students
      enrolledStudents.length > 0 && React.createElement(
        "div",
        { className: "student-list-section enrolled-section" },
        React.createElement(
          "div",
          { className: "section-header" },
          React.createElement("h2", null, "Currently Enrolled"),
          React.createElement("span", { className: "count-badge success" }, `${enrolledStudents.length} students`)
        ),
        React.createElement(
          "div",
          { className: "student-list" },
          enrolledStudents.map(student => 
            React.createElement(
              "div",
              { 
                key: student.id,
                className: "student-item enrolled"
              },
              React.createElement("i", { 
                className: "fas fa-check-circle",
                style: { color: "#10b981" }
              }),
              React.createElement(
                "div",
                { className: "student-info" },
                React.createElement(
                  "div",
                  { className: "student-name" },
                  `${student.nickname || student.first_name} ${student.last_name}`
                ),
                React.createElement(
                  "div",
                  { className: "student-details" },
                  `ID: ${student.student_id} • Already enrolled`
                )
              )
            )
          )
        )
      ),

      // Inactive students (if showing)
      showInactive && inactiveStudents.length > 0 && React.createElement(
        "div",
        { className: "student-list-section inactive-section" },
        React.createElement(
          "div",
          { className: "section-header" },
          React.createElement("h2", null, "Previously Enrolled"),
          React.createElement("span", { className: "count-badge warning" }, `${inactiveStudents.length} students`)
        ),
        React.createElement(
          "div",
          { className: "student-list" },
          inactiveStudents.map(student => 
            React.createElement(
              "div",
              { 
                key: student.id,
                className: "student-item inactive"
              },
              React.createElement("i", { 
                className: "fas fa-user-slash",
                style: { color: "#ef4444" }
              }),
              React.createElement(
                "div",
                { className: "student-info" },
                React.createElement(
                  "div",
                  { className: "student-name" },
                  `${student.nickname || student.first_name} ${student.last_name}`
                ),
                React.createElement(
                  "div",
                  { className: "student-details" },
                  `ID: ${student.student_id} • Previously enrolled`
                )
              ),
              React.createElement(
                "button",
                {
                  className: "btn btn-sm btn-success",
                  onClick: (e) => {
                    e.stopPropagation();
                    handleReactivateStudent(student);
                  }
                },
                "Re-enroll"
              )
            )
          )
        )
      )
    )
  );
};

// Export component
if (typeof window !== "undefined") {
  window.ClassStudentManagerComponent = ClassStudentManager;
  console.log("ClassStudentManager component loaded");
}