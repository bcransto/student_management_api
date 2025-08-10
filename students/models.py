# students/models.py - Updated with Layout System
import json
from datetime import date

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models


class User(AbstractUser):
    """Custom user model for teachers"""

    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30)
    is_teacher = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username", "first_name", "last_name"]


class ClassroomLayout(models.Model):
    """Model to define the physical layout of a classroom"""

    name = models.CharField(max_length=100, help_text="e.g., 'Room 201 Standard', 'Science Lab Layout'")
    description = models.TextField(blank=True, help_text="Description of this layout")

    # Room dimensions
    room_width = models.PositiveIntegerField(help_text="Room width in grid units (e.g., 12)")
    room_height = models.PositiveIntegerField(help_text="Room height in grid units (e.g., 8)")

    # Layout metadata
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="created_layouts")
    is_template = models.BooleanField(default=False, help_text="Can this layout be used by other teachers?")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.room_width}x{self.room_height})"

    @property
    def total_seats(self):
        """Count total number of seats in this layout"""
        return sum(table.max_seats for table in self.tables.all())

    @property
    def total_tables(self):
        """Count total number of tables in this layout"""
        return self.tables.count()

    def get_layout_data(self):
        """Get complete layout data for frontend visualization"""
        return {
            "id": self.id,
            "name": self.name,
            "room_width": self.room_width,
            "room_height": self.room_height,
            "tables": [table.get_table_data() for table in self.tables.all()],
            "obstacles": [obstacle.get_obstacle_data() for obstacle in self.obstacles.all()],
        }


class ClassroomTable(models.Model):
    """Model for tables/desks within a classroom layout"""

    layout = models.ForeignKey(ClassroomLayout, on_delete=models.CASCADE, related_name="tables")

    # Table identification
    table_number = models.PositiveIntegerField(help_text="Unique table number within the classroom")
    table_name = models.CharField(max_length=50, blank=True, help_text="Optional name like 'Front Left', 'Group A'")

    # Position and size
    x_position = models.PositiveIntegerField(help_text="X coordinate on the room grid")
    y_position = models.PositiveIntegerField(help_text="Y coordinate on the room grid")
    width = models.PositiveIntegerField(default=2, help_text="Table width in grid units")
    height = models.PositiveIntegerField(default=2, help_text="Table height in grid units")

    # Table properties
    max_seats = models.PositiveIntegerField(default=4, help_text="Maximum number of students at this table")
    table_shape = models.CharField(
        max_length=20,
        choices=[
            ("rectangular", "Rectangular"),
            ("round", "Round"),
            ("u_shaped", "U-Shaped"),
            ("individual", "Individual Desk"),
        ],
        default="rectangular",
    )

    # Rotation (0, 90, 180, 270 degrees)
    rotation = models.PositiveIntegerField(default=0, choices=[(0, "0°"), (90, "90°"), (180, "180°"), (270, "270°")])

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [["layout", "table_number"]]
        ordering = ["table_number"]

    def __str__(self):
        name_part = f" ({self.table_name})" if self.table_name else ""
        return f"Table {self.table_number}{name_part} in {self.layout.name}"

    def get_table_data(self):
        """Get table data for frontend visualization"""
        return {
            "id": self.id,
            "table_number": self.table_number,
            "table_name": self.table_name,
            "x_position": self.x_position,
            "y_position": self.y_position,
            "width": self.width,
            "height": self.height,
            "max_seats": self.max_seats,
            "table_shape": self.table_shape,
            "rotation": self.rotation,
            "seats": [seat.get_seat_data() for seat in self.seats.all()],
        }


class TableSeat(models.Model):
    """Model for individual seats at each table"""

    table = models.ForeignKey(ClassroomTable, on_delete=models.CASCADE, related_name="seats")

    # Seat identification
    seat_number = models.PositiveIntegerField(help_text="Unique seat number within the table")

    # Position relative to table (normalized 0-1 coordinates)
    relative_x = models.FloatField(help_text="X position relative to table (0.0 - 1.0)")
    relative_y = models.FloatField(help_text="Y position relative to table (0.0 - 1.0)")

    # Seat properties
    is_accessible = models.BooleanField(default=True, help_text="Is this seat wheelchair accessible?")
    notes = models.CharField(max_length=200, blank=True, help_text="Special notes about this seat")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [["table", "seat_number"]]
        ordering = ["seat_number"]

    def __str__(self):
        return f"Seat {self.seat_number} at {self.table}"

    @property
    def absolute_seat_id(self):
        """Generate a unique seat ID across the entire classroom"""
        return f"{self.table.table_number}-{self.seat_number}"

    def get_seat_data(self):
        """Get seat data for frontend visualization"""
        return {
            "id": self.id,
            "seat_number": self.seat_number,
            "absolute_seat_id": self.absolute_seat_id,
            "relative_x": self.relative_x,
            "relative_y": self.relative_y,
            "is_accessible": self.is_accessible,
            "notes": self.notes,
        }


class LayoutObstacle(models.Model):
    """Model for obstacles in the classroom (teacher desk, cabinets, etc.)"""

    layout = models.ForeignKey(ClassroomLayout, on_delete=models.CASCADE, related_name="obstacles")

    # Obstacle identification
    name = models.CharField(max_length=100, help_text="e.g., 'Teacher Desk', 'Bookshelf', 'Door'")
    obstacle_type = models.CharField(
        max_length=30,
        choices=[
            ("teacher_desk", "Teacher Desk"),
            ("cabinet", "Cabinet"),
            ("bookshelf", "Bookshelf"),
            ("door", "Door"),
            ("window", "Window"),
            ("whiteboard", "Whiteboard"),
            ("projector", "Projector"),
            ("other", "Other"),
        ],
    )

    # Position and size
    x_position = models.PositiveIntegerField()
    y_position = models.PositiveIntegerField()
    width = models.PositiveIntegerField(default=1)
    height = models.PositiveIntegerField(default=1)

    # Visual properties
    color = models.CharField(max_length=7, default="#cccccc", help_text="Hex color code")

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} in {self.layout.name}"

    def get_obstacle_data(self):
        """Get obstacle data for frontend visualization"""
        return {
            "id": self.id,
            "name": self.name,
            "obstacle_type": self.obstacle_type,
            "x_position": self.x_position,
            "y_position": self.y_position,
            "width": self.width,
            "height": self.height,
            "color": self.color,
        }


class Class(models.Model):
    """Model for classes/courses"""

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    subject = models.CharField(max_length=50)
    grade_level = models.CharField(max_length=20, blank=True, null=True)
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name="classes_taught")

    # Classroom layout
    classroom_layout = models.ForeignKey(
        ClassroomLayout,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="classes_using_layout",
        help_text="Physical layout of the classroom",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Classes"

    def __str__(self):
        return f"{self.name} - {self.teacher.get_full_name()}"

    @property
    def current_enrollment(self):
        return self.roster.filter(is_active=True).count()

    @property
    def current_seating_period(self):
        """Get the current active seating period"""
        return self.seating_periods.filter(is_active=True).first()

    def get_available_seats(self):
        """Get all available seats based on the classroom layout"""
        if not self.classroom_layout:
            return []

        available_seats = []
        for table in self.classroom_layout.tables.all():
            for seat in table.seats.all():
                available_seats.append(
                    {
                        "table_number": table.table_number,
                        "table_name": table.table_name,
                        "seat_id": seat.absolute_seat_id,
                        "seat_number": seat.seat_number,
                        "is_accessible": seat.is_accessible,
                        "table_shape": table.table_shape,
                    }
                )
        return available_seats

    def get_current_seating_chart(self):
        """Get current seating chart with student assignments"""
        current_period = self.current_seating_period
        if not current_period or not self.classroom_layout:
            return None

        layout_data = self.classroom_layout.get_layout_data()

        # Add student assignments to seats
        assignments = current_period.seating_assignments.all()
        assignment_map = {assignment.seat_id: assignment for assignment in assignments}

        for table in layout_data["tables"]:
            for seat in table["seats"]:
                seat_id = seat["absolute_seat_id"]
                if seat_id in assignment_map:
                    assignment = assignment_map[seat_id]
                    seat["student"] = {
                        "id": assignment.roster_entry.student.id,
                        "name": assignment.roster_entry.student.get_full_name(),
                        "group_number": assignment.group_number,
                        "group_role": assignment.group_role,
                    }
                else:
                    seat["student"] = None

        return layout_data

    def get_seating_history_for_student(self, student):
        """Get all seating assignments for a specific student"""
        return SeatingAssignment.objects.filter(
            seating_period__class_assigned=self, roster_entry__student=student
        ).order_by("seating_period__start_date")

    def get_students_who_sat_together(self, student1, student2):
        """Check if two students have ever sat together and when"""
        # Get all seating periods where both students were present
        periods_with_both = (
            SeatingPeriod.objects.filter(
                class_assigned=self, seating_assignments__roster_entry__student__in=[student1, student2]
            )
            .annotate(student_count=models.Count("seating_assignments__roster_entry__student", distinct=True))
            .filter(student_count=2)
        )

        # Check if they were in same group or at same table during any of those periods
        together_periods = []
        for period in periods_with_both:
            s1_assignment = period.seating_assignments.filter(roster_entry__student=student1).first()
            s2_assignment = period.seating_assignments.filter(roster_entry__student=student2).first()

            if s1_assignment and s2_assignment:
                # Check if same group
                same_group = (
                    s1_assignment.group_number
                    and s2_assignment.group_number
                    and s1_assignment.group_number == s2_assignment.group_number
                )

                # Check if same table
                same_table = s1_assignment.table_number == s2_assignment.table_number

                if same_group or same_table:
                    together_periods.append(
                        {
                            "period": period,
                            "relationship": "same_group" if same_group else "same_table",
                            "group_number": s1_assignment.group_number if same_group else None,
                            "table_number": s1_assignment.table_number if same_table else None,
                            "student1_seat": s1_assignment.seat_id,
                            "student2_seat": s2_assignment.seat_id,
                        }
                    )

        return together_periods


# Enhanced Student model with index
class Student(models.Model):
    """Model for students"""

    student_id = models.CharField(max_length=20, unique=True)
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30)
    email = models.EmailField(blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    enrollment_date = models.DateField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=["is_active"]),  # Fast lookup for active students
            models.Index(fields=["student_id"]),  # Fast lookup by student ID
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.student_id})"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def active_classes(self):
        """Get all classes this student is actively enrolled in"""
        return [roster.class_assigned for roster in self.enrollments.filter(is_active=True)]


# Enhanced ClassRoster model with additional indexes
class ClassRoster(models.Model):
    """Model for managing student enrollment in classes"""

    class_assigned = models.ForeignKey(Class, on_delete=models.CASCADE, related_name="roster")
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="enrollments")

    # Enrollment tracking
    enrollment_date = models.DateField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    # Additional information
    notes = models.TextField(blank=True, help_text="Teacher notes about this student in this class")
    attendance_notes = models.TextField(blank=True, help_text="Special attendance considerations")

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [["class_assigned", "student"]]
        ordering = ["student__last_name", "student__first_name"]
        indexes = [
            models.Index(fields=["is_active"]),  # Fast lookup for active enrollments
            models.Index(fields=["class_assigned", "is_active"]),
        ]

    def __str__(self):
        return f"{self.student.get_full_name()} in {self.class_assigned.name}"

    @property
    def current_seating_assignment(self):
        """Get current seating assignment for this student"""
        current_period = self.class_assigned.current_seating_period
        if current_period:
            return self.seating_assignments.filter(seating_period=current_period).first()
        return None


class SeatingPeriod(models.Model):
    """Model to track different seating arrangements over time"""

    class_assigned = models.ForeignKey(Class, on_delete=models.CASCADE, related_name="seating_periods")

    # Layout for this specific seating period
    layout = models.ForeignKey(
        ClassroomLayout,
        on_delete=models.PROTECT,  # Prevent deletion of layouts with seating periods
        related_name="seating_periods_using_layout",
        help_text="Physical layout used for this seating period",
    )

    name = models.CharField(max_length=100, help_text="e.g., 'Week 1-2', 'September 1-15', 'Quarter 1'")
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    is_active = models.BooleanField(default=False, help_text="Only one period can be active per class")
    notes = models.TextField(blank=True, help_text="Notes about this seating arrangement")

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date"]
        unique_together = [["class_assigned", "name"]]
        indexes = [
            models.Index(fields=["is_active"]),  # Fast lookup for active periods
            models.Index(fields=["class_assigned", "is_active"]),
        ]

    def __str__(self):
        status = " (Active)" if self.is_active else ""
        return f"{self.class_assigned.name} - {self.name}{status}"

    def save(self, *args, **kwargs):
        # Ensure only one active period per class
        if self.is_active:
            # Deactivate other periods (but don't modify their end_date)
            other_periods = SeatingPeriod.objects.filter(class_assigned=self.class_assigned, is_active=True).exclude(
                id=self.id
            )

            # Only deactivate other periods, don't touch their end_date
            for period in other_periods:
                period.is_active = False
                period.save(update_fields=["is_active"])

        super().save(*args, **kwargs)

    def get_groups(self):
        """Get students organized by groups for this period"""
        groups = {}
        assignments = self.seating_assignments.filter(group_number__isnull=False)

        for assignment in assignments:
            group_num = assignment.group_number
            if group_num not in groups:
                groups[group_num] = []
            groups[group_num].append(assignment)

        return groups


class SeatingAssignment(models.Model):
    """Model for individual seating assignments within a seating period"""

    seating_period = models.ForeignKey(SeatingPeriod, on_delete=models.CASCADE, related_name="seating_assignments")
    roster_entry = models.ForeignKey(ClassRoster, on_delete=models.CASCADE, related_name="seating_assignments")

    # Physical seat assignment (using the layout system)
    seat_id = models.CharField(
        max_length=20, help_text="Seat ID from classroom layout (e.g., '1-2' for table 1, seat 2)"
    )

    # Group assignment
    group_number = models.PositiveIntegerField(blank=True, null=True, help_text="Group number (1-6 typically)")
    group_role = models.CharField(
        max_length=20,
        blank=True,
        choices=[
            ("leader", "Group Leader"),
            ("secretary", "Secretary"),
            ("presenter", "Presenter"),
            ("researcher", "Researcher"),
            ("member", "Member"),
        ],
        help_text="Student's role within the group",
    )

    # Notes specific to this seating assignment
    assignment_notes = models.TextField(blank=True, help_text="Notes specific to this seating assignment")

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [
            ["seating_period", "roster_entry"],  # One assignment per student per period
            ["seating_period", "seat_id"],  # Unique seat per period
        ]
        ordering = ["group_number", "seat_id", "roster_entry__student__last_name"]
        indexes = [
            models.Index(fields=["seat_id"]),  # Fast seat lookups
            models.Index(fields=["group_number"]),  # Fast group lookups
        ]

    def clean(self):
        """Validate that seat_id exists in the classroom layout"""
        super().clean()

        # Check if the class has a layout
        class_obj = self.seating_period.class_assigned
        if not class_obj.classroom_layout:
            raise ValidationError("Class must have a classroom layout to assign seats.")

        # Validate seat_id format
        if not self.seat_id or "-" not in self.seat_id:
            raise ValidationError("seat_id must be in format 'table_number-seat_number' (e.g., '1-2')")

        try:
            table_num, seat_num = self.seat_id.split("-")
            table_num = int(table_num)
            seat_num = int(seat_num)
        except (ValueError, IndexError):
            raise ValidationError("seat_id must be in format 'table_number-seat_number' with valid integers")

        # Check if the seat actually exists in the layout
        layout = class_obj.classroom_layout
        table = layout.tables.filter(table_number=table_num).first()
        if not table:
            raise ValidationError(f"Table {table_num} does not exist in the classroom layout")

        seat = table.seats.filter(seat_number=seat_num).first()
        if not seat:
            raise ValidationError(f"Seat {seat_num} does not exist at table {table_num}")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        group_info = f", Group {self.group_number}" if self.group_number else ""
        return (
            f"{self.roster_entry.student.get_full_name()} - {self.seating_period.name}, Seat {self.seat_id}{group_info}"
        )

    @property
    def table_number(self):
        """Extract table number from seat_id"""
        try:
            return int(self.seat_id.split("-")[0]) if "-" in self.seat_id else None
        except (ValueError, IndexError):
            return None

    @property
    def seat_number(self):
        """Extract seat number from seat_id"""
        try:
            return int(self.seat_id.split("-")[1]) if "-" in self.seat_id else None
        except (ValueError, IndexError):
            return None

    @property
    def actual_seat(self):
        """Get the actual TableSeat object for this assignment"""
        table_num = self.table_number
        seat_num = self.seat_number

        if not table_num or not seat_num:
            return None

        class_obj = self.seating_period.class_assigned
        if not class_obj.classroom_layout:
            return None

        try:
            table = class_obj.classroom_layout.tables.get(table_number=table_num)
            return table.seats.get(seat_number=seat_num)
        except (ClassroomTable.DoesNotExist, TableSeat.DoesNotExist):
            return None

    @property
    def group_members(self):
        """Get other students in the same group for this period"""
        if not self.group_number:
            return SeatingAssignment.objects.none()

        return SeatingAssignment.objects.filter(
            seating_period=self.seating_period, group_number=self.group_number
        ).exclude(id=self.id)

    @property
    def table_mates(self):
        """Get other students at the same table for this period"""
        table_num = self.table_number
        if not table_num:
            return SeatingAssignment.objects.none()

        # Get all assignments at the same table
        table_assignments = SeatingAssignment.objects.filter(
            seating_period=self.seating_period, seat_id__startswith=f"{table_num}-"
        ).exclude(id=self.id)

        return table_assignments
