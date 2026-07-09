// StudentPicker.js - "Add Student" modal (issue #14 phase 2)
// Browse the school-wide (Workspace-synced) student list, filter by cohort,
// and add students to (or remove cohorts from) the teacher's "my students"
// list. Manual student creation is disabled by design - students only ever
// enter the system via the Workspace sync or a Google import.
console.log("Loading StudentPicker component...");

const StudentPicker = ({ onClose, onChanged }) => {
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [message, setMessage] = React.useState(null);
  const [students, setStudents] = React.useState([]);
  const [cohorts, setCohorts] = React.useState([]);
  const [selectedCohort, setSelectedCohort] = React.useState(""); // "" = all
  const [search, setSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState(() => new Set());

  const load = async (cohort) => {
    setLoading(true);
    setError(null);
    try {
      const query = cohort ? `?cohort=${encodeURIComponent(cohort)}` : "";
      const response = await window.ApiModule.request(`/students/school-list/${query}`, {
        method: "GET",
      });
      setStudents(response.students || []);
      setCohorts(response.cohorts || []);
    } catch (err) {
      console.error("Error loading school list:", err);
      setError("Couldn't load the school list. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load("");
  }, []);

  const changeCohort = (cohort) => {
    setSelectedCohort(cohort);
    setSelectedIds(new Set());
    setMessage(null);
    load(cohort);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Students not yet on my list, matching the search box
  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;
    return students.filter((s) => {
      return (
        s.name?.toLowerCase().includes(term) ||
        s.student_id?.toLowerCase().includes(term) ||
        s.email?.toLowerCase().includes(term)
      );
    });
  }, [students, search]);

  const addableFiltered = filtered.filter((s) => !s.on_my_list);

  const afterChange = async (msg) => {
    setMessage(msg);
    setSelectedIds(new Set());
    await load(selectedCohort);
    if (onChanged) onChanged();
  };

  const addSelected = async () => {
    if (selectedIds.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const response = await window.ApiModule.request("/students/add-to-my-list/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_ids: Array.from(selectedIds) }),
      });
      const n = (response.added || 0) + (response.reactivated || 0);
      await afterChange(`Added ${n} student${n === 1 ? "" : "s"} to your list.`);
    } catch (err) {
      console.error("Error adding students:", err);
      setError("Failed to add the selected students.");
    } finally {
      setBusy(false);
    }
  };

  const addAllInCohort = async () => {
    if (!selectedCohort) return;
    setBusy(true);
    setError(null);
    try {
      const response = await window.ApiModule.request("/students/add-to-my-list/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohort: selectedCohort }),
      });
      const n = (response.added || 0) + (response.reactivated || 0);
      await afterChange(
        n > 0
          ? `Added ${n} student${n === 1 ? "" : "s"} from Class of 20${selectedCohort}.`
          : `Everyone in Class of 20${selectedCohort} was already on your list.`
      );
    } catch (err) {
      console.error("Error adding cohort:", err);
      setError("Failed to add the cohort.");
    } finally {
      setBusy(false);
    }
  };

  const addOne = async (id) => {
    setBusy(true);
    setError(null);
    try {
      await window.ApiModule.request("/students/add-to-my-list/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_ids: [id] }),
      });
      await afterChange(null);
    } catch (err) {
      console.error("Error adding student:", err);
      setError("Failed to add the student.");
    } finally {
      setBusy(false);
    }
  };

  const removeOne = async (id) => {
    setBusy(true);
    setError(null);
    try {
      await window.ApiModule.request("/students/remove-from-my-list/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_ids: [id] }),
      });
      await afterChange(null);
    } catch (err) {
      console.error("Error removing student:", err);
      setError("Failed to remove the student.");
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
    try {
      const response = await window.ApiModule.request("/students/remove-from-my-list/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohort: selectedCohort }),
      });
      const n = response.removed || 0;
      await afterChange(`Removed ${n} student${n === 1 ? "" : "s"} from your list.`);
    } catch (err) {
      console.error("Error removing cohort:", err);
      setError("Failed to remove the cohort.");
    } finally {
      setBusy(false);
    }
  };

  const smallBtn = (bg) => ({
    padding: "6px 12px",
    fontSize: "14px",
    fontWeight: 500,
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    color: "white",
    backgroundColor: bg,
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  });

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
          maxWidth: "640px",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
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
          React.createElement("i", { className: "fas fa-user-plus", style: { marginRight: "8px" } }),
          "Add Student"
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

      // Error / message banners
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

      // Filter + search toolbar
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            gap: "8px",
            marginBottom: "0.75rem",
            flexWrap: "wrap",
            alignItems: "center",
          },
        },
        React.createElement(
          "select",
          {
            value: selectedCohort,
            onChange: (e) => changeCohort(e.target.value),
            disabled: busy,
            style: {
              padding: "8px 10px",
              fontSize: "14px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
            },
          },
          React.createElement("option", { value: "" }, "All cohorts"),
          cohorts.map((c) =>
            React.createElement(
              "option",
              { key: c.cohort, value: c.cohort },
              `Class of 20${c.cohort} (${c.count})`
            )
          )
        ),
        React.createElement("input", {
          type: "text",
          placeholder: "Search name, ID, or email...",
          value: search,
          onChange: (e) => setSearch(e.target.value),
          style: {
            flex: "1 1 180px",
            padding: "8px 10px",
            fontSize: "14px",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
          },
        })
      ),

      // Cohort-level actions (only when a specific cohort is selected)
      selectedCohort &&
        React.createElement(
          "div",
          { style: { display: "flex", gap: "8px", marginBottom: "0.75rem" } },
          React.createElement(
            "button",
            { onClick: addAllInCohort, disabled: busy, style: smallBtn("#10b981") },
            React.createElement("i", { className: "fas fa-users" }),
            `Add all in Class of 20${selectedCohort}`
          ),
          React.createElement(
            "button",
            { onClick: removeCohort, disabled: busy, style: smallBtn("#ef4444") },
            React.createElement("i", { className: "fas fa-user-minus" }),
            "Remove cohort from my list"
          )
        ),

      // Student list
      React.createElement(
        "div",
        {
          style: {
            flex: "1 1 auto",
            overflowY: "auto",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            marginBottom: "0.75rem",
            minHeight: "160px",
          },
        },
        loading
          ? React.createElement(
              "div",
              { style: { textAlign: "center", padding: "2rem", color: "#6b7280" } },
              React.createElement("div", { className: "spinner", style: { margin: "0 auto 0.75rem" } }),
              "Loading school list..."
            )
          : filtered.length === 0
          ? React.createElement(
              "p",
              { style: { textAlign: "center", color: "#6b7280", padding: "2rem" } },
              "No students match."
            )
          : filtered.map((s) =>
              React.createElement(
                "div",
                {
                  key: s.id,
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "0.5rem 0.75rem",
                    borderBottom: "1px solid #f3f4f6",
                  },
                },
                // Checkbox (only for students not yet on the list)
                s.on_my_list
                  ? React.createElement("span", { style: { width: "18px" } })
                  : React.createElement("input", {
                      type: "checkbox",
                      checked: selectedIds.has(s.id),
                      onChange: () => toggleSelect(s.id),
                      disabled: busy,
                      style: { width: "18px", height: "18px", cursor: "pointer" },
                    }),
                React.createElement(
                  "div",
                  { style: { flex: 1, minWidth: 0 } },
                  React.createElement("div", { style: { fontWeight: 500 } }, s.name),
                  React.createElement(
                    "div",
                    { style: { fontSize: "0.8rem", color: "#9ca3af" } },
                    `ID ${s.student_id}`,
                    s.email ? ` · ${s.email}` : "",
                    s.cohort ? ` · '${s.cohort}` : ""
                  )
                ),
                s.on_my_list
                  ? React.createElement(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "8px" } },
                      React.createElement(
                        "span",
                        {
                          style: {
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            backgroundColor: "#eef2ff",
                            color: "#4338ca",
                          },
                        },
                        "On my list"
                      ),
                      React.createElement(
                        "button",
                        {
                          onClick: () => removeOne(s.id),
                          disabled: busy,
                          title: "Remove from my list",
                          style: {
                            border: "none",
                            background: "none",
                            color: "#ef4444",
                            cursor: busy ? "default" : "pointer",
                            fontSize: "0.85rem",
                          },
                        },
                        "Remove"
                      )
                    )
                  : React.createElement(
                      "button",
                      {
                        onClick: () => addOne(s.id),
                        disabled: busy,
                        style: {
                          border: "none",
                          background: "none",
                          color: "#10b981",
                          cursor: busy ? "default" : "pointer",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                        },
                      },
                      "Add"
                    )
              )
            )
      ),

      // Footer actions
      React.createElement(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        React.createElement(
          "span",
          { style: { fontSize: "0.85rem", color: "#6b7280" } },
          `${addableFiltered.length} available to add`
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
              onClick: addSelected,
              disabled: busy || selectedIds.size === 0,
              className: "btn btn-primary",
            },
            React.createElement("i", { className: "fas fa-plus" }),
            selectedIds.size > 0 ? ` Add ${selectedIds.size} selected` : " Add selected"
          )
        )
      )
    )
  );
};

// Export component
if (typeof window !== "undefined") {
  window.StudentPicker = StudentPicker;
  console.log("StudentPicker component loaded");
}
