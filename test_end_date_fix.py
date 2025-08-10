#!/usr/bin/env python
import os
import sys
import django

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_project.settings')
django.setup()

from students.models import Class, SeatingPeriod

# Get Blue class
blue_class = Class.objects.get(name='Blue')
print(f"Blue class ID: {blue_class.id}")

# Get all periods for Blue class
periods = list(blue_class.seating_periods.all().order_by('start_date'))
print(f"\nBefore navigation:")
for p in periods:
    print(f"  Period {p.id}: '{p.name}' - Active: {p.is_active} - End date: {p.end_date}")

# Get the current period
current_period = blue_class.current_seating_period
if current_period:
    print(f"\nCurrent active: {current_period.name} (ID {current_period.id})")
    
    # Store original end dates
    original_end_dates = {p.id: p.end_date for p in periods}
    
    # Find the other period
    other_period = next(p for p in periods if p.id != current_period.id)
    
    print(f"\nSwitching to: {other_period.name} (ID {other_period.id})")
    other_period.is_active = True
    other_period.save()
    
    # Refresh periods
    periods = list(blue_class.seating_periods.all().order_by('start_date'))
    
    print(f"\nAfter navigation:")
    for p in periods:
        print(f"  Period {p.id}: '{p.name}' - Active: {p.is_active} - End date: {p.end_date}")
        if original_end_dates[p.id] != p.end_date:
            print(f"    WARNING: End date changed from {original_end_dates[p.id]} to {p.end_date}!")
    
    # Switch back
    print(f"\nSwitching back to: {current_period.name}")
    current_period.refresh_from_db()
    current_period.is_active = True
    current_period.save()
    
    # Final check
    periods = list(blue_class.seating_periods.all().order_by('start_date'))
    print(f"\nFinal state:")
    for p in periods:
        print(f"  Period {p.id}: '{p.name}' - Active: {p.is_active} - End date: {p.end_date}")
        if original_end_dates[p.id] != p.end_date:
            print(f"    WARNING: End date changed from {original_end_dates[p.id]} to {p.end_date}!")