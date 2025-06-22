# models.py
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError

class User(AbstractUser):
    """Custom user model for teachers"""
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30)
    is_teacher = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

class Class(models.Model):
    """Model for classes/courses"""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    subject = models.CharField(max_length=50)
    grade_level = models.CharField(max_length=20, blank=True, null=True)
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='classes_taught')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name_plural = "Classes"
    
    def __str__(self):
        return f"{self.name} - {self.teacher.get_full_name()}"
    
    @property
    def current_enrollment(self):
        return self.roster.filter(is_active=True).count()
    
    def get_group_members(self, group_number):
        """Get all students in a specific group"""
        return self.roster.filter(group_number=group_number, is_active=True)
    
    def get_all_groups(self):
        """Get students organized by groups"""
        groups = {}
        # Get all unique group numbers that exist
        group_numbers = self.roster.filter(
            is_active=True, 
            group_number__isnull=False
        ).values_list('group_number', flat=True).distinct().order_by('group_number')
        
        for group_num in group_numbers:
            groups[group_num] = list(self.get_group_members(group_num))
        return groups

class Student(models.Model):
    """Model for students"""
    student_id = models.CharField(max_length=20, unique=True)
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30)
    email = models.EmailField(blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    enrollment_date = models.DateField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.student_id})"
    
    def get_full_name(self):
        return f"{self.first_name} {self.last_name}"
    
    @property
    def active_classes(self):
        """Get all classes this student is actively enrolled in"""
        return [roster.class_assigned for roster in self.enrollments.filter(is_active=True)]

class ClassRoster(models.Model):
    """Model for managing student seating and grouping within a class"""
    class_assigned = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='roster')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='enrollments')
    
    # Seating arrangement
    seat_number = models.PositiveIntegerField(blank=True, null=True, help_text="Student's seat number")
    
    # Group assignment
    group_number = models.PositiveIntegerField(blank=True, null=True, help_text="Group number (1-6 typically)")
    group_role = models.CharField(max_length=20, blank=True, choices=[
        ('leader', 'Group Leader'),
        ('secretary', 'Secretary'), 
        ('presenter', 'Presenter'),
        ('researcher', 'Researcher'),
        ('member', 'Member'),
    ], help_text="Student's role within the group")
    
    # Enrollment tracking
    enrollment_date = models.DateField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    
    # Additional information
    notes = models.TextField(blank=True, help_text="Teacher notes about this student in this class")
    attendance_notes = models.TextField(blank=True, help_text="Special attendance considerations")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = [
            ['class_assigned', 'student'],  # One enrollment per student per class
            ['class_assigned', 'seat_number'],  # Unique seat numbers per class
        ]
        ordering = ['group_number', 'seat_number', 'student__last_name']
    
    def clean(self):
        """Custom validation for the model"""
        # No validation needed since we removed max limits
        pass
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        group_info = f", Group {self.group_number}" if self.group_number else ""
        seat_info = f", Seat {self.seat_number}" if self.seat_number else ""
        return f"{self.student.get_full_name()} in {self.class_assigned.name}{group_info}{seat_info}"
    
    @property
    def group_members(self):
        """Get other students in the same group"""
        if not self.group_number:
            return []
        return ClassRoster.objects.filter(
            class_assigned=self.class_assigned,
            group_number=self.group_number,
            is_active=True
        ).exclude(id=self.id)