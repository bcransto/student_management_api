# students/views.py - Minimal working version
from rest_framework import viewsets, permissions
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from django.db import models
from rest_framework.decorators import action
from rest_framework.response import Response
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
        frontend_path = os.path.join(settings.BASE_DIR, 'frontend.html')
        
        if os.path.exists(frontend_path):
            with open(frontend_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Only update API URLs for production
            if hasattr(settings, 'PRODUCTION') and settings.PRODUCTION:
                content = content.replace('localhost:8000', 'bcranston.pythonanywhere.com')
                content = content.replace('127.0.0.1:8000', 'bcranston.pythonanywhere.com') 
                content = content.replace('http://bcranston.pythonanywhere.com', 'https://bcranston.pythonanywhere.com')
            
            return HttpResponse(content, content_type='text/html')
        else:
            return HttpResponse(f'<h1>Frontend not found</h1><p>Path: {frontend_path}</p>', status=404)
            
    except Exception as e:
        return HttpResponse(f'<h1>Error</h1><p>{str(e)}</p>', status=500)

def test_view(request):
    """Test view"""
    return HttpResponse('<h1>Test Success!</h1><p>Django is working</p>')