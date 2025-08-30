#!/usr/bin/env python
"""Setup test data for visual attendance with birthdays and consecutive absences"""

import os
import sys
import django
from datetime import date, timedelta

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_project.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from students.models import User, Class, Student, ClassRoster, AttendanceRecord

def setup_test_data():
    """Create test data for visual attendance features"""
    
    print("Setting up test data for visual attendance...")
    
    # Get or create a test teacher
    teacher = User.objects.filter(email='test@example.com').first()
    if not teacher:
        print("Creating test teacher...")
        teacher = User.objects.create_user(
            username='testteacher',
            email='test@example.com',
            password='testpass123',
            first_name='Test',
            last_name='Teacher'
        )
    
    # Get or create a test class
    test_class = Class.objects.filter(teacher=teacher, name='Test Visual Attendance').first()
    if not test_class:
        print("Creating test class...")
        test_class = Class.objects.create(
            name='Test Visual Attendance',
            subject='Testing',
            grade_level='5',
            teacher=teacher
        )
    
    today = date.today()
    
    # Create students with different scenarios
    students_data = [
        {
            'id': 'VA001',
            'first_name': 'Birthday',
            'last_name': 'Today',
            'nickname': 'Birthy',
            'dob': date(2010, today.month, today.day),  # Birthday today!
            'absences': 0  # Present today
        },
        {
            'id': 'VA002',
            'first_name': 'Three',
            'last_name': 'Absences',
            'nickname': 'Triple',
            'dob': date(2010, 3, 15),
            'absences': 3  # Absent last 3 days including today
        },
        {
            'id': 'VA003',
            'first_name': 'Five',
            'last_name': 'Absences',
            'nickname': 'Fiver',
            'dob': date(2010, 6, 20),
            'absences': 5  # Absent last 5 days
        },
        {
            'id': 'VA004',
            'first_name': 'Birthday',
            'last_name': 'Absent',
            'nickname': 'BdayAbs',
            'dob': date(2010, today.month, today.day),  # Birthday today AND absent!
            'absences': 2  # Absent last 2 days
        },
        {
            'id': 'VA005',
            'first_name': 'Ten',
            'last_name': 'Absences',
            'nickname': 'Tenner',
            'dob': date(2010, 8, 10),
            'absences': 10  # Absent last 10 days
        },
        {
            'id': 'VA006',
            'first_name': 'Eleven',
            'last_name': 'Plus',
            'nickname': 'Max',
            'dob': date(2010, 9, 5),
            'absences': 12  # Absent more than 11 days (should show >10)
        },
        {
            'id': 'VA007',
            'first_name': 'Always',
            'last_name': 'Present',
            'nickname': 'Perfect',
            'dob': date(2010, 11, 30),
            'absences': 0  # Never absent
        }
    ]
    
    for student_data in students_data:
        # Create or update student
        student, created = Student.objects.update_or_create(
            student_id=student_data['id'],
            defaults={
                'first_name': student_data['first_name'],
                'last_name': student_data['last_name'],
                'nickname': student_data['nickname'],
                'date_of_birth': student_data['dob'],
                'email': f"{student_data['id'].lower()}@test.com"
            }
        )
        
        if created:
            print(f"Created student: {student.nickname}")
        
        # Add to class roster
        roster, _ = ClassRoster.objects.get_or_create(
            class_assigned=test_class,
            student=student
        )
        
        # Create attendance history
        absences = student_data['absences']
        
        # Clear existing attendance for this student
        AttendanceRecord.objects.filter(class_roster=roster).delete()
        
        # Create attendance records for last 15 days
        for days_ago in range(15):
            record_date = today - timedelta(days=days_ago)
            
            # Determine status based on absence pattern
            if days_ago < absences:
                # Absent for the specified number of recent days
                status = 'absent'
            else:
                # Present before that
                status = 'present'
            
            # Don't create today's record for "Always Present" - let them be marked present in UI
            if days_ago == 0 and student_data['nickname'] == 'Perfect':
                continue
                
            AttendanceRecord.objects.create(
                class_roster=roster,
                date=record_date,
                status=status,
                notes=f"Test data - {status}"
            )
    
    print(f"\n✅ Test data setup complete!")
    print(f"Class ID: {test_class.id}")
    print(f"Teacher email: {teacher.email}")
    print(f"Password: testpass123")
    print(f"\nStudents created:")
    print("- Birthday Today (present)")
    print("- Three Absences (3 consecutive)")
    print("- Five Absences (5 consecutive)")
    print("- Birthday Absent (birthday + 2 absences)")
    print("- Ten Absences (10 consecutive)")
    print("- Eleven Plus (>10 consecutive)")
    print("- Always Present (perfect attendance)")
    print(f"\nVisit: http://127.0.0.1:8000/#attendance/visual/{test_class.id}")

if __name__ == '__main__':
    setup_test_data()