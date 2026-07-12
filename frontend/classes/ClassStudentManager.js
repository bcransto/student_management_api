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

  // Batch Add modal state
  const [batchModalOpen, setBatchModalOpen] = React.useState(false);
  const [batchText, setBatchText] = React.useState("");
  const [batchLoading, setBatchLoading] = React.useState(false);
  const [batchError, setBatchError] = React.useState(null);
  const [batchResult, setBatchResult] = React.useState(null);

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
  
  // Parse the Batch Add textarea and match tokens against the already-loaded
  // student list. Auto-detects email vs student ID input (same "@" heuristic
  // as before). Matched students are split into: brand new (never enrolled),
  // re-enroll (previously enrolled, roster inactive), and already enrolled
  // (no action needed) - so previously-enrolled matches keep surfacing as a
  // re-enroll, same as the rest of the page.
  const getBatchMatches = () => {
    const tokens = parseStudentIds(batchText);
    if (tokens.length === 0) {
      return { tokens: [], emailMode: false, matched: [], notFound: [] };
    }

    const emailMode = tokens.some(id => id.includes('@'));
    const matched = [];
    const foundTokens = new Set();

    tokens.forEach(token => {
      const student = allStudents.find(s => (emailMode ? s.email : s.student_id) === token);
      if (student) {
        matched.push(student);
        foundTokens.add(token);
      }
    });

    const notFound = tokens.filter(token => !foundTokens.has(token));

    return { tokens, emailMode, matched, notFound };
  };

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

  // Closes the Google import modal. If an import already completed, return
  // to the class view (roster refetch happens naturally on that view)
  // instead of reloading the whole page.
  const closeGoogleModal = () => {
    setGoogleModalOpen(false);
    if (importResult) {
      handleBack();
    }
  };

  const openBatchModal = () => {
    setBatchModalOpen(true);
    setBatchText("");
    setBatchError(null);
    setBatchResult(null);
  };

  // Closes the Batch Add modal. If a batch enrollment already completed,
  // return to the class view (same pattern as closeGoogleModal).
  const closeBatchModal = () => {
    setBatchModalOpen(false);
    if (batchResult) {
      handleBack();
    }
  };

  const handleBatchEnroll = async () => {
    const { matched } = getBatchMatches();
    const toEnroll = matched.filter(s => !s.isEnrolled && !s.isInactive);
    const toReenroll = matched.filter(s => s.isInactive);

    if (toEnroll.length === 0 && toReenroll.length === 0) {
      return;
    }

    setBatchLoading(true);
    setBatchError(null);

    try {
      if (toEnroll.length > 0) {
        await enrollStudentIds(toEnroll.map(s => s.id));
      }
      if (toReenroll.length > 0) {
        await reactivateRosterIds(toReenroll.map(s => s.rosterId));
      }

      setBatchResult({
        enrolledCount: toEnroll.length,
        reenrolledCount: toReenroll.length
      });
    } catch (err) {
      console.error("Error batch enrolling students:", err);
      setBatchError(`Failed to enroll students: ${err.message || 'Unknown error'}`);
    } finally {
      setBatchLoading(false);
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

  // Shared enrollment API call: creates a new (active) roster entry for each
  // given student id. Used by both the checkbox "Enroll N Selected" flow and
  // the Batch Add modal so there's a single place that talks to /roster/.
  const enrollStudentIds = async (studentIds) => {
    const enrollPromises = studentIds.map(studentId =>
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
  };

  // Shared re-enrollment API call: reactivates existing (inactive) roster
  // entries. Used by both the single-student "Re-enroll" button and the
  // Batch Add modal for previously-enrolled matches.
  const reactivateRosterIds = async (rosterIds) => {
    const reactivatePromises = rosterIds.map(rosterId =>
      window.ApiModule.request(`/roster/${rosterId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true })
      })
    );
    await Promise.all(reactivatePromises);
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
      await enrollStudentIds(Array.from(selectedStudents));

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
      await reactivateRosterIds([student.rosterId]);

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

  // App-standard small toolbar button style (see CLAUDE.md)
  const smallBtnStyle = (bg) => ({
    padding: "6px 12px",
    fontSize: "14px",
    fontWeight: 500,
    borderRadius: "6px",
    border: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    color: "white",
    backgroundColor: bg,
    cursor: "pointer"
  });

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

    // Controls - single-row toolbar: search grows, buttons align right
    React.createElement(
      "div",
      {
        className: "student-manager-controls",
        style: {
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px"
        }
      },

      React.createElement("input", {
        type: "text",
        className: "search-input",
        placeholder: "Search students by name, ID, or email...",
        value: searchQuery,
        onChange: (e) => setSearchQuery(e.target.value),
        style: { flex: "1 1 240px", minWidth: "200px" }
      }),

      React.createElement(
        "button",
        {
          style: smallBtnStyle("#6b7280"),
          onClick: () => setSearchQuery("")
        },
        "Clear"
      ),

      React.createElement(
        "button",
        {
          style: smallBtnStyle("#667eea"),
          onClick: openBatchModal
        },
        React.createElement("i", { className: "fas fa-list" }),
        " Batch Add"
      ),

      React.createElement(
        "label",
        {
          className: "checkbox-label",
          style: { cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }
        },
        React.createElement("input", {
          type: "checkbox",
          checked: showInactive,
          onChange: (e) => setShowInactive(e.target.checked)
        }),
        "Show previously enrolled"
      ),

      React.createElement(
        "div",
        { style: { marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "10px" } },
        React.createElement(
          "button",
          {
            style: smallBtnStyle("#667eea"),
            onClick: openGoogleImport
          },
          React.createElement("i", { className: "fab fa-google" }),
          " Import from Google Classroom"
        ),
        selectedStudents.size > 0 && React.createElement(
          "button",
          {
            style: smallBtnStyle("#10b981"),
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
            closeGoogleModal();
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
              onClick: closeGoogleModal,
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
              onClick: handleBack
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
    ),

    // Batch Add modal
    batchModalOpen && (() => {
      const { matched, notFound, emailMode } = getBatchMatches();
      const toEnroll = matched.filter(s => !s.isEnrolled && !s.isInactive);
      const toReenroll = matched.filter(s => s.isInactive);
      const alreadyEnrolled = matched.filter(s => s.isEnrolled);
      const actionableCount = toEnroll.length + toReenroll.length;

      const matchStatus = (student) => {
        if (student.isEnrolled) return { label: "Already enrolled", color: "#6b7280" };
        if (student.isInactive) return { label: "Re-enroll", color: "#b45309" };
        return { label: "New", color: "#059669" };
      };

      return React.createElement(
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
            if (e.target === e.currentTarget && !batchLoading) {
              closeBatchModal();
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
              maxWidth: "520px",
              maxHeight: "85vh",
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
              React.createElement("i", { className: "fas fa-list", style: { marginRight: "8px" } }),
              "Batch Add Students"
            ),
            React.createElement(
              "button",
              {
                onClick: closeBatchModal,
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

          // Result summary (after a successful batch enroll)
          !batchLoading && batchResult && React.createElement(
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
              `Done: ${batchResult.enrolledCount} enrolled` +
                (batchResult.reenrolledCount ? `, ${batchResult.reenrolledCount} re-enrolled` : "")
            ),
            React.createElement(
              "button",
              {
                className: "btn btn-primary",
                style: { width: "100%" },
                onClick: closeBatchModal
              },
              "Done"
            )
          ),

          // Input + preview form (before a batch enroll has completed)
          !batchResult && React.createElement(
            "div",
            null,

            React.createElement(
              "p",
              { style: { color: "#6b7280", marginBottom: "0.75rem", fontSize: "0.9rem" } },
              "Paste student IDs or email addresses, separated by commas, spaces, or new lines."
            ),

            React.createElement("textarea", {
              rows: 6,
              value: batchText,
              onChange: (e) => setBatchText(e.target.value),
              placeholder: "e.g. 12345, 67890 or jane.doe@school.edu",
              disabled: batchLoading,
              style: {
                width: "100%",
                boxSizing: "border-box",
                padding: "0.5rem",
                fontSize: "14px",
                fontFamily: "inherit",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                marginBottom: "1rem",
                resize: "vertical"
              }
            }),

            batchError && React.createElement(
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
              batchError
            ),

            // Preview: matched students
            matched.length > 0 && React.createElement(
              "div",
              {
                style: {
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  padding: "0.5rem",
                  marginBottom: "1rem",
                  maxHeight: "220px",
                  overflowY: "auto"
                }
              },
              React.createElement(
                "div",
                { style: { fontWeight: "500", fontSize: "0.9rem", marginBottom: "0.4rem" } },
                `Matched (${matched.length})`
              ),
              matched.map((student) => {
                const status = matchStatus(student);
                return React.createElement(
                  "div",
                  {
                    key: student.id,
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.3rem 0.25rem",
                      fontSize: "0.9rem",
                      borderBottom: "1px solid #f3f4f6"
                    }
                  },
                  React.createElement(
                    "span",
                    null,
                    `${student.nickname || student.first_name} ${student.last_name}`,
                    React.createElement(
                      "span",
                      { style: { color: "#9ca3af", marginLeft: "0.5rem", fontSize: "0.8rem" } },
                      `ID: ${student.student_id}`
                    )
                  ),
                  React.createElement(
                    "span",
                    { style: { color: status.color, fontSize: "0.8rem", fontWeight: 500 } },
                    status.label
                  )
                );
              })
            ),

            // Preview: not-found tokens
            notFound.length > 0 && React.createElement(
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
              `${emailMode ? 'Emails' : 'Student IDs'} not found: ${notFound.join(", ")}`
            ),

            React.createElement(
              "button",
              {
                className: "btn btn-primary",
                style: { width: "100%" },
                disabled: actionableCount === 0 || batchLoading,
                onClick: handleBatchEnroll
              },
              React.createElement("i", {
                className: batchLoading ? "fas fa-spinner fa-spin" : "fas fa-user-plus"
              }),
              batchLoading ? " Enrolling..." : ` Enroll ${actionableCount} Students`
            )
          )
        )
      );
    })()
  );
};

// Export component
if (typeof window !== "undefined") {
  window.ClassStudentManagerComponent = ClassStudentManager;
  console.log("ClassStudentManager component loaded");
}