"""
Google Classroom OAuth Integration Service
Handles OAuth flow, token storage, and API interactions
"""

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from django.shortcuts import redirect
from django.http import JsonResponse
from django.urls import reverse
from django.contrib.auth.decorators import login_required
from django.conf import settings
from django.utils import timezone
from .models import GoogleClassroomCredentials
import logging
import os
import certifi

logger = logging.getLogger(__name__)


# ============================================================================
# OAuth Flow Functions
# ============================================================================

def google_auth_start(request):
    """
    Start OAuth flow - visit this URL to connect to Google Classroom
    URL: /api/auth/google/start/
    """
    try:
        # Create OAuth flow instance
        flow = Flow.from_client_config(
            settings.GOOGLE_OAUTH_CONFIG,
            scopes=settings.GOOGLE_SCOPES,
            redirect_uri=request.build_absolute_uri(reverse('google_auth_callback'))
        )

        # Generate authorization URL
        auth_url, state = flow.authorization_url(
            prompt='consent',  # Always show consent screen
            access_type='offline',  # Request refresh token
            include_granted_scopes='true'
        )

        # Store state in session for security
        request.session['oauth_state'] = state

        logger.info("Starting OAuth flow")
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

    # Verify state for security (CSRF protection)
    state = request.GET.get('state')
    stored_state = request.session.get('oauth_state')
    if not stored_state or state != stored_state:
        logger.warning("State mismatch in OAuth callback")
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

        # Store tokens in database
        # For testing: use the first user or create a test association
        from .models import User
        # Get the first user for testing (you should replace this with proper auth)
        test_user = User.objects.first()
        if not test_user:
            return JsonResponse({
                'error': 'No users in database. Please create a user first.'
            }, status=400)

        GoogleClassroomCredentials.objects.update_or_create(
            user=test_user,
            defaults={
                'access_token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'token_expiry': credentials.expiry,
                'scopes': list(credentials.scopes) if credentials.scopes else settings.GOOGLE_SCOPES,
            }
        )

        # Clear state from session
        if 'oauth_state' in request.session:
            del request.session['oauth_state']

        logger.info(f"Successfully connected Google Classroom for user {test_user.email}")

        # Return success response
        return JsonResponse({
            'status': 'success',
            'message': 'Successfully connected to Google Classroom',
            'user': test_user.email,
            'scopes': list(credentials.scopes) if credentials.scopes else settings.GOOGLE_SCOPES
        })

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


@login_required
def google_disconnect(request):
    """
    Disconnect Google Classroom (remove stored credentials)
    URL: /api/google/disconnect/
    """
    try:
        # Delete user's credentials
        GoogleClassroomCredentials.objects.filter(user=request.user).delete()

        logger.info(f"Disconnected Google Classroom for user {request.user.email}")

        return JsonResponse({
            'status': 'disconnected',
            'message': 'Successfully disconnected from Google Classroom'
        })
    except Exception as e:
        logger.error(f"Error disconnecting: {str(e)}")
        return JsonResponse({
            'error': 'Failed to disconnect',
            'details': str(e)
        }, status=500)


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