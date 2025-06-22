from rest_framework import viewsets, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import authenticate
from .models import User, Student, Class, ClassRoster
from .serializers import UserSerializer, StudentSerializer, ClassSerializer, ClassRosterSerializer
from django.http import HttpResponse, Http404
import os
from django.conf import settings

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

class ClassRosterViewSet(viewsets.ModelViewSet):
    queryset = ClassRoster.objects.all()
    serializer_class = ClassRosterSerializer
    permission_classes = [IsAuthenticated]

def frontend_view(request):
    """Serve the frontend HTML file as static content"""
    try:
        frontend_path = os.path.join(settings.BASE_DIR, 'frontend.html')
        
        if os.path.exists(frontend_path):
            with open(frontend_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Update API URLs for production
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
