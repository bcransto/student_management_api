from django.contrib import admin
from django.urls import path, include
from students.views import frontend_view, test_view, layout_editor_view, modular_layout_editor_view
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse, Http404
import os


def serve_layout_editor_file(request, file_path):
    """Serve layout editor static files from the layout_editor directory"""
    try:
        print(f"🔍 Requested file: {file_path}")

        # Construct the full file path
        full_path = os.path.join(settings.BASE_DIR, 'layout_editor', file_path)
        print(f"📂 Looking for file at: {full_path}")

        # Check if file exists
        if os.path.exists(full_path):
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Determine content type
            if file_path.endswith('.js'):
                content_type = 'application/javascript'
            elif file_path.endswith('.css'):
                content_type = 'text/css'
            elif file_path.endswith('.html'):
                content_type = 'text/html'
            else:
                content_type = 'text/plain'

            print(f"✅ Serving {file_path} ({len(content)} chars)")
            return HttpResponse(content, content_type=content_type)
        else:
            # Debug: Show what files are actually available
            layout_editor_dir = os.path.join(
                settings.BASE_DIR, 'layout_editor')
            if os.path.exists(layout_editor_dir):
                available_files = []
                for root, dirs, files in os.walk(layout_editor_dir):
                    for file in files:
                        rel_path = os.path.relpath(
                            os.path.join(root, file), layout_editor_dir)
                        available_files.append(rel_path.replace('\\', '/'))
                print(f"📋 Available files: {available_files}")
            else:
                print(
                    f"❌ layout_editor directory doesn't exist: {layout_editor_dir}")

            raise Http404(f"File not found: {file_path}")

    except Exception as e:
        print(f"💥 Error serving file: {str(e)}")
        raise Http404(f"Error serving file: {str(e)}")


def serve_frontend_file(request, file_path):
    """Serve frontend static files from the frontend directory"""
    try:
        print(f"🔍 Frontend requested file: {file_path}")

        # Construct the full file path
        full_path = os.path.join(settings.BASE_DIR, 'frontend', file_path)
        print(f"📂 Looking for frontend file at: {full_path}")

        # Check if file exists
        if os.path.exists(full_path):
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Determine content type
            if file_path.endswith('.js'):
                content_type = 'application/javascript'
            elif file_path.endswith('.css'):
                content_type = 'text/css'
            elif file_path.endswith('.html'):
                content_type = 'text/html'
            else:
                content_type = 'text/plain'

            print(f"✅ Serving frontend {file_path} ({len(content)} chars)")
            return HttpResponse(content, content_type=content_type)
        else:
            # Debug: Show what files are actually available
            frontend_dir = os.path.join(settings.BASE_DIR, 'frontend')
            if os.path.exists(frontend_dir):
                available_files = []
                for root, dirs, files in os.walk(frontend_dir):
                    for file in files:
                        rel_path = os.path.relpath(
                            os.path.join(root, file), frontend_dir)
                        available_files.append(rel_path.replace('\\', '/'))
                print(f"📋 Available frontend files: {available_files}")
            else:
                print(f"❌ frontend directory doesn't exist: {frontend_dir}")

            raise Http404(f"Frontend file not found: {file_path}")

    except Exception as e:
        print(f"💥 Error serving frontend file: {str(e)}")
        raise Http404(f"Error serving frontend file: {str(e)}")


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('students.urls')),
    path('layout-editor/', layout_editor_view, name='layout_editor'),
    path('layout-editor-new/', modular_layout_editor_view,
         name='modular_layout_editor'),

    # Serve layout editor static files
    path('layout-editor-new/<path:file_path>',
         serve_layout_editor_file, name='layout_editor_static'),

    # Serve frontend static files
    path('frontend/<path:file_path>',
         serve_frontend_file, name='frontend_static'),


    path('test/', test_view, name='test'),
    path('', frontend_view, name='frontend'),
]

# Serve static files
if settings.DEBUG or True:
    urlpatterns += static(settings.STATIC_URL,
                          document_root=settings.STATIC_ROOT)
