// frontend/students/StudentEditor.js
// Student Editor View Component

const StudentEditor = ({ studentId, navigateTo, apiModule }) => {
  // Use NavigationService if available, fallback to navigateTo prop
  const nav = window.NavigationService || null;

  // Determine if we're in create mode (studentId is "new" or not provided)
  const isCreateMode = !studentId || studentId === "new";

  const [student, setStudent] = React.useState(null);
  const [loading, setLoading] = React.useState(!isCreateMode);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [formData, setFormData] = React.useState({
    student_id: "",
    first_name: "",
    last_name: "",
    nickname: "",
    email: "",
    gender: "",
    preferential_seating: false,
    google_user_id: "",
    is_active: true,
    enrollment_date: new Date().toISOString().split("T")[0],
  });
  const [enrolledClasses, setEnrolledClasses] = React.useState([]);

  // Fetch student data on mount (only in edit mode)
  React.useEffect(() => {
    if (studentId && !isCreateMode) {
      fetchStudentData();
    }
  }, [studentId, isCreateMode]);

  const fetchStudentData = async () => {
    try {
      setLoading(true);

      // Fetch student details (apiModule.request returns the data directly)
      console.log("Fetching student with ID:", studentId);
      const studentData = await apiModule.request(`/students/${studentId}/`);
      console.log("Student data received:", studentData);

      if (!studentData) {
        throw new Error("No student data received");
      }

      setStudent(studentData);
      setFormData({
        student_id: studentData.student_id || "",
        first_name: studentData.first_name || "",
        last_name: studentData.last_name || "",
        nickname: studentData.nickname || "",
        email: studentData.email || "",
        gender: studentData.gender || "",
        preferential_seating: studentData.preferential_seating || false,
        google_user_id: studentData.google_user_id || "",
        is_active: studentData.is_active !== undefined ? studentData.is_active : true,
        enrollment_date: studentData.enrollment_date || "",
      });

      // Fetch enrolled classes
      try {
        const rosterData = await apiModule.request(`/roster/?student=${studentId}`);
        console.log("Roster data received:", rosterData);
        const rosterArray = Array.isArray(rosterData) ? rosterData : rosterData?.results || [];
        setEnrolledClasses(rosterArray);
      } catch (rosterError) {
        console.warn("Could not fetch roster data:", rosterError);
        setEnrolledClasses([]);
      }
    } catch (error) {
      console.error("Error fetching student:", error);
      setErrors({ fetch: "Failed to load student data" });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields
    if (!formData.student_id.trim()) {
      newErrors.student_id = "Student ID is required";
    }
    if (!formData.first_name.trim()) {
      newErrors.first_name = "First name is required";
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = "Last name is required";
    }

    // Email validation (if provided)
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = "Invalid email format";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      const studentData = {
        student_id: formData.student_id,
        first_name: formData.first_name,
        last_name: formData.last_name,
        nickname: formData.nickname || formData.first_name,
        email: formData.email || null,
        gender: formData.gender || null,
        preferential_seating: formData.preferential_seating,
        google_user_id: formData.google_user_id || null,
        is_active: formData.is_active,
        enrollment_date: formData.enrollment_date,
      };

      if (isCreateMode) {
        // Create new student with POST
        const newStudent = await apiModule.request("/students/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(studentData),
        });
        console.log("Student created successfully:", newStudent);
      } else {
        // Update existing student with PUT
        const updatedStudent = await apiModule.request(`/students/${studentId}/`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(studentData),
        });
        console.log("Student updated successfully:", updatedStudent);
      }

      // Success - navigate back to students list
      nav?.toStudents ? nav.toStudents() : navigateTo("students");
    } catch (error) {
      console.error("Error saving student:", error);
      setErrors({ save: error.message || "Failed to save student" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setSaving(true);

      // Soft delete by setting is_active to false
      await apiModule.request(`/students/${studentId}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_active: false }),
      });

      console.log("Student deleted (soft delete) successfully");

      // Success - navigate back to students list
      nav?.toStudents ? nav.toStudents() : navigateTo("students");
    } catch (error) {
      console.error("Error deleting student:", error);
      setErrors({ delete: error.message || "Failed to delete student" });
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancel = () => {
    nav?.toStudents ? nav.toStudents() : navigateTo("students");
  };

  // Render loading state
  if (loading) {
    return React.createElement(
      "div",
      { className: "loading-container" },
      React.createElement("div", { className: "spinner" }),
      "Loading student..."
    );
  }

  // Render delete confirmation dialog
  const deleteConfirmDialog = showDeleteConfirm
    ? React.createElement(
        "div",
        { className: "delete-confirm-overlay" },
        React.createElement(
          "div",
          { className: "delete-confirm-dialog" },
          React.createElement("h3", null, "Confirm Delete"),
          React.createElement(
            "p",
            null,
            `Are you sure you want to delete ${formData.first_name} ${formData.last_name}? This will mark the student as inactive.`
          ),
          React.createElement(
            "div",
            { className: "delete-confirm-buttons" },
            React.createElement(
              "button",
              {
                className: "btn btn-secondary",
                onClick: () => setShowDeleteConfirm(false),
              },
              "Cancel"
            ),
            React.createElement(
              "button",
              {
                className: "btn btn-danger",
                onClick: handleDelete,
                disabled: saving,
              },
              saving ? "Deleting..." : "Delete"
            )
          )
        )
      )
    : null;

  // Main editor view
  return React.createElement(
    "div",
    { className: "student-editor-view" },

    // Page Header
    React.createElement(
      "div",
      { className: "page-header" },
      React.createElement(
        "div",
        { className: "page-header-content" },
        React.createElement("h1", { className: "page-title" }, isCreateMode ? "Add New Student" : "Edit Student"),
        React.createElement(
          "p",
          { className: "page-subtitle" },
          isCreateMode
            ? "Enter the student's information below"
            : `Editing: ${formData.first_name} ${formData.last_name} (${formData.student_id})`
        )
      ),
      React.createElement(
        "div",
        { className: "page-header-actions" },
        React.createElement(
          "button",
          {
            className: "btn btn-secondary",
            onClick: handleCancel,
          },
          React.createElement("i", { className: "fas fa-arrow-left" }),
          " Back to Students"
        )
      )
    ),

    // Error display
    errors.fetch && React.createElement("div", { className: "alert alert-danger" }, errors.fetch),

    // Main content
    React.createElement(
      "div",
      { className: "editor-content" },

      // Form section
      React.createElement(
        "div",
        { className: "editor-form-section" },
        React.createElement("h2", null, "Student Information"),

        // Student ID field
        React.createElement(
          "div",
          { className: "form-group" },
          React.createElement("label", { htmlFor: "student_id" }, "Student ID *"),
          React.createElement("input", {
            type: "text",
            id: "student_id",
            className: `form-control ${errors.student_id ? "error" : ""}`,
            value: formData.student_id,
            onChange: (e) => handleInputChange("student_id", e.target.value),
            required: true,
          }),
          errors.student_id &&
            React.createElement("span", { className: "error-message" }, errors.student_id)
        ),

        // Name fields (side by side)
        React.createElement(
          "div",
          { className: "form-row" },
          React.createElement(
            "div",
            { className: "form-group col" },
            React.createElement("label", { htmlFor: "first_name" }, "First Name *"),
            React.createElement("input", {
              type: "text",
              id: "first_name",
              className: `form-control ${errors.first_name ? "error" : ""}`,
              value: formData.first_name,
              onChange: (e) => handleInputChange("first_name", e.target.value),
              required: true,
            }),
            errors.first_name &&
              React.createElement("span", { className: "error-message" }, errors.first_name)
          ),
          React.createElement(
            "div",
            { className: "form-group col" },
            React.createElement("label", { htmlFor: "last_name" }, "Last Name *"),
            React.createElement("input", {
              type: "text",
              id: "last_name",
              className: `form-control ${errors.last_name ? "error" : ""}`,
              value: formData.last_name,
              onChange: (e) => handleInputChange("last_name", e.target.value),
              required: true,
            }),
            errors.last_name &&
              React.createElement("span", { className: "error-message" }, errors.last_name)
          )
        ),

        // Nickname and Gender fields (side by side)
        React.createElement(
          "div",
          { className: "form-row" },
          React.createElement(
            "div",
            { className: "form-group col" },
            React.createElement("label", { htmlFor: "nickname" }, "Nickname"),
            React.createElement("input", {
              type: "text",
              id: "nickname",
              className: "form-control",
              value: formData.nickname,
              onChange: (e) => handleInputChange("nickname", e.target.value),
              placeholder: "Defaults to first name",
            })
          ),
          React.createElement(
            "div",
            { className: "form-group col" },
            React.createElement("label", { htmlFor: "gender" }, "Gender"),
            React.createElement(
              "select",
              {
                id: "gender",
                className: "form-control",
                value: formData.gender,
                onChange: (e) => handleInputChange("gender", e.target.value),
              },
              React.createElement("option", { value: "" }, "-- Select --"),
              React.createElement("option", { value: "male" }, "Male"),
              React.createElement("option", { value: "female" }, "Female"),
              React.createElement("option", { value: "other" }, "Other")
            )
          )
        ),

        // Email field
        React.createElement(
          "div",
          { className: "form-group" },
          React.createElement("label", { htmlFor: "email" }, "Email"),
          React.createElement("input", {
            type: "email",
            id: "email",
            className: `form-control ${errors.email ? "error" : ""}`,
            value: formData.email,
            onChange: (e) => handleInputChange("email", e.target.value),
          }),
          errors.email && React.createElement("span", { className: "error-message" }, errors.email)
        ),

        // Preferential Seating and Google User ID (side by side)
        React.createElement(
          "div",
          { className: "form-row" },
          React.createElement(
            "div",
            { className: "form-group col" },
            React.createElement("label", { htmlFor: "preferential_seating" }, "Preferential Seating"),
            React.createElement(
              "div",
              { className: "form-check", style: { marginTop: "8px" } },
              React.createElement("input", {
                type: "checkbox",
                id: "preferential_seating",
                className: "form-check-input",
                checked: formData.preferential_seating,
                onChange: (e) => handleInputChange("preferential_seating", e.target.checked),
                style: { width: "18px", height: "18px" }
              })
            )
          ),
          React.createElement(
            "div",
            { className: "form-group col" },
            React.createElement("label", { htmlFor: "google_user_id" }, "Google User ID"),
            React.createElement("input", {
              type: "text",
              id: "google_user_id",
              className: "form-control",
              value: formData.google_user_id,
              onChange: (e) => handleInputChange("google_user_id", e.target.value),
              placeholder: "For Google Classroom integration",
            })
          )
        ),

        // Status and Enrollment Date (side by side)
        React.createElement(
          "div",
          { className: "form-row" },
          React.createElement(
            "div",
            { className: "form-group col" },
            React.createElement("label", { htmlFor: "is_active" }, "Status"),
            React.createElement(
              "select",
              {
                id: "is_active",
                className: "form-control",
                value: formData.is_active.toString(),
                onChange: (e) => handleInputChange("is_active", e.target.value === "true"),
              },
              React.createElement("option", { value: "true" }, "Active"),
              React.createElement("option", { value: "false" }, "Inactive")
            )
          ),
          React.createElement(
            "div",
            { className: "form-group col" },
            React.createElement("label", { htmlFor: "enrollment_date" }, "Enrollment Date"),
            React.createElement("input", {
              type: "date",
              id: "enrollment_date",
              className: "form-control",
              value: formData.enrollment_date ? formData.enrollment_date.split("T")[0] : "",
              onChange: (e) => handleInputChange("enrollment_date", e.target.value),
            })
          )
        ),

        // Error messages
        errors.save && React.createElement("div", { className: "alert alert-danger" }, errors.save),

        // Action buttons
        React.createElement(
          "div",
          { className: "form-actions" },
          React.createElement(
            "button",
            {
              className: "btn btn-primary",
              onClick: handleSave,
              disabled: saving,
            },
            React.createElement("i", { className: "fas fa-save" }),
            saving ? " Saving..." : (isCreateMode ? " Create Student" : " Save Changes")
          ),
          React.createElement(
            "button",
            {
              className: "btn btn-secondary",
              onClick: handleCancel,
              disabled: saving,
            },
            "Cancel"
          ),
          // Only show delete button in edit mode
          !isCreateMode && React.createElement(
            "button",
            {
              className: "btn btn-danger",
              onClick: () => setShowDeleteConfirm(true),
              disabled: saving,
            },
            React.createElement("i", { className: "fas fa-trash" }),
            " Delete Student"
          )
        )
      ),

      // Enrolled Classes section (only show in edit mode)
      !isCreateMode && React.createElement(
        "div",
        { className: "enrolled-classes-panel" },
        React.createElement("h2", null, "Enrolled Classes"),
        enrolledClasses.length > 0
          ? React.createElement(
              "div",
              { className: "classes-list" },
              enrolledClasses.map((roster) =>
                React.createElement(
                  "div",
                  {
                    key: roster.id,
                    className: "class-card clickable-class-card",
                    onClick: () => {
                      // Navigate to the class view
                      const classId = roster.class_assigned;
                      if (classId) {
                        if (nav?.toClassView) {
                          nav.toClassView(classId);
                        } else if (navigateTo && typeof navigateTo === 'function') {
                          navigateTo(`classes/view/${classId}`);
                        } else {
                          // Fallback to direct hash navigation
                          window.location.hash = Router?.buildHash ? Router.buildHash('classView', {id: classId}) : `#classes/view/${classId}`;
                        }
                      }
                    },
                    style: { cursor: "pointer" },
                    title: "Click to view class details"
                  },
                  React.createElement(
                    "div",
                    { className: "class-card-header" },
                    React.createElement(
                      "span",
                      { className: "class-name" },
                      roster.class_assigned_details
                        ? roster.class_assigned_details.class_name
                        : "Unknown Class"
                    ),
                    roster.class_assigned_details?.grade_level &&
                      React.createElement(
                        "span",
                        { className: "class-period" },
                        `Grade ${roster.class_assigned_details.grade_level}`
                      )
                  ),
                  React.createElement(
                    "div",
                    { className: "class-card-details" },
                    roster.class_assigned_details?.teacher_name &&
                      React.createElement(
                        "span",
                        null,
                        "Teacher: ",
                        roster.class_assigned_details.teacher_name
                      ),
                    React.createElement(
                      "div",
                      { className: "class-link-indicator" },
                      React.createElement("i", { className: "fas fa-arrow-right" }),
                      " View Class"
                    )
                  )
                )
              )
            )
          : React.createElement(
              "p",
              { className: "no-classes" },
              "This student is not enrolled in any classes."
            )
      )
    ),

    // Delete confirmation dialog
    deleteConfirmDialog
  );
};

// Export for use in other modules
if (typeof window !== "undefined") {
  window.StudentEditor = StudentEditor;
}
