#!/usr/bin/env python
"""
Test that period navigation doesn't modify database state
"""

import os
import sys
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_project.settings')
django.setup()

from students.models import Class, SeatingPeriod
from datetime import datetime

def test_period_navigation():
    """Test that period navigation is read-only"""
    
    print("Testing Period Navigation (Should be READ-ONLY)")
    print("=" * 60)
    
    # Get all classes with layouts
    classes = Class.objects.filter(classroom_layout__isnull=False)
    
    for cls in classes:
        periods = SeatingPeriod.objects.filter(class_assigned=cls).order_by('-start_date')
        
        if periods.count() > 1:
            print(f"\nClass: {cls.name}")
            print(f"  Number of periods: {periods.count()}")
            
            # Check which period is truly active (end_date=None)
            active_periods = [p for p in periods if p.end_date is None]
            
            if len(active_periods) == 0:
                print(f"  ⚠️  WARNING: No active period (all have end_dates)")
            elif len(active_periods) == 1:
                print(f"  ✅ Active period: {active_periods[0].name}")
                print(f"     Start: {active_periods[0].start_date}")
                print(f"     End: None (current)")
            else:
                print(f"  ❌ ERROR: Multiple active periods!")
                for p in active_periods:
                    print(f"     - {p.name} (start: {p.start_date})")
            
            # Show all periods with their status
            print(f"  All periods:")
            for p in periods:
                status = "ACTIVE" if p.end_date is None else f"ended {p.end_date}"
                print(f"    - {p.name}: {status}")
    
    print("\n" + "=" * 60)
    print("IMPORTANT BEHAVIOR:")
    print("1. Previous/Next buttons should ONLY change the VIEW")
    print("2. They should NEVER modify end_date in the database")
    print("3. Only 'New Period' button should modify end_dates")
    print("4. Deactivated seats only show for the TRUE current period")
    print("\nTest in browser:")
    print("1. Navigate to a class with multiple periods")
    print("2. Click Previous/Next buttons")
    print("3. Check this script again - end_dates should NOT change")
    print("4. Only the period with end_date=None is truly 'active'")

if __name__ == "__main__":
    test_period_navigation()