# students/urls.py - Fixed to use custom token serializer
from django.contrib.auth import views as auth_views
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import password_reset, views
from .serializers import CustomTokenObtainPairSerializer

# Create a custom token view that uses our custom serializer


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


# Create router for ViewSets
router = DefaultRouter()

# Original models
router.register(r"users", views.UserViewSet)
router.register(r"students", views.StudentViewSet)
router.register(r"classes", views.ClassViewSet)
router.register(r"roster", views.ClassRosterViewSet)

# Layout models
router.register(r"layouts", views.ClassroomLayoutViewSet, basename="classroomlayout")
router.register(r"tables", views.ClassroomTableViewSet)
router.register(r"seats", views.TableSeatViewSet)
router.register(r"obstacles", views.LayoutObstacleViewSet)

# Seating models
router.register(r"seating-periods", views.SeatingPeriodViewSet)
router.register(r"seating-assignments", views.SeatingAssignmentViewSet)

# Attendance
router.register(r"attendance", views.AttendanceViewSet, basename="attendance")

# Add snake_case aliases for consistency (both hyphenated and snake_case work)
router.register(r"seating_periods", views.SeatingPeriodViewSet, basename="seating_periods")
router.register(r"seating_assignments", views.SeatingAssignmentViewSet, basename="seating_assignments")

urlpatterns = [
    # JWT Authentication endpoints - FIXED to use custom serializer
    path("token/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    
    # Password reset endpoints
    path("password-reset/", password_reset.password_reset_request, name="password_reset_request"),
    path("password-reset/confirm/", password_reset.password_reset_confirm, name="password_reset_confirm"),
    path("password-reset/validate/", password_reset.password_reset_validate, name="password_reset_validate"),
    
    # API endpoints
    path("", include(router.urls)),
]
