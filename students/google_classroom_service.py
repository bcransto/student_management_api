"""
Google Classroom OAuth Integration Service
Handles OAuth flow, token storage, and API interactions
"""

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from googleapiclient.discovery import build
from django.shortcuts import redirect
from django.http import JsonResponse
from django.urls import reverse
from django.contrib.auth.models import update_last_login
from django.conf import settings
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .models import GoogleClassroomCredentials
import logging
import os
import certifi

logger = logging.getLogger(__name__)


# ============================================================================
# Google Sign-In (JWT login via Google Identity Services)
# ============================================================================

@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def google_signin(request):
    """
    Google Sign-In endpoint.
    URL: /api/auth/google/signin/

    GET: Returns the Google client ID so the frontend can render the button.
    POST: Verifies a Google ID token and returns JWT access/refresh tokens.
        Body: {"credential": "<ID token from Google Identity Services>"}
        Only existing users (matched by email) can sign in - no auto-creation.
    """
    if request.method == "GET":
        return Response({"client_id": settings.GOOGLE_CLIENT_ID})

    credential = request.data.get("credential")
    if not credential:
        return Response({"detail": "Missing credential"}, status=400)

    try:
        idinfo = google_id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10,
        )
    except ValueError as e:
        logger.warning(f"Google sign-in token verification failed: {e}")
        return Response({"detail": "Invalid Google credential"}, status=401)

    email = idinfo.get("email")
    if not email or not idinfo.get("email_verified"):
        return Response({"detail": "Google account email is not verified"}, status=401)

    from .models import User

    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if not user:
        logger.warning(f"Google sign-in rejected - no account for {email}")
        return Response(
            {"detail": f"No account found for {email}. Contact your administrator."},
            status=403,
        )

    from .serializers import CustomTokenObtainPairSerializer

    refresh = CustomTokenObtainPairSerializer.get_token(user)
    update_last_login(None, user)

    logger.info(f"Google sign-in successful for {user.email}")
    return Response({"access": str(refresh.access_token), "refresh": str(refresh)})


# ============================================================================
# OAuth Flow Functions
# ============================================================================

def _build_oauth_authorization_url(request, user, next_hash="dashboard"):
    """
    Build a Google OAuth authorization URL with a signed state that carries
    the user's id (the callback arrives without JWT headers, so the state is
    how we know which user is connecting).
    """
    from django.core import signing

    state = signing.dumps({"uid": user.id, "next": next_hash})

    flow = Flow.from_client_config(
        settings.GOOGLE_OAUTH_CONFIG,
        scopes=settings.GOOGLE_SCOPES,
        redirect_uri=request.build_absolute_uri(reverse('google_auth_callback')),
        state=state,
    )

    # NOTE: no include_granted_scopes - this OAuth client is shared with other
    # tools (Drive scopes etc.), and asking Google to bundle prior grants makes
    # the returned scope list differ from the requested one, which oauthlib
    # rejects with "Scope has changed".
    auth_url, _ = flow.authorization_url(
        prompt='consent',  # Always show consent screen
        access_type='offline',  # Request refresh token
    )
    return auth_url


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def google_oauth_url(request):
    """
    Get the Google OAuth authorization URL for the current (JWT) user.
    URL: /api/google/oauth-url/?next=<hash route to return to>

    The frontend redirects the browser to the returned auth_url. After the
    user consents, the callback stores credentials and redirects back to
    /#<next>.
    """
    try:
        next_hash = request.GET.get("next", "dashboard").lstrip("#/")
        auth_url = _build_oauth_authorization_url(request, request.user, next_hash)
        return Response({"auth_url": auth_url})
    except Exception as e:
        logger.error(f"Error building OAuth URL: {str(e)}")
        return Response({"error": "Failed to build OAuth URL", "details": str(e)}, status=500)


def google_auth_start(request):
    """
    Start OAuth flow - visit this URL to connect to Google Classroom
    URL: /api/auth/google/start/

    Requires a session-authenticated user (e.g. logged into /admin/).
    The SPA should use /api/google/oauth-url/ instead.
    """
    if not request.user.is_authenticated:
        return JsonResponse({
            'error': 'Not authenticated. Connect Google Classroom from within the app.'
        }, status=401)

    try:
        auth_url = _build_oauth_authorization_url(request, request.user)
        logger.info(f"Starting OAuth flow for {request.user.email}")
        return redirect(auth_url)

    except Exception as e:
        logger.error(f"Error starting OAuth flow: {str(e)}")
        return JsonResponse({
            'error': 'Failed to start OAuth flow',
            'details': str(e)
        }, status=500)


def google_auth_callback(request):
    """
    Handle OAuth callback and store tokens
    URL: /api/auth/google/callback/
    """
    # Check for errors from Google
    error = request.GET.get('error')
    if error:
        logger.error(f"OAuth error: {error}")
        return JsonResponse({
            'error': f'Google OAuth error: {error}'
        }, status=400)

    # Get authorization code
    code = request.GET.get('code')
    if not code:
        return JsonResponse({
            'error': 'No authorization code received'
        }, status=400)

    # Verify signed state (CSRF protection + identifies the connecting user)
    from django.core import signing

    state = request.GET.get('state')
    try:
        state_data = signing.loads(state, max_age=600)
    except Exception:
        logger.warning("Invalid or expired state in OAuth callback")
        return JsonResponse({
            'error': 'Invalid state parameter'
        }, status=400)

    try:
        # Temporarily disable SSL verification for debugging
        import os
        import ssl
        import certifi

        # Set environment variable to use certifi's certificates
        os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()
        os.environ['SSL_CERT_FILE'] = certifi.where()

        # Tolerate Google returning extra scopes beyond the requested set
        # (e.g. openid/userinfo, or grants this shared client already has)
        os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'

        # Create flow instance
        flow = Flow.from_client_config(
            settings.GOOGLE_OAUTH_CONFIG,
            scopes=settings.GOOGLE_SCOPES,
            redirect_uri=request.build_absolute_uri(reverse('google_auth_callback')),
            state=state
        )

        # Exchange authorization code for tokens
        flow.fetch_token(code=code)
        credentials = flow.credentials

        # Store tokens for the user identified by the signed state
        from .models import User

        user = User.objects.filter(id=state_data.get('uid'), is_active=True).first()
        if not user:
            return JsonResponse({
                'error': 'User from OAuth state not found.'
            }, status=400)

        GoogleClassroomCredentials.objects.update_or_create(
            user=user,
            defaults={
                'access_token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'token_expiry': credentials.expiry,
                'scopes': list(credentials.scopes) if credentials.scopes else settings.GOOGLE_SCOPES,
            }
        )

        logger.info(f"Successfully connected Google Classroom for user {user.email}")

        # Redirect back into the SPA where the user started. The
        # ?google=connected marker lets the frontend know the connection just
        # succeeded (e.g. to auto-reopen the import modal) without changing
        # route-matching logic, which strips any trailing query string.
        next_hash = str(state_data.get('next') or 'dashboard').lstrip('#/')
        return redirect(f"/#{next_hash}?google=connected")

    except Exception as e:
        logger.error(f"Error in OAuth callback: {str(e)}")
        return JsonResponse({
            'error': 'Failed to complete OAuth flow',
            'details': str(e)
        }, status=500)


def create_test_assignment(request):
    """
    Create a test assignment in Google Classroom
    URL: /api/google/create-test-assignment/
    """
    from datetime import datetime, timedelta

    try:
        # Get the first user's credentials
        from .models import User
        test_user = User.objects.first()
        if not test_user:
            return JsonResponse({
                'error': 'No users in database'
            }, status=400)

        # Check if user has Google credentials
        if not is_user_connected(test_user):
            return JsonResponse({
                'error': 'User not connected to Google Classroom',
                'connect_url': reverse('google_auth_start')
            }, status=404)

        # Get course ID from query params or use default
        course_id = request.GET.get('course_id', '812166198374')

        # Set a due date 1 week from now
        due_date = datetime.now() + timedelta(days=7)

        # Create the test assignment
        assignment = create_assignment(
            user=test_user,
            course_id=course_id,
            title="Test Assignment from Django Integration",
            description="This is a test assignment created via the Django Student Management System to verify Google Classroom API integration.",
            max_points=100,
            due_date=due_date
        )

        return JsonResponse({
            'status': 'success',
            'message': f'Successfully created assignment',
            'assignment': {
                'id': assignment.get('id'),
                'title': assignment.get('title'),
                'description': assignment.get('description'),
                'alternateLink': assignment.get('alternateLink'),
                'maxPoints': assignment.get('maxPoints'),
                'state': assignment.get('state'),
                'creationTime': assignment.get('creationTime')
            },
            'course_id': course_id
        })

    except Exception as e:
        logger.error(f"Error creating test assignment: {str(e)}")
        return JsonResponse({
            'error': 'Failed to create assignment',
            'details': str(e)
        }, status=500)


def google_test_connection(request):
    """
    Test endpoint - list user's Google Classroom courses
    URL: /api/google/test/
    """
    try:
        # For testing: get the first user's credentials
        from .models import User
        test_user = User.objects.first()
        if not test_user:
            return JsonResponse({
                'error': 'No users in database'
            }, status=400)

        # Get user's stored credentials
        creds_obj = GoogleClassroomCredentials.objects.get(user=test_user)

        # Check if token is expired
        if creds_obj.is_token_expired():
            logger.info(f"Token expired for user {test_user.email}, needs refresh")
            # TODO: Implement token refresh logic

        # Build credentials object
        creds = Credentials(
            token=creds_obj.access_token,
            refresh_token=creds_obj.refresh_token,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=creds_obj.scopes or settings.GOOGLE_SCOPES
        )

        # Build Google Classroom service
        service = build('classroom', 'v1', credentials=creds)

        # List courses (as a test)
        courses_response = service.courses().list(
            pageSize=10,
            courseStates=['ACTIVE']
        ).execute()

        courses = courses_response.get('courses', [])

        # Format course data for response
        formatted_courses = []
        for course in courses:
            formatted_courses.append({
                'id': course.get('id'),
                'name': course.get('name'),
                'section': course.get('section'),
                'description': course.get('descriptionHeading'),
                'enrollment_code': course.get('enrollmentCode'),
                'course_state': course.get('courseState'),
            })

        return JsonResponse({
            'status': 'connected',
            'message': f'Successfully retrieved {len(courses)} courses',
            'courses': formatted_courses,
            'user': test_user.email
        })

    except GoogleClassroomCredentials.DoesNotExist:
        return JsonResponse({
            'status': 'not_connected',
            'message': 'Please connect to Google Classroom first',
            'connect_url': reverse('google_auth_start')
        }, status=404)
    except Exception as e:
        logger.error(f"Error testing connection: {str(e)}")
        return JsonResponse({
            'error': 'Failed to connect to Google Classroom',
            'details': str(e)
        }, status=500)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def google_disconnect(request):
    """
    Disconnect Google Classroom (remove stored credentials) for the current
    (JWT) user.
    URL: /api/google/disconnect/ (POST - state-changing)
    """
    try:
        # Delete user's credentials
        GoogleClassroomCredentials.objects.filter(user=request.user).delete()

        logger.info(f"Disconnected Google Classroom for user {request.user.email}")

        return Response({
            'status': 'disconnected',
            'message': 'Successfully disconnected from Google Classroom'
        })
    except Exception as e:
        logger.error(f"Error disconnecting: {str(e)}")
        return Response({
            'error': 'Failed to disconnect',
            'details': str(e)
        }, status=500)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def google_status(request):
    """
    Lightweight connection status for the current (JWT) user - only checks
    the local GoogleClassroomCredentials row, never calls out to Google.
    URL: /api/google/status/

    Returns {"connected": false} or
    {"connected": true, "token_expiry": ..., "scopes": [...], "updated_at": ...}
    Never returns token values.
    """
    creds = GoogleClassroomCredentials.objects.filter(user=request.user).first()
    if not creds:
        return Response({"connected": False})

    return Response({
        "connected": True,
        "token_expiry": creds.token_expiry,
        "scopes": creds.scopes,
        "updated_at": creds.updated_at,
    })


# ============================================================================
# Workspace Directory (Admin SDK) - probe + cohort import
# ============================================================================

DIRECTORY_SCOPE = "https://www.googleapis.com/auth/admin.directory.user.readonly"


def _get_directory_service(request):
    """
    Build an Admin SDK Directory service for the current user.

    Returns (service, error_response) - exactly one is non-None. Error
    responses carry auth_url so the frontend can offer a (re)connect button;
    the signed state routes the user back to the Students page.
    """
    try:
        creds_obj = GoogleClassroomCredentials.objects.get(user=request.user)
    except GoogleClassroomCredentials.DoesNotExist:
        return None, Response({
            "error": "Google not connected.",
            "needs_reconnect": True,
            "auth_url": _build_oauth_authorization_url(request, request.user, "students"),
        }, status=400)

    if DIRECTORY_SCOPE not in (creds_obj.scopes or []):
        return None, Response({
            "needs_reconnect": True,
            "message": "Stored credentials lack the Directory scope - re-consent via auth_url.",
            "auth_url": _build_oauth_authorization_url(request, request.user, "students"),
        })

    creds = Credentials(
        token=creds_obj.access_token,
        refresh_token=creds_obj.refresh_token,
        token_uri='https://oauth2.googleapis.com/token',
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=creds_obj.scopes or settings.GOOGLE_SCOPES,
    )
    if creds.expired and creds.refresh_token:
        try:
            from google.auth.transport.requests import Request
            creds.refresh(Request())
            creds_obj.access_token = creds.token
            creds_obj.token_expiry = creds.expiry
            creds_obj.save(update_fields=['access_token', 'token_expiry', 'updated_at'])
        except Exception as e:
            logger.warning(f"Google token refresh failed for {request.user.email}: {e}")
            return None, Response({
                "needs_reconnect": True,
                "message": "Google credentials expired - reconnect via auth_url.",
                "auth_url": _build_oauth_authorization_url(request, request.user, "students"),
            })

    return build('admin', 'directory_v1', credentials=creds), None


def _fetch_domain_users(service, domain):
    """Fetch all domain-visible users via the public directory view."""
    users = []
    page_token = None

    while True:
        response = service.users().list(
            domain=domain,
            viewType='domain_public',
            maxResults=500,
            pageToken=page_token,
        ).execute()
        users.extend(response.get('users', []))
        page_token = response.get('nextPageToken')
        if not page_token:
            break

    return users


def _normalize_directory_user(u):
    """Flatten a raw directory user record to the fields we care about."""
    name = u.get("name") or {}
    external_ids = u.get("externalIds") or [{}]
    return {
        "student_id": external_ids[0].get("value") or "",
        "first_name": name.get("givenName", ""),
        "last_name": name.get("familyName", ""),
        "email": u.get("primaryEmail") or "",
        "google_user_id": u.get("id") or "",
    }


def _match_existing_student(data):
    """Find an existing Student: google_user_id, then student_id, then email."""
    from .models import Student

    if data["google_user_id"]:
        student = Student.objects.filter(google_user_id=data["google_user_id"]).first()
        if student:
            return student
    if data["student_id"]:
        student = Student.objects.filter(student_id=data["student_id"]).first()
        if student:
            return student
    if data["email"]:
        return Student.objects.filter(email__iexact=data["email"]).first()
    return None


def _cohort_prefix(email):
    """Two-digit cohort prefix of a student email, or None for staff."""
    prefix = (email or "")[:2]
    return prefix if prefix.isdigit() else None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def google_directory_cohorts(request):
    """
    List student cohorts (two-digit email prefixes) in the Workspace directory.
    URL: /api/google/directory-cohorts/

    Response: {"connected": true, "cohorts": [{"cohort": "28", "count": 58}, ...]}
    Staff accounts (no digit prefix) are excluded.
    """
    service, error = _get_directory_service(request)
    if error:
        return error

    domain = request.user.email.split('@')[-1]
    try:
        users = _fetch_domain_users(service, domain)
    except Exception as e:
        logger.error(f"Error fetching Workspace directory: {str(e)}")
        return Response(
            {"error": "Failed to fetch the Workspace directory.", "details": str(e)},
            status=502,
        )

    counts = {}
    for u in users:
        prefix = _cohort_prefix(u.get("primaryEmail"))
        if prefix:
            counts[prefix] = counts.get(prefix, 0) + 1

    return Response({
        "connected": True,
        "cohorts": [{"cohort": c, "count": n} for c, n in sorted(counts.items())],
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def google_directory_students(request):
    """
    List a cohort's students from the Workspace directory.
    URL: /api/google/directory-students/?cohort=28

    Response: {"cohort": "28", "students": [{student_id, first_name, last_name,
               email, google_user_id, exists}]}
    `exists` is computed server-side against the full Student table.
    """
    cohort = request.GET.get("cohort") or ""
    if not (cohort.isdigit() and len(cohort) == 2):
        return Response({"error": "cohort query param (two digits) is required."}, status=400)

    service, error = _get_directory_service(request)
    if error:
        return error

    domain = request.user.email.split('@')[-1]
    try:
        users = _fetch_domain_users(service, domain)
    except Exception as e:
        logger.error(f"Error fetching Workspace directory: {str(e)}")
        return Response(
            {"error": "Failed to fetch the Workspace directory.", "details": str(e)},
            status=502,
        )

    students = [
        _normalize_directory_user(u)
        for u in users
        if _cohort_prefix(u.get("primaryEmail")) == cohort
    ]
    students.sort(key=lambda s: (s["last_name"].lower(), s["first_name"].lower()))
    for s in students:
        s["exists"] = _match_existing_student(s) is not None

    return Response({"cohort": cohort, "students": students})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def google_import_directory_students(request):
    """
    Bulk-create Students for a Workspace directory cohort.
    URL: /api/google/import-directory-students/
    Body: {"cohort": "28"}

    Matches existing students (google_user_id -> student_id -> email iexact),
    backfilling google_user_id/email on matches WITHOUT touching their
    student_id. Creates missing students with the real district ID from
    externalIds. Does NOT enroll anyone in a class.

    Response: {"total", "created": [...], "existing": [...], "skipped": [...]}
    """
    from django.db import transaction

    from .models import Student

    cohort = str(request.data.get("cohort") or "")
    if not (cohort.isdigit() and len(cohort) == 2):
        return Response({"error": "cohort (two digits) is required."}, status=400)

    service, error = _get_directory_service(request)
    if error:
        return error

    domain = request.user.email.split('@')[-1]
    try:
        users = _fetch_domain_users(service, domain)
    except Exception as e:
        logger.error(f"Error fetching Workspace directory for import: {str(e)}")
        return Response(
            {"error": "Failed to fetch the Workspace directory.", "details": str(e)},
            status=502,
        )

    cohort_students = [
        _normalize_directory_user(u)
        for u in users
        if _cohort_prefix(u.get("primaryEmail")) == cohort
    ]

    created, existing, skipped = [], [], []

    with transaction.atomic():
        for gs in cohort_students:
            display_name = f"{gs['first_name']} {gs['last_name']}".strip() or gs["email"]

            student = _match_existing_student(gs)
            if student:
                # Backfill identifiers on the match; never overwrite student_id
                update_fields = []
                if gs["google_user_id"] and not student.google_user_id:
                    student.google_user_id = gs["google_user_id"]
                    update_fields.append("google_user_id")
                if gs["email"] and not student.email:
                    student.email = gs["email"]
                    update_fields.append("email")
                if update_fields:
                    student.save(update_fields=update_fields)
                existing.append(display_name)
                continue

            if not gs["first_name"] and not gs["last_name"]:
                skipped.append({"name": display_name, "reason": "No name in directory profile"})
                continue

            # Prefer the real district ID; fall back if missing or taken
            student_id = gs["student_id"][:20]
            if not student_id or Student.objects.filter(student_id=student_id).exists():
                email_local = gs["email"].split("@")[0] if gs["email"] else ""
                google_fallback = f"G{gs['google_user_id']}" if gs["google_user_id"] else ""
                student_id = _unique_student_id(email_local, google_fallback)
            if not student_id:
                skipped.append({"name": display_name, "reason": "Could not determine a unique student ID"})
                continue

            Student.objects.create(
                student_id=student_id,
                first_name=gs["first_name"][:30],
                last_name=gs["last_name"][:30],
                email=gs["email"] or None,
                google_user_id=gs["google_user_id"] or None,
            )
            created.append({"name": display_name, "student_id": student_id})

    logger.info(
        f"Directory import (cohort {cohort}) by {request.user.email}: "
        f"{len(created)} created, {len(existing)} existing, {len(skipped)} skipped"
    )

    return Response({
        "total": len(cohort_students),
        "created": created,
        "existing": existing,
        "skipped": skipped,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def google_test_directory(request):
    """
    Probe the Admin SDK Directory API with the current user's credentials.
    URL: /api/google/test-directory/

    Tries two access levels and reports both:
    1. Admin access (users.list customer='my_customer') - full directory
    2. Non-admin public view (viewType='domain_public') - whatever the
       domain shares internally

    If the stored token predates the directory scope, returns needs_reconnect
    with an auth_url to re-consent.
    """
    service, error = _get_directory_service(request)
    if error:
        return error

    domain = request.user.email.split('@')[-1]

    def summarize(users):
        return [
            {
                "email": u.get("primaryEmail"),
                "name": u.get("name", {}).get("fullName"),
                "orgUnitPath": u.get("orgUnitPath"),
            }
            for u in users
        ]

    results = {"domain": domain}

    # Attempt 1: full admin access
    try:
        resp = service.users().list(customer="my_customer", maxResults=10).execute()
        results["admin_access"] = {"ok": True, "sample": summarize(resp.get("users", []))}
    except Exception as e:
        results["admin_access"] = {"ok": False, "error": str(e)}

    # Attempt 2: non-admin public view
    try:
        resp = service.users().list(domain=domain, viewType="domain_public", maxResults=10).execute()
        results["public_view"] = {"ok": True, "sample": summarize(resp.get("users", []))}
    except Exception as e:
        results["public_view"] = {"ok": False, "error": str(e)}

    return Response(results)


# ============================================================================
# Classroom Roster Import Endpoints
# ============================================================================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def google_courses(request):
    """
    List the current user's active Google Classroom courses.
    URL: /api/google/courses/

    Returns {"connected": false} if the user hasn't connected Google Classroom.
    """
    if not is_user_connected(request.user):
        return Response({"connected": False, "courses": []})

    courses = get_user_courses(request.user)
    if courses is None:
        return Response(
            {"error": "Failed to fetch courses from Google Classroom. Try reconnecting."},
            status=502,
        )

    return Response({
        "connected": True,
        "courses": [
            {
                "id": c.get("id"),
                "name": c.get("name"),
                "section": c.get("section"),
            }
            for c in courses
        ],
    })


def _fetch_course_students(service, course_id):
    """Fetch the full student roster for a course (handles pagination)."""
    students = []
    page_token = None

    while True:
        response = service.courses().students().list(
            courseId=course_id,
            pageSize=100,
            pageToken=page_token,
        ).execute()

        for s in response.get("students", []):
            profile = s.get("profile", {})
            name = profile.get("name", {})
            students.append({
                "google_user_id": s.get("userId"),
                "first_name": name.get("givenName", ""),
                "last_name": name.get("familyName", ""),
                "full_name": name.get("fullName", ""),
                "email": profile.get("emailAddress") or "",
            })

        page_token = response.get("nextPageToken")
        if not page_token:
            break

    return students


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def google_course_students(request, course_id):
    """
    List the students in a Google Classroom course.
    URL: /api/google/courses/<course_id>/students/
    """
    service = get_google_service(request.user)
    if not service:
        return Response({"error": "Google Classroom not connected."}, status=400)

    try:
        students = _fetch_course_students(service, course_id)
    except Exception as e:
        logger.error(f"Error fetching course roster: {str(e)}")
        return Response(
            {"error": "Failed to fetch roster from Google Classroom.", "details": str(e)},
            status=502,
        )

    return Response({"students": students})


def _unique_student_id(preferred, fallback):
    """Pick an unused student_id (max 20 chars), preferring the email local part."""
    from .models import Student

    candidates = [c for c in (preferred, fallback) if c]
    for base in candidates:
        base = base[:20]
        if not Student.objects.filter(student_id=base).exists():
            return base
        for i in range(2, 100):
            suffix = str(i)
            candidate = base[: 20 - len(suffix)] + suffix
            if not Student.objects.filter(student_id=candidate).exists():
                return candidate
    return None


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def google_import_students(request):
    """
    Import students from a Google Classroom course into a class roster.
    URL: /api/google/import-students/
    Body: {"course_id": "...", "class_id": 1}

    Matches existing students by google_user_id, then by email. Creates
    Student records for unmatched Classroom students, then enrolls everyone
    into the class (reactivating soft-deleted roster entries).
    """
    from .models import Class, ClassRoster, Student

    course_id = request.data.get("course_id")
    class_id = request.data.get("class_id")
    if not course_id or not class_id:
        return Response({"error": "course_id and class_id are required."}, status=400)

    try:
        target_class = Class.objects.get(id=class_id, teacher=request.user)
    except Class.DoesNotExist:
        return Response({"error": "Class not found or you are not its teacher."}, status=404)

    service = get_google_service(request.user)
    if not service:
        return Response({"error": "Google Classroom not connected."}, status=400)

    try:
        google_students = _fetch_course_students(service, course_id)
    except Exception as e:
        logger.error(f"Error fetching course roster for import: {str(e)}")
        return Response(
            {"error": "Failed to fetch roster from Google Classroom.", "details": str(e)},
            status=502,
        )

    created, enrolled, reenrolled, already_enrolled, skipped = [], [], [], [], []

    for gs in google_students:
        display_name = gs["full_name"] or f"{gs['first_name']} {gs['last_name']}".strip()

        # Match existing student: google_user_id first, then email
        student = None
        if gs["google_user_id"]:
            student = Student.objects.filter(google_user_id=gs["google_user_id"]).first()
        if not student and gs["email"]:
            student = Student.objects.filter(email__iexact=gs["email"]).first()

        if student:
            # Backfill the Google id for faster matching next time
            if gs["google_user_id"] and not student.google_user_id:
                student.google_user_id = gs["google_user_id"]
                student.save(update_fields=["google_user_id"])
        else:
            if not gs["first_name"] and not gs["last_name"]:
                skipped.append({"name": display_name, "reason": "No name in Google profile"})
                continue

            email_local = gs["email"].split("@")[0] if gs["email"] else ""
            google_fallback = f"G{gs['google_user_id']}" if gs["google_user_id"] else ""
            student_id = _unique_student_id(email_local, google_fallback)
            if not student_id:
                skipped.append({"name": display_name, "reason": "Could not generate a unique student ID"})
                continue

            student = Student.objects.create(
                student_id=student_id,
                first_name=gs["first_name"][:30],
                last_name=gs["last_name"][:30],
                email=gs["email"] or None,
                google_user_id=gs["google_user_id"] or None,
            )
            created.append({"name": display_name, "student_id": student_id})

        # Enroll (or reactivate) the student in the class
        roster_entry, was_created = ClassRoster.objects.get_or_create(
            class_assigned=target_class,
            student=student,
            defaults={"is_active": True},
        )
        if was_created:
            enrolled.append(display_name)
        elif not roster_entry.is_active:
            roster_entry.is_active = True
            roster_entry.save(update_fields=["is_active", "updated_at"])
            reenrolled.append(display_name)
        else:
            already_enrolled.append(display_name)

    logger.info(
        f"Classroom import into class {target_class.id} by {request.user.email}: "
        f"{len(created)} created, {len(enrolled)} enrolled, {len(reenrolled)} re-enrolled, "
        f"{len(already_enrolled)} already enrolled, {len(skipped)} skipped"
    )

    return Response({
        "total": len(google_students),
        "created": created,
        "enrolled": enrolled,
        "reenrolled": reenrolled,
        "already_enrolled": already_enrolled,
        "skipped": skipped,
    })


# ============================================================================
# Helper Functions
# ============================================================================

def get_google_service(user):
    """
    Helper to get authenticated Google Classroom service for a user
    Returns None if user is not connected
    """
    try:
        creds_obj = GoogleClassroomCredentials.objects.get(user=user)

        # Build credentials
        creds = Credentials(
            token=creds_obj.access_token,
            refresh_token=creds_obj.refresh_token,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=creds_obj.scopes or settings.GOOGLE_SCOPES
        )

        # Check if token needs refresh
        if creds.expired and creds.refresh_token:
            from google.auth.transport.requests import Request
            creds.refresh(Request())

            # Update stored tokens
            creds_obj.access_token = creds.token
            creds_obj.token_expiry = creds.expiry
            creds_obj.save(update_fields=['access_token', 'token_expiry', 'updated_at'])

            logger.info(f"Refreshed token for user {user.email}")

        return build('classroom', 'v1', credentials=creds)

    except GoogleClassroomCredentials.DoesNotExist:
        logger.warning(f"No Google credentials found for user {user.email}")
        return None
    except Exception as e:
        logger.error(f"Error getting Google service for user {user.email}: {str(e)}")
        return None


def is_user_connected(user):
    """
    Check if user has connected their Google Classroom account
    """
    return GoogleClassroomCredentials.objects.filter(user=user).exists()


def get_user_courses(user):
    """
    Get all courses for a connected user
    Returns list of courses or None if not connected
    """
    service = get_google_service(user)
    if not service:
        return None

    try:
        courses = []
        page_token = None

        while True:
            response = service.courses().list(
                pageSize=100,
                pageToken=page_token,
                courseStates=['ACTIVE']
            ).execute()

            courses.extend(response.get('courses', []))
            page_token = response.get('nextPageToken')

            if not page_token:
                break

        return courses

    except Exception as e:
        logger.error(f"Error fetching courses for user {user.email}: {str(e)}")
        return None


# ============================================================================
# Future Enhancement Functions (Placeholders)
# ============================================================================

def create_assignment(user, course_id, title, description, max_points=100, due_date=None):
    """
    Create an assignment in Google Classroom

    Args:
        user: Django user object
        course_id: Google Classroom course ID
        title: Assignment title
        description: Assignment description
        max_points: Maximum points for the assignment (default 100)
        due_date: Optional due date (datetime object)

    Returns:
        Created assignment object from Google Classroom API
    """
    service = get_google_service(user)
    if not service:
        raise Exception("User not connected to Google Classroom")

    # Build the assignment body
    coursework_body = {
        'title': title,
        'description': description,
        'materials': [],
        'state': 'PUBLISHED',
        'workType': 'ASSIGNMENT',
        'maxPoints': max_points
    }

    # Add due date if provided
    if due_date:
        coursework_body['dueDate'] = {
            'year': due_date.year,
            'month': due_date.month,
            'day': due_date.day
        }
        coursework_body['dueTime'] = {
            'hours': due_date.hour if hasattr(due_date, 'hour') else 23,
            'minutes': due_date.minute if hasattr(due_date, 'minute') else 59
        }

    try:
        # Create the assignment
        coursework = service.courses().courseWork().create(
            courseId=course_id,
            body=coursework_body
        ).execute()

        logger.info(f"Created assignment '{title}' in course {course_id}")
        return coursework

    except Exception as e:
        logger.error(f"Error creating assignment: {str(e)}")
        raise


def post_grades(user, course_id, assignment_id, grades_dict):
    """
    Post grades for an assignment
    grades_dict: {student_id: grade}
    TODO: Implement this function
    """
    service = get_google_service(user)
    if not service:
        raise Exception("User not connected to Google Classroom")

    # TODO: Implement grade posting
    # For each student:
    # service.courses().courseWork().studentSubmissions().patch(...)
    pass


def test_fetch_assignment_details(request):
    """
    Test endpoint to inspect assignment and submission data
    URL: /api/google/test-assignment-details/

    This will help us understand:
    1. What fields are available in assignment (courseWork) objects
    2. What student submission data looks like
    3. What student profile information we can access
    4. How to match Google students to our local students
    """
    try:
        # Get service using test user
        from .models import User
        test_user = User.objects.first()
        if not test_user:
            return JsonResponse({'error': 'No test user found'}, status=400)

        service = get_google_service(test_user)
        if not service:
            return JsonResponse({
                'error': 'User not connected to Google Classroom',
                'connect_url': reverse('google_auth_start')
            }, status=404)

        # 1. Find the "Advisory/Homeroom 2025-2026" course
        logger.info("Fetching courses...")
        courses_response = service.courses().list(
            pageSize=100,
            courseStates=['ACTIVE']
        ).execute()

        temp_test_course = None
        for course in courses_response.get('courses', []):
            if 'Advisory/Homeroom 2025-2026' in course.get('name', ''):
                temp_test_course = course
                logger.info(f"Found course: {course.get('name')} (ID: {course.get('id')})")
                break

        if not temp_test_course:
            return JsonResponse({
                'error': 'Course "Advisory/Homeroom 2025-2026" not found',
                'available_courses': [c.get('name') for c in courses_response.get('courses', [])]
            }, status=404)

        # 2. List all assignments in the course
        logger.info(f"Fetching assignments for course {temp_test_course['id']}...")
        coursework_response = service.courses().courseWork().list(
            courseId=temp_test_course['id'],
            orderBy='updateTime desc'
        ).execute()

        # 3. Find the specific assignment
        target_assignment = None
        all_assignments = coursework_response.get('courseWork', [])
        for work in all_assignments:
            if 'Back to School Selfies' in work.get('title', ''):
                target_assignment = work
                logger.info(f"Found assignment: {work.get('title')} (ID: {work.get('id')})")
                break

        if not target_assignment:
            return JsonResponse({
                'error': 'Assignment "Back to School Selfies" not found',
                'available_assignments': [w.get('title') for w in all_assignments]
            }, status=404)

        # 4. Get all student submissions for this assignment
        logger.info(f"Fetching submissions for assignment {target_assignment['id']}...")
        submissions_response = service.courses().courseWork().studentSubmissions().list(
            courseId=temp_test_course['id'],
            courseWorkId=target_assignment['id'],
            pageSize=100
        ).execute()

        # 5. Get student roster with profiles
        logger.info("Fetching student roster...")
        students_response = service.courses().students().list(
            courseId=temp_test_course['id'],
            pageSize=100
        ).execute()

        # 6. For each student, try to get their full profile (if we have permission)
        student_profiles = []
        for student in students_response.get('students', []):
            try:
                # Try to get full profile
                profile = service.userProfiles().get(
                    userId=student.get('userId')
                ).execute()
                student_profiles.append(profile)
            except Exception as e:
                logger.warning(f"Could not fetch profile for user {student.get('userId')}: {e}")
                student_profiles.append(student)  # Use basic info we have

        # 7. Create comprehensive response showing all available data
        response_data = {
            'test_info': {
                'purpose': 'Inspect Google Classroom data structure',
                'timestamp': timezone.now().isoformat(),
                'user': test_user.email
            },
            'course': {
                'full_data': temp_test_course,
                'key_fields': {
                    'id': temp_test_course.get('id'),
                    'name': temp_test_course.get('name'),
                    'section': temp_test_course.get('section'),
                    'enrollmentCode': temp_test_course.get('enrollmentCode')
                }
            },
            'assignment': {
                'full_data': target_assignment,
                'key_fields': {
                    'id': target_assignment.get('id'),
                    'title': target_assignment.get('title'),
                    'maxPoints': target_assignment.get('maxPoints'),
                    'state': target_assignment.get('state'),
                    'workType': target_assignment.get('workType')
                }
            },
            'submissions': {
                'count': len(submissions_response.get('studentSubmissions', [])),
                'sample': submissions_response.get('studentSubmissions', [])[:3],  # First 3 as sample
                'all_submissions': submissions_response.get('studentSubmissions', []),
                'key_fields_per_submission': [
                    {
                        'submissionId': sub.get('id'),
                        'userId': sub.get('userId'),
                        'state': sub.get('state'),
                        'draftGrade': sub.get('draftGrade'),
                        'assignedGrade': sub.get('assignedGrade')
                    }
                    for sub in submissions_response.get('studentSubmissions', [])
                ]
            },
            'students': {
                'count': len(students_response.get('students', [])),
                'raw_roster': students_response.get('students', []),
                'profiles': student_profiles,
                'extracted_info': [
                    {
                        'userId': s.get('userId'),
                        'profile': s.get('profile', {}),
                        'name': s.get('profile', {}).get('name', {}),
                        'emailAddress': s.get('profile', {}).get('emailAddress', 'NOT_PROVIDED'),
                        'fullName': s.get('profile', {}).get('name', {}).get('fullName', 'UNKNOWN'),
                        'givenName': s.get('profile', {}).get('name', {}).get('givenName', 'UNKNOWN'),
                        'familyName': s.get('profile', {}).get('name', {}).get('familyName', 'UNKNOWN')
                    }
                    for s in students_response.get('students', [])
                ]
            },
            'analysis': {
                'has_email_access': any(
                    s.get('profile', {}).get('emailAddress')
                    for s in students_response.get('students', [])
                ),
                'fields_available': list(target_assignment.keys()) if target_assignment else [],
                'submission_fields': list(submissions_response.get('studentSubmissions', [{}])[0].keys()) if submissions_response.get('studentSubmissions') else [],
                'student_fields': list(students_response.get('students', [{}])[0].keys()) if students_response.get('students') else []
            }
        }

        return JsonResponse(response_data, json_dumps_params={'indent': 2})

    except Exception as e:
        logger.error(f"Error in test_fetch_assignment_details: {str(e)}")
        import traceback
        return JsonResponse({
            'error': str(e),
            'traceback': traceback.format_exc()
        }, status=500)