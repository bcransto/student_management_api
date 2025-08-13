#!/usr/bin/env python
"""Test chart naming for seating periods."""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_project.settings')
django.setup()

from students.models import Class, SeatingPeriod

# Get the Blue class
blue_class = Class.objects.get(id=1)
print(f"Class: {blue_class.name} (ID: {blue_class.id})")

# Get all periods for this class
periods = SeatingPeriod.objects.filter(class_assigned=blue_class).order_by("start_date")

print(f"\nExisting periods ({periods.count()} total):")
for i, period in enumerate(periods, 1):
    status = "CURRENT" if period.end_date is None else "COMPLETED"
    print(f"  {i}. {period.name} ({status})")
    print(f"     Start: {period.start_date}, End: {period.end_date}")

# Show what the next chart number would be
next_chart_number = periods.count() + 1
print(f"\nNext period would be: Chart {next_chart_number}")