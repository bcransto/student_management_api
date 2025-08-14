// users.js - User management list component
(function () {
  "use strict";

  const { ApiModule } = window.CoreModule || {};
  const { NavigationService } = window.NavigationModule || {};
  const { formatDate } = window.UtilsModule || {};

  function UsersList() {
    const [users, setUsers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [currentUser, setCurrentUser] = React.useState(null);
    const [showCreateModal, setShowCreateModal] = React.useState(false);

    // Get current user info from JWT token
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

    // Load users
    const loadUsers = React.useCallback(async () => {
      setLoading(true);
      try {
        const response = await ApiModule.request("/api/users/", {
          method: "GET"
        });
        setUsers(response.results || response);
        setError(null);
      } catch (err) {
        setError(err.message || "Failed to load users");
        console.error("Error loading users:", err);
      } finally {
        setLoading(false);
      }
    }, []);

    React.useEffect(() => {
      if (currentUser?.is_superuser) {
        loadUsers();
      } else {
        setError("You don't have permission to view this page");
        setLoading(false);
      }
    }, [currentUser, loadUsers]);

    // Filter users based on search
    const filteredUsers = React.useMemo(() => {
      if (!searchTerm) return users;
      const term = searchTerm.toLowerCase();
      return users.filter(
        (user) =>
          user.email.toLowerCase().includes(term) ||
          user.first_name.toLowerCase().includes(term) ||
          user.last_name.toLowerCase().includes(term)
      );
    }, [users, searchTerm]);

    // Handle user deactivation
    const handleDeactivate = async (userId) => {
      if (!confirm("Are you sure you want to deactivate this user?")) return;
      
      try {
        await ApiModule.request(`/api/users/${userId}/deactivate/`, {
          method: "POST"
        });
        await loadUsers();
      } catch (err) {
        alert("Failed to deactivate user: " + err.message);
      }
    };

    // Handle user reactivation
    const handleReactivate = async (userId) => {
      try {
        await ApiModule.request(`/api/users/${userId}/reactivate/`, {
          method: "POST"
        });
        await loadUsers();
      } catch (err) {
        alert("Failed to reactivate user: " + err.message);
      }
    };

    // Handle edit user
    const handleEdit = (userId) => {
      window.location.hash = `users/edit/${userId}`;
    };

    // Handle create user
    const handleCreateUser = () => {
      setShowCreateModal(true);
    };

    if (loading) {
      return React.createElement(
        "div",
        { className: "users-container" },
        React.createElement("div", { className: "loading" }, "Loading users...")
      );
    }

    if (error && !currentUser?.is_superuser) {
      return React.createElement(
        "div",
        { className: "users-container" },
        React.createElement("div", { className: "error" }, error)
      );
    }

    return React.createElement(
      "div",
      { className: "users-container" },
      // Header
      React.createElement(
        "div",
        { className: "users-header" },
        React.createElement("h2", null, "User Management"),
        React.createElement(
          "button",
          { 
            className: "btn btn-primary",
            onClick: handleCreateUser
          },
          "Add New User"
        )
      ),

      // Search bar
      React.createElement(
        "div",
        { className: "search-container" },
        React.createElement("input", {
          type: "text",
          className: "search-input",
          placeholder: "Search users by name or email...",
          value: searchTerm,
          onChange: (e) => setSearchTerm(e.target.value)
        })
      ),

      // Users table
      React.createElement(
        "div",
        { className: "users-table-container" },
        React.createElement(
          "table",
          { className: "users-table" },
          React.createElement(
            "thead",
            null,
            React.createElement(
              "tr",
              null,
              React.createElement("th", null, "Name"),
              React.createElement("th", null, "Email"),
              React.createElement("th", null, "Role"),
              React.createElement("th", null, "Status"),
              React.createElement("th", null, "Last Login"),
              React.createElement("th", null, "Actions")
            )
          ),
          React.createElement(
            "tbody",
            null,
            filteredUsers.map((user) =>
              React.createElement(
                "tr",
                { key: user.id, className: user.is_active ? "" : "inactive" },
                React.createElement(
                  "td",
                  null,
                  `${user.first_name} ${user.last_name}`
                ),
                React.createElement("td", null, user.email),
                React.createElement(
                  "td",
                  null,
                  React.createElement(
                    "span",
                    { className: `badge ${user.is_superuser ? "badge-admin" : "badge-user"}` },
                    user.is_superuser ? "Admin" : "User"
                  )
                ),
                React.createElement(
                  "td",
                  null,
                  React.createElement(
                    "span",
                    { className: `status ${user.is_active ? "active" : "inactive"}` },
                    user.is_active ? "Active" : "Inactive"
                  )
                ),
                React.createElement(
                  "td",
                  null,
                  user.last_login ? formatDate(user.last_login) : "Never"
                ),
                React.createElement(
                  "td",
                  { className: "actions" },
                  React.createElement(
                    "button",
                    { 
                      className: "btn btn-sm btn-secondary",
                      onClick: () => handleEdit(user.id)
                    },
                    "Edit"
                  ),
                  user.id !== currentUser?.id && 
                    (user.is_active
                      ? React.createElement(
                          "button",
                          { 
                            className: "btn btn-sm btn-danger",
                            onClick: () => handleDeactivate(user.id)
                          },
                          "Deactivate"
                        )
                      : React.createElement(
                          "button",
                          { 
                            className: "btn btn-sm btn-success",
                            onClick: () => handleReactivate(user.id)
                          },
                          "Reactivate"
                        ))
                )
              )
            )
          )
        )
      ),

      // Create modal
      showCreateModal && React.createElement(CreateUserModal, {
        onClose: () => setShowCreateModal(false),
        onSuccess: () => {
          setShowCreateModal(false);
          loadUsers();
        }
      })
    );
  }

  // Create User Modal Component
  function CreateUserModal({ onClose, onSuccess }) {
    const [formData, setFormData] = React.useState({
      email: "",
      first_name: "",
      last_name: "",
      password: "",
      generatePassword: true
    });
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);

    const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      try {
        const data = {
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name
        };
        
        if (!formData.generatePassword && formData.password) {
          data.password = formData.password;
        }

        await ApiModule.request("/api/users/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        
        onSuccess();
      } catch (err) {
        setError(err.message || "Failed to create user");
      } finally {
        setLoading(false);
      }
    };

    return React.createElement(
      "div",
      { className: "modal-overlay", onClick: onClose },
      React.createElement(
        "div",
        { 
          className: "modal-content",
          onClick: (e) => e.stopPropagation()
        },
        React.createElement("h3", null, "Create New User"),
        React.createElement(
          "form",
          { onSubmit: handleSubmit },
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
          ),
          React.createElement(
            "div",
            { className: "form-group" },
            React.createElement(
              "label",
              null,
              React.createElement("input", {
                type: "checkbox",
                checked: formData.generatePassword,
                onChange: (e) => setFormData({ ...formData, generatePassword: e.target.checked })
              }),
              " Generate temporary password"
            )
          ),
          !formData.generatePassword && React.createElement(
            "div",
            { className: "form-group" },
            React.createElement("label", null, "Password"),
            React.createElement("input", {
              type: "password",
              value: formData.password,
              onChange: (e) => setFormData({ ...formData, password: e.target.value }),
              placeholder: "Min 8 chars, include number and symbol"
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
              loading ? "Creating..." : "Create User"
            )
          )
        )
      )
    );
  }

  // Export
  window.UsersModule = {
    UsersList
  };
})();