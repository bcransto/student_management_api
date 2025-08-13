#!/usr/bin/env python
"""Test the previous period logic directly."""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_project.settings')
django.setup()

from students.models import Class, SeatingPeriod, SeatingAssignment

# Get a test class
test_class = Class.objects.get(id=1)  # Blue class
print(f"Testing with class: {test_class.name} (ID: {test_class.id})")

# Get the current active period (end_date is null)
current_period = SeatingPeriod.objects.filter(
    class_assigned=test_class,
    end_date__isnull=True
).first()

print(f"\nCurrent period: {current_period.id if current_period else 'None'}")

# Get the most recent completed period (has end_date)
previous_period = SeatingPeriod.objects.filter(
    class_assigned=test_class,
    end_date__isnull=False
).order_by("-end_date").first()

if previous_period:
    print(f"\nPrevious period found:")
    print(f"  ID: {previous_period.id}")
    print(f"  Start date: {previous_period.start_date}")
    print(f"  End date: {previous_period.end_date}")
    
    # Get assignments
    assignments = SeatingAssignment.objects.filter(
        seating_period=previous_period
    ).select_related("roster_entry__student")
    
    print(f"\n  Assignments ({assignments.count()} total):")
    for assignment in assignments[:5]:
        student = assignment.roster_entry.student
        print(f"    - {student.first_name} {student.last_name} at Table {assignment.table_number}, Seat {assignment.seat_number}")
else:
    print("\nNo previous period exists")