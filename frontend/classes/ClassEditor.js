// ClassEditor.js - Component for editing class details
console.log("Loading ClassEditor component...");

// Convert a backend ISO timestamp -> value for an <input type="datetime-local">
// ("YYYY-MM-DDTHH:MM", local time). Empty/invalid -> "".
const isoToLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

// Convert a datetime-local value (local time) -> ISO string for the backend.
// Empty -> null (no window bound).
const localInputToIso = (val) => {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
};

const ClassEditor = ({ classId, navigateTo }) => {
  // State for form fields
  const [className, setClassName] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [gradeLevel, setGradeLevel] = React.useState("");
  const [description, setDescription] = React.useState("");

  // Partner survey (GH issue #16 phase 2)
  const [surveyEnabled, setSurveyEnabled] = React.useState(false);
  const [surveyOpensAt, setSurveyOpensAt] = React.useState("");
  const [surveyClosesAt, setSurveyClosesAt] = React.useState("");
  const [copyStatus, setCopyStatus] = React.useState("");

  // State for original values (to detect changes)
  const [originalData, setOriginalData] = React.useState({});

  // Loading and error states
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [successMessage, setSuccessMessage] = React.useState("");

  const surveyLink = `${window.location.origin}/#my-partners/${classId}`;
  
  // Load class data on mount
  React.useEffect(() => {
    const fetchClassData = async () => {
      if (!classId) {
        setError("No class ID provided");
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        // Fetch class details
        const response = await window.ApiModule.request(`/classes/${classId}/`, {
          method: 'GET'
        });
        
        // Set form fields with current values
        setClassName(response.name || "");
        setSubject(response.subject || "");
        setGradeLevel(response.grade_level || "");
        setDescription(response.description || "");

        const opensLocal = isoToLocalInput(response.survey_opens_at);
        const closesLocal = isoToLocalInput(response.survey_closes_at);
        setSurveyEnabled(!!response.survey_enabled);
        setSurveyOpensAt(opensLocal);
        setSurveyClosesAt(closesLocal);

        // Store original values
        setOriginalData({
          name: response.name || "",
          subject: response.subject || "",
          grade_level: response.grade_level || "",
          description: response.description || "",
          survey_enabled: !!response.survey_enabled,
          survey_opens_at: opensLocal,
          survey_closes_at: closesLocal,
        });
        
      } catch (err) {
        console.error("Error fetching class data:", err);
        setError("Failed to load class details. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchClassData();
  }, [classId]);
  
  // Check if any changes have been made
  const hasChanges = () => {
    return (
      className !== originalData.name ||
      subject !== originalData.subject ||
      gradeLevel !== originalData.grade_level ||
      description !== originalData.description ||
      surveyEnabled !== originalData.survey_enabled ||
      surveyOpensAt !== originalData.survey_opens_at ||
      surveyClosesAt !== originalData.survey_closes_at
    );
  };
  
  // Handle cancel - navigate back to class view
  const handleCancel = () => {
    // Check for unsaved changes
    if (hasChanges()) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to leave?")) {
        return;
      }
    }
    
    // Navigate back to class view
    if (navigateTo) {
      navigateTo(`classes/view/${classId}`);
    } else {
      window.location.hash = `#classes/view/${classId}`;
    }
  };
  
  // Handle save
  const handleSave = async () => {
    // Basic validation
    if (!className.trim()) {
      setError("Class name is required");
      return;
    }
    
    if (!subject.trim()) {
      setError("Subject is required");
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      // Prepare data for update
      const updateData = {
        name: className.trim(),
        subject: subject.trim(),
        grade_level: gradeLevel.trim(),
        description: description.trim(),
        survey_enabled: surveyEnabled,
        survey_opens_at: localInputToIso(surveyOpensAt),
        survey_closes_at: localInputToIso(surveyClosesAt),
      };

      // Send PATCH request to update the class
      const response = await window.ApiModule.request(`/classes/${classId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      // Success - show message then navigate
      setSuccessMessage("Changes saved successfully!");

      // Update original data to prevent "unsaved changes" warning
      setOriginalData({
        name: className.trim(),
        subject: subject.trim(),
        grade_level: gradeLevel.trim(),
        description: description.trim(),
        survey_enabled: surveyEnabled,
        survey_opens_at: surveyOpensAt,
        survey_closes_at: surveyClosesAt,
      });
      
      // Navigate back to class view after a brief delay
      setTimeout(() => {
        if (navigateTo) {
          navigateTo(`classes/view/${classId}`);
        } else {
          window.location.hash = `#classes/view/${classId}`;
        }
      }, 1000);
      
    } catch (err) {
      console.error("Error saving class:", err);
      
      // Handle specific error cases
      if (err.message && err.message.includes("403")) {
        setError("You don't have permission to edit this class");
      } else if (err.message && err.message.includes("404")) {
        setError("Class not found");
      } else if (err.message && err.message.includes("400")) {
        setError("Invalid data provided. Please check your inputs");
      } else {
        setError("Failed to save changes. Please try again");
      }
    } finally {
      setSaving(false);
    }
  };

  // Copy the shareable student survey link. Sharing implies enabling: if the
  // survey is currently off, turn it on and persist that as part of the copy.
  const handleCopyLink = async () => {
    try {
      if (!surveyEnabled) {
        await window.ApiModule.request(`/classes/${classId}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ survey_enabled: true }),
        });
        setSurveyEnabled(true);
        setOriginalData((prev) => ({ ...prev, survey_enabled: true }));
      }
      await navigator.clipboard.writeText(surveyLink);
      setCopyStatus("Copied!");
    } catch (err) {
      console.error("Copy link failed:", err);
      setCopyStatus("Copy failed - select the link and copy manually");
    }
    setTimeout(() => setCopyStatus(""), 2500);
  };

  // Render loading state
  if (loading) {
    return React.createElement(
      "div",
      { className: "loading-container" },
      React.createElement("div", { className: "spinner" }),
      React.createElement("p", null, "Loading class details...")
    );
  }
  
  // Render error state
  if (error && !originalData.name) {
    return React.createElement(
      "div",
      { className: "error-container" },
      React.createElement("h2", null, "Error"),
      React.createElement("p", null, error),
      React.createElement(
        "button",
        { 
          className: "btn btn-primary",
          onClick: handleCancel
        },
        "Back to Classes"
      )
    );
  }
  
  // Main form render
  return React.createElement(
    "div",
    { className: "class-editor-container" },
    
    // Header
    React.createElement(
      "div",
      { className: "editor-header" },
      React.createElement("h1", null, "Edit Class"),
      React.createElement(
        "div",
        { className: "header-actions" },
        React.createElement(
          "button",
          {
            onClick: handleCancel,
            style: { 
              padding: "0.75rem 1rem",
              fontSize: "1rem",
              borderRadius: "0.375rem",
              border: "none",
              backgroundColor: "#6b7280",
              color: "white",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem"
            },
            onMouseEnter: (e) => e.target.style.backgroundColor = "#5a5f6b",
            onMouseLeave: (e) => e.target.style.backgroundColor = "#6b7280"
          },
          React.createElement("i", { className: "fas fa-times" }),
          " Cancel"
        ),
        React.createElement(
          "button",
          {
            onClick: handleSave,
            disabled: saving || !hasChanges(),
            style: { 
              padding: "0.75rem 1rem",
              fontSize: "1rem",
              borderRadius: "0.375rem",
              border: "none",
              backgroundColor: "#6366f1",
              color: "white",
              cursor: (saving || !hasChanges()) ? "not-allowed" : "pointer",
              opacity: (saving || !hasChanges()) ? 0.6 : 1,
              transition: "all 0.2s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem"
            },
            onMouseEnter: (e) => !(saving || !hasChanges()) && (e.target.style.backgroundColor = "#5558e3"),
            onMouseLeave: (e) => !(saving || !hasChanges()) && (e.target.style.backgroundColor = "#6366f1")
          },
          saving ? [
            React.createElement("div", { 
              key: "spinner",
              className: "spinner spinner-small" 
            }),
            " Saving..."
          ] : [
            React.createElement("i", { 
              key: "icon",
              className: "fas fa-save" 
            }),
            " Save Changes"
          ]
        )
      )
    ),
    
    // Success message if any
    successMessage && React.createElement(
      "div",
      { className: "alert alert-success" },
      React.createElement("i", { className: "fas fa-check-circle" }),
      " ",
      successMessage
    ),
    
    // Error message if any
    error && React.createElement(
      "div",
      { className: "alert alert-error" },
      React.createElement("i", { className: "fas fa-exclamation-triangle" }),
      " ",
      error
    ),
    
    // Form
    React.createElement(
      "div",
      { className: "editor-form" },
      
      // Class Name
      React.createElement(
        "div",
        { className: "form-group" },
        React.createElement(
          "label",
          { htmlFor: "class-name" },
          "Class Name",
          React.createElement("span", { className: "required" }, " *")
        ),
        React.createElement("input", {
          type: "text",
          id: "class-name",
          className: "form-input",
          value: className,
          onChange: (e) => setClassName(e.target.value),
          placeholder: "e.g., Period 1 Math",
          disabled: saving
        }),
        React.createElement(
          "small",
          { className: "form-help" },
          "The name of your class as it appears in lists"
        )
      ),
      
      // Subject
      React.createElement(
        "div",
        { className: "form-group" },
        React.createElement(
          "label",
          { htmlFor: "subject" },
          "Subject",
          React.createElement("span", { className: "required" }, " *")
        ),
        React.createElement("input", {
          type: "text",
          id: "subject",
          className: "form-input",
          value: subject,
          onChange: (e) => setSubject(e.target.value),
          placeholder: "e.g., Mathematics, English, Science",
          disabled: saving
        }),
        React.createElement(
          "small",
          { className: "form-help" },
          "The subject area of this class"
        )
      ),
      
      // Grade Level
      React.createElement(
        "div",
        { className: "form-group" },
        React.createElement("label", { htmlFor: "grade-level" }, "Grade Level"),
        React.createElement("input", {
          type: "text",
          id: "grade-level",
          className: "form-input",
          value: gradeLevel,
          onChange: (e) => setGradeLevel(e.target.value),
          placeholder: "e.g., 9, 10-12, Mixed",
          disabled: saving
        }),
        React.createElement(
          "small",
          { className: "form-help" },
          "The grade level(s) for this class"
        )
      ),
      
      // Description
      React.createElement(
        "div",
        { className: "form-group" },
        React.createElement("label", { htmlFor: "description" }, "Description"),
        React.createElement("textarea", {
          id: "description",
          className: "form-input",
          value: description,
          onChange: (e) => setDescription(e.target.value),
          placeholder: "Optional notes or description about this class...",
          rows: 4,
          disabled: saving
        }),
        React.createElement(
          "small",
          { className: "form-help" },
          "Any additional notes or information about this class"
        )
      ),

      // Partner Survey section (GH issue #16 phase 2)
      React.createElement(
        "div",
        {
          className: "form-group",
          style: {
            marginTop: "1.5rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid #e5e7eb",
          },
        },
        React.createElement(
          "h2",
          { style: { fontSize: "1.1rem", fontWeight: 600, margin: "0 0 0.25rem" } },
          "Partner Survey"
        ),
        React.createElement(
          "small",
          { className: "form-help", style: { display: "block", marginBottom: "1rem" } },
          "Let students privately rank classmates they do (and don't) work well with. Share the link below with your class."
        ),

        // Enable toggle
        React.createElement(
          "label",
          {
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              cursor: "pointer",
              marginBottom: "1rem",
            },
          },
          React.createElement("input", {
            type: "checkbox",
            checked: surveyEnabled,
            onChange: (e) => setSurveyEnabled(e.target.checked),
            disabled: saving,
            style: { width: "18px", height: "18px", cursor: "pointer" },
          }),
          React.createElement(
            "span",
            { style: { fontWeight: 500 } },
            surveyEnabled ? "Survey enabled" : "Survey disabled"
          )
        ),

        // Optional window
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              gap: "1rem",
              flexWrap: "wrap",
              marginBottom: "1rem",
            },
          },
          React.createElement(
            "div",
            { style: { flex: "1 1 220px" } },
            React.createElement(
              "label",
              { htmlFor: "survey-opens", style: { display: "block", marginBottom: "0.25rem" } },
              "Opens at (optional)"
            ),
            React.createElement("input", {
              type: "datetime-local",
              id: "survey-opens",
              className: "form-input",
              value: surveyOpensAt,
              onChange: (e) => setSurveyOpensAt(e.target.value),
              disabled: saving,
            })
          ),
          React.createElement(
            "div",
            { style: { flex: "1 1 220px" } },
            React.createElement(
              "label",
              { htmlFor: "survey-closes", style: { display: "block", marginBottom: "0.25rem" } },
              "Closes at (optional)"
            ),
            React.createElement("input", {
              type: "datetime-local",
              id: "survey-closes",
              className: "form-input",
              value: surveyClosesAt,
              onChange: (e) => setSurveyClosesAt(e.target.value),
              disabled: saving,
            })
          )
        ),
        React.createElement(
          "small",
          { className: "form-help", style: { display: "block", marginBottom: "1rem" } },
          "Leave both blank to keep the survey open whenever it's enabled."
        ),

        // Copy link row
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
            },
          },
          React.createElement(
            "button",
            {
              type: "button",
              onClick: handleCopyLink,
              disabled: saving,
              style: {
                padding: "6px 12px",
                fontSize: "14px",
                fontWeight: 500,
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#667eea",
                color: "white",
                cursor: saving ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              },
            },
            React.createElement("i", { className: "fas fa-link" }),
            " Copy Link"
          ),
          copyStatus &&
            React.createElement(
              "span",
              { style: { fontSize: "0.85rem", color: "#10b981", fontWeight: 500 } },
              copyStatus
            )
        ),
        React.createElement(
          "code",
          {
            style: {
              display: "block",
              marginTop: "0.5rem",
              padding: "0.5rem 0.75rem",
              background: "#f3f4f6",
              borderRadius: "6px",
              fontSize: "0.85rem",
              wordBreak: "break-all",
              userSelect: "all",
            },
          },
          surveyLink
        )
      ),

      // Form Actions (Mobile)
      React.createElement(
        "div",
        { className: "form-actions-mobile" },
        React.createElement(
          "button",
          {
            onClick: handleCancel,
            style: { 
              width: "100%",
              padding: "0.75rem 1rem",
              fontSize: "1rem",
              borderRadius: "0.375rem",
              border: "none",
              backgroundColor: "#6b7280",
              color: "white",
              cursor: "pointer",
              transition: "all 0.2s ease"
            },
            onMouseEnter: (e) => e.target.style.backgroundColor = "#5a5f6b",
            onMouseLeave: (e) => e.target.style.backgroundColor = "#6b7280"
          },
          "Cancel"
        ),
        React.createElement(
          "button",
          {
            onClick: handleSave,
            disabled: saving || !hasChanges(),
            style: { 
              width: "100%",
              padding: "0.75rem 1rem",
              fontSize: "1rem",
              borderRadius: "0.375rem",
              border: "none",
              backgroundColor: "#6366f1",
              color: "white",
              cursor: (saving || !hasChanges()) ? "not-allowed" : "pointer",
              opacity: (saving || !hasChanges()) ? 0.6 : 1,
              transition: "all 0.2s ease"
            },
            onMouseEnter: (e) => !(saving || !hasChanges()) && (e.target.style.backgroundColor = "#5558e3"),
            onMouseLeave: (e) => !(saving || !hasChanges()) && (e.target.style.backgroundColor = "#6366f1")
          },
          saving ? "Saving..." : "Save Changes"
        )
      )
    )
  );
};

// Export component
if (typeof window !== "undefined") {
  window.ClassEditorComponent = ClassEditor;
  console.log("ClassEditor component loaded");
}