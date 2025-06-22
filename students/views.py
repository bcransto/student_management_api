# students/views.py
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import User, Student, Class, ClassRoster
from .serializers import (
    UserSerializer, StudentSerializer, ClassSerializer, 
    ClassRosterSerializer, UpdateRosterSerializer
)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering_fields = ['username', 'created_at']
    ordering = ['username']
    
    def get_queryset(self):
        if self.request.user.is_superuser:
            return User.objects.all()
        return User.objects.filter(id=self.request.user.id)
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active', 'enrollment_date']
    search_fields = ['student_id', 'first_name', 'last_name', 'email']
    ordering_fields = ['student_id', 'last_name', 'enrollment_date']
    ordering = ['last_name', 'first_name']

class ClassViewSet(viewsets.ModelViewSet):
    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['subject', 'grade_level', 'teacher']
    search_fields = ['name', 'subject', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def get_queryset(self):
        if self.request.user.is_superuser:
            return Class.objects.all()
        return Class.objects.filter(teacher=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)
    
    @action(detail=True, methods=['get'])
    def groups(self, request, pk=None):
        class_obj = self.get_object()
        groups_data = {}
        all_groups = class_obj.get_all_groups()
        
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
        
        return Response({
            'class_name': class_obj.name,
            'groups': groups_data
        })
    
    @action(detail=True, methods=['get'])
    def seating_chart(self, request, pk=None):
        class_obj = self.get_object()
        roster_entries = class_obj.roster.filter(is_active=True, seat_number__isnull=False)
        
        seating_data = [
            {
                'seat_number': entry.seat_number,
                'student_name': entry.student.get_full_name(),
                'student_id': entry.student.student_id,
                'group_number': entry.group_number,
                'group_role': entry.group_role,
            }
            for entry in roster_entries.order_by('seat_number')
        ]
        
        return Response({
            'class_name': class_obj.name,
            'occupied_seats': len(seating_data),
            'seating_chart': seating_data
        })
    
    @action(detail=True, methods=['post'])
    def enroll(self, request, pk=None):
        class_obj = self.get_object()
        student_id = request.data.get('student_id')
        
        if not student_id:
            return Response({'error': 'student_id is required'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        try:
            student = Student.objects.get(student_id=student_id)
            
            # Check if student is already enrolled
            if ClassRoster.objects.filter(class_assigned=class_obj, student=student).exists():
                return Response({'error': 'Student already enrolled in this class'}, 
                              status=status.HTTP_400_BAD_REQUEST)
            
            # Create enrollment
            roster_entry = ClassRoster.objects.create(
                class_assigned=class_obj,
                student=student
            )
            
            serializer = ClassRosterSerializer(roster_entry)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Student.DoesNotExist:
            return Response({'error': 'Student not found'}, 
                          status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['post'])
    def remove_student(self, request, pk=None):
        class_obj = self.get_object()
        student_id = request.data.get('student_id')
        
        if not student_id:
            return Response({'error': 'student_id is required'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        try:
            student = Student.objects.get(student_id=student_id)
            roster_entry = ClassRoster.objects.get(class_assigned=class_obj, student=student)
            roster_entry.delete()
            
            return Response({'message': 'Student removed from class'}, 
                          status=status.HTTP_200_OK)
            
        except Student.DoesNotExist:
            return Response({'error': 'Student not found'}, 
                          status=status.HTTP_404_NOT_FOUND)
        except ClassRoster.DoesNotExist:
            return Response({'error': 'Student not enrolled in this class'}, 
                          status=status.HTTP_404_NOT_FOUND)

class ClassRosterViewSet(viewsets.ModelViewSet):
    queryset = ClassRoster.objects.all()
    serializer_class = ClassRosterSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active', 'group_number', 'class_assigned', 'student']
    search_fields = ['student__first_name', 'student__last_name', 'student__student_id']
    ordering_fields = ['enrollment_date', 'seat_number', 'group_number']
    ordering = ['class_assigned', 'seat_number']
    
    def get_queryset(self):
        if self.request.user.is_superuser:
            return ClassRoster.objects.all()
        return ClassRoster.objects.filter(class_assigned__teacher=self.request.user)
    
    @action(detail=True, methods=['post'])
    def assign_group(self, request, pk=None):
        roster = self.get_object()
        group_number = request.data.get('group_number')
        group_role = request.data.get('group_role', '')
        
        if not group_number:
            return Response({'error': 'group_number is required'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        if group_number > 999:  # Set a reasonable upper limit
            return Response({'error': 'Group number too large'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        roster.group_number = group_number
        roster.group_role = group_role
        roster.save()
        
        serializer = self.get_serializer(roster)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def assign_seat(self, request, pk=None):
        roster = self.get_object()
        seat_number = request.data.get('seat_number')
        
        if not seat_number:
            return Response({'error': 'seat_number is required'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        if seat_number > 999:  # Set a reasonable upper limit
            return Response({'error': 'Seat number too large'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        # Check if seat is already taken
        existing_seat = ClassRoster.objects.filter(
            class_assigned=roster.class_assigned,
            seat_number=seat_number
        ).exclude(id=roster.id).first()
        
        if existing_seat:
            return Response({'error': 'Seat already occupied'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        roster.seat_number = seat_number
        roster.save()
        
        serializer = self.get_serializer(roster)
        return Response(serializer.data)