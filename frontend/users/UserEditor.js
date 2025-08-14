// UserEditor.js - User editing component
(function () {
  "use strict";

  const { ApiModule } = window.CoreModule || {};
  const { NavigationService } = window.NavigationModule || {};

  function UserEditor({ userId }) {
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

    // Get current user info
    React.useEffect(() => {
      const token = localStorage.getItem("access_token");
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          setCurrentUser({
            id: payload.user_id,
            email: payload.email,
            is_superuser: payload.is_superuser || false
          });
        } catch (e) {
          console.error("Error parsing token:", e);
        }
      }
    }, []);

    // Load user data
    React.useEffect(() => {
      const loadUser = async () => {
        setLoading(true);
        try {
          // Check if viewing own profile
          const isOwnProfile = userId === "me" || parseInt(userId) === currentUser?.id;
          const endpoint = isOwnProfile ? "/api/users/me/" : `/api/users/${userId}/`;
          
          const response = await ApiModule.request(endpoint, {
            method: "GET"
          });
          
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

      if (currentUser) {
        loadUser();
      }
    }, [userId, currentUser]);

    // Handle form submission
    const handleSubmit = async (e) => {
      e.preventDefault();
      setSaving(true);
      setError(null);

      try {
        const isOwnProfile = userId === "me" || parseInt(userId) === currentUser?.id;
        const endpoint = isOwnProfile ? "/api/users/me/" : `/api/users/${userId}/`;
        
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
          await ApiModule.request("/api/users/change_password/", {
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