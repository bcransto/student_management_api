#!/usr/bin/env python
"""
Test seating navigation functionality
"""

import os
import sys
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_project.settings')
django.setup()

from students.models import Class, SeatingPeriod

def test_seating_navigation():
    """Test that all classes can be navigated to in seating view"""
    
    print("Testing Seating Navigation")
    print("=" * 50)
    
    for cls in Class.objects.all():
        print(f"\nClass: {cls.name}")
        print(f"  Has layout: {bool(cls.classroom_layout)}")
        
        # Get current period
        current = cls.current_seating_period
        if current:
            print(f"  Current period: {current.name}")
            print(f"    - Assignments: {current.seating_assignments.count()}")
        else:
            print(f"  No current period")
        
        # Get all periods
        all_periods = SeatingPeriod.objects.filter(
            class_assigned=cls
        ).order_by('-start_date')
        
        if all_periods.exists():
            print(f"  Total periods: {all_periods.count()}")
            most_recent = all_periods.first()
            print(f"  Most recent: {most_recent.name}")
            print(f"    - End date: {most_recent.end_date or 'None (current)'}")
            print(f"    - Assignments: {most_recent.seating_assignments.count()}")
        else:
            print(f"  No periods at all")
        
        # Navigation logic check
        if cls.classroom_layout:
            print(f"  ✓ Can navigate to seating view")
            if current or all_periods.exists():
                print(f"    Will show: {(current or most_recent).name}")
            else:
                print(f"    Will show: Empty view with option to create period")
        else:
            print(f"  ✗ Cannot navigate (no layout)")
    
    print("\n" + "=" * 50)
    print("Summary:")
    
    classes_with_layout = Class.objects.filter(classroom_layout__isnull=False).count()
    classes_with_current = sum(1 for c in Class.objects.all() if c.current_seating_period)
    total_classes = Class.objects.count()
    
    print(f"  Total classes: {total_classes}")
    print(f"  With layouts: {classes_with_layout}")
    print(f"  With current period: {classes_with_current}")
    print(f"  Navigable: {classes_with_layout}")

if __name__ == "__main__":
    test_seating_navigation()