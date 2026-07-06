// WorkspaceImportModal.js - Bulk-create students from the Google Workspace directory
// Flow: cohort list (by email year-prefix) -> preview with New/Exists badges -> import
console.log("Loading WorkspaceImportModal component...");

const WorkspaceImportModal = ({ onClose, onImported }) => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [reconnectUrl, setReconnectUrl] = React.useState(null);
  const [cohorts, setCohorts] = React.useState(null);
  const [selectedCohort, setSelectedCohort] = React.useState(null);
  const [students, setStudents] = React.useState(null);
  const [importResult, setImportResult] = React.useState(null);

  React.useEffect(() => {
    const loadCohorts = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await window.ApiModule.request('/google/directory-cohorts/', { method: 'GET' });
        if (response.needs_reconnect) {
          setReconnectUrl(response.auth_url);
        } else {
          setCohorts(response.cohorts || []);
        }
      } catch (err) {
        console.error("Error fetching directory cohorts:", err);
        // A 400 not-connected response also carries auth_url in its body,
        // but ApiModule surfaces it as an error - show a generic reconnect path
        setError("Couldn't reach the Workspace directory. Connect Google below, or try again.");
        try {
          const oauthResponse = await window.ApiModule.request(
            `/google/oauth-url/?next=${encodeURIComponent('students')}`,
            { method: 'GET' }
          );
          setReconnectUrl(oauthResponse.auth_url);
        } catch (oauthErr) {
          console.error("Error fetching oauth url:", oauthErr);
        }
      } finally {
        setLoading(false);
      }
    };
    loadCohorts();
  }, []);

  // Rough grade label for a cohort: prefix = year the cohort finishes 8th grade.
  // School years roll over in July.
  const gradeLabel = (cohort) => {
    const now = new Date();
    const schoolYearEnd = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    const grade = 8 - (parseInt(`20${cohort}`, 10) - schoolYearEnd);
    if (grade < -1 || grade > 8) return null;
    if (grade === 0) return "Kindergarten";
    if (grade < 0) return "Pre-K";
    return `Grade ${grade}`;
  };

  const selectCohort = async (cohort) => {
    setSelectedCohort(cohort);
    setStudents(null);
    setLoading(true);
    setError(null);
    try {
      const response = await window.ApiModule.request(
        `/google/directory-students/?cohort=${cohort.cohort}`,
        { method: 'GET' }
      );
      setStudents(response.students || []);
    } catch (err) {
      console.error("Error fetching cohort students:", err);
      setError("Failed to fetch the cohort's students.");
      setSelectedCohort(null);
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    if (!selectedCohort) return;
    setLoading(true);
    setError(null);
    try {
      const response = await window.ApiModule.request('/google/import-directory-students/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort: selectedCohort.cohort }),
      });
      setImportResult(response);
    } catch (err) {
      console.error("Error importing directory students:", err);
      setError(`Import failed: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const newCount = students ? students.filter((s) => !s.exists).length : 0;

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
        if (e.target === e.currentTarget && !loading) {
          importResult ? onImported() : onClose();
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
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
        }
      },

      // Header
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
          "Import from Workspace"
        ),
        React.createElement(
          "button",
          {
            onClick: () => (importResult ? onImported() : onClose()),
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
      error && React.createElement(
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
        error
      ),

      // Loading state
      loading && React.createElement(
        "div",
        { style: { textAlign: "center", padding: "1.5rem", color: "#6b7280" } },
        React.createElement("div", { className: "spinner", style: { margin: "0 auto 0.75rem" } }),
        "Talking to Google Workspace..."
      ),

      // Reconnect prompt
      !loading && !importResult && reconnectUrl && React.createElement(
        "div",
        { style: { textAlign: "center", padding: "0.5rem 0" } },
        React.createElement(
          "p",
          { style: { color: "#6b7280", marginBottom: "1rem" } },
          "Google needs to grant directory access before importing."
        ),
        React.createElement(
          "button",
          {
            className: "btn btn-primary",
            onClick: () => { window.location.href = reconnectUrl; }
          },
          React.createElement("i", { className: "fab fa-google" }),
          " Reconnect Google"
        )
      ),

      // Import result summary
      !loading && importResult && React.createElement(
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
          `Import complete: ${importResult.created.length} created` +
            (importResult.existing.length ? `, ${importResult.existing.length} already in the system` : "") +
            (importResult.skipped.length ? `, ${importResult.skipped.length} skipped` : "")
        ),
        importResult.created.length > 0 && React.createElement(
          "div",
          { style: { fontSize: "0.9rem", marginBottom: "0.75rem" } },
          React.createElement("strong", null, "Created: "),
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
            onClick: onImported
          },
          "Done"
        )
      ),

      // Cohort list
      !loading && !importResult && !reconnectUrl && cohorts && !selectedCohort && React.createElement(
        "div",
        null,
        React.createElement(
          "p",
          { style: { color: "#6b7280", marginBottom: "0.75rem", fontSize: "0.9rem" } },
          "Choose a cohort (graduation-year email prefix) to import:"
        ),
        cohorts.length === 0
          ? React.createElement(
              "p",
              { style: { color: "#6b7280", textAlign: "center" } },
              "No student cohorts found in the directory."
            )
          : cohorts.map((cohort) =>
              React.createElement(
                "div",
                {
                  key: cohort.cohort,
                  onClick: () => selectCohort(cohort),
                  style: {
                    padding: "0.75rem",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    marginBottom: "0.5rem",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  },
                  onMouseEnter: (e) => (e.currentTarget.style.backgroundColor = "#f9fafb"),
                  onMouseLeave: (e) => (e.currentTarget.style.backgroundColor = "white")
                },
                React.createElement(
                  "div",
                  null,
                  React.createElement("div", { style: { fontWeight: "500" } }, `Class of 20${cohort.cohort}`),
                  gradeLabel(cohort.cohort) && React.createElement(
                    "div",
                    { style: { fontSize: "0.85rem", color: "#6b7280" } },
                    `${gradeLabel(cohort.cohort)} this school year`
                  )
                ),
                React.createElement(
                  "span",
                  { style: { fontSize: "0.9rem", color: "#6b7280" } },
                  `${cohort.count} students`
                )
              )
            )
      ),

      // Cohort selected: student preview + import button
      !loading && !importResult && selectedCohort && students && React.createElement(
        "div",
        null,
        React.createElement(
          "button",
          {
            onClick: () => {
              setSelectedCohort(null);
              setStudents(null);
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
          "← Back to cohorts"
        ),
        React.createElement(
          "p",
          { style: { fontWeight: "500", marginBottom: "0.5rem" } },
          `Class of 20${selectedCohort.cohort}: ${students.length} students (${newCount} new)`
        ),
        React.createElement(
          "div",
          {
            style: {
              maxHeight: "280px",
              overflowY: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              padding: "0.5rem",
              marginBottom: "1rem"
            }
          },
          students.length === 0
            ? React.createElement("p", { style: { color: "#6b7280", textAlign: "center" } }, "No students in this cohort.")
            : students.map((s) =>
                React.createElement(
                  "div",
                  {
                    key: s.google_user_id || s.email,
                    style: {
                      padding: "0.4rem 0.5rem",
                      fontSize: "0.9rem",
                      borderBottom: "1px solid #f3f4f6",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }
                  },
                  React.createElement(
                    "span",
                    null,
                    `${s.first_name} ${s.last_name}`,
                    React.createElement(
                      "span",
                      { style: { color: "#9ca3af", marginLeft: "0.5rem", fontSize: "0.8rem" } },
                      s.student_id ? `ID ${s.student_id}` : s.email
                    )
                  ),
                  React.createElement(
                    "span",
                    {
                      style: {
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        backgroundColor: s.exists ? "#f3f4f6" : "#d1fae5",
                        color: s.exists ? "#6b7280" : "#065f46"
                      }
                    },
                    s.exists ? "Exists" : "New"
                  )
                )
              )
        ),
        students.length > 0 && React.createElement(
          "button",
          {
            className: "btn btn-primary",
            style: { width: "100%" },
            onClick: runImport,
            disabled: newCount === 0,
            title: newCount === 0 ? "Everyone in this cohort is already in the system" : undefined
          },
          React.createElement("i", { className: "fas fa-user-plus" }),
          newCount === 0 ? " All students already exist" : ` Import ${newCount} New Students`
        )
      )
    )
  );
};

// Export component
if (typeof window !== "undefined") {
  window.WorkspaceImportModal = WorkspaceImportModal;
  console.log("WorkspaceImportModal component loaded");
}
