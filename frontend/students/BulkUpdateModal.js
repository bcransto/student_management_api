// BulkUpdateModal.js - Bulk-update nickname/gender by pasting CSV/TSV from a spreadsheet
// Flow: paste -> Preview (dry run) -> Apply
console.log("Loading BulkUpdateModal component...");

const BulkUpdateModal = ({ onClose, onApplied }) => {
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [preview, setPreview] = React.useState(null);
  const [applied, setApplied] = React.useState(false);

  const submit = async (apply) => {
    setLoading(true);
    setError(null);
    try {
      const response = await window.ApiModule.request('/students/bulk-update-info/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, apply: apply }),
      });
      setPreview(response);
      if (apply) setApplied(true);
    } catch (err) {
      console.error("Error in bulk update:", err);
      setError(err.message || "Bulk update failed.");
    } finally {
      setLoading(false);
    }
  };

  const describeChanges = (changes) =>
    Object.entries(changes)
      .map(([field, change]) => `${field}: ${change.from || "(not set)"} → ${change.to || "(not set)"}`)
      .join(", ");

  const issueList = (items, color, prefix) =>
    items.length > 0 && React.createElement(
      "div",
      { style: { fontSize: "0.85rem", color: color, marginBottom: "0.5rem" } },
      React.createElement("strong", null, `${prefix}: `),
      items.map((item) => `line ${item.line}: ${item.reason || item.value}`).join("; ")
    );

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
        zIndex: 10000
      },
      onClick: (e) => {
        if (e.target === e.currentTarget && !loading) {
          applied ? onApplied() : onClose();
        }
      }
    },
    React.createElement(
      "div",
      {
        style: {
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "1.5rem",
          width: "90%",
          maxWidth: "560px",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
        }
      },

      // Header
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem"
          }
        },
        React.createElement(
          "h2",
          { style: { margin: 0, fontSize: "1.25rem" } },
          React.createElement("i", { className: "fas fa-file-csv", style: { marginRight: "8px" } }),
          "Bulk Update Students"
        ),
        React.createElement(
          "button",
          {
            onClick: () => (applied ? onApplied() : onClose()),
            style: {
              border: "none",
              background: "none",
              fontSize: "1.25rem",
              cursor: "pointer",
              color: "#6b7280"
            }
          },
          "×"
        )
      ),

      // Error banner
      error && React.createElement(
        "div",
        {
          style: {
            padding: "0.75rem",
            backgroundColor: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: "6px",
            marginBottom: "1rem",
            color: "#dc2626",
            fontSize: "0.9rem"
          }
        },
        error
      ),

      // Success banner after apply
      applied && preview && React.createElement(
        "div",
        {
          style: {
            padding: "0.75rem",
            backgroundColor: "#d1fae5",
            border: "1px solid #6ee7b7",
            borderRadius: "6px",
            marginBottom: "1rem",
            color: "#065f46"
          }
        },
        `Applied ${preview.updated.length} update${preview.updated.length !== 1 ? "s" : ""}.`
      ),

      // Paste area + help
      !applied && React.createElement(
        "div",
        null,
        React.createElement(
          "p",
          { style: { color: "#6b7280", fontSize: "0.85rem", marginBottom: "0.5rem" } },
          "Copy columns from a spreadsheet and paste below. First row must be a header ",
          "with at least one of ",
          React.createElement("code", null, "student_id"),
          " / ",
          React.createElement("code", null, "email"),
          " plus ",
          React.createElement("code", null, "nickname"),
          " and/or ",
          React.createElement("code", null, "gender"),
          " (m/f/o, or ",
          React.createElement("code", null, "-"),
          " to clear). Empty cells change nothing."
        ),
        React.createElement("textarea", {
          value: text,
          onChange: (e) => {
            setText(e.target.value);
            setPreview(null);
          },
          placeholder: "student_id\tnickname\tgender\n3334\tIzzy\tf\n2954\tLeo\tm",
          rows: 8,
          style: {
            width: "100%",
            boxSizing: "border-box",
            fontFamily: "monospace",
            fontSize: "13px",
            padding: "8px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            marginBottom: "0.75rem"
          }
        })
      ),

      // Preview results
      preview && React.createElement(
        "div",
        { style: { marginBottom: "0.75rem" } },
        preview.updated.length > 0 && React.createElement(
          "div",
          {
            style: {
              maxHeight: "200px",
              overflowY: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              padding: "0.5rem",
              marginBottom: "0.5rem"
            }
          },
          preview.updated.map((u) =>
            React.createElement(
              "div",
              {
                key: u.id,
                style: { fontSize: "0.85rem", padding: "0.25rem 0", borderBottom: "1px solid #f3f4f6" }
              },
              React.createElement("strong", null, u.name),
              ` — ${describeChanges(u.changes)}`
            )
          )
        ),
        issueList(preview.not_found, "#dc2626", "Not found"),
        issueList(preview.invalid, "#dc2626", "Invalid"),
        issueList(preview.conflicts, "#b45309", "Conflicts"),
        preview.unchanged.length > 0 && React.createElement(
          "div",
          { style: { fontSize: "0.85rem", color: "#6b7280", marginBottom: "0.5rem" } },
          `${preview.unchanged.length} row${preview.unchanged.length !== 1 ? "s" : ""} already up to date.`
        ),
        !applied && preview.updated.length === 0 && React.createElement(
          "div",
          { style: { fontSize: "0.9rem", color: "#6b7280" } },
          "Nothing to change."
        )
      ),

      // Loading
      loading && React.createElement(
        "div",
        { style: { textAlign: "center", padding: "0.75rem", color: "#6b7280" } },
        React.createElement("div", { className: "spinner", style: { margin: "0 auto 0.5rem" } }),
        "Working..."
      ),

      // Action buttons
      !loading && !applied && React.createElement(
        "div",
        { style: { display: "flex", gap: "8px" } },
        React.createElement(
          "button",
          {
            className: "btn btn-secondary",
            style: { flex: 1 },
            onClick: () => submit(false),
            disabled: !text.trim()
          },
          "Preview"
        ),
        React.createElement(
          "button",
          {
            className: "btn btn-primary",
            style: { flex: 1 },
            onClick: () => submit(true),
            disabled: !preview || preview.updated.length === 0,
            title: !preview ? "Preview first" : undefined
          },
          preview && preview.updated.length > 0
            ? `Apply ${preview.updated.length} Change${preview.updated.length !== 1 ? "s" : ""}`
            : "Apply"
        )
      ),

      applied && React.createElement(
        "button",
        {
          className: "btn btn-primary",
          style: { width: "100%" },
          onClick: onApplied
        },
        "Done"
      )
    )
  );
};

// Export component
if (typeof window !== "undefined") {
  window.BulkUpdateModal = BulkUpdateModal;
  console.log("BulkUpdateModal component loaded");
}
