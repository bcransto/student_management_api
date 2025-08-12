// Shared layout styles for seating viewer and layout editor
const LayoutStyles = {
  // Grid configuration
  GRID_SIZE: 50, // Default grid size, can be overridden
  
  // Color palette
  colors: {
    // Table colors
    table: {
      background: '#dbeafe',
      border: '#60a5fa',
      borderSelected: '#2563eb',
      labelColor: '#ffffff',
      labelShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
    },
    // Seat colors
    seat: {
      empty: {
        background: '#e0f2fe',  // Very light blue
        border: '#7dd3fc',      // Light blue border
        text: '#0284c7'         // Blue text
      },
      occupied: {
        background: '#3b82f6',
        border: '#2563eb',
        text: '#ffffff'
      },
      selected: {
        background: '#fbbf24',
        border: '#f59e0b',
        text: '#92400e',
        glow: 'rgba(251, 191, 36, 0.3)'
      },
      accessible: {
        background: '#34d399',
        border: '#059669',
        text: '#047857'
      }
    },
    // Canvas colors
    canvas: {
      background: '#ffffff',
      border: '#e5e7eb',
      gridLine: '#e5e7eb',
      shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
    },
    // Obstacle colors
    obstacle: {
      border: '#6b7280',
      borderSelected: '#ea580c',
      glowSelected: 'rgba(234, 88, 12, 0.2)'
    }
  },

  // Canvas container style
  getCanvasContainerStyle: (width, height, gridSize = 50) => ({
    width: width * gridSize,
    height: height * gridSize,
    position: 'relative',
    backgroundColor: LayoutStyles.colors.canvas.background,
    border: `2px solid ${LayoutStyles.colors.canvas.border}`,
    borderRadius: '8px',
    overflow: 'visible',
    boxShadow: LayoutStyles.colors.canvas.shadow
  }),

  // Grid background style
  getGridStyle: (gridSize = 50) => ({
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    backgroundImage: `
      linear-gradient(to right, ${LayoutStyles.colors.canvas.gridLine} 1px, transparent 1px),
      linear-gradient(to bottom, ${LayoutStyles.colors.canvas.gridLine} 1px, transparent 1px)
    `,
    backgroundSize: `${gridSize}px ${gridSize}px`
  }),

  // Table style
  getTableStyle: (table, isSelected = false, isDragging = false, gridSize = 50) => ({
    position: 'absolute',
    left: table.x_position * gridSize,
    top: table.y_position * gridSize,
    width: table.width * gridSize,
    height: table.height * gridSize,
    backgroundColor: LayoutStyles.colors.table.background,
    border: `2px solid ${isSelected ? LayoutStyles.colors.table.borderSelected : LayoutStyles.colors.table.border}`,
    borderRadius: table.table_shape === 'round' ? '50%' : '8px',
    transform: isDragging ? 'scale(1.05)' : 'scale(1)',
    boxShadow: isSelected ? '0 0 0 4px rgba(59, 130, 246, 0.2)' : 'none',
    transition: 'all 0.2s',
    zIndex: isSelected ? 10 : 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  }),

  // Table label style
  getTableLabelStyle: () => ({
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '24px',
    fontWeight: 'bold',
    color: LayoutStyles.colors.table.labelColor,
    textShadow: LayoutStyles.colors.table.labelShadow,
    pointerEvents: 'none',
    zIndex: 5
  }),

  // Seat style - Always 80% of grid size
  getSeatStyle: (seat, options = {}) => {
    const {
      isOccupied = false,
      isSelected = false,
      isAccessible = false,
      gridSize = 50,
      showName = false
    } = options;

    // Determine colors based on state
    let colorSet;
    if (isSelected) {
      colorSet = LayoutStyles.colors.seat.selected;
    } else if (isAccessible) {
      colorSet = LayoutStyles.colors.seat.accessible;
    } else if (isOccupied) {
      colorSet = LayoutStyles.colors.seat.occupied;
    } else {
      colorSet = LayoutStyles.colors.seat.empty;
    }

    // Fixed size: always 80% of grid
    const seatSize = gridSize * 0.8;

    return {
      position: 'absolute',
      left: `calc(${seat.relative_x * 100}% - ${seatSize / 2}px)`,
      top: `calc(${seat.relative_y * 100}% - ${seatSize / 2}px)`,
      width: `${seatSize}px`,
      height: `${seatSize}px`,
      backgroundColor: colorSet.background,
      border: isSelected ? `3px solid ${colorSet.border}` : `2px solid ${colorSet.border}`,
      borderRadius: '50%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: showName ? '12px' : '16px',
      fontWeight: 'bold',
      color: colorSet.text,
      transition: 'all 0.2s',
      boxShadow: isSelected ? `0 0 0 3px ${colorSet.glow || 'transparent'}` : 'none',
      zIndex: isSelected ? 5 : (isOccupied ? 2 : 1),
      overflow: 'hidden',
      padding: showName ? '2px' : '0',
      lineHeight: showName ? '1.2' : 'normal',
      textAlign: 'center'
    };
  },

  // Obstacle style
  getObstacleStyle: (obstacle, isSelected = false, isDragging = false, gridSize = 50) => ({
    position: 'absolute',
    left: obstacle.x_position * gridSize,
    top: obstacle.y_position * gridSize,
    width: obstacle.width * gridSize,
    height: obstacle.height * gridSize,
    backgroundColor: obstacle.color || '#808080',
    border: `2px solid ${isSelected ? LayoutStyles.colors.obstacle.borderSelected : LayoutStyles.colors.obstacle.border}`,
    borderRadius: '4px',
    transform: isDragging ? 'scale(1.05)' : 'scale(1)',
    boxShadow: isSelected ? `0 0 0 4px ${LayoutStyles.colors.obstacle.glowSelected}` : 'none',
    transition: 'all 0.2s',
    zIndex: isSelected ? 10 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }),

  // Obstacle label style
  getObstacleLabelStyle: () => ({
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '600',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
    pointerEvents: 'none'
  }),

  // Helper function to format name for two-line display
  // Updated to use nickname and 3-letter last name truncation
  formatSeatName: (nicknameOrFirstName, lastName) => {
    if (!nicknameOrFirstName && !lastName) return { line1: '', line2: '' };
    
    // First line: Use nickname (or first name as fallback)
    const line1 = nicknameOrFirstName || '';
    
    // Second line: Last name truncated to 3 chars
    let line2 = '';
    if (lastName) {
      if (lastName.length <= 3) {
        // Short last names don't need period
        line2 = lastName;
      } else {
        // Truncate and add period
        line2 = lastName.substring(0, 3) + '.';
      }
    }
    
    return { line1, line2 };
  }
};

// Export for use in other modules
if (typeof window !== "undefined") {
  window.LayoutStyles = LayoutStyles;
  console.log("LayoutStyles module loaded");
}