# students/admin.py - Corrected version
from django.contrib import admin
from .models import User, Class, Student, ClassRoster

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email', 'first_name', 'last_name', 'is_teacher', 'created_at']
    list_filter = ['is_teacher', 'is_staff', 'is_active']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    readonly_fields = ['created_at', 'last_login', 'date_joined']

class ClassRosterInline(admin.TabularInline):
    model = ClassRoster
    extra = 1
    fields = ['student', 'group_number', 'seat_number', 'group_role', 'is_active', 'notes']
    readonly_fields = ['enrollment_date']

@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    list_display = ['name', 'subject', 'grade_level', 'teacher', 'get_current_enrollment', 'created_at']
    list_filter = ['subject', 'grade_level', 'created_at']
    search_fields = ['name', 'subject', 'teacher__username']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [ClassRosterInline]
    
    def get_current_enrollment(self, obj):
        """Method to display current enrollment count"""
        if hasattr(obj, 'current_enrollment'):
            return obj.current_enrollment
        # Fallback if property doesn't exist yet
        return 0
    get_current_enrollment.short_description = 'Current Enrollment'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(teacher=request.user)

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ['student_id', 'first_name', 'last_name', 'email', 'is_active', 'enrollment_date']
    list_filter = ['is_active', 'enrollment_date']
    search_fields = ['student_id', 'first_name', 'last_name', 'email']
    readonly_fields = ['enrollment_date']

@admin.register(ClassRoster)
class ClassRosterAdmin(admin.ModelAdmin):
    list_display = ['student', 'class_assigned', 'group_number', 'seat_number', 'group_role', 'is_active', 'enrollment_date']
    list_filter = ['is_active', 'group_number', 'group_role', 'enrollment_date', 'class_assigned']
    search_fields = ['student__first_name', 'student__last_name', 'student__student_id', 'class_assigned__name']
    readonly_fields = ['enrollment_date', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('class_assigned', 'student', 'is_active')
        }),
        ('Classroom Organization', {
            'fields': ('group_number', 'group_role', 'seat_number')
        }),
        ('Notes', {
            'fields': ('notes', 'attendance_notes'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('enrollment_date', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(class_assigned__teacher=request.user)