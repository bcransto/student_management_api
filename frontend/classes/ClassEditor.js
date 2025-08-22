// ClassEditor.js - Component for editing class details
console.log("Loading ClassEditor component...");

const ClassEditor = ({ classId, navigateTo }) => {
  // State for form fields
  const [className, setClassName] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [gradeLevel, setGradeLevel] = React.useState("");
  const [description, setDescription] = React.useState("");
  
  // State for original values (to detect changes)
  const [originalData, setOriginalData] = React.useState({});
  
  // Loading and error states
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [successMessage, setSuccessMessage] = React.useState("");
  
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
        
        // Store original values
        setOriginalData({
          name: response.name || "",
          subject: response.subject || "",
          grade_level: response.grade_level || "",
          description: response.description || ""
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
      description !== originalData.description
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
        description: description.trim()
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
        description: description.trim()
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