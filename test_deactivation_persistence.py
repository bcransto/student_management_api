#!/usr/bin/env python
"""
Test that deactivated seats persist when navigating between periods with the same layout
"""

import os
import sys
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_project.settings')
django.setup()

from students.models import Class, SeatingPeriod

def check_period_layouts():
    """Check which periods share layouts"""
    
    print("Checking Period Layouts for Testing Deactivation Persistence")
    print("=" * 60)
    
    for cls in Class.objects.filter(classroom_layout__isnull=False):
        periods = SeatingPeriod.objects.filter(class_assigned=cls).order_by('-start_date')
        
        if periods.count() > 1:
            print(f"\nClass: {cls.name}")
            print(f"  Class layout ID: {cls.classroom_layout.id if cls.classroom_layout else 'None'}")
            
            layout_groups = {}
            for period in periods:
                layout_id = period.layout.id if period.layout else 'None'
                if layout_id not in layout_groups:
                    layout_groups[layout_id] = []
                layout_groups[layout_id].append(period)
            
            for layout_id, period_list in layout_groups.items():
                if len(period_list) > 1:
                    print(f"  Layout {layout_id} shared by {len(period_list)} periods:")
                    for p in period_list:
                        status = "CURRENT" if p.end_date is None else f"ended {p.end_date}"
                        print(f"    - {p.name} ({status})")
    
    print("\n" + "=" * 60)
    print("TEST SCENARIO:")
    print("1. Navigate to a class with multiple periods using the same layout")
    print("2. Deactivate some seats (Shift+click)")
    print("3. Navigate to Previous period")
    print("4. Navigate back to Next period")
    print("5. Deactivated seats should still be blocked")
    print("\nWatch console for:")
    print("  - 'Layout object changed but ID stayed X, keeping deactivated seats'")
    print("  - 'Same layout ID (X), keeping deactivated seats'")

if __name__ == "__main__":
    check_period_layouts()