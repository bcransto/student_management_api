// Authentication Module
// frontend/shared/auth.js

const AuthModule = {
  // Get API base URL based on environment
  getApiBaseUrl() {
    return window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
      ? "http://127.0.0.1:8000/api"
      : "https://bcranston.pythonanywhere.com/api";
  },

  // Token management
  getToken() {
    return localStorage.getItem("token");
  },

  setToken(token) {
    localStorage.setItem("token", token);
  },

  getRefreshToken() {
    return localStorage.getItem("refresh_token");
  },

  setRefreshToken(refreshToken) {
    localStorage.setItem("refresh_token", refreshToken);
  },

  clearTokens() {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
  },

  // Check if user is authenticated
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
    // Optionally reload the page or redirect
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
        // Refresh failed, clear tokens
        this.clearTokens();
        return { success: false, error: "Token refresh failed" };
      }
    } catch (error) {
      this.clearTokens();
      return { success: false, error: "Token refresh error" };
    }
  },
};

// Login Component
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

// Make auth module and component available globally
if (typeof window !== "undefined") {
  window.AuthModule = AuthModule;
  window.LoginComponent = LoginComponent;
}
