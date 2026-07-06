import os

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import Http404, HttpResponse
from django.urls import include, path

from students.views import frontend_view, test_view
# Google Classroom OAuth endpoints
from students.google_classroom_service import (
    google_auth_start,
    google_auth_callback,
    google_signin,
    google_oauth_url,
    google_courses,
    google_course_students,
    google_import_students,
    google_directory_cohorts,
    google_directory_students,
    google_import_directory_students,
    google_test_directory,
    google_test_connection,
    google_disconnect,
    create_test_assignment,
    test_fetch_assignment_details,
)

def test_optimizer_view(request):
    """Serve the test optimizer page"""
    test_file_path = os.path.join(settings.BASE_DIR, "test_optimizer.html")
    if os.path.exists(test_file_path):
        with open(test_file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return HttpResponse(content, content_type="text/html")
    else:
        raise Http404("Test optimizer page not found")


def serve_frontend_file(request, file_path):
    """Serve frontend static files from the frontend directory"""
    try:
        print(f"🔍 Frontend requested file: {file_path}")

        # Construct the full file path
        full_path = os.path.join(settings.BASE_DIR, "frontend", file_path)
        print(f"📂 Looking for frontend file at: {full_path}")

        # Check if file exists
        if os.path.exists(full_path):
            with open(full_path, "r", encoding="utf-8") as f:
                content = f.read()

            # Determine content type
            if file_path.endswith(".js"):
                content_type = "application/javascript"
            elif file_path.endswith(".css"):
                content_type = "text/css"
            elif file_path.endswith(".html"):
                content_type = "text/html"
            else:
                content_type = "text/plain"

            print(f"✅ Serving frontend {file_path} ({len(content)} chars)")
            return HttpResponse(content, content_type=content_type)
        else:
            # Debug: Show what files are actually available
            frontend_dir = os.path.join(settings.BASE_DIR, "frontend")
            if os.path.exists(frontend_dir):
                available_files = []
                for root, dirs, files in os.walk(frontend_dir):
                    for file in files:
                        rel_path = os.path.relpath(os.path.join(root, file), frontend_dir)
                        available_files.append(rel_path.replace("\\", "/"))
                print(f"📋 Available frontend files: {available_files}")
            else:
                print(f"❌ frontend directory doesn't exist: {frontend_dir}")

            raise Http404(f"Frontend file not found: {file_path}")

    except Exception as e:
        print(f"💥 Error serving frontend file: {str(e)}")
        raise Http404(f"Error serving frontend file: {str(e)}")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("students.urls")),

    # ============================================================================
    # Google Classroom OAuth endpoints
    # ============================================================================
    path("api/auth/google/start/", google_auth_start, name="google_auth_start"),
    path("api/auth/google/callback/", google_auth_callback, name="google_auth_callback"),
    path("api/auth/google/signin/", google_signin, name="google_signin"),
    path("api/google/oauth-url/", google_oauth_url, name="google_oauth_url"),
    path("api/google/courses/", google_courses, name="google_courses"),
    path("api/google/courses/<str:course_id>/students/", google_course_students, name="google_course_students"),
    path("api/google/import-students/", google_import_students, name="google_import_students"),
    path("api/google/test-directory/", google_test_directory, name="google_test_directory"),
    path("api/google/directory-cohorts/", google_directory_cohorts, name="google_directory_cohorts"),
    path("api/google/directory-students/", google_directory_students, name="google_directory_students"),
    path("api/google/import-directory-students/", google_import_directory_students, name="google_import_directory_students"),
    path("api/google/test/", google_test_connection, name="google_test_connection"),
    path("api/google/create-test-assignment/", create_test_assignment, name="create_test_assignment"),
    path("api/google/test-assignment-details/", test_fetch_assignment_details, name="test_assignment_details"),
    path("api/google/disconnect/", google_disconnect, name="google_disconnect"),

    # Single layout editor route - serves the frontend editor
    path("layout-editor/", lambda request: serve_frontend_file(request, "layouts/editor/index.html"), name="layout_editor"),
    # Test optimizer page
    path("test_optimizer.html", test_optimizer_view, name="test_optimizer"),
    # Serve frontend static files
    path("frontend/<path:file_path>", serve_frontend_file, name="frontend_static"),
    path("test/", test_view, name="test"),
    path("", frontend_view, name="frontend"),
]

# Serve static files
if settings.DEBUG or True:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
