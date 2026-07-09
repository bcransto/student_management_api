# students/views.py - Minimal working version
import os

import requests as http_requests
from django.conf import settings
from django.core.mail import send_mail
from django.db import models
from django.http import HttpResponse
from django.shortcuts import render
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

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
    StudentPartnerPreference,
    TableSeat,
    TeacherStudent,
    User,
)
from .permissions import (
    HasExternalAPIKey,
    IsSpecialPointsUser,
    IsStudent,
    IsSuperuser,
    IsSuperuserOrOwner,
    IsTeacher,
)
from .serializers import (
    AttendanceBulkSerializer,
    AttendanceRecordSerializer,
    ChangePasswordSerializer,
    ClassroomLayoutSerializer,
    ClassroomTableSerializer,
    ClassListSerializer,
    ClassRosterSerializer,
    ClassSerializer,
    LayoutObstacleSerializer,
    SeatingAssignmentSerializer,
    SeatingPeriodSerializer,
    StudentSerializer,
    TableSeatSerializer,
    UserCreateSerializer,
    UserDetailSerializer,
    UserListSerializer,
    UserSerializer,
    UserUpdateSerializer,
)


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for user management.
    Superusers can manage all users.
    Regular users can only view and edit their own profile.
    """
    queryset = User.objects.all().order_by('-date_joined')
    # IsTeacher gates the whole viewset off from student accounts (GH #16);
    # the per-action branches below layer superuser/owner rules on top.
    permission_classes = [IsTeacher]

    def get_permissions(self):
        """Return appropriate permission classes based on action"""
        if self.action in ['list', 'create']:
            # Only superusers can list all users or create new ones
            permission_classes = [IsTeacher, IsSuperuser]
        elif self.action in ['retrieve', 'update', 'partial_update']:
            # Superusers can access any user, regular users only their own
            permission_classes = [IsTeacher, IsSuperuserOrOwner]
        elif self.action in ['destroy', 'deactivate', 'reactivate']:
            # Only superusers can delete or deactivate users
            permission_classes = [IsTeacher, IsSuperuser]
        else:
            # Default: any teacher (e.g. own profile via `me`)
            permission_classes = [IsTeacher]
        return [permission() for permission in permission_classes]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'list':
            return UserListSerializer
        elif self.action == 'create':
            return UserCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        elif self.action == 'change_password':
            return ChangePasswordSerializer
        else:
            return UserDetailSerializer
    
    def get_queryset(self):
        """Filter queryset based on user permissions"""
        user = self.request.user
        if user.is_superuser:
            # Superusers can see all users
            return User.objects.all().order_by('-date_joined')
        else:
            # Regular users can only see themselves
            return User.objects.filter(id=user.id)
    
    @action(detail=False, methods=['get', 'patch'], permission_classes=[IsTeacher])
    def me(self, request):
        """Get or update the current user's profile"""
        if request.method == 'GET':
            serializer = UserDetailSerializer(request.user)
            return Response(serializer.data)
        elif request.method == 'PATCH':
            serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], permission_classes=[IsSuperuser])
    def deactivate(self, request, pk=None):
        """Deactivate a user (soft delete)"""
        user = self.get_object()
        
        # Prevent deactivating yourself
        if user == request.user:
            return Response(
                {"error": "You cannot deactivate your own account"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Prevent deactivating the last superuser
        if user.is_superuser and User.objects.filter(is_superuser=True, is_active=True).count() == 1:
            return Response(
                {"error": "Cannot deactivate the last active superuser"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.is_active = False
        user.save()
        
        # TODO: Force logout the deactivated user's sessions
        
        return Response({"message": f"User {user.email} has been deactivated"})
    
    @action(detail=True, methods=['post'], permission_classes=[IsSuperuser])
    def reactivate(self, request, pk=None):
        """Reactivate a deactivated user"""
        user = self.get_object()
        
        if user.is_active:
            return Response(
                {"error": "User is already active"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.is_active = True
        user.save()
        
        return Response({"message": f"User {user.email} has been reactivated"})
    
    @action(detail=False, methods=['post'], permission_classes=[IsTeacher])
    def change_password(self, request):
        """Change the current user's password"""
        serializer = ChangePasswordSerializer(data=request.data)
        
        if serializer.is_valid():
            user = request.user
            
            # Check old password
            if not user.check_password(serializer.validated_data['old_password']):
                return Response(
                    {"old_password": "Wrong password"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Set new password
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            
            # Send confirmation email
            try:
                send_mail(
                    'Password Changed Successfully',
                    f'Your password for {user.email} has been changed successfully. If you did not make this change, please contact support immediately.',
                    settings.DEFAULT_FROM_EMAIL,
                    [user.email],
                    fail_silently=True,
                )
            except Exception:
                pass  # Don't fail if email doesn't send
            
            return Response({"message": "Password changed successfully"})
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def create(self, request, *args, **kwargs):
        """Create a new user and send welcome email"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Get the temporary password if one was generated
        temp_password = getattr(user, 'temp_password', None)
        
        # Send welcome email with temp_password
        if temp_password:
            subject = 'Welcome to the Student Management System'
            message = f"""
            Welcome to the Student Management System!
            
            Your account has been created with the following details:
            Email: {user.email}
            Temporary Password: {temp_password}
            
            Please log in and change your password as soon as possible.
            
            Login at: {'https://bcranston.pythonanywhere.com' if settings.PRODUCTION else 'http://127.0.0.1:8000'}
            """
            
            try:
                send_mail(
                    subject,
                    message,
                    settings.DEFAULT_FROM_EMAIL,
                    [user.email],
                    fail_silently=False,
                )
            except Exception as e:
                # In development, print to console
                if not settings.PRODUCTION:
                    print(f"\n{'='*50}")
                    print(f"Welcome Email for {user.email}")
                    print(f"Temporary Password: {temp_password}")
                    print(f"{'='*50}\n")
        
        # Return user data without password
        response_serializer = UserDetailSerializer(user)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class StudentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for the requesting teacher's "my students" list.

    The list endpoint is scoped: it returns only the students on the
    requesting teacher's list (active TeacherStudent rows), which is what
    #students and every enrollment picker should see. Detail/update work for
    any student the teacher has a TeacherStudent row for (or one enrolled in
    one of their classes), so the editor keeps working after a soft removal.

    Manual creation is DISABLED (see create()): student IDs and emails are
    IT-generated, so global Student rows are only ever created by the
    Workspace directory sync (phase 3) or the Google import endpoints.

    Sync-owned fields (student_id, first_name, last_name, email,
    google_user_id, cohort, is_active) are read-only via the serializer;
    date_of_birth is the one teacher-writable global field. nickname, gender,
    and preferential_seating are per-teacher annotations stored on
    TeacherStudent.
    """
    # Base queryset lets the DRF router infer the basename; get_queryset()
    # below is what actually runs (adds per-request prefetching + scoping).
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [IsTeacher]

    def get_queryset(self):
        """
        Scope to the teacher's students and prefetch the annotations the
        serializer needs (the requesting teacher's own row for nickname/gender/
        preferential_seating, plus the class-teacher rows for the nested
        ClassRoster serializer) to avoid N+1 queries.

        - list: only active TeacherStudent rows (the teacher's "my students").
          Archived global students (Student.is_active=False) still on the list
          are included so the UI can badge them.
        - other actions: any student the teacher has a TeacherStudent row for
          (active or not) OR one enrolled in one of their classes, so the
          editor keeps working for a student removed from the list but still on
          a roster.
        """
        from django.db.models import Prefetch, Q

        user = self.request.user

        my_annotations = Prefetch(
            "teacher_annotations",
            queryset=TeacherStudent.objects.filter(teacher=user),
            to_attr="my_annotations",
        )
        roster_annotations = Prefetch(
            "enrollments__student__teacher_annotations",
            queryset=TeacherStudent.objects.all(),
            to_attr="teacher_annotations_list",
        )
        base = Student.objects.prefetch_related(
            my_annotations,
            "enrollments__class_assigned__teacher",
            roster_annotations,
        )

        if self.action == "list":
            return base.filter(
                teacher_annotations__teacher=user,
                teacher_annotations__is_active=True,
            ).distinct()

        return base.filter(
            Q(teacher_annotations__teacher=user)
            | Q(enrollments__class_assigned__teacher=user)
        ).distinct()

    def create(self, request, *args, **kwargs):
        """Manual student creation is disabled by design (#14)."""
        return Response(
            {
                "error": (
                    "Manual student creation is disabled. Students are created "
                    "by the Workspace directory sync or the Google import. Use "
                    "'Add from School List' to add an existing student to your list."
                )
            },
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(detail=False, methods=["get"], url_path="school-list")
    def school_list(self, request):
        """
        Read-only picker feed of the global (school-wide) student list.

        GET /api/students/school-list/?cohort=28

        Returns active (non-archived) global students with minimal fields plus
        an ``on_my_list`` flag for the requesting teacher, and the list of
        available cohorts with counts for the filter dropdown. Optional
        ``cohort`` query param filters the returned students (cohorts are
        always the full set so the dropdown is stable).

        Response: {
            "students": [{id, name, first_name, last_name, student_id, email,
                          cohort, on_my_list}],
            "cohorts": [{"cohort": "28", "count": 40}, ...]
        }
        """
        from django.db.models import Count

        students_qs = Student.objects.filter(is_active=True)

        # Cohorts (with counts) across the whole active list, for the dropdown.
        cohorts = [
            {"cohort": row["cohort"], "count": row["count"]}
            for row in students_qs.exclude(cohort="")
            .values("cohort")
            .annotate(count=Count("id"))
            .order_by("cohort")
        ]

        cohort = request.query_params.get("cohort")
        if cohort:
            students_qs = students_qs.filter(cohort=cohort)

        # Which of these are already on the requesting teacher's active list.
        on_my_list_ids = set(
            TeacherStudent.objects.filter(
                teacher=request.user, is_active=True
            ).values_list("student_id", flat=True)
        )

        students_qs = students_qs.order_by("last_name", "first_name")
        students = [
            {
                "id": s.id,
                "name": s.get_full_name(),
                "first_name": s.first_name,
                "last_name": s.last_name,
                "student_id": s.student_id,
                "email": s.email,
                "cohort": s.cohort,
                "on_my_list": s.id in on_my_list_ids,
            }
            for s in students_qs
        ]

        return Response({
            "students": students,
            "cohorts": cohorts,
            "last_synced": self._last_synced(),
        })

    @staticmethod
    def _last_synced():
        """Most recent Student.synced_at across the whole school, or None."""
        from django.db.models import Max

        return Student.objects.aggregate(v=Max("synced_at"))["v"]

    @action(detail=False, methods=["get"], url_path="last-synced")
    def last_synced(self, request):
        """
        Cheap read of when the Workspace directory sync last ran.

        GET /api/students/last-synced/
        Response: {"last_synced": "<ISO timestamp>" | null}
        """
        return Response({"last_synced": self._last_synced()})

    def _resolve_add_students(self, request):
        """
        Resolve the target students for an add-to-list request from
        student_ids and/or a cohort. Only active (non-archived) global
        students are eligible to be added.
        """
        from django.db.models import Q

        ids = request.data.get("student_ids") or []
        cohort = request.data.get("cohort")
        if not ids and not cohort:
            return None
        q = Q()
        if ids:
            q |= Q(id__in=ids)
        if cohort:
            q |= Q(cohort=cohort)
        return Student.objects.filter(q, is_active=True).distinct()

    @action(detail=False, methods=["post"], url_path="add-to-my-list")
    def add_to_my_list(self, request):
        """
        Add students to the requesting teacher's list by ids and/or a cohort.

        POST /api/students/add-to-my-list/
        Body: {"student_ids": [1, 2], "cohort": "28"}  (either or both)

        Creates or reactivates TeacherStudent rows for the teacher. Annotations
        are left blank - never copied from another teacher. Idempotent.

        Response: {added, reactivated, already_on_list}
        """
        students = self._resolve_add_students(request)
        if students is None:
            return Response(
                {"error": "Provide student_ids and/or a cohort."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        added = reactivated = already = 0
        for student in students:
            ts, created = TeacherStudent.objects.get_or_create(
                teacher=request.user, student=student
            )
            if created:
                added += 1
            elif not ts.is_active:
                ts.is_active = True
                ts.save(update_fields=["is_active", "updated_at"])
                reactivated += 1
            else:
                already += 1

        return Response(
            {
                "added": added,
                "reactivated": reactivated,
                "already_on_list": already,
            }
        )

    @action(detail=False, methods=["post"], url_path="remove-from-my-list")
    def remove_from_my_list(self, request):
        """
        Remove students from the requesting teacher's list by ids and/or cohort.

        POST /api/students/remove-from-my-list/
        Body: {"student_ids": [1, 2], "cohort": "28"}  (either or both)

        Soft-deactivates the teacher's TeacherStudent rows (is_active=False).
        This ONLY hides the students from the teacher's list - it never touches
        ClassRoster, seating, or attendance, and roster displays keep resolving
        annotations through the (now inactive) row. Idempotent.

        Response: {removed}
        """
        from django.db.models import Q

        ids = request.data.get("student_ids") or []
        cohort = request.data.get("cohort")
        if not ids and not cohort:
            return Response(
                {"error": "Provide student_ids and/or a cohort."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        q = Q()
        if ids:
            q |= Q(student_id__in=ids)
        if cohort:
            q |= Q(student__cohort=cohort)

        removed = TeacherStudent.objects.filter(
            q, teacher=request.user, is_active=True
        ).update(is_active=False)

        return Response({"removed": removed})

    GENDER_MAP = {
        "m": "male", "male": "male",
        "f": "female", "female": "female",
        "o": "other", "other": "other",
        "-": None,  # explicit clear back to Not set
    }
    BULK_HEADER_SYNONYMS = {
        "student_id": "student_id", "id": "student_id",
        "email": "email",
        "nickname": "nickname",
        "gender": "gender",
    }

    @action(detail=False, methods=["post"], url_path="bulk-update-info")
    def bulk_update_info(self, request):
        """
        Bulk-update nickname/gender from pasted CSV or TSV text.

        POST /api/students/bulk-update-info/
        Body: {"text": "<pasted rows with header>", "apply": bool}

        Header row (case-insensitive): student_id (or id), email, nickname,
        gender - at least one identifier column required. Rows match by
        student_id first, then email (case-insensitive). Only non-empty cells
        change anything; a literal "-" in gender clears it to Not set.
        apply=false is a dry run.

        Response: {applied, updated: [{id, name, changes}], not_found,
                   invalid, unchanged, conflicts}
        """
        from django.db import transaction

        text = request.data.get("text") or ""
        apply_changes = bool(request.data.get("apply"))

        lines = [line for line in text.splitlines() if line.strip()]
        if len(lines) < 2:
            return Response(
                {"error": "Paste a header row plus at least one data row."}, status=400
            )

        delimiter = "\t" if "\t" in lines[0] else ","
        header_cells = [c.strip().lstrip("﻿").lower() for c in lines[0].split(delimiter)]
        columns = {}
        for idx, cell in enumerate(header_cells):
            field = self.BULK_HEADER_SYNONYMS.get(cell)
            if field and field not in columns:
                columns[field] = idx

        if "student_id" not in columns and "email" not in columns:
            return Response(
                {"error": "Header must include a student_id (or id) or email column."},
                status=400,
            )
        if "nickname" not in columns and "gender" not in columns:
            return Response(
                {"error": "Header must include a nickname or gender column."}, status=400
            )

        updated, not_found, invalid, unchanged, conflicts = [], [], [], [], []
        pending = []  # (student, changes)

        for line_number, line in enumerate(lines[1:], start=2):
            cells = [c.strip() for c in line.split(delimiter)]

            def cell(field):
                idx = columns.get(field)
                return cells[idx] if idx is not None and idx < len(cells) else ""

            row_student_id = cell("student_id")
            row_email = cell("email")
            if not row_student_id and not row_email:
                invalid.append({"line": line_number, "reason": "No student_id or email in row"})
                continue

            # Match by student_id first, then email
            student = None
            if row_student_id:
                student = Student.objects.filter(student_id=row_student_id).first()
            email_match = (
                Student.objects.filter(email__iexact=row_email).first() if row_email else None
            )
            if student is None:
                student = email_match
            elif email_match and email_match.id != student.id:
                conflicts.append({
                    "line": line_number,
                    "reason": (
                        f"student_id {row_student_id} and email {row_email} are different "
                        f"students - matched by student_id"
                    ),
                })

            if not student:
                not_found.append({
                    "line": line_number,
                    "value": row_student_id or row_email,
                })
                continue

            # Nickname/gender are per-teacher annotations; compare against and
            # write to the requesting teacher's TeacherStudent row. The current
            # nickname is the annotation's value if set, else the student's
            # first name (the display fallback).
            annotation = TeacherStudent.objects.filter(
                teacher=request.user, student=student
            ).first()
            current_nickname = (
                annotation.nickname
                if annotation and annotation.nickname and annotation.nickname.strip()
                else student.first_name
            )
            current_gender = annotation.gender if annotation else None

            changes = {}
            nickname = cell("nickname")
            if nickname and nickname != current_nickname:
                changes["nickname"] = {"from": current_nickname, "to": nickname[:30]}

            raw_gender = cell("gender")
            if raw_gender:
                if raw_gender.lower() not in self.GENDER_MAP:
                    invalid.append({
                        "line": line_number,
                        "reason": f"Invalid gender value '{raw_gender}' (use m/f/o or - to clear)",
                    })
                    continue
                new_gender = self.GENDER_MAP[raw_gender.lower()]
                if new_gender != current_gender:
                    changes["gender"] = {"from": current_gender, "to": new_gender}

            name = f"{student.first_name} {student.last_name}"
            if not changes:
                unchanged.append(name)
                continue

            pending.append((student, changes))
            updated.append({"id": student.id, "name": name, "changes": changes})

        if apply_changes and pending:
            with transaction.atomic():
                for student, changes in pending:
                    defaults = {}
                    if "nickname" in changes:
                        defaults["nickname"] = changes["nickname"]["to"]
                    if "gender" in changes:
                        defaults["gender"] = changes["gender"]["to"]
                    TeacherStudent.objects.update_or_create(
                        teacher=request.user, student=student, defaults=defaults
                    )

        return Response({
            "applied": apply_changes,
            "updated": updated,
            "not_found": not_found,
            "invalid": invalid,
            "unchanged": unchanged,
            "conflicts": conflicts,
        })


def derive_partner_signal(pref_ab, pref_ba):
    """Derive a symmetric pairing signal for one unordered student pair (A, B).

    ``pref_ab`` is A's self-reported preference about B (+1 / -1 / None-if-absent);
    ``pref_ba`` is B's preference about A. Returns one of:

        +2  both chose +1 (strong pair)
        +1  exactly one chose +1, the other is absent (good pair)
        -1  any -1 present (do-not-pair / avoid) - this DOMINATES a +1
        None  neither expressed anything

    Note the derived signal is CAPPED at -1: student input can never produce a
    hard -2 ("Never Together"), which stays teacher-only. See GH issue #16 ph3.
    """
    has_negative = pref_ab == -1 or pref_ba == -1
    if has_negative:
        return -1
    positives = (1 if pref_ab == 1 else 0) + (1 if pref_ba == 1 else 0)
    if positives == 2:
        return 2
    if positives == 1:
        return 1
    return None


class ClassViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing classes.
    
    Teachers can only see and manage their own classes.
    Superusers still follow the same ownership rules.
    
    Standard Operations:
        - GET /api/classes/ - List user's classes
        - POST /api/classes/ - Create new class (auto-assigns current user as teacher)
        - GET /api/classes/{id}/ - Get class details with roster
        - PUT/PATCH /api/classes/{id}/ - Update class information
        - DELETE /api/classes/{id}/ - Delete class (cascades to related data)
    
    Required Fields:
        - name: Class name (CharField)
        - subject: Subject being taught (CharField)
        - teacher: Auto-assigned to current user on creation
    
    Optional Fields:
        - grade_level: Grade level of the class
        - description: Additional class description
        - classroom_layout: FK to ClassroomLayout for seating arrangement
    
    Special Behaviors:
        - Roster automatically filtered to show only active students (is_active=True)
        - Deleting a class cascades to all related seating periods and assignments
        - Layout assignment enables seating chart functionality
    """
    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    permission_classes = [IsTeacher]

    def get_serializer_class(self):
        """Use lightweight serializer for list view"""
        if self.action == 'list':
            return ClassListSerializer
        return ClassSerializer

    def get_queryset(self):
        """Filter to show only classes where the user is the teacher"""
        # All users (including superusers) only see their own classes
        base_qs = Class.objects.filter(teacher=self.request.user)

        # For list action, no heavy prefetching - just an efficient student
        # count computed in the same query (the current_enrollment model
        # property would otherwise fire a COUNT query per class)
        if self.action == 'list':
            return base_qs.annotate(
                student_count=models.Count(
                    "roster", filter=models.Q(roster__is_active=True)
                )
            )

        # For detail/other actions, prefetch related data
        return base_qs.select_related(
            'teacher',
            'classroom_layout',
        ).prefetch_related(
            'roster__student',
            'seating_periods__layout',
            'seating_periods__seating_assignments__roster_entry__student',
        )
    
    def perform_create(self, serializer):
        """Auto-set the teacher to the current user when creating a class"""
        serializer.save(teacher=self.request.user)

    @action(detail=True, methods=["get"])
    def seating_chart(self, request, pk=None):
        """
        Get the current seating chart for this class.
        
        Returns the complete seating arrangement including:
        - Layout information (tables, seats, obstacles)
        - Current seating period details
        - All student assignments with their positions
        
        Returns:
            200: Seating chart data with layout and assignments
            404: No seating chart available (needs layout and active period)
        """
        class_obj = self.get_object()
        chart = class_obj.get_current_seating_chart()

        if chart:
            return Response(chart)
        else:
            return Response(
                {"error": "No seating chart available. Class needs a layout and active seating period."},
                status=status.HTTP_404_NOT_FOUND,
            )

    @action(detail=True, methods=["get"], url_path="validate-seat/(?P<seat_id>[^/.]+)")
    def validate_seat(self, request, pk=None, seat_id=None):
        """
        Validate if a seat ID exists in the class layout.
        
        Args:
            seat_id: Seat identifier in format "tableNumber-seatNumber" (e.g., "1-2")
        
        Returns:
            200: {"valid": true/false, "message": "explanation"}
        
        Used by frontend to validate seat assignments before saving.
        """
        class_obj = self.get_object()

        if not class_obj.classroom_layout:
            return Response({"valid": False, "message": "No layout assigned"})

        try:
            table_num, seat_num = seat_id.split("-")
            table = class_obj.classroom_layout.tables.filter(table_number=table_num).first()
            seat = table.seats.filter(seat_number=seat_num).first() if table else None

            if seat:
                return Response({"valid": True, "message": "Seat exists"})
            else:
                return Response({"valid": False, "message": "Seat not found"})
        except:
            return Response({"valid": False, "message": "Invalid seat ID format"})

    @action(detail=True, methods=["get"], url_path="partnership-history")
    def partnership_history(self, request, pk=None):
        """
        Get historical seating partnerships for all students.
        
        Analyzes completed seating periods (end_date != null) to track
        which students have sat together at the same table.
        
        Returns:
            200: {
                "class_id": int,
                "partnership_data": {
                    "student_id": {
                        "name": "First Last",
                        "is_active": bool,
                        "partnerships": {
                            "partner_id": ["2024-01-15", "2024-02-20", ...]
                        }
                    }
                }
            }
        
        Used by the seating optimizer to avoid repeat partnerships.
        """
        class_obj = self.get_object()
        
        # Get all completed tracked seating periods (end_date is not null).
        # Untracked one-off charts are excluded from partnership history.
        completed_periods = SeatingPeriod.objects.filter(
            class_assigned=class_obj,
            end_date__isnull=False,
            is_tracked=True,
        ).order_by('end_date')
        
        if not completed_periods.exists():
            return Response({
                "class_id": class_obj.id,
                "partnership_data": {}
            })
        
        # Build partnership data structure
        partnership_data = {}

        # Pre-fetch active student IDs (fixes N+1 query)
        active_student_ids = set(
            ClassRoster.objects.filter(
                class_assigned=class_obj,
                is_active=True
            ).values_list('student_id', flat=True)
        )

        # Process each completed period
        for period in completed_periods:
            period_end_date = period.end_date.strftime("%Y-%m-%d")
            
            # Get all assignments for this period, grouped by table
            assignments = SeatingAssignment.objects.filter(
                seating_period=period
            ).select_related('roster_entry__student')
            
            # Group assignments by table
            table_groups = {}
            for assignment in assignments:
                table_num = assignment.table_number
                if table_num not in table_groups:
                    table_groups[table_num] = []
                table_groups[table_num].append(assignment)
            
            # Process each table to find partnerships
            for table_num, table_assignments in table_groups.items():
                # For each pair of students at the same table
                for i in range(len(table_assignments)):
                    for j in range(i + 1, len(table_assignments)):
                        student1 = table_assignments[i].roster_entry.student
                        student2 = table_assignments[j].roster_entry.student
                        
                        # Initialize student1 data if not exists
                        if str(student1.id) not in partnership_data:
                            partnership_data[str(student1.id)] = {
                                "name": f"{student1.first_name} {student1.last_name}",
                                "is_active": student1.id in active_student_ids,
                                "partnerships": {}
                            }

                        # Initialize student2 data if not exists
                        if str(student2.id) not in partnership_data:
                            partnership_data[str(student2.id)] = {
                                "name": f"{student2.first_name} {student2.last_name}",
                                "is_active": student2.id in active_student_ids,
                                "partnerships": {}
                            }
                        
                        # Add partnership for student1 -> student2
                        if str(student2.id) not in partnership_data[str(student1.id)]["partnerships"]:
                            partnership_data[str(student1.id)]["partnerships"][str(student2.id)] = []
                        if period_end_date not in partnership_data[str(student1.id)]["partnerships"][str(student2.id)]:
                            partnership_data[str(student1.id)]["partnerships"][str(student2.id)].append(period_end_date)
                        
                        # Add partnership for student2 -> student1
                        if str(student1.id) not in partnership_data[str(student2.id)]["partnerships"]:
                            partnership_data[str(student2.id)]["partnerships"][str(student1.id)] = []
                        if period_end_date not in partnership_data[str(student2.id)]["partnerships"][str(student1.id)]:
                            partnership_data[str(student2.id)]["partnerships"][str(student1.id)].append(period_end_date)
        
        return Response({
            "class_id": class_obj.id,
            "partnership_data": partnership_data
        })
    
    @action(detail=True, methods=["get", "post"], url_path="partnership-ratings")
    def partnership_ratings(self, request, pk=None):
        """
        Manage teacher partnership preferences for student pairs.
        
        GET: Returns rating grid for all active students
            Response: {
                "class_id": int,
                "students": [{"id": int, "name": str, "nickname": str}, ...],
                "grid": {
                    "student_id": {
                        "student_name": str,
                        "ratings": {"partner_id": rating, ...}
                    }
                }
            }
        
        POST: Set single partnership rating
            Body: {
                "student1_id": int,
                "student2_id": int,
                "rating": int  # -2 to 2
            }
        
        Rating Scale:
            -2: Never Together (hard constraint)
            -1: Avoid if Possible
             0: Neutral (default)
             1: Good Partnership
             2: Best Partnership
        """
        class_obj = self.get_object()
        
        if request.method == "GET":
            # Get all active students in the class
            roster_entries = ClassRoster.objects.filter(
                class_assigned=class_obj,
                is_active=True
            ).select_related('student')
            
            students = [entry.student for entry in roster_entries]
            student_ids = [s.id for s in students]
            student_by_id = {s.id: s for s in students}

            # Resolve nicknames through the class teacher's annotations (one
            # query), falling back to first_name.
            nickname_by_student = {
                ts.student_id: ts.nickname
                for ts in TeacherStudent.objects.filter(
                    teacher=class_obj.teacher, student_id__in=student_ids
                )
                if ts.nickname and ts.nickname.strip()
            }

            # Get all existing ratings for this class
            ratings = PartnershipRating.objects.filter(
                class_assigned=class_obj,
                student1__in=student_ids,
                student2__in=student_ids
            )

            # Build lookup dict from fetched ratings (fixes N+1 query)
            ratings_lookup = {}
            for r in ratings:
                key = (min(r.student1_id, r.student2_id), max(r.student1_id, r.student2_id))
                ratings_lookup[key] = r.rating

            # Build grid data structure
            grid_data = {}
            for s1 in students:
                grid_data[s1.id] = {
                    'student_name': f"{s1.first_name} {s1.last_name}",
                    'ratings': {}
                }
                for s2 in students:
                    if s1.id != s2.id:
                        # Get rating from lookup (order-independent key)
                        key = (min(s1.id, s2.id), max(s1.id, s2.id))
                        rating_value = ratings_lookup.get(key, 0)
                        grid_data[s1.id]['ratings'][s2.id] = rating_value

            # --- Phase 3: derived student pairing signals + conflicts ---
            # (GH issue #16). Derive a per-pair signal from THIS class's
            # StudentPartnerPreference rows, surface teacher/student conflicts,
            # and expose an effective_grid the seating tools should consume.
            student_id_set = set(student_ids)

            # Display name (nickname fallback to first_name) for detail strings.
            def _disp(sid):
                s = student_by_id.get(sid)
                if not s:
                    return "A student"
                return nickname_by_student.get(sid) or s.first_name

            # prefs[(chooser_id, target_id)] = preference (+1 / -1)
            prefs = {}
            for p in StudentPartnerPreference.objects.filter(
                class_assigned=class_obj,
                student_id__in=student_id_set,
                target_id__in=student_id_set,
            ):
                prefs[(p.student_id, p.target_id)] = p.preference

            # Symmetric signal map mirroring grid's "ratings" shape. Only pairs
            # with a derived signal are emitted (both directions).
            student_signals = {}
            # signal_lookup[(lo, hi)] = derived signal for effective_grid merge.
            signal_lookup = {}
            conflicts = []
            seen_pairs = set()

            for a in student_ids:
                for b in student_ids:
                    if a >= b:
                        continue
                    pair = (a, b)
                    if pair in seen_pairs:
                        continue
                    seen_pairs.add(pair)

                    pref_ab = prefs.get((a, b))  # A chose about B
                    pref_ba = prefs.get((b, a))  # B chose about A
                    signal = derive_partner_signal(pref_ab, pref_ba)
                    if signal is None:
                        continue

                    signal_lookup[pair] = signal
                    student_signals.setdefault(a, {})[b] = signal
                    student_signals.setdefault(b, {})[a] = signal

                    # Conflict detection against the teacher rating.
                    teacher_rating = ratings_lookup.get(pair, 0)

                    # Who chose the other +1 (case a) / -1 (case b), by direction.
                    chose_pos = []  # list of (chooser, other)
                    if pref_ab == 1:
                        chose_pos.append((a, b))
                    if pref_ba == 1:
                        chose_pos.append((b, a))
                    chose_neg = []
                    if pref_ab == -1:
                        chose_neg.append((a, b))
                    if pref_ba == -1:
                        chose_neg.append((b, a))

                    detail = None
                    if teacher_rating in (-1, -2) and chose_pos:
                        marker = (
                            "Never Together" if teacher_rating == -2
                            else "Avoid if Possible"
                        )
                        if len(chose_pos) == 2:
                            phrase = (
                                f"{_disp(a)} and {_disp(b)} chose each other "
                                "as good partners"
                            )
                        else:
                            chooser, other = chose_pos[0]
                            phrase = (
                                f"{_disp(chooser)} chose {_disp(other)} "
                                "as a good partner"
                            )
                        detail = f"{phrase}, but you have them marked {marker}"
                    elif teacher_rating == 2 and chose_neg:
                        if len(chose_neg) == 2:
                            phrase = (
                                f"{_disp(a)} and {_disp(b)} both chose "
                                "not to work together"
                            )
                        else:
                            chooser, other = chose_neg[0]
                            phrase = (
                                f"{_disp(chooser)} chose not to work "
                                f"with {_disp(other)}"
                            )
                        detail = (
                            f"{phrase}, but you have them marked Best Partnership"
                        )

                    if detail:
                        conflicts.append({
                            'student1_id': a,
                            'student2_id': b,
                            'student1_name': f"{student_by_id[a].first_name} "
                                             f"{student_by_id[a].last_name}",
                            'student2_name': f"{student_by_id[b].first_name} "
                                             f"{student_by_id[b].last_name}",
                            'teacher_rating': teacher_rating,
                            'student_signal': signal,
                            'detail': detail,
                        })

            # effective_grid: teacher rating where non-zero, else derived
            # student signal, else 0. Same nested shape as grid. Student signals
            # are capped at -1, so a -2 here always originates from the teacher.
            effective_grid = {}
            for s1 in students:
                effective_grid[s1.id] = {}
                for s2 in students:
                    if s1.id == s2.id:
                        continue
                    pair = (min(s1.id, s2.id), max(s1.id, s2.id))
                    teacher_rating = ratings_lookup.get(pair, 0)
                    if teacher_rating != 0:
                        effective_grid[s1.id][s2.id] = teacher_rating
                    else:
                        effective_grid[s1.id][s2.id] = signal_lookup.get(pair, 0)

            return Response({
                'class_id': class_obj.id,
                'students': [
                    {
                        'id': s.id,
                        'name': f"{s.first_name} {s.last_name}",
                        'nickname': nickname_by_student.get(s.id) or s.first_name
                    } for s in students
                ],
                'grid': grid_data,
                'student_signals': student_signals,
                'conflicts': conflicts,
                'effective_grid': effective_grid,
            })
        
        elif request.method == "POST":
            # Set a single rating
            student1_id = request.data.get('student1_id')
            student2_id = request.data.get('student2_id')
            rating_value = request.data.get('rating', 0)
            notes = request.data.get('notes', '')
            
            try:
                student1 = Student.objects.get(id=student1_id)
                student2 = Student.objects.get(id=student2_id)
                
                # Verify students are in this class
                if not ClassRoster.objects.filter(
                    class_assigned=class_obj,
                    student=student1,
                    is_active=True
                ).exists():
                    return Response(
                        {"error": f"Student {student1_id} is not in this class"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                if not ClassRoster.objects.filter(
                    class_assigned=class_obj,
                    student=student2,
                    is_active=True
                ).exists():
                    return Response(
                        {"error": f"Student {student2_id} is not in this class"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Set the rating
                rating_obj = PartnershipRating.set_rating(
                    class_assigned=class_obj,
                    student1=student1,
                    student2=student2,
                    rating=rating_value,
                    created_by=request.user,
                    notes=notes
                )
                
                from .serializers import PartnershipRatingSerializer
                serializer = PartnershipRatingSerializer(rating_obj)
                return Response(serializer.data)
                
            except Student.DoesNotExist:
                return Response(
                    {"error": "Invalid student ID"},
                    status=status.HTTP_400_BAD_REQUEST
                )
    
    @action(detail=True, methods=["post"], url_path="bulk-update-ratings")
    def bulk_update_ratings(self, request, pk=None):
        """
        Bulk update multiple partnership ratings at once.
        
        Efficiently updates multiple partnership ratings in a single request.
        Used by the partnership rating grid UI to save all changes at once.
        
        Request Body:
            {
                "ratings": [
                    {
                        "student1_id": int,
                        "student2_id": int,
                        "rating": int  # -2 to 2
                    },
                    ...
                ]
            }
        
        Returns:
            200: {
                "message": "Updated N partnership ratings",
                "updated_count": int
            }
            400: Validation errors
        
        Note: Automatically handles student ID ordering (lower ID always student1)
        """
        class_obj = self.get_object()
        
        from .serializers import BulkPartnershipRatingSerializer
        serializer = BulkPartnershipRatingSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        ratings_data = serializer.validated_data['ratings']
        updated_ratings = []
        errors = []
        
        for rating_data in ratings_data:
            try:
                student1 = Student.objects.get(id=rating_data['student1_id'])
                student2 = Student.objects.get(id=rating_data['student2_id'])
                
                # Verify both students are in this class
                if not ClassRoster.objects.filter(
                    class_assigned=class_obj,
                    student__in=[student1, student2],
                    is_active=True
                ).count() == 2:
                    errors.append({
                        'student1_id': rating_data['student1_id'],
                        'student2_id': rating_data['student2_id'],
                        'error': 'One or both students not in class'
                    })
                    continue
                
                # Set the rating
                rating_obj = PartnershipRating.set_rating(
                    class_assigned=class_obj,
                    student1=student1,
                    student2=student2,
                    rating=rating_data['rating'],
                    created_by=request.user,
                    notes=rating_data.get('notes', '')
                )
                
                updated_ratings.append({
                    'student1_id': min(student1.id, student2.id),
                    'student2_id': max(student1.id, student2.id),
                    'rating': rating_obj.rating
                })
                
            except Student.DoesNotExist:
                errors.append({
                    'student1_id': rating_data.get('student1_id'),
                    'student2_id': rating_data.get('student2_id'),
                    'error': 'Invalid student ID'
                })
        
        return Response({
            'updated': updated_ratings,
            'errors': errors,
            'total_updated': len(updated_ratings),
            'total_errors': len(errors)
        })


class ClassRosterViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing class roster entries (student enrollments).
    
    Handles the many-to-many relationship between Students and Classes.
    Teachers can only manage rosters for their own classes.
    
    Standard Operations:
        - GET /api/roster/ - List roster entries with filtering
        - POST /api/roster/ - Enroll a student in a class
        - GET /api/roster/{id}/ - Get roster entry details
        - PUT/PATCH /api/roster/{id}/ - Update roster entry
        - DELETE /api/roster/{id}/ - Remove student from class (soft delete)
    
    Filtering:
        - ?student={id} - Filter by student ID
        - ?class_assigned={id} - Filter by class ID
        - ?is_active={true/false} - Filter by active status
    
    Important Fields:
        - student: FK to Student (required)
        - class_assigned: FK to Class (required)
        - is_active: Soft delete flag (default: True)
        - enrollment_date: Auto-set on creation
        - attendance_notes: Optional notes about the student
    
    Special Behaviors:
        - Soft delete: DELETE sets is_active=False, preserving history
        - Re-enrollment: Creating duplicate entry reactivates existing if inactive
        - Flattened response includes student fields (student_first_name, etc.)
        - Seating assignments and attendance records linked via roster entry
    """
    queryset = ClassRoster.objects.all()
    serializer_class = ClassRosterSerializer
    permission_classes = [IsTeacher]
    filter_backends = [DjangoFilterBackend]  # Enable the filter backend
    filterset_fields = ['student', 'class_assigned', 'is_active']  # Enable filtering

    def get_queryset(self):
        """Filter roster entries to only show those for user's classes"""
        from django.db.models import Prefetch

        # All users (including superusers) only see their own class rosters.
        # Prefetch the class teacher's annotations so the serializer resolves
        # nickname/gender/preferential_seating without N+1 queries.
        annotation_prefetch = Prefetch(
            "student__teacher_annotations",
            queryset=TeacherStudent.objects.filter(teacher=self.request.user),
            to_attr="teacher_annotations_list",
        )
        return (
            ClassRoster.objects.filter(class_assigned__teacher=self.request.user)
            .select_related("student", "class_assigned", "class_assigned__teacher")
            .prefetch_related(annotation_prefetch)
        )


@api_view(["GET"])
@permission_classes([IsTeacher])
def dashboard_stats(request):
    """
    Lightweight counts for the dashboard stat cards.

    Replaces the frontend fetching the full /students/ and /layouts/ lists
    just to count them - three COUNT queries instead of two full payloads.
    Layout count mirrors ClassroomLayoutViewSet filtering (own, active only);
    student counts are scoped to the requesting teacher's "my students" list so
    they match the #students page (active TeacherStudent rows). total_students
    is that whole list; active_students excludes archived global students.
    """
    my_students = TeacherStudent.objects.filter(
        teacher=request.user, is_active=True
    )
    return Response({
        "active_students": my_students.filter(student__is_active=True).count(),
        "total_students": my_students.count(),
        "layouts": ClassroomLayout.objects.filter(
            created_by=request.user, is_active=True
        ).count(),
    })


# ============================================================================
# Student partner survey (GH issue #16 phase 2) - the ONLY endpoints a student
# account may reach. Gated by IsStudent (teacher/admin JWTs 403 here).
# ============================================================================

# Server-enforced caps on how many classmates a student may pick per direction.
PARTNER_SURVEY_POSITIVE_CAP = 5
PARTNER_SURVEY_NEGATIVE_CAP = 3


def _survey_classmates(klass, student):
    """Active roster minus the requester, ordered by last then first name.

    Uses the GLOBAL Student first/last name only - never teacher nicknames or
    any teacher rating data (those are the teacher's private annotations).
    """
    rosters = (
        klass.roster.filter(is_active=True)
        .exclude(student_id=student.id)
        .select_related("student")
        .order_by("student__last_name", "student__first_name")
    )
    return [
        {
            "id": r.student.id,
            "first_name": r.student.first_name,
            "last_name": r.student.last_name,
        }
        for r in rosters
    ]


def _survey_open_payload(klass, student):
    """The full "open" response shape shared by GET and a successful POST."""
    choices = [
        {"target_id": p.target_id, "preference": p.preference}
        for p in StudentPartnerPreference.objects.filter(
            class_assigned=klass, student=student
        )
    ]
    return {
        "open": True,
        "class_name": klass.name,
        "caps": {
            "positive": PARTNER_SURVEY_POSITIVE_CAP,
            "negative": PARTNER_SURVEY_NEGATIVE_CAP,
        },
        "classmates": _survey_classmates(klass, student),
        "choices": choices,
    }


def _survey_window_state(klass):
    """Return None if the survey is open, else a (reason) string closed state."""
    from django.utils import timezone

    if not klass.survey_enabled:
        return "not_enabled"
    now = timezone.now()
    if klass.survey_opens_at and now < klass.survey_opens_at:
        return "not_yet_open"
    if klass.survey_closes_at and now > klass.survey_closes_at:
        return "closed"
    return None


@api_view(["GET", "POST"])
@permission_classes([IsStudent])
def my_partners(request, class_id):
    """
    Student partner survey for one class.

    GET  -> the survey state for the requesting student (open shape or a
            friendly {open: false, reason} when disabled / outside the window).
    POST -> full-replace the student's choices (subject to caps/validation).

    Gate order: the requesting user's linked Student MUST be on the class's
    ACTIVE roster, else 404 (don't reveal the class exists to non-members).
    """
    from rest_framework import status as drf_status

    student = request.user.student

    # Roster gate: a non-member (or a nonexistent class) is indistinguishable -
    # both yield 404 so we never leak that the class exists.
    roster_entry = (
        ClassRoster.objects.filter(
            class_assigned_id=class_id, student=student, is_active=True
        )
        .select_related("class_assigned")
        .first()
    )
    if roster_entry is None:
        return Response({"detail": "Not found."}, status=drf_status.HTTP_404_NOT_FOUND)

    klass = roster_entry.class_assigned
    closed_reason = _survey_window_state(klass)

    if request.method == "GET":
        if closed_reason is not None:
            return Response(
                {"open": False, "reason": closed_reason, "class_name": klass.name}
            )
        return Response(_survey_open_payload(klass, student))

    # POST - a disabled/closed survey rejects writes entirely.
    if closed_reason is not None:
        return Response(
            {"open": False, "reason": closed_reason, "class_name": klass.name},
            status=drf_status.HTTP_403_FORBIDDEN,
        )

    choices = request.data.get("choices", [])
    if not isinstance(choices, list):
        return Response(
            {"detail": "choices must be a list."},
            status=drf_status.HTTP_400_BAD_REQUEST,
        )

    # Valid targets = active roster of this class, excluding the requester.
    valid_target_ids = set(
        klass.roster.filter(is_active=True)
        .exclude(student_id=student.id)
        .values_list("student_id", flat=True)
    )

    cleaned = []
    seen_targets = set()
    positive = 0
    negative = 0
    for item in choices:
        if not isinstance(item, dict):
            return Response(
                {"detail": "Each choice must be an object with target_id and preference."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        target_id = item.get("target_id")
        preference = item.get("preference")
        if preference not in (1, -1):
            return Response(
                {"detail": f"Invalid preference {preference!r}; must be 1 or -1."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        if target_id == student.id:
            return Response(
                {"detail": "You cannot pick yourself."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        if target_id in seen_targets:
            return Response(
                {"detail": f"Duplicate choice for target {target_id}."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        if target_id not in valid_target_ids:
            return Response(
                {"detail": f"Target {target_id} is not a classmate in this class."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        seen_targets.add(target_id)
        if preference == 1:
            positive += 1
        else:
            negative += 1
        cleaned.append((target_id, preference))

    if positive > PARTNER_SURVEY_POSITIVE_CAP:
        return Response(
            {"detail": f"You may pick at most {PARTNER_SURVEY_POSITIVE_CAP} classmates you work well with."},
            status=drf_status.HTTP_400_BAD_REQUEST,
        )
    if negative > PARTNER_SURVEY_NEGATIVE_CAP:
        return Response(
            {"detail": f"You may pick at most {PARTNER_SURVEY_NEGATIVE_CAP} classmates you don't work well with."},
            status=drf_status.HTTP_400_BAD_REQUEST,
        )

    from django.db import transaction

    with transaction.atomic():
        # Full-replace semantics: drop rows not in the payload, upsert the rest.
        StudentPartnerPreference.objects.filter(
            class_assigned=klass, student=student
        ).exclude(target_id__in=seen_targets).delete()
        for target_id, preference in cleaned:
            StudentPartnerPreference.objects.update_or_create(
                class_assigned=klass,
                student=student,
                target_id=target_id,
                defaults={"preference": preference},
            )

    return Response(_survey_open_payload(klass, student))


# Layout ViewSets


class ClassroomLayoutViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing classroom layouts.
    
    Users can only see and manage their own layouts.
    Layouts define the physical arrangement of tables, seats, and obstacles.
    
    Standard Operations:
        - GET /api/layouts/ - List user's active layouts
        - POST /api/layouts/ - Create new layout
        - GET /api/layouts/{id}/ - Get layout details with tables/seats/obstacles
        - PUT/PATCH /api/layouts/{id}/ - Update layout
        - DELETE /api/layouts/{id}/ - Soft delete layout (sets is_active=False)
    
    Required Fields:
        - name: Layout name (CharField)
        - room_width: Width in pixels (IntegerField)
        - room_height: Height in pixels (IntegerField)
        - created_by: Auto-assigned to current user
    
    Optional Fields:
        - description: Layout description (TextField)
        - is_template: Flag for reusable templates (BooleanField)
        - is_active: Soft delete flag (default: True)
    
    Nested Data Structure:
        Layout contains:
        - tables[]: Array of ClassroomTable objects
            - Each table contains seats[]: Array of TableSeat objects
        - obstacles[]: Array of LayoutObstacle objects
    
    Special Behaviors:
        - Soft delete preserves layout for historical seating periods
        - Deleting layout with PROTECT relationship to SeatingPeriod will fail
        - Layout assigned to class enables seating chart functionality
    """
    serializer_class = ClassroomLayoutSerializer
    permission_classes = [IsTeacher]
    
    def get_queryset(self):
        """Filter layouts to show only those created by the current user"""
        # All users (including superusers) only see their own layouts
        # Filter out soft-deleted layouts
        # Counts feed the layouts list cards: tables only count if students
        # can sit there (>=1 seat; obstacles are a separate model), and
        # used_by_classes counts distinct classes with any seating period
        # (current or historical) on this layout. distinct=True on each
        # Count is required - the three joins otherwise multiply rows.
        return ClassroomLayout.objects.filter(
            created_by=self.request.user,
            is_active=True
        ).annotate(
            table_count=models.Count(
                "tables",
                filter=models.Q(tables__seats__isnull=False),
                distinct=True,
            ),
            seat_count=models.Count("tables__seats", distinct=True),
            used_by_classes=models.Count(
                "seating_periods_using_layout__class_assigned",
                distinct=True,
            ),
        )

    def perform_create(self, serializer):
        """Auto-assign the created_by field to current user"""
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        """Ensure created_by remains the current user"""
        serializer.save(created_by=self.request.user)
    
    def destroy(self, request, *args, **kwargs):
        """Perform soft delete instead of hard delete to preserve history"""
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"])
    def create_from_editor(self, request):
        """
        Create a complete layout from the visual layout editor.
        
        Accepts nested JSON structure with tables, seats, and obstacles.
        Used by the standalone layout editor at /layout-editor/.
        
        Request Body:
            {
                "name": str,
                "description": str,
                "room_width": int,
                "room_height": int,
                "tables": [
                    {
                        "table_number": str,
                        "table_name": str,
                        "x_position": float,
                        "y_position": float,
                        "width": float,
                        "height": float,
                        "max_seats": int,
                        "table_shape": str,
                        "rotation": float,
                        "seats": [
                            {
                                "seat_number": str,
                                "relative_x": float,
                                "relative_y": float,
                                "is_accessible": bool,
                                "notes": str
                            }
                        ]
                    }
                ],
                "obstacles": [
                    {
                        "name": str,
                        "obstacle_type": str,
                        "x_position": float,
                        "y_position": float,
                        "width": float,
                        "height": float,
                        "color": str
                    }
                ]
            }
        
        Returns:
            200: Created layout with all nested data
            400: Validation error
        """
        try:
            layout_data = request.data

            layout = ClassroomLayout.objects.create(
                name=layout_data["name"],
                description=layout_data["description"],
                room_width=layout_data["room_width"],
                room_height=layout_data["room_height"],
                created_by=request.user,
            )

            # Create tables and seats
            for table_data in layout_data["tables"]:
                table = ClassroomTable.objects.create(
                    layout=layout,
                    table_number=table_data["table_number"],
                    table_name=table_data["table_name"],
                    x_position=table_data["x_position"],
                    y_position=table_data["y_position"],
                    width=table_data["width"],
                    height=table_data["height"],
                    max_seats=table_data["max_seats"],
                    table_shape=table_data["table_shape"],
                    rotation=table_data["rotation"],
                )

                for seat_data in table_data["seats"]:
                    TableSeat.objects.create(
                        table=table,
                        seat_number=seat_data["seat_number"],
                        relative_x=seat_data["relative_x"],
                        relative_y=seat_data["relative_y"],
                        is_accessible=seat_data["is_accessible"],
                        notes=seat_data.get("notes", ""),
                    )

            # Create obstacles
            for obstacle_data in layout_data["obstacles"]:
                LayoutObstacle.objects.create(
                    layout=layout,
                    name=obstacle_data["name"],
                    obstacle_type=obstacle_data["obstacle_type"],
                    x_position=obstacle_data["x_position"],
                    y_position=obstacle_data["y_position"],
                    width=obstacle_data["width"],
                    height=obstacle_data["height"],
                    color=obstacle_data["color"],
                )

            return Response(ClassroomLayoutSerializer(layout).data)

        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=["put"])
    def update_from_editor(self, request, pk=None):
        """
        Update an existing layout from the visual layout editor.
        
        Replaces all tables, seats, and obstacles with new data.
        Preserves layout ID and creation metadata.
        
        Request Body: Same structure as create_from_editor
        
        Returns:
            200: Updated layout with all nested data
            400: Validation error
        
        Warning: This completely replaces existing tables/seats/obstacles.
        """
        try:
            layout = self.get_object()  # Get the existing layout
            layout_data = request.data

            # Update basic layout properties
            layout.name = layout_data["name"]
            layout.description = layout_data["description"]
            layout.room_width = layout_data["room_width"]
            layout.room_height = layout_data["room_height"]
            layout.created_by = request.user  # Set the user
            layout.save()

            # Clear existing tables and obstacles
            layout.tables.all().delete()
            layout.obstacles.all().delete()

            # Create new tables and seats
            for table_data in layout_data["tables"]:
                table = ClassroomTable.objects.create(
                    layout=layout,
                    table_number=table_data["table_number"],
                    table_name=table_data["table_name"],
                    x_position=table_data["x_position"],
                    y_position=table_data["y_position"],
                    width=table_data["width"],
                    height=table_data["height"],
                    max_seats=table_data["max_seats"],
                    table_shape=table_data["table_shape"],
                    rotation=table_data["rotation"],
                )

                for seat_data in table_data["seats"]:
                    TableSeat.objects.create(
                        table=table,
                        seat_number=seat_data["seat_number"],
                        relative_x=seat_data["relative_x"],
                        relative_y=seat_data["relative_y"],
                        is_accessible=seat_data["is_accessible"],
                        notes=seat_data.get("notes", ""),
                    )

            # Create new obstacles
            for obstacle_data in layout_data["obstacles"]:
                LayoutObstacle.objects.create(
                    layout=layout,
                    name=obstacle_data["name"],
                    obstacle_type=obstacle_data["obstacle_type"],
                    x_position=obstacle_data["x_position"],
                    y_position=obstacle_data["y_position"],
                    width=obstacle_data["width"],
                    height=obstacle_data["height"],
                    color=obstacle_data["color"],
                )

            return Response(ClassroomLayoutSerializer(layout).data)

        except Exception as e:
            return Response({"error": str(e)}, status=400)


class ClassroomTableViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing classroom tables within layouts.
    
    Tables are physical furniture pieces that contain seats.
    Usually managed through the layout editor rather than directly.
    
    Standard CRUD Operations Available.
    
    Required Fields:
        - layout: FK to ClassroomLayout
        - table_number: Unique identifier within layout (e.g., "1", "A")
        - x_position, y_position: Position in layout (float)
        - width, height: Dimensions in pixels (float)
        - max_seats: Maximum number of seats (int)
    
    Optional Fields:
        - table_name: Display name (defaults to "Table {number}")
        - table_shape: Shape type ("rectangle", "circle", etc.)
        - rotation: Rotation angle in degrees (float)
    
    Note: Tables are typically created/updated via ClassroomLayoutViewSet's
    create_from_editor and update_from_editor actions.
    """
    queryset = ClassroomTable.objects.all()
    serializer_class = ClassroomTableSerializer
    permission_classes = [IsTeacher]


class TableSeatViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing individual seats within tables.
    
    Seats are positions where students can be assigned.
    Usually managed through the layout editor rather than directly.
    
    Standard CRUD Operations Available.
    
    Required Fields:
        - table: FK to ClassroomTable
        - seat_number: Unique identifier within table (e.g., "1", "2")
        - relative_x, relative_y: Position relative to table center (float)
    
    Optional Fields:
        - is_accessible: Wheelchair accessible flag (bool)
        - notes: Additional seat notes (text)
    
    Important:
        - Seat IDs in frontend: "tableNumber-seatNumber" (e.g., "1-2")
        - Seats can be deactivated in seating editor (shift+click)
        - Typically created via layout editor, not API directly
    """
    queryset = TableSeat.objects.all()
    serializer_class = TableSeatSerializer
    permission_classes = [IsTeacher]


class LayoutObstacleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing obstacles in classroom layouts.
    
    Obstacles represent non-seating elements like doors, columns, or equipment.
    Usually managed through the layout editor rather than directly.
    
    Standard CRUD Operations Available.
    
    Required Fields:
        - layout: FK to ClassroomLayout
        - name: Obstacle name (e.g., "Door", "Projector")
        - obstacle_type: Type category (e.g., "door", "column", "equipment")
        - x_position, y_position: Position in layout (float)
        - width, height: Dimensions in pixels (float)
    
    Optional Fields:
        - color: Display color in hex format (e.g., "#FF0000")
    
    Note: Obstacles are visual aids only and don't affect seating logic.
    Typically created via layout editor's obstacle tools.
    """
    queryset = LayoutObstacle.objects.all()
    serializer_class = LayoutObstacleSerializer
    permission_classes = [IsTeacher]


# Seating ViewSets


class SeatingPeriodViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing seating periods (time-bounded seating arrangements).
    
    Each period represents a specific seating arrangement for a class over time.
    Only one period per class can be active (end_date=None) at a time.
    
    Standard Operations:
        - GET /api/seating-periods/ - List seating periods with filtering
        - POST /api/seating-periods/ - Create new period (auto-ends previous)
        - GET /api/seating-periods/{id}/ - Get period details
        - PUT/PATCH /api/seating-periods/{id}/ - Update period
        - DELETE /api/seating-periods/{id}/ - Delete period
    
    Filtering:
        - ?class_assigned={id} - Filter by class ID
        - ?is_active={true/false} - Filter by active status (deprecated)
    
    Required Fields:
        - class_assigned: FK to Class
        - layout: FK to ClassroomLayout (PROTECT on delete)
        - name: Period name (auto-generated as "Chart N" if empty)
        - start_date: When this period begins
    
    Optional Fields:
        - end_date: When period ends (null = current period)
        - notes: Additional notes about the period
    
    Critical Behaviors:
        - Only ONE period per class can have end_date=None (current period)
        - Creating new period automatically sets end_date on previous current
        - Period navigation in UI is view-only - does NOT modify end_dates
        - Deleting layout will fail if referenced by period (PROTECT)
        - Auto-naming: Empty name becomes "Chart N" where N increments
    """
    queryset = SeatingPeriod.objects.all()
    serializer_class = SeatingPeriodSerializer
    permission_classes = [IsTeacher]
    filterset_fields = ["class_assigned", "is_active"]  # Enable filtering

    def get_queryset(self):
        """Filter periods to only show those for user's classes"""
        # All users (including superusers) only see seating periods for their own classes
        queryset = SeatingPeriod.objects.filter(
            class_assigned__teacher=self.request.user
        ).select_related(
            'class_assigned',
            'layout',
            'layout__created_by',
        ).prefetch_related(
            'seating_assignments__roster_entry__student',
            'layout__tables__seats',
            'layout__obstacles',
        )

        # Filter by class_assigned if provided in query params
        class_assigned = self.request.query_params.get("class_assigned", None)
        if class_assigned is not None:
            queryset = queryset.filter(class_assigned_id=class_assigned)

        return queryset
    
    @action(detail=True, methods=["post"])
    def make_current(self, request, pk=None):
        """
        Make this seating period the current active period for the class.
        This will end any other active periods for the same class.
        
        POST /api/seating-periods/{id}/make_current/
        
        Returns:
            - Updated seating period data
            - 400 if period is already current
            - 403 if user doesn't own the class
        """
        from datetime import date
        
        period = self.get_object()
        
        # Check if user owns the class
        if period.class_assigned.teacher != request.user:
            return Response(
                {"error": "You don't have permission to modify this seating period"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if already current (an OPEN one-off has end_date=None but is
        # NOT current - promoting it is exactly what make_current is for)
        if period.end_date is None and period.is_tracked:
            return Response(
                {"error": "This period is already the current active period"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find and end any current tracked periods for this class
        # (untracked one-off charts are left alone)
        current_periods = SeatingPeriod.objects.filter(
            class_assigned=period.class_assigned,
            end_date__isnull=True,
            is_tracked=True,
        ).exclude(id=period.id)

        today = date.today()
        for current_period in current_periods:
            current_period.end_date = today
            current_period.save(update_fields=["end_date"])

        # Make this period current by removing its end date.
        # Promoting an untracked chart makes it a real tracked period.
        period.end_date = None
        period.is_tracked = True
        period.save(update_fields=["end_date", "is_tracked"])
        
        # Return updated period data
        serializer = self.get_serializer(period)
        return Response({
            "message": f"Period '{period.name}' is now the active seating period",
            "period": serializer.data
        })

    @action(detail=False, methods=["get"])
    def previous_period(self, request):
        """
        Get the most recent completed seating period with all assignments.
        
        Used by the seating editor to copy assignments from previous period.
        
        Query Parameters:
            - class_assigned: Required class ID
        
        Returns:
            200: Previous period with all seating assignments
            404: No previous period found
            400: Missing class_assigned parameter
        """
        class_id = request.query_params.get("class_assigned")
        
        if not class_id:
            return Response({"error": "class_assigned parameter is required"}, status=400)
        
        # Get the current active tracked period (end_date is null)
        current_period = SeatingPeriod.objects.filter(
            class_assigned_id=class_id,
            end_date__isnull=True,
            is_tracked=True,
        ).first()

        if not current_period:
            return Response({"error": "No current period found"}, status=404)

        # Get the most recent completed tracked period (has end_date)
        previous_period = SeatingPeriod.objects.filter(
            class_assigned_id=class_id,
            end_date__isnull=False,
            is_tracked=True,
        ).order_by("-end_date").first()
        
        if not previous_period:
            return Response(None)  # No previous period exists
        
        # Serialize with all related data
        serializer = SeatingPeriodSerializer(previous_period)
        data = serializer.data
        
        # Add all seating assignments for this period
        assignments = SeatingAssignment.objects.filter(
            seating_period=previous_period
        ).select_related("roster_entry__student", "roster_entry__class_assigned")
        
        assignment_data = []
        for assignment in assignments:
            assignment_data.append({
                "id": assignment.id,
                "roster_entry": assignment.roster_entry.id,
                "student_id": assignment.roster_entry.student.id,
                "student_name": f"{assignment.roster_entry.student.first_name} {assignment.roster_entry.student.last_name}",
                "table_number": assignment.table_number,
                "seat_number": assignment.seat_number,
            })
        
        data["assignments"] = assignment_data

        return Response(data)

    @action(detail=False, methods=["post"], url_path="create-with-assignments")
    def create_with_assignments(self, request):
        """
        Atomically create a new tracked seating period together with its
        seating assignments.

        Backs the SeatingEditor "New Chart" draft flow (GH issue #15): New
        Period no longer writes to the DB immediately. The editor keeps the
        new chart as a client-side draft, and only this endpoint - called
        from Save - actually creates the period. Creating the period with
        end_date=None and is_tracked=True relies on SeatingPeriod.save() to
        end the previous current tracked period as part of the same call;
        wrapping everything in transaction.atomic() means a bad assignment
        rolls back the period (and the auto-ended previous period) too, so
        the previous chart is never left ended with no replacement.

        POST /api/seating-periods/create-with-assignments/
        Body: {
            "class_assigned": <id>,
            "layout": <id>,
            "name": "Chart 2",
            "start_date": "2026-07-10",
            "notes": "" (optional),
            "assignments": [{"roster_entry": <id>, "seat_id": "1-2"}, ...]
        }

        Returns:
            201: {"period": <serialized period>, "created": <assignment count>}
            400: validation error (nothing is created)
            403: class does not belong to the requesting teacher
            404: class not found
        """
        from django.core.exceptions import ValidationError as DjangoValidationError
        from django.db import IntegrityError, transaction

        class_id = request.data.get("class_assigned")
        layout_id = request.data.get("layout")
        name = request.data.get("name")
        start_date = request.data.get("start_date")
        notes = request.data.get("notes", "") or ""
        assignments_data = request.data.get("assignments", [])

        if not class_id or not layout_id or not name or not start_date:
            return Response(
                {"error": "class_assigned, layout, name, and start_date are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(assignments_data, list):
            return Response(
                {"error": "assignments must be a list"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            class_obj = Class.objects.get(id=class_id)
        except Class.DoesNotExist:
            return Response({"error": "Class not found"}, status=status.HTTP_404_NOT_FOUND)

        if class_obj.teacher != request.user:
            return Response(
                {"error": "You don't have permission to modify this class"},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            layout_obj = ClassroomLayout.objects.get(id=layout_id)
        except ClassroomLayout.DoesNotExist:
            return Response({"error": "Layout not found"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                period = SeatingPeriod(
                    class_assigned=class_obj,
                    layout=layout_obj,
                    name=name,
                    start_date=start_date,
                    end_date=None,
                    is_tracked=True,
                    notes=notes,
                )
                period.full_clean()
                period.save()  # auto-ends the previous current tracked period

                created_count = 0
                for item in assignments_data:
                    roster_entry_id = item.get("roster_entry")
                    seat_id = item.get("seat_id")
                    if not roster_entry_id or not seat_id:
                        raise DjangoValidationError(
                            "Each assignment needs roster_entry and seat_id"
                        )
                    try:
                        roster_entry = ClassRoster.objects.get(
                            id=roster_entry_id, class_assigned=class_obj
                        )
                    except ClassRoster.DoesNotExist:
                        raise DjangoValidationError(
                            f"roster_entry {roster_entry_id} does not belong to this class"
                        )
                    assignment = SeatingAssignment(
                        seating_period=period,
                        roster_entry=roster_entry,
                        seat_id=seat_id,
                    )
                    assignment.full_clean()
                    assignment.save()
                    created_count += 1
        except (DjangoValidationError, IntegrityError) as e:
            if hasattr(e, "message_dict"):
                detail = "; ".join(
                    f"{field}: {', '.join(msgs) if isinstance(msgs, list) else msgs}"
                    for field, msgs in e.message_dict.items()
                )
            elif hasattr(e, "messages"):
                detail = "; ".join(e.messages)
            else:
                detail = str(e)
            return Response({"error": detail}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(period)
        return Response(
            {"period": serializer.data, "created": created_count},
            status=status.HTTP_201_CREATED,
        )


class SeatingAssignmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing individual student seat assignments.
    
    Links students (via roster entries) to specific seats in a seating period.
    Each assignment places one student at one table/seat combination.
    
    Standard Operations:
        - GET /api/seating-assignments/ - List assignments with filtering
        - POST /api/seating-assignments/ - Create new assignment
        - GET /api/seating-assignments/{id}/ - Get assignment details
        - PUT/PATCH /api/seating-assignments/{id}/ - Update assignment
        - DELETE /api/seating-assignments/{id}/ - Remove assignment
    
    Filtering:
        - ?seating_period={id} - Filter by seating period ID
    
    Required Fields:
        - seating_period: FK to SeatingPeriod
        - roster_entry: FK to ClassRoster (NOT Student directly!)
        - table_number: String identifier for the table
        - seat_number: String identifier for the seat
    
    Important Notes:
        - Assignments link to ClassRoster, not Student directly
        - This preserves historical seating even if student unenrolled
        - Table/seat numbers are strings to support various naming schemes
        - One student can only have one assignment per period
    
    Data Format:
        Frontend uses format: {tableId: {seatNumber: studentId}}
        API expects: roster_entry (ClassRoster ID), not student ID
    """
    queryset = SeatingAssignment.objects.all()
    serializer_class = SeatingAssignmentSerializer
    permission_classes = [IsTeacher]
    filterset_fields = ["seating_period"]  # Enable filtering by seating_period

    def get_queryset(self):
        """Filter assignments to only show those for user's classes"""
        # All users (including superusers) only see assignments for their own classes
        queryset = SeatingAssignment.objects.filter(
            seating_period__class_assigned__teacher=self.request.user
        )

        # Filter by seating_period if provided in query params
        seating_period = self.request.query_params.get("seating_period", None)
        if seating_period is not None:
            queryset = queryset.filter(seating_period_id=seating_period)

        return queryset


def frontend_view(request):
    """Serve the frontend HTML file as static content"""
    try:
        # Use absolute path to be more explicit
        frontend_path = os.path.join(settings.BASE_DIR, "index.html")

        if os.path.exists(frontend_path):
            with open(frontend_path, "r", encoding="utf-8") as f:
                content = f.read()

            # Only update API URLs for production
            if hasattr(settings, "PRODUCTION") and settings.PRODUCTION:
                content = content.replace("localhost:8000", "bcranston.pythonanywhere.com")
                content = content.replace("127.0.0.1:8000", "bcranston.pythonanywhere.com")
                content = content.replace("http://bcranston.pythonanywhere.com", "https://bcranston.pythonanywhere.com")

            return HttpResponse(content, content_type="text/html")
        else:
            return HttpResponse(
                f"<h1>Frontend not found</h1><p>Path: {frontend_path}</p><p>Files in BASE_DIR: {os.listdir(settings.BASE_DIR)}</p>",
                status=404,
            )

    except Exception as e:
        return HttpResponse(f"<h1>Error</h1><p>{str(e)}</p>", status=500)


def test_view(request):
    """Test view"""
    return HttpResponse("<h1>Test Success!</h1><p>Django is working</p>")


class AttendanceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing attendance records.
    Teachers can only manage attendance for their own classes.
    """
    serializer_class = AttendanceRecordSerializer
    permission_classes = [IsTeacher]
    
    def get_queryset(self):
        """Filter attendance records based on user's classes"""
        user = self.request.user
        if user.is_superuser:
            # Superusers still only see their own classes' attendance
            return AttendanceRecord.objects.filter(
                class_roster__class_assigned__teacher=user
            ).select_related('class_roster__student', 'class_roster__class_assigned')
        else:
            return AttendanceRecord.objects.filter(
                class_roster__class_assigned__teacher=user
            ).select_related('class_roster__student', 'class_roster__class_assigned')
    
    @action(detail=False, methods=['GET'], url_path='by-class/(?P<class_id>[^/.]+)/(?P<date>[^/.]+)')
    def by_class_and_date(self, request, class_id=None, date=None):
        """Get attendance records for a specific class and date"""
        try:
            # Verify teacher owns the class
            class_obj = Class.objects.get(id=class_id)
            if class_obj.teacher != request.user and not request.user.is_superuser:
                return Response(
                    {"error": "You don't have permission to view this class's attendance"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get all active roster entries for the class
            roster_entries = ClassRoster.objects.filter(
                class_assigned_id=class_id,
                is_active=True
            ).select_related('student').order_by('student__last_name', 'student__first_name')

            # Nicknames resolve through the class teacher's annotations
            # (fallback to first_name); one query for the whole roster.
            roster_student_ids = [entry.student_id for entry in roster_entries]
            nickname_by_student = {
                ts.student_id: ts.nickname
                for ts in TeacherStudent.objects.filter(
                    teacher=class_obj.teacher,
                    student_id__in=roster_student_ids,
                )
                if ts.nickname and ts.nickname.strip()
            }

            # Get existing attendance records for this date
            attendance_records = AttendanceRecord.objects.filter(
                class_roster__class_assigned_id=class_id,
                date=date
            ).select_related('class_roster__student')
            
            # Create a map of existing records
            attendance_map = {
                record.class_roster_id: record 
                for record in attendance_records
            }
            
            # Build response with all students, using existing records or defaults
            response_data = []
            for roster_entry in roster_entries:
                if roster_entry.id in attendance_map:
                    # Use existing record
                    serializer = AttendanceRecordSerializer(attendance_map[roster_entry.id])
                    response_data.append(serializer.data)
                else:
                    # Create default data for students without records
                    response_data.append({
                        'id': None,
                        'class_roster': roster_entry.id,
                        'date': date,
                        'status': 'present',  # Default status
                        'notes': '',
                        'student_id': roster_entry.student.id,
                        'student_name': roster_entry.student.get_full_name(),
                        'student_first_name': roster_entry.student.first_name,
                        'student_last_name': roster_entry.student.last_name,
                        'student_nickname': (
                            nickname_by_student.get(roster_entry.student_id)
                            or roster_entry.student.first_name
                        ),
                        'class_id': class_obj.id,
                        'class_name': class_obj.name,
                        'created_at': None,
                        'updated_at': None
                    })
            
            return Response(response_data)
            
        except Class.DoesNotExist:
            return Response(
                {"error": "Class not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['POST'], url_path='bulk-save')
    def bulk_save(self, request):
        """Save attendance for multiple students at once"""
        serializer = AttendanceBulkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        date = serializer.validated_data['date']
        records = serializer.validated_data['attendance_records']
        
        created_count = 0
        updated_count = 0
        
        for record_data in records:
            roster_id = record_data['class_roster_id']
            
            # Verify teacher owns this class
            try:
                roster_entry = ClassRoster.objects.select_related('class_assigned').get(id=roster_id)
                if roster_entry.class_assigned.teacher != request.user and not request.user.is_superuser:
                    continue  # Skip records for classes not owned by teacher
            except ClassRoster.DoesNotExist:
                continue
            
            # Create or update attendance record
            attendance_record, created = AttendanceRecord.objects.update_or_create(
                class_roster_id=roster_id,
                date=date,
                defaults={
                    'status': record_data['status'],
                    'notes': record_data.get('notes', '')
                }
            )
            
            if created:
                created_count += 1
            else:
                updated_count += 1
        
        return Response({
            'message': f'Attendance saved successfully',
            'created': created_count,
            'updated': updated_count,
            'date': date
        })
    
    @action(detail=False, methods=['GET'], url_path='dates/(?P<class_id>[^/.]+)')
    def attendance_dates(self, request, class_id=None):
        """Get list of dates with attendance records for navigation"""
        try:
            # Verify teacher owns the class
            class_obj = Class.objects.get(id=class_id)
            if class_obj.teacher != request.user and not request.user.is_superuser:
                return Response(
                    {"error": "You don't have permission to view this class's attendance"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get unique dates with attendance records
            dates = AttendanceRecord.objects.filter(
                class_roster__class_assigned_id=class_id
            ).values_list('date', flat=True).distinct().order_by('-date')
            
            return Response({
                'class_id': class_id,
                'dates': list(dates)
            })
            
        except Class.DoesNotExist:
            return Response(
                {"error": "Class not found"},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['GET'], url_path='totals/(?P<class_id>[^/.]+)')
    def attendance_totals(self, request, class_id=None):
        """Get running totals for each student in a class"""
        try:
            # Verify teacher owns the class
            class_obj = Class.objects.get(id=class_id)
            if class_obj.teacher != request.user and not request.user.is_superuser:
                return Response(
                    {"error": "You don't have permission to view this class's attendance"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get all active roster entries
            roster_entries = ClassRoster.objects.filter(
                class_assigned_id=class_id,
                is_active=True
            ).select_related('student')

            # Get all attendance stats in one query (fixes N+1)
            attendance_stats = AttendanceRecord.objects.filter(
                class_roster__class_assigned_id=class_id,
                class_roster__is_active=True
            ).values('class_roster_id').annotate(
                absent_count=models.Count('id', filter=models.Q(status='absent')),
                tardy_count=models.Count('id', filter=models.Q(status='tardy')),
                early_dismissal_count=models.Count('id', filter=models.Q(status='early_dismissal'))
            )

            # Build lookup dict
            stats_by_roster = {s['class_roster_id']: s for s in attendance_stats}

            # Build response using lookup
            totals = []
            for roster_entry in roster_entries:
                stats = stats_by_roster.get(roster_entry.id, {})
                totals.append({
                    'student_id': roster_entry.student.id,
                    'student_name': roster_entry.student.get_full_name(),
                    'absent': stats.get('absent_count', 0),
                    'tardy': stats.get('tardy_count', 0),
                    'early_dismissal': stats.get('early_dismissal_count', 0)
                })
            
            return Response({
                'class_id': class_id,
                'totals': totals
            })
            
        except Class.DoesNotExist:
            return Response(
                {"error": "Class not found"},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['GET'], url_path='recent/(?P<class_id>[^/.]+)/(?P<date>[^/.]+)')
    def recent_attendance(self, request, class_id=None, date=None):
        """Get recent attendance history for consecutive absence tracking and birthdays"""
        from datetime import datetime, timedelta
        
        try:
            # Verify teacher owns the class
            class_obj = Class.objects.get(id=class_id)
            if class_obj.teacher != request.user and not request.user.is_superuser:
                return Response(
                    {"error": "You don't have permission to view this class's attendance"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Parse the requested date
            try:
                current_date = datetime.strptime(date, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {"error": "Invalid date format. Use YYYY-MM-DD"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get all active roster entries with student info
            roster_entries = ClassRoster.objects.filter(
                class_assigned_id=class_id,
                is_active=True
            ).select_related('student').order_by('student__last_name', 'student__first_name')
            
            # Find students with birthdays on the requested date
            birthday_students = []
            for roster_entry in roster_entries:
                student = roster_entry.student
                if student.date_of_birth:
                    # Check if birthday matches (month and day only)
                    if (student.date_of_birth.month == current_date.month and 
                        student.date_of_birth.day == current_date.day):
                        birthday_students.append(student.id)
            
            # Get dates with attendance records before the current date
            # Limit to 11 most recent dates for consecutive absence calculation
            previous_dates = AttendanceRecord.objects.filter(
                class_roster__class_assigned_id=class_id,
                date__lt=current_date
            ).values_list('date', flat=True).distinct().order_by('-date')[:11]
            
            # Convert to list and sort in descending order (most recent first)
            previous_dates = sorted(list(previous_dates), reverse=True)
            
            # Fetch all records at once (fixes N+1 query)
            all_records = AttendanceRecord.objects.filter(
                class_roster__class_assigned_id=class_id,
                date__in=previous_dates
            ).select_related('class_roster__student')

            # Group records by date
            records_by_date = {}
            for record in all_records:
                date_str = str(record.date)
                if date_str not in records_by_date:
                    records_by_date[date_str] = []
                records_by_date[date_str].append({
                    'class_roster': record.class_roster_id,
                    'student_id': record.class_roster.student.id,
                    'status': record.status,
                    'notes': record.notes
                })

            # Build response using the grouped data
            attendance_history = []
            for hist_date in previous_dates:
                date_str = str(hist_date)
                attendance_history.append({
                    'date': date_str,
                    'records': records_by_date.get(date_str, [])
                })
            
            # Build response
            response_data = {
                'current_date': str(current_date),
                'birthday_students': birthday_students,
                'attendance_history': attendance_history
            }
            
            return Response(response_data)
            
        except Class.DoesNotExist:
            return Response(
                {"error": "Class not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class ExternalReadViewSet(viewsets.ViewSet):
    """Read-only endpoints for external apps. Auth: X-API-Key header."""

    permission_classes = [HasExternalAPIKey]
    authentication_classes = []

    @action(detail=False, methods=["GET"], url_path="classes")
    def list_classes(self, request):
        classes = Class.objects.select_related("teacher").all()
        return Response({
            "classes": [
                {
                    "id": c.id,
                    "name": c.name,
                    "subject": c.subject,
                    "grade_level": c.grade_level,
                    "teacher_email": c.teacher.email if c.teacher else None,
                }
                for c in classes
            ]
        })

    @action(detail=False, methods=["GET"], url_path=r"classes/(?P<class_id>\d+)/snapshot")
    def class_snapshot(self, request, class_id=None):
        try:
            klass = Class.objects.select_related("teacher").get(pk=class_id)
        except Class.DoesNotExist:
            return Response({"error": "Class not found"}, status=status.HTTP_404_NOT_FOUND)

        roster = (
            ClassRoster.objects.filter(class_assigned=klass, is_active=True)
            .select_related("student")
            .order_by("student__last_name", "student__first_name")
        )

        # nickname/gender are per-teacher; resolve through the class teacher's
        # annotations (one query, fallbacks to first_name / None).
        annotations_by_student = {
            ts.student_id: ts
            for ts in TeacherStudent.objects.filter(
                teacher=klass.teacher,
                student_id__in=[r.student_id for r in roster],
            )
        }

        def _nickname(student):
            ann = annotations_by_student.get(student.id)
            if ann and ann.nickname and ann.nickname.strip():
                return ann.nickname
            return student.first_name

        def _gender(student):
            ann = annotations_by_student.get(student.id)
            return ann.gender if ann else None

        roster_data = [
            {
                "roster_id": r.id,
                "student_id": r.student.id,
                "student_number": r.student.student_id,
                "first_name": r.student.first_name,
                "last_name": r.student.last_name,
                "nickname": _nickname(r.student),
                "email": r.student.email,
                "gender": _gender(r.student),
            }
            for r in roster
        ]

        current_period = SeatingPeriod.objects.filter(
            class_assigned=klass, end_date__isnull=True, is_tracked=True
        ).first()

        grouping = None
        if current_period:
            assignments = (
                current_period.seating_assignments
                .select_related("roster_entry__student")
                .all()
            )
            tables = {}
            for a in assignments:
                table_num = a.table_number
                if table_num is None:
                    continue
                tables.setdefault(str(table_num), []).append({
                    "roster_id": a.roster_entry.id,
                    "student_id": a.roster_entry.student.id,
                    "first_name": a.roster_entry.student.first_name,
                    "last_name": a.roster_entry.student.last_name,
                    "nickname": _nickname(a.roster_entry.student),
                    "seat_id": a.seat_id,
                    "seat_number": a.seat_number,
                })
            for students_at_table in tables.values():
                students_at_table.sort(key=lambda s: s["seat_number"] or 0)

            grouping = {
                "period_id": current_period.id,
                "period_name": current_period.name,
                "start_date": current_period.start_date,
                "tables": tables,
            }

        return Response({
            "class": {
                "id": klass.id,
                "name": klass.name,
                "subject": klass.subject,
                "grade_level": klass.grade_level,
                "teacher_email": klass.teacher.email if klass.teacher else None,
            },
            "roster": roster_data,
            "current_grouping": grouping,
        })


class SpecialPointsProxyViewSet(viewsets.ViewSet):
    """Proxy to Cranston Commons API for special points."""

    permission_classes = [IsAuthenticated, IsSpecialPointsUser]

    @action(detail=False, methods=["POST"], url_path="fetch")
    def fetch_points(self, request):
        """Fetch current point totals for a list of student emails."""
        emails = request.data.get("emails", [])
        if not emails:
            return Response(
                {"students": {}, "not_found": []}, status=status.HTTP_200_OK
            )

        url = f"{settings.CRANSTON_COMMONS_BASE_URL}/api/seating/points/"
        headers = {"X-API-Key": settings.CRANSTON_COMMONS_API_KEY}

        try:
            resp = http_requests.post(
                url, json={"emails": emails}, headers=headers, timeout=10
            )
            if resp.status_code in (401, 403):
                return Response(
                    {"error": "Cranston Commons rejected the API key"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            return Response(resp.json(), status=resp.status_code)
        except (http_requests.ConnectionError, http_requests.Timeout):
            return Response(
                {"error": "Unable to connect to Cranston Commons"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

    @action(detail=False, methods=["POST"], url_path="award/batch")
    def award_batch(self, request):
        """Award/deduct points for multiple students."""
        awards = request.data.get("awards", [])
        if not awards:
            return Response({"results": []}, status=status.HTTP_200_OK)

        url = f"{settings.CRANSTON_COMMONS_BASE_URL}/api/seating/award/batch/"
        headers = {"X-API-Key": settings.CRANSTON_COMMONS_API_KEY}

        try:
            resp = http_requests.post(
                url, json={"awards": awards}, headers=headers, timeout=10
            )
            if resp.status_code in (401, 403):
                return Response(
                    {"error": "Cranston Commons rejected the API key"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            return Response(resp.json(), status=resp.status_code)
        except (http_requests.ConnectionError, http_requests.Timeout):
            return Response(
                {"error": "Unable to connect to Cranston Commons"},
                status=status.HTTP_502_BAD_GATEWAY,
            )


def layout_editor_view(request):
    """Serve the layout editor HTML file as static content"""
    try:
        # Use absolute path to be more explicit
        layout_editor_path = os.path.join(settings.BASE_DIR, "layout_editor.html")

        if os.path.exists(layout_editor_path):
            with open(layout_editor_path, "r", encoding="utf-8") as f:
                content = f.read()

            # Only update API URLs for production
            if hasattr(settings, "PRODUCTION") and settings.PRODUCTION:
                content = content.replace("localhost:8000", "bcranston.pythonanywhere.com")
                content = content.replace("127.0.0.1:8000", "bcranston.pythonanywhere.com")
                content = content.replace("http://bcranston.pythonanywhere.com", "https://bcranston.pythonanywhere.com")

            return HttpResponse(content, content_type="text/html")
        else:
            return HttpResponse(
                f"<h1>Layout Editor not found</h1><p>Path: {layout_editor_path}</p><p>Files in BASE_DIR: {os.listdir(settings.BASE_DIR)}</p>",
                status=404,
            )

    except Exception as e:
        return HttpResponse(f"<h1>Error</h1><p>{str(e)}</p>", status=500)


def modular_layout_editor_view(request):
    """Serve the new modular layout editor"""
    try:
        layout_editor_path = os.path.join(settings.BASE_DIR, "layout_editor", "index.html")

        if os.path.exists(layout_editor_path):
            with open(layout_editor_path, "r", encoding="utf-8") as f:
                content = f.read()

            # Only update API URLs for production
            if hasattr(settings, "PRODUCTION") and settings.PRODUCTION:
                content = content.replace("localhost:8000", "bcranston.pythonanywhere.com")
                content = content.replace("127.0.0.1:8000", "bcranston.pythonanywhere.com")
                content = content.replace("http://bcranston.pythonanywhere.com", "https://bcranston.pythonanywhere.com")

            return HttpResponse(content, content_type="text/html")
        else:
            return HttpResponse(
                f"<h1>Modular Layout Editor not found</h1><p>Path: {layout_editor_path}</p>", status=404
            )

    except Exception as e:
        return HttpResponse(f"<h1>Error</h1><p>{str(e)}</p>", status=500)
