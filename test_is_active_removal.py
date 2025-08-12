#!/usr/bin/env python
"""
Test script to verify is_active field removal from SeatingPeriod model.
Tests that end_date=None is used to indicate current period.
"""

import os
import sys
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_project.settings')
django.setup()

from datetime import date, timedelta
from students.models import SeatingPeriod, Class, User, ClassroomLayout

def test_seating_period_current_behavior():
    """Test that SeatingPeriod uses end_date=None for current period"""
    
    print("Testing SeatingPeriod is_active removal...")
    print("-" * 50)
    
    # Get a test class (using the first one we find)
    test_class = Class.objects.first()
    if not test_class:
        print("No classes found in database. Creating test data...")
        
        # Create test user
        test_user = User.objects.filter(is_teacher=True).first()
        if not test_user:
            print("No teacher users found. Please create a teacher user first.")
            return False
        
        # Create test layout
        test_layout = ClassroomLayout.objects.first()
        if not test_layout:
            print("No layouts found. Please create a layout first.")
            return False
        
        # Create test class
        test_class = Class.objects.create(
            name="Test Class",
            subject="Test Subject",
            teacher=test_user,
            classroom_layout=test_layout
        )
        print(f"Created test class: {test_class.name}")
    
    print(f"\nUsing class: {test_class.name}")
    
    # Check current seating period
    current_period = test_class.current_seating_period
    print(f"\nCurrent seating period: {current_period}")
    
    if current_period:
        print(f"  - Name: {current_period.name}")
        print(f"  - Start date: {current_period.start_date}")
        print(f"  - End date: {current_period.end_date}")
        print(f"  - Is current (end_date is None): {current_period.end_date is None}")
    
    # Check all periods for the class
    all_periods = SeatingPeriod.objects.filter(class_assigned=test_class).order_by('-start_date')
    print(f"\nAll periods for {test_class.name} ({all_periods.count()} total):")
    
    for period in all_periods:
        is_current = period.end_date is None
        print(f"  - {period.name}:")
        print(f"    Start: {period.start_date}, End: {period.end_date}, Current: {is_current}")
    
    # Verify only one period has end_date=None
    current_periods = all_periods.filter(end_date__isnull=True)
    print(f"\nPeriods with end_date=None: {current_periods.count()}")
    
    if current_periods.count() > 1:
        print("WARNING: Multiple periods have end_date=None!")
        for period in current_periods:
            print(f"  - {period.name} (ID: {period.id})")
        return False
    elif current_periods.count() == 0:
        print("NOTE: No current period (all periods have end dates)")
    else:
        print(f"✓ Exactly one current period: {current_periods.first().name}")
    
    # Test creating a new period
    print("\n" + "-" * 50)
    print("Testing new period creation...")
    
    if not test_class.classroom_layout:
        print("Class needs a layout to test period creation")
        return False
    
    # Create new period
    tomorrow = date.today() + timedelta(days=1)
    new_period = SeatingPeriod(
        class_assigned=test_class,
        layout=test_class.classroom_layout,
        name=f"Test Period {tomorrow}",
        start_date=tomorrow,
        end_date=None  # New current period
    )
    
    print(f"Creating new period: {new_period.name}")
    new_period.save()
    
    # Check that the previous current period was ended
    all_periods = SeatingPeriod.objects.filter(class_assigned=test_class).order_by('-start_date')
    current_count = all_periods.filter(end_date__isnull=True).count()
    
    print(f"\nAfter creating new period:")
    print(f"  - Total periods: {all_periods.count()}")
    print(f"  - Current periods (end_date=None): {current_count}")
    
    if current_count != 1:
        print(f"ERROR: Expected 1 current period, got {current_count}")
        return False
    
    # Verify the new period is current
    new_current = test_class.current_seating_period
    if new_current.id != new_period.id:
        print(f"ERROR: New period is not current!")
        return False
    
    print(f"✓ New period is current: {new_current.name}")
    
    # Check that previous period has end_date
    for period in all_periods:
        if period.id != new_period.id and period.end_date is None:
            print(f"ERROR: Period {period.name} should have end_date but doesn't!")
            return False
    
    print("✓ All previous periods have end dates")
    
    # Clean up test period
    new_period.delete()
    print(f"\nCleaned up test period")
    
    print("\n" + "=" * 50)
    print("✓ All tests passed!")
    return True

if __name__ == "__main__":
    try:
        success = test_seating_period_current_behavior()
        if not success:
            print("\n⚠ Some tests failed")
            sys.exit(1)
    except Exception as e:
        print(f"\n✗ Error during testing: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)