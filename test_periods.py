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
print(f"Blue class layout: {blue_class.classroom_layout_id}")

# Get all periods for Blue class
periods = blue_class.seating_periods.all().order_by('start_date')
print(f"\nFound {periods.count()} periods for Blue class:")
for p in periods:
    print(f"  Period {p.id}: '{p.name}' - Active: {p.is_active} - Layout: {p.layout_id if p.layout else None}")

# Check current period
current = blue_class.current_seating_period
if current:
    print(f"\nCurrent period (from property): ID {current.id} - '{current.name}'")
else:
    print("\nNo current period set")

# Test making Term 1 active
print("\nTesting period activation...")
term1 = periods.filter(name__icontains='Term 1').first()
if term1:
    print(f"Setting 'Term 1' (ID {term1.id}) as active...")
    term1.is_active = True
    term1.save()
    
    # Refresh and check
    blue_class.refresh_from_db()
    new_current = blue_class.current_seating_period
    print(f"After activation - Current period: ID {new_current.id if new_current else 'None'} - '{new_current.name if new_current else 'None'}'")