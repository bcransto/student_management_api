// SeatingConstants.js - Constants and configuration for seating optimization
console.log("Loading SeatingConstants module...");

const SeatingConstants = {
  // Partnership rating levels
  RATING_LEVELS: {
    NEVER_TOGETHER: -2,
    AVOID: -1,
    NEUTRAL: 0,
    GOOD: 1,
    BEST: 2
  },
  
  // Rating display information
  RATING_INFO: {
    '-2': {
      label: 'Never Together',
      icon: '⛔',
      color: '#dc2626',
      backgroundColor: '#fee2e2',
      description: 'These students should never be seated together'
    },
    '-1': {
      label: 'Avoid',
      icon: '⚠️',
      color: '#d97706',
      backgroundColor: '#fef3c7',
      description: 'Try to avoid seating these students together'
    },
    '0': {
      label: 'Neutral',
      icon: '➖',
      color: '#6b7280',
      backgroundColor: '#f3f4f6',
      description: 'No preference for these students'
    },
    '1': {
      label: 'Good',
      icon: '⭐',
      color: '#059669',
      backgroundColor: '#d1fae5',
      description: 'These students work well together'
    },
    '2': {
      label: 'Best',
      icon: '💫',
      color: '#7c3aed',
      backgroundColor: '#ede9fe',
      description: 'These students work best together'
    }
  },
  
  // Optimizer presets
  OPTIMIZER_PRESETS: {
    QUICK: {
      name: 'Quick',
      description: 'Fast optimization with good results',
      maxIterations: 500,
      initialTemperature: 50,
      coolingRate: 0.95,
      minTemperature: 0.1,
      timeLimit: 5000, // 5 seconds
      icon: '⚡'
    },
    BALANCED: {
      name: 'Balanced',
      description: 'Balance between speed and quality',
      maxIterations: 2000,
      initialTemperature: 100,
      coolingRate: 0.98,
      minTemperature: 0.01,
      timeLimit: 15000, // 15 seconds
      icon: '⚖️'
    },
    THOROUGH: {
      name: 'Thorough',
      description: 'Best results, takes more time',
      maxIterations: 5000,
      initialTemperature: 150,
      coolingRate: 0.99,
      minTemperature: 0.001,
      timeLimit: 30000, // 30 seconds
      icon: '🎯'
    }
  },
  
  // Scoring weights for optimization
  SCORING_WEIGHTS: {
    NEVER_TOGETHER_VIOLATION: 1000,  // Heavy penalty for breaking hard constraints
    AVOID_PAIRING: 50,               // Moderate penalty for pairing students who should avoid each other
    GOOD_PAIRING: -20,               // Reward for pairing students who work well together
    BEST_PAIRING: -40,               // Higher reward for best pairings
    REPEAT_PARTNERSHIP: 10,          // Penalty that increases with repetition count
    GENDER_IMBALANCE: 5,            // Penalty per unit of gender imbalance
    EMPTY_SEAT: 2                    // Small penalty for leaving seats empty
  },
  
  // Partnership history weights (for lottery system)
  PARTNERSHIP_WEIGHTS: {
    NEVER_PAIRED: 10,    // 10 lottery balls for students never paired
    PAIRED_ONCE: 10,     // 10 lottery balls for students paired once
    PAIRED_TWICE: 5,     // 5 lottery balls for students paired twice
    PAIRED_THRICE: 2,    // 2 lottery balls for students paired three times
    PAIRED_MANY: 1       // 1 lottery ball for students paired 4+ times
  },
  
  // UI Messages
  MESSAGES: {
    OPTIMIZER_START: 'Starting seating optimization...',
    OPTIMIZER_COMPLETE: 'Optimization complete!',
    OPTIMIZER_CANCELLED: 'Optimization cancelled',
    OPTIMIZER_ERROR: 'An error occurred during optimization',
    NO_STUDENTS: 'No students available to optimize',
    NO_LAYOUT: 'No classroom layout selected',
    CONSTRAINT_VIOLATIONS: 'Found {count} constraint violation(s)',
    APPLYING_CHANGES: 'Applying optimized seating...',
    CHANGES_APPLIED: 'Seating arrangement updated'
  },
  
  // Animation and UI constants
  UI: {
    ANIMATION_DURATION: 300,     // milliseconds for animations
    PROGRESS_UPDATE_INTERVAL: 100, // milliseconds between progress updates
    HIGHLIGHT_DURATION: 2000,    // milliseconds to highlight changes
    DEBOUNCE_DELAY: 250         // milliseconds for debouncing
  },
  
  // Colors for UI elements
  COLORS: {
    SUCCESS: '#10b981',
    WARNING: '#f59e0b',
    ERROR: '#ef4444',
    INFO: '#3b82f6',
    NEUTRAL: '#6b7280',
    HIGHLIGHT: '#fbbf24',
    MALE: '#3b82f6',
    FEMALE: '#10b981',
    OTHER: '#8b5cf6'
  },
  
  // Fill modes
  FILL_MODES: {
    RANDOM: {
      id: 'random',
      name: 'Random',
      description: 'Randomly assign students to seats',
      icon: '🎲'
    },
    MATCH_GENDER: {
      id: 'matchGender',
      name: 'Match Gender',
      description: 'Group students by gender',
      icon: '👥'
    },
    BALANCE_GENDER: {
      id: 'balanceGender',
      name: 'Balance Gender',
      description: 'Balance genders at each table',
      icon: '⚖️'
    },
    SMART_PAIR: {
      id: 'smartPair',
      name: 'Smart Pair',
      description: 'Find optimal partner for selected student',
      icon: '🎯'
    },
    OPTIMIZE: {
      id: 'optimize',
      name: 'Optimize All',
      description: 'Optimize entire seating arrangement',
      icon: '✨'
    }
  },
  
  // Helper functions
  getRatingInfo: function(rating) {
    return this.RATING_INFO[String(rating)] || this.RATING_INFO['0'];
  },
  
  getRatingIcon: function(rating) {
    const info = this.getRatingInfo(rating);
    return info ? info.icon : '➖';
  },
  
  getRatingColor: function(rating) {
    const info = this.getRatingInfo(rating);
    return info ? info.color : '#6b7280';
  },
  
  getPartnershipWeight: function(partnershipCount) {
    if (partnershipCount === 0) return this.PARTNERSHIP_WEIGHTS.NEVER_PAIRED;
    if (partnershipCount === 1) return this.PARTNERSHIP_WEIGHTS.PAIRED_ONCE;
    if (partnershipCount === 2) return this.PARTNERSHIP_WEIGHTS.PAIRED_TWICE;
    if (partnershipCount === 3) return this.PARTNERSHIP_WEIGHTS.PAIRED_THRICE;
    return this.PARTNERSHIP_WEIGHTS.PAIRED_MANY;
  },
  
  formatMessage: function(messageKey, replacements = {}) {
    let message = this.MESSAGES[messageKey] || messageKey;
    Object.entries(replacements).forEach(([key, value]) => {
      message = message.replace(`{${key}}`, value);
    });
    return message;
  }
};

// Export to global scope
if (typeof window !== "undefined") {
  window.SeatingConstants = SeatingConstants;
  console.log("SeatingConstants module loaded");
}