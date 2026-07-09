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


class IsTeacher(permissions.BasePermission):
    """
    Allow only authenticated teacher (or superuser) accounts.

    Student accounts are provisioned via Google Sign-In with
    ``is_teacher=False`` and a ``User.student`` link to a global Student row
    (GH issue #16). They hold valid JWTs but must never reach any teacher-facing
    data - this permission returns 403 for them. Superusers always pass so an
    admin whose ``is_teacher`` flag was somehow cleared is never locked out.
    """

    message = "This endpoint is only available to teacher accounts."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return bool(getattr(user, "is_teacher", False)) or bool(user.is_superuser)


class IsStudent(permissions.BasePermission):
    """
    Allow only authenticated student accounts (GH issue #16 phase 2).

    A student account is auto-provisioned via Google Sign-In with
    ``is_teacher=False`` and a ``User.student`` link to a global Student row.
    This is the mirror image of ``IsTeacher``: it gates the student-only survey
    endpoints so teacher/admin JWTs (which have no linked Student) get a 403.
    """

    message = "This endpoint is only available to student accounts."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return (not getattr(user, "is_teacher", True)) and user.student_id is not None


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