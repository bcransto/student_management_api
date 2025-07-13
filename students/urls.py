# students/urls.py - Fixed to use custom token serializer
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views
from .serializers import CustomTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

# Create a custom token view that uses our custom serializer


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


# Create router for ViewSets
router = DefaultRouter()

# Original models
router.register(r'users', views.UserViewSet)
router.register(r'students', views.StudentViewSet)
router.register(r'classes', views.ClassViewSet)
router.register(r'roster', views.ClassRosterViewSet)

# Layout models
router.register(r'layouts', views.ClassroomLayoutViewSet)
router.register(r'tables', views.ClassroomTableViewSet)
router.register(r'seats', views.TableSeatViewSet)
router.register(r'obstacles', views.LayoutObstacleViewSet)

# Seating models
router.register(r'seating-periods', views.SeatingPeriodViewSet)
router.register(r'seating-assignments', views.SeatingAssignmentViewSet)

urlpatterns = [
    # JWT Authentication endpoints - FIXED to use custom serializer
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # API endpoints
    path('', include(router.urls)),
]
