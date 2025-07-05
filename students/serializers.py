# students/serializers.py - Updated for new model structure
from rest_framework import serializers
from .models import (
    User, Class, Student, ClassRoster, ClassroomLayout, 
    ClassroomTable, TableSeat, LayoutObstacle, 
    SeatingPeriod, SeatingAssignment
)

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_teacher', 'password']
        extra_kwargs = {
            'password': {'write_only': True},
        }
    
    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        return user

# Layout serializers
class TableSeatSerializer(serializers.ModelSerializer):
    absolute_seat_id = serializers.ReadOnlyField()
    
    class Meta:
        model = TableSeat
        fields = ['id', 'seat_number', 'absolute_seat_id', 'relative_x', 'relative_y', 
                 'is_accessible', 'notes']

class ClassroomTableSerializer(serializers.ModelSerializer):
    seats = TableSeatSerializer(many=True, read_only=True)
    
    class Meta:
        model = ClassroomTable
        fields = ['id', 'table_number', 'table_name', 'x_position', 'y_position',
                 'width', 'height', 'max_seats', 'table_shape', 'rotation', 'seats']

class LayoutObstacleSerializer(serializers.ModelSerializer):
    class Meta:
        model = LayoutObstacle
        fields = ['id', 'name', 'obstacle_type', 'x_position', 'y_position',
                 'width', 'height', 'color']

class ClassroomLayoutSerializer(serializers.ModelSerializer):
    tables = ClassroomTableSerializer(many=True, read_only=True)
    obstacles = LayoutObstacleSerializer(many=True, read_only=True)
    total_seats = serializers.ReadOnlyField()
    total_tables = serializers.ReadOnlyField()
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = ClassroomLayout
        fields = ['id', 'name', 'description', 'room_width', 'room_height',
                 'created_by', 'created_by_name', 'is_template', 'total_seats', 
                 'total_tables', 'tables', 'obstacles', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

# Seating assignment serializers  
class SeatingAssignmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='roster_entry.student.get_full_name', read_only=True)
    student_id = serializers.CharField(source='roster_entry.student.student_id', read_only=True)
    table_number = serializers.ReadOnlyField()
    seat_number = serializers.ReadOnlyField()
    
    class Meta:
        model = SeatingAssignment
        fields = ['id', 'roster_entry', 'seat_id', 'group_number', 'group_role',
                 'assignment_notes', 'student_name', 'student_id', 'table_number', 
                 'seat_number', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

class SeatingPeriodSerializer(serializers.ModelSerializer):
    seating_assignments = SeatingAssignmentSerializer(many=True, read_only=True)
    groups = serializers.SerializerMethodField()
    
    class Meta:
        model = SeatingPeriod
        fields = ['id', 'name', 'start_date', 'end_date', 'is_active', 'notes',
                 'seating_assignments', 'groups', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
    
    def get_groups(self, obj):
        """Get students organized by groups"""
        groups_data = {}
        groups = obj.get_groups()
        for group_num, assignments in groups.items():
            groups_data[str(group_num)] = [
                {
                    'assignment_id': assignment.id,
                    'student_id': assignment.roster_entry.student.id,
                    'student_name': assignment.roster_entry.student.get_full_name(),
                    'seat_id': assignment.seat_id,
                    'group_role': assignment.group_role,
                }
                for assignment in assignments
            ]
        return groups_data

# Updated ClassRoster serializer (simplified - no more seating fields)
class ClassRosterSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    current_seating_assignment = serializers.SerializerMethodField()
    
    class Meta:
        model = ClassRoster
        fields = ['id', 'student', 'student_name', 'student_id', 'is_active', 
                 'notes', 'attendance_notes', 'enrollment_date', 'current_seating_assignment',
                 'created_at', 'updated_at']
        read_only_fields = ['enrollment_date', 'created_at', 'updated_at']
    
    def get_current_seating_assignment(self, obj):
        """Get current seating assignment for this student"""
        assignment = obj.current_seating_assignment
        if assignment:
            return {
                'seat_id': assignment.seat_id,
                'group_number': assignment.group_number,
                'group_role': assignment.group_role,
                'seating_period': assignment.seating_period.name
            }
        return None

class StudentSerializer(serializers.ModelSerializer):
    active_classes = serializers.SerializerMethodField()
    current_enrollments = ClassRosterSerializer(source='enrollments', many=True, read_only=True)
    
    class Meta:
        model = Student
        fields = ['id', 'student_id', 'first_name', 'last_name', 'email', 
                 'date_of_birth', 'enrollment_date', 'is_active', 'active_classes', 'current_enrollments']
        read_only_fields = ['enrollment_date']
    
    def get_active_classes(self, obj):
        active_classes = obj.active_classes
        return [{'id': cls.id, 'name': cls.name} for cls in active_classes]

class ClassSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='teacher.get_full_name', read_only=True)
    current_enrollment = serializers.ReadOnlyField()
    roster = ClassRosterSerializer(many=True, read_only=True)
    classroom_layout = ClassroomLayoutSerializer(read_only=True)
    current_seating_period = SeatingPeriodSerializer(read_only=True)
    seating_periods = SeatingPeriodSerializer(many=True, read_only=True)
    
    class Meta:
        model = Class
        fields = ['id', 'name', 'description', 'subject', 'grade_level', 
                 'teacher_name', 'current_enrollment', 'classroom_layout',
                 'current_seating_period', 'seating_periods', 'roster',
                 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'teacher_name', 
                           'current_enrollment', 'roster', 'current_seating_period', 'seating_periods']

# Action serializers for specific operations
class EnrollStudentSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    notes = serializers.CharField(required=False, allow_blank=True)

class CreateSeatingPeriodSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    start_date = serializers.DateField()
    end_date = serializers.DateField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(default=True)

class AssignSeatSerializer(serializers.Serializer):
    roster_entry_id = serializers.IntegerField()
    seat_id = serializers.CharField(max_length=20)
    group_number = serializers.IntegerField(required=False, min_value=1)
    group_role = serializers.ChoiceField(
        choices=SeatingAssignment._meta.get_field('group_role').choices,
        required=False,
        allow_blank=True
    )
    assignment_notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate_seat_id(self, value):
        """Validate seat_id format"""
        if not value or '-' not in value:
            raise serializers.ValidationError("seat_id must be in format 'table_number-seat_number'")
        
        try:
            table_num, seat_num = value.split('-')
            int(table_num)
            int(seat_num)
        except (ValueError, IndexError):
            raise serializers.ValidationError("seat_id must contain valid integers")
        
        return value

class UpdateRosterSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassRoster
        fields = ['notes', 'attendance_notes', 'is_active']

class BulkSeatingAssignmentSerializer(serializers.Serializer):
    """For assigning multiple students at once"""
    assignments = serializers.ListField(
        child=AssignSeatSerializer(),
        min_length=1
    )

# JWT Token serializer (if you're still using the custom one)
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = 'email'
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Add email field to the serializer
        self.fields['email'] = self.fields['username']
    
    def validate(self, attrs):
        # Use email as username for authentication
        email = attrs.get('email') or attrs.get('username')
        password = attrs.get('password')
        
        if email and password:
            attrs['username'] = email
        
        return super().validate(attrs)
    
    # students/serializers.py - Updated for new model structure
from rest_framework import serializers
from .models import (
    User, Class, Student, ClassRoster, ClassroomLayout, 
    ClassroomTable, TableSeat, LayoutObstacle, 
    SeatingPeriod, SeatingAssignment
)

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_teacher', 'password']
        extra_kwargs = {
            'password': {'write_only': True},
        }
    
    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        return user

# Layout serializers
class TableSeatSerializer(serializers.ModelSerializer):
    absolute_seat_id = serializers.ReadOnlyField()
    
    class Meta:
        model = TableSeat
        fields = ['id', 'seat_number', 'absolute_seat_id', 'relative_x', 'relative_y', 
                 'is_accessible', 'notes']

class ClassroomTableSerializer(serializers.ModelSerializer):
    seats = TableSeatSerializer(many=True, read_only=True)
    
    class Meta:
        model = ClassroomTable
        fields = ['id', 'table_number', 'table_name', 'x_position', 'y_position',
                 'width', 'height', 'max_seats', 'table_shape', 'rotation', 'seats']

class LayoutObstacleSerializer(serializers.ModelSerializer):
    class Meta:
        model = LayoutObstacle
        fields = ['id', 'name', 'obstacle_type', 'x_position', 'y_position',
                 'width', 'height', 'color']

class ClassroomLayoutSerializer(serializers.ModelSerializer):
    tables = ClassroomTableSerializer(many=True, read_only=True)
    obstacles = LayoutObstacleSerializer(many=True, read_only=True)
    total_seats = serializers.ReadOnlyField()
    total_tables = serializers.ReadOnlyField()
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = ClassroomLayout
        fields = ['id', 'name', 'description', 'room_width', 'room_height',
                 'created_by', 'created_by_name', 'is_template', 'total_seats', 
                 'total_tables', 'tables', 'obstacles', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

# Seating assignment serializers  
class SeatingAssignmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='roster_entry.student.get_full_name', read_only=True)
    student_id = serializers.CharField(source='roster_entry.student.student_id', read_only=True)
    table_number = serializers.ReadOnlyField()
    seat_number = serializers.ReadOnlyField()
    
    class Meta:
        model = SeatingAssignment
        fields = ['id', 'roster_entry', 'seat_id', 'group_number', 'group_role',
                 'assignment_notes', 'student_name', 'student_id', 'table_number', 
                 'seat_number', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

class SeatingPeriodSerializer(serializers.ModelSerializer):
    seating_assignments = SeatingAssignmentSerializer(many=True, read_only=True)
    groups = serializers.SerializerMethodField()
    
    class Meta:
        model = SeatingPeriod
        fields = ['id', 'name', 'start_date', 'end_date', 'is_active', 'notes',
                 'seating_assignments', 'groups', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
    
    def get_groups(self, obj):
        """Get students organized by groups"""
        groups_data = {}
        groups = obj.get_groups()
        for group_num, assignments in groups.items():
            groups_data[str(group_num)] = [
                {
                    'assignment_id': assignment.id,
                    'student_id': assignment.roster_entry.student.id,
                    'student_name': assignment.roster_entry.student.get_full_name(),
                    'seat_id': assignment.seat_id,
                    'group_role': assignment.group_role,
                }
                for assignment in assignments
            ]
        return groups_data

# Updated ClassRoster serializer (simplified - no more seating fields)
class ClassRosterSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    current_seating_assignment = serializers.SerializerMethodField()
    
    class Meta:
        model = ClassRoster
        fields = ['id', 'student', 'student_name', 'student_id', 'is_active', 
                 'notes', 'attendance_notes', 'enrollment_date', 'current_seating_assignment',
                 'created_at', 'updated_at']
        read_only_fields = ['enrollment_date', 'created_at', 'updated_at']
    
    def get_current_seating_assignment(self, obj):
        """Get current seating assignment for this student"""
        assignment = obj.current_seating_assignment
        if assignment:
            return {
                'seat_id': assignment.seat_id,
                'group_number': assignment.group_number,
                'group_role': assignment.group_role,
                'seating_period': assignment.seating_period.name
            }
        return None

class StudentSerializer(serializers.ModelSerializer):
    active_classes = serializers.SerializerMethodField()
    current_enrollments = ClassRosterSerializer(source='enrollments', many=True, read_only=True)
    
    class Meta:
        model = Student
        fields = ['id', 'student_id', 'first_name', 'last_name', 'email', 
                 'date_of_birth', 'enrollment_date', 'is_active', 'active_classes', 'current_enrollments']
        read_only_fields = ['enrollment_date']
    
    def get_active_classes(self, obj):
        active_classes = obj.active_classes
        return [{'id': cls.id, 'name': cls.name} for cls in active_classes]

class ClassSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='teacher.get_full_name', read_only=True)
    current_enrollment = serializers.ReadOnlyField()
    roster = ClassRosterSerializer(many=True, read_only=True)
    classroom_layout = ClassroomLayoutSerializer(read_only=True)
    current_seating_period = SeatingPeriodSerializer(read_only=True)
    seating_periods = SeatingPeriodSerializer(many=True, read_only=True)
    
    class Meta:
        model = Class
        fields = ['id', 'name', 'description', 'subject', 'grade_level', 
                 'teacher_name', 'current_enrollment', 'classroom_layout',
                 'current_seating_period', 'seating_periods', 'roster',
                 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'teacher_name', 
                           'current_enrollment', 'roster', 'current_seating_period', 'seating_periods']

# Action serializers for specific operations
class EnrollStudentSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    notes = serializers.CharField(required=False, allow_blank=True)

class CreateSeatingPeriodSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    start_date = serializers.DateField()
    end_date = serializers.DateField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(default=True)

class AssignSeatSerializer(serializers.Serializer):
    roster_entry_id = serializers.IntegerField()
    seat_id = serializers.CharField(max_length=20)
    group_number = serializers.IntegerField(required=False, min_value=1)
    group_role = serializers.ChoiceField(
        choices=SeatingAssignment._meta.get_field('group_role').choices,
        required=False,
        allow_blank=True
    )
    assignment_notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate_seat_id(self, value):
        """Validate seat_id format"""
        if not value or '-' not in value:
            raise serializers.ValidationError("seat_id must be in format 'table_number-seat_number'")
        
        try:
            table_num, seat_num = value.split('-')
            int(table_num)
            int(seat_num)
        except (ValueError, IndexError):
            raise serializers.ValidationError("seat_id must contain valid integers")
        
        return value

class UpdateRosterSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassRoster
        fields = ['notes', 'attendance_notes', 'is_active']

class BulkSeatingAssignmentSerializer(serializers.Serializer):
    """For assigning multiple students at once"""
    assignments = serializers.ListField(
        child=AssignSeatSerializer(),
        min_length=1
    )

# Add these missing serializers at the end:

class ClassroomTableSerializer(serializers.ModelSerializer):
    seats = TableSeatSerializer(many=True, read_only=True)
    
    class Meta:
        model = ClassroomTable
        fields = ['id', 'table_number', 'table_name', 'x_position', 'y_position',
                 'width', 'height', 'max_seats', 'table_shape', 'rotation', 'seats']

class LayoutObstacleSerializer(serializers.ModelSerializer):
    class Meta:
        model = LayoutObstacle
        fields = ['id', 'name', 'obstacle_type', 'x_position', 'y_position',
                 'width', 'height', 'color']
        
# Add these missing serializers to students/serializers.py

class ClassroomTableSerializer(serializers.ModelSerializer):
    seats = TableSeatSerializer(many=True, read_only=True)
    
    class Meta:
        model = ClassroomTable
        fields = ['id', 'table_number', 'table_name', 'x_position', 'y_position',
                 'width', 'height', 'max_seats', 'table_shape', 'rotation', 'seats']

class LayoutObstacleSerializer(serializers.ModelSerializer):
    class Meta:
        model = LayoutObstacle
        fields = ['id', 'name', 'obstacle_type', 'x_position', 'y_position',
                 'width', 'height', 'color']