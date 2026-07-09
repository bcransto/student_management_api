// frontend/students/StudentPortal.js
// Student-only landing shell (GH issue #16).
//
// Student accounts (JWT is_teacher=false, auto-provisioned via Google Sign-In)
// must NEVER render any teacher component. app.js routes every hash to this
// component when the signed-in user is not a teacher. When the hash is
// #my-partners/{classId} it renders the phase-2 partner survey
// (window.PartnerSurvey); any other hash shows the default placeholder.

const StudentPortal = ({ currentUser, onLogout }) => {
  const { useState, useEffect } = React;

  // Track the hash so the portal re-renders when the student navigates to
  // (or away from) a #my-partners/{id} route.
  const [hash, setHash] = useState(window.location.hash.slice(1));

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash.slice(1));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const partnerMatch = hash.match(/^my-partners\/(\d+)/);
  if (partnerMatch && window.PartnerSurvey) {
    return React.createElement(window.PartnerSurvey, {
      classId: partnerMatch[1],
      currentUser,
      onLogout,
    });
  }

  const greetingName =
    (typeof currentUser === "string" && currentUser.trim()) || "Student";

  return React.createElement(
    "div",
    {
      style: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#f3f4f6",
        boxSizing: "border-box",
      },
    },
    React.createElement(
      "div",
      {
        style: {
          maxWidth: "480px",
          width: "100%",
          background: "#ffffff",
          borderRadius: "12px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
          padding: "40px 32px",
          textAlign: "center",
        },
      },
      React.createElement(
        "div",
        { style: { fontSize: "48px", marginBottom: "16px" } },
        "🤝" // handshake
      ),
      React.createElement(
        "h1",
        {
          style: {
            fontSize: "22px",
            fontWeight: 700,
            color: "#111827",
            margin: "0 0 8px",
          },
        },
        "Partner Survey"
      ),
      React.createElement(
        "p",
        {
          style: {
            fontSize: "15px",
            color: "#4b5563",
            lineHeight: 1.5,
            margin: "0 0 6px",
          },
        },
        `Hi ${greetingName}! You're signed in.`
      ),
      React.createElement(
        "p",
        {
          style: {
            fontSize: "15px",
            color: "#4b5563",
            lineHeight: 1.5,
            margin: "0 0 28px",
          },
        },
        "The partner survey isn't available yet. When your teacher opens it, you'll be able to share who you work well with here. Please check back soon."
      ),
      React.createElement(
        "button",
        {
          onClick: onLogout,
          style: {
            padding: "10px 20px",
            fontSize: "14px",
            fontWeight: 600,
            color: "#ffffff",
            background: "#667eea",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          },
        },
        "Sign out"
      )
    )
  );
};

// Export for use in other modules
if (typeof window !== "undefined") {
  window.StudentPortal = StudentPortal;
}
