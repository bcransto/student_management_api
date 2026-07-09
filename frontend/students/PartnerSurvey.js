// frontend/students/PartnerSurvey.js
// Student-facing partner survey (GH issue #16, phase 2).
//
// Rendered full-screen for a student session when the hash is
// #my-partners/{classId}. Lets a student privately pick classmates they work
// well with (up to 5) and don't work well with (up to 3), then save. All data
// comes from GET/POST /api/my-partners/{classId}/ (IsStudent-only).

const PartnerSurvey = ({ classId, currentUser, onLogout }) => {
  const { useState, useEffect } = React;

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState(null); // full GET/POST response
  const [errorMsg, setErrorMsg] = useState("");
  // Map of target_id (number) -> preference (1 | -1). Neutral = absent.
  const [choices, setChoices] = useState({});
  const [baseline, setBaseline] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const POSITIVE_CAP = state && state.caps ? state.caps.positive : 5;
  const NEGATIVE_CAP = state && state.caps ? state.caps.negative : 3;

  const choicesToMap = (list) => {
    const map = {};
    (list || []).forEach((c) => {
      map[c.target_id] = c.preference;
    });
    return map;
  };

  const loadSurvey = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const response = await window.ApiModule.request(`/my-partners/${classId}/`, {
        method: "GET",
      });
      setState(response);
      if (response && response.open) {
        const map = choicesToMap(response.choices);
        setChoices(map);
        setBaseline(map);
      }
    } catch (err) {
      console.error("Failed to load partner survey:", err);
      // The roster gate returns 404 for non-members; any failure here just
      // means the survey isn't available to this student right now.
      setErrorMsg("unavailable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSurvey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const counts = () => {
    let pos = 0;
    let neg = 0;
    Object.values(choices).forEach((p) => {
      if (p === 1) pos += 1;
      else if (p === -1) neg += 1;
    });
    return { pos, neg };
  };

  const isDirty = () => {
    const keys = new Set([...Object.keys(choices), ...Object.keys(baseline)]);
    for (const k of keys) {
      if (choices[k] !== baseline[k]) return true;
    }
    return false;
  };

  const setPreference = (targetId, preference) => {
    setSaveStatus("");
    setChoices((prev) => {
      const next = { ...prev };
      if (preference === 0) {
        delete next[targetId];
      } else {
        next[targetId] = preference;
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("");
    try {
      const payload = {
        choices: Object.entries(choices).map(([targetId, preference]) => ({
          target_id: Number(targetId),
          preference,
        })),
      };
      const response = await window.ApiModule.request(`/my-partners/${classId}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response && response.open) {
        const map = choicesToMap(response.choices);
        setChoices(map);
        setBaseline(map);
        setSaveStatus("Saved! Thanks for sharing.");
      } else {
        // Survey closed between load and save.
        setState(response);
      }
    } catch (err) {
      console.error("Failed to save partner survey:", err);
      setSaveStatus("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ---- Shared full-screen shell ----------------------------------------
  const shell = (children) =>
    React.createElement(
      "div",
      {
        style: {
          minHeight: "100vh",
          background: "#f3f4f6",
          padding: "24px",
          boxSizing: "border-box",
        },
      },
      React.createElement(
        "div",
        {
          style: {
            maxWidth: "640px",
            margin: "0 auto",
            width: "100%",
          },
        },
        children
      )
    );

  const messageCard = (emoji, title, body) =>
    shell(
      React.createElement(
        "div",
        {
          style: {
            background: "#ffffff",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
            padding: "40px 32px",
            textAlign: "center",
          },
        },
        React.createElement("div", { style: { fontSize: "48px", marginBottom: "16px" } }, emoji),
        React.createElement(
          "h1",
          { style: { fontSize: "22px", fontWeight: 700, color: "#111827", margin: "0 0 8px" } },
          title
        ),
        React.createElement(
          "p",
          { style: { fontSize: "15px", color: "#4b5563", lineHeight: 1.5, margin: "0 0 28px" } },
          body
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

  // ---- Loading ----------------------------------------------------------
  if (loading) {
    return shell(
      React.createElement(
        "div",
        { style: { textAlign: "center", padding: "60px 0" } },
        React.createElement("div", { className: "spinner" }),
        React.createElement("p", { style: { color: "#6b7280" } }, "Loading survey...")
      )
    );
  }

  // ---- Not available / not enrolled ------------------------------------
  if (errorMsg === "unavailable") {
    return messageCard(
      "🔒",
      "Survey unavailable",
      "This partner survey isn't available for your account. If you think this is a mistake, please check with your teacher."
    );
  }

  // ---- Closed / disabled / not-yet-open --------------------------------
  if (state && state.open === false) {
    const reasonCopy = {
      not_enabled: {
        emoji: "⏳",
        title: "Survey not open yet",
        body: `The partner survey for ${state.class_name || "this class"} isn't open right now. Please check back later.`,
      },
      not_yet_open: {
        emoji: "📅",
        title: "Survey opens soon",
        body: `The partner survey for ${state.class_name || "this class"} hasn't opened yet. Please check back when your teacher tells you it's ready.`,
      },
      closed: {
        emoji: "✅",
        title: "Survey closed",
        body: `The partner survey for ${state.class_name || "this class"} is now closed. Thanks for your interest!`,
      },
    };
    const c = reasonCopy[state.reason] || reasonCopy.not_enabled;
    return messageCard(c.emoji, c.title, c.body);
  }

  // ---- Open survey ------------------------------------------------------
  const { pos, neg } = counts();
  const classmates = (state && state.classmates) || [];

  const pill = (label, current, cap, color) =>
    React.createElement(
      "div",
      {
        style: {
          padding: "6px 12px",
          borderRadius: "999px",
          background: current >= cap ? color : "#e5e7eb",
          color: current >= cap ? "#ffffff" : "#374151",
          fontSize: "13px",
          fontWeight: 600,
        },
      },
      `${label}: ${current} of ${cap}`
    );

  const prefButton = (targetId, value, current) => {
    const active = current === value;
    const isPositive = value === 1;
    const capReached = isPositive ? pos >= POSITIVE_CAP : neg >= NEGATIVE_CAP;
    // Disable a not-yet-selected pick once its cap is hit; always allow toggling off.
    const disabled = !active && capReached;
    const activeColor = isPositive ? "#10b981" : "#ef4444";
    return React.createElement(
      "button",
      {
        onClick: () => setPreference(targetId, active ? 0 : value),
        disabled,
        title: isPositive ? "Works well" : "Doesn't work well",
        style: {
          width: "44px",
          height: "44px",
          borderRadius: "8px",
          border: active ? `2px solid ${activeColor}` : "1px solid #d1d5db",
          background: active ? activeColor : "#ffffff",
          color: active ? "#ffffff" : disabled ? "#d1d5db" : "#6b7280",
          fontSize: "18px",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
      },
      React.createElement("i", {
        className: isPositive ? "fas fa-thumbs-up" : "fas fa-thumbs-down",
      })
    );
  };

  return shell(
    React.createElement(
      "div",
      null,
      // Header
      React.createElement(
        "div",
        {
          style: {
            background: "#ffffff",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
            padding: "24px",
            marginBottom: "16px",
          },
        },
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "12px",
              flexWrap: "wrap",
            },
          },
          React.createElement(
            "div",
            null,
            React.createElement(
              "h1",
              { style: { fontSize: "20px", fontWeight: 700, color: "#111827", margin: "0 0 4px" } },
              (state && state.class_name) || "Partner Survey"
            ),
            (() => {
              const user = window.AuthModule && window.AuthModule.getUserInfo();
              const name = user && [user.firstName, user.lastName].filter(Boolean).join(" ");
              return name
                ? React.createElement(
                    "p",
                    { style: { fontSize: "14px", fontWeight: 600, color: "#374151", margin: "0 0 4px" } },
                    name
                  )
                : null;
            })(),
            React.createElement(
              "p",
              { style: { fontSize: "14px", color: "#6b7280", margin: 0 } },
              "Pick classmates you work well with, and any you'd rather not sit with. This is private - only your teacher sees it."
            )
          ),
          React.createElement(
            "button",
            {
              onClick: onLogout,
              style: {
                padding: "6px 12px",
                fontSize: "13px",
                fontWeight: 500,
                color: "#374151",
                background: "#f3f4f6",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              },
            },
            "Sign out"
          )
        ),
        // Counters
        React.createElement(
          "div",
          { style: { display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" } },
          pill("👍 Works well", pos, POSITIVE_CAP, "#10b981"),
          pill("👎 Not a match", neg, NEGATIVE_CAP, "#ef4444")
        )
      ),

      // Classmate rows
      React.createElement(
        "div",
        {
          style: {
            background: "#ffffff",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
            overflow: "hidden",
          },
        },
        classmates.length === 0
          ? React.createElement(
              "p",
              { style: { padding: "24px", textAlign: "center", color: "#6b7280", margin: 0 } },
              "There are no other students in this class yet."
            )
          : classmates.map((mate, idx) =>
              React.createElement(
                "div",
                {
                  key: mate.id,
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    padding: "12px 16px",
                    borderTop: idx === 0 ? "none" : "1px solid #f3f4f6",
                  },
                },
                React.createElement(
                  "span",
                  { style: { fontSize: "15px", color: "#111827", fontWeight: 500 } },
                  `${mate.first_name} ${mate.last_name}`
                ),
                React.createElement(
                  "div",
                  { style: { display: "flex", gap: "8px" } },
                  prefButton(mate.id, 1, choices[mate.id]),
                  prefButton(mate.id, -1, choices[mate.id])
                )
              )
            )
      ),

      // Save bar
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginTop: "16px",
            flexWrap: "wrap",
          },
        },
        React.createElement(
          "button",
          {
            onClick: handleSave,
            disabled: saving || !isDirty(),
            style: {
              padding: "12px 24px",
              fontSize: "15px",
              fontWeight: 600,
              color: "#ffffff",
              background: saving || !isDirty() ? "#9ca3af" : "#667eea",
              border: "none",
              borderRadius: "8px",
              cursor: saving || !isDirty() ? "not-allowed" : "pointer",
            },
          },
          saving ? "Saving..." : "Save my picks"
        ),
        saveStatus &&
          React.createElement(
            "span",
            {
              style: {
                fontSize: "14px",
                fontWeight: 500,
                color: saveStatus.startsWith("Saved") ? "#10b981" : "#ef4444",
              },
            },
            saveStatus
          )
      )
    )
  );
};

// Export for use in other modules
if (typeof window !== "undefined") {
  window.PartnerSurvey = PartnerSurvey;
}
