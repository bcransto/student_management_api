# students/serializers.py - Updated for new model structure
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    AttendanceRecord,
    Class,
    ClassroomLayout,
    ClassroomTable,
    ClassRoster,
    LayoutObstacle,
    PartnershipRating,
    SeatingAssignment,
    SeatingPeriod,
    Student,
    TableSeat,
    TeacherStudent,
    User,
)
from .models import GENDER_CHOICES


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    email = serializers.EmailField()

    def validate(self, attrs):
        # Map email to username for authentication
        if "email" in attrs:
            attrs["username"] = attrs["email"]
        return super().validate(attrs)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims to the token
        token["user_id"] = user.id
        token["email"] = user.email
        token["first_name"] = user.first_name
        token["last_name"] = user.last_name
        token["is_teacher"] = user.is_teacher
        token["is_superuser"] = user.is_superuser

        return token


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "is_teacher", "password"]
        extra_kwargs = {
            "password": {"write_only": True},
        }

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        return user


# User Management Serializers

class UserListSerializer(serializers.ModelSerializer):
    """Serializer for listing users - basic info only"""
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "is_active", 
                  "is_superuser", "date_joined", "last_login"]
        read_only_fields = ["id", "date_joined", "last_login"]


class UserDetailSerializer(serializers.ModelSerializer):
    """Serializer for detailed user view"""
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "is_active",
                  "is_superuser", "is_teacher", "date_joined", "last_login"]
        read_only_fields = ["id", "date_joined", "last_login", "is_superuser"]


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new users"""
    password = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = User
        fields = ["email", "first_name", "last_name", "password"]
    
    def create(self, validated_data):
        # Generate temporary password if not provided
        import secrets
        import string
        if 'password' not in validated_data:
            alphabet = string.ascii_letters + string.digits + "!@#$%^&*()"
            validated_data['password'] = ''.join(secrets.choice(alphabet) for i in range(12))
        
        password = validated_data.pop('password')
        # Set username same as email for compatibility
        validated_data['username'] = validated_data['email']
        
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        
        # Return the password so we can send it in the welcome email
        user.temp_password = password
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating existing users"""
    class Meta:
        model = User
        fields = ["email", "first_name", "last_name", "is_active"]
        
    def update(self, instance, validated_data):
        # If email is being changed, update username too
        if 'email' in validated_data:
            instance.username = validated_data['email']
        return super().update(instance, validated_data)


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for password change"""
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)
    
    def validate_new_password(self, value):
        # Check for number
        if not any(char.isdigit() for char in value):
            raise serializers.ValidationError("Password must contain at least one number.")
        # Check for special character
        special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        if not any(char in special_chars for char in value):
            raise serializers.ValidationError("Password must contain at least one special character.")
        return value


# Layout serializers


class TableSeatSerializer(serializers.ModelSerializer):
    absolute_seat_id = serializers.ReadOnlyField()

    class Meta:
        model = TableSeat
        fields = ["id", "seat_number", "absolute_seat_id", "relative_x", "relative_y", "is_accessible", "notes"]


class ClassroomTableSerializer(serializers.ModelSerializer):
    seats = TableSeatSerializer(many=True, read_only=True)

    class Meta:
        model = ClassroomTable
        fields = [
            "id",
            "table_number",
            "table_name",
            "x_position",
            "y_position",
            "width",
            "height",
            "max_seats",
            "table_shape",
            "rotation",
            "seats",
        ]


class LayoutObstacleSerializer(serializers.ModelSerializer):
    class Meta:
        model = LayoutObstacle
        fields = ["id", "name", "obstacle_type", "x_position", "y_position", "width", "height", "color"]


class ClassroomLayoutSerializer(serializers.ModelSerializer):
    tables = ClassroomTableSerializer(many=True, read_only=True)
    obstacles = LayoutObstacleSerializer(many=True, read_only=True)
    total_seats = serializers.ReadOnlyField()
    total_tables = serializers.ReadOnlyField()
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    # From the ClassroomLayoutViewSet queryset annotations; default=0 covers
    # instances serialized outside that queryset (e.g. create_from_editor)
    table_count = serializers.IntegerField(read_only=True, default=0)
    seat_count = serializers.IntegerField(read_only=True, default=0)
    used_by_classes = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = ClassroomLayout
        fields = [
            "id",
            "name",
            "description",
            "room_width",
            "room_height",
            "created_by",
            "created_by_name",
            "is_template",
            "total_seats",
            "total_tables",
            "table_count",
            "seat_count",
            "used_by_classes",
            "tables",
            "obstacles",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]
        extra_kwargs = {
            # Add this to hide created_by in responses
            "created_by": {"write_only": True}
        }


# Seating assignment serializers


class SeatingAssignmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="roster_entry.student.get_full_name", read_only=True)
    student_id = serializers.CharField(source="roster_entry.student.student_id", read_only=True)
    table_number = serializers.ReadOnlyField()
    seat_number = serializers.ReadOnlyField()
    seating_period = serializers.PrimaryKeyRelatedField(queryset=SeatingPeriod.objects.all())

    class Meta:
        model = SeatingAssignment
        fields = [
            "id",
            "seating_period",
            "roster_entry",
            "seat_id",
            "group_number",
            "group_role",
            "assignment_notes",
            "student_name",
            "student_id",
            "table_number",
            "seat_number",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]
    
    def create(self, validated_data):
        """Override create to handle model validation properly"""
        # Create the instance without calling save
        instance = SeatingAssignment(**validated_data)
        # Run full validation which will handle the seating_period_id case
        instance.full_clean()
        # Save after validation passes
        instance.save()
        return instance


class SeatingPeriodSerializer(serializers.ModelSerializer):
    seating_assignments = SeatingAssignmentSerializer(many=True, read_only=True)
    groups = serializers.SerializerMethodField()
    layout = serializers.PrimaryKeyRelatedField(
        queryset=ClassroomLayout.objects.all(), required=True, help_text="The classroom layout for this seating period"
    )
    layout_details = ClassroomLayoutSerializer(source="layout", read_only=True)

    class Meta:
        model = SeatingPeriod
        fields = [
            "id",
            "class_assigned",
            "name",
            "start_date",
            "end_date",
            "notes",
            "is_tracked",
            "layout",
            "layout_details",
            "seating_assignments",
            "groups",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_groups(self, obj):
        """Get students organized by groups"""
        groups_data = {}
        groups = obj.get_groups()
        for group_num, assignments in groups.items():
            groups_data[str(group_num)] = [
                {
                    "assignment_id": assignment.id,
                    "student_id": assignment.roster_entry.student.id,
                    "student_name": assignment.roster_entry.student.get_full_name(),
                    "seat_id": assignment.seat_id,
                    "group_role": assignment.group_role,
                }
                for assignment in assignments
            ]
        return groups_data


# Updated ClassRoster serializer (simplified - no more seating fields)


class ClassRosterSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.get_full_name", read_only=True)
    student_id = serializers.CharField(source="student.student_id", read_only=True)
    student_first_name = serializers.CharField(source="student.first_name", read_only=True)
    student_last_name = serializers.CharField(source="student.last_name", read_only=True)
    student_nickname = serializers.SerializerMethodField()
    student_email = serializers.CharField(source="student.email", read_only=True)
    student_gender = serializers.SerializerMethodField()
    student_preferential_seating = serializers.SerializerMethodField()
    current_seating_assignment = serializers.SerializerMethodField()
    class_assigned_details = serializers.SerializerMethodField()

    class Meta:
        model = ClassRoster
        fields = [
            "id",
            "student",
            "student_name",
            "student_id",
            "student_first_name",
            "student_last_name",
            "student_nickname",
            "student_email",
            "student_gender",
            "student_preferential_seating",
            "class_assigned",
            "class_assigned_details",
            "is_active",
            "notes",
            "attendance_notes",
            "enrollment_date",
            "current_seating_assignment",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["enrollment_date", "created_at", "updated_at"]

    def get_class_assigned_details(self, obj):
        """Get class details for this roster entry"""
        if obj.class_assigned:
            return {
                "class_name": obj.class_assigned.name,
                "grade_level": obj.class_assigned.grade_level,
                "teacher_name": obj.class_assigned.teacher.get_full_name() if obj.class_assigned.teacher else None,
                "subject": obj.class_assigned.subject,
            }
        return None

    def _teacher_annotation(self, obj):
        """
        Resolve the class teacher's TeacherStudent row for this roster entry's
        student. A Class has exactly one teacher, so no request context is
        needed. Uses the prefetched ``teacher_annotations_list`` (see the
        Prefetch in ClassSerializer.get_roster / ClassRosterViewSet) when
        available to avoid N+1 queries; the result is cached on the instance.
        """
        if hasattr(obj, "_ts_annotation_cached"):
            return obj._ts_annotation
        teacher_id = obj.class_assigned.teacher_id
        student = obj.student
        annotations = getattr(student, "teacher_annotations_list", None)
        result = None
        if annotations is not None:
            for annotation in annotations:
                if annotation.teacher_id == teacher_id:
                    result = annotation
                    break
        else:
            result = TeacherStudent.objects.filter(
                teacher_id=teacher_id, student=student
            ).first()
        obj._ts_annotation = result
        obj._ts_annotation_cached = True
        return result

    def get_student_nickname(self, obj):
        annotation = self._teacher_annotation(obj)
        if annotation and annotation.nickname and annotation.nickname.strip():
            return annotation.nickname
        return obj.student.first_name

    def get_student_gender(self, obj):
        annotation = self._teacher_annotation(obj)
        return annotation.gender if annotation else None

    def get_student_preferential_seating(self, obj):
        annotation = self._teacher_annotation(obj)
        return annotation.preferential_seating if annotation else False

    def get_current_seating_assignment(self, obj):
        """Get current seating assignment for this student (uses prefetched data)"""
        # Use prefetched seating_assignments if available (from ClassSerializer.get_roster)
        # This avoids N+1 queries when serializing roster entries
        assignments = getattr(obj, '_prefetched_objects_cache', {}).get('seating_assignments')
        if assignments is not None:
            # Use prefetched data - already filtered to current period
            assignment = assignments[0] if assignments else None
        else:
            # Fallback to model property (for cases where prefetch wasn't done)
            assignment = obj.current_seating_assignment

        if assignment:
            return {
                "seat_id": assignment.seat_id,
                "group_number": assignment.group_number,
                "group_role": assignment.group_role,
                "seating_period": assignment.seating_period.name,
            }
        return None


class StudentSerializer(serializers.ModelSerializer):
    active_classes = serializers.SerializerMethodField()
    current_enrollments = ClassRosterSerializer(source="enrollments", many=True, read_only=True)
    # nickname / gender / preferential_seating are per-teacher annotations that
    # live on TeacherStudent, not on Student. They are declared here (not as
    # model fields) so the frontend contract is unchanged: on read they resolve
    # from the REQUESTING user's TeacherStudent row (see to_representation), and
    # on write they are stored via update_or_create in create()/update().
    # required=False means DRF SkipFields them on read (Student has no such
    # attribute), letting to_representation supply the resolved values.
    nickname = serializers.CharField(max_length=30, required=False, allow_blank=True)
    gender = serializers.ChoiceField(
        choices=GENDER_CHOICES, required=False, allow_blank=True, allow_null=True
    )
    preferential_seating = serializers.BooleanField(required=False)

    ANNOTATION_FIELDS = ("nickname", "gender", "preferential_seating")

    class Meta:
        model = Student
        fields = [
            "id",
            "student_id",
            "first_name",
            "last_name",
            "nickname",
            "email",
            "gender",
            "preferential_seating",
            "google_user_id",
            "date_of_birth",
            "cohort",
            "enrollment_date",
            "is_active",
            "active_classes",
            "current_enrollments",
        ]
        # Sync-owned fields are read-only via the API - the global Student row
        # is maintained only by the Workspace directory sync (and the Google
        # imports). date_of_birth is the one teacher-writable global field
        # (Workspace's domain_public view never exposes it); nickname/gender/
        # preferential_seating are per-teacher annotations handled separately.
        read_only_fields = [
            "enrollment_date",
            "student_id",
            "first_name",
            "last_name",
            "email",
            "google_user_id",
            "cohort",
            "is_active",
        ]

    def get_active_classes(self, obj):
        active_classes = obj.active_classes
        return [{"id": cls.id, "name": cls.name} for cls in active_classes]

    def _requesting_annotation(self, obj):
        """
        TeacherStudent row for the requesting user + this student, or None.
        Uses the prefetched ``my_annotations`` list (see StudentViewSet
        .get_queryset) when present to avoid N+1 queries.
        """
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return None
        annotations = getattr(obj, "my_annotations", None)
        if annotations is not None:
            return annotations[0] if annotations else None
        return TeacherStudent.objects.filter(teacher=user, student=obj).first()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        annotation = self._requesting_annotation(instance)
        if annotation and annotation.nickname and annotation.nickname.strip():
            data["nickname"] = annotation.nickname
        else:
            data["nickname"] = instance.first_name
        data["gender"] = annotation.gender if annotation else None
        data["preferential_seating"] = (
            annotation.preferential_seating if annotation else False
        )
        return data

    def _pop_annotation_fields(self, validated_data):
        """Remove and return any annotation fields present in the payload."""
        return {
            field: validated_data.pop(field)
            for field in self.ANNOTATION_FIELDS
            if field in validated_data
        }

    def _write_annotation(self, student, annotation_fields):
        """Persist per-teacher annotations to the requesting user's row."""
        if not annotation_fields:
            return
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return
        defaults = {}
        if "nickname" in annotation_fields:
            defaults["nickname"] = annotation_fields["nickname"] or ""
        if "gender" in annotation_fields:
            defaults["gender"] = annotation_fields["gender"] or None
        if "preferential_seating" in annotation_fields:
            defaults["preferential_seating"] = annotation_fields["preferential_seating"]
        TeacherStudent.objects.update_or_create(
            teacher=user, student=student, defaults=defaults
        )
        # Drop the (now stale) prefetched annotations so to_representation
        # re-reads the freshly written row instead of the pre-write cache.
        if hasattr(student, "my_annotations"):
            del student.my_annotations

    def create(self, validated_data):
        annotation_fields = self._pop_annotation_fields(validated_data)
        student = super().create(validated_data)
        self._write_annotation(student, annotation_fields)
        return student

    def update(self, instance, validated_data):
        annotation_fields = self._pop_annotation_fields(validated_data)
        student = super().update(instance, validated_data)
        self._write_annotation(student, annotation_fields)
        return student


class ClassListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for class list view - no roster, periods, or assignments"""

    # Reads the ClassViewSet list queryset's student_count annotation; named
    # current_enrollment to match the detail serializer's field. The source
    # alias also keeps the model property (which fires its own COUNT query)
    # from shadowing the annotation.
    current_enrollment = serializers.IntegerField(source="student_count", read_only=True)

    class Meta:
        model = Class
        fields = ["id", "name", "subject", "grade_level", "description",
                  "current_enrollment", "updated_at"]


class ClassSerializer(serializers.ModelSerializer):
    teacher = serializers.PrimaryKeyRelatedField(read_only=True)
    teacher_name = serializers.CharField(source="teacher.get_full_name", read_only=True)
    current_enrollment = serializers.ReadOnlyField()
    roster = serializers.SerializerMethodField()
    # classroom_layout removed - deprecated field, use SeatingPeriod.layout instead
    current_seating_period = SeatingPeriodSerializer(read_only=True)
    seating_periods = SeatingPeriodSerializer(many=True, read_only=True)

    def get_roster(self, obj):
        """Only return active roster entries with prefetched seating data"""
        from django.db.models import Prefetch

        # Get current seating period once (avoids N queries)
        current_period = obj.current_seating_period

        # Build prefetch for seating assignments
        if current_period:
            seating_prefetch = Prefetch(
                'seating_assignments',
                queryset=SeatingAssignment.objects.filter(
                    seating_period=current_period
                ).select_related('seating_period')
            )
        else:
            seating_prefetch = Prefetch(
                'seating_assignments',
                queryset=SeatingAssignment.objects.none()
            )

        # Prefetch the class teacher's annotations so the roster serializer can
        # resolve nickname/gender/preferential_seating without N+1 queries.
        annotation_prefetch = Prefetch(
            'student__teacher_annotations',
            queryset=TeacherStudent.objects.filter(teacher_id=obj.teacher_id),
            to_attr='teacher_annotations_list',
        )

        active_roster = obj.roster.filter(is_active=True).select_related(
            'student', 'class_assigned', 'class_assigned__teacher'
        ).prefetch_related(seating_prefetch, annotation_prefetch)

        return ClassRosterSerializer(
            active_roster, many=True,
            context={'current_period': current_period}
        ).data

    class Meta:
        model = Class
        fields = [
            "id",
            "name",
            "description",
            "subject",
            "grade_level",
            "teacher",
            "teacher_name",
            "current_enrollment",
            # "classroom_layout",  # Removed - deprecated field
            "current_seating_period",
            "seating_periods",
            "roster",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "teacher_name",
            "current_enrollment",
            "roster",
            "current_seating_period",
            "seating_periods",
        ]


# Action serializers for specific operations


class EnrollStudentSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    notes = serializers.CharField(required=False, allow_blank=True)


class CreateSeatingPeriodSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    start_date = serializers.DateField()
    end_date = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class AssignSeatSerializer(serializers.Serializer):
    roster_entry_id = serializers.IntegerField()
    seat_id = serializers.CharField(max_length=20)
    group_number = serializers.IntegerField(required=False, min_value=1)
    group_role = serializers.ChoiceField(
        choices=SeatingAssignment._meta.get_field("group_role").choices, required=False, allow_blank=True
    )
    assignment_notes = serializers.CharField(required=False, allow_blank=True)

    def validate_seat_id(self, value):
        """Validate seat_id format"""
        if not value or "-" not in value:
            raise serializers.ValidationError("seat_id must be in format 'table_number-seat_number'")

        try:
            table_num, seat_num = value.split("-")
            int(table_num)
            int(seat_num)
        except (ValueError, IndexError):
            raise serializers.ValidationError("seat_id must contain valid integers")

        return value


class UpdateRosterSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassRoster
        fields = ["notes", "attendance_notes", "is_active"]


class BulkSeatingAssignmentSerializer(serializers.Serializer):
    """For assigning multiple students at once"""

    assignments = serializers.ListField(child=AssignSeatSerializer(), min_length=1)


class PartnershipRatingSerializer(serializers.ModelSerializer):
    """Serializer for PartnershipRating model"""
    
    student1_name = serializers.CharField(source='student1.first_name', read_only=True)
    student2_name = serializers.CharField(source='student2.first_name', read_only=True)
    student1_full_name = serializers.SerializerMethodField(read_only=True)
    student2_full_name = serializers.SerializerMethodField(read_only=True)
    rating_display = serializers.CharField(source='get_rating_display', read_only=True)
    
    class Meta:
        model = PartnershipRating
        fields = [
            'id', 'class_assigned', 'student1', 'student2',
            'student1_name', 'student2_name', 
            'student1_full_name', 'student2_full_name',
            'rating', 'rating_display', 'notes',
            'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_student1_full_name(self, obj):
        return f"{obj.student1.first_name} {obj.student1.last_name}"
    
    def get_student2_full_name(self, obj):
        return f"{obj.student2.first_name} {obj.student2.last_name}"
    
    def validate(self, data):
        """Ensure student1 and student2 are ordered consistently"""
        if 'student1' in data and 'student2' in data:
            s1_id = data['student1'].id
            s2_id = data['student2'].id
            
            # Ensure students are different
            if s1_id == s2_id:
                raise serializers.ValidationError("Cannot rate a student with themselves")
            
            # Order students by ID (lower ID first)
            if s1_id > s2_id:
                data['student1'], data['student2'] = data['student2'], data['student1']
        
        return data


class BulkPartnershipRatingSerializer(serializers.Serializer):
    """For updating multiple partnership ratings at once"""
    
    ratings = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False
    )
    
    def validate_ratings(self, value):
        """Validate each rating entry"""
        for rating in value:
            if 'student1_id' not in rating or 'student2_id' not in rating:
                raise serializers.ValidationError(
                    "Each rating must have student1_id and student2_id"
                )
            if 'rating' not in rating:
                raise serializers.ValidationError(
                    "Each rating must have a rating value"
                )
            if rating['rating'] not in [-2, -1, 0, 1, 2]:
                raise serializers.ValidationError(
                    f"Invalid rating value: {rating['rating']}. Must be between -2 and 2"
                )
        return value


class AttendanceRecordSerializer(serializers.ModelSerializer):
    """Serializer for AttendanceRecord model"""
    
    # Include student info for display
    student_id = serializers.IntegerField(source='class_roster.student.id', read_only=True)
    student_name = serializers.CharField(source='class_roster.student.get_full_name', read_only=True)
    student_first_name = serializers.CharField(source='class_roster.student.first_name', read_only=True)
    student_last_name = serializers.CharField(source='class_roster.student.last_name', read_only=True)
    # Nickname resolves through the class teacher's TeacherStudent annotation
    # (falls back to first_name), matching the ClassRoster serializer.
    student_nickname = serializers.SerializerMethodField()

    # Include class info
    class_id = serializers.IntegerField(source='class_roster.class_assigned.id', read_only=True)
    class_name = serializers.CharField(source='class_roster.class_assigned.name', read_only=True)
    
    class Meta:
        model = AttendanceRecord
        fields = [
            'id',
            'class_roster',
            'date',
            'status',
            'notes',
            'student_id',
            'student_name',
            'student_first_name',
            'student_last_name',
            'student_nickname',
            'class_id',
            'class_name',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_student_nickname(self, obj):
        student = obj.class_roster.student
        teacher_id = obj.class_roster.class_assigned.teacher_id
        annotation = TeacherStudent.objects.filter(
            teacher_id=teacher_id, student=student
        ).first()
        if annotation and annotation.nickname and annotation.nickname.strip():
            return annotation.nickname
        return student.first_name

    def validate_class_roster(self, value):
        """Ensure the roster entry is active"""
        if not value.is_active:
            raise serializers.ValidationError("Cannot create attendance for inactive roster entry")
        return value


class AttendanceBulkSerializer(serializers.Serializer):
    """Serializer for bulk attendance updates"""
    
    date = serializers.DateField()
    attendance_records = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False
    )
    
    def validate_attendance_records(self, value):
        """Validate each attendance record"""
        valid_statuses = ['present', 'absent', 'tardy', 'early_dismissal']
        
        for record in value:
            if 'class_roster_id' not in record:
                raise serializers.ValidationError("Each record must have class_roster_id")
            
            if 'status' not in record:
                raise serializers.ValidationError("Each record must have a status")
                
            if record['status'] not in valid_statuses:
                raise serializers.ValidationError(
                    f"Invalid status: {record['status']}. Must be one of {valid_statuses}"
                )
        
        return value
