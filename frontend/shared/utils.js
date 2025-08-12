// Shared utility functions for the frontend application

/**
 * Format student name with truncation for display
 * Max 7 characters: "FirstName L" or truncated "First L"
 * @param {string|object} firstNameOrStudent - Student's first name or student object
 * @param {string} lastName - Student's last name (optional if first param is object)
 * @returns {string} Formatted name
 */
const formatStudentName = (firstNameOrStudent, lastName) => {
  let firstName, nickname;
  
  // Handle both object and string parameters
  if (typeof firstNameOrStudent === 'object' && firstNameOrStudent !== null) {
    firstName = firstNameOrStudent.nickname || firstNameOrStudent.first_name;
    lastName = firstNameOrStudent.last_name;
  } else {
    firstName = firstNameOrStudent;
  }
  
  if (!firstName) return "";

  // Get first name and last initial
  const lastInitial = lastName ? lastName[0] : "";
  const baseName = `${firstName} ${lastInitial}`;

  // If already 7 chars or less, return as is
  if (baseName.length <= 7) {
    return baseName;
  }

  // Otherwise, truncate first name to fit within 7 chars
  // Account for space (1 char) + initial (1 char) = 2 chars
  const maxFirstNameLength = 5; // 7 - 2
  const truncatedFirst = firstName.substring(0, maxFirstNameLength);
  return `${truncatedFirst} ${lastInitial}`;
};

/**
 * Format date to short format (MM/DD/YY)
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
const formatDateShort = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear().toString().slice(-2);
  return `${month}/${day}/${year}`;
};

/**
 * Format date to long format (Month Day, Year)
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
const formatDateLong = (dateString) => {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/**
 * Format date (alias for short format for backward compatibility)
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date in MM/DD/YY format
 */
const formatDate = formatDateShort;

/**
 * Truncate text to specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
const truncateText = (text, maxLength) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
};

/**
 * Get initials from name
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @returns {string} Initials (e.g., "JD")
 */
const getInitials = (firstName, lastName) => {
  const firstInitial = firstName ? firstName[0].toUpperCase() : "";
  const lastInitial = lastName ? lastName[0].toUpperCase() : "";
  return firstInitial + lastInitial;
};

/**
 * Format time to readable format
 * @param {string} dateString - ISO date string
 * @returns {string} Time in format "2:30 PM"
 */
const formatTime = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

/**
 * Get relative time (e.g., "2 hours ago", "yesterday")
 * @param {string} dateString - ISO date string
 * @returns {string} Relative time string
 */
const getRelativeTime = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return formatDateLong(dateString);
};

// Export for use in other modules
if (typeof window !== "undefined") {
  window.SharedUtils = {
    formatStudentName,
    formatDate,
    formatDateShort,
    formatDateLong,
    truncateText,
    getInitials,
    formatTime,
    getRelativeTime,
  };
}
