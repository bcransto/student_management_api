# students/management/commands/migrate_seating_data.py
from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from students.models import (
    Class,
    ClassroomLayout,
    ClassroomTable,
    ClassRoster,
    SeatingAssignment,
    SeatingPeriod,
    Student,
    TableSeat,
    User,
)


class Command(BaseCommand):
    help = "Migrate existing seating data to new layout system"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Run migration without making changes",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN MODE - No changes will be made"))

        self.stdout.write("Starting data migration...")

        with transaction.atomic():
            # Step 1: Create default classroom layouts
            self.create_default_layouts(dry_run)

            # Step 2: Migrate existing ClassRoster data
            self.migrate_existing_seating_data(dry_run)

            # Step 3: Create current seating periods
            self.create_current_seating_periods(dry_run)

            if dry_run:
                self.stdout.write(self.style.SUCCESS("DRY RUN COMPLETED - No changes made"))
                # Rollback the transaction in dry run mode
                transaction.set_rollback(True)
            else:
                self.stdout.write(self.style.SUCCESS("Migration completed successfully!"))

    def create_default_layouts(self, dry_run):
        """Create default classroom layouts for each teacher"""
        self.stdout.write("Creating default classroom layouts...")

        teachers = User.objects.filter(is_teacher=True)

        for teacher in teachers:
            layout_name = f"{teacher.get_full_name()}'s Default Layout"

            if not dry_run:
                # Create a default 4x3 table layout (6 tables, 4 seats each)
                layout = ClassroomLayout.objects.create(
                    name=layout_name,
                    description=f"Default layout for {teacher.get_full_name()}",
                    room_width=12,
                    room_height=8,
                    created_by=teacher,
                )

                # Create 6 tables in a 2x3 grid
                table_positions = [
                    (1, 2, 2),
                    (2, 5, 2),
                    (3, 8, 2),  # Back row
                    (4, 2, 5),
                    (5, 5, 5),
                    (6, 8, 5),  # Front row
                ]

                for table_num, x_pos, y_pos in table_positions:
                    table = ClassroomTable.objects.create(
                        layout=layout,
                        table_number=table_num,
                        table_name=f"Table {table_num}",
                        x_position=x_pos,
                        y_position=y_pos,
                        width=2,
                        height=2,
                        max_seats=4,
                        table_shape="rectangular",
                    )

                    # Create 4 seats per table
                    seat_positions = [
                        (1, 0.25, 0.25),
                        (2, 0.75, 0.25),  # Top seats
                        (3, 0.25, 0.75),
                        (4, 0.75, 0.75),  # Bottom seats
                    ]

                    for seat_num, rel_x, rel_y in seat_positions:
                        TableSeat.objects.create(
                            table=table, seat_number=seat_num, relative_x=rel_x, relative_y=rel_y, is_accessible=True
                        )

                self.stdout.write(f"  Created layout: {layout_name}")
            else:
                self.stdout.write(f"  Would create layout: {layout_name}")

    def migrate_existing_seating_data(self, dry_run):
        """Create current seating periods and assignments from existing data"""
        self.stdout.write("Migrating existing ClassRoster seating data...")

        # Since we're migrating from the old structure, we need to check if the old fields exist
        # Check if ClassRoster has the old seat_number field
        from django.db import connection

        # Get table description to see what fields exist
        with connection.cursor() as cursor:
            cursor.execute("PRAGMA table_info(students_classroster)")
            columns = [row[1] for row in cursor.fetchall()]

        has_old_seating_fields = "seat_number" in columns

        if not has_old_seating_fields:
            self.stdout.write("  No old seating fields found - skipping seating data migration")
            return

        # Get all classes that have roster entries with seating data (using raw SQL to be safe)
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT DISTINCT class_assigned_id 
                FROM students_classroster 
                WHERE seat_number IS NOT NULL
            """
            )
            class_ids_with_seating = [row[0] for row in cursor.fetchall()]

        classes_with_seating = Class.objects.filter(id__in=class_ids_with_seating)

        for class_obj in classes_with_seating:
            self.stdout.write(f"  Processing class: {class_obj.name}")

            if not dry_run:
                # Assign the default layout for this teacher
                default_layout = ClassroomLayout.objects.filter(created_by=class_obj.teacher).first()

                if default_layout:
                    class_obj.classroom_layout = default_layout
                    class_obj.save()

                # Create current seating period
                period = SeatingPeriod.objects.create(
                    class_assigned=class_obj,
                    name="Current (Migrated)",
                    start_date=date.today(),
                    is_active=True,
                    notes="Migrated from existing seat assignments",
                )

                # Migrate existing seat assignments
                # Use raw SQL to get roster entries with old seating data
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id, seat_number, group_number, group_role 
                        FROM students_classroster 
                        WHERE class_assigned_id = %s AND seat_number IS NOT NULL
                    """,
                        [class_obj.id],
                    )

                    roster_data = cursor.fetchall()

                for roster_id, old_seat, group_num, group_role in roster_data:
                    try:
                        roster_entry = ClassRoster.objects.get(id=roster_id)

                        # Convert old seat number to new seat_id format
                        # Assume seats 1-4 = table 1, seats 5-8 = table 2, etc.
                        table_num = ((old_seat - 1) // 4) + 1
                        seat_in_table = ((old_seat - 1) % 4) + 1
                        seat_id = f"{table_num}-{seat_in_table}"

                        SeatingAssignment.objects.create(
                            seating_period=period,
                            roster_entry=roster_entry,
                            seat_id=seat_id,
                            group_number=group_num,
                            group_role=group_role or "",
                            assignment_notes=f"Migrated from seat {old_seat}",
                        )
                    except ClassRoster.DoesNotExist:
                        self.stdout.write(f"    Warning: ClassRoster {roster_id} not found")
                        continue

                self.stdout.write(f"    Created {len(roster_data)} seating assignments")
            else:
                # Use raw SQL to count roster entries with seating data
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT COUNT(*) 
                        FROM students_classroster 
                        WHERE class_assigned_id = %s AND seat_number IS NOT NULL
                    """,
                        [class_obj.id],
                    )
                    roster_count = cursor.fetchone()[0]

                self.stdout.write(f"    Would migrate {roster_count} seating assignments")

    def create_current_seating_periods(self, dry_run):
        """Create current seating periods for classes without existing seating data"""
        self.stdout.write("Creating current seating periods for remaining classes...")

        # Get classes without seating periods
        classes_without_periods = Class.objects.filter(seating_periods__isnull=True).distinct()

        for class_obj in classes_without_periods:
            if not dry_run:
                # Assign default layout if none exists
                if not class_obj.classroom_layout:
                    default_layout = ClassroomLayout.objects.filter(created_by=class_obj.teacher).first()

                    if default_layout:
                        class_obj.classroom_layout = default_layout
                        class_obj.save()

                # Create empty current period
                SeatingPeriod.objects.create(
                    class_assigned=class_obj,
                    name="Current",
                    start_date=date.today(),
                    is_active=True,
                    notes="Ready for new seating assignments",
                )

                self.stdout.write(f"  Created current period for: {class_obj.name}")
            else:
                self.stdout.write(f"  Would create current period for: {class_obj.name}")

    def print_migration_summary(self):
        """Print summary of what will be migrated"""
        self.stdout.write("\n=== MIGRATION SUMMARY ===")

        # Count teachers
        teacher_count = User.objects.filter(is_teacher=True).count()
        self.stdout.write(f"Teachers found: {teacher_count}")

        # Count classes with seating data
        classes_with_seating = Class.objects.filter(roster__seat_number__isnull=False).distinct().count()
        self.stdout.write(f"Classes with existing seating data: {classes_with_seating}")

        # Count total roster entries with seats
        roster_with_seats = ClassRoster.objects.filter(seat_number__isnull=False).count()
        self.stdout.write(f"Roster entries with seat assignments: {roster_with_seats}")

        # Count total classes
        total_classes = Class.objects.count()
        self.stdout.write(f"Total classes: {total_classes}")

        self.stdout.write("\nThis migration will:")
        self.stdout.write(f"1. Create {teacher_count} default classroom layouts")
        self.stdout.write(f"2. Create {total_classes} seating periods")
        self.stdout.write(f"3. Migrate {roster_with_seats} existing seat assignments")
        self.stdout.write("4. Remove seat_number and group_number fields from ClassRoster")
        self.stdout.write("\n")


# Create the management command directory structure
# Run this script to create the necessary directories:

import os


def create_management_structure():
    """Create the Django management command directory structure"""

    base_path = "students"

    # Create directories
    management_dir = os.path.join(base_path, "management")
    commands_dir = os.path.join(management_dir, "commands")

    os.makedirs(commands_dir, exist_ok=True)

    # Create __init__.py files
    with open(os.path.join(management_dir, "__init__.py"), "w") as f:
        f.write("")

    with open(os.path.join(commands_dir, "__init__.py"), "w") as f:
        f.write("")

    print(f"Created management command structure in {base_path}/")


if __name__ == "__main__":
    create_management_structure()
