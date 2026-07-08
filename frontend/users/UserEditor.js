// UserEditor.js - User editing component
(function () {
  "use strict";

  // Get modules from window - wait for them to be available
  const ApiModule = window.ApiModule;
  const NavigationService = window.NavigationService;

  function UserEditor({ userId }) {
    console.log("UserEditor component loaded with userId:", userId);
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [currentUser, setCurrentUser] = React.useState(null);
    const [showPasswordModal, setShowPasswordModal] = React.useState(false);
    const [formData, setFormData] = React.useState({
      email: "",
      first_name: "",
      last_name: "",
      is_active: true
    });

    // Google Classroom connection status (own profile only)
    const [googleStatus, setGoogleStatus] = React.useState(null);
    const [googleStatusLoading, setGoogleStatusLoading] = React.useState(true);
    const [googleActionLoading, setGoogleActionLoading] = React.useState(false);
    const [googleActionError, setGoogleActionError] = React.useState(null);

    // Get current user info and load user data
    React.useEffect(() => {
      const loadUser = async () => {
        console.log("Starting to load user data for userId:", userId);
        setLoading(true);
        
        // First, get current user info from token
        let tokenUser = null;
        const token = localStorage.getItem("token");
        if (token) {
          try {
            // Add padding if needed for base64 decode
            let payload = token.split(".")[1];
            payload = payload.replace(/-/g, '+').replace(/_/g, '/');
            while (payload.length % 4) {
              payload += '=';
            }
            const decoded = JSON.parse(atob(payload));
            console.log("UserEditor: Decoded token:", decoded);
            tokenUser = {
              id: decoded.user_id,
              email: decoded.email,
              is_superuser: decoded.is_superuser || false
            };
            setCurrentUser(tokenUser);
          } catch (e) {
            console.error("Error parsing token:", e);
          }
        }
        
        // Now load the user data
        try {
          // Check if viewing own profile
          const isOwnProfile = userId === "me" || (tokenUser && parseInt(userId) === tokenUser.id);
          const endpoint = isOwnProfile ? "/users/me/" : `/users/${userId}/`;
          
          console.log("Fetching from endpoint:", endpoint);
          const response = await ApiModule.request(endpoint, {
            method: "GET"
          });
          
          console.log("User data received:", response);
          setUser(response);
          setFormData({
            email: response.email,
            first_name: response.first_name,
            last_name: response.last_name,
            is_active: response.is_active
          });
          setError(null);
        } catch (err) {
          setError(err.message || "Failed to load user");
          console.error("Error loading user:", err);
        } finally {
          setLoading(false);
        }
      };

      loadUser();
    }, [userId]);

    // Only the current user can manage their own Google Classroom connection
    const isOwnProfileForGoogle = userId === "me" || (currentUser && parseInt(userId) === currentUser.id);

    const fetchGoogleStatus = async () => {
      setGoogleStatusLoading(true);
      try {
        const response = await ApiModule.request("/google/status/", { method: "GET" });
        setGoogleStatus(response);
      } catch (err) {
        console.error("Error fetching Google Classroom status:", err);
        setGoogleStatus(null);
      } finally {
        setGoogleStatusLoading(false);
      }
    };

    React.useEffect(() => {
      if (isOwnProfileForGoogle) {
        fetchGoogleStatus();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOwnProfileForGoogle]);

    // If we just landed back here after a successful OAuth connect, the
    // backend appended "?google=connected" to the hash - clean the URL and
    // refresh the status so it reflects the new connection immediately.
    React.useEffect(() => {
      if (window.location.hash.includes("google=connected")) {
        const cleanHash = window.location.hash.split("?")[0];
        window.history.replaceState(null, "", cleanHash);
        fetchGoogleStatus();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const connectGoogleClassroom = async () => {
      setGoogleActionError(null);
      try {
        const response = await ApiModule.request(
          `/google/oauth-url/?next=${encodeURIComponent("profile")}`,
          { method: "GET" }
        );
        window.location.href = response.auth_url;
      } catch (err) {
        console.error("Error starting Google connection:", err);
        setGoogleActionError("Failed to start Google connection.");
      }
    };

    const disconnectGoogleClassroom = async () => {
      if (!window.confirm("Disconnect Google Classroom? You'll need to reconnect to import rosters again.")) {
        return;
      }
      setGoogleActionLoading(true);
      setGoogleActionError(null);
      try {
        await ApiModule.request("/google/disconnect/", { method: "POST" });
        await fetchGoogleStatus();
      } catch (err) {
        console.error("Error disconnecting Google Classroom:", err);
        setGoogleActionError("Failed to disconnect Google Classroom.");
      } finally {
        setGoogleActionLoading(false);
      }
    };

    // Handle form submission
    const handleSubmit = async (e) => {
      e.preventDefault();
      setSaving(true);
      setError(null);

      try {
        const isOwnProfile = userId === "me" || parseInt(userId) === currentUser?.id;
        const endpoint = isOwnProfile ? "/users/me/" : `/users/${userId}/`;
        
        const dataToSend = { ...formData };
        // Only superusers can change is_active status
        if (!currentUser?.is_superuser) {
          delete dataToSend.is_active;
        }

        await ApiModule.request(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dataToSend)
        });
        
        // Navigate back to list or profile
        if (currentUser?.is_superuser && !isOwnProfile) {
          window.location.hash = "users";
        } else {
          window.location.hash = "profile";
        }
      } catch (err) {
        setError(err.message || "Failed to save user");
      } finally {
        setSaving(false);
      }
    };

    // Handle password change
    const handlePasswordChange = () => {
      setShowPasswordModal(true);
    };

    // Handle cancel
    const handleCancel = () => {
      if (currentUser?.is_superuser && userId !== "me") {
        window.location.hash = "users";
      } else {
        window.location.hash = "dashboard";
      }
    };

    if (loading) {
      return React.createElement(
        "div",
        { className: "user-editor-container" },
        React.createElement("div", { className: "loading" }, "Loading user...")
      );
    }

    if (error && !user) {
      return React.createElement(
        "div",
        { className: "user-editor-container" },
        React.createElement("div", { className: "error" }, error)
      );
    }

    const isOwnProfile = userId === "me" || parseInt(userId) === currentUser?.id;
    const canEditStatus = currentUser?.is_superuser && !isOwnProfile;

    return React.createElement(
      "div",
      { className: "user-editor-container" },
      React.createElement(
        "div",
        { className: "user-editor-header" },
        React.createElement(
          "h2",
          null,
          isOwnProfile ? "My Profile" : `Edit User: ${user?.email}`
        )
      ),

      React.createElement(
        "form",
        { onSubmit: handleSubmit, className: "user-editor-form" },
        React.createElement(
          "div",
          { className: "form-section" },
          React.createElement("h3", null, "Basic Information"),
          
          React.createElement(
            "div",
            { className: "form-group" },
            React.createElement("label", null, "Email *"),
            React.createElement("input", {
              type: "email",
              required: true,
              value: formData.email,
              onChange: (e) => setFormData({ ...formData, email: e.target.value })
            })
          ),

          React.createElement(
            "div",
            { className: "form-row" },
            React.createElement(
              "div",
              { className: "form-group" },
              React.createElement("label", null, "First Name *"),
              React.createElement("input", {
                type: "text",
                required: true,
                value: formData.first_name,
                onChange: (e) => setFormData({ ...formData, first_name: e.target.value })
              })
            ),
            React.createElement(
              "div",
              { className: "form-group" },
              React.createElement("label", null, "Last Name *"),
              React.createElement("input", {
                type: "text",
                required: true,
                value: formData.last_name,
                onChange: (e) => setFormData({ ...formData, last_name: e.target.value })
              })
            )
          ),

          canEditStatus && React.createElement(
            "div",
            { className: "form-group" },
            React.createElement(
              "label",
              null,
              React.createElement("input", {
                type: "checkbox",
                checked: formData.is_active,
                onChange: (e) => setFormData({ ...formData, is_active: e.target.checked })
              }),
              " Account is active"
            )
          )
        ),

        React.createElement(
          "div",
          { className: "form-section" },
          React.createElement("h3", null, "Security"),
          React.createElement(
            "button",
            { 
              type: "button",
              className: "btn btn-secondary",
              onClick: handlePasswordChange
            },
            isOwnProfile ? "Change My Password" : "Reset User Password"
          )
        ),

        isOwnProfileForGoogle &&
          React.createElement(
            "div",
            { className: "form-section" },
            React.createElement("h3", null, "Google Classroom"),
            googleActionError &&
              React.createElement("div", { className: "error", style: { marginBottom: "10px" } }, googleActionError),
            googleStatusLoading
              ? React.createElement("p", null, "Checking connection...")
              : React.createElement(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" } },
                  React.createElement(
                    "span",
                    {
                      style: {
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontWeight: 500,
                        color: googleStatus?.connected ? "#059669" : "#6b7280",
                      },
                    },
                    googleStatus?.connected ? "Connected" : "Not connected"
                  ),
                  googleStatus?.connected
                    ? React.createElement(
                        "button",
                        {
                          type: "button",
                          disabled: googleActionLoading,
                          onClick: disconnectGoogleClassroom,
                          style: {
                            padding: "6px 12px",
                            fontSize: "14px",
                            fontWeight: 500,
                            borderRadius: "6px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            backgroundColor: "#ef4444",
                            color: "white",
                            border: "none",
                            cursor: googleActionLoading ? "default" : "pointer",
                          },
                        },
                        googleActionLoading ? "Disconnecting..." : "Disconnect"
                      )
                    : React.createElement(
                        "button",
                        {
                          type: "button",
                          onClick: connectGoogleClassroom,
                          style: {
                            padding: "6px 12px",
                            fontSize: "14px",
                            fontWeight: 500,
                            borderRadius: "6px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            backgroundColor: "#667eea",
                            color: "white",
                            border: "none",
                            cursor: "pointer",
                          },
                        },
                        "Connect Google Classroom"
                      )
                ),
            googleStatus?.connected &&
              googleStatus?.token_expiry &&
              React.createElement(
                "p",
                { style: { fontSize: "13px", color: "#6b7280", marginTop: "8px" } },
                `Token expires: ${new Date(googleStatus.token_expiry).toLocaleString()}`
              )
          ),

        user && React.createElement(
          "div",
          { className: "form-section info-section" },
          React.createElement("h3", null, "Account Information"),
          React.createElement(
            "div",
            { className: "info-grid" },
            React.createElement(
              "div",
              null,
              React.createElement("strong", null, "Role:"),
              " ",
              user.is_superuser ? "Administrator" : "User"
            ),
            React.createElement(
              "div",
              null,
              React.createElement("strong", null, "Status:"),
              " ",
              user.is_active ? "Active" : "Inactive"
            ),
            React.createElement(
              "div",
              null,
              React.createElement("strong", null, "Created:"),
              " ",
              new Date(user.date_joined).toLocaleDateString()
            ),
            React.createElement(
              "div",
              null,
              React.createElement("strong", null, "Last Login:"),
              " ",
              user.last_login ? new Date(user.last_login).toLocaleDateString() : "Never"
            )
          )
        ),

        error && React.createElement("div", { className: "error" }, error),

        React.createElement(
          "div",
          { className: "form-actions" },
          React.createElement(
            "button",
            { type: "button", onClick: handleCancel, className: "btn btn-secondary" },
            "Cancel"
          ),
          React.createElement(
            "button",
            { type: "submit", disabled: saving, className: "btn btn-primary" },
            saving ? "Saving..." : "Save Changes"
          )
        )
      ),

      showPasswordModal && React.createElement(PasswordChangeModal, {
        isOwnProfile,
        userId: user?.id,
        onClose: () => setShowPasswordModal(false)
      })
    );
  }

  // Password Change Modal
  function PasswordChangeModal({ isOwnProfile, userId, onClose }) {
    const [formData, setFormData] = React.useState({
      old_password: "",
      new_password: "",
      confirm_password: ""
    });
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [success, setSuccess] = React.useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      // Validate passwords match
      if (formData.new_password !== formData.confirm_password) {
        setError("Passwords do not match");
        return;
      }

      // Validate password requirements
      if (formData.new_password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }

      if (!/\d/.test(formData.new_password)) {
        setError("Password must contain at least one number");
        return;
      }

      if (!/[!@#$%^&*()_+\-=\[\]{};:,.<>?]/.test(formData.new_password)) {
        setError("Password must contain at least one special character");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        if (isOwnProfile) {
          // User changing their own password
          await ApiModule.request("/users/change_password/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              old_password: formData.old_password,
              new_password: formData.new_password
            })
          });
        } else {
          // Admin resetting user password (would need to implement this endpoint)
          setError("Admin password reset not yet implemented");
          return;
        }
        
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      } catch (err) {
        setError(err.message || "Failed to change password");
      } finally {
        setLoading(false);
      }
    };

    if (success) {
      return React.createElement(
        "div",
        { className: "modal-overlay", onClick: onClose },
        React.createElement(
          "div",
          { className: "modal-content success-modal" },
          React.createElement("h3", null, "Success!"),
          React.createElement("p", null, "Password changed successfully."),
          React.createElement(
            "button",
            { onClick: onClose, className: "btn btn-primary" },
            "Close"
          )
        )
      );
    }

    return React.createElement(
      "div",
      { className: "modal-overlay", onClick: onClose },
      React.createElement(
        "div",
        { 
          className: "modal-content",
          onClick: (e) => e.stopPropagation()
        },
        React.createElement("h3", null, "Change Password"),
        React.createElement(
          "form",
          { onSubmit: handleSubmit },
          isOwnProfile && React.createElement(
            "div",
            { className: "form-group" },
            React.createElement("label", null, "Current Password *"),
            React.createElement("input", {
              type: "password",
              required: true,
              value: formData.old_password,
              onChange: (e) => setFormData({ ...formData, old_password: e.target.value })
            })
          ),
          React.createElement(
            "div",
            { className: "form-group" },
            React.createElement("label", null, "New Password *"),
            React.createElement("input", {
              type: "password",
              required: true,
              value: formData.new_password,
              onChange: (e) => setFormData({ ...formData, new_password: e.target.value }),
              placeholder: "Min 8 chars, include number and symbol"
            })
          ),
          React.createElement(
            "div",
            { className: "form-group" },
            React.createElement("label", null, "Confirm New Password *"),
            React.createElement("input", {
              type: "password",
              required: true,
              value: formData.confirm_password,
              onChange: (e) => setFormData({ ...formData, confirm_password: e.target.value })
            })
          ),
          error && React.createElement("div", { className: "error" }, error),
          React.createElement(
            "div",
            { className: "modal-actions" },
            React.createElement(
              "button",
              { type: "button", onClick: onClose, className: "btn btn-secondary" },
              "Cancel"
            ),
            React.createElement(
              "button",
              { type: "submit", disabled: loading, className: "btn btn-primary" },
              loading ? "Changing..." : "Change Password"
            )
          )
        )
      )
    );
  }

  // Export
  window.UsersModule = window.UsersModule || {};
  window.UsersModule.UserEditor = UserEditor;
})();