// frontend/students/StudentEditor.js
// Student Editor View Component

const StudentEditor = ({ studentId, navigateTo, apiModule }) => {
  const [student, setStudent] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [formData, setFormData] = React.useState({
    student_id: "",
    first_name: "",
    last_name: "",
    email: "",
    is_active: true,
    enrollment_date: "",
  });
  const [enrolledClasses, setEnrolledClasses] = React.useState([]);

  // Fetch student data on mount
  React.useEffect(() => {
    if (studentId) {
      fetchStudentData();
    }
  }, [studentId]);

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
        email: studentData.email || "",
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

      const updateData = {
        student_id: formData.student_id,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        is_active: formData.is_active,
        enrollment_date: formData.enrollment_date,
      };

      // apiModule.request will throw on error or return the data
      const updatedStudent = await apiModule.request(`/students/${studentId}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      console.log("Student updated successfully:", updatedStudent);

      // Success - navigate back to students list
      navigateTo("students");
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
      navigateTo("students");
    } catch (error) {
      console.error("Error deleting student:", error);
      setErrors({ delete: error.message || "Failed to delete student" });
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancel = () => {
    navigateTo("students");
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
        React.createElement("h1", { className: "page-title" }, "Edit Student"),
        React.createElement(
          "p",
          { className: "page-subtitle" },
          `Editing: ${formData.first_name} ${formData.last_name} (${formData.student_id})`
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
            saving ? " Saving..." : " Save Changes"
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
          React.createElement(
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

      // Enrolled Classes section
      React.createElement(
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
                    className: "class-card",
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
