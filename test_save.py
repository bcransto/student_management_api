#!/usr/bin/env python
"""Test seating assignment creation through API"""

import json
import sys
import os

# Add the project to path
sys.path.insert(0, '/Users/bcransto/Documents/student_management_api')

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_management_api.settings')
import django
django.setup()

from students.models import SeatingAssignment, SeatingPeriod, ClassRoster

# Test data from the error
seating_period_id = 14
roster_entry_id = 8
seat_id = '3-2'

print("=" * 60)
print("Testing SeatingAssignment creation")
print("=" * 60)

try:
    # Get the objects
    period = SeatingPeriod.objects.get(id=seating_period_id)
    roster_entry = ClassRoster.objects.get(id=roster_entry_id)
    
    print(f"Period: {period}")
    print(f"Period Layout: {period.layout}")
    print(f"Roster Entry: {roster_entry}")
    print(f"Seat ID: {seat_id}")
    print("-" * 60)
    
    # Check if seat exists in layout
    table_num, seat_num = seat_id.split('-')
    table = period.layout.tables.filter(table_number=int(table_num)).first()
    if table:
        print(f"Table {table_num} found: {table}")
        seat = table.seats.filter(seat_number=int(seat_num)).first()
        if seat:
            print(f"Seat {seat_num} found: {seat}")
        else:
            print(f"Seat {seat_num} NOT FOUND at table {table_num}")
    else:
        print(f"Table {table_num} NOT FOUND in layout")
    
    print("-" * 60)
    
    # Try to create the assignment
    assignment = SeatingAssignment(
        seating_period=period,
        roster_entry=roster_entry,
        seat_id=seat_id
    )
    
    # Validate
    print("Running full_clean()...")
    assignment.full_clean()
    print("Validation passed!")
    
    print("Saving...")
    assignment.save()
    
    print("SUCCESS: Assignment created!")
    print(f"Created assignment: {assignment}")
    
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()