# create_sample_data.py
import os
import django
from datetime import date, timedelta
import random

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_management_api.settings')
django.setup()

from students.models import User, Class, Student, ClassRoster

def create_sample_data():
    print("Creating sample data...")
    
    # Sample student names
    first_names = [
        'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason',
        'Isabella', 'William', 'Mia', 'James', 'Charlotte', 'Benjamin', 'Amelia',
        'Lucas', 'Harper', 'Henry', 'Evelyn', 'Alexander', 'Abigail', 'Michael',
        'Emily', 'Daniel', 'Elizabeth', 'Jacob', 'Sofia', 'Logan', 'Avery', 'Jackson'
    ]
    
    last_names = [
        'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
        'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
        'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
        'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark'
    ]
    
    # Create additional teachers
    teachers_data = [
        {'username': 'mwilson', 'first_name': 'Maria', 'last_name': 'Wilson', 'email': 'mwilson@carlisle.k12.ma.us'},
        {'username': 'jdavis', 'first_name': 'John', 'last_name': 'Davis', 'email': 'jdavis@carlisle.k12.ma.us'},
        {'username': 'sgarcia', 'first_name': 'Sarah', 'last_name': 'Garcia', 'email': 'sgarcia@carlisle.k12.ma.us'},
        {'username': 'rjohnson', 'first_name': 'Robert', 'last_name': 'Johnson', 'email': 'rjohnson@carlisle.k12.ma.us'},
    ]
    
    created_teachers = []
    for teacher_data in teachers_data:
        if not User.objects.filter(username=teacher_data['username']).exists():
            teacher = User.objects.create_user(
                username=teacher_data['username'],
                email=teacher_data['email'],
                first_name=teacher_data['first_name'],
                last_name=teacher_data['last_name'],
                is_teacher=True,
                password='musT8ang'  # Same password as teacher1
            )
            created_teachers.append(teacher)
            print(f"Created teacher: {teacher.get_full_name()}")
    
    # Get all teachers (including existing ones)
    all_teachers = list(User.objects.filter(is_teacher=True))
    
    # Create additional classes
    class_subjects = [
        ('Math', ['Algebra I', 'Geometry', 'Algebra II', 'Pre-Calculus']),
        ('English', ['English 7', 'English 8', 'Creative Writing', 'Literature']),
        ('History', ['World History', 'US History', 'Government', 'Geography']),
        ('Science', ['Biology', 'Chemistry', 'Physics', 'Earth Science']),
        ('Art', ['Drawing', 'Painting', 'Sculpture', 'Digital Art']),
        ('PE', ['Physical Education', 'Health', 'Sports Medicine'])
    ]
    
    created_classes = []
    for subject, class_names in class_subjects:
        for class_name in class_names:
            if not Class.objects.filter(name=class_name).exists():
                teacher = random.choice(all_teachers)
                grade = random.choice(['6', '7', '8', '9', '10', '11', '12']) if random.random() > 0.3 else None
                
                new_class = Class.objects.create(
                    name=class_name,
                    subject=subject,
                    grade_level=grade,
                    teacher=teacher,
                    description=f"{class_name} taught by {teacher.get_full_name()}"
                )
                created_classes.append(new_class)
                print(f"Created class: {new_class.name} - {new_class.teacher.get_full_name()}")
    
    # Create students
    created_students = []
    for i in range(50):  # Create 50 students
        student_id = str(1000 + i)
        if not Student.objects.filter(student_id=student_id).exists():
            first_name = random.choice(first_names)
            last_name = random.choice(last_names)
            email = f"{first_name.lower()}.{last_name.lower()}@student.carlisle.k12.ma.us"
            
            # Random enrollment date in the last 30 days
            enrollment_date = date.today() - timedelta(days=random.randint(0, 30))
            
            student = Student.objects.create(
                student_id=student_id,
                first_name=first_name,
                last_name=last_name,
                email=email,
                enrollment_date=enrollment_date,
                is_active=random.choice([True, True, True, True, False])  # 80% active
            )
            created_students.append(student)
    
    print(f"Created {len(created_students)} students")
    
    # Get all classes and students
    all_classes = list(Class.objects.all())
    all_students = list(Student.objects.filter(is_active=True))
    
    # Create class enrollments with groups and seats
    group_roles = ['leader', 'member', 'recorder', 'presenter']
    
    for class_obj in all_classes:
        # Enroll 15-25 students per class
        num_students = random.randint(15, 25)
        enrolled_students = random.sample(all_students, min(num_students, len(all_students)))
        
        for i, student in enumerate(enrolled_students):
            # Skip if already enrolled
            if ClassRoster.objects.filter(class_assigned=class_obj, student=student).exists():
                continue
            
            # Assign groups (1-6) and seats
            group_num = random.randint(1, 6) if random.random() > 0.1 else None  # 90% get groups
            seat_num = i + 1  # Sequential seat assignment
            role = random.choice(group_roles) if group_num else ''
            
            # Some students get notes
            notes_options = [
                '', '', '', '',  # Most have no notes
                'Excellent student',
                'Needs extra help',
                'Great group leader',
                'Struggles with math',
                'Very creative',
                'Good at presentations',
                'Quiet but participates'
            ]
            
            ClassRoster.objects.create(
                class_assigned=class_obj,
                student=student,
                group_number=group_num,
                seat_number=seat_num,
                group_role=role,
                notes=random.choice(notes_options),
                enrollment_date=date.today() - timedelta(days=random.randint(0, 20))
            )
    
    print(f"Created enrollments for all classes")
    
    # Print summary
    print("\n=== SAMPLE DATA SUMMARY ===")
    print(f"Total Teachers: {User.objects.filter(is_teacher=True).count()}")
    print(f"Total Classes: {Class.objects.count()}")
    print(f"Total Students: {Student.objects.count()}")
    print(f"Total Active Enrollments: {ClassRoster.objects.filter(is_active=True).count()}")
    
    print("\n=== CLASSES BY TEACHER ===")
    for teacher in User.objects.filter(is_teacher=True):
        class_count = teacher.classes_taught.count()
        print(f"{teacher.get_full_name()}: {class_count} classes")
    
    print("\n=== SAMPLE ENROLLMENTS ===")
    for class_obj in Class.objects.all()[:5]:  # Show first 5 classes
        enrollment_count = class_obj.current_enrollment
        print(f"{class_obj.name} ({class_obj.subject}): {enrollment_count} students")

if __name__ == '__main__':
    create_sample_data()