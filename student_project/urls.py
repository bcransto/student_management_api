from django.contrib import admin
from django.urls import path, include
from students.views import frontend_view, test_view, layout_editor_view, modular_layout_editor_view
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('students.urls')),
    path('layout-editor/', layout_editor_view, name='layout_editor'),
    path('layout-editor-new/', modular_layout_editor_view, name='modular_layout_editor'),  # New modular version
    path('test/', test_view, name='test'),
    path('', frontend_view, name='frontend'),
]

# Serve static files
if settings.DEBUG or True:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
