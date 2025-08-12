#!/usr/bin/env python
"""Test script to verify layout filtering by user"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "student_project.settings")
django.setup()

from students.models import User, ClassroomLayout

def test_layout_filtering():
    """Test that users only see their own layouts"""
    
    # Find the bcranston user
    try:
        user = User.objects.get(email="bcranston@carlisle.k12.ma.us")
        print(f"Found user: {user.email} (ID: {user.id})")
    except User.DoesNotExist:
        print("User bcranston@carlisle.k12.ma.us not found")
        return
    
    # Get all layouts in the database
    all_layouts = ClassroomLayout.objects.all()
    print(f"\nTotal layouts in database: {all_layouts.count()}")
    
    # Get layouts created by bcranston
    user_layouts = ClassroomLayout.objects.filter(created_by=user)
    print(f"Layouts created by {user.email}: {user_layouts.count()}")
    
    # List all layouts with their creators
    print("\nAll layouts in database:")
    print("-" * 60)
    for layout in all_layouts:
        creator_email = layout.created_by.email if layout.created_by else "No creator"
        print(f"- {layout.name} (ID: {layout.id}) - Created by: {creator_email}")
    
    print("\n" + "=" * 60)
    print(f"Layouts that should be visible to {user.email}:")
    print("-" * 60)
    for layout in user_layouts:
        print(f"- {layout.name} (ID: {layout.id})")
    
    # Check what the viewset would return
    from students.views import ClassroomLayoutViewSet
    from rest_framework.test import APIRequestFactory
    from rest_framework.request import Request
    
    factory = APIRequestFactory()
    request = factory.get('/api/layouts/')
    request.user = user
    
    viewset = ClassroomLayoutViewSet()
    viewset.request = Request(request)
    viewset.request.user = user
    
    queryset = viewset.get_queryset()
    print("\n" + "=" * 60)
    print(f"Layouts returned by API for {user.email}:")
    print("-" * 60)
    for layout in queryset:
        print(f"- {layout.name} (ID: {layout.id})")

if __name__ == "__main__":
    test_layout_filtering()