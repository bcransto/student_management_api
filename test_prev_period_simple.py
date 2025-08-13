#!/usr/bin/env python
"""Test the previous period endpoint using Django's test client."""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_project.settings')
django.setup()

from students.models import User, Class, SeatingPeriod, SeatingAssignment
from django.test import Client
from datetime import datetime, timedelta

# Create test client
client = Client()

# Get or create test user
user = User.objects.filter(email="bcranston@carlisle.k12.ma.us").first()
if not user:
    print("Test user not found")
    sys.exit(1)

# Force login
client.force_login(user)

# Get a class with seating periods
classes = Class.objects.filter(teacher=user)
if not classes:
    print("No classes found for test user")
    sys.exit(1)

test_class = classes.first()
print(f"Testing with class: {test_class.name} (ID: {test_class.id})")

# Check what periods exist
periods = SeatingPeriod.objects.filter(class_assigned=test_class).order_by("-start_date")
print(f"\nExisting periods for this class:")
for p in periods:
    status = "CURRENT" if p.end_date is None else "COMPLETED"
    print(f"  Period {p.id}: {p.start_date} to {p.end_date} ({status})")
    assignments = SeatingAssignment.objects.filter(seating_period=p).count()
    print(f"    - {assignments} assignments")

# Test the endpoint
print(f"\nTesting /api/seating-periods/previous_period/ endpoint...")
response = client.get(
    "/api/seating-periods/previous_period/",
    {"class_assigned": test_class.id}
)

print(f"Response status: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    if data:
        print(f"\nPrevious period found:")
        print(f"  ID: {data['id']}")
        print(f"  Start date: {data['start_date']}")
        print(f"  End date: {data['end_date']}")
        
        if "assignments" in data:
            print(f"\n  Assignments ({len(data['assignments'])} total):")
            for assignment in data['assignments'][:5]:
                print(f"    - {assignment['student_name']} at Table {assignment['table_number']}, Seat {assignment['seat_number']}")
    else:
        print("\nNo previous period exists (Response: null)")
else:
    print(f"Error response: {response.content}")