// frontend/students/students.js
// Students Component - Extracted from frontend.html

const Students = ({ data, navigateTo, apiModule }) => {
  // Use NavigationService if available, fallback to navigateTo prop
  const nav = window.NavigationService || null;

  const [students, setStudents] = React.useState(data?.students || []);
  const [loading, setLoading] = React.useState(!data?.students?.length);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [workspaceModalOpen, setWorkspaceModalOpen] = React.useState(false);
  const [bulkUpdateModalOpen, setBulkUpdateModalOpen] = React.useState(false);

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

  // Fetch students if not provided
  React.useEffect(() => {
    if (students.length > 0) return; // Already have data
    loadStudents();
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

  // Handle add student button click
  const handleAddStudent = () => {
    console.log("Navigating to add new student");
    window.location.hash = "#students/new";
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

  if (loading) {
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
          onClick: handleAddStudent,
          className: "btn btn-primary"
        },
        React.createElement("i", { className: "fas fa-plus" }),
        "Add Student"
      ),
      React.createElement(
        "button",
        {
          onClick: () => setWorkspaceModalOpen(true),
          className: "btn btn-success"
        },
        React.createElement("i", { className: "fab fa-google" }),
        "Import from Workspace"
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
                  },
                  student.is_active ? "Active" : "Inactive"
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

    // Workspace directory import modal
    workspaceModalOpen && window.WorkspaceImportModal && React.createElement(window.WorkspaceImportModal, {
      onClose: () => setWorkspaceModalOpen(false),
      onImported: () => {
        setWorkspaceModalOpen(false);
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
    })
  );
};

// Export for use in other modules
if (typeof window !== "undefined") {
  window.StudentsComponent = Students;
}
