// SeatingUtils.js - Shared utility functions for seating optimization
console.log("Loading SeatingUtils module...");

const SeatingUtils = {
  /**
   * Get partnership data for a specific student
   * Copied from SeatingEditor.js - will be refactored to use this version later
   */
  getStudentPartnershipData: (studentId, partnershipHistory, students) => {
    if (!partnershipHistory || !studentId) {
      return null;
    }
    
    const studentIdStr = String(studentId);
    const studentData = partnershipHistory[studentIdStr];
    
    // Get all active students in the class
    const allStudents = {};
    const partnerNames = {};
    const genders = {};
    
    // Build list of all students from partnership history and their genders
    Object.entries(partnershipHistory).forEach(([id, data]) => {
      if (data.is_active) {
        allStudents[id] = data.name;
        partnerNames[id] = data.name;
        // Get gender from the students array
        const studentObj = students.find(s => String(s.id) === id);
        if (studentObj) {
          genders[id] = studentObj.gender;
        }
      }
    });
    
    if (!studentData) {
      return {
        studentId: studentIdStr,
        name: "Unknown Student",
        partnerships: {},
        partnerNames: partnerNames,
        allStudents: allStudents,
        genders: genders,
        totalPartners: 0
      };
    }
    
    // Calculate partnership frequencies (just the count, not the full data)
    const partnerships = {};
    Object.entries(studentData.partnerships || {}).forEach(([partnerId, dates]) => {
      partnerships[partnerId] = dates.length;
    });
    
    return {
      studentId: studentIdStr,
      name: studentData.name,
      isActive: studentData.is_active,
      partnerships: partnerships,
      partnerNames: partnerNames,
      allStudents: allStudents,
      genders: genders,
      totalPartners: Object.keys(partnerships).length
    };
  },
  
  /**
   * Check if there are any "Never Together" restrictions
   * Copied from SeatingEditor.js - will be refactored to use this version later
   */
  hasPartnershipRestrictions: (partnershipRatings) => {
    if (!partnershipRatings || !partnershipRatings.grid) {
      console.log("No partnership ratings available for restrictions check");
      return false;
    }
    
    console.log("Checking for partnership restrictions in grid:", partnershipRatings.grid);
    
    // Check if any rating is -2 (Never Together)
    let restrictionCount = 0;
    for (const student1 in partnershipRatings.grid) {
      // The grid structure is: grid[student1].ratings[student2] = rating
      const studentData = partnershipRatings.grid[student1];
      if (studentData && studentData.ratings) {
        for (const student2 in studentData.ratings) {
          if (studentData.ratings[student2] === -2) {
            restrictionCount++;
            console.log(`Found restriction: Student ${student1} (${studentData.student_name}) and ${student2} are Never Together (-2)`);
          }
        }
      }
    }
    
    console.log(`Total restrictions found: ${restrictionCount}`);
    return restrictionCount > 0;
  },
  
  /**
   * Get the partnership rating between two students
   * @param {String|Number} student1Id - First student ID
   * @param {String|Number} student2Id - Second student ID
   * @param {Object} partnershipRatings - Partnership ratings data
   * @returns {Number|null} - Rating value or null if not found
   */
  getPartnershipRating: (student1Id, student2Id, partnershipRatings) => {
    if (!partnershipRatings || !partnershipRatings.grid) {
      return null;
    }
    
    const s1 = String(student1Id);
    const s2 = String(student2Id);
    
    // Check both directions since the grid might have either order
    if (partnershipRatings.grid[s1]?.ratings?.[s2] !== undefined) {
      return partnershipRatings.grid[s1].ratings[s2];
    }
    if (partnershipRatings.grid[s2]?.ratings?.[s1] !== undefined) {
      return partnershipRatings.grid[s2].ratings[s1];
    }
    
    return null;
  },
  
  /**
   * Count how many times two students have been partners
   * @param {String|Number} student1Id - First student ID
   * @param {String|Number} student2Id - Second student ID
   * @param {Object} partnershipHistory - Partnership history data
   * @returns {Number} - Number of times partnered
   */
  getPartnershipCount: (student1Id, student2Id, partnershipHistory) => {
    if (!partnershipHistory) return 0;
    
    const s1 = String(student1Id);
    const s2 = String(student2Id);
    
    // Check if student1 has partnership data
    const student1Data = partnershipHistory[s1];
    if (!student1Data || !student1Data.partnerships) return 0;
    
    // Check if student2 is in student1's partnerships
    const partnerships = student1Data.partnerships[s2];
    if (!partnerships) return 0;
    
    // Return the count of partnership dates
    return partnerships.length;
  },
  
  /**
   * Get all students at a specific table
   * @param {String|Number} tableId - Table ID
   * @param {Object} assignments - Current assignments
   * @returns {Array} - Array of student IDs at the table
   */
  getStudentsAtTable: (tableId, assignments) => {
    const tableIdStr = String(tableId);
    const tableAssignments = assignments[tableIdStr] || {};
    return Object.values(tableAssignments).filter(id => id !== null);
  },
  
  /**
   * Check if a seat is empty
   * @param {String|Number} tableId - Table ID
   * @param {String|Number} seatNumber - Seat number
   * @param {Object} assignments - Current assignments
   * @returns {Boolean} - True if seat is empty
   */
  isSeatEmpty: (tableId, seatNumber, assignments) => {
    const tableIdStr = String(tableId);
    const seatNumberStr = String(seatNumber);
    return !assignments[tableIdStr]?.[seatNumberStr];
  },
  
  /**
   * Get all empty seats in the layout
   * @param {Object} layout - Classroom layout
   * @param {Object} assignments - Current assignments
   * @param {Set} deactivatedSeats - Set of deactivated seat IDs
   * @returns {Array} - Array of {tableId, seatNumber, seatId} for empty seats
   */
  getEmptySeats: (layout, assignments, deactivatedSeats = new Set()) => {
    const emptySeats = [];
    
    if (!layout?.tables) return emptySeats;
    
    layout.tables.forEach(table => {
      if (!table.seats) return;
      
      table.seats.forEach(seat => {
        const seatId = `${table.id}-${seat.seat_number}`;
        const tableIdStr = String(table.id);
        const seatNumberStr = String(seat.seat_number);
        
        // Check if seat is empty and not deactivated
        if (!deactivatedSeats.has(seatId) && 
            !assignments[tableIdStr]?.[seatNumberStr]) {
          emptySeats.push({
            tableId: table.id,
            seatNumber: seat.seat_number,
            seatId: seatId
          });
        }
      });
    });
    
    return emptySeats;
  },
  
  /**
   * Get all assigned students
   * @param {Object} assignments - Current assignments
   * @returns {Array} - Array of student IDs that are assigned
   */
  getAssignedStudents: (assignments) => {
    const assigned = [];
    Object.values(assignments).forEach(tableSeats => {
      Object.values(tableSeats).forEach(studentId => {
        if (studentId) {
          assigned.push(studentId);
        }
      });
    });
    return assigned;
  },
  
  /**
   * Get unassigned students
   * @param {Array} students - All students
   * @param {Object} assignments - Current assignments
   * @returns {Array} - Array of unassigned student objects
   */
  getUnassignedStudents: (students, assignments) => {
    const assignedIds = new Set(SeatingUtils.getAssignedStudents(assignments));
    return students.filter(student => !assignedIds.has(student.id));
  },
  
  /**
   * Calculate gender balance score for a table
   * @param {Array} studentIds - Array of student IDs at the table
   * @param {Array} students - All students
   * @returns {Number} - Balance score (0 is perfectly balanced)
   */
  calculateGenderBalance: (studentIds, students) => {
    if (studentIds.length === 0) return 0;
    
    let maleCount = 0;
    let femaleCount = 0;
    
    studentIds.forEach(id => {
      const student = students.find(s => s.id === id);
      if (student) {
        if (student.gender?.toLowerCase() === 'male') {
          maleCount++;
        } else if (student.gender?.toLowerCase() === 'female') {
          femaleCount++;
        }
      }
    });
    
    // Return absolute difference as imbalance score
    return Math.abs(maleCount - femaleCount);
  },
  
  /**
   * Check if two students violate a "Never Together" constraint
   * @param {String|Number} student1Id - First student ID
   * @param {String|Number} student2Id - Second student ID
   * @param {Object} partnershipRatings - Partnership ratings data
   * @returns {Boolean} - True if they have a -2 rating
   */
  violatesNeverTogetherConstraint: (student1Id, student2Id, partnershipRatings) => {
    const rating = SeatingUtils.getPartnershipRating(student1Id, student2Id, partnershipRatings);
    return rating === -2;
  },
  
  /**
   * Count constraint violations in a seating arrangement
   * @param {Object} assignments - Current assignments
   * @param {Object} partnershipRatings - Partnership ratings data
   * @param {Object} layout - Classroom layout
   * @returns {Number} - Number of violations
   */
  countConstraintViolations: (assignments, partnershipRatings, layout) => {
    if (!partnershipRatings || !layout) return 0;
    
    let violations = 0;
    
    // Check each table for violations
    layout.tables?.forEach(table => {
      const tableId = String(table.id);
      const studentsAtTable = SeatingUtils.getStudentsAtTable(tableId, assignments);
      
      // Check all pairs of students at the table
      for (let i = 0; i < studentsAtTable.length; i++) {
        for (let j = i + 1; j < studentsAtTable.length; j++) {
          if (SeatingUtils.violatesNeverTogetherConstraint(
            studentsAtTable[i], 
            studentsAtTable[j], 
            partnershipRatings
          )) {
            violations++;
          }
        }
      }
    });
    
    return violations;
  }
};

// Export to global scope
if (typeof window !== "undefined") {
  window.SeatingUtils = SeatingUtils;
  console.log("SeatingUtils module loaded");
}