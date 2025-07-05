# students/urls.py - Updated with new model routes
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views

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
    # JWT Authentication endpoints
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # API endpoints
    path('', include(router.urls)),
]