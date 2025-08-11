#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_management_api.settings')
django.setup()

from students.models import SeatingAssignment, SeatingPeriod, ClassRoster

# Test data from the error
seating_period_id = 14
roster_entry_id = 8
seat_id = '3-2'

try:
    # Get the objects
    period = SeatingPeriod.objects.get(id=seating_period_id)
    roster_entry = ClassRoster.objects.get(id=roster_entry_id)
    
    print(f"Period: {period}")
    print(f"Period Layout: {period.layout}")
    print(f"Roster Entry: {roster_entry}")
    print(f"Seat ID: {seat_id}")
    
    # Try to create the assignment
    assignment = SeatingAssignment(
        seating_period=period,
        roster_entry=roster_entry,
        seat_id=seat_id
    )
    
    # Validate
    assignment.full_clean()
    assignment.save()
    
    print("SUCCESS: Assignment created!")
    
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()