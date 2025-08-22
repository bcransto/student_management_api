// frontend/attendance/AttendanceVisual.js
// Visual attendance editor using seating chart layout

const { useState, useEffect, useRef } = React;

const AttendanceVisual = ({ classId, date, onBack, navigateTo }) => {
  // Core state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Data state
  const [classInfo, setClassInfo] = useState(null);
  const [currentDate, setCurrentDate] = useState(date || new Date().toISOString().split('T')[0]);
  
  // Canvas ref for rendering
  const canvasRef = useRef(null);
  
  // Load initial data
  useEffect(() => {
    if (classId) {
      loadClassData();
    }
  }, [classId, currentDate]);
  
  // Load class data
  const loadClassData = async () => {
    try {
      setLoading(true);
      console.log("Loading visual attendance for class:", classId, "date:", currentDate);
      
      // Load class info
      const classData = await window.ApiModule.request(`/classes/${classId}/`);
      console.log("Class data loaded:", classData);
      setClassInfo(classData);
      
      // TODO: Load seating layout
      // TODO: Load attendance data
      
    } catch (error) {
      console.error("Failed to load class data:", error);
      alert("Failed to load class information. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Handle save
  const handleSave = async () => {
    if (!hasUnsavedChanges) {
      console.log("No changes to save");
      return;
    }
    
    try {
      setSaving(true);
      console.log("Saving visual attendance...");
      
      // TODO: Implement save logic
      
      setHasUnsavedChanges(false);
      alert("Attendance saved successfully!");
      
    } catch (error) {
      console.error("Failed to save attendance:", error);
      alert("Failed to save attendance. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  
  // Handle back navigation
  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (!confirm("You have unsaved changes. Do you want to leave without saving?")) {
        return;
      }
    }
    
    if (onBack) {
      onBack();
    } else if (navigateTo) {
      navigateTo('attendance');
    } else {
      window.location.hash = '#attendance';
    }
  };
  
  // Format date for display
  const formatDateDisplay = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // Render loading state
  if (loading) {
    return React.createElement(
      "div",
      { className: "attendance-visual-container" },
      React.createElement(
        "div",
        { className: "attendance-visual-loading" },
        React.createElement("i", { className: "fas fa-spinner fa-spin fa-3x" }),
        React.createElement("p", null, "Loading visual attendance...")
      )
    );
  }
  
  // Render main component
  return React.createElement(
    "div",
    { className: "attendance-visual-container" },
    
    // Minimal header
    React.createElement(
      "div",
      { className: "attendance-visual-header" },
      
      // Back button
      React.createElement(
        "button",
        { 
          className: "av-btn-back",
          onClick: handleBack,
          title: "Back to class list"
        },
        React.createElement("i", { className: "fas fa-arrow-left" })
      ),
      
      // Class and date info
      React.createElement(
        "div",
        { className: "av-header-info" },
        React.createElement(
          "span",
          { className: "av-class-name" },
          classInfo?.name || "Class"
        ),
        React.createElement(
          "span",
          { className: "av-date" },
          formatDateDisplay(currentDate)
        )
      ),
      
      // Save button
      React.createElement(
        "button",
        { 
          className: `av-btn-save ${hasUnsavedChanges ? 'has-changes' : ''}`,
          onClick: handleSave,
          disabled: saving || !hasUnsavedChanges,
          title: hasUnsavedChanges ? "Save changes" : "No changes to save"
        },
        saving ? 
          React.createElement("i", { className: "fas fa-spinner fa-spin" }) :
          React.createElement("i", { className: "fas fa-save" }),
        saving ? " Saving" : " Save"
      )
    ),
    
    // Canvas area
    React.createElement(
      "div",
      { className: "attendance-visual-canvas-container" },
      React.createElement("canvas", {
        ref: canvasRef,
        className: "attendance-visual-canvas",
        onMouseDown: (e) => {
          // TODO: Handle seat clicks
          console.log("Canvas clicked");
        }
      }),
      
      // Placeholder message for Phase 1
      !classInfo?.classroom_layout && React.createElement(
        "div",
        { className: "av-no-layout" },
        React.createElement("i", { className: "fas fa-th fa-3x" }),
        React.createElement("h3", null, "No Seating Layout"),
        React.createElement("p", null, "This class needs a seating layout for visual attendance."),
        React.createElement("p", null, "(Canvas rendering will be implemented in Phase 2)")
      )
    )
  );
};

// Export for use
window.AttendanceVisual = AttendanceVisual;
console.log("AttendanceVisual component loaded and exported to window.AttendanceVisual");