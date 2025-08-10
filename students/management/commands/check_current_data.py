# students/management/commands/check_current_data.py
from django.core.management.base import BaseCommand

from students.models import Class, ClassRoster, Student, User


class Command(BaseCommand):
    help = "Check current data before migration"

    def handle(self, *args, **options):
        from django.db import connection

        self.stdout.write(self.style.SUCCESS("=== PRE-MIGRATION DATA CHECK ===\n"))

        # Check if old seating fields exist
        with connection.cursor() as cursor:
            cursor.execute("PRAGMA table_info(students_classroster)")
            columns = [row[1] for row in cursor.fetchall()]

        has_old_fields = "seat_number" in columns

        if not has_old_fields:
            self.stdout.write(self.style.WARNING("Old seating fields not found - migration may have already been run"))
            self.stdout.write("Current model structure detected\n")

        # Check Users/Teachers
        teachers = User.objects.filter(is_teacher=True)
        self.stdout.write(f"📋 Teachers: {teachers.count()}")
        for teacher in teachers:
            class_count = teacher.classes_taught.count()
            self.stdout.write(f"   • {teacher.get_full_name()} ({teacher.email}) - {class_count} classes")

        self.stdout.write()

        # Check Classes
        classes = Class.objects.all()
        self.stdout.write(f"🏫 Classes: {classes.count()}")
        for class_obj in classes:
            enrollment = class_obj.current_enrollment
            self.stdout.write(f"   • {class_obj.name} ({class_obj.subject}) - {enrollment} students")

        self.stdout.write()

        # Check Students
        students = Student.objects.filter(is_active=True)
        self.stdout.write(f"👥 Active Students: {students.count()}")

        # Check seating data (using raw SQL if old fields exist)
        if has_old_fields:
            with connection.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) FROM students_classroster WHERE is_active = 1")
                total_roster = cursor.fetchone()[0]

                cursor.execute("SELECT COUNT(*) FROM students_classroster WHERE seat_number IS NOT NULL")
                roster_with_seats = cursor.fetchone()[0]

                cursor.execute("SELECT COUNT(*) FROM students_classroster WHERE group_number IS NOT NULL")
                roster_with_groups = cursor.fetchone()[0]
        else:
            total_roster = ClassRoster.objects.filter(is_active=True).count()
            roster_with_seats = 0  # No old seat data
            roster_with_groups = 0  # No old group data

        self.stdout.write(f"📍 Seating Data:")
        self.stdout.write(f"   • Total active enrollments: {total_roster}")
        self.stdout.write(f"   • Enrollments with seat assignments: {roster_with_seats}")
        self.stdout.write(f"   • Enrollments with group assignments: {roster_with_groups}")

        if has_old_fields:
            # Show detailed seating breakdown by class (old structure)
            self.stdout.write(f"\n📊 Detailed Seating by Class (Old Structure):")

            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT c.id, c.name, 
                           COUNT(CASE WHEN cr.seat_number IS NOT NULL THEN 1 END) as seats,
                           COUNT(CASE WHEN cr.group_number IS NOT NULL THEN 1 END) as groups,
                           MIN(cr.seat_number) as min_seat,
                           MAX(cr.seat_number) as max_seat
                    FROM students_class c
                    LEFT JOIN students_classroster cr ON c.id = cr.class_assigned_id AND cr.is_active = 1
                    GROUP BY c.id, c.name
                    HAVING seats > 0 OR groups > 0
                """
                )

                for class_id, class_name, seats, groups, min_seat, max_seat in cursor.fetchall():
                    self.stdout.write(f"   • {class_name}:")
                    self.stdout.write(f"     - Students with seats: {seats}")
                    self.stdout.write(f"     - Students in groups: {groups}")
                    if min_seat and max_seat:
                        self.stdout.write(f"     - Seat range: {min_seat}-{max_seat}")
        else:
            # Show current structure
            self.stdout.write(f"\n📊 Current Structure:")

            # Check if new models exist
            try:
                from .models import SeatingAssignment, SeatingPeriod

                periods = SeatingPeriod.objects.count()
                assignments = SeatingAssignment.objects.count()
                layouts = ClassroomLayout.objects.count() if "ClassroomLayout" in globals() else 0

                self.stdout.write(f"   • Seating Periods: {periods}")
                self.stdout.write(f"   • Seating Assignments: {assignments}")
                self.stdout.write(f"   • Classroom Layouts: {layouts}")
            except:
                self.stdout.write(f"   • New seating models not yet created")

        # Check for potential issues
        self.stdout.write(f"\n⚠️  Potential Issues:")

        if has_old_fields:
            # Check for duplicate seats within classes (old structure)
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT c.name, cr.seat_number, COUNT(*) 
                    FROM students_class c
                    JOIN students_classroster cr ON c.id = cr.class_assigned_id 
                    WHERE cr.seat_number IS NOT NULL AND cr.is_active = 1
                    GROUP BY c.id, cr.seat_number 
                    HAVING COUNT(*) > 1
                """
                )
                duplicates = cursor.fetchall()

            if duplicates:
                self.stdout.write(f"   • Found duplicate seat assignments:")
                for class_name, seat_num, count in duplicates:
                    self.stdout.write(f"     - {class_name}: seat {seat_num} assigned to {count} students")
            else:
                self.stdout.write(f"   • No duplicate seat numbers found ✓")

            # Check seat number ranges
            with connection.cursor() as cursor:
                cursor.execute("SELECT MAX(seat_number) FROM students_classroster WHERE seat_number IS NOT NULL")
                max_seat_result = cursor.fetchone()
                max_seat = max_seat_result[0] if max_seat_result[0] else 0

            if max_seat:
                self.stdout.write(f"   • Highest seat number: {max_seat}")
                # Estimate tables needed (assuming 4 seats per table)
                tables_needed = (max_seat + 3) // 4
                self.stdout.write(f"   • Tables needed for migration: {tables_needed}")
        else:
            self.stdout.write(f"   • Migration appears to have been completed already")

        # Check for students in multiple classes
        students_multi_class = (
            Student.objects.filter(enrollments__is_active=True)
            .annotate(class_count=Count("enrollments"))
            .filter(class_count__gt=1)
            .count()
        )

        self.stdout.write(f"   • Students in multiple classes: {students_multi_class}")

        self.stdout.write(f"\n✅ Data check complete!")
        if has_old_fields:
            self.stdout.write(f"Your data is ready for migration to the new layout system.")
        else:
            self.stdout.write(f"Your data appears to already be using the new layout system.")


# Add this import at the top if it's not there
from django.db.models import Count, Max
