# students/views.py - Minimal working version
from rest_framework import viewsets, permissions
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from django.db import models
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import render
from rest_framework import status
import os
from django.conf import settings

from .models import (
    User, Student, Class, ClassRoster, ClassroomLayout,
    ClassroomTable, TableSeat, LayoutObstacle,
    SeatingPeriod, SeatingAssignment
)
from .serializers import (
    UserSerializer, StudentSerializer, ClassSerializer, ClassRosterSerializer,
    ClassroomLayoutSerializer, ClassroomTableSerializer, TableSeatSerializer,
    LayoutObstacleSerializer, SeatingPeriodSerializer, SeatingAssignmentSerializer
)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]


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

    @action(detail=True, methods=['get'])
    def seating_chart(self, request, pk=None):
        """Get current seating chart for this class"""
        class_obj = self.get_object()
        chart = class_obj.get_current_seating_chart()

        if chart:
            return Response(chart)
        else:
            return Response(
                {'error': 'No seating chart available. Class needs a layout and active seating period.'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['get'], url_path='validate-seat/(?P<seat_id>[^/.]+)')
    def validate_seat(self, request, pk=None, seat_id=None):
        """Validate if a seat ID exists in the class layout"""
        class_obj = self.get_object()

        if not class_obj.classroom_layout:
            return Response({'valid': False, 'message': 'No layout assigned'})

        try:
            table_num, seat_num = seat_id.split('-')
            table = class_obj.classroom_layout.tables.filter(
                table_number=table_num).first()
            seat = table.seats.filter(
                seat_number=seat_num).first() if table else None

            if seat:
                return Response({'valid': True, 'message': 'Seat exists'})
            else:
                return Response({'valid': False, 'message': 'Seat not found'})
        except:
            return Response({'valid': False, 'message': 'Invalid seat ID format'})


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
    queryset = ClassroomLayout.objects.all()
    serializer_class = ClassroomLayoutSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_superuser:
            return ClassroomLayout.objects.all()
        return ClassroomLayout.objects.filter(
            models.Q(created_by=self.request.user) | models.Q(is_template=True)
        )

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'])
    def create_from_editor(self, request):
        """Create layout from editor data"""
        try:
            layout_data = request.data

            layout = ClassroomLayout.objects.create(
                name=layout_data['name'],
                description=layout_data['description'],
                room_width=layout_data['room_width'],
                room_height=layout_data['room_height'],
                created_by=request.user
            )

            # Create tables and seats
            for table_data in layout_data['tables']:
                table = ClassroomTable.objects.create(
                    layout=layout,
                    table_number=table_data['table_number'],
                    table_name=table_data['table_name'],
                    x_position=table_data['x_position'],
                    y_position=table_data['y_position'],
                    width=table_data['width'],
                    height=table_data['height'],
                    max_seats=table_data['max_seats'],
                    table_shape=table_data['table_shape'],
                    rotation=table_data['rotation']
                )

                for seat_data in table_data['seats']:
                    TableSeat.objects.create(
                        table=table,
                        seat_number=seat_data['seat_number'],
                        relative_x=seat_data['relative_x'],
                        relative_y=seat_data['relative_y'],
                        is_accessible=seat_data['is_accessible'],
                        notes=seat_data.get('notes', '')
                    )

            # Create obstacles
            for obstacle_data in layout_data['obstacles']:
                LayoutObstacle.objects.create(
                    layout=layout,
                    name=obstacle_data['name'],
                    obstacle_type=obstacle_data['obstacle_type'],
                    x_position=obstacle_data['x_position'],
                    y_position=obstacle_data['y_position'],
                    width=obstacle_data['width'],
                    height=obstacle_data['height'],
                    color=obstacle_data['color']
                )

            return Response(ClassroomLayoutSerializer(layout).data)

        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['put'])
    def update_from_editor(self, request, pk=None):
        """Update layout from editor data"""
        try:
            layout = self.get_object()  # Get the existing layout
            layout_data = request.data

            # Update basic layout properties
            layout.name = layout_data['name']
            layout.description = layout_data['description']
            layout.room_width = layout_data['room_width']
            layout.room_height = layout_data['room_height']
            layout.created_by = request.user  # Set the user
            layout.save()

            # Clear existing tables and obstacles
            layout.tables.all().delete()
            layout.obstacles.all().delete()

            # Create new tables and seats
            for table_data in layout_data['tables']:
                table = ClassroomTable.objects.create(
                    layout=layout,
                    table_number=table_data['table_number'],
                    table_name=table_data['table_name'],
                    x_position=table_data['x_position'],
                    y_position=table_data['y_position'],
                    width=table_data['width'],
                    height=table_data['height'],
                    max_seats=table_data['max_seats'],
                    table_shape=table_data['table_shape'],
                    rotation=table_data['rotation']
                )

                for seat_data in table_data['seats']:
                    TableSeat.objects.create(
                        table=table,
                        seat_number=seat_data['seat_number'],
                        relative_x=seat_data['relative_x'],
                        relative_y=seat_data['relative_y'],
                        is_accessible=seat_data['is_accessible'],
                        notes=seat_data.get('notes', '')
                    )

            # Create new obstacles
            for obstacle_data in layout_data['obstacles']:
                LayoutObstacle.objects.create(
                    layout=layout,
                    name=obstacle_data['name'],
                    obstacle_type=obstacle_data['obstacle_type'],
                    x_position=obstacle_data['x_position'],
                    y_position=obstacle_data['y_position'],
                    width=obstacle_data['width'],
                    height=obstacle_data['height'],
                    color=obstacle_data['color']
                )

            return Response(ClassroomLayoutSerializer(layout).data)

        except Exception as e:
            return Response({'error': str(e)}, status=400)


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

    def get_queryset(self):
        if self.request.user.is_superuser:
            return SeatingPeriod.objects.all()
        return SeatingPeriod.objects.filter(class_assigned__teacher=self.request.user)


class SeatingAssignmentViewSet(viewsets.ModelViewSet):
    queryset = SeatingAssignment.objects.all()
    serializer_class = SeatingAssignmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_superuser:
            return SeatingAssignment.objects.all()
        return SeatingAssignment.objects.filter(
            seating_period__class_assigned__teacher=self.request.user
        )


def frontend_view(request):
    """Serve the frontend HTML file as static content"""
    try:
        # Use absolute path to be more explicit
        frontend_path = os.path.join(settings.BASE_DIR, 'index.html')

        if os.path.exists(frontend_path):
            with open(frontend_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Only update API URLs for production
            if hasattr(settings, 'PRODUCTION') and settings.PRODUCTION:
                content = content.replace(
                    'localhost:8000', 'bcranston.pythonanywhere.com')
                content = content.replace(
                    '127.0.0.1:8000', 'bcranston.pythonanywhere.com')
                content = content.replace(
                    'http://bcranston.pythonanywhere.com', 'https://bcranston.pythonanywhere.com')

            return HttpResponse(content, content_type='text/html')
        else:
            return HttpResponse(f'<h1>Frontend not found</h1><p>Path: {frontend_path}</p><p>Files in BASE_DIR: {os.listdir(settings.BASE_DIR)}</p>', status=404)

    except Exception as e:
        return HttpResponse(f'<h1>Error</h1><p>{str(e)}</p>', status=500)


def test_view(request):
    """Test view"""
    return HttpResponse('<h1>Test Success!</h1><p>Django is working</p>')


def layout_editor_view(request):
    """Serve the layout editor HTML file as static content"""
    try:
        # Use absolute path to be more explicit
        layout_editor_path = os.path.join(
            settings.BASE_DIR, 'layout_editor.html')

        if os.path.exists(layout_editor_path):
            with open(layout_editor_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Only update API URLs for production
            if hasattr(settings, 'PRODUCTION') and settings.PRODUCTION:
                content = content.replace(
                    'localhost:8000', 'bcranston.pythonanywhere.com')
                content = content.replace(
                    '127.0.0.1:8000', 'bcranston.pythonanywhere.com')
                content = content.replace(
                    'http://bcranston.pythonanywhere.com', 'https://bcranston.pythonanywhere.com')

            return HttpResponse(content, content_type='text/html')
        else:
            return HttpResponse(f'<h1>Layout Editor not found</h1><p>Path: {layout_editor_path}</p><p>Files in BASE_DIR: {os.listdir(settings.BASE_DIR)}</p>', status=404)

    except Exception as e:
        return HttpResponse(f'<h1>Error</h1><p>{str(e)}</p>', status=500)


def debug_paths(request):
    """Debug view to check paths and files"""
    import os
    from django.conf import settings

    base_dir = settings.BASE_DIR
    frontend_path = os.path.join(base_dir, 'index.html')
    layout_path = os.path.join(base_dir, 'layout_editor.html')

    try:
        files_in_base = os.listdir(base_dir)
    except:
        files_in_base = ["Error reading directory"]

    debug_info = f"""
    <h1>Debug Information</h1>
    <p><strong>BASE_DIR:</strong> {base_dir}</p>
    <p><strong>Frontend path:</strong> {frontend_path}</p>
    <p><strong>Layout editor path:</strong> {layout_path}</p>
    <p><strong>Frontend exists:</strong> {os.path.exists(frontend_path)}</p>
    <p><strong>Layout editor exists:</strong> {os.path.exists(layout_path)}</p>
    <p><strong>Production mode:</strong> {getattr(settings, 'PRODUCTION', 'Not set')}</p>
    <h2>Files in BASE_DIR:</h2>
    <ul>
    """

    for file in files_in_base:
        debug_info += f"<li>{file}</li>"

    debug_info += "</ul>"

    return HttpResponse(debug_info, content_type='text/html')


@action(detail=True, methods=['get'])
def validate_seat(self, request, pk=None, seat_id=None):
    """Validate if a seat ID exists in the class layout"""
    class_obj = self.get_object()

    if not class_obj.classroom_layout:
        return Response({'valid': False, 'message': 'No layout assigned'})

    try:
        table_num, seat_num = seat_id.split('-')
        table = class_obj.classroom_layout.tables.filter(
            table_number=table_num).first()
        seat = table.seats.filter(
            seat_number=seat_num).first() if table else None

        if seat:
            return Response({'valid': True, 'message': 'Seat exists'})
        else:
            return Response({'valid': False, 'message': 'Seat not found'})
    except:
        return Response({'valid': False, 'message': 'Invalid seat ID format'})


@action(detail=False, methods=['post'])
def create_from_editor(self, request):
    """Create layout from editor data"""
    try:
        layout_data = request.data

        layout = ClassroomLayout.objects.create(
            name=layout_data['name'],
            description=layout_data['description'],
            room_width=layout_data['room_width'],
            room_height=layout_data['room_height'],
            created_by=request.user
        )

        # Create tables and seats
        for table_data in layout_data['tables']:
            table = ClassroomTable.objects.create(
                layout=layout,
                table_number=table_data['table_number'],
                table_name=table_data['table_name'],
                x_position=table_data['x_position'],
                y_position=table_data['y_position'],
                width=table_data['width'],
                height=table_data['height'],
                max_seats=table_data['max_seats'],
                table_shape=table_data['table_shape'],
                rotation=table_data['rotation']
            )

            for seat_data in table_data['seats']:
                TableSeat.objects.create(
                    table=table,
                    seat_number=seat_data['seat_number'],
                    relative_x=seat_data['relative_x'],
                    relative_y=seat_data['relative_y'],
                    is_accessible=seat_data['is_accessible'],
                    notes=seat_data.get('notes', '')
                )

        # Create obstacles
        for obstacle_data in layout_data['obstacles']:
            LayoutObstacle.objects.create(
                layout=layout,
                **obstacle_data
            )

        return Response(ClassroomLayoutSerializer(layout).data)

    except Exception as e:
        return Response({'error': str(e)}, status=400)


def modular_layout_editor_view(request):
    """Serve the new modular layout editor"""
    try:
        layout_editor_path = os.path.join(
            settings.BASE_DIR, 'layout_editor', 'index.html')

        if os.path.exists(layout_editor_path):
            with open(layout_editor_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Only update API URLs for production
            if hasattr(settings, 'PRODUCTION') and settings.PRODUCTION:
                content = content.replace(
                    'localhost:8000', 'bcranston.pythonanywhere.com')
                content = content.replace(
                    '127.0.0.1:8000', 'bcranston.pythonanywhere.com')
                content = content.replace(
                    'http://bcranston.pythonanywhere.com', 'https://bcranston.pythonanywhere.com')

            return HttpResponse(content, content_type='text/html')
        else:
            return HttpResponse(f'<h1>Modular Layout Editor not found</h1><p>Path: {layout_editor_path}</p>', status=404)

    except Exception as e:
        return HttpResponse(f'<h1>Error</h1><p>{str(e)}</p>', status=500)
