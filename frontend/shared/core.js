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
        return { success: true, data };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error:
            errorData.detail ||
            errorData.non_field_errors?.[0] ||
            "Invalid credentials",
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
          return await fetch(url, {
            ...options,
            headers: {
              ...AuthModule.getAuthHeaders(),
              ...options.headers,
            },
          }).then((res) => res.json());
        } else {
          // Refresh failed, redirect to login
          AuthModule.logout();
          throw new Error("Authentication failed");
        }
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  },

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
      const [classes, students] = await Promise.all([
        this.getClasses(),
        this.getStudents(),
      ]);

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
        assignments: Array.isArray(assignments)
          ? assignments.length
          : "not array",
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
