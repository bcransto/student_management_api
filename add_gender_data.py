#!/usr/bin/env python
import os
import sys
import django
import random

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_project.settings')
django.setup()

from students.models import Student

# Common male and female names (for basic inference)
female_names = ['Ava', 'Emma', 'Olivia', 'Sophia', 'Isabella', 'Mia', 'Charlotte', 'Amelia', 'Harper', 'Evelyn', 'Lily', 'Sofia']
male_names = ['Johnny', 'Mason', 'Noah', 'Liam', 'William', 'James', 'Oliver', 'Benjamin', 'Elijah', 'Lucas', 'Michael', 'Ethan']

# Get all students
students = Student.objects.all()

# Update gender based on first name
for student in students:
    if student.first_name in female_names:
        student.gender = 'female'
    elif student.first_name in male_names:
        student.gender = 'male'
    else:
        # Random assignment for unknown names
        student.gender = random.choice(['male', 'female'])
    student.save()
    print(f"Updated {student.first_name} {student.last_name}: {student.gender}")

print(f"\nUpdated {students.count()} students with gender data")

# Show distribution
male_count = Student.objects.filter(gender='male').count()
female_count = Student.objects.filter(gender='female').count()
print(f"Males: {male_count}, Females: {female_count}")