# students/permissions.py
from django.conf import settings
from rest_framework import permissions


class IsSuperuser(permissions.BasePermission):
    """
    Custom permission to only allow superusers to access.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_superuser


class IsSuperuserOrOwner(permissions.BasePermission):
    """
    Custom permission to allow superusers full access and users to access their own profile.
    """
    def has_permission(self, request, view):
        # Must be authenticated
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        # Superusers can access any user
        if request.user.is_superuser:
            return True
        # Users can only access their own profile
        return obj == request.user


class IsSpecialPointsUser(permissions.BasePermission):
    """Only allow the Cranston Commons user to access special points."""

    ALLOWED_EMAIL = "bcranston@carlisle.k12.ma.us"

    def has_permission(self, request, view):
        return request.user.email == self.ALLOWED_EMAIL


class HasExternalAPIKey(permissions.BasePermission):
    """Allow access if the X-API-Key header matches settings.EXTERNAL_API_KEY."""

    def has_permission(self, request, view):
        expected = getattr(settings, "EXTERNAL_API_KEY", "")
        if not expected:
            return False
        provided = request.META.get("HTTP_X_API_KEY", "")
        return bool(provided) and provided == expected


class IsSuperuserOrReadOwn(permissions.BasePermission):
    """
    Custom permission to allow superusers full access and users to read their own profile.
    """
    def has_permission(self, request, view):
        # Must be authenticated
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        # Superusers have full access
        if request.user.is_superuser:
            return True
        # Regular users can only read their own profile
        if obj == request.user:
            return request.method in permissions.SAFE_METHODS
        return False