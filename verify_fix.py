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
print(f"Blue class has layout: {blue_class.classroom_layout_id is not None}")

# Get all periods for Blue class
periods = list(blue_class.seating_periods.all().order_by('start_date'))
print(f"\nFound {len(periods)} periods for Blue class:")
for p in periods:
    print(f"  Period {p.id}: '{p.name}' - Active: {p.is_active} - Layout: {p.layout_id}")

# Test navigation logic
current_period = blue_class.current_seating_period
if current_period:
    print(f"\nCurrent active period: {current_period.name} (ID {current_period.id})")
    
    # Find index
    current_index = next(i for i, p in enumerate(periods) if p.id == current_period.id)
    print(f"Current index: {current_index}")
    
    # Previous
    prev_index = current_index - 1 if current_index > 0 else len(periods) - 1
    prev_period = periods[prev_index]
    print(f"Previous would be: {prev_period.name} (ID {prev_period.id})")
    
    # Next  
    next_index = current_index + 1 if current_index < len(periods) - 1 else 0
    next_period = periods[next_index]
    print(f"Next would be: {next_period.name} (ID {next_period.id})")
    
    # Test activating previous
    print(f"\nActivating previous period...")
    prev_period.is_active = True
    prev_period.save()
    
    # Refresh and check
    blue_class.refresh_from_db()
    new_current = blue_class.current_seating_period
    print(f"New active period: {new_current.name if new_current else 'None'}")
    
    # Restore original
    print(f"\nRestoring original period...")
    current_period.is_active = True
    current_period.save()
    
    blue_class.refresh_from_db()
    restored = blue_class.current_seating_period
    print(f"Restored active period: {restored.name if restored else 'None'}")