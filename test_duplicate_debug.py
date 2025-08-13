#!/usr/bin/env python
"""Debug duplicate detection feature."""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_project.settings')
django.setup()

from students.models import Class, SeatingPeriod, SeatingAssignment

# Get the Blue class
blue_class = Class.objects.get(id=1)
print(f"Testing with class: {blue_class.name} (ID: {blue_class.id})")

# Check current period
current_period = SeatingPeriod.objects.filter(
    class_assigned=blue_class,
    end_date__isnull=True
).first()

print(f"\nCurrent period: {current_period.id if current_period else 'None'}")
if current_period:
    current_assignments = SeatingAssignment.objects.filter(seating_period=current_period)
    print(f"Current period has {current_assignments.count()} assignments")
    for a in current_assignments[:3]:
        print(f"  - {a.roster_entry.student.first_name} at Table {a.table_number}, Seat {a.seat_number}")

# Check previous period
previous_period = SeatingPeriod.objects.filter(
    class_assigned=blue_class,
    end_date__isnull=False
).order_by("-end_date").first()

print(f"\nPrevious period: {previous_period.id if previous_period else 'None'}")
if previous_period:
    print(f"Previous period ended: {previous_period.end_date}")
    prev_assignments = SeatingAssignment.objects.filter(seating_period=previous_period)
    print(f"Previous period has {prev_assignments.count()} assignments")
    for a in prev_assignments[:3]:
        print(f"  - {a.roster_entry.student.first_name} at Table {a.table_number}, Seat {a.seat_number}")

# Test the API endpoint logic
print("\n--- Testing API Endpoint Logic ---")
from students.views import SeatingPeriodViewSet
from rest_framework.test import APIRequestFactory
from students.models import User

# Get a teacher user
teacher = User.objects.filter(email="bcranston@carlisle.k12.ma.us").first()
if teacher:
    factory = APIRequestFactory()
    request = factory.get(f'/api/seating-periods/previous_period/?class_assigned={blue_class.id}')
    request.user = teacher
    
    viewset = SeatingPeriodViewSet()
    viewset.request = request
    response = viewset.previous_period(request)
    
    print(f"API Response status: {response.status_code}")
    if response.status_code == 200:
        data = response.data
        if data:
            print(f"API returned period {data['id']} with {len(data.get('assignments', []))} assignments")
        else:
            print("API returned null (no previous period)")