#!/usr/bin/env python
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_project.settings')
django.setup()

from students.models import SeatingPeriod

# Clear end date on Current period to test
current = SeatingPeriod.objects.get(id=1)
print(f"Period '{current.name}' - Before: end_date = {current.end_date}")
current.end_date = None
current.save()
print(f"Period '{current.name}' - After clearing: end_date = {current.end_date}")

# Now test switching
term1 = SeatingPeriod.objects.get(id=12)
term1.is_active = True
term1.save()

current.refresh_from_db()
print(f"After switching to Term 1: '{current.name}' end_date = {current.end_date}")

# Switch back
current.is_active = True
current.save()
current.refresh_from_db()
print(f"After switching back: '{current.name}' end_date = {current.end_date}")