// SeatingOptimizer.js - Simulated Annealing optimizer for seating arrangements
console.log("Loading SeatingOptimizer module...");

class SimulatedAnnealingOptimizer {
  constructor(config = {}) {
    // Temperature settings
    this.initialTemp = config.initialTemp || 100;
    this.coolingRate = config.coolingRate || 0.995;
    this.minTemp = config.minTemp || 0.01;
    this.maxIterations = config.maxIterations || 500;  // Further reduced default for better performance
    
    // Constraint storage
    this.lockedStudents = new Set(); // Student IDs that cannot be moved
    this.doNotPair = new Map(); // Map of student ID to Set of incompatible student IDs
    this.lockedSeats = {}; // {studentId: "tableId-seatNumber"}
    
    // Move strategy statistics
    this.moveStats = {
      swap: { attempts: 0, successes: 0 },
      relocation: { attempts: 0, successes: 0 },
      threeCycle: { attempts: 0, successes: 0 }
    };
    
    // Score weights
    this.weights = {
      doNotPairViolation: 10000, // Should never happen with hard constraints
      newPartnership: -10, // Reward for never paired before
      repeatedPartnership: 5, // Penalty multiplied by count
      positiveRating: -20, // Reward multiplied by rating (1 or 2)
      negativeRating: 10, // Penalty for negative ratings (-1)
      emptyTable: 20 // Penalty for tables with only one student
    };
    
    // Runtime state
    this.partnershipHistory = null;
    this.ratings = null;
    this.temperature = this.initialTemp;
    this.currentScore = null;
    this.bestScore = null;
    this.bestSolution = null;
  }
  
  /**
   * Set constraints for the optimization
   * @param {Object} constraints - Contains lockedSeats and doNotPair arrays
   */
  setConstraints(constraints) {
    // Process locked seats: {studentId: "tableId-seatNumber"}
    this.lockedSeats = constraints.lockedSeats || {};
    this.lockedStudents = new Set(Object.keys(this.lockedSeats).map(id => parseInt(id)));
    
    // Build bidirectional do-not-pair lookup Map for O(1) checking
    this.doNotPair.clear();
    if (constraints.doNotPair) {
      constraints.doNotPair.forEach(pair => {
        const [s1, s2] = pair.map(id => parseInt(id));
        
        // Add to both directions for O(1) lookup
        if (!this.doNotPair.has(s1)) {
          this.doNotPair.set(s1, new Set());
        }
        this.doNotPair.get(s1).add(s2);
        
        if (!this.doNotPair.has(s2)) {
          this.doNotPair.set(s2, new Set());
        }
        this.doNotPair.get(s2).add(s1);
      });
    }
    
    console.log(`Constraints set: ${this.lockedStudents.size} locked students, ${this.doNotPair.size} students with pairing restrictions`);
  }
  
  /**
   * Main solving method using simulated annealing
   * @param {Array} students - Array of student objects
   * @param {Object} tables - Table structure {tableId: [seat1, seat2, ...]}
   * @param {Object} partnershipHistory - Historical partnership data
   * @param {Object} ratings - Teacher preference ratings
   * @returns {Object} - Optimized seating assignment
   */
  solve(students, tables, partnershipHistory, ratings) {
    console.log("Starting simulated annealing optimization...");
    
    this.partnershipHistory = partnershipHistory || {};
    this.ratings = ratings || {};
    this.temperature = this.initialTemp;
    
    // Create initial valid assignment
    let current = this.createInitialAssignment(students, tables);
    this.currentScore = this.evaluate(current);
    
    // Initialize best solution
    this.bestSolution = this.deepCopy(current);
    this.bestScore = this.currentScore;
    
    // Get list of moveable students (not locked)
    const moveable = students.filter(s => !this.lockedStudents.has(s.id)).map(s => s.id);
    
    console.log(`Starting optimization with ${moveable.length} moveable students out of ${students.length} total`);
    
    // Simulated annealing loop
    for (let iteration = 0; iteration < this.maxIterations && this.temperature > this.minTemp; iteration++) {
      // Generate a valid neighbor
      const neighbor = this.generateValidNeighbor(current, moveable);
      
      if (neighbor) {
        const neighborScore = this.evaluate(neighbor);
        
        // Metropolis criterion
        if (this.shouldAccept(this.currentScore, neighborScore, this.temperature)) {
          current = neighbor;
          this.currentScore = neighborScore;
          
          // Update best if improved
          if (neighborScore < this.bestScore) {
            this.bestSolution = this.deepCopy(neighbor);
            this.bestScore = neighborScore;
            console.log(`New best score: ${this.bestScore} at iteration ${iteration}`);
          }
        }
      }
      
      // Cool down
      this.temperature *= this.coolingRate;
      
      // Periodic logging - reduced frequency for performance
      if (iteration % 100 === 0 && iteration > 0) {
        console.log(`Iteration ${iteration}: temp=${this.temperature.toFixed(2)}, current=${this.currentScore}, best=${this.bestScore}`);
      }
    }
    
    console.log("Optimization complete. Move statistics:", this.moveStats);
    return this.bestSolution;
  }
  
  /**
   * Create initial valid assignment respecting all constraints
   */
  createInitialAssignment(students, tables) {
    const assignment = {};
    const assigned = new Set();
    
    // First, place locked students at their required seats
    for (const [studentId, seatLocation] of Object.entries(this.lockedSeats)) {
      const [tableId, seatIndex] = seatLocation.split('-').map(s => parseInt(s));
      if (!assignment[tableId]) {
        assignment[tableId] = new Array(tables[tableId].length).fill(null);
      }
      assignment[tableId][seatIndex] = parseInt(studentId);
      assigned.add(parseInt(studentId));
    }
    
    // Get remaining students to place
    const toPlace = students.filter(s => !assigned.has(s.id));
    
    // Shuffle for randomness
    for (let i = toPlace.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [toPlace[i], toPlace[j]] = [toPlace[j], toPlace[i]];
    }
    
    // Place remaining students in first valid seat found
    for (const student of toPlace) {
      let placed = false;
      
      for (const [tableId, seats] of Object.entries(tables)) {
        if (!assignment[tableId]) {
          assignment[tableId] = new Array(seats.length).fill(null);
        }
        
        for (let i = 0; i < seats.length; i++) {
          if (assignment[tableId][i] === null && this.canSitAtTable(student.id, tableId, assignment)) {
            assignment[tableId][i] = student.id;
            placed = true;
            break;
          }
        }
        
        if (placed) break;
      }
      
      if (!placed) {
        console.warn(`Could not place student ${student.id} - constraints may be too restrictive`);
      }
    }
    
    return assignment;
  }
  
  /**
   * Generate a valid neighbor solution using multiple strategies
   */
  generateValidNeighbor(current, moveable) {
    if (moveable.length < 2) return null;
    
    const strategies = [
      { name: 'swap', weight: 0.5, fn: () => this.trySwap(current, moveable) },
      { name: 'relocation', weight: 0.3, fn: () => this.tryRelocation(current, moveable) },
      { name: 'threeCycle', weight: 0.2, fn: () => this.tryThreeCycle(current, moveable) }
    ];
    
    // Select strategy based on weights
    const rand = Math.random();
    let cumulative = 0;
    let selectedStrategy = null;
    
    for (const strategy of strategies) {
      cumulative += strategy.weight;
      if (rand < cumulative) {
        selectedStrategy = strategy;
        break;
      }
    }
    
    // Try selected strategy up to 5 times (reduced from 10 for performance)
    for (let attempt = 0; attempt < 5; attempt++) {
      this.moveStats[selectedStrategy.name].attempts++;
      const result = selectedStrategy.fn();
      if (result) {
        this.moveStats[selectedStrategy.name].successes++;
        return result;
      }
    }
    
    return null;
  }
  
  /**
   * Try to swap two moveable students
   */
  trySwap(current, moveable) {
    if (moveable.length < 2) return null;
    
    // Pick two random moveable students
    const idx1 = Math.floor(Math.random() * moveable.length);
    let idx2 = Math.floor(Math.random() * moveable.length);
    while (idx2 === idx1) {
      idx2 = Math.floor(Math.random() * moveable.length);
    }
    
    const student1 = moveable[idx1];
    const student2 = moveable[idx2];
    
    // Find their current positions
    let pos1 = null, pos2 = null;
    for (const [tableId, seats] of Object.entries(current)) {
      for (let i = 0; i < seats.length; i++) {
        if (seats[i] === student1) pos1 = { table: tableId, seat: i };
        if (seats[i] === student2) pos2 = { table: tableId, seat: i };
      }
    }
    
    if (!pos1 || !pos2) return null;
    
    // Check if swap is valid
    if (!this.isSwapValid(student1, student2, pos1, pos2, current)) {
      return null;
    }
    
    // Create new assignment with swap
    const newAssignment = this.deepCopy(current);
    newAssignment[pos1.table][pos1.seat] = student2;
    newAssignment[pos2.table][pos2.seat] = student1;
    
    return newAssignment;
  }
  
  /**
   * Try to relocate a student to a new seat
   */
  tryRelocation(current, moveable) {
    if (moveable.length === 0) return null;
    
    // Pick random student to move
    const studentId = moveable[Math.floor(Math.random() * moveable.length)];
    
    // Find current position
    let currentPos = null;
    for (const [tableId, seats] of Object.entries(current)) {
      for (let i = 0; i < seats.length; i++) {
        if (seats[i] === studentId) {
          currentPos = { table: tableId, seat: i };
          break;
        }
      }
    }
    
    if (!currentPos) return null;
    
    // Pick random target table and seat
    const tableIds = Object.keys(current);
    const targetTable = tableIds[Math.floor(Math.random() * tableIds.length)];
    const targetSeat = Math.floor(Math.random() * current[targetTable].length);
    
    // If same position, no change
    if (targetTable === currentPos.table && targetSeat === currentPos.seat) {
      return null;
    }
    
    const occupant = current[targetTable][targetSeat];
    
    // If seat is empty, just move if valid
    if (occupant === null) {
      if (!this.canSitAtTable(studentId, targetTable, current)) {
        return null;
      }
      
      const newAssignment = this.deepCopy(current);
      newAssignment[currentPos.table][currentPos.seat] = null;
      newAssignment[targetTable][targetSeat] = studentId;
      return newAssignment;
    }
    
    // If seat is occupied by locked student, cannot move
    if (this.lockedStudents.has(occupant)) {
      return null;
    }
    
    // Try swap with occupant (displacement)
    const pos1 = currentPos;
    const pos2 = { table: targetTable, seat: targetSeat };
    
    if (!this.isSwapValid(studentId, occupant, pos1, pos2, current)) {
      return null;
    }
    
    const newAssignment = this.deepCopy(current);
    newAssignment[pos1.table][pos1.seat] = occupant;
    newAssignment[pos2.table][pos2.seat] = studentId;
    
    return newAssignment;
  }
  
  /**
   * Try to rotate three students
   */
  tryThreeCycle(current, moveable) {
    if (moveable.length < 3) return null;
    
    // Pick three distinct moveable students
    const indices = [];
    while (indices.length < 3) {
      const idx = Math.floor(Math.random() * moveable.length);
      if (!indices.includes(idx)) {
        indices.push(idx);
      }
    }
    
    const students = indices.map(i => moveable[i]);
    
    // Find their positions
    const positions = [];
    for (const studentId of students) {
      for (const [tableId, seats] of Object.entries(current)) {
        for (let i = 0; i < seats.length; i++) {
          if (seats[i] === studentId) {
            positions.push({ table: tableId, seat: i, student: studentId });
            break;
          }
        }
      }
    }
    
    if (positions.length !== 3) return null;
    
    // Check if rotation is valid (s1→s2, s2→s3, s3→s1)
    for (let i = 0; i < 3; i++) {
      const student = positions[i].student;
      const targetPos = positions[(i + 1) % 3];
      
      // Check if student can sit at target table
      const tempAssignment = this.deepCopy(current);
      // Temporarily remove all three students to check constraints
      for (const pos of positions) {
        tempAssignment[pos.table][pos.seat] = null;
      }
      
      if (!this.canSitAtTable(student, targetPos.table, tempAssignment)) {
        return null;
      }
    }
    
    // Create rotated assignment
    const newAssignment = this.deepCopy(current);
    newAssignment[positions[0].table][positions[0].seat] = positions[2].student;
    newAssignment[positions[1].table][positions[1].seat] = positions[0].student;
    newAssignment[positions[2].table][positions[2].seat] = positions[1].student;
    
    return newAssignment;
  }
  
  /**
   * Check if a swap violates do-not-pair constraints
   */
  isSwapValid(student1, student2, pos1, pos2, current) {
    // Check if student1 can sit at pos2's table
    const tempAssignment1 = this.deepCopy(current);
    tempAssignment1[pos1.table][pos1.seat] = null; // Remove student1 temporarily
    if (!this.canSitAtTable(student1, pos2.table, tempAssignment1)) {
      return false;
    }
    
    // Check if student2 can sit at pos1's table
    const tempAssignment2 = this.deepCopy(current);
    tempAssignment2[pos2.table][pos2.seat] = null; // Remove student2 temporarily
    if (!this.canSitAtTable(student2, pos1.table, tempAssignment2)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Check if a student can sit at a table without violating constraints
   */
  canSitAtTable(studentId, tableId, assignment) {
    const tableStudents = assignment[tableId] || [];
    const incompatible = this.doNotPair.get(studentId);
    
    if (!incompatible) return true;
    
    // Check each student at the table
    for (const otherStudent of tableStudents) {
      if (otherStudent !== null && incompatible.has(otherStudent)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Evaluate the quality of a seating arrangement
   */
  evaluate(assignment) {
    let score = 0;
    
    // Check each table
    for (const [tableId, seats] of Object.entries(assignment)) {
      const studentsAtTable = seats.filter(s => s !== null);
      
      // Penalty for tables with only one student
      if (studentsAtTable.length === 1) {
        score += this.weights.emptyTable;
      }
      
      // Evaluate each pair of students at the table
      for (let i = 0; i < studentsAtTable.length; i++) {
        for (let j = i + 1; j < studentsAtTable.length; j++) {
          const s1 = studentsAtTable[i];
          const s2 = studentsAtTable[j];
          
          // Check do-not-pair violations (shouldn't happen with hard constraints)
          if (this.doNotPair.has(s1) && this.doNotPair.get(s1).has(s2)) {
            score += this.weights.doNotPairViolation;
          }
          
          // Check partnership history
          const partnershipCount = this.getPartnershipCount(s1, s2);
          if (partnershipCount === 0) {
            score += this.weights.newPartnership; // Reward new partnerships
          } else {
            score += this.weights.repeatedPartnership * partnershipCount;
          }
          
          // Check teacher ratings
          const rating = this.getRating(s1, s2);
          if (rating > 0) {
            score += this.weights.positiveRating * rating; // Reward positive ratings
          } else if (rating < 0 && rating !== -2) { // -2 handled by hard constraints
            score += this.weights.negativeRating * Math.abs(rating);
          }
        }
      }
    }
    
    return score;
  }
  
  /**
   * Get partnership count from history
   */
  getPartnershipCount(student1, student2) {
    if (!this.partnershipHistory) return 0;
    
    const s1 = String(student1);
    const s2 = String(student2);
    
    // Check both directions
    if (this.partnershipHistory[s1]?.partnerships?.[s2]) {
      return this.partnershipHistory[s1].partnerships[s2].length;
    }
    if (this.partnershipHistory[s2]?.partnerships?.[s1]) {
      return this.partnershipHistory[s2].partnerships[s1].length;
    }
    
    return 0;
  }
  
  /**
   * Get teacher rating for a pair of students
   */
  getRating(student1, student2) {
    if (!this.ratings || !this.ratings.grid) return 0;
    
    const s1 = String(student1);
    const s2 = String(student2);
    
    // Check both directions
    if (this.ratings.grid[s1]?.ratings?.[s2] !== undefined) {
      return this.ratings.grid[s1].ratings[s2];
    }
    if (this.ratings.grid[s2]?.ratings?.[s1] !== undefined) {
      return this.ratings.grid[s2].ratings[s1];
    }
    
    return 0;
  }
  
  /**
   * Metropolis acceptance criterion
   */
  shouldAccept(currentScore, newScore, temperature) {
    if (newScore < currentScore) {
      return true; // Always accept improvements
    }
    
    const delta = newScore - currentScore;
    const probability = Math.exp(-delta / temperature);
    return Math.random() < probability;
  }
  
  /**
   * Deep copy an assignment object
   */
  deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}

// Keep the original SeatingOptimizer class as a wrapper
class SeatingOptimizer {
  constructor(config = {}) {
    this.config = config;
    this.optimizer = null;
  }
  
  /**
   * Main optimization function - wrapper for backward compatibility
   * @param {Object} assignments - Current seating assignments {tableId: {seatNumber: studentId}}
   * @param {Array} students - Array of student objects
   * @param {Object} layout - Classroom layout with tables and seats
   * @param {Object} constraints - Constraints and preferences (ratings, history, etc.)
   * @returns {Object} - Optimized assignments
   */
  optimize(assignments, students, layout, constraints = {}) {
    console.log("SeatingOptimizer.optimize called");
    
    // Convert assignments format from {tableId: {seatNumber: studentId}} to {tableId: [array]}
    const tables = {};
    if (layout && layout.tables) {
      layout.tables.forEach(table => {
        const tableId = String(table.id);
        const seatCount = table.seats ? table.seats.length : 0;
        tables[tableId] = new Array(seatCount).fill(null);
        
        // Fill in current assignments
        if (assignments[tableId]) {
          Object.entries(assignments[tableId]).forEach(([seatNum, studentId]) => {
            const seatIndex = parseInt(seatNum) - 1; // Convert to 0-based index
            if (seatIndex >= 0 && seatIndex < seatCount) {
              tables[tableId][seatIndex] = studentId;
            }
          });
        }
      });
    }
    
    // Extract constraints
    const optimizerConstraints = {
      lockedSeats: {},
      doNotPair: []
    };
    
    // Convert locked seats if provided
    if (constraints.lockedSeats) {
      optimizerConstraints.lockedSeats = constraints.lockedSeats;
    }
    
    // Extract do-not-pair from ratings if available
    if (constraints.partnershipRatings && constraints.partnershipRatings.grid) {
      const doNotPair = [];
      for (const s1 in constraints.partnershipRatings.grid) {
        const studentData = constraints.partnershipRatings.grid[s1];
        if (studentData && studentData.ratings) {
          for (const s2 in studentData.ratings) {
            if (studentData.ratings[s2] === -2 && parseInt(s1) < parseInt(s2)) {
              doNotPair.push([s1, s2]);
            }
          }
        }
      }
      optimizerConstraints.doNotPair = doNotPair;
    }
    
    // Create optimizer instance
    this.optimizer = new SimulatedAnnealingOptimizer(this.config);
    this.optimizer.setConstraints(optimizerConstraints);
    
    // Run optimization
    const optimizedTables = this.optimizer.solve(
      students,
      tables,
      constraints.partnershipHistory,
      constraints.partnershipRatings
    );
    
    // Convert back to original format {tableId: {seatNumber: studentId}}
    const result = {};
    for (const [tableId, seats] of Object.entries(optimizedTables)) {
      result[tableId] = {};
      seats.forEach((studentId, index) => {
        if (studentId !== null) {
          const seatNumber = String(index + 1); // Convert back to 1-based
          result[tableId][seatNumber] = studentId;
        }
      });
    }
    
    return result;
  }
  
  /**
   * Get optimizer status
   */
  getStatus() {
    if (this.optimizer) {
      return {
        bestScore: this.optimizer.bestScore,
        currentScore: this.optimizer.currentScore,
        temperature: this.optimizer.temperature,
        moveStats: this.optimizer.moveStats
      };
    }
    return null;
  }
}

// Export to global scope
if (typeof window !== "undefined") {
  window.SeatingOptimizer = SeatingOptimizer;
  window.SimulatedAnnealingOptimizer = SimulatedAnnealingOptimizer;
  console.log("SeatingOptimizer module loaded");
}

// ============ COMPREHENSIVE TEST SUITE ============
// Uncomment the line below to run tests when the file loads
// runOptimizerTests();

function runOptimizerTests() {
    console.log("🧪 Starting Optimizer Tests...\n");
    
    // Test 1: Basic optimization without constraints
    console.log("Test 1: Basic Optimization");
    test1_basicOptimization();
    
    // Test 2: Optimization with locked students
    console.log("\nTest 2: Locked Students");
    test2_lockedStudents();
    
    // Test 3: Optimization with do-not-pair constraints
    console.log("\nTest 3: Do-Not-Pair Constraints");
    test3_doNotPair();
    
    // Test 4: Combined constraints
    console.log("\nTest 4: Combined Constraints");
    test4_combinedConstraints();
    
    // Test 5: Move strategy distribution
    console.log("\nTest 5: Move Strategy Distribution");
    test5_moveStrategies();
    
    console.log("\n✅ All tests complete! Check results above.");
}

function test1_basicOptimization() {
    const students = [
        {id: 1, name: "Alice"}, {id: 2, name: "Bob"}, 
        {id: 3, name: "Carol"}, {id: 4, name: "Dave"},
        {id: 5, name: "Eve"}, {id: 6, name: "Frank"},
        {id: 7, name: "Grace"}, {id: 8, name: "Henry"}
    ];
    
    const tables = {
        "table1": new Array(4).fill(null),
        "table2": new Array(4).fill(null)
    };
    
    const partnershipHistory = {
        "1": {partnerships: {"2": [1,2,3], "3": [1]}}, // Alice sat with Bob 3 times, Carol once
        "2": {partnerships: {"1": [1,2,3], "4": [1,2]}}, // Bob sat with Alice 3 times, Dave twice
        // etc...
    };
    
    const optimizer = new SimulatedAnnealingOptimizer({
        maxIterations: 200  // Reduced for faster testing
    });
    
    const result = optimizer.solve(students, tables, partnershipHistory, {});
    
    console.log("Result:", result);
    console.log("Best Score:", optimizer.bestScore);
    console.log("Move Stats:", optimizer.moveStats);
    
    // Verify all students are placed
    let placedCount = 0;
    for (const tableStudents of Object.values(result)) {
        placedCount += tableStudents.filter(s => s !== null).length;
    }
    console.log(`✓ Placed ${placedCount}/${students.length} students`);
}

function test2_lockedStudents() {
    const students = [
        {id: 1}, {id: 2}, {id: 3}, {id: 4},
        {id: 5}, {id: 6}, {id: 7}, {id: 8}
    ];
    
    const tables = {
        "table1": new Array(4).fill(null),
        "table2": new Array(4).fill(null)
    };
    
    const optimizer = new SimulatedAnnealingOptimizer({
        maxIterations: 20  // Minimal iterations for locked student test
    });
    
    // Lock students 1 and 5 in specific positions (using correct key names)
    optimizer.setConstraints({
        lockedSeats: {
            1: "table1-0",  // Student 1 locked to table1, seat 0
            5: "table2-2"   // Student 5 locked to table2, seat 2
        },
        doNotPair: []
    });
    
    const result = optimizer.solve(students, tables, {}, {});
    
    // Verify locked students didn't move
    const student1Position = result["table1"][0];
    const student5Position = result["table2"][2];
    
    console.log(`✓ Student 1 in correct position: ${student1Position === 1}`);
    console.log(`✓ Student 5 in correct position: ${student5Position === 5}`);
    console.log("Table arrangement:", result);
}

function test3_doNotPair() {
    const students = [
        {id: 1}, {id: 2}, {id: 3}, {id: 4},
        {id: 5}, {id: 6}, {id: 7}, {id: 8}
    ];
    
    const tables = {
        "table1": new Array(4).fill(null),
        "table2": new Array(4).fill(null)
    };
    
    const optimizer = new SimulatedAnnealingOptimizer({
        maxIterations: 200  // Reduced for faster testing
    });
    
    // Students 1 and 2 cannot sit together, 3 and 4 cannot sit together
    optimizer.setConstraints({
        lockedSeats: {},
        doNotPair: [[1, 2], [3, 4]]
    });
    
    const result = optimizer.solve(students, tables, {}, {});
    
    // Verify constraints are respected
    let violations = 0;
    for (const [tableId, students] of Object.entries(result)) {
        const tableStudents = students.filter(s => s !== null);
        
        // Check if 1 and 2 are at same table
        if (tableStudents.includes(1) && tableStudents.includes(2)) {
            console.log("❌ Violation: Students 1 and 2 at same table!");
            violations++;
        }
        
        // Check if 3 and 4 are at same table
        if (tableStudents.includes(3) && tableStudents.includes(4)) {
            console.log("❌ Violation: Students 3 and 4 at same table!");
            violations++;
        }
    }
    
    console.log(`✓ Do-not-pair constraints respected: ${violations === 0}`);
    console.log("Table arrangement:", result);
}

function test4_combinedConstraints() {
    const students = Array.from({length: 12}, (_, i) => ({id: i + 1}));
    
    const tables = {
        "table1": new Array(4).fill(null),
        "table2": new Array(4).fill(null),
        "table3": new Array(4).fill(null)
    };
    
    const optimizer = new SimulatedAnnealingOptimizer({
        maxIterations: 50  // Minimal iterations for combined constraints test
    });
    
    // Complex constraints
    optimizer.setConstraints({
        lockedSeats: {
            1: "table1-0",  // Lock student 1
            6: "table2-1"   // Lock student 6
        },
        doNotPair: [
            [2, 3],  // 2 and 3 cannot sit together
            [4, 5],  // 4 and 5 cannot sit together
            [7, 8]   // 7 and 8 cannot sit together
        ]
    });
    
    const ratings = {
        grid: {
            "9": {ratings: {"10": 2}},   // 9 and 10 prefer to sit together
            "10": {ratings: {"9": 2}}
        }
    };
    
    const result = optimizer.solve(students, tables, {}, ratings);
    
    console.log("✓ Complex constraints test complete");
    console.log("Table arrangement:", result);
    console.log("Move statistics:", optimizer.moveStats);
}

function test5_moveStrategies() {
    const students = Array.from({length: 16}, (_, i) => ({id: i + 1}));
    
    const tables = {
        "table1": new Array(4).fill(null),
        "table2": new Array(4).fill(null),
        "table3": new Array(4).fill(null),
        "table4": new Array(4).fill(null)
    };
    
    const optimizer = new SimulatedAnnealingOptimizer({
        maxIterations: 200  // Reduced for faster testing
    });
    
    const result = optimizer.solve(students, tables, {}, {});
    
    const stats = optimizer.moveStats;
    const total = stats.swap.attempts + stats.relocation.attempts + stats.threeCycle.attempts;
    
    console.log("Move Strategy Distribution:");
    console.log(`  Swaps: ${stats.swap.attempts} attempts, ${stats.swap.successes} successful (${(stats.swap.attempts/total*100).toFixed(1)}%)`);
    console.log(`  Relocations: ${stats.relocation.attempts} attempts, ${stats.relocation.successes} successful (${(stats.relocation.attempts/total*100).toFixed(1)}%)`);
    console.log(`  3-Cycles: ${stats.threeCycle.attempts} attempts, ${stats.threeCycle.successes} successful (${(stats.threeCycle.attempts/total*100).toFixed(1)}%)`);
    
    // Verify distribution is roughly 50/30/20
    const swapPercent = stats.swap.attempts / total;
    const relocPercent = stats.relocation.attempts / total;
    const cyclePercent = stats.threeCycle.attempts / total;
    
    console.log(`✓ Strategy distribution reasonable: ${Math.abs(swapPercent - 0.5) < 0.1 && Math.abs(relocPercent - 0.3) < 0.1}`);
}

// Run tests immediately when file loads (comment out for production)
console.log("SeatingOptimizer.js loaded. To test, call runOptimizerTests() in console.");
// Export test function to global scope for easy testing
if (typeof window !== "undefined") {
  window.runOptimizerTests = runOptimizerTests;
}