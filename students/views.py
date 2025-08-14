# students/views.py - Minimal working version
import os

from django.conf import settings
from django.db import models
from django.http import HttpResponse
from django.shortcuts import render
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    Class,
    ClassroomLayout,
    ClassroomTable,
    ClassRoster,
    LayoutObstacle,
    SeatingAssignment,
    SeatingPeriod,
    Student,
    TableSeat,
    User,
)
from .permissions import IsSuperuser, IsSuperuserOrOwner
from .serializers import (
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
            
            # TODO: Send confirmation email
            
            return Response({"message": "Password changed successfully"})
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def create(self, request, *args, **kwargs):
        """Create a new user and send welcome email"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Get the temporary password if one was generated
        temp_password = getattr(user, 'temp_password', None)
        
        # TODO: Send welcome email with temp_password
        
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
        if self.request.user.is_superuser:
            return Class.objects.all()
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


class ClassRosterViewSet(viewsets.ModelViewSet):
    queryset = ClassRoster.objects.all()
    serializer_class = ClassRosterSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_superuser:
            return ClassRoster.objects.all()
        return ClassRoster.objects.filter(class_assigned__teacher=self.request.user)


# Layout ViewSets


class ClassroomLayoutViewSet(viewsets.ModelViewSet):
    serializer_class = ClassroomLayoutSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        if self.request.user.is_superuser:
            return ClassroomLayout.objects.all()
        # Only show layouts created by the current user
        return ClassroomLayout.objects.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(created_by=self.request.user)

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
        queryset = SeatingPeriod.objects.all()

        # Filter by user's classes (unless superuser)
        if not self.request.user.is_superuser:
            queryset = queryset.filter(class_assigned__teacher=self.request.user)

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
        queryset = SeatingAssignment.objects.all()

        # Filter by user's permissions
        if not self.request.user.is_superuser:
            queryset = queryset.filter(seating_period__class_assigned__teacher=self.request.user)

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
