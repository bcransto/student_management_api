from datetime import date, timedelta
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from .models import (
    Class,
    ClassRoster,
    ClassroomLayout,
    ClassroomTable,
    SeatingAssignment,
    SeatingPeriod,
    Student,
    TableSeat,
    User,
)


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


class UntrackedSeatingPeriodTests(TestCase):
    def setUp(self):
        self.teacher = make_user()
        self.klass = Class.objects.create(name="Science", subject="Science", teacher=self.teacher)
        self.layout = ClassroomLayout.objects.create(
            name="Room 1", room_width=10, room_height=8, created_by=self.teacher
        )
        table = ClassroomTable.objects.create(
            layout=self.layout,
            table_number=1,
            table_name="Table 1",
            x_position=0,
            y_position=0,
            width=2,
            height=2,
            max_seats=2,
        )
        for seat_number in (1, 2):
            TableSeat.objects.create(
                table=table,
                seat_number=seat_number,
                relative_x=0.25 * seat_number,
                relative_y=0.5,
            )
        self.current = SeatingPeriod.objects.create(
            class_assigned=self.klass,
            layout=self.layout,
            name="Chart 1",
            start_date=date.today() - timedelta(days=10),
            end_date=None,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.teacher)

    def make_period(self, name, **kwargs):
        defaults = {
            "class_assigned": self.klass,
            "layout": self.layout,
            "start_date": date.today(),
            "end_date": None,
        }
        defaults.update(kwargs)
        return SeatingPeriod.objects.create(name=name, **defaults)

    def test_untracked_period_does_not_end_current(self):
        self.make_period("Sub Day", is_tracked=False)
        self.current.refresh_from_db()
        self.assertIsNone(self.current.end_date)

    def test_new_tracked_period_ends_current_but_not_untracked(self):
        one_off = self.make_period("Sub Day", is_tracked=False)
        self.make_period("Chart 2")

        self.current.refresh_from_db()
        one_off.refresh_from_db()
        self.assertIsNotNone(self.current.end_date)  # real current was ended
        self.assertIsNone(one_off.end_date)  # one-off untouched

    def test_current_seating_period_ignores_untracked(self):
        self.make_period("Sub Day", is_tracked=False)
        self.assertEqual(self.klass.current_seating_period, self.current)

    def test_partnership_history_excludes_untracked_periods(self):
        students = []
        for i in range(2):
            s = Student.objects.create(
                student_id=f"s{i}", first_name=f"Kid{i}", last_name="Test", nickname=""
            )
            students.append(ClassRoster.objects.create(class_assigned=self.klass, student=s))

        # A completed untracked chart where the two students sat together
        one_off = self.make_period(
            "Sub Day", is_tracked=False, end_date=date.today() - timedelta(days=1)
        )
        for i, roster_entry in enumerate(students):
            SeatingAssignment.objects.create(
                seating_period=one_off, roster_entry=roster_entry, seat_id=f"1-{i + 1}"
            )

        response = self.client.get(f"/api/classes/{self.klass.id}/partnership-history/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["partnership_data"], {})

        # Same seating in a completed TRACKED period does count
        tracked = self.make_period(
            "Chart 0", end_date=date.today() - timedelta(days=2), start_date=date.today() - timedelta(days=5)
        )
        for i, roster_entry in enumerate(students):
            SeatingAssignment.objects.create(
                seating_period=tracked, roster_entry=roster_entry, seat_id=f"1-{i + 1}"
            )

        response = self.client.get(f"/api/classes/{self.klass.id}/partnership-history/")
        self.assertNotEqual(response.json()["partnership_data"], {})

    def test_make_current_promotes_untracked_period(self):
        one_off = self.make_period(
            "Sub Day", is_tracked=False, end_date=date.today() - timedelta(days=1)
        )
        response = self.client.post(f"/api/seating-periods/{one_off.id}/make_current/")
        self.assertEqual(response.status_code, 200)

        one_off.refresh_from_db()
        self.current.refresh_from_db()
        self.assertTrue(one_off.is_tracked)  # promoted to a real period
        self.assertIsNone(one_off.end_date)
        self.assertIsNotNone(self.current.end_date)  # old current ended

    def test_serializer_exposes_is_tracked(self):
        one_off = self.make_period("Sub Day", is_tracked=False)
        response = self.client.get(f"/api/seating-periods/{one_off.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["is_tracked"])

    def test_period_can_be_created_untracked_via_api(self):
        response = self.client.post(
            "/api/seating-periods/",
            {
                "class_assigned": self.klass.id,
                "layout": self.layout.id,
                "name": "One-Off 7/6",
                "start_date": str(date.today()),
                "end_date": None,
                "is_tracked": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.json()["is_tracked"])
        self.current.refresh_from_db()
        self.assertIsNone(self.current.end_date)  # current period untouched
