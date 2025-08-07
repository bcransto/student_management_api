// frontend/navigation/header.js
const Header = ({ currentUser, onLogout, onNavigate }) => {
  const handleLogoClick = () => {
    onNavigate("dashboard");
  };

  return React.createElement(
    "header",
    { className: "header" },
    React.createElement(
      "div",
      { className: "header-left" },
      React.createElement(
        "h1",
        { onClick: handleLogoClick, style: { cursor: "pointer" } },
        React.createElement("i", { className: "fas fa-graduation-cap" }),
        " Classroom Manager"
      )
    ),
    React.createElement(
      "div",
      { className: "header-right" },
      React.createElement(
        "div",
        { className: "user-info" },
        React.createElement("i", { className: "fas fa-user-circle" }),
        React.createElement("span", null, `Welcome, ${currentUser || "Teacher"}`)
      ),
      React.createElement(
        "button",
        { className: "btn btn-secondary", onClick: onLogout },
        React.createElement("i", { className: "fas fa-sign-out-alt" }),
        " Logout"
      )
    )
  );
};

// Attach to window for use in index.html
window.Header = Header;
