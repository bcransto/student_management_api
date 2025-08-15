// PasswordResetConfirm.js - Component for resetting password with token from email

const PasswordResetConfirm = ({ uid, token, onSuccess }) => {
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [validating, setValidating] = React.useState(true);
  const [tokenValid, setTokenValid] = React.useState(false);

  // Validate token on mount
  React.useEffect(() => {
    const validateToken = async () => {
      try {
        const response = await fetch(`${window.AuthModule.getApiBaseUrl()}/password-reset/validate/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uid, token }),
        });

        if (response.ok) {
          setTokenValid(true);
        } else {
          setError("This password reset link is invalid or has expired.");
        }
      } catch (error) {
        setError("Failed to validate reset link. Please try again.");
      }
      setValidating(false);
    };

    validateToken();
  }, [uid, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate password strength
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${window.AuthModule.getApiBaseUrl()}/password-reset/confirm/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid,
          token,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Success - redirect to login
        alert("Your password has been reset successfully! Please log in with your new password.");
        if (onSuccess) {
          onSuccess();
        } else {
          // Redirect to login
          window.location.hash = "";
          window.location.reload();
        }
      } else {
        setError(data.error || "Failed to reset password. Please try again.");
      }
    } catch (error) {
      setError("Network error. Please try again.");
    }

    setLoading(false);
  };

  if (validating) {
    return React.createElement(
      "div",
      { className: "password-reset-container", style: { 
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "#f3f4f6"
      }},
      React.createElement(
        "div",
        { className: "password-reset-card", style: {
          backgroundColor: "white",
          padding: "2rem",
          borderRadius: "8px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          textAlign: "center"
        }},
        React.createElement("div", { className: "spinner" }),
        React.createElement("p", null, "Validating reset link...")
      )
    );
  }

  return React.createElement(
    "div",
    { className: "password-reset-container", style: { 
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      backgroundColor: "#f3f4f6"
    }},
    React.createElement(
      "div",
      { className: "password-reset-card", style: {
        backgroundColor: "white",
        padding: "2rem",
        borderRadius: "8px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
        width: "90%",
        maxWidth: "400px"
      }},
      
      React.createElement(
        "div",
        { className: "password-reset-header", style: { textAlign: "center", marginBottom: "2rem" }},
        React.createElement("i", { 
          className: "fas fa-lock", 
          style: { fontSize: "3rem", color: "#6366f1", marginBottom: "1rem" }
        }),
        React.createElement("h1", { style: { margin: 0 }}, "Reset Your Password"),
        React.createElement("p", { style: { color: "#666", marginTop: "0.5rem" }}, 
          "Enter your new password below"
        )
      ),

      error && React.createElement(
        "div",
        { className: "error-message", style: {
          padding: "0.75rem",
          backgroundColor: "#fee",
          color: "#dc2626",
          borderRadius: "4px",
          marginBottom: "1rem"
        }},
        React.createElement("i", { className: "fas fa-exclamation-triangle" }),
        " ",
        error
      ),

      tokenValid ? React.createElement(
        "form",
        { onSubmit: handleSubmit },
        
        React.createElement(
          "div",
          { className: "form-group", style: { marginBottom: "1rem" }},
          React.createElement("label", { htmlFor: "new-password" }, "New Password"),
          React.createElement("input", {
            type: "password",
            id: "new-password",
            className: "form-input",
            value: newPassword,
            onChange: (e) => setNewPassword(e.target.value),
            required: true,
            disabled: loading,
            placeholder: "Enter new password (min. 8 characters)",
            style: { width: "100%" }
          })
        ),

        React.createElement(
          "div",
          { className: "form-group", style: { marginBottom: "1.5rem" }},
          React.createElement("label", { htmlFor: "confirm-password" }, "Confirm Password"),
          React.createElement("input", {
            type: "password",
            id: "confirm-password",
            className: "form-input",
            value: confirmPassword,
            onChange: (e) => setConfirmPassword(e.target.value),
            required: true,
            disabled: loading,
            placeholder: "Confirm new password",
            style: { width: "100%" }
          })
        ),

        React.createElement(
          "button",
          {
            type: "submit",
            className: "btn btn-primary",
            disabled: loading,
            style: { width: "100%" }
          },
          loading ? "Resetting Password..." : "Reset Password"
        ),

        React.createElement(
          "div",
          { style: { textAlign: "center", marginTop: "1rem" }},
          React.createElement(
            "a",
            {
              href: "#",
              onClick: (e) => {
                e.preventDefault();
                window.location.hash = "";
                window.location.reload();
              },
              style: { color: "#6366f1", textDecoration: "none" }
            },
            "Return to Login"
          )
        )
      ) : React.createElement(
        "div",
        { style: { textAlign: "center" }},
        React.createElement(
          "a",
          {
            href: "#",
            onClick: (e) => {
              e.preventDefault();
              window.location.hash = "";
              window.location.reload();
            },
            className: "btn btn-primary",
            style: { display: "inline-block", textDecoration: "none" }
          },
          "Return to Login"
        )
      )
    )
  );
};

// Export component
if (typeof window !== "undefined") {
  window.PasswordResetConfirm = PasswordResetConfirm;
}