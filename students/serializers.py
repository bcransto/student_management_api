# students/serializers.py
from rest_framework import serializers
from .models import User, Class, Student, ClassRoster

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

class ClassRosterSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    
    class Meta:
        model = ClassRoster
        fields = ['id', 'student', 'student_name', 'student_id', 'group_number', 
                 'seat_number', 'group_role', 'is_active', 'notes', 'attendance_notes',
                 'enrollment_date', 'created_at', 'updated_at']
        read_only_fields = ['enrollment_date', 'created_at', 'updated_at']

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
    groups = serializers.SerializerMethodField()
    
    class Meta:
        model = Class
        fields = ['id', 'name', 'description', 'subject', 'grade_level', 
                 'teacher_name', 'current_enrollment', 
                 'roster', 'groups', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'teacher_name', 
                           'current_enrollment', 'roster', 'groups']
    
    def get_groups(self, obj):
        groups_data = {}
        all_groups = obj.get_all_groups()
        for group_num, members in all_groups.items():
            groups_data[str(group_num)] = [
                {
                    'roster_id': member.id,
                    'student_id': member.student.id,
                    'student_name': member.student.get_full_name(),
                    'seat_number': member.seat_number,
                    'group_role': member.group_role,
                }
                for member in members
            ]
        return groups_data

# Specialized serializers for specific actions
class EnrollStudentSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    group_number = serializers.IntegerField(required=False, min_value=1)
    seat_number = serializers.IntegerField(required=False, min_value=1)
    group_role = serializers.ChoiceField(
        choices=ClassRoster._meta.get_field('group_role').choices,
        required=False
    )
    notes = serializers.CharField(required=False, allow_blank=True)

class UpdateRosterSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassRoster
        fields = ['group_number', 'seat_number', 'group_role', 'notes', 'attendance_notes', 'is_active']
    
    def validate_group_number(self, value):
        # Remove validation since max_groups no longer exists
        return value
    
    def validate_seat_number(self, value):
        # Remove validation since max_students no longer exists
        return value