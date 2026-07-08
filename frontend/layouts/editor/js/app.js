// app.js - Main Layout Editor Component
const LayoutEditor = () => {
  const [layout, setLayout] = useState({ ...DEFAULT_LAYOUT });
  const [selectedTool, setSelectedTool] = useState(TOOL_MODES.SELECT);
  const [showGrid, setShowGrid] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Dirty tracking: snapshot of the last-saved/loaded layout, used to detect
  // unsaved changes for the beforeunload warning and the Back button.
  const savedSnapshotRef = useRef(null);
  const leavingIntentionallyRef = useRef(false);

  const isDirty = () => {
    if (savedSnapshotRef.current === null) return false;
    return JSON.stringify(layout) !== savedSnapshotRef.current;
  };

  // Load layout from URL parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const layoutId = urlParams.get("layout");

    if (layoutId) {
      loadLayout(layoutId);
    } else {
      // New layout - baseline snapshot is the initial default state
      savedSnapshotRef.current = JSON.stringify(layout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before closing/reloading the tab (also covers browser back, since
  // this editor is a full page navigation rather than an SPA route).
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (leavingIntentionallyRef.current) return;
      if (!isDirty()) return;
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  });

  const loadLayout = async (layoutId) => {
    try {
      setLoading(true);
      console.log("Loading layout with ID:", layoutId);
      const layoutData = await ApiHelper.request(`/layouts/${layoutId}/`);
      console.log("Layout data received:", layoutData);

      const loadedLayout = {
        id: layoutData.id,
        name: layoutData.name,
        description: layoutData.description || "",
        room_width: layoutData.room_width,
        room_height: layoutData.room_height,
        tables: layoutData.tables.map((table) => ({
          id: table.id || Date.now() + Math.random(),
          table_number: table.table_number,
          table_name: table.table_name,
          x_position: table.x_position,
          y_position: table.y_position,
          width: table.width,
          height: table.height,
          max_seats: table.max_seats,
          table_shape: table.table_shape,
          rotation: table.rotation,
          seats: table.seats || [],
        })),
        obstacles: layoutData.obstacles.map((obstacle) => ({
          id: obstacle.id || Date.now() + Math.random(),
          name: obstacle.name,
          obstacle_type: obstacle.obstacle_type,
          x_position: obstacle.x_position,
          y_position: obstacle.y_position,
          width: obstacle.width,
          height: obstacle.height,
          color: obstacle.color,
        })),
      };

      setLayout(loadedLayout);
      savedSnapshotRef.current = JSON.stringify(loadedLayout);

      console.log("Layout state set successfully");
      document.title = `Edit Layout: ${layoutData.name}`;
    } catch (error) {
      console.error("Error loading layout:", error);
      alert(`Failed to load layout: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const apiLayout = {
        name: layout.name,
        description: layout.description,
        room_width: layout.room_width,
        room_height: layout.room_height,
        is_template: false,
        tables: layout.tables.map((table) => ({
          table_number: table.table_number,
          table_name: table.table_name,
          x_position: table.x_position,
          y_position: table.y_position,
          width: table.width,
          height: table.height,
          max_seats: table.max_seats,
          table_shape: table.table_shape,
          rotation: table.rotation,
          seats:
            table.seats?.map((seat) => ({
              seat_number: seat.seat_number,
              relative_x: seat.relative_x,
              relative_y: seat.relative_y,
              is_accessible: seat.is_accessible,
              notes: seat.notes || "",
            })) || [],
        })),
        obstacles: layout.obstacles.map((obstacle) => ({
          name: obstacle.name,
          obstacle_type: obstacle.obstacle_type,
          x_position: obstacle.x_position,
          y_position: obstacle.y_position,
          width: obstacle.width,
          height: obstacle.height,
          color: obstacle.color,
        })),
      };

      let savedLayout;
      if (layout.id) {
        savedLayout = await ApiHelper.request(`/layouts/${layout.id}/update_from_editor/`, {
          method: "PUT",
          body: JSON.stringify(apiLayout),
        });
        // No fields change locally beyond what's already in `layout` -
        // the current state is now the saved state.
        savedSnapshotRef.current = JSON.stringify(layout);
      } else {
        savedLayout = await ApiHelper.request("/layouts/create_from_editor/", {
          method: "POST",
          body: JSON.stringify(apiLayout),
        });
        const updatedLayout = { ...layout, id: savedLayout.id };
        setLayout(updatedLayout);
        savedSnapshotRef.current = JSON.stringify(updatedLayout);
      }

      alert(layout.id ? "✅ Layout updated successfully!" : "✅ Layout created successfully!");
    } catch (error) {
      console.error("Save error:", error);
      alert("❌ Error saving layout. Please check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!layout.id) {
      alert("❌ This layout hasn't been saved yet.");
      return;
    }

    const confirmDelete = confirm(`Are you sure you want to delete "${layout.name}"? This action cannot be undone.`);
    if (!confirmDelete) {
      return;
    }

    try {
      setLoading(true);
      await ApiHelper.request(`/layouts/${layout.id}/`, {
        method: "DELETE",
      });
      alert("✅ Layout deleted successfully!");
      // Redirect to layouts page after deletion (intentional navigation,
      // so don't let the beforeunload handler prompt on the way out)
      leavingIntentionallyRef.current = true;
      window.location.href = "/#layouts";
    } catch (error) {
      console.error("Delete error:", error);
      alert("❌ Error deleting layout. Please check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (isDirty()) {
      const confirmLeave = confirm("You have unsaved changes. Leave without saving?");
      if (!confirmLeave) {
        return;
      }
    }
    // Intentional navigation - suppress the beforeunload prompt
    leavingIntentionallyRef.current = true;
    window.location.href = "/#layouts";
  };

  // Loading state
  if (loading) {
    return React.createElement(
      "div",
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#f3f4f6'
        }
      },
      React.createElement(
        "div",
        {
          style: { textAlign: 'center' }
        },
        React.createElement("div", {
          style: {
            width: '48px',
            height: '48px',
            border: '3px solid #e5e7eb',
            borderTopColor: '#2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }
        }),
        React.createElement(
          "p",
          {
            style: { color: '#6b7280' }
          },
          "Loading layout editor..."
        ),
        React.createElement('style', {
          dangerouslySetInnerHTML: {
            __html: '@keyframes spin { to { transform: rotate(360deg); } }'
          }
        })
      )
    );
  }

  // Main layout editor render
  console.log("Rendering with layout:", layout);
  console.log("Tables count:", layout.tables.length);
  console.log("Loading state:", loading);

  return React.createElement(
    "div",
    {
      style: {
        display: 'flex',
        height: '100vh',
        backgroundColor: '#f3f4f6'
      }
    },
    React.createElement(Sidebar, {
      layout,
      setLayout,
      onBack: handleBack,
      selectedTool,
      setSelectedTool,
      onSave: handleSave,
      onDelete: handleDelete,
      showGrid,
      setShowGrid,
      selectedItem,
      setSelectedItem,
    }),
    React.createElement(CanvasArea, {
      layout,
      setLayout,
      selectedTool,
      showGrid,
      selectedItem,
      setSelectedItem,
    })
  );
};

// Initialize the app
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(LayoutEditor));
