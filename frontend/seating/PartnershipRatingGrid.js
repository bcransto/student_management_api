// PartnershipRatingGrid.js - Grid component for managing partnership ratings
console.log("Loading PartnershipRatingGrid component...");

const PartnershipRatingGrid = ({ students, classId, onClose, existingRatings }) => {
  // State for tracking rating changes
  const [ratings, setRatings] = React.useState({});
  const [hasChanges, setHasChanges] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  
  // Rating options
  const RATING_OPTIONS = [
    { value: -2, label: 'Never', color: '#ef4444' },     // Red
    { value: -1, label: 'Negative', color: '#f97316' },  // Orange
    { value: 0, label: 'Neutral', color: '#6b7280' },    // Gray
    { value: 1, label: 'Positive', color: '#10b981' },   // Green
    { value: 2, label: 'Always', color: '#3b82f6' }      // Blue
  ];
  
  // Initialize ratings from existing data
  React.useEffect(() => {
    if (existingRatings && existingRatings.grid) {
      const initialRatings = {};
      Object.entries(existingRatings.grid).forEach(([student1Id, data]) => {
        Object.entries(data.ratings).forEach(([student2Id, rating]) => {
          const key = `${student1Id}-${student2Id}`;
          initialRatings[key] = rating;
        });
      });
      setRatings(initialRatings);
    }
  }, [existingRatings]);
  
  // Handle rating change
  const handleRatingChange = (student1Id, student2Id, value) => {
    const key = `${student1Id}-${student2Id}`;
    const reverseKey = `${student2Id}-${student1Id}`;
    
    setRatings(prev => ({
      ...prev,
      [key]: parseInt(value),
      [reverseKey]: parseInt(value)  // Keep bidirectional consistency
    }));
    setHasChanges(true);
    setError(null);
  };
  
  // Get rating value for a pair
  const getRating = (student1Id, student2Id) => {
    // Always use lower ID first for consistency
    const id1 = Math.min(student1Id, student2Id);
    const id2 = Math.max(student1Id, student2Id);
    const key = `${id1}-${id2}`;
    
    if (ratings.hasOwnProperty(key)) {
      return ratings[key];
    }
    
    // Check reverse key as fallback
    const reverseKey = `${id2}-${id1}`;
    if (ratings.hasOwnProperty(reverseKey)) {
      return ratings[reverseKey];
    }
    
    return 0; // Default to neutral
  };
  
  // Handle save
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    try {
      // Prepare ratings for bulk update
      const ratingsToUpdate = [];
      const processedPairs = new Set();
      
      Object.entries(ratings).forEach(([key, rating]) => {
        const [s1, s2] = key.split('-').map(Number);
        const pairKey = `${Math.min(s1, s2)}-${Math.max(s1, s2)}`;
        
        // Only process each pair once
        if (!processedPairs.has(pairKey)) {
          processedPairs.add(pairKey);
          ratingsToUpdate.push({
            student1_id: Math.min(s1, s2),
            student2_id: Math.max(s1, s2),
            rating: rating
          });
        }
      });
      
      // Call bulk update API
      const response = await window.ApiModule.request(
        `/api/classes/${classId}/bulk-update-ratings/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ratings: ratingsToUpdate })
        }
      );
      
      if (response.total_errors > 0) {
        console.error('Some ratings failed to update:', response.errors);
        setError(`Updated ${response.total_updated} ratings, ${response.total_errors} failed`);
      } else {
        console.log(`Successfully updated ${response.total_updated} ratings`);
        // Close modal on successful save
        if (onClose) onClose(true); // Pass true to indicate changes were saved
      }
      
    } catch (err) {
      console.error('Failed to save ratings:', err);
      setError(err.message || 'Failed to save ratings');
    } finally {
      setSaving(false);
    }
  };
  
  // Handle overlay click to close
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !hasChanges) {
      onClose();
    }
  };
  
  // Handle escape key
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && !hasChanges) {
      onClose();
    }
  };
  
  // Add/remove escape key listener
  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasChanges]);
  
  // Get formatting utility
  const { formatStudentNameTwoLine } = window.SharedUtils || {};
  
  // Don't render if no students
  if (!students || students.length === 0) {
    return null;
  }
  
  return React.createElement(
    "div",
    { 
      className: "modal-overlay",
      onClick: handleOverlayClick,
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }
    },
    React.createElement(
      "div",
      { 
        className: "rating-grid-modal",
        style: {
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '900px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden'
        }
      },
      
      // Modal Header
      React.createElement(
        "div",
        { 
          className: "modal-header",
          style: {
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f9fafb'
          }
        },
        React.createElement(
          "h2", 
          { 
            style: { 
              margin: 0,
              fontSize: '1.125rem',
              fontWeight: '600',
              color: '#111827'
            } 
          }, 
          "Partnership Ratings"
        ),
        React.createElement(
          "div",
          { 
            style: {
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center'
            }
          },
          // Save button
          React.createElement(
            "button",
            { 
              onClick: handleSave,
              disabled: !hasChanges || saving,
              style: {
                padding: '0.5rem 1rem',
                backgroundColor: hasChanges ? '#10b981' : '#e5e7eb',
                color: hasChanges ? 'white' : '#9ca3af',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: hasChanges && !saving ? 'pointer' : 'not-allowed',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.15s ease'
              }
            },
            saving ? 'Saving...' : 'Save'
          ),
          // Cancel button
          React.createElement(
            "button",
            { 
              onClick: () => {
                if (hasChanges) {
                  if (confirm('You have unsaved changes. Are you sure you want to close?')) {
                    onClose();
                  }
                } else {
                  onClose();
                }
              },
              style: {
                padding: '0.5rem 1rem',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'background-color 0.15s ease'
              }
            },
            'Cancel'
          ),
          // Close X button
          React.createElement(
            "button",
            { 
              onClick: () => onClose(),
              type: "button",
              style: {
                background: 'none',
                border: 'none',
                fontSize: '1.25rem',
                cursor: 'pointer',
                color: '#6b7280',
                padding: '0.25rem',
                borderRadius: '0.375rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }
            },
            React.createElement("i", { className: "fas fa-times" })
          )
        )
      ),
      
      // Error message
      error && React.createElement(
        "div",
        { 
          style: {
            padding: '0.75rem 1.5rem',
            backgroundColor: '#fef2f2',
            borderBottom: '1px solid #fecaca',
            color: '#dc2626',
            fontSize: '0.875rem'
          }
        },
        error
      ),
      
      // Modal Body - Grid Table
      React.createElement(
        "div",
        { 
          className: "modal-body",
          style: {
            padding: '1.5rem',
            overflowY: 'auto',
            flex: 1,
            backgroundColor: 'white'
          }
        },
        
        // Legend
        React.createElement(
          "div",
          { 
            style: {
              marginBottom: '1rem',
              padding: '0.75rem',
              backgroundColor: '#f9fafb',
              borderRadius: '0.5rem',
              display: 'flex',
              gap: '1.5rem',
              fontSize: '0.75rem',
              flexWrap: 'wrap'
            }
          },
          RATING_OPTIONS.map(option => 
            React.createElement(
              "div",
              { 
                key: option.value,
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }
              },
              React.createElement(
                "span",
                { 
                  style: {
                    width: '12px',
                    height: '12px',
                    backgroundColor: option.color,
                    borderRadius: '2px'
                  }
                }
              ),
              React.createElement(
                "span",
                { style: { color: '#6b7280' } },
                option.label
              )
            )
          )
        ),
        
        // Grid Table
        React.createElement(
          "div",
          { 
            style: {
              overflowX: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem'
            }
          },
          React.createElement(
            "table",
            { 
              style: {
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.875rem'
              }
            },
            // Table Header
            React.createElement(
              "thead",
              null,
              React.createElement(
                "tr",
                null,
                // Empty corner cell
                React.createElement(
                  "th",
                  { 
                    style: {
                      padding: '0.75rem',
                      backgroundColor: '#f9fafb',
                      borderBottom: '1px solid #e5e7eb',
                      borderRight: '1px solid #e5e7eb',
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      minWidth: '120px'
                    }
                  }
                ),
                // Student column headers - start from second student
                students.slice(1).map((student, index) => {
                  const nameData = formatStudentNameTwoLine ? formatStudentNameTwoLine(student) : 
                    { line1: student.nickname || student.first_name, line2: student.last_name?.substring(0, 3) + '.' };
                  
                  return React.createElement(
                    "th",
                    { 
                      key: student.id,
                      style: {
                        padding: '0.5rem',
                        backgroundColor: '#f9fafb',
                        borderBottom: '1px solid #e5e7eb',
                        borderRight: index < students.length - 2 ? '1px solid #e5e7eb' : 'none',
                        textAlign: 'center',
                        fontWeight: '500',
                        color: '#374151',
                        minWidth: '100px',
                        height: '60px',
                        verticalAlign: 'middle'
                      }
                    },
                    React.createElement(
                      "div",
                      { style: { lineHeight: '1.2' } },
                      React.createElement("div", { style: { fontSize: '0.875rem' } }, nameData.line1),
                      React.createElement("div", { style: { fontSize: '0.75rem', color: '#6b7280' } }, nameData.line2)
                    )
                  );
                })
              )
            ),
            // Table Body
            React.createElement(
              "tbody",
              null,
              students.slice(0, -1).map((rowStudent, rowIndex) => {
                const nameData = formatStudentNameTwoLine ? formatStudentNameTwoLine(rowStudent) : 
                  { line1: rowStudent.nickname || rowStudent.first_name, line2: rowStudent.last_name?.substring(0, 3) + '.' };
                
                return React.createElement(
                  "tr",
                  { key: rowStudent.id },
                  // Row header (student name)
                  React.createElement(
                    "th",
                    { 
                      style: {
                        padding: '0.5rem 0.75rem',
                        backgroundColor: '#f9fafb',
                        borderRight: '1px solid #e5e7eb',
                        borderBottom: rowIndex < students.length - 2 ? '1px solid #e5e7eb' : 'none',
                        textAlign: 'left',
                        fontWeight: '500',
                        color: '#374151',
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        minWidth: '120px'
                      }
                    },
                    React.createElement(
                      "div",
                      { style: { lineHeight: '1.2' } },
                      React.createElement("div", { style: { fontSize: '0.875rem' } }, nameData.line1),
                      React.createElement("div", { style: { fontSize: '0.75rem', color: '#6b7280' } }, nameData.line2)
                    )
                  ),
                  // Rating cells - skip first column since we start headers from second student
                  students.slice(1).map((colStudent, colIndex) => {
                    // Adjust index since we sliced
                    const actualColIndex = colIndex + 1;
                    const isUpperTriangle = actualColIndex > rowIndex;
                    const isDiagonal = actualColIndex === rowIndex;
                    const isLowerTriangle = actualColIndex < rowIndex;
                    const currentRating = getRating(rowStudent.id, colStudent.id);
                    const ratingOption = RATING_OPTIONS.find(opt => opt.value === currentRating);
                    
                    return React.createElement(
                      "td",
                      { 
                        key: colStudent.id,
                        style: {
                          padding: '0.25rem',
                          borderRight: colIndex < students.length - 2 ? '1px solid #e5e7eb' : 'none',
                          borderBottom: rowIndex < students.length - 2 ? '1px solid #e5e7eb' : 'none',
                          textAlign: 'center',
                          backgroundColor: isDiagonal || isLowerTriangle ? '#f3f4f6' : 'white'
                        }
                      },
                      // Only show dropdown in upper triangle
                      isUpperTriangle ? 
                        React.createElement(
                          "select",
                          { 
                            value: currentRating,
                            onChange: (e) => handleRatingChange(rowStudent.id, colStudent.id, e.target.value),
                            style: {
                              width: '90px',
                              padding: '0.25rem',
                              fontSize: '0.75rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '0.25rem',
                              backgroundColor: ratingOption ? `${ratingOption.color}20` : 'white',
                              color: ratingOption ? ratingOption.color : '#374151',
                              cursor: 'pointer'
                            }
                          },
                          RATING_OPTIONS.map(option => 
                            React.createElement(
                              "option",
                              { 
                                key: option.value,
                                value: option.value
                              },
                              option.label
                            )
                          )
                        ) :
                        // Diagonal and lower triangle are grayed out
                        React.createElement(
                          "span",
                          { 
                            style: {
                              color: '#9ca3af',
                              fontSize: '0.75rem'
                            }
                          },
                          "—"
                        )
                    );
                  })
                );
              })
            )
          )
        ),
        
        // Instructions
        React.createElement(
          "div",
          { 
            style: {
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: '#f0f9ff',
              borderRadius: '0.5rem',
              fontSize: '0.75rem',
              color: '#0369a1'
            }
          },
          React.createElement("i", { className: "fas fa-info-circle", style: { marginRight: '0.5rem' } }),
          "Rate how well each pair of students works together. Changes are saved when you click Save."
        )
      )
    )
  );
};

// Export component
if (typeof window !== "undefined") {
  window.PartnershipRatingGrid = PartnershipRatingGrid;
  console.log("PartnershipRatingGrid component loaded");
}