from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from .models import Class, ClassRoster, Student, User


def make_user(email="teacher@school.edu", username="teacher"):
    return User.objects.create_user(
        username=username,
        email=email,
        password="testpass123",
        first_name="Test",
        last_name="Teacher",
    )


GOOGLE_ROSTER = [
    {
        "google_user_id": "g-111",
        "first_name": "Alice",
        "last_name": "Anderson",
        "full_name": "Alice Anderson",
        "email": "aanderson@school.edu",
    },
    {
        "google_user_id": "g-222",
        "first_name": "Bob",
        "last_name": "Baker",
        "full_name": "Bob Baker",
        "email": "bbaker@school.edu",
    },
]


class GoogleImportStudentsTests(TestCase):
    def setUp(self):
        self.teacher = make_user()
        self.klass = Class.objects.create(name="Science", subject="Science", teacher=self.teacher)
        self.client = APIClient()
        self.client.force_authenticate(user=self.teacher)

    def run_import(self, roster, class_id=None):
        with patch(
            "students.google_classroom_service.get_google_service", return_value=object()
        ), patch(
            "students.google_classroom_service._fetch_course_students", return_value=roster
        ):
            return self.client.post(
                "/api/google/import-students/",
                {"course_id": "course-1", "class_id": class_id or self.klass.id},
                format="json",
            )

    def test_creates_and_enrolls_new_students(self):
        response = self.run_import(GOOGLE_ROSTER)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["created"]), 2)
        self.assertEqual(len(data["enrolled"]), 2)

        alice = Student.objects.get(google_user_id="g-111")
        self.assertEqual(alice.first_name, "Alice")
        self.assertEqual(alice.student_id, "aanderson")  # email local part
        self.assertEqual(alice.nickname, "Alice")  # auto-populated
        self.assertTrue(
            ClassRoster.objects.filter(
                class_assigned=self.klass, student=alice, is_active=True
            ).exists()
        )

    def test_matches_existing_student_by_email_and_backfills_google_id(self):
        existing = Student.objects.create(
            student_id="1234",
            first_name="Alice",
            last_name="Anderson",
            nickname="",
            email="AAnderson@School.edu",  # different case
        )
        response = self.run_import([GOOGLE_ROSTER[0]])
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["created"]), 0)
        self.assertEqual(len(data["enrolled"]), 1)

        existing.refresh_from_db()
        self.assertEqual(existing.google_user_id, "g-111")
        self.assertEqual(Student.objects.count(), 1)

    def test_reactivates_soft_deleted_roster_entry(self):
        existing = Student.objects.create(
            student_id="1234",
            first_name="Alice",
            last_name="Anderson",
            nickname="",
            email="aanderson@school.edu",
        )
        ClassRoster.objects.create(
            class_assigned=self.klass, student=existing, is_active=False
        )
        response = self.run_import([GOOGLE_ROSTER[0]])
        data = response.json()
        self.assertEqual(len(data["reenrolled"]), 1)
        self.assertTrue(
            ClassRoster.objects.get(class_assigned=self.klass, student=existing).is_active
        )

    def test_already_enrolled_students_are_reported(self):
        response = self.run_import(GOOGLE_ROSTER)
        self.assertEqual(response.status_code, 200)
        response = self.run_import(GOOGLE_ROSTER)
        data = response.json()
        self.assertEqual(len(data["already_enrolled"]), 2)
        self.assertEqual(len(data["created"]), 0)

    def test_student_id_collision_gets_suffix(self):
        Student.objects.create(
            student_id="aanderson",
            first_name="Other",
            last_name="Person",
            nickname="",
        )
        response = self.run_import([GOOGLE_ROSTER[0]])
        self.assertEqual(response.status_code, 200)
        alice = Student.objects.get(google_user_id="g-111")
        self.assertEqual(alice.student_id, "aanderson2")  # base + numeric suffix

    def test_rejects_class_not_owned_by_requester(self):
        other = make_user(email="other@school.edu", username="other")
        other_class = Class.objects.create(name="Math", subject="Math", teacher=other)
        response = self.run_import(GOOGLE_ROSTER, class_id=other_class.id)
        self.assertEqual(response.status_code, 404)

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.post("/api/google/import-students/", {}, format="json")
        self.assertEqual(response.status_code, 401)


class GoogleSigninTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_get_returns_client_id(self):
        response = self.client.get("/api/auth/google/signin/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("client_id", response.json())

    def test_post_without_credential_is_rejected(self):
        response = self.client.post("/api/auth/google/signin/", {}, format="json")
        self.assertEqual(response.status_code, 400)

    @patch("students.google_classroom_service.google_id_token.verify_oauth2_token")
    def test_existing_user_gets_tokens(self, mock_verify):
        user = make_user()
        mock_verify.return_value = {"email": "Teacher@School.edu", "email_verified": True}
        response = self.client.post(
            "/api/auth/google/signin/", {"credential": "fake"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("access", data)
        self.assertIn("refresh", data)

        # Access token carries the custom claims used by the frontend
        import jwt

        payload = jwt.decode(data["access"], options={"verify_signature": False})
        self.assertEqual(payload["email"], user.email)
        self.assertEqual(payload["user_id"], user.id)

    @patch("students.google_classroom_service.google_id_token.verify_oauth2_token")
    def test_unknown_email_is_rejected(self, mock_verify):
        mock_verify.return_value = {"email": "stranger@school.edu", "email_verified": True}
        response = self.client.post(
            "/api/auth/google/signin/", {"credential": "fake"}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    @patch("students.google_classroom_service.google_id_token.verify_oauth2_token")
    def test_unverified_email_is_rejected(self, mock_verify):
        make_user()
        mock_verify.return_value = {"email": "teacher@school.edu", "email_verified": False}
        response = self.client.post(
            "/api/auth/google/signin/", {"credential": "fake"}, format="json"
        )
        self.assertEqual(response.status_code, 401)

    @patch("students.google_classroom_service.google_id_token.verify_oauth2_token")
    def test_invalid_token_is_rejected(self, mock_verify):
        mock_verify.side_effect = ValueError("bad token")
        response = self.client.post(
            "/api/auth/google/signin/", {"credential": "garbage"}, format="json"
        )
        self.assertEqual(response.status_code, 401)
