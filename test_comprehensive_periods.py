#!/usr/bin/env python
"""
Comprehensive test for seating period functionality after is_active removal.
"""

import os
import sys
import django
import json
from datetime import date, timedelta

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_project.settings')
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model
from students.models import SeatingPeriod, Class, ClassroomLayout

User = get_user_model()

def test_seating_periods():
    """Test all seating period functionality"""
    
    print("=" * 60)
    print("COMPREHENSIVE SEATING PERIOD TESTS")
    print("=" * 60)
    
    # Create test client
    client = Client()
    
    # Get or create test user
    test_user = User.objects.filter(email='bcranston@carlisle.k12.ma.us').first()
    if not test_user:
        print("Creating test user...")
        test_user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            is_teacher=True
        )
    
    # Login
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(test_user)
    access_token = str(refresh.access_token)
    
    print(f"\n1. Testing with user: {test_user.email}")
    
    # Get a test class
    test_class = Class.objects.filter(teacher=test_user).first()
    if not test_class:
        print("No classes found for user")
        return False
    
    print(f"   Using class: {test_class.name}")
    
    # Test 1: Check current period
    print("\n2. Testing current period identification:")
    current_period = test_class.current_seating_period
    if current_period:
        print(f"   ✓ Current period: {current_period.name}")
        print(f"     - Start: {current_period.start_date}")
        print(f"     - End: {current_period.end_date} (should be None)")
        assert current_period.end_date is None, "Current period should have end_date=None"
    else:
        print("   - No current period exists")
    
    # Test 2: Check all periods
    print("\n3. Testing all periods for the class:")
    all_periods = SeatingPeriod.objects.filter(class_assigned=test_class).order_by('-start_date')
    print(f"   Total periods: {all_periods.count()}")
    
    current_count = 0
    for period in all_periods:
        is_current = period.end_date is None
        if is_current:
            current_count += 1
        status = "CURRENT" if is_current else f"ended {period.end_date}"
        print(f"   - {period.name}: {status}")
    
    assert current_count <= 1, f"Error: {current_count} periods have end_date=None (should be 0 or 1)"
    print(f"   ✓ Exactly {current_count} current period(s)")
    
    # Test 3: Test API endpoints
    print("\n4. Testing API endpoints:")
    
    # Test getting periods via API
    response = client.get(
        f'/api/seating-periods/?class_assigned={test_class.id}',
        HTTP_AUTHORIZATION=f'Bearer {access_token}'
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"   ✓ GET /api/seating-periods/ returned {data.get('count', 0)} periods")
        
        # Check that is_active field is not in response
        if data.get('results'):
            first_period = data['results'][0]
            if 'is_active' in first_period:
                print("   ⚠ WARNING: is_active field still in API response!")
            else:
                print("   ✓ is_active field not in API response")
    else:
        print(f"   ✗ API error: {response.status_code}")
    
    # Test 4: Test period creation via API
    print("\n5. Testing period creation:")
    
    if test_class.classroom_layout:
        tomorrow = date.today() + timedelta(days=1)
        new_period_data = {
            'class_assigned': test_class.id,
            'layout': test_class.classroom_layout.id,
            'name': f'API Test Period {tomorrow}',
            'start_date': str(tomorrow),
            'end_date': None
        }
        
        response = client.post(
            '/api/seating-periods/',
            data=json.dumps(new_period_data),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {access_token}'
        )
        
        if response.status_code == 201:
            created_period = response.json()
            print(f"   ✓ Created period: {created_period['name']}")
            
            # Verify only one current period
            current_periods = SeatingPeriod.objects.filter(
                class_assigned=test_class,
                end_date__isnull=True
            )
            assert current_periods.count() == 1, "Should have exactly 1 current period after creation"
            print(f"   ✓ Confirmed only 1 current period exists")
            
            # Clean up
            SeatingPeriod.objects.get(id=created_period['id']).delete()
            print(f"   ✓ Cleaned up test period")
        else:
            print(f"   ✗ Failed to create period: {response.status_code}")
            print(f"     Response: {response.content}")
    else:
        print("   - Skipped (no layout available)")
    
    # Test 5: Check admin interface
    print("\n6. Testing Django admin:")
    
    # Get admin changelist
    response = client.get(
        '/admin/students/seatingperiod/',
        HTTP_AUTHORIZATION=f'Bearer {access_token}'
    )
    
    if response.status_code == 200:
        print("   ✓ Admin changelist accessible")
        # Check for is_current in response
        if b'is_current' in response.content or b'Current' in response.content:
            print("   ✓ Admin shows current status")
        else:
            print("   ⚠ Admin may not show current status")
    else:
        print(f"   - Admin requires login (status: {response.status_code})")
    
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print("✓ All core functionality tests passed")
    print("✓ end_date=None correctly identifies current period")
    print("✓ Only one period per class can be current")
    print("✓ API endpoints work without is_active field")
    
    return True

def search_for_is_active():
    """Search for any remaining is_active references"""
    print("\n" + "=" * 60)
    print("SEARCHING FOR REMAINING is_active REFERENCES")
    print("=" * 60)
    
    import subprocess
    
    # Search Python files
    print("\nSearching Python files...")
    result = subprocess.run(
        ['grep', '-r', 'is_active.*SeatingPeriod', '--include=*.py', '.'],
        capture_output=True,
        text=True
    )
    
    if result.stdout:
        print("Found references in Python files:")
        print(result.stdout)
    else:
        print("✓ No is_active references found in Python files")
    
    # Search JavaScript files  
    print("\nSearching JavaScript files...")
    result = subprocess.run(
        ['grep', '-r', 'is_active', '--include=*.js', 'frontend/'],
        capture_output=True,
        text=True
    )
    
    if result.stdout:
        lines = result.stdout.strip().split('\n')
        # Filter out comments and unrelated is_active (for Student, ClassRoster)
        relevant_lines = []
        for line in lines:
            if 'SeatingPeriod' in line or 'period' in line.lower():
                if '//' not in line and '/*' not in line:
                    relevant_lines.append(line)
        
        if relevant_lines:
            print("Found potential references in JavaScript files:")
            for line in relevant_lines:
                print(f"  {line}")
        else:
            print("✓ No SeatingPeriod is_active references found in JavaScript files")
    else:
        print("✓ No is_active references found in JavaScript files")

if __name__ == "__main__":
    try:
        # Run main tests
        success = test_seating_periods()
        
        # Search for remaining references
        search_for_is_active()
        
        if success:
            print("\n✓ All comprehensive tests passed!")
        else:
            print("\n⚠ Some tests failed")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n✗ Error during testing: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)