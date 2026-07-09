// frontend/students/students.js
// Students Component - Extracted from frontend.html

const Students = ({ data, navigateTo, apiModule }) => {
  // Use NavigationService if available, fallback to navigateTo prop
  const nav = window.NavigationService || null;

  const [students, setStudents] = React.useState(data?.students || []);
  const [loading, setLoading] = React.useState(!data?.students?.length);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [cohortModalMode, setCohortModalMode] = React.useState(null); // null | "add" | "remove"
  const [bulkUpdateModalOpen, setBulkUpdateModalOpen] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  // Sync Now is admin-only: the sync mutates the school-wide list (including
  // archiving students for every teacher). Same JWT decode as sidebar.js.
  const isSuperuser = React.useMemo(() => {
    const token = localStorage.getItem("token");
    if (!token) return false;
    try {
      let payload = token.split(".")[1];
      payload = payload.replace(/-/g, "+").replace(/_/g, "/");
      while (payload.length % 4) {
        payload += "=";
      }
      return JSON.parse(atob(payload)).is_superuser === true;
    } catch (e) {
      return false;
    }
  }, []);

  // Workspace directory "Sync now" state
  const [lastSynced, setLastSynced] = React.useState(null);
  const [syncing, setSyncing] = React.useState(false);
  const [syncSummary, setSyncSummary] = React.useState(null);
  const [syncError, setSyncError] = React.useState(null);
  const [syncReconnectUrl, setSyncReconnectUrl] = React.useState(null);

  // Fetch (or re-fetch after imports/updates) the student list
  const loadStudents = async () => {
    try {
      setLoading(true);
      const response = await window.ApiModule.request('/students/');
      const studentData = response.results || response;
      setStudents(studentData);
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch when the directory sync last ran (cheap aggregate)
  const loadLastSynced = async () => {
    try {
      const response = await window.ApiModule.request('/students/last-synced/');
      setLastSynced(response.last_synced || null);
    } catch (error) {
      console.error("Error fetching last-synced:", error);
    }
  };

  // "Sync now": pull the latest Workspace directory into the global list
  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncSummary(null);
    setSyncReconnectUrl(null);
    try {
      const response = await window.ApiModule.request('/google/sync-directory/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (response.needs_reconnect) {
        setSyncReconnectUrl(response.auth_url);
      } else {
        setSyncSummary(response);
        if (response.last_synced) setLastSynced(response.last_synced);
        loadStudents();
      }
    } catch (err) {
      console.error("Error running directory sync:", err);
      setSyncError(err.message || "Directory sync failed.");
      // A not-connected response carries auth_url in its body; surface a
      // reconnect path the same way the Workspace import modal does.
      try {
        const oauthResponse = await window.ApiModule.request(
          `/google/oauth-url/?next=${encodeURIComponent('students')}`,
          { method: 'GET' }
        );
        setSyncReconnectUrl(oauthResponse.auth_url);
      } catch (oauthErr) {
        console.error("Error fetching oauth url:", oauthErr);
      }
    } finally {
      setSyncing(false);
    }
  };

  // Fetch students if not provided
  React.useEffect(() => {
    if (students.length === 0) loadStudents();
    loadLastSynced();
  }, []);

  // Handle student row click - navigate to edit view
  const handleStudentClick = (studentId) => {
    console.log("Navigating to edit student:", studentId);
    if (nav?.toStudentEdit) {
      nav.toStudentEdit(studentId);
    } else {
      navigateTo("student-edit", { studentId });
    }
  };

  // "Add from School List" opens the picker (manual creation is disabled - #14)
  const handleAddFromSchoolList = () => {
    setPickerOpen(true);
  };

  // Filter students based on search term
  const filteredStudents = React.useMemo(() => {
    if (!students || !searchTerm) return students || [];
    
    const term = searchTerm.toLowerCase();
    return students.filter(student => {
      return (
        student.student_id?.toLowerCase().includes(term) ||
        student.first_name?.toLowerCase().includes(term) ||
        student.last_name?.toLowerCase().includes(term) ||
        student.nickname?.toLowerCase().includes(term) ||
        student.email?.toLowerCase().includes(term) ||
        `${student.first_name} ${student.last_name}`.toLowerCase().includes(term)
      );
    });
  }, [students, searchTerm]);

  // Full-page spinner only on the INITIAL load. On refreshes (e.g. after a
  // picker/cohort-modal add) keep the current tree rendered - early-returning
  // here would unmount any open modal and wipe its state mid-interaction.
  if (loading && students.length === 0) {
    return React.createElement(
      "div",
      { className: "students-loading" },
      React.createElement("div", { className: "students-spinner" }),
      "Loading students..."
    );
  }

  return React.createElement(
    "div",
    null,
    // Page Header
    React.createElement(
      "div",
      { className: "page-header" },
      React.createElement("h1", { className: "page-title" }, "Students"),
      React.createElement(
        "p",
        { className: "page-subtitle" },
        "View and manage student information"
      )
    ),

    // Search Bar and Add Button
    React.createElement(
      "div",
      {
        className: "students-search-container toolbar",
        style: {
          padding: "0 20px"
        }
      },
      React.createElement("input", {
        type: "text",
        className: "students-search-input",
        placeholder: "Search by name, nickname, student ID, or email...",
        value: searchTerm,
        onChange: (e) => setSearchTerm(e.target.value),
        style: {
          width: "100%",
          maxWidth: "400px",
          padding: "8px 12px",
          fontSize: "14px"
        }
      }),
      React.createElement(
        "button",
        {
          onClick: handleAddFromSchoolList,
          className: "btn btn-primary"
        },
        React.createElement("i", { className: "fas fa-user-plus" }),
        "Add Student"
      ),
      React.createElement(
        "button",
        {
          onClick: () => setCohortModalMode("add"),
          className: "btn btn-success"
        },
        React.createElement("i", { className: "fas fa-users" }),
        "Add Cohort"
      ),
      React.createElement(
        "button",
        {
          onClick: () => setCohortModalMode("remove"),
          className: "btn btn-danger"
        },
        React.createElement("i", { className: "fas fa-user-minus" }),
        "Remove Cohort"
      ),
      React.createElement(
        "button",
        {
          onClick: () => setBulkUpdateModalOpen(true),
          className: "btn btn-secondary"
        },
        React.createElement("i", { className: "fas fa-file-csv" }),
        "Bulk Update"
      ),
      isSuperuser && React.createElement(
        "button",
        {
          onClick: handleSyncNow,
          disabled: syncing,
          className: "btn btn-secondary",
          title: "Pull the latest Google Workspace directory into the school list"
        },
        React.createElement("i", {
          className: syncing ? "fas fa-sync fa-spin" : "fas fa-sync"
        }),
        syncing ? "Syncing..." : "Sync db"
      ),
      searchTerm && React.createElement(
        "span",
        {
          style: {
            marginLeft: "auto",
            color: "#666",
            fontSize: "14px"
          }
        },
        `Found ${filteredStudents.length} student${filteredStudents.length !== 1 ? 's' : ''}`
      )
    ),

    // Last-synced line + sync result / error / reconnect banner
    React.createElement(
      "div",
      { style: { padding: "0 20px", marginTop: "8px" } },
      React.createElement(
        "div",
        { style: { color: "#6b7280", fontSize: "13px" } },
        lastSynced
          ? `Last synced: ${new Date(lastSynced).toLocaleString()}`
          : "Never synced"
      ),
      syncSummary && React.createElement(
        "div",
        {
          style: {
            marginTop: "8px",
            padding: "8px 12px",
            backgroundColor: "#d1fae5",
            border: "1px solid #6ee7b7",
            borderRadius: "6px",
            color: "#065f46",
            fontSize: "13px"
          }
        },
        `Sync complete: ${syncSummary.created} created, ${syncSummary.updated} updated, ` +
          `${syncSummary.reactivated} reactivated, ${syncSummary.archived} archived` +
          (syncSummary.skipped ? `, ${syncSummary.skipped} skipped` : "") +
          (syncSummary.safety_valve_triggered
            ? " (archiving skipped - directory returned too few students)"
            : "")
      ),
      syncError && !syncReconnectUrl && React.createElement(
        "div",
        {
          style: {
            marginTop: "8px",
            padding: "8px 12px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: "6px",
            color: "#dc2626",
            fontSize: "13px"
          }
        },
        syncError
      ),
      syncReconnectUrl && React.createElement(
        "div",
        {
          style: {
            marginTop: "8px",
            padding: "8px 12px",
            backgroundColor: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: "6px",
            color: "#92400e",
            fontSize: "13px"
          }
        },
        "Google needs directory access before syncing. ",
        React.createElement(
          "a",
          {
            href: syncReconnectUrl,
            style: { color: "#2563eb", fontWeight: 600, cursor: "pointer" }
          },
          "Reconnect Google"
        )
      )
    ),

    // Students Table
    React.createElement(
      "div",
      { className: "students-table-container" },
      React.createElement(
        "table",
        { className: "students-table" },
        // Table Header
        React.createElement(
          "thead",
          null,
          React.createElement(
            "tr",
            null,
            React.createElement("th", null, "Student ID"),
            React.createElement("th", null, "Name"),
            React.createElement("th", null, "Nickname"),
            React.createElement("th", null, "Email"),
            React.createElement("th", null, "Status"),
            React.createElement("th", null, "Enrolled"),
            React.createElement("th", null, "Classes")
          )
        ),

        // Table Body
        React.createElement(
          "tbody",
          null,
          filteredStudents.map((student) =>
            React.createElement(
              "tr",
              {
                key: student.id,
                className: "student-row",
                onClick: () => handleStudentClick(student.id),
                style: { cursor: "pointer" },
                title: "Click to edit",
              },
              React.createElement(
                "td",
                null,
                React.createElement("strong", null, student.student_id)
              ),
              React.createElement("td", null, `${student.first_name} ${student.last_name}`),
              React.createElement("td", null, student.nickname || student.first_name),
              React.createElement("td", null, student.email || "N/A"),
              React.createElement(
                "td",
                null,
                React.createElement(
                  "span",
                  {
                    className: `badge ${student.is_active ? "badge-success" : "badge-warning"}`,
                    title: student.is_active
                      ? undefined
                      : "No longer in the Workspace directory",
                  },
                  student.is_active ? "Active" : "Archived"
                )
              ),
              React.createElement(
                "td",
                null,
                new Date(student.enrollment_date).toLocaleDateString()
              ),
              React.createElement(
                "td",
                null,
                React.createElement(
                  "span",
                  {
                    className: "badge badge-info",
                  },
                  `${student.active_classes?.length || 0} classes`
                )
              )
            )
          )
        )
      )
    ),

    // "Add Cohort" / "Remove Cohort" modal (whole-cohort ops over the app's school list)
    cohortModalMode && window.AddCohortModal && React.createElement(window.AddCohortModal, {
      mode: cohortModalMode,
      onClose: () => setCohortModalMode(null),
      onChanged: () => {
        // Refresh the my-students list after adds/removes (modal stays open)
        loadStudents();
      }
    }),

    // CSV/TSV bulk update modal
    bulkUpdateModalOpen && window.BulkUpdateModal && React.createElement(window.BulkUpdateModal, {
      onClose: () => setBulkUpdateModalOpen(false),
      onApplied: () => {
        setBulkUpdateModalOpen(false);
        loadStudents();
      }
    }),

    // "Add Student" picker (school-wide list, individual add/remove)
    pickerOpen && window.StudentPicker && React.createElement(window.StudentPicker, {
      onClose: () => setPickerOpen(false),
      onChanged: () => {
        // Refresh the my-students list after adds/removes (modal stays open)
        loadStudents();
      }
    })
  );
};

// Export for use in other modules
if (typeof window !== "undefined") {
  window.StudentsComponent = Students;
}
