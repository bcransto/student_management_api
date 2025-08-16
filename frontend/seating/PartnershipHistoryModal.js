// PartnershipHistoryModal.js - Modal component for displaying partnership history
console.log("Loading PartnershipHistoryModal component...");

const PartnershipHistoryModal = ({ student, partnershipData, partnershipRatings, onClose }) => {
  // Handle overlay click to close
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  // Handle escape key
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };
  
  // Add/remove escape key listener
  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  // If no student provided, don't render
  if (!student) {
    return null;
  }
  
  // Process partnership data
  const processedData = React.useMemo(() => {
    if (!partnershipData || !partnershipData.partnerships) {
      return { partnered: [], unpaired: [] };
    }
    
    // Get all students from the partnership data
    const allStudentIds = new Set();
    const partneredStudentIds = new Set();
    
    // Collect all student IDs and partnered IDs
    Object.keys(partnershipData.allStudents || {}).forEach(id => {
      allStudentIds.add(id);
    });
    
    // Convert partnerships to array and sort by frequency
    const partnered = Object.entries(partnershipData.partnerships)
      .map(([partnerId, frequency]) => {
        partneredStudentIds.add(partnerId);
        return {
          partnerId,
          frequency,
          partnerName: partnershipData.partnerNames?.[partnerId] || 'Unknown Student',
          gender: partnershipData.genders?.[partnerId] || null
        };
      })
      .sort((a, b) => b.frequency - a.frequency);
    
    // Find unpaired students (all students minus partnered minus self)
    const unpaired = [];
    allStudentIds.forEach(id => {
      if (id !== String(student.id) && !partneredStudentIds.has(id)) {
        const studentName = partnershipData.allStudents?.[id] || 
                          partnershipData.partnerNames?.[id] || 
                          'Unknown Student';
        unpaired.push({ 
          id, 
          name: studentName,
          gender: partnershipData.genders?.[id] || null
        });
      }
    });
    
    // Sort unpaired alphabetically
    unpaired.sort((a, b) => a.name.localeCompare(b.name));
    
    return { partnered, unpaired };
  }, [partnershipData, student.id]);
  
  // Get max frequency for bar chart scaling
  const maxFrequency = Math.max(...processedData.partnered.map(p => p.frequency), 1);
  
  // Get student display name
  const studentDisplayName = `${student.first_name} ${student.last_name}`;
  
  // Helper function to get gender color
  const getGenderColor = (gender) => {
    if (!gender) return '#6b7280'; // Default gray
    const genderLower = gender.toLowerCase();
    if (genderLower === 'male' || genderLower === 'm') {
      return '#3b82f6'; // Blue
    } else if (genderLower === 'female' || genderLower === 'f') {
      return '#10b981'; // Green
    } else {
      return '#8b5cf6'; // Purple for non-binary/other
    }
  };
  
  // Helper function to get lighter gender color for backgrounds
  const getGenderBackgroundColor = (gender) => {
    if (!gender) return '#f9fafb'; // Default very light gray
    const genderLower = gender.toLowerCase();
    if (genderLower === 'male' || genderLower === 'm') {
      return '#eff6ff'; // Very light blue
    } else if (genderLower === 'female' || genderLower === 'f') {
      return '#ecfdf5'; // Very light green
    } else {
      return '#f3f0ff'; // Very light purple for non-binary/other
    }
  };
  
  // Helper function to get rating between two students
  const getPartnerRating = (student1Id, student2Id) => {
    if (!partnershipRatings || !partnershipRatings.grid) {
      return null;
    }
    
    const s1 = String(student1Id);
    const s2 = String(student2Id);
    
    // Check both directions since grid might have either order
    if (partnershipRatings.grid[s1] && partnershipRatings.grid[s1][s2] !== undefined) {
      return partnershipRatings.grid[s1][s2];
    }
    if (partnershipRatings.grid[s2] && partnershipRatings.grid[s2][s1] !== undefined) {
      return partnershipRatings.grid[s2][s1];
    }
    
    return null;
  };
  
  // Helper function to get rating badge
  const getRatingBadge = (rating) => {
    if (rating === null || rating === undefined) return null;
    
    const badges = {
      '-2': { icon: '⛔', text: 'Never', color: '#dc2626', bg: '#fee2e2' },
      '-1': { icon: '⚠️', text: 'Avoid', color: '#d97706', bg: '#fef3c7' },
      '1': { icon: '⭐', text: 'Good', color: '#059669', bg: '#d1fae5' },
      '2': { icon: '💫', text: 'Best', color: '#7c3aed', bg: '#ede9fe' }
    };
    
    const badge = badges[String(rating)];
    if (!badge) return null;
    
    return React.createElement(
      "span",
      { 
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.125rem 0.5rem',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: '600',
          color: badge.color,
          backgroundColor: badge.bg,
          marginLeft: '0.5rem'
        }
      },
      React.createElement("span", null, badge.icon),
      React.createElement("span", null, badge.text)
    );
  };
  
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
        className: "partnership-modal-container",
        style: {
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '600px',
          maxWidth: '90%',
          maxHeight: '80vh',
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
            padding: '1.25rem 1.5rem',
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
              color: '#111827',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            } 
          }, 
          `Partnership History: ${studentDisplayName}`
        ),
        React.createElement(
          "button",
          { 
            onClick: onClose,
            type: "button",
            style: {
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0.25rem',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s ease'
            },
            onMouseEnter: (e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            },
            onMouseLeave: (e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          },
          React.createElement("i", { className: "fas fa-times" })
        )
      ),
      
      // Modal Body
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
        
        // Partnership Chart Section
        processedData.partnered.length > 0 && React.createElement(
          "div",
          { style: { marginBottom: '2rem' } },
          
          // Chart Header
          React.createElement(
            "div",
            { 
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '1rem',
                paddingBottom: '0.5rem',
                borderBottom: '1px solid #e5e7eb'
              }
            },
            React.createElement(
              "span",
              { 
                style: { 
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#6b7280'
                } 
              },
              "Partner"
            ),
            React.createElement(
              "span",
              { 
                style: { 
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#6b7280'
                } 
              },
              "Times Together"
            )
          ),
          
          // Bar Chart
          processedData.partnered.map((partnership) => 
            React.createElement(
              "div",
              { 
                key: partnership.partnerId,
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                  gap: '1rem'
                }
              },
              
              // Partner name with rating badge (left aligned, fixed width)
              React.createElement(
                "div",
                { 
                  style: {
                    width: '200px',
                    fontSize: '0.875rem',
                    color: getGenderColor(partnership.gender),
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center'
                  }
                },
                React.createElement("span", null, partnership.partnerName),
                getRatingBadge(getPartnerRating(student.id, partnership.partnerId))
              ),
              
              // Bar and number container
              React.createElement(
                "div",
                { 
                  style: {
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }
                },
                
                // Bar
                React.createElement(
                  "div",
                  { 
                    style: {
                      flex: 1,
                      height: '24px',
                      backgroundColor: getGenderBackgroundColor(partnership.gender),
                      position: 'relative',
                      borderRadius: '0.375rem',
                      overflow: 'hidden',
                      border: `1px solid ${getGenderBackgroundColor(partnership.gender)}`
                    }
                  },
                  React.createElement(
                    "div",
                    { 
                      style: {
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${(partnership.frequency / maxFrequency) * 100}%`,
                        backgroundColor: getGenderColor(partnership.gender),
                        minWidth: '24px',
                        transition: 'width 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingRight: '0.5rem'
                      }
                    },
                    React.createElement(
                      "span",
                      { 
                        style: {
                          color: 'white',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }
                      },
                      partnership.frequency > 1 ? partnership.frequency : ''
                    )
                  )
                ),
                
                // Frequency number (outside bar)
                React.createElement(
                  "span",
                  { 
                    style: {
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: getGenderColor(partnership.gender),
                      minWidth: '20px',
                      textAlign: 'right'
                    }
                  },
                  partnership.frequency
                )
              )
            )
          )
        ),
        
        // Divider
        (processedData.partnered.length > 0 && processedData.unpaired.length > 0) && 
          React.createElement(
            "div",
            { 
              style: {
                borderTop: '1px solid #e5e7eb',
                margin: '2rem 0'
              }
            }
          ),
        
        // Not Yet Paired With Section
        processedData.unpaired.length > 0 && React.createElement(
          "div",
          null,
          React.createElement(
            "h3",
            { 
              style: {
                fontSize: '0.875rem',
                fontWeight: '500',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
                marginBottom: '1rem'
              }
            },
            "Not Yet Paired With"
          ),
          React.createElement(
            "div",
            { 
              style: {
                fontSize: '0.875rem',
                lineHeight: '1.75',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }
            },
            processedData.unpaired.map((student, index) => 
              React.createElement(
                React.Fragment,
                { key: student.id },
                React.createElement(
                  "span",
                  { 
                    style: { 
                      backgroundColor: getGenderBackgroundColor(student.gender),
                      color: getGenderColor(student.gender),
                      fontWeight: '500',
                      padding: '0.25rem 0.625rem',
                      borderRadius: '0.375rem',
                      border: `1px solid ${getGenderColor(student.gender)}20`,
                      display: 'inline-block'
                    } 
                  },
                  student.name
                )
              )
            )
          )
        ),
        
        // Empty state
        processedData.partnered.length === 0 && processedData.unpaired.length === 0 &&
          React.createElement(
            "div",
            { 
              style: {
                textAlign: 'center',
                padding: '3rem',
                color: '#9ca3af'
              }
            },
            React.createElement(
              "i",
              { 
                className: "fas fa-users",
                style: {
                  fontSize: '3rem',
                  marginBottom: '1rem',
                  opacity: 0.5
                }
              }
            ),
            React.createElement(
              "p",
              { 
                style: {
                  margin: 0,
                  fontSize: '0.875rem'
                }
              },
              "No partnership data available for this student."
            )
          )
      ),
      
      // Modal Footer
      React.createElement(
        "div",
        { 
          className: "modal-footer",
          style: {
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: '#f9fafb'
          }
        },
        React.createElement(
          "button",
          { 
            type: "button",
            onClick: onClose,
            style: {
              padding: '0.5rem 1.25rem',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'background-color 0.15s ease'
            },
            onMouseEnter: (e) => {
              e.currentTarget.style.backgroundColor = '#4b5563';
            },
            onMouseLeave: (e) => {
              e.currentTarget.style.backgroundColor = '#6b7280';
            }
          },
          "Close"
        )
      )
    )
  );
};

// Export component
if (typeof window !== "undefined") {
  window.PartnershipHistoryModal = PartnershipHistoryModal;
  console.log("PartnershipHistoryModal component loaded");
}