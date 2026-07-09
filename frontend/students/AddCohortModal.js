// AddCohortModal.js - "Add Cohort" modal (issue #14)
// Adds (or removes) a whole cohort of the app's school-wide student list
// to/from the teacher's "my students" list. Reads the app's synced list via
// /students/school-list/ - it never talks to Google directly; the Workspace
// directory sync keeps the school list current.
console.log("Loading AddCohortModal component...");

const AddCohortModal = ({ onClose, onChanged }) => {
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [message, setMessage] = React.useState(null);
  const [cohorts, setCohorts] = React.useState([]);
  const [selectedCohort, setSelectedCohort] = React.useState("");

  React.useEffect(() => {
    const load = async () => {
      try {
        const response = await window.ApiModule.request("/students/school-list/", {
          method: "GET",
        });
        setCohorts(response.cohorts || []);
      } catch (err) {
        console.error("Error loading cohorts:", err);
        setError("Couldn't load the cohort list. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const addCohort = async () => {
    if (!selectedCohort) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await window.ApiModule.request("/students/add-to-my-list/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohort: selectedCohort }),
      });
      const n = (response.added || 0) + (response.reactivated || 0);
      setMessage(
        n > 0
          ? `Added ${n} student${n === 1 ? "" : "s"} from Class of 20${selectedCohort} to your list.`
          : `Everyone in Class of 20${selectedCohort} was already on your list.`
      );
      if (onChanged) onChanged();
    } catch (err) {
      console.error("Error adding cohort:", err);
      setError("Failed to add the cohort.");
    } finally {
      setBusy(false);
    }
  };

  const removeCohort = async () => {
    if (!selectedCohort) return;
    if (
      !window.confirm(
        `Remove all of Class of 20${selectedCohort} from your student list? ` +
          `This only hides them from your list - class rosters, seating, and ` +
          `attendance are untouched.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await window.ApiModule.request("/students/remove-from-my-list/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohort: selectedCohort }),
      });
      const n = response.removed || 0;
      setMessage(`Removed ${n} student${n === 1 ? "" : "s"} from your list.`);
      if (onChanged) onChanged();
    } catch (err) {
      console.error("Error removing cohort:", err);
      setError("Failed to remove the cohort.");
    } finally {
      setBusy(false);
    }
  };

  return React.createElement(
    "div",
    {
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
        if (e.target === e.currentTarget && !busy) onClose();
      },
    },
    React.createElement(
      "div",
      {
        style: {
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "1.5rem",
          width: "92%",
          maxWidth: "440px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        },
      },

      // Header
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
          },
        },
        React.createElement(
          "h2",
          { style: { margin: 0, fontSize: "1.25rem" } },
          React.createElement("i", { className: "fas fa-users", style: { marginRight: "8px" } }),
          "Add Cohort"
        ),
        React.createElement(
          "button",
          {
            onClick: onClose,
            disabled: busy,
            style: {
              border: "none",
              background: "none",
              fontSize: "1.25rem",
              cursor: busy ? "default" : "pointer",
              color: "#6b7280",
            },
          },
          "×"
        )
      ),

      // Error / result banners
      error &&
        React.createElement(
          "div",
          {
            style: {
              padding: "0.6rem 0.75rem",
              backgroundColor: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: "6px",
              marginBottom: "0.75rem",
              color: "#dc2626",
              fontSize: "0.9rem",
            },
          },
          error
        ),
      message &&
        React.createElement(
          "div",
          {
            style: {
              padding: "0.6rem 0.75rem",
              backgroundColor: "#d1fae5",
              border: "1px solid #6ee7b7",
              borderRadius: "6px",
              marginBottom: "0.75rem",
              color: "#065f46",
              fontSize: "0.9rem",
            },
          },
          message
        ),

      React.createElement(
        "p",
        { style: { margin: "0 0 0.75rem", fontSize: "0.9rem", color: "#6b7280" } },
        "Add every student in a cohort to your student list. Individual students can be added or removed with Add Student."
      ),

      // Cohort dropdown
      loading
        ? React.createElement(
            "div",
            { style: { textAlign: "center", padding: "1.5rem", color: "#6b7280" } },
            React.createElement("div", { className: "spinner", style: { margin: "0 auto 0.75rem" } }),
            "Loading cohorts..."
          )
        : React.createElement(
            "select",
            {
              value: selectedCohort,
              onChange: (e) => {
                setSelectedCohort(e.target.value);
                setMessage(null);
                setError(null);
              },
              disabled: busy,
              style: {
                width: "100%",
                padding: "8px 10px",
                fontSize: "14px",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                marginBottom: "1rem",
              },
            },
            React.createElement("option", { value: "" }, "Select a cohort..."),
            cohorts.map((c) =>
              React.createElement(
                "option",
                { key: c.cohort, value: c.cohort },
                `Class of 20${c.cohort} (${c.count} students)`
              )
            )
          ),

      // Footer actions
      React.createElement(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        React.createElement(
          "button",
          {
            onClick: removeCohort,
            disabled: busy || !selectedCohort,
            title: "Remove every student in this cohort from your list",
            style: {
              border: "none",
              background: "none",
              color: busy || !selectedCohort ? "#d1d5db" : "#ef4444",
              cursor: busy || !selectedCohort ? "default" : "pointer",
              fontSize: "0.85rem",
              padding: 0,
            },
          },
          "Remove cohort from my list"
        ),
        React.createElement(
          "div",
          { style: { display: "flex", gap: "8px" } },
          React.createElement(
            "button",
            { onClick: onClose, disabled: busy, className: "btn btn-secondary" },
            "Done"
          ),
          React.createElement(
            "button",
            {
              onClick: addCohort,
              disabled: busy || !selectedCohort,
              className: "btn btn-primary",
            },
            React.createElement("i", { className: busy ? "fas fa-sync fa-spin" : "fas fa-plus" }),
            selectedCohort ? ` Add Class of 20${selectedCohort}` : " Add cohort"
          )
        )
      )
    )
  );
};

// Export component
if (typeof window !== "undefined") {
  window.AddCohortModal = AddCohortModal;
  console.log("AddCohortModal component loaded");
}
