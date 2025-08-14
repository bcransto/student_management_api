// ClassCreateModal.js - Modal component for creating new classes
console.log("Loading ClassCreateModal component...");

const ClassCreateModal = ({ isOpen, onClose, onSuccess }) => {
  // Form state
  const [formData, setFormData] = React.useState({
    name: '',
    subject: '',
    grade_level: '',
    description: ''
  });
  
  // Layout field removed - no longer needed
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState({});
  
  // Fetch user's layouts when modal opens
  React.useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setFormData({
        name: '',
        subject: '',
        grade_level: '',
        description: ''
      });
      setErrors({});
    }
  }, [isOpen]);
  
  // Layout fetching removed - no longer needed
  
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error for this field when user types
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };
  
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Class name is required';
    }
    
    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Prepare data for API
      const submitData = {
        name: formData.name.trim(),
        subject: formData.subject.trim(),
        grade_level: formData.grade_level.trim(),
        description: formData.description.trim()
      };
      
      // Layout field removed - no longer needed
      
      // Create the class
      const response = await window.ApiModule.request('/classes/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });
      
      console.log("Class created successfully:", response);
      
      // Call success callback with new class data
      if (onSuccess) {
        onSuccess(response);
      }
      
    } catch (err) {
      console.error("Error creating class:", err);
      setErrors({
        submit: err.message || 'Failed to create class. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleOverlayClick = (e) => {
    // Only close if clicking the overlay itself, not the modal content
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };
  
  // Add/remove escape key listener
  React.useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen]);
  
  if (!isOpen) {
    return null;
  }
  
  return React.createElement(
    "div",
    { 
      className: "modal-overlay",
      onClick: handleOverlayClick
    },
    React.createElement(
      "div",
      { className: "modal-container" },
      
      // Modal Header
      React.createElement(
        "div",
        { className: "modal-header" },
        React.createElement("h2", null, "Create New Class"),
        React.createElement(
          "button",
          { 
            className: "modal-close-btn",
            onClick: onClose,
            type: "button"
          },
          React.createElement("i", { className: "fas fa-times" })
        )
      ),
      
      // Modal Body with Form
      React.createElement(
        "form",
        { 
          className: "modal-body",
          onSubmit: handleSubmit
        },
        
        // Class Name Field (Required)
        React.createElement(
          "div",
          { className: "form-group" },
          React.createElement(
            "label",
            { htmlFor: "class-name" },
            "Class Name ",
            React.createElement("span", { className: "required" }, "*")
          ),
          React.createElement("input", {
            id: "class-name",
            type: "text",
            className: `form-control ${errors.name ? 'error' : ''}`,
            placeholder: "e.g., Math 101, English Literature",
            value: formData.name,
            onChange: (e) => handleInputChange('name', e.target.value),
            disabled: loading
          }),
          errors.name && React.createElement(
            "span",
            { className: "error-message" },
            errors.name
          )
        ),
        
        // Subject Field (Required)
        React.createElement(
          "div",
          { className: "form-group" },
          React.createElement(
            "label",
            { htmlFor: "subject" },
            "Subject ",
            React.createElement("span", { className: "required" }, "*")
          ),
          React.createElement("input", {
            id: "subject",
            type: "text",
            className: `form-control ${errors.subject ? 'error' : ''}`,
            placeholder: "e.g., Mathematics, Science, History",
            value: formData.subject,
            onChange: (e) => handleInputChange('subject', e.target.value),
            disabled: loading
          }),
          errors.subject && React.createElement(
            "span",
            { className: "error-message" },
            errors.subject
          )
        ),
        
        // Grade Level Field (Optional)
        React.createElement(
          "div",
          { className: "form-group" },
          React.createElement("label", { htmlFor: "grade-level" }, "Grade Level"),
          React.createElement("input", {
            id: "grade-level",
            type: "text",
            className: "form-control",
            placeholder: "e.g., 9th Grade, Year 10",
            value: formData.grade_level,
            onChange: (e) => handleInputChange('grade_level', e.target.value),
            disabled: loading
          })
        ),
        
        // Description Field (Optional)
        React.createElement(
          "div",
          { className: "form-group" },
          React.createElement("label", { htmlFor: "description" }, "Description"),
          React.createElement("textarea", {
            id: "description",
            className: "form-control",
            placeholder: "Brief description of the class...",
            rows: 3,
            value: formData.description,
            onChange: (e) => handleInputChange('description', e.target.value),
            disabled: loading
          })
        ),
        
        // Layout field removed - layouts are now selected per seating period
        
        // Submit Error
        errors.submit && React.createElement(
          "div",
          { className: "alert alert-danger" },
          errors.submit
        )
      ),
      
      // Modal Footer with Actions
      React.createElement(
        "div",
        { className: "modal-footer" },
        React.createElement(
          "button",
          { 
            type: "button",
            className: "btn btn-secondary",
            onClick: onClose,
            disabled: loading
          },
          "Cancel"
        ),
        React.createElement(
          "button",
          { 
            type: "submit",
            className: "btn btn-primary",
            onClick: handleSubmit,
            disabled: loading
          },
          loading && React.createElement("i", { 
            className: "fas fa-spinner fa-spin",
            style: { marginRight: "0.5rem" }
          }),
          loading ? "Creating..." : "Create Class"
        )
      )
    )
  );
};

// Export component
if (typeof window !== "undefined") {
  window.ClassCreateModalComponent = ClassCreateModal;
  console.log("ClassCreateModal component loaded");
}