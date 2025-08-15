// Core module - Authentication and API functionality combined
// This reduces the number of files and keeps related functionality together

// ============================================================================
// AUTHENTICATION MODULE
// ============================================================================
const AuthModule = {
  // Get API base URL based on environment
  getApiBaseUrl() {
    const hostname = window.location.hostname;
    return hostname === "localhost" || hostname === "127.0.0.1"
      ? "http://127.0.0.1:8000/api"
      : "https://bcranston.pythonanywhere.com/api";
  },

  // Token management
  getToken() {
    return localStorage.getItem("token");
  },

  getRefreshToken() {
    return localStorage.getItem("refresh_token");
  },

  setToken(token) {
    localStorage.setItem("token", token);
  },

  setRefreshToken(token) {
    localStorage.setItem("refresh_token", token);
  },

  clearTokens() {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  // Helper function to decode JWT token
  decodeToken(token) {
    try {
      // JWT tokens have 3 parts separated by dots
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      // The payload is the second part (base64 encoded)
      const payload = parts[1];

      // Decode base64 (handle URL-safe base64)
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );

      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error("Error decoding token:", error);
      return null;
    }
  },

  // Get user info from stored token
  getUserInfo() {
    const token = this.getToken();
    if (!token) return null;

    const decoded = this.decodeToken(token);
    console.log("Decoded token:", decoded); // Debug logging
    if (!decoded) return null;

    // Return user info with all available fields
    return {
      id: decoded.user_id || decoded.id || null,
      email: decoded.email || decoded.user_email || decoded.sub || null,
      firstName: decoded.first_name || null,
      lastName: decoded.last_name || null,
      userId: decoded.user_id || decoded.id || null,
      isTeacher: decoded.is_teacher || true,
    };
  },

  // Login function
  async login(email, password) {
    try {
      const response = await fetch(`${this.getApiBaseUrl()}/token/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.setToken(data.access);
        this.setRefreshToken(data.refresh);

        // Get user info from the token
        const userInfo = this.getUserInfo();

        return { success: true, data, userInfo };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.detail || errorData.non_field_errors?.[0] || "Invalid credentials",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: "Network error. Please try again.",
      };
    }
  },

  // Logout function
  logout() {
    this.clearTokens();
    window.location.reload();
  },

  // Get headers for authenticated requests
  getAuthHeaders() {
    const token = this.getToken();
    return {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  },

  // Refresh token if needed
  async refreshToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return { success: false, error: "No refresh token available" };
    }

    try {
      const response = await fetch(`${this.getApiBaseUrl()}/token/refresh/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refresh: refreshToken,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.setToken(data.access);
        // Save new refresh token if provided (when ROTATE_REFRESH_TOKENS is True)
        if (data.refresh) {
          this.setRefreshToken(data.refresh);
        }
        return { success: true, data };
      } else {
        this.clearTokens();
        return { success: false, error: "Token refresh failed" };
      }
    } catch (error) {
      this.clearTokens();
      return { success: false, error: "Token refresh error" };
    }
  },
};

// ============================================================================
// API MODULE
// ============================================================================
// Fixed ApiModule.request method to handle empty responses
const ApiModule = {
  // Base request method with authentication
  async request(endpoint, options = {}) {
    const url = `${AuthModule.getApiBaseUrl()}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...AuthModule.getAuthHeaders(),
          ...options.headers,
        },
      });

      // Handle token refresh on 401
      if (response.status === 401) {
        const refreshResult = await AuthModule.refreshToken();
        if (refreshResult.success) {
          // Retry request with new token
          const retryResponse = await fetch(url, {
            ...options,
            headers: {
              ...AuthModule.getAuthHeaders(),
              ...options.headers,
            },
          });

          if (!retryResponse.ok) {
            throw new Error(`API request failed: ${retryResponse.status}`);
          }

          // Handle empty response for retried request
          const contentType = retryResponse.headers.get("content-type");
          if (
            retryResponse.status === 204 ||
            !contentType ||
            !contentType.includes("application/json")
          ) {
            return null; // Return null for empty responses
          }

          return await retryResponse.json();
        } else {
          // Refresh failed, redirect to login
          AuthModule.logout();
          throw new Error("Authentication failed");
        }
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      // Handle empty responses (like DELETE requests)
      const contentType = response.headers.get("content-type");
      if (response.status === 204 || !contentType || !contentType.includes("application/json")) {
        return null; // Return null for empty responses
      }

      return await response.json();
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  },

  // Add these methods to your ApiModule object after the request() method:

  // Specific API endpoints
  async getClasses() {
    const data = await this.request("/classes/");
    return data.results || data;
  },

  async getStudents() {
    const data = await this.request("/students/");
    return data.results || data;
  },

  async getLayouts() {
    try {
      const data = await this.request("/layouts/");
      return data.results || data;
    } catch (error) {
      console.warn("Layouts API not available:", error);
      return [];
    }
  },

  async getSeatingPeriods() {
    try {
      const data = await this.request("/seating-periods/");
      return data.results || data;
    } catch (error) {
      console.warn("Seating periods API not available:", error);
      return [];
    }
  },

  async getSeatingAssignments() {
    try {
      const data = await this.request("/seating-assignments/");
      return data.results || data;
    } catch (error) {
      console.warn("Seating assignments API not available:", error);
      return [];
    }
  },

  async getRoster() {
    try {
      const data = await this.request("/roster/");
      return data.results || data;
    } catch (error) {
      console.warn("Roster API not available:", error);
      return [];
    }
  },

  // Fetch all data needed for the application
  async fetchAllData() {
    console.log("=== Fetching all application data ===");

    try {
      // Fetch core data (classes and students are required)
      const [classes, students] = await Promise.all([this.getClasses(), this.getStudents()]);

      // Fetch optional data (don't fail if these don't exist)
      const [layouts, periods, assignments, roster] = await Promise.all([
        this.getLayouts(),
        this.getSeatingPeriods(),
        this.getSeatingAssignments(),
        this.getRoster(),
      ]);

      const data = {
        classes,
        students,
        layouts,
        periods,
        assignments,
        roster,
      };

      console.log("Fetched application data:", {
        classes: Array.isArray(classes) ? classes.length : "not array",
        students: Array.isArray(students) ? students.length : "not array",
        layouts: Array.isArray(layouts) ? layouts.length : "not array",
        periods: Array.isArray(periods) ? periods.length : "not array",
        assignments: Array.isArray(assignments) ? assignments.length : "not array",
        roster: Array.isArray(roster) ? roster.length : "not array",
      });

      return data;
    } catch (error) {
      console.error("Error fetching application data:", error);
      throw error;
    }
  },

  // Create/Update/Delete methods
  async createStudent(studentData) {
    return await this.request("/students/", {
      method: "POST",
      body: JSON.stringify(studentData),
    });
  },

  async updateStudent(studentId, studentData) {
    return await this.request(`/students/${studentId}/`, {
      method: "PATCH",
      body: JSON.stringify(studentData),
    });
  },

  async deleteStudent(studentId) {
    return await this.request(`/students/${studentId}/`, {
      method: "DELETE",
    });
  },

  // Classes-specific methods
  async getSeatingChart(classId) {
    return await this.request(`/classes/${classId}/seating_chart/`);
  },
};

// ============================================================================
// LOGIN COMPONENT (keeping it in core since it's small and auth-related)
// ============================================================================
const LoginComponent = ({ onLogin }) => {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [showResetModal, setShowResetModal] = React.useState(false);
  const [resetEmail, setResetEmail] = React.useState("");
  const [resetLoading, setResetLoading] = React.useState(false);
  const [resetMessage, setResetMessage] = React.useState("");
  const [resetError, setResetError] = React.useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await AuthModule.login(email, password);

    if (result.success) {
      onLogin(result.data.access);
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError("");
    setResetMessage("");

    try {
      const response = await fetch(`${AuthModule.getApiBaseUrl()}/password-reset/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: resetEmail }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setResetMessage("If an account exists with this email, a password reset link has been sent. Please check your email.");
        setResetEmail("");
      } else {
        setResetError(data.error || "Failed to send reset email. Please try again.");
      }
    } catch (error) {
      setResetError("Network error. Please try again.");
    }

    setResetLoading(false);
  };

  return React.createElement(
    "div",
    { className: "login-container" },
    React.createElement(
      "div",
      { className: "login-card" },
      React.createElement(
        "div",
        { className: "login-header" },
        React.createElement(
          "h1",
          null,
          React.createElement("i", { className: "fas fa-graduation-cap" })
        ),
        React.createElement("h1", null, "Welcome Back"),
        React.createElement("p", null, "Sign in to access your classroom")
      ),

      error &&
        React.createElement(
          "div",
          { className: "error-message" },
          React.createElement("i", {
            className: "fas fa-exclamation-triangle",
          }),
          " ",
          error
        ),

      React.createElement(
        "form",
        { onSubmit: handleSubmit },
        React.createElement(
          "div",
          { className: "form-group" },
          React.createElement("label", { htmlFor: "email" }, "Email"),
          React.createElement("input", {
            type: "email",
            id: "email",
            className: "form-input",
            value: email,
            onChange: (e) => setEmail(e.target.value),
            required: true,
            disabled: loading,
            placeholder: "Enter your email address",
          })
        ),

        React.createElement(
          "div",
          { className: "form-group" },
          React.createElement("label", { htmlFor: "password" }, "Password"),
          React.createElement("input", {
            type: "password",
            id: "password",
            className: "form-input",
            value: password,
            onChange: (e) => setPassword(e.target.value),
            required: true,
            disabled: loading,
            placeholder: "Enter your password",
          })
        ),

        React.createElement(
          "button",
          {
            type: "submit",
            className: "btn btn-primary",
            disabled: loading,
          },
          loading
            ? [
                React.createElement("div", {
                  key: "spinner",
                  className: "spinner",
                  style: { width: "20px", height: "20px", margin: "0" },
                }),
                "Signing in...",
              ]
            : [
                React.createElement("i", {
                  key: "icon",
                  className: "fas fa-sign-in-alt",
                }),
                " Sign In",
              ]
        ),
        
        // Forgot Password link
        React.createElement(
          "div",
          { 
            style: { 
              textAlign: "center", 
              marginTop: "1rem",
              fontSize: "0.9rem"
            }
          },
          React.createElement(
            "a",
            {
              href: "#",
              onClick: (e) => {
                e.preventDefault();
                setShowResetModal(true);
                setResetEmail(email); // Pre-fill with login email if available
              },
              style: {
                color: "#6366f1",
                textDecoration: "none",
                cursor: "pointer"
              },
              onMouseEnter: (e) => e.target.style.textDecoration = "underline",
              onMouseLeave: (e) => e.target.style.textDecoration = "none"
            },
            "Forgot Password?"
          )
        )
      )
    ),
    
    // Password Reset Modal
    showResetModal && React.createElement(
      "div",
      {
        className: "modal-overlay",
        style: {
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
        },
        onClick: (e) => {
          if (e.target === e.currentTarget && !resetLoading) {
            setShowResetModal(false);
            setResetMessage("");
            setResetError("");
          }
        }
      },
      React.createElement(
        "div",
        {
          className: "modal-content",
          style: {
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "2rem",
            width: "90%",
            maxWidth: "400px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
          }
        },
        React.createElement(
          "h2",
          { style: { marginTop: 0, marginBottom: "1rem" } },
          "Reset Password"
        ),
        
        resetMessage ? (
          // Success message
          React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              {
                style: {
                  padding: "1rem",
                  backgroundColor: "#10b981",
                  color: "white",
                  borderRadius: "4px",
                  marginBottom: "1rem",
                  fontSize: "0.9rem"
                }
              },
              React.createElement("i", { className: "fas fa-check-circle", style: { marginRight: "0.5rem" } }),
              resetMessage
            ),
            React.createElement(
              "button",
              {
                className: "btn btn-secondary",
                onClick: () => {
                  setShowResetModal(false);
                  setResetMessage("");
                  setResetError("");
                },
                style: { width: "100%" }
              },
              "Close"
            )
          )
        ) : (
          // Reset form
          React.createElement(
            "form",
            { onSubmit: handlePasswordReset },
            React.createElement(
              "p",
              { style: { marginBottom: "1rem", color: "#666", fontSize: "0.9rem" } },
              "Enter your email address and we'll send you a link to reset your password."
            ),
            
            resetError && React.createElement(
              "div",
              {
                style: {
                  padding: "0.75rem",
                  backgroundColor: "#fee",
                  color: "#dc2626",
                  borderRadius: "4px",
                  marginBottom: "1rem",
                  fontSize: "0.9rem"
                }
              },
              React.createElement("i", { className: "fas fa-exclamation-triangle", style: { marginRight: "0.5rem" } }),
              resetError
            ),
            
            React.createElement(
              "div",
              { className: "form-group" },
              React.createElement("label", { htmlFor: "reset-email" }, "Email Address"),
              React.createElement("input", {
                type: "email",
                id: "reset-email",
                className: "form-input",
                value: resetEmail,
                onChange: (e) => setResetEmail(e.target.value),
                required: true,
                disabled: resetLoading,
                placeholder: "Enter your email address",
                style: { width: "100%" }
              })
            ),
            
            React.createElement(
              "div",
              { style: { display: "flex", gap: "0.5rem", marginTop: "1rem" } },
              React.createElement(
                "button",
                {
                  type: "submit",
                  className: "btn btn-primary",
                  disabled: resetLoading,
                  style: { flex: 1 }
                },
                resetLoading ? "Sending..." : "Send Reset Link"
              ),
              React.createElement(
                "button",
                {
                  type: "button",
                  className: "btn btn-secondary",
                  onClick: () => {
                    setShowResetModal(false);
                    setResetMessage("");
                    setResetError("");
                  },
                  disabled: resetLoading,
                  style: { flex: 1 }
                },
                "Cancel"
              )
            )
          )
        )
      )
    )
  );
};

// ============================================================================
// EXPORT TO GLOBAL SCOPE
// ============================================================================
if (typeof window !== "undefined") {
  window.AuthModule = AuthModule;
  window.ApiModule = ApiModule;
  window.LoginComponent = LoginComponent;
}
