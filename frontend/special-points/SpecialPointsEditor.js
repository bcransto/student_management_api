// frontend/special-points/SpecialPointsEditor.js
// List-based special points editor

const { useState, useEffect } = React;

const SpecialPointsEditor = ({ classId, onBack, navigateTo }) => {
  // Core state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Data state
  const [classInfo, setClassInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [pointTotals, setPointTotals] = useState({}); // email -> {points, first_name, last_name}
  const [pointsLoading, setPointsLoading] = useState(false);
  const [awardInputs, setAwardInputs] = useState({}); // rosterId -> number
  const [notFoundEmails, setNotFoundEmails] = useState([]); // emails not in Cranston Commons
  const [connectionError, setConnectionError] = useState(null); // null or error message string

  // Load initial data
  useEffect(() => {
    if (classId) {
      loadClassData();
    }
  }, [classId]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue =
          "You have unsaved point changes. Are you sure you want to leave?";
        return "You have unsaved point changes. Are you sure you want to leave?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Load class data and fetch point totals
  const loadClassData = async () => {
    try {
      setLoading(true);
      setConnectionError(false);

      const classData = await window.ApiModule.request(`/classes/${classId}/`);
      setClassInfo(classData);

      if (classData.roster && Array.isArray(classData.roster)) {
        // Sort students alphabetically by last name, then first name
        const sortedStudents = classData.roster.sort((a, b) => {
          const lastNameCompare = (a.student_last_name || "").localeCompare(
            b.student_last_name || ""
          );
          if (lastNameCompare !== 0) return lastNameCompare;
          return (a.student_first_name || "").localeCompare(
            b.student_first_name || ""
          );
        });
        setStudents(sortedStudents);

        // Initialize empty award inputs
        const defaultInputs = {};
        sortedStudents.forEach((roster) => {
          defaultInputs[roster.id] = "";
        });
        setAwardInputs(defaultInputs);

        // Fetch point totals from Cranston Commons
        await fetchPointTotals(sortedStudents);
      }
    } catch (error) {
      console.error("Failed to load class data:", error);
      alert("Failed to load class information. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch point totals for all students with emails
  const fetchPointTotals = async (studentList) => {
    const emails = studentList
      .map((r) => r.student_email)
      .filter((email) => email && email.trim());

    if (emails.length === 0) {
      setPointTotals({});
      return;
    }

    try {
      setPointsLoading(true);
      setConnectionError(null);

      const response = await window.ApiModule.request(
        "/special-points/fetch/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails }),
        }
      );

      if (response.error) {
        setConnectionError(response.error);
        setPointTotals({});
        return;
      }

      setPointTotals(response.students || {});
      setNotFoundEmails(response.not_found || []);
    } catch (error) {
      console.error("Failed to fetch point totals:", error);
      setConnectionError("Unable to connect to Cranston Commons");
      setPointTotals({});
    } finally {
      setPointsLoading(false);
    }
  };

  // Handle award input change
  const handleAwardChange = (rosterId, value) => {
    const newInputs = { ...awardInputs, [rosterId]: value };
    setAwardInputs(newInputs);

    // Check for unsaved changes (any non-zero, non-empty value)
    const hasChanges = Object.values(newInputs).some(
      (v) => v !== "" && v !== "0" && Number(v) !== 0
    );
    setHasUnsavedChanges(hasChanges);
  };

  // Save awards
  const handleSave = async () => {
    if (!hasUnsavedChanges) return;

    try {
      setSaving(true);

      // Build awards array from non-zero inputs
      const awards = [];
      students.forEach((roster) => {
        const value = Number(awardInputs[roster.id]);
        if (value !== 0 && !isNaN(value) && roster.student_email) {
          awards.push({
            email: roster.student_email,
            points: value,
            reason: "",
          });
        }
      });

      if (awards.length === 0) {
        setSaving(false);
        return;
      }

      const response = await window.ApiModule.request(
        "/special-points/award/batch/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ awards }),
        }
      );

      if (response.error) {
        alert("Failed to save: " + response.error);
        setSaving(false);
        return;
      }

      // Update totals from response
      if (response.results && Array.isArray(response.results)) {
        const newTotals = { ...pointTotals };
        response.results.forEach((result) => {
          if (newTotals[result.email]) {
            newTotals[result.email].points = result.new_total;
          } else {
            newTotals[result.email] = { points: result.new_total };
          }
        });
        setPointTotals(newTotals);
      }

      // Clear inputs
      const clearedInputs = {};
      students.forEach((roster) => {
        clearedInputs[roster.id] = "";
      });
      setAwardInputs(clearedInputs);
      setHasUnsavedChanges(false);

      alert("Points saved successfully!");
    } catch (error) {
      console.error("Failed to save points:", error);
      alert("Failed to save points. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (
        !confirm("You have unsaved changes. Do you want to leave without saving?")
      ) {
        return;
      }
    }

    if (onBack) {
      onBack();
    } else if (navigateTo) {
      navigateTo("special-points");
    } else {
      window.location.hash = "#special-points";
    }
  };

  // Format student name
  const formatStudentDisplay = (roster) => {
    const nickname = roster.student_nickname || roster.student_first_name;
    return `${nickname} ${roster.student_last_name}`;
  };

  // Get points display for a student
  const getPointsDisplay = (roster) => {
    if (!roster.student_email || !roster.student_email.trim()) {
      return React.createElement(
        "span",
        { style: { color: "#9ca3af", fontStyle: "italic" } },
        "No email"
      );
    }

    if (connectionError) {
      return React.createElement(
        "span",
        { style: { color: "#ef4444", fontStyle: "italic" } },
        "Connection error"
      );
    }

    if (pointsLoading) {
      return React.createElement(
        "span",
        { style: { color: "#6b7280" } },
        React.createElement("i", {
          className: "fas fa-spinner fa-spin",
          style: { marginRight: "0.5rem" },
        }),
        "Loading..."
      );
    }

    if (notFoundEmails.includes(roster.student_email)) {
      return React.createElement(
        "span",
        { style: { color: "#f59e0b", fontStyle: "italic" } },
        "Not registered"
      );
    }

    const studentData = pointTotals[roster.student_email];
    if (studentData) {
      return React.createElement(
        "span",
        { style: { fontWeight: "600", color: "#6366f1", fontSize: "1.1rem" } },
        String(studentData.points)
      );
    }

    return React.createElement(
      "span",
      { style: { color: "#9ca3af" } },
      "—"
    );
  };

  // Render loading state
  if (loading) {
    return React.createElement(
      "div",
      { className: "sp-editor-container" },
      React.createElement(
        "div",
        { className: "loading-spinner" },
        React.createElement("i", {
          className: "fas fa-spinner fa-spin fa-3x",
        }),
        React.createElement("p", null, "Loading special points...")
      )
    );
  }

  // Render main component
  return React.createElement(
    "div",
    { className: "sp-editor-container" },

    // Header
    React.createElement(
      "div",
      { className: "sp-editor-header" },

      // Back button and title
      React.createElement(
        "div",
        { className: "sp-header-left" },
        React.createElement(
          "button",
          {
            className: "btn btn-secondary btn-back",
            onClick: handleBack,
          },
          React.createElement("i", { className: "fas fa-arrow-left" }),
          " Back"
        ),
        React.createElement(
          "div",
          { className: "sp-title" },
          React.createElement("h1", null, classInfo?.name || "Class"),
          React.createElement(
            "span",
            { className: "sp-subtitle" },
            "Special Points"
          )
        )
      ),

      // Save button
      React.createElement(
        "div",
        { className: "sp-header-right" },
        React.createElement(
          "button",
          {
            className: `btn btn-primary btn-save ${
              hasUnsavedChanges ? "has-changes" : ""
            }`,
            onClick: handleSave,
            disabled: saving || !hasUnsavedChanges,
          },
          saving
            ? React.createElement("i", {
                className: "fas fa-spinner fa-spin",
              })
            : React.createElement("i", { className: "fas fa-save" }),
          saving ? " Saving..." : " Save"
        )
      )
    ),

    // Connection error banner
    connectionError &&
      React.createElement(
        "div",
        {
          style: {
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            padding: "0.75rem 1.5rem",
            margin: "0 1.5rem 0",
            color: "#991b1b",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          },
        },
        React.createElement("i", { className: "fas fa-exclamation-triangle" }),
        connectionError + ". Point totals are unavailable."
      ),

    // Table
    React.createElement(
      "div",
      { className: "sp-editor-body" },

      // Column headers
      React.createElement(
        "div",
        { className: "sp-table-header" },
        React.createElement("div", { className: "col-student" }, "Student"),
        React.createElement(
          "div",
          { className: "col-points" },
          "Total Points"
        ),
        React.createElement("div", { className: "col-award" }, "Award")
      ),

      // Student rows
      React.createElement(
        "div",
        { className: "sp-table-body" },
        students.map((roster, index) => {
          const hasEmail =
            roster.student_email && roster.student_email.trim();

          return React.createElement(
            "div",
            {
              key: roster.id,
              className: `sp-row ${index % 2 === 0 ? "even" : "odd"}`,
            },

            // Student name
            React.createElement(
              "div",
              { className: "col-student" },
              React.createElement(
                "span",
                { className: "student-name" },
                formatStudentDisplay(roster)
              ),
              React.createElement(
                "span",
                { className: "student-id" },
                ` (${roster.student_id})`
              )
            ),

            // Total points
            React.createElement(
              "div",
              { className: "col-points" },
              getPointsDisplay(roster)
            ),

            // Award input
            React.createElement(
              "div",
              { className: "col-award" },
              React.createElement("input", {
                type: "number",
                className: "award-input",
                placeholder: "0",
                value: awardInputs[roster.id] || "",
                disabled: !hasEmail || connectionError,
                onChange: (e) => handleAwardChange(roster.id, e.target.value),
              })
            )
          );
        })
      )
    ),

    // Empty state
    students.length === 0 &&
      React.createElement(
        "div",
        { className: "empty-state" },
        React.createElement("i", { className: "fas fa-user-slash fa-3x" }),
        React.createElement("h3", null, "No Students Enrolled"),
        React.createElement(
          "p",
          null,
          "This class has no students enrolled yet."
        )
      )
  );
};

window.SpecialPointsEditor = SpecialPointsEditor;
console.log(
  "SpecialPointsEditor component loaded and exported to window.SpecialPointsEditor"
);
