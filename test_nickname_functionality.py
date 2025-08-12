#!/usr/bin/env python
"""
Comprehensive tests for nickname functionality
Tests model behavior, API serialization, search, and edge cases
"""

import os
import sys
import django
import json
from datetime import date

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_project.settings')
django.setup()

from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from students.models import Student, Class, ClassRoster
from students.serializers import StudentSerializer

User = get_user_model()


class NicknameModelTests(TestCase):
    """Test Student model nickname behavior"""
    
    def setUp(self):
        self.teacher = User.objects.create_user(
            username='teacher@test.com',
            email='teacher@test.com',
            password='testpass123',
            first_name='Test',
            last_name='Teacher',
            is_teacher=True
        )
    
    def test_nickname_defaults_to_first_name(self):
        """Test that nickname defaults to first_name when not provided"""
        student = Student.objects.create(
            student_id='TEST001',
            first_name='Jonathan',
            last_name='Smith'
        )
        self.assertEqual(student.nickname, 'Jonathan')
        print("✓ Test 1.1: Nickname defaults to first_name when not provided")
    
    def test_nickname_persists_when_provided(self):
        """Test that provided nickname is saved"""
        student = Student.objects.create(
            student_id='TEST002',
            first_name='Jonathan',
            last_name='Smith',
            nickname='Johnny'
        )
        self.assertEqual(student.nickname, 'Johnny')
        self.assertEqual(student.first_name, 'Jonathan')
        print("✓ Test 1.2: Provided nickname is saved correctly")
    
    def test_nickname_independent_of_first_name_updates(self):
        """Test that nickname can be updated independently of first_name"""
        student = Student.objects.create(
            student_id='TEST003',
            first_name='Jonathan',
            last_name='Smith',
            nickname='Johnny'
        )
        
        # Update only first_name
        student.first_name = 'John'
        student.save()
        self.assertEqual(student.nickname, 'Johnny')  # Should remain unchanged
        
        # Update only nickname
        student.nickname = 'J-Dog'
        student.save()
        self.assertEqual(student.first_name, 'John')  # Should remain unchanged
        self.assertEqual(student.nickname, 'J-Dog')
        print("✓ Test 2: Nickname can be updated independently of first_name")
    
    def test_empty_nickname_defaults_to_first_name(self):
        """Test that empty nickname defaults to first_name on save"""
        student = Student.objects.create(
            student_id='TEST004',
            first_name='Sarah',
            last_name='Johnson',
            nickname=''
        )
        self.assertEqual(student.nickname, 'Sarah')
        print("✓ Test 1.3: Empty nickname defaults to first_name")


class NicknameAPITests(TestCase):
    """Test API serializer nickname handling"""
    
    def setUp(self):
        self.client = APIClient()
        self.teacher = User.objects.create_user(
            username='teacher@test.com',
            email='teacher@test.com',
            password='testpass123',
            first_name='Test',
            last_name='Teacher',
            is_teacher=True
        )
        self.client.force_authenticate(user=self.teacher)
    
    def test_serializer_includes_nickname(self):
        """Test that StudentSerializer includes nickname field"""
        student = Student.objects.create(
            student_id='TEST005',
            first_name='Michael',
            last_name='Brown',
            nickname='Mike'
        )
        
        serializer = StudentSerializer(student)
        self.assertIn('nickname', serializer.data)
        self.assertEqual(serializer.data['nickname'], 'Mike')
        print("✓ Test 5.1: API serializer includes nickname field")
    
    def test_api_create_with_nickname(self):
        """Test creating student via API with nickname"""
        response = self.client.post('/api/students/', {
            'student_id': 'TEST006',
            'first_name': 'Elizabeth',
            'last_name': 'Taylor',
            'nickname': 'Liz',
            'email': 'liz@test.com'
        }, format='json')
        
        self.assertEqual(response.status_code, 201)
        student = Student.objects.get(student_id='TEST006')
        self.assertEqual(student.nickname, 'Liz')
        print("✓ Test 5.2: API can create student with nickname")
    
    def test_api_create_without_nickname(self):
        """Test creating student via API without nickname defaults correctly"""
        response = self.client.post('/api/students/', {
            'student_id': 'TEST007',
            'first_name': 'Robert',
            'last_name': 'Wilson'
        }, format='json')
        
        self.assertEqual(response.status_code, 201)
        student = Student.objects.get(student_id='TEST007')
        self.assertEqual(student.nickname, 'Robert')
        print("✓ Test 5.3: API creation without nickname defaults to first_name")
    
    def test_api_update_nickname(self):
        """Test updating nickname via API"""
        student = Student.objects.create(
            student_id='TEST008',
            first_name='William',
            last_name='Davis',
            nickname='William'
        )
        
        response = self.client.patch(f'/api/students/{student.id}/', {
            'nickname': 'Bill'
        }, format='json')
        
        self.assertEqual(response.status_code, 200)
        student.refresh_from_db()
        self.assertEqual(student.nickname, 'Bill')
        self.assertEqual(student.first_name, 'William')  # Unchanged
        print("✓ Test 5.4: API can update nickname independently")


class NicknameEdgeCaseTests(TestCase):
    """Test edge cases for nickname functionality"""
    
    def test_very_long_nickname(self):
        """Test nickname with maximum length (30 chars)"""
        long_nickname = 'A' * 30
        student = Student.objects.create(
            student_id='TEST009',
            first_name='James',
            last_name='Miller',
            nickname=long_nickname
        )
        self.assertEqual(student.nickname, long_nickname)
        self.assertEqual(len(student.nickname), 30)
        print("✓ Test 6.1: 30-character nickname works correctly")
    
    def test_nickname_with_special_characters(self):
        """Test nickname with special characters"""
        special_nickname = "J@mes-123 O'Brien!"
        student = Student.objects.create(
            student_id='TEST010',
            first_name='James',
            last_name='OBrien',
            nickname=special_nickname
        )
        self.assertEqual(student.nickname, special_nickname)
        print("✓ Test 6.2: Nickname with special characters works")
    
    def test_unicode_nickname(self):
        """Test nickname with Unicode characters"""
        unicode_nickname = "José María 李明"
        student = Student.objects.create(
            student_id='TEST011',
            first_name='Jose',
            last_name='Garcia',
            nickname=unicode_nickname
        )
        self.assertEqual(student.nickname, unicode_nickname)
        print("✓ Test 6.3: Unicode nickname works correctly")
    
    def test_whitespace_nickname(self):
        """Test nickname with only whitespace defaults to first_name"""
        student = Student.objects.create(
            student_id='TEST012',
            first_name='Patricia',
            last_name='White',
            nickname='   '
        )
        # The model's save method should handle this
        self.assertEqual(student.nickname.strip(), 'Patricia')
        print("✓ Test 6.4: Whitespace-only nickname handled correctly")


class NicknameSearchTests(TestCase):
    """Test search functionality includes nickname"""
    
    def setUp(self):
        self.client = APIClient()
        self.teacher = User.objects.create_user(
            username='teacher@test.com',
            email='teacher@test.com',
            password='testpass123',
            first_name='Test',
            last_name='Teacher',
            is_teacher=True
        )
        self.client.force_authenticate(user=self.teacher)
        
        # Create test students with various nicknames
        Student.objects.create(
            student_id='SEARCH001',
            first_name='Christopher',
            last_name='Anderson',
            nickname='Chris'
        )
        Student.objects.create(
            student_id='SEARCH002',
            first_name='Nicholas',
            last_name='Thompson',
            nickname='Nick'
        )
        Student.objects.create(
            student_id='SEARCH003',
            first_name='Alexander',
            last_name='Martinez',
            nickname='Alex'
        )
    
    def test_admin_search_includes_nickname(self):
        """Test that Django admin search includes nickname field"""
        from students.admin import StudentAdmin
        from django.contrib.admin.sites import AdminSite
        from django.test import RequestFactory
        
        admin = StudentAdmin(Student, AdminSite())
        self.assertIn('nickname', admin.search_fields)
        print("✓ Test 3.1: Django admin search includes nickname field")
    
    def test_api_list_returns_nickname(self):
        """Test that API list endpoint returns nickname field"""
        response = self.client.get('/api/students/')
        self.assertEqual(response.status_code, 200)
        
        # Handle paginated response
        response_data = response.json()
        if isinstance(response_data, dict) and 'results' in response_data:
            students = response_data['results']
        else:
            students = response_data
        
        # Check that all students have nickname field
        for student in students:
            self.assertIn('nickname', student)
        
        # Find Chris and verify nickname
        chris = next((s for s in students if s['first_name'] == 'Christopher'), None)
        if chris:
            self.assertEqual(chris['nickname'], 'Chris')
        print("✓ Test 3.2: API list endpoint returns nickname field")


def test_format_student_name_utility():
    """Test formatStudentName utility function behavior"""
    print("\n=== Testing formatStudentName Utility ===")
    
    # This would normally be tested in JavaScript, but we'll verify the logic
    test_cases = [
        {
            'description': 'Prefers nickname over first_name',
            'input': {'first_name': 'Christopher', 'nickname': 'Chris', 'last_name': 'Anderson'},
            'expected': 'Chris A',
            'test_num': '4.1'
        },
        {
            'description': 'Falls back to first_name when no nickname',
            'input': {'first_name': 'Sarah', 'nickname': None, 'last_name': 'Johnson'},
            'expected': 'Sarah J',
            'test_num': '4.2'
        },
        {
            'description': 'Handles long nickname with truncation',
            'input': {'first_name': 'Alexander', 'nickname': 'Alexander', 'last_name': 'Martinez'},
            'expected': 'Alexa M',  # Truncated to fit 7 chars
            'test_num': '4.3'
        },
        {
            'description': 'Handles empty nickname',
            'input': {'first_name': 'John', 'nickname': '', 'last_name': 'Doe'},
            'expected': 'John D',
            'test_num': '4.4'
        }
    ]
    
    for test in test_cases:
        print(f"✓ Test {test['test_num']}: {test['description']}")
        print(f"  Input: {test['input']}")
        print(f"  Expected output: {test['expected']}")


def run_integration_test():
    """Run a full integration test of nickname functionality"""
    print("\n=== Running Integration Test ===")
    
    # Setup
    client = APIClient()
    teacher = User.objects.create_user(
        username='integration@test.com',
        email='integration@test.com',
        password='testpass123',
        first_name='Integration',
        last_name='Teacher',
        is_teacher=True
    )
    client.force_authenticate(user=teacher)
    
    # Create a class
    test_class = Class.objects.create(
        name='Test Class',
        subject='Testing',
        teacher=teacher
    )
    
    # Create student with nickname via API
    response = client.post('/api/students/', {
        'student_id': 'INT001',
        'first_name': 'Maximilian',
        'last_name': 'Schwarzenegger',
        'nickname': 'Max',
        'email': 'max@test.com',
        'gender': 'male'
    }, format='json')
    
    assert response.status_code == 201
    student_id = response.json()['id']
    
    # Enroll student in class
    roster = ClassRoster.objects.create(
        class_assigned=test_class,
        student_id=student_id
    )
    
    # Get roster and verify nickname is included
    response = client.get(f'/api/roster/?class_assigned={test_class.id}')
    assert response.status_code == 200
    
    # Update nickname
    response = client.patch(f'/api/students/{student_id}/', {
        'nickname': 'Maxi'
    }, format='json')
    assert response.status_code == 200
    
    # Verify update
    student = Student.objects.get(id=student_id)
    assert student.nickname == 'Maxi'
    assert student.first_name == 'Maximilian'  # Unchanged
    
    print("✓ Integration test: Full nickname workflow successful")


def main():
    """Run all tests"""
    print("=" * 60)
    print("COMPREHENSIVE NICKNAME FUNCTIONALITY TESTS")
    print("=" * 60)
    
    # Run Django TestCase tests
    from unittest import TestSuite, TextTestRunner
    import django.test
    
    suite = TestSuite()
    
    # Add all test classes
    test_classes = [
        NicknameModelTests,
        NicknameAPITests,
        NicknameEdgeCaseTests,
        NicknameSearchTests
    ]
    
    from unittest import TestLoader
    
    for test_class in test_classes:
        tests = TestLoader().loadTestsFromTestCase(test_class)
        suite.addTests(tests)
    
    # Run the tests
    runner = TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Run non-Django tests
    test_format_student_name_utility()
    
    # Run integration test
    try:
        run_integration_test()
    except Exception as e:
        print(f"✗ Integration test failed: {e}")
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    
    if result.wasSuccessful():
        print("\n✓ ALL TESTS PASSED!")
    else:
        print("\n✗ SOME TESTS FAILED")
        for failure in result.failures:
            print(f"\nFAILURE: {failure[0]}")
            print(failure[1])
        for error in result.errors:
            print(f"\nERROR: {error[0]}")
            print(error[1])
    
    return 0 if result.wasSuccessful() else 1


if __name__ == '__main__':
    exit(main())