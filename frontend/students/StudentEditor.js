// frontend/students/StudentEditor.js
// Student Editor View Component
//
// Phase 2 (#14): there is no create mode. Students are never created manually -
// they enter the system via the Workspace sync or a Google import, and a
// teacher adds them to their list with "Add from School List". This editor
// therefore only edits an existing student. Sync-owned fields (student ID,
// name, email, Google ID, cohort) are read-only display; the teacher can edit
// their own per-teacher annotations (nickname, gender, preferential seating)
// plus the one teacher-writable global field, date of birth.

const StudentEditor = ({ studentId, navigateTo, apiModule }) => {
  // Use NavigationService if available, fallback to navigateTo prop
  const nav = window.NavigationService || null;

  const [student, setStudent] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState({});
  const [showRemoveConfirm, setShowRemoveConfirm] = React.useState(false);
  const [formData, setFormData] = React.useState({
    // Editable
    nickname: "",
    gender: "",
    preferential_seating: false,
    date_of_birth: "",
    // Display-only (sync-owned)
    student_id: "",
    first_name: "",
    last_name: "",
    email: "",
    google_user_id: "",
    cohort: "",
    is_active: true,
  });
  const [enrolledClasses, setEnrolledClasses] = React.useState([]);

  React.useEffect(() => {
    if (studentId) {
      fetchStudentData();
    }
  }, [studentId]);

  const fetchStudentData = async () => {
    try {
      setLoading(true);

      const studentData = await apiModule.request(`/students/${studentId}/`);
      if (!studentData) {
        throw new Error("No student data received");
      }

      setStudent(studentData);
      setFormData({
        nickname: studentData.nickname || "",
        gender: studentData.gender || "",
        preferential_seating: studentData.preferential_seating || false,
        date_of_birth: studentData.date_of_birth || "",
        student_id: studentData.student_id || "",
        first_name: studentData.first_name || "",
        last_name: studentData.last_name || "",
        email: studentData.email || "",
        google_user_id: studentData.google_user_id || "",
        cohort: studentData.cohort || "",
        is_active: studentData.is_active !== undefined ? studentData.is_active : true,
      });

      // Enrolled classes (scoped server-side to this teacher's classes)
      try {
        const rosterData = await apiModule.request(`/roster/?student=${studentId}`);
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
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Only the editable fields are sent. nickname/gender/preferential_seating
      // route to the teacher's TeacherStudent row; date_of_birth is the one
      // teacher-writable global field. Sync-owned fields are read-only on the
      // API and are intentionally omitted.
      const payload = {
        nickname: formData.nickname || formData.first_name,
        gender: formData.gender || null,
        preferential_seating: formData.preferential_seating,
        date_of_birth: formData.date_of_birth || null,
      };

      await apiModule.request(`/students/${studentId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      nav?.toStudents ? nav.toStudents() : navigateTo("students");
    } catch (error) {
      console.error("Error saving student:", error);
      setErrors({ save: error.message || "Failed to save student" });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromList = async () => {
    try {
      setSaving(true);

      // Removal only hides the student from THIS teacher's list. It never
      // touches class rosters, seating, or attendance (see #14 design).
      await apiModule.request("/students/remove-from-my-list/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_ids: [Number(studentId)] }),
      });

      nav?.toStudents ? nav.toStudents() : navigateTo("students");
    } catch (error) {
      console.error("Error removing student from list:", error);
      setErrors({ remove: error.message || "Failed to remove student" });
    } finally {
      setSaving(false);
      setShowRemoveConfirm(false);
    }
  };

  const handleCancel = () => {
    nav?.toStudents ? nav.toStudents() : navigateTo("students");
  };

  if (loading) {
    return React.createElement(
      "div",
      { className: "loading-container" },
      React.createElement("div", { className: "spinner" }),
      "Loading student..."
    );
  }

  const readOnlyStyle = {
    backgroundColor: "#f9fafb",
    color: "#6b7280",
    cursor: "not-allowed",
  };

  // Remove-from-list confirmation dialog
  const removeConfirmDialog = showRemoveConfirm
    ? React.createElement(
        "div",
        { className: "delete-confirm-overlay" },
        React.createElement(
          "div",
          { className: "delete-confirm-dialog" },
          React.createElement("h3", null, "Remove from My List"),
          React.createElement(
            "p",
            null,
            `Remove ${formData.first_name} ${formData.last_name} from your student list? ` +
              `This only hides them from your list - class rosters, seating, and ` +
              `attendance are untouched.`
          ),
          React.createElement(
            "div",
            { className: "delete-confirm-buttons" },
            React.createElement(
              "button",
              {
                className: "btn btn-secondary",
                onClick: () => setShowRemoveConfirm(false),
              },
              "Cancel"
            ),
            React.createElement(
              "button",
              {
                className: "btn btn-danger",
                onClick: handleRemoveFromList,
                disabled: saving,
              },
              saving ? "Removing..." : "Remove"
            )
          )
        )
      )
    : null;

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
        React.createElement(
          "h1",
          { className: "page-title" },
          "Edit Student",
          !formData.is_active &&
            React.createElement(
              "span",
              {
                className: "badge badge-warning",
                style: { marginLeft: "12px", fontSize: "0.7em", verticalAlign: "middle" },
                title: "No longer in the Workspace directory",
              },
              "Archived"
            )
        ),
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
          { className: "btn btn-secondary", onClick: handleCancel },
          React.createElement("i", { className: "fas fa-arrow-left" }),
          " Back to Students"
        )
      )
    ),

    errors.fetch && React.createElement("div", { className: "alert alert-danger" }, errors.fetch),

    React.createElement(
      "div",
      { className: "editor-content" },

      // Form section
      React.createElement(
        "div",
        { className: "editor-form-section" },
        React.createElement("h2", null, "Student Information"),
        React.createElement(
          "p",
          {
            style: { color: "#6b7280", fontSize: "0.85rem", marginTop: "-8px", marginBottom: "16px" },
          },
          "Identity fields come from the Workspace directory sync and are read-only. ",
          "Nickname, gender, and preferential seating are yours alone; date of birth is shared."
        ),

        // Student ID (read-only)
        React.createElement(
          "div",
          { className: "form-group" },
          React.createElement("label", { htmlFor: "student_id" }, "Student ID"),
          React.createElement("input", {
            type: "text",
            id: "student_id",
            className: "form-control",
            value: formData.student_id,
            readOnly: true,
            style: readOnlyStyle,
          })
        ),

        // Name fields (read-only, side by side)
        React.createElement(
          "div",
          { className: "form-row" },
          React.createElement(
            "div",
            { className: "form-group col" },
            React.createElement("label", { htmlFor: "first_name" }, "First Name"),
            React.createElement("input", {
              type: "text",
              id: "first_name",
              className: "form-control",
              value: formData.first_name,
              readOnly: true,
              style: readOnlyStyle,
            })
          ),
          React.createElement(
            "div",
            { className: "form-group col" },
            React.createElement("label", { htmlFor: "last_name" }, "Last Name"),
            React.createElement("input", {
              type: "text",
              id: "last_name",
              className: "form-control",
              value: formData.last_name,
              readOnly: true,
              style: readOnlyStyle,
            })
          )
        ),

        // Nickname and Gender (editable, side by side)
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
              React.createElement("option", { value: "" }, "Not set"),
              React.createElement("option", { value: "male" }, "Male"),
              React.createElement("option", { value: "female" }, "Female"),
              React.createElement("option", { value: "other" }, "Other")
            )
          )
        ),

        // Email (read-only)
        React.createElement(
          "div",
          { className: "form-group" },
          React.createElement("label", { htmlFor: "email" }, "Email"),
          React.createElement("input", {
            type: "email",
            id: "email",
            className: "form-control",
            value: formData.email,
            readOnly: true,
            style: readOnlyStyle,
          })
        ),

        // Preferential Seating (editable) + Date of Birth (editable)
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
                style: { width: "18px", height: "18px" },
              })
            )
          ),
          React.createElement(
            "div",
            { className: "form-group col" },
            React.createElement("label", { htmlFor: "date_of_birth" }, "Date of Birth"),
            React.createElement("input", {
              type: "date",
              id: "date_of_birth",
              className: "form-control",
              value: formData.date_of_birth ? formData.date_of_birth.split("T")[0] : "",
              onChange: (e) => handleInputChange("date_of_birth", e.target.value),
            })
          )
        ),

        // Google User ID (read-only)
        React.createElement(
          "div",
          { className: "form-group" },
          React.createElement("label", { htmlFor: "google_user_id" }, "Google User ID"),
          React.createElement("input", {
            type: "text",
            id: "google_user_id",
            className: "form-control",
            value: formData.google_user_id || "",
            readOnly: true,
            style: readOnlyStyle,
            placeholder: "Not linked",
          })
        ),

        errors.save && React.createElement("div", { className: "alert alert-danger" }, errors.save),
        errors.remove && React.createElement("div", { className: "alert alert-danger" }, errors.remove),

        // Action buttons
        React.createElement(
          "div",
          { className: "form-actions" },
          React.createElement(
            "button",
            { className: "btn btn-primary", onClick: handleSave, disabled: saving },
            React.createElement("i", { className: "fas fa-save" }),
            saving ? " Saving..." : " Save Changes"
          ),
          React.createElement(
            "button",
            { className: "btn btn-secondary", onClick: handleCancel, disabled: saving },
            "Cancel"
          ),
          React.createElement(
            "button",
            {
              className: "btn btn-danger",
              onClick: () => setShowRemoveConfirm(true),
              disabled: saving,
            },
            React.createElement("i", { className: "fas fa-user-minus" }),
            " Remove from My List"
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
                    className: "class-card clickable-class-card",
                    onClick: () => {
                      const classId = roster.class_assigned;
                      if (classId) {
                        if (nav?.toClassView) {
                          nav.toClassView(classId);
                        } else if (navigateTo && typeof navigateTo === "function") {
                          navigateTo(`classes/view/${classId}`);
                        } else {
                          window.location.hash = Router?.buildHash
                            ? Router.buildHash("classView", { id: classId })
                            : `#classes/view/${classId}`;
                        }
                      }
                    },
                    style: { cursor: "pointer" },
                    title: "Click to view class details",
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
              "This student is not enrolled in any of your classes."
            )
      )
    ),

    removeConfirmDialog
  );
};

// Export for use in other modules
if (typeof window !== "undefined") {
  window.StudentEditor = StudentEditor;
}
