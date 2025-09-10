// AttendanceReport.js - Attendance analytics and reporting
console.log("Loading AttendanceReport component...");

const AttendanceReport = ({ classId, data, refreshData, navigateTo }) => {
  const [reportData, setReportData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [dateRange, setDateRange] = React.useState('all'); // 'all', 'month', 'week'
  const [selectedStudent, setSelectedStudent] = React.useState(null);

  // Load report data
  React.useEffect(() => {
    loadReportData();
  }, [classId]);

  const loadReportData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load multiple data sources in parallel
      const [totalsResponse, datesResponse, classResponse] = await Promise.all([
        window.ApiModule.request(`/attendance/totals/${classId}/`),
        window.ApiModule.request(`/attendance/dates/${classId}/`),
        window.ApiModule.request(`/classes/${classId}/`)
      ]);

      // Process the data
      const totals = totalsResponse.totals || [];
      const dates = datesResponse.dates || [];
      const classInfo = classResponse;

      // Calculate overall statistics
      const stats = calculateStatistics(totals, dates);

      setReportData({
        classInfo,
        totals,
        dates,
        stats
      });
      setLoading(false);
    } catch (err) {
      console.error("Error loading report data:", err);
      setError("Failed to load attendance report");
      setLoading(false);
    }
  };

  const calculateStatistics = (totals, dates) => {
    const totalStudents = totals.length;
    const totalDays = dates.length;
    
    // Calculate average attendance rate
    let totalAbsences = 0;
    let totalTardies = 0;
    let totalEarlyDismissals = 0;
    let perfectAttendance = [];
    let concerningAttendance = [];

    totals.forEach(student => {
      totalAbsences += student.absent || 0;
      totalTardies += student.tardy || 0;
      totalEarlyDismissals += student.early_dismissal || 0;

      // Check for perfect attendance
      if (student.absent === 0 && student.tardy === 0 && student.early_dismissal === 0) {
        perfectAttendance.push(student);
      }

      // Check for concerning attendance (>10% absences)
      const studentTotalDays = dates.length;
      const absenceRate = student.absent / studentTotalDays;
      if (absenceRate > 0.1) {
        concerningAttendance.push({
          ...student,
          absenceRate: (absenceRate * 100).toFixed(1)
        });
      }
    });

    const totalPossibleAttendance = totalStudents * totalDays;
    const actualAttendance = totalPossibleAttendance - totalAbsences;
    const attendanceRate = totalDays > 0 ? (actualAttendance / totalPossibleAttendance * 100) : 100;

    return {
      totalStudents,
      totalDays,
      attendanceRate: attendanceRate.toFixed(1),
      totalAbsences,
      totalTardies,
      totalEarlyDismissals,
      perfectAttendance,
      concerningAttendance
    };
  };

  const exportToCSV = () => {
    if (!reportData || !reportData.totals) return;

    // Create CSV content
    const headers = ['Student Name', 'Absences', 'Tardies', 'Early Dismissals', 'Absence Rate'];
    const rows = reportData.totals.map(student => {
      const absenceRate = ((student.absent / reportData.dates.length) * 100).toFixed(1);
      return [
        student.student_name,
        student.absent,
        student.tardy,
        student.early_dismissal,
        `${absenceRate}%`
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_report_${reportData.classInfo.name}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleBack = () => {
    if (navigateTo && typeof navigateTo === 'function') {
      navigateTo('attendance');
    } else {
      window.location.hash = '#attendance';
    }
  };

  // Loading state
  if (loading) {
    return React.createElement(
      "div",
      { className: "attendance-report-container" },
      React.createElement(
        "div",
        { className: "loading" },
        React.createElement("div", { className: "spinner" }),
        React.createElement("p", null, "Loading attendance report...")
      )
    );
  }

  // Error state
  if (error) {
    return React.createElement(
      "div",
      { className: "attendance-report-container" },
      React.createElement(
        "div",
        { className: "error-message" },
        React.createElement("h3", null, "Error"),
        React.createElement("p", null, error),
        React.createElement(
          "button",
          { className: "btn btn-primary", onClick: handleBack },
          "Back to Attendance"
        )
      )
    );
  }

  // Main render
  return React.createElement(
    "div",
    { className: "attendance-report-container" },
    
    // Header
    React.createElement(
      "div",
      { className: "report-header" },
      React.createElement(
        "div",
        { className: "report-header-content" },
        React.createElement(
          "button",
          { className: "btn-back", onClick: handleBack },
          React.createElement("i", { className: "fas fa-arrow-left" }),
          " Back"
        ),
        React.createElement(
          "h1",
          { className: "report-title" },
          `Attendance Report - ${reportData.classInfo.name}`
        ),
        React.createElement(
          "button",
          { className: "btn btn-secondary", onClick: exportToCSV },
          React.createElement("i", { className: "fas fa-download" }),
          " Export CSV"
        )
      )
    ),

    // Summary Cards
    React.createElement(
      "div",
      { className: "report-summary-cards" },
      
      // Overall Attendance Rate
      React.createElement(
        "div",
        { className: "summary-card" },
        React.createElement(
          "div",
          { className: "summary-card-icon" },
          React.createElement("i", { className: "fas fa-percentage" })
        ),
        React.createElement(
          "div",
          { className: "summary-card-content" },
          React.createElement("h3", null, "Attendance Rate"),
          React.createElement("p", { className: "summary-value" }, `${reportData.stats.attendanceRate}%`),
          React.createElement("span", { className: "summary-label" }, `${reportData.stats.totalDays} total days`)
        )
      ),

      // Total Students
      React.createElement(
        "div",
        { className: "summary-card" },
        React.createElement(
          "div",
          { className: "summary-card-icon" },
          React.createElement("i", { className: "fas fa-users" })
        ),
        React.createElement(
          "div",
          { className: "summary-card-content" },
          React.createElement("h3", null, "Students"),
          React.createElement("p", { className: "summary-value" }, reportData.stats.totalStudents),
          React.createElement("span", { className: "summary-label" }, "Enrolled students")
        )
      ),

      // Total Absences
      React.createElement(
        "div",
        { className: "summary-card" },
        React.createElement(
          "div",
          { className: "summary-card-icon absent" },
          React.createElement("i", { className: "fas fa-user-times" })
        ),
        React.createElement(
          "div",
          { className: "summary-card-content" },
          React.createElement("h3", null, "Absences"),
          React.createElement("p", { className: "summary-value" }, reportData.stats.totalAbsences),
          React.createElement("span", { className: "summary-label" }, "Total absences")
        )
      ),

      // Total Tardies
      React.createElement(
        "div",
        { className: "summary-card" },
        React.createElement(
          "div",
          { className: "summary-card-icon tardy" },
          React.createElement("i", { className: "fas fa-clock" })
        ),
        React.createElement(
          "div",
          { className: "summary-card-content" },
          React.createElement("h3", null, "Tardies"),
          React.createElement("p", { className: "summary-value" }, reportData.stats.totalTardies),
          React.createElement("span", { className: "summary-label" }, "Total tardies")
        )
      )
    ),

    // Perfect Attendance Section
    reportData.stats.perfectAttendance.length > 0 && React.createElement(
      "div",
      { className: "report-section perfect-attendance" },
      React.createElement(
        "h2",
        null,
        React.createElement("i", { className: "fas fa-star" }),
        " Perfect Attendance"
      ),
      React.createElement(
        "div",
        { className: "student-badges" },
        reportData.stats.perfectAttendance.map(student =>
          React.createElement(
            "div",
            { key: student.student_id, className: "student-badge" },
            React.createElement("i", { className: "fas fa-award" }),
            React.createElement("span", null, student.student_name)
          )
        )
      )
    ),

    // Concerning Attendance Section
    reportData.stats.concerningAttendance.length > 0 && React.createElement(
      "div",
      { className: "report-section concerning-attendance" },
      React.createElement(
        "h2",
        null,
        React.createElement("i", { className: "fas fa-exclamation-triangle" }),
        " Needs Attention (>10% Absences)"
      ),
      React.createElement(
        "div",
        { className: "concerning-list" },
        reportData.stats.concerningAttendance.map(student =>
          React.createElement(
            "div",
            { key: student.student_id, className: "concerning-item" },
            React.createElement("span", { className: "student-name" }, student.student_name),
            React.createElement(
              "span",
              { className: "absence-rate" },
              `${student.absenceRate}% absence rate`
            ),
            React.createElement(
              "span",
              { className: "absence-count" },
              `(${student.absent} absences)`
            )
          )
        )
      )
    ),

    // Detailed Student Table
    React.createElement(
      "div",
      { className: "report-section" },
      React.createElement("h2", null, "Detailed Attendance Records"),
      React.createElement(
        "table",
        { className: "attendance-table" },
        React.createElement(
          "thead",
          null,
          React.createElement(
            "tr",
            null,
            React.createElement("th", null, "Student Name"),
            React.createElement("th", null, "Absences"),
            React.createElement("th", null, "Tardies"),
            React.createElement("th", null, "Early Dismissals"),
            React.createElement("th", null, "Absence Rate")
          )
        ),
        React.createElement(
          "tbody",
          null,
          reportData.totals.map(student => {
            const absenceRate = reportData.dates.length > 0 
              ? ((student.absent / reportData.dates.length) * 100).toFixed(1)
              : 0;
            
            return React.createElement(
              "tr",
              { 
                key: student.student_id,
                className: absenceRate > 10 ? "high-absence" : ""
              },
              React.createElement("td", null, student.student_name),
              React.createElement("td", { className: "text-center" }, student.absent),
              React.createElement("td", { className: "text-center" }, student.tardy),
              React.createElement("td", { className: "text-center" }, student.early_dismissal),
              React.createElement(
                "td",
                { className: "text-center" },
                React.createElement(
                  "span",
                  { className: `absence-rate-badge ${absenceRate > 10 ? 'high' : absenceRate > 5 ? 'medium' : 'low'}` },
                  `${absenceRate}%`
                )
              )
            );
          })
        )
      )
    )
  );
};

// Export for use
window.AttendanceReport = AttendanceReport;
console.log("AttendanceReport component loaded and exported to window.AttendanceReport");