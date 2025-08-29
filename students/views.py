# students/views.py - Minimal working version
import os

from django.conf import settings
from django.core.mail import send_mail
from django.db import models
from django.http import HttpResponse
from django.shortcuts import render
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
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
    TableSeat,
    User,
)
from .permissions import IsSuperuser, IsSuperuserOrOwner
from .serializers import (
    AttendanceBulkSerializer,
    AttendanceRecordSerializer,
    ChangePasswordSerializer,
    ClassroomLayoutSerializer,
    ClassroomTableSerializer,
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
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Return appropriate permission classes based on action"""
        if self.action in ['list', 'create']:
            # Only superusers can list all users or create new ones
            permission_classes = [IsSuperuser]
        elif self.action in ['retrieve', 'update', 'partial_update']:
            # Superusers can access any user, regular users only their own
            permission_classes = [IsSuperuserOrOwner]
        elif self.action in ['destroy', 'deactivate', 'reactivate']:
            # Only superusers can delete or deactivate users
            permission_classes = [IsSuperuser]
        else:
            # Default to authenticated users
            permission_classes = [IsAuthenticated]
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
    
    @action(detail=False, methods=['get', 'patch'], permission_classes=[IsAuthenticated])
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
    
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
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
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]


class ClassViewSet(viewsets.ModelViewSet):
    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # All users (including superusers) only see their own classes
        return Class.objects.filter(teacher=self.request.user)
    
    def perform_create(self, serializer):
        """Auto-set the teacher to the current user when creating a class"""
        serializer.save(teacher=self.request.user)

    @action(detail=True, methods=["get"])
    def seating_chart(self, request, pk=None):
        """Get current seating chart for this class"""
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
        """Validate if a seat ID exists in the class layout"""
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
        """Get historical seating partnerships for all students in completed periods"""
        class_obj = self.get_object()
        
        # Get all completed seating periods (end_date is not null)
        completed_periods = SeatingPeriod.objects.filter(
            class_assigned=class_obj,
            end_date__isnull=False
        ).order_by('end_date')
        
        if not completed_periods.exists():
            return Response({
                "class_id": class_obj.id,
                "partnership_data": {}
            })
        
        # Build partnership data structure
        partnership_data = {}
        
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
                                "is_active": ClassRoster.objects.filter(
                                    class_assigned=class_obj,
                                    student=student1,
                                    is_active=True
                                ).exists(),
                                "partnerships": {}
                            }
                        
                        # Initialize student2 data if not exists
                        if str(student2.id) not in partnership_data:
                            partnership_data[str(student2.id)] = {
                                "name": f"{student2.first_name} {student2.last_name}",
                                "is_active": ClassRoster.objects.filter(
                                    class_assigned=class_obj,
                                    student=student2,
                                    is_active=True
                                ).exists(),
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
        """Get or set partnership ratings for this class in grid format"""
        class_obj = self.get_object()
        
        if request.method == "GET":
            # Get all active students in the class
            roster_entries = ClassRoster.objects.filter(
                class_assigned=class_obj,
                is_active=True
            ).select_related('student')
            
            students = [entry.student for entry in roster_entries]
            student_ids = [s.id for s in students]
            
            # Get all existing ratings for this class
            ratings = PartnershipRating.objects.filter(
                class_assigned=class_obj,
                student1__in=student_ids,
                student2__in=student_ids
            )
            
            # Build grid data structure
            grid_data = {}
            for s1 in students:
                grid_data[s1.id] = {
                    'student_name': f"{s1.first_name} {s1.last_name}",
                    'ratings': {}
                }
                for s2 in students:
                    if s1.id != s2.id:
                        # Get rating (order doesn't matter due to model's save method)
                        rating_value = PartnershipRating.get_rating(class_obj, s1, s2)
                        grid_data[s1.id]['ratings'][s2.id] = rating_value
            
            return Response({
                'class_id': class_obj.id,
                'students': [
                    {
                        'id': s.id,
                        'name': f"{s.first_name} {s.last_name}",
                        'nickname': s.nickname or s.first_name
                    } for s in students
                ],
                'grid': grid_data
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
        """Bulk update multiple partnership ratings at once"""
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
    queryset = ClassRoster.objects.all()
    serializer_class = ClassRosterSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]  # Enable the filter backend
    filterset_fields = ['student', 'class_assigned', 'is_active']  # Enable filtering

    def get_queryset(self):
        # All users (including superusers) only see their own class rosters
        return ClassRoster.objects.filter(class_assigned__teacher=self.request.user)


# Layout ViewSets


class ClassroomLayoutViewSet(viewsets.ModelViewSet):
    serializer_class = ClassroomLayoutSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # All users (including superusers) only see their own layouts
        # Filter out soft-deleted layouts
        return ClassroomLayout.objects.filter(
            created_by=self.request.user,
            is_active=True
        )

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(created_by=self.request.user)
    
    def destroy(self, request, *args, **kwargs):
        """Perform soft delete instead of hard delete"""
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"])
    def create_from_editor(self, request):
        """Create layout from editor data"""
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
        """Update layout from editor data"""
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
    queryset = ClassroomTable.objects.all()
    serializer_class = ClassroomTableSerializer
    permission_classes = [IsAuthenticated]


class TableSeatViewSet(viewsets.ModelViewSet):
    queryset = TableSeat.objects.all()
    serializer_class = TableSeatSerializer
    permission_classes = [IsAuthenticated]


class LayoutObstacleViewSet(viewsets.ModelViewSet):
    queryset = LayoutObstacle.objects.all()
    serializer_class = LayoutObstacleSerializer
    permission_classes = [IsAuthenticated]


# Seating ViewSets


class SeatingPeriodViewSet(viewsets.ModelViewSet):
    queryset = SeatingPeriod.objects.all()
    serializer_class = SeatingPeriodSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["class_assigned", "is_active"]  # Enable filtering

    def get_queryset(self):
        # All users (including superusers) only see seating periods for their own classes
        queryset = SeatingPeriod.objects.filter(class_assigned__teacher=self.request.user)

        # Filter by class_assigned if provided in query params
        class_assigned = self.request.query_params.get("class_assigned", None)
        if class_assigned is not None:
            queryset = queryset.filter(class_assigned_id=class_assigned)

        return queryset

    @action(detail=False, methods=["get"])
    def previous_period(self, request):
        """Get the most recent completed seating period for a class with all assignments."""
        class_id = request.query_params.get("class_assigned")
        
        if not class_id:
            return Response({"error": "class_assigned parameter is required"}, status=400)
        
        # Get the current active period (end_date is null)
        current_period = SeatingPeriod.objects.filter(
            class_assigned_id=class_id,
            end_date__isnull=True
        ).first()
        
        if not current_period:
            return Response({"error": "No current period found"}, status=404)
        
        # Get the most recent completed period (has end_date) before the current one
        previous_period = SeatingPeriod.objects.filter(
            class_assigned_id=class_id,
            end_date__isnull=False
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


class SeatingAssignmentViewSet(viewsets.ModelViewSet):
    queryset = SeatingAssignment.objects.all()
    serializer_class = SeatingAssignmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["seating_period"]  # Enable filtering by seating_period

    def get_queryset(self):
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
    permission_classes = [IsAuthenticated]
    
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
                        'student_nickname': roster_entry.student.nickname,
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
            
            # Calculate totals for each student
            totals = []
            for roster_entry in roster_entries:
                student_totals = AttendanceRecord.objects.filter(
                    class_roster=roster_entry
                ).aggregate(
                    absent_count=models.Count('id', filter=models.Q(status='absent')),
                    tardy_count=models.Count('id', filter=models.Q(status='tardy')),
                    early_dismissal_count=models.Count('id', filter=models.Q(status='early_dismissal'))
                )
                
                totals.append({
                    'student_id': roster_entry.student.id,
                    'student_name': roster_entry.student.get_full_name(),
                    'absent': student_totals['absent_count'] or 0,
                    'tardy': student_totals['tardy_count'] or 0,
                    'early_dismissal': student_totals['early_dismissal_count'] or 0
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
            
            # Build attendance history for these dates
            attendance_history = []
            for hist_date in previous_dates:
                # Get attendance records for this date
                records = AttendanceRecord.objects.filter(
                    class_roster__class_assigned_id=class_id,
                    date=hist_date
                ).select_related('class_roster__student')
                
                # Build list of records for this date
                date_records = []
                for record in records:
                    date_records.append({
                        'class_roster': record.class_roster_id,
                        'student_id': record.class_roster.student.id,
                        'status': record.status,
                        'notes': record.notes
                    })
                
                attendance_history.append({
                    'date': str(hist_date),
                    'records': date_records
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
