# students/admin.py - Updated for new model structure
from django.contrib import admin
from .models import (
    User, Class, Student, ClassRoster, ClassroomLayout, 
    ClassroomTable, TableSeat, LayoutObstacle, 
    SeatingPeriod, SeatingAssignment
)

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email', 'first_name', 'last_name', 'is_teacher', 'created_at']
    list_filter = ['is_teacher', 'is_staff', 'is_active']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    readonly_fields = ['created_at', 'last_login', 'date_joined']

# Layout Admin
class TableSeatInline(admin.TabularInline):
    model = TableSeat
    extra = 1
    fields = ['seat_number', 'relative_x', 'relative_y', 'is_accessible', 'notes']

class ClassroomTableInline(admin.TabularInline):
    model = ClassroomTable
    extra = 1
    fields = ['table_number', 'table_name', 'x_position', 'y_position', 'width', 'height', 'max_seats', 'table_shape']
    readonly_fields = ['created_at']

class LayoutObstacleInline(admin.TabularInline):
    model = LayoutObstacle
    extra = 1
    fields = ['name', 'obstacle_type', 'x_position', 'y_position', 'width', 'height', 'color']

@admin.register(ClassroomLayout)
class ClassroomLayoutAdmin(admin.ModelAdmin):
    list_display = ['name', 'room_width', 'room_height', 'created_by', 'is_template', 'total_tables', 'total_seats']
    list_filter = ['is_template', 'created_by', 'created_at']
    search_fields = ['name', 'description', 'created_by__username']
    readonly_fields = ['created_at', 'updated_at', 'total_tables', 'total_seats']
    inlines = [ClassroomTableInline, LayoutObstacleInline]
    
    def save_model(self, request, obj, form, change):
        if not change:  # If creating new layout
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

@admin.register(ClassroomTable)
class ClassroomTableAdmin(admin.ModelAdmin):
    list_display = ['layout', 'table_number', 'table_name', 'x_position', 'y_position', 'max_seats', 'table_shape']
    list_filter = ['layout', 'table_shape']
    search_fields = ['table_name', 'layout__name']
    inlines = [TableSeatInline]

@admin.register(TableSeat)
class TableSeatAdmin(admin.ModelAdmin):
    list_display = ['table', 'seat_number', 'absolute_seat_id', 'relative_x', 'relative_y', 'is_accessible']
    list_filter = ['is_accessible', 'table__layout']
    search_fields = ['table__table_name', 'table__layout__name']

@admin.register(LayoutObstacle)
class LayoutObstacleAdmin(admin.ModelAdmin):
    list_display = ['layout', 'name', 'obstacle_type', 'x_position', 'y_position', 'width', 'height']
    list_filter = ['obstacle_type', 'layout']
    search_fields = ['name', 'layout__name']

# Seating Admin
class SeatingAssignmentInline(admin.TabularInline):
    model = SeatingAssignment
    extra = 1
    fields = ['roster_entry', 'seat_id', 'group_number', 'group_role', 'assignment_notes']
    readonly_fields = ['created_at']
    autocomplete_fields = ['roster_entry']

@admin.register(SeatingPeriod)
class SeatingPeriodAdmin(admin.ModelAdmin):
    list_display = ['class_assigned', 'name', 'layout', 'start_date', 'end_date', 'is_active', 'assignment_count']
    list_filter = ['is_active', 'start_date', 'class_assigned__teacher', 'layout']
    search_fields = ['name', 'class_assigned__name', 'class_assigned__teacher__username', 'layout__name']
    readonly_fields = ['created_at', 'updated_at', 'assignment_count']
    autocomplete_fields = ['class_assigned', 'layout']  # Add autocomplete for easier selection
    inlines = [SeatingAssignmentInline]
    date_hierarchy = 'start_date'
    
    fieldsets = (
        ('Period Information', {
            'fields': ('name', 'class_assigned', 'layout')
        }),
        ('Dates', {
            'fields': ('start_date', 'end_date', 'is_active')
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ('Statistics', {
            'fields': ('assignment_count', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def assignment_count(self, obj):
        """Display number of seating assignments in this period"""
        return obj.seating_assignments.count()
    assignment_count.short_description = 'Assignments'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(class_assigned__teacher=request.user)

@admin.register(SeatingAssignment)
class SeatingAssignmentAdmin(admin.ModelAdmin):
    list_display = ['student_name', 'class_name', 'period_name', 'seat_id', 'group_number', 'group_role', 'created_at']
    list_filter = ['group_number', 'group_role', 'seating_period__is_active', 'seating_period__class_assigned__teacher']
    search_fields = ['roster_entry__student__first_name', 'roster_entry__student__last_name', 
                     'roster_entry__student__student_id', 'seating_period__name', 'seat_id']
    readonly_fields = ['created_at', 'updated_at']
    autocomplete_fields = ['roster_entry', 'seating_period']
    
    fieldsets = (
        ('Assignment Details', {
            'fields': ('seating_period', 'roster_entry', 'seat_id')
        }),
        ('Group Information', {
            'fields': ('group_number', 'group_role'),
            'classes': ('collapse',)
        }),
        ('Notes', {
            'fields': ('assignment_notes',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def student_name(self, obj):
        return obj.roster_entry.student.get_full_name()
    student_name.short_description = 'Student'
    student_name.admin_order_field = 'roster_entry__student__last_name'
    
    def class_name(self, obj):
        return obj.seating_period.class_assigned.name
    class_name.short_description = 'Class'
    class_name.admin_order_field = 'seating_period__class_assigned__name'
    
    def period_name(self, obj):
        return obj.seating_period.name
    period_name.short_description = 'Period'
    period_name.admin_order_field = 'seating_period__name'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(seating_period__class_assigned__teacher=request.user)

# Updated Class Admin
class ClassRosterInline(admin.TabularInline):
    model = ClassRoster
    extra = 1
    fields = ['student', 'is_active', 'notes']
    readonly_fields = ['enrollment_date', 'current_seat_info']
    autocomplete_fields = ['student']
    
    def current_seat_info(self, obj):
        """Show current seating assignment info"""
        assignment = obj.current_seating_assignment
        if assignment:
            return f"Seat {assignment.seat_id}, Group {assignment.group_number or 'None'}"
        return "No current assignment"
    current_seat_info.short_description = 'Current Seating'

class SeatingPeriodInline(admin.TabularInline):
    model = SeatingPeriod
    extra = 0
    fields = ['name', 'layout', 'start_date', 'end_date', 'is_active']
    readonly_fields = ['created_at']
    autocomplete_fields = ['layout']

@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    list_display = ['name', 'subject', 'grade_level', 'teacher', 'get_current_enrollment', 'classroom_layout', 'current_seating_period']
    list_filter = ['subject', 'grade_level', 'created_at', 'teacher']
    search_fields = ['name', 'subject', 'teacher__username']
    readonly_fields = ['created_at', 'updated_at', 'get_current_enrollment']
    inlines = [ClassRosterInline, SeatingPeriodInline]
    autocomplete_fields = ['classroom_layout']
    
    def get_current_enrollment(self, obj):
        """Method to display current enrollment count"""
        return obj.current_enrollment
    get_current_enrollment.short_description = 'Current Enrollment'
    
    def current_seating_period(self, obj):
        """Display current active seating period"""
        period = obj.current_seating_period
        return period.name if period else "No active period"
    current_seating_period.short_description = 'Active Period'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(teacher=request.user)

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ['student_id', 'first_name', 'last_name', 'email', 'is_active', 'enrollment_date', 'class_count']
    list_filter = ['is_active', 'enrollment_date']
    search_fields = ['student_id', 'first_name', 'last_name', 'email']
    readonly_fields = ['enrollment_date', 'class_count']
    
    def class_count(self, obj):
        """Display number of active classes"""
        return len(obj.active_classes)
    class_count.short_description = 'Active Classes'

@admin.register(ClassRoster)
class ClassRosterAdmin(admin.ModelAdmin):
    list_display = ['student_name', 'class_assigned', 'is_active', 'enrollment_date', 'current_seating_info']
    list_filter = ['is_active', 'enrollment_date', 'class_assigned']
    search_fields = ['student__first_name', 'student__last_name', 'student__student_id', 'class_assigned__name']
    readonly_fields = ['enrollment_date', 'created_at', 'updated_at', 'current_seating_info']
    autocomplete_fields = ['student', 'class_assigned']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('class_assigned', 'student', 'is_active')
        }),
        ('Notes', {
            'fields': ('notes', 'attendance_notes'),
            'classes': ('collapse',)
        }),
        ('Current Seating', {
            'fields': ('current_seating_info',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('enrollment_date', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def student_name(self, obj):
        return obj.student.get_full_name()
    student_name.short_description = 'Student'
    student_name.admin_order_field = 'student__last_name'
    
    def current_seating_info(self, obj):
        """Show current seating assignment"""
        assignment = obj.current_seating_assignment
        if assignment:
            info = f"Period: {assignment.seating_period.name}, Seat: {assignment.seat_id}"
            if assignment.group_number:
                info += f", Group: {assignment.group_number}"
                if assignment.group_role:
                    info += f" ({assignment.group_role})"
            return info
        return "No current seating assignment"
    current_seating_info.short_description = 'Current Seating'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(class_assigned__teacher=request.user)