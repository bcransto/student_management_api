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
  const [batchMode, setBatchMode] = React.useState(false);
  const [parsedStudentIds, setParsedStudentIds] = React.useState([]);
  const [notFoundIds, setNotFoundIds] = React.useState([]);
  const [isEmailInput, setIsEmailInput] = React.useState(false);

  // Google Classroom import state
  const [googleModalOpen, setGoogleModalOpen] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [googleConnected, setGoogleConnected] = React.useState(false);
  const [googleCourses, setGoogleCourses] = React.useState([]);
  const [selectedCourse, setSelectedCourse] = React.useState(null);
  const [googleStudents, setGoogleStudents] = React.useState(null);
  const [importResult, setImportResult] = React.useState(null);
  const [googleError, setGoogleError] = React.useState(null);

  // Get current user info
  const currentUser = window.AuthModule?.getUserInfo();

  const openGoogleImport = async () => {
    setGoogleModalOpen(true);
    setGoogleLoading(true);
    setGoogleError(null);
    setSelectedCourse(null);
    setGoogleStudents(null);
    setImportResult(null);

    try {
      const response = await window.ApiModule.request('/google/courses/', { method: 'GET' });
      setGoogleConnected(response.connected);
      setGoogleCourses(response.courses || []);
    } catch (err) {
      console.error("Error fetching Google courses:", err);
      setGoogleError("Failed to reach Google Classroom. Try again or reconnect.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const connectGoogle = async () => {
    try {
      const response = await window.ApiModule.request(
        `/google/oauth-url/?next=${encodeURIComponent(`classes/${classId}/add-students`)}`,
        { method: 'GET' }
      );
      window.location.href = response.auth_url;
    } catch (err) {
      console.error("Error starting Google connection:", err);
      setGoogleError("Failed to start Google connection.");
    }
  };

  const selectGoogleCourse = async (course) => {
    setSelectedCourse(course);
    setGoogleStudents(null);
    setGoogleLoading(true);
    setGoogleError(null);

    try {
      const response = await window.ApiModule.request(
        `/google/courses/${course.id}/students/`,
        { method: 'GET' }
      );
      setGoogleStudents(response.students || []);
    } catch (err) {
      console.error("Error fetching course roster:", err);
      setGoogleError("Failed to fetch the course roster from Google Classroom.");
      setSelectedCourse(null);
    } finally {
      setGoogleLoading(false);
    }
  };

  const runGoogleImport = async () => {
    if (!selectedCourse) return;
    setGoogleLoading(true);
    setGoogleError(null);

    try {
      const response = await window.ApiModule.request('/google/import-students/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: selectedCourse.id,
          class_id: classId,
        }),
      });
      setImportResult(response);
    } catch (err) {
      console.error("Error importing students:", err);
      setGoogleError(`Import failed: ${err.message || 'Unknown error'}`);
    } finally {
      setGoogleLoading(false);
    }
  };
  
  // Parse student IDs from batch input
  const parseStudentIds = (input) => {
    if (!input) return [];
    
    // Split by whitespace (spaces, tabs, newlines) or commas
    // This regex matches one or more of any whitespace or comma
    const ids = input
      .split(/[\s,]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0);
    
    // Return unique IDs only
    return [...new Set(ids)];
  };
  
  // Watch for changes in batch mode and search query
  React.useEffect(() => {
    if (batchMode && searchQuery) {
      const parsedIds = parseStudentIds(searchQuery);
      setParsedStudentIds(parsedIds);

      // Detect if input contains email addresses (has @ symbol)
      const emailMode = parsedIds.some(id => id.includes('@'));
      setIsEmailInput(emailMode);

      // Find matching students - check email field if emails, student_id otherwise
      const matchingStudents = allStudents.filter(s => {
        const matchField = emailMode ? s.email : s.student_id;
        return parsedIds.includes(matchField) && !s.isEnrolled;
      });

      // Auto-select all found students that aren't already enrolled
      setSelectedStudents(new Set(matchingStudents.map(s => s.id)));

      // Find which IDs/emails don't match any students
      const foundIds = new Set(
        allStudents
          .filter(s => parsedIds.includes(emailMode ? s.email : s.student_id))
          .map(s => emailMode ? s.email : s.student_id)
      );
      const notFound = parsedIds.filter(id => !foundIds.has(id));
      setNotFoundIds(notFound);
    } else {
      setParsedStudentIds([]);
      setNotFoundIds([]);
      setIsEmailInput(false);
      if (batchMode === false) {
        // Clear selections when leaving batch mode
        setSelectedStudents(new Set());
      }
    }
  }, [batchMode, searchQuery, allStudents]);

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

  // After returning from the Google OAuth connect redirect, the backend
  // appends "?google=connected" to the hash on success. Detect it, clean up
  // the URL (no reload), and auto-reopen the import modal so the user isn't
  // dumped back onto a closed modal after already granting access.
  React.useEffect(() => {
    if (window.location.hash.includes("google=connected")) {
      const cleanHash = window.location.hash.split("?")[0];
      window.history.replaceState(null, "", cleanHash);
      openGoogleImport();
    }
    // Run once on mount - the marker is only ever present on initial load
    // right after the OAuth redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    
    // Filter by batch IDs/emails or search query
    if (batchMode && parsedStudentIds.length > 0) {
      // In batch mode, filter by exact ID or email match
      filtered = filtered.filter(student => {
        const matchField = isEmailInput ? student.email : student.student_id;
        return parsedStudentIds.includes(matchField);
      });
    } else if (searchQuery && !batchMode) {
      // Normal search mode
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
          placeholder: batchMode 
            ? "Paste student IDs..." 
            : "Search students by name, ID, or email...",
          value: searchQuery,
          onChange: (e) => setSearchQuery(e.target.value)
        }),
        React.createElement(
          "button",
          {
            className: "btn btn-secondary",
            onClick: () => {
              setSearchQuery("");
              if (batchMode) {
                // Reset batch mode when clearing in batch mode
                setBatchMode(false);
              }
            }
          },
          "Clear"
        ),
        React.createElement(
          "label",
          { 
            className: "checkbox-label",
            style: { marginLeft: "1rem", cursor: "pointer" }
          },
          React.createElement("input", {
            type: "checkbox",
            checked: batchMode,
            onChange: (e) => {
              setBatchMode(e.target.checked);
              // Clear search when toggling modes
              setSearchQuery("");
              setSelectedStudents(new Set());
            }
          }),
          " Batch Add"
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
        React.createElement(
          "button",
          {
            className: "btn btn-secondary",
            onClick: openGoogleImport,
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }
          },
          React.createElement("i", { className: "fab fa-google" }),
          " Import from Google Classroom"
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
          batchMode && React.createElement(
            "span",
            { 
              className: "badge badge-info",
              style: { 
                backgroundColor: "#3b82f6",
                color: "white",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.25rem",
                fontSize: "0.875rem",
                marginLeft: "0.5rem"
              }
            },
            "Batch Mode Active"
          ),
          !batchMode && availableStudents.length > 0 && React.createElement(
            "button",
            {
              className: "btn btn-link btn-sm",
              onClick: handleSelectAll
            },
            selectedStudents.size === availableStudents.length ? "Deselect All" : "Select All"
          )
        ),
        
        // Show not found IDs message when in batch mode
        batchMode && notFoundIds.length > 0 && React.createElement(
          "div",
          {
            style: {
              padding: "0.75rem",
              backgroundColor: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: "6px",
              marginBottom: "1rem",
              color: "#dc2626",
              fontSize: "0.9rem"
            }
          },
          React.createElement("i", { 
            className: "fas fa-exclamation-triangle",
            style: { marginRight: "0.5rem" }
          }),
          `${isEmailInput ? 'Emails' : 'Student IDs'} not found: ${notFoundIds.join(", ")}`
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
                    onChange: () => handleToggleStudent(student.id),
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
    ),

    // Google Classroom import modal
    googleModalOpen && React.createElement(
      "div",
      {
        style: {
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000
        },
        onClick: (e) => {
          if (e.target === e.currentTarget && !googleLoading) {
            setGoogleModalOpen(false);
            if (importResult) window.location.reload();
          }
        }
      },
      React.createElement(
        "div",
        {
          style: {
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "1.5rem",
            width: "90%",
            maxWidth: "480px",
            maxHeight: "80vh",
            overflowY: "auto",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
          }
        },

        // Modal header
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1rem"
            }
          },
          React.createElement(
            "h2",
            { style: { margin: 0, fontSize: "1.25rem" } },
            React.createElement("i", { className: "fab fa-google", style: { marginRight: "8px" } }),
            "Import from Google Classroom"
          ),
          React.createElement(
            "button",
            {
              onClick: () => {
                setGoogleModalOpen(false);
                if (importResult) window.location.reload();
              },
              style: {
                border: "none",
                background: "none",
                fontSize: "1.25rem",
                cursor: "pointer",
                color: "#6b7280"
              }
            },
            "×"
          )
        ),

        // Error banner
        googleError && React.createElement(
          "div",
          {
            style: {
              padding: "0.75rem",
              backgroundColor: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: "6px",
              marginBottom: "1rem",
              color: "#dc2626",
              fontSize: "0.9rem"
            }
          },
          googleError
        ),

        // Loading state
        googleLoading && React.createElement(
          "div",
          { style: { textAlign: "center", padding: "1.5rem", color: "#6b7280" } },
          React.createElement("div", { className: "spinner", style: { margin: "0 auto 0.75rem" } }),
          "Talking to Google Classroom..."
        ),

        // Import result summary
        !googleLoading && importResult && React.createElement(
          "div",
          null,
          React.createElement(
            "div",
            {
              style: {
                padding: "0.75rem",
                backgroundColor: "#d1fae5",
                border: "1px solid #6ee7b7",
                borderRadius: "6px",
                marginBottom: "1rem",
                color: "#065f46"
              }
            },
            `Import complete: ${importResult.enrolled.length} enrolled` +
              (importResult.created.length ? `, ${importResult.created.length} new students created` : "") +
              (importResult.reenrolled.length ? `, ${importResult.reenrolled.length} re-enrolled` : "") +
              (importResult.already_enrolled.length ? `, ${importResult.already_enrolled.length} already enrolled` : "") +
              (importResult.skipped.length ? `, ${importResult.skipped.length} skipped` : "")
          ),
          importResult.created.length > 0 && React.createElement(
            "div",
            { style: { fontSize: "0.9rem", marginBottom: "0.75rem" } },
            React.createElement("strong", null, "New students: "),
            importResult.created.map((s) => s.name).join(", ")
          ),
          importResult.skipped.length > 0 && React.createElement(
            "div",
            { style: { fontSize: "0.9rem", marginBottom: "0.75rem", color: "#b45309" } },
            React.createElement("strong", null, "Skipped: "),
            importResult.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")
          ),
          React.createElement(
            "button",
            {
              className: "btn btn-primary",
              style: { width: "100%" },
              onClick: () => window.location.reload()
            },
            "Done"
          )
        ),

        // Not connected: prompt to connect
        !googleLoading && !importResult && !googleConnected && React.createElement(
          "div",
          { style: { textAlign: "center", padding: "0.5rem 0" } },
          React.createElement(
            "p",
            { style: { color: "#6b7280", marginBottom: "1rem" } },
            "Connect your Google account to import students from your Classroom rosters."
          ),
          React.createElement(
            "button",
            {
              className: "btn btn-primary",
              onClick: connectGoogle
            },
            React.createElement("i", { className: "fab fa-google" }),
            " Connect Google Classroom"
          )
        ),

        // Connected, no course selected: course list
        !googleLoading && !importResult && googleConnected && !selectedCourse && React.createElement(
          "div",
          null,
          React.createElement(
            "p",
            { style: { color: "#6b7280", marginBottom: "0.75rem", fontSize: "0.9rem" } },
            "Choose a course to import students from:"
          ),
          googleCourses.length === 0
            ? React.createElement(
                "p",
                { style: { color: "#6b7280", textAlign: "center" } },
                "No active courses found."
              )
            : googleCourses.map((course) =>
                React.createElement(
                  "div",
                  {
                    key: course.id,
                    onClick: () => selectGoogleCourse(course),
                    style: {
                      padding: "0.75rem",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                      marginBottom: "0.5rem",
                      cursor: "pointer"
                    },
                    onMouseEnter: (e) => (e.currentTarget.style.backgroundColor = "#f9fafb"),
                    onMouseLeave: (e) => (e.currentTarget.style.backgroundColor = "white")
                  },
                  React.createElement("div", { style: { fontWeight: "500" } }, course.name),
                  course.section && React.createElement(
                    "div",
                    { style: { fontSize: "0.85rem", color: "#6b7280" } },
                    course.section
                  )
                )
              )
        ),

        // Course selected: roster preview + import button
        !googleLoading && !importResult && selectedCourse && googleStudents && React.createElement(
          "div",
          null,
          React.createElement(
            "button",
            {
              onClick: () => {
                setSelectedCourse(null);
                setGoogleStudents(null);
              },
              style: {
                border: "none",
                background: "none",
                color: "#6366f1",
                cursor: "pointer",
                padding: 0,
                marginBottom: "0.75rem",
                fontSize: "0.9rem"
              }
            },
            "← Back to courses"
          ),
          React.createElement(
            "p",
            { style: { fontWeight: "500", marginBottom: "0.5rem" } },
            `${selectedCourse.name}: ${googleStudents.length} students`
          ),
          React.createElement(
            "div",
            {
              style: {
                maxHeight: "240px",
                overflowY: "auto",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                padding: "0.5rem",
                marginBottom: "1rem"
              }
            },
            googleStudents.length === 0
              ? React.createElement("p", { style: { color: "#6b7280", textAlign: "center" } }, "No students in this course.")
              : googleStudents.map((s) =>
                  React.createElement(
                    "div",
                    {
                      key: s.google_user_id,
                      style: {
                        padding: "0.4rem 0.5rem",
                        fontSize: "0.9rem",
                        borderBottom: "1px solid #f3f4f6"
                      }
                    },
                    React.createElement("span", null, s.full_name || `${s.first_name} ${s.last_name}`),
                    React.createElement(
                      "span",
                      { style: { color: "#9ca3af", marginLeft: "0.5rem", fontSize: "0.8rem" } },
                      s.email || "no email visible"
                    )
                  )
                )
          ),
          googleStudents.length > 0 && React.createElement(
            "button",
            {
              className: "btn btn-primary",
              style: { width: "100%" },
              onClick: runGoogleImport
            },
            React.createElement("i", { className: "fas fa-user-plus" }),
            ` Import ${googleStudents.length} Students`
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