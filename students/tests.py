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
    TeacherStudent,
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
        self.assertTrue(
            ClassRoster.objects.filter(
                class_assigned=self.klass, student=alice, is_active=True
            ).exists()
        )
        # Phase 2: Classroom import also adds each student to the importer's
        # list (blank annotations).
        self.assertTrue(
            TeacherStudent.objects.filter(
                teacher=self.teacher, student=alice, is_active=True
            ).exists()
        )

    def test_matches_existing_student_by_email_and_backfills_google_id(self):
        existing = Student.objects.create(
            student_id="1234",
            first_name="Alice",
            last_name="Anderson",
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
                student_id=f"s{i}", first_name=f"Kid{i}", last_name="Test"
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

    def test_make_current_promotes_open_untracked_period(self):
        # An OPEN one-off (end_date=None) is not "already current" - the
        # bolt toggle uses make_current to re-track it in place
        one_off = self.make_period("Sub Day", is_tracked=False, end_date=None)
        response = self.client.post(f"/api/seating-periods/{one_off.id}/make_current/")
        self.assertEqual(response.status_code, 200)

        one_off.refresh_from_db()
        self.current.refresh_from_db()
        self.assertTrue(one_off.is_tracked)
        self.assertIsNone(one_off.end_date)
        self.assertIsNotNone(self.current.end_date)  # old current ended

    def test_make_current_rejects_actual_current_period(self):
        response = self.client.post(f"/api/seating-periods/{self.current.id}/make_current/")
        self.assertEqual(response.status_code, 400)

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


class SeatingPeriodCreateWithAssignmentsTests(TestCase):
    """Atomic create-period-with-assignments endpoint (GH issue #15 draft save)."""

    def setUp(self):
        self.teacher = make_user()
        self.other_teacher = make_user(email="other@school.edu", username="other")
        self.klass = Class.objects.create(name="Math", subject="Math", teacher=self.teacher)
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
        self.roster_entries = []
        for i in range(2):
            student = Student.objects.create(
                student_id=f"cwa{i}", first_name=f"Kid{i}", last_name="Test"
            )
            self.roster_entries.append(
                ClassRoster.objects.create(class_assigned=self.klass, student=student)
            )
        self.client = APIClient()
        self.client.force_authenticate(user=self.teacher)

    def test_creates_period_ends_previous_and_creates_assignments(self):
        response = self.client.post(
            "/api/seating-periods/create-with-assignments/",
            {
                "class_assigned": self.klass.id,
                "layout": self.layout.id,
                "name": "Chart 2",
                "start_date": str(date.today() + timedelta(days=1)),
                "assignments": [
                    {"roster_entry": self.roster_entries[0].id, "seat_id": "1-1"},
                    {"roster_entry": self.roster_entries[1].id, "seat_id": "1-2"},
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        self.assertEqual(body["created"], 2)
        new_period_id = body["period"]["id"]

        self.current.refresh_from_db()
        self.assertIsNotNone(self.current.end_date)  # previous period auto-ended

        new_period = SeatingPeriod.objects.get(id=new_period_id)
        self.assertIsNone(new_period.end_date)
        self.assertTrue(new_period.is_tracked)
        self.assertEqual(new_period.seating_assignments.count(), 2)

    def test_rollback_on_bad_assignment_data(self):
        before_count = SeatingPeriod.objects.filter(class_assigned=self.klass).count()

        response = self.client.post(
            "/api/seating-periods/create-with-assignments/",
            {
                "class_assigned": self.klass.id,
                "layout": self.layout.id,
                "name": "Chart 2",
                "start_date": str(date.today() + timedelta(days=1)),
                "assignments": [
                    {"roster_entry": self.roster_entries[0].id, "seat_id": "1-1"},
                    {"roster_entry": self.roster_entries[1].id, "seat_id": "1-99"},  # no such seat
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

        # Nothing committed: no new period, previous period still current
        self.assertEqual(
            SeatingPeriod.objects.filter(class_assigned=self.klass).count(), before_count
        )
        self.assertFalse(SeatingPeriod.objects.filter(name="Chart 2").exists())
        self.current.refresh_from_db()
        self.assertIsNone(self.current.end_date)

    def test_rejects_class_not_owned_by_requester(self):
        other_class = Class.objects.create(
            name="Other Class", subject="Science", teacher=self.other_teacher
        )
        response = self.client.post(
            "/api/seating-periods/create-with-assignments/",
            {
                "class_assigned": other_class.id,
                "layout": self.layout.id,
                "name": "Chart X",
                "start_date": str(date.today() + timedelta(days=1)),
                "assignments": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(SeatingPeriod.objects.filter(name="Chart X").exists())


class BulkUpdateInfoTests(TestCase):
    def setUp(self):
        self.teacher = make_user()
        self.client = APIClient()
        self.client.force_authenticate(user=self.teacher)
        self.alice = Student.objects.create(
            student_id="1001", first_name="Alice", last_name="Anderson",
            email="aanderson@school.edu",
        )
        self.bob = Student.objects.create(
            student_id="1002", first_name="Robert", last_name="Baker",
            email="rbaker@school.edu",
        )
        # Alice's gender is a per-teacher annotation, not a global Student field.
        TeacherStudent.objects.create(
            teacher=self.teacher, student=self.alice, gender="female"
        )

    def annotation(self, student):
        """Fetch (or None) the requesting teacher's annotation for a student."""
        return TeacherStudent.objects.filter(
            teacher=self.teacher, student=student
        ).first()

    def post_text(self, text, apply=False):
        return self.client.post(
            "/api/students/bulk-update-info/", {"text": text, "apply": apply}, format="json"
        )

    def test_tab_and_comma_delimited_parse_identically(self):
        tsv = "student_id\tnickname\n1002\tBob"
        csv = "student_id,nickname\n1002,Bob"
        for text in (tsv, csv):
            response = self.post_text(text)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(len(data["updated"]), 1)
            self.assertEqual(data["updated"][0]["changes"]["nickname"]["to"], "Bob")

    def test_gender_normalization(self):
        response = self.post_text(
            "student_id,gender\n1002,M\n1001,Female", apply=True
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.annotation(self.bob).gender, "male")
        self.assertEqual(
            self.annotation(self.alice).gender, "female"
        )  # unchanged (already female)
        data = response.json()
        self.assertEqual(len(data["updated"]), 1)  # only Bob changed
        self.assertEqual(len(data["unchanged"]), 1)

    def test_invalid_gender_reported(self):
        response = self.post_text("student_id,gender\n1002,banana")
        data = response.json()
        self.assertEqual(len(data["invalid"]), 1)
        self.assertEqual(len(data["updated"]), 0)

    def test_dash_clears_gender(self):
        response = self.post_text("student_id,gender\n1001,-", apply=True)
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(self.annotation(self.alice).gender)

    def test_dry_run_leaves_db_untouched(self):
        response = self.post_text("student_id,nickname,gender\n1002,Bob,m", apply=False)
        data = response.json()
        self.assertFalse(data["applied"])
        self.assertEqual(len(data["updated"]), 1)
        # No annotation created for Bob on a dry run
        self.assertIsNone(self.annotation(self.bob))

    def test_unknown_rows_reported_not_found(self):
        response = self.post_text("student_id\n9999")
        # header lacks nickname/gender column -> 400
        self.assertEqual(response.status_code, 400)
        response = self.post_text("student_id,nickname\n9999,Ghost")
        data = response.json()
        self.assertEqual(len(data["not_found"]), 1)
        self.assertEqual(data["not_found"][0]["value"], "9999")

    def test_id_beats_email_and_conflict_reported(self):
        # student_id points at Bob, email points at Alice
        response = self.post_text(
            "student_id,email,nickname\n1002,aanderson@school.edu,Bobby", apply=True
        )
        data = response.json()
        self.assertEqual(len(data["conflicts"]), 1)
        self.assertEqual(
            self.annotation(self.bob).nickname, "Bobby"
        )  # updated by student_id
        # Alice untouched (no nickname annotation written)
        alice_ann = self.annotation(self.alice)
        self.assertFalse(alice_ann.nickname)

    def test_email_matching_is_case_insensitive(self):
        response = self.post_text("email,nickname\nRBaker@School.edu,Bob", apply=True)
        self.assertEqual(len(response.json()["updated"]), 1)
        self.assertEqual(self.annotation(self.bob).nickname, "Bob")

    def test_empty_cells_change_nothing(self):
        response = self.post_text("student_id,nickname,gender\n1001,,", apply=True)
        data = response.json()
        self.assertEqual(len(data["updated"]), 0)
        self.assertEqual(len(data["unchanged"]), 1)
        self.assertEqual(self.annotation(self.alice).gender, "female")

    def test_annotations_are_per_teacher(self):
        """A second teacher's bulk update never touches the first teacher's rows."""
        other = make_user(email="other@school.edu", username="other")
        self.client.force_authenticate(user=other)
        response = self.post_text("student_id,nickname\n1001,Ali", apply=True)
        self.assertEqual(response.status_code, 200)
        # The other teacher got their own annotation
        self.assertEqual(
            TeacherStudent.objects.get(teacher=other, student=self.alice).nickname, "Ali"
        )
        # The original teacher's annotation is unchanged (no nickname set)
        self.assertFalse(self.annotation(self.alice).nickname)

    def test_bom_and_id_header_synonym_accepted(self):
        response = self.post_text("﻿id,nickname\n1002,Bob")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["updated"]), 1)

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.post_text("student_id,nickname\n1001,A")
        self.assertEqual(response.status_code, 401)


class TeacherStudentAnnotationTests(TestCase):
    """Serializer indirection through the per-teacher annotation layer."""

    def setUp(self):
        self.teacher = make_user()
        self.other = make_user(email="other@school.edu", username="other")
        self.client = APIClient()
        self.client.force_authenticate(user=self.teacher)
        self.student = Student.objects.create(
            student_id="1001", first_name="Alexander", last_name="Anderson",
            email="aanderson@school.edu",
        )
        # The student must be on the teacher's list to be retrievable/editable
        # (phase 2 scoping). A blank row carries no annotation values, so the
        # fallback behavior below is still exercised.
        TeacherStudent.objects.create(teacher=self.teacher, student=self.student)

    def test_nickname_falls_back_to_first_name_without_annotation(self):
        response = self.client.get(f"/api/students/{self.student.id}/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["nickname"], "Alexander")  # first_name fallback
        self.assertIsNone(data["gender"])
        self.assertFalse(data["preferential_seating"])

    def test_student_serializer_round_trips_annotation_per_teacher(self):
        response = self.client.patch(
            f"/api/students/{self.student.id}/",
            {"nickname": "Alex", "gender": "male", "preferential_seating": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["nickname"], "Alex")
        self.assertEqual(data["gender"], "male")
        self.assertTrue(data["preferential_seating"])

        # Persisted to the requesting teacher's TeacherStudent row only
        annotation = TeacherStudent.objects.get(teacher=self.teacher, student=self.student)
        self.assertEqual(annotation.nickname, "Alex")
        self.assertEqual(annotation.gender, "male")
        self.assertTrue(annotation.preferential_seating)

    def test_annotations_do_not_leak_between_teachers(self):
        # setUp already gave self.teacher a blank row; set annotation values.
        ts = TeacherStudent.objects.get(teacher=self.teacher, student=self.student)
        ts.nickname = "Alex"
        ts.gender = "male"
        ts.preferential_seating = True
        ts.save()
        # The other teacher also has the student on their list, but with their
        # own (blank) row - they must see defaults, not teacher's annotation.
        TeacherStudent.objects.create(teacher=self.other, student=self.student)
        self.client.force_authenticate(user=self.other)
        response = self.client.get(f"/api/students/{self.student.id}/")
        data = response.json()
        self.assertEqual(data["nickname"], "Alexander")  # fallback, not "Alex"
        self.assertIsNone(data["gender"])
        self.assertFalse(data["preferential_seating"])

    def test_class_roster_resolves_through_class_teacher(self):
        """A class's roster uses the CLASS TEACHER's annotation, not the viewer's."""
        klass = Class.objects.create(name="Science", subject="Science", teacher=self.teacher)
        ClassRoster.objects.create(class_assigned=klass, student=self.student)
        # setUp already created a blank row for this teacher; set values on it.
        TeacherStudent.objects.filter(
            teacher=self.teacher, student=self.student
        ).update(nickname="Alex", gender="female")
        response = self.client.get(f"/api/classes/{klass.id}/")
        self.assertEqual(response.status_code, 200)
        roster = response.json()["roster"]
        self.assertEqual(len(roster), 1)
        self.assertEqual(roster[0]["student_nickname"], "Alex")
        self.assertEqual(roster[0]["student_gender"], "female")


DIRECTORY_FIXTURE = [
    {
        "primaryEmail": "28abrenn@school.edu",
        "name": {"givenName": "Anika", "familyName": "Brenne"},
        "externalIds": [{"value": "2887", "type": "organization"}],
        "id": "g-2887",
    },
    {
        "primaryEmail": "28zgomez@school.edu",
        "name": {"givenName": "Zoe", "familyName": "Gomez"},
        "externalIds": [{"value": "2901", "type": "organization"}],
        "id": "g-2901",
    },
    {
        "primaryEmail": "27old@school.edu",
        "name": {"givenName": "Old", "familyName": "Cohort"},
        "externalIds": [{"value": "2700", "type": "organization"}],
        "id": "g-2700",
    },
    {
        "primaryEmail": "teacher@school.edu",
        "name": {"givenName": "Staff", "familyName": "Member"},
        "id": "g-staff",
    },
    {
        "primaryEmail": "28noname@school.edu",
        "name": {},
        "id": "g-noname",
    },
]


class GoogleDirectoryImportTests(TestCase):
    def setUp(self):
        self.teacher = make_user()
        self.client = APIClient()
        self.client.force_authenticate(user=self.teacher)

    def with_directory(self, method, url, body=None):
        with patch(
            "students.google_classroom_service._get_directory_service",
            return_value=(object(), None),
        ), patch(
            "students.google_classroom_service._fetch_domain_users",
            return_value=DIRECTORY_FIXTURE,
        ):
            if method == "get":
                return self.client.get(url)
            return self.client.post(url, body or {}, format="json")

    def test_cohorts_grouped_and_staff_excluded(self):
        response = self.with_directory("get", "/api/google/directory-cohorts/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["connected"])
        self.assertEqual(
            data["cohorts"],
            [{"cohort": "27", "count": 1}, {"cohort": "28", "count": 3}],
        )

    def test_directory_students_exists_flags(self):
        Student.objects.create(
            student_id="2887", first_name="Anika", last_name="Brenne"
        )
        Student.objects.create(
            student_id="x1", first_name="Zoe", last_name="G",
            email="28ZGomez@School.edu",  # case differs - email match
        )
        response = self.with_directory("get", "/api/google/directory-students/?cohort=28")
        self.assertEqual(response.status_code, 200)
        students = response.json()["students"]
        by_email = {s["email"]: s for s in students}
        self.assertTrue(by_email["28abrenn@school.edu"]["exists"])  # by student_id
        self.assertTrue(by_email["28zgomez@school.edu"]["exists"])  # by email
        self.assertFalse(by_email["28noname@school.edu"]["exists"])

    def test_directory_students_requires_cohort(self):
        response = self.with_directory("get", "/api/google/directory-students/")
        self.assertEqual(response.status_code, 400)

    def test_import_creates_with_real_ids_and_backfills(self):
        existing = Student.objects.create(
            student_id="emailderived", first_name="Zoe", last_name="Gomez",
            email="28zgomez@school.edu",
        )
        response = self.with_directory(
            "post", "/api/google/import-directory-students/", {"cohort": "28"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total"], 3)
        self.assertEqual(len(data["created"]), 1)  # Anika
        self.assertEqual(len(data["existing"]), 1)  # Zoe matched by email
        self.assertEqual(len(data["skipped"]), 1)  # no-name record

        anika = Student.objects.get(student_id="2887")
        self.assertEqual(anika.first_name, "Anika")
        self.assertEqual(anika.google_user_id, "g-2887")
        # Phase 2: importing adds every created/matched student to the
        # importing teacher's list, with blank annotations.
        anika_ts = anika.teacher_annotations.get(teacher=self.teacher)
        self.assertTrue(anika_ts.is_active)
        self.assertFalse(anika_ts.nickname)
        self.assertIsNone(anika_ts.gender)

        existing.refresh_from_db()
        self.assertEqual(existing.student_id, "emailderived")  # never overwritten
        self.assertEqual(existing.google_user_id, "g-2901")  # backfilled
        # The matched (existing) student is also added to the importer's list
        self.assertTrue(
            existing.teacher_annotations.filter(
                teacher=self.teacher, is_active=True
            ).exists()
        )
        self.assertEqual(ClassRoster.objects.count(), 0)  # no enrollment

    def test_import_is_idempotent(self):
        self.with_directory("post", "/api/google/import-directory-students/", {"cohort": "28"})
        response = self.with_directory(
            "post", "/api/google/import-directory-students/", {"cohort": "28"}
        )
        data = response.json()
        self.assertEqual(len(data["created"]), 0)
        self.assertEqual(len(data["existing"]), 2)
        self.assertEqual(Student.objects.count(), 2)

    def test_needs_reconnect_when_scope_missing(self):
        from students.google_classroom_service import DIRECTORY_SCOPE
        from students.models import GoogleClassroomCredentials

        GoogleClassroomCredentials.objects.create(
            user=self.teacher,
            access_token="t", refresh_token="r",
            token_expiry="2030-01-01T00:00:00Z",
            scopes=["https://www.googleapis.com/auth/classroom.courses.readonly"],
        )
        response = self.client.get("/api/google/directory-cohorts/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["needs_reconnect"])
        self.assertIn("auth_url", data)


class GoogleStatusAndDisconnectTests(TestCase):
    """JWT-authenticated status + disconnect endpoints (issue #10)."""

    def setUp(self):
        self.teacher = make_user()
        self.client = APIClient()
        self.client.force_authenticate(user=self.teacher)

    def test_status_reports_not_connected(self):
        response = self.client.get("/api/google/status/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"connected": False})

    def test_status_reports_connected_with_metadata(self):
        from students.models import GoogleClassroomCredentials

        GoogleClassroomCredentials.objects.create(
            user=self.teacher,
            access_token="t", refresh_token="r",
            token_expiry="2030-01-01T00:00:00Z",
            scopes=["https://www.googleapis.com/auth/classroom.courses.readonly"],
        )
        response = self.client.get("/api/google/status/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["connected"])
        self.assertIn("token_expiry", data)
        self.assertIn("scopes", data)
        self.assertNotIn("access_token", data)
        self.assertNotIn("refresh_token", data)

    def test_status_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.get("/api/google/status/")
        self.assertEqual(response.status_code, 401)

    def test_disconnect_removes_credentials(self):
        from students.models import GoogleClassroomCredentials

        GoogleClassroomCredentials.objects.create(
            user=self.teacher,
            access_token="t", refresh_token="r",
            token_expiry="2030-01-01T00:00:00Z",
            scopes=[],
        )
        response = self.client.post("/api/google/disconnect/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "disconnected")
        self.assertFalse(
            GoogleClassroomCredentials.objects.filter(user=self.teacher).exists()
        )

    def test_disconnect_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.post("/api/google/disconnect/")
        self.assertEqual(response.status_code, 401)

    def test_disconnect_rejects_get(self):
        response = self.client.get("/api/google/disconnect/")
        self.assertEqual(response.status_code, 405)


class StudentScopeTests(TestCase):
    """Phase 2: my-students scoping, disabled creation, sync-owned read-only."""

    def setUp(self):
        self.teacher = make_user()
        self.other = make_user(email="other@school.edu", username="other")
        self.client = APIClient()
        self.client.force_authenticate(user=self.teacher)

        self.mine = Student.objects.create(
            student_id="1001", first_name="Mine", last_name="Student",
            email="mine@school.edu", cohort="28",
        )
        self.theirs = Student.objects.create(
            student_id="1002", first_name="Their", last_name="Student",
            email="their@school.edu", cohort="28",
        )
        TeacherStudent.objects.create(teacher=self.teacher, student=self.mine)
        TeacherStudent.objects.create(teacher=self.other, student=self.theirs)

    def test_list_is_scoped_to_my_students(self):
        response = self.client.get("/api/students/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        rows = body["results"] if isinstance(body, dict) and "results" in body else body
        ids = {s["id"] for s in rows}
        self.assertIn(self.mine.id, ids)
        self.assertNotIn(self.theirs.id, ids)  # other teacher's list

    def test_removed_student_drops_off_my_list(self):
        TeacherStudent.objects.filter(
            teacher=self.teacher, student=self.mine
        ).update(is_active=False)
        response = self.client.get("/api/students/")
        rows = response.json()
        rows = rows["results"] if isinstance(rows, dict) and "results" in rows else rows
        self.assertNotIn(self.mine.id, {s["id"] for s in rows})

    def test_manual_creation_is_disabled(self):
        response = self.client.post(
            "/api/students/",
            {"student_id": "9999", "first_name": "No", "last_name": "Manual"},
            format="json",
        )
        self.assertEqual(response.status_code, 405)
        self.assertFalse(Student.objects.filter(student_id="9999").exists())

    def test_sync_owned_fields_are_read_only_but_dob_writable(self):
        response = self.client.patch(
            f"/api/students/{self.mine.id}/",
            {
                "first_name": "Hacked",
                "last_name": "Name",
                "email": "hacked@school.edu",
                "student_id": "XXXX",
                "cohort": "99",
                "date_of_birth": "2012-05-04",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.mine.refresh_from_db()
        # Sync-owned fields untouched
        self.assertEqual(self.mine.first_name, "Mine")
        self.assertEqual(self.mine.last_name, "Student")
        self.assertEqual(self.mine.email, "mine@school.edu")
        self.assertEqual(self.mine.student_id, "1001")
        self.assertEqual(self.mine.cohort, "28")
        # date_of_birth is the one teacher-writable global field
        self.assertEqual(str(self.mine.date_of_birth), "2012-05-04")

    def test_detail_works_for_roster_student_not_on_list(self):
        """A student enrolled in the teacher's class is editable even if not
        explicitly on the my-students list."""
        klass = Class.objects.create(name="Sci", subject="Sci", teacher=self.teacher)
        roster_student = Student.objects.create(
            student_id="2001", first_name="Ros", last_name="Ter"
        )
        ClassRoster.objects.create(class_assigned=klass, student=roster_student)
        response = self.client.get(f"/api/students/{roster_student.id}/")
        self.assertEqual(response.status_code, 200)

    def test_detail_404_for_unrelated_student(self):
        response = self.client.get(f"/api/students/{self.theirs.id}/")
        self.assertEqual(response.status_code, 404)


class SchoolListPickerTests(TestCase):
    """Phase 2: the school-list picker feed and add/remove endpoints."""

    def setUp(self):
        self.teacher = make_user()
        self.other = make_user(email="other@school.edu", username="other")
        self.client = APIClient()
        self.client.force_authenticate(user=self.teacher)

        self.a = Student.objects.create(
            student_id="2801", first_name="Ada", last_name="Alpha",
            email="ada@school.edu", cohort="28",
        )
        self.b = Student.objects.create(
            student_id="2802", first_name="Ben", last_name="Beta",
            email="ben@school.edu", cohort="28",
        )
        self.c = Student.objects.create(
            student_id="2701", first_name="Cal", last_name="Gamma",
            email="cal@school.edu", cohort="27",
        )
        # An archived (sync-removed) student must never appear in the picker.
        self.archived = Student.objects.create(
            student_id="2803", first_name="Arch", last_name="Ived",
            cohort="28", is_active=False,
        )
        # a is already on the teacher's list.
        TeacherStudent.objects.create(teacher=self.teacher, student=self.a)

    def test_school_list_excludes_archived_and_flags_on_my_list(self):
        response = self.client.get("/api/students/school-list/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        by_id = {s["id"]: s for s in data["students"]}
        self.assertNotIn(self.archived.id, by_id)  # archived excluded
        self.assertTrue(by_id[self.a.id]["on_my_list"])
        self.assertFalse(by_id[self.b.id]["on_my_list"])
        # Cohorts with counts (archived excluded from counts too)
        cohorts = {row["cohort"]: row["count"] for row in data["cohorts"]}
        self.assertEqual(cohorts, {"27": 1, "28": 2})

    def test_school_list_cohort_filter(self):
        response = self.client.get("/api/students/school-list/?cohort=27")
        data = response.json()
        ids = {s["id"] for s in data["students"]}
        self.assertEqual(ids, {self.c.id})
        # Cohort dropdown still lists all cohorts regardless of the filter
        self.assertEqual({r["cohort"] for r in data["cohorts"]}, {"27", "28"})

    def test_add_by_ids_is_idempotent_and_reactivates(self):
        # First add b and c
        response = self.client.post(
            "/api/students/add-to-my-list/",
            {"student_ids": [self.b.id, self.c.id]}, format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["added"], 2)
        self.assertEqual(
            TeacherStudent.objects.filter(
                teacher=self.teacher, is_active=True
            ).count(),
            3,  # a (setUp) + b + c
        )
        # Re-adding is idempotent (already on list)
        response = self.client.post(
            "/api/students/add-to-my-list/",
            {"student_ids": [self.b.id]}, format="json",
        )
        self.assertEqual(response.json()["already_on_list"], 1)
        # Soft-remove then re-add reactivates the same row
        TeacherStudent.objects.filter(
            teacher=self.teacher, student=self.b
        ).update(is_active=False)
        response = self.client.post(
            "/api/students/add-to-my-list/",
            {"student_ids": [self.b.id]}, format="json",
        )
        self.assertEqual(response.json()["reactivated"], 1)
        self.assertEqual(
            TeacherStudent.objects.filter(teacher=self.teacher, student=self.b).count(),
            1,  # reactivated, not duplicated
        )

    def test_add_by_cohort(self):
        response = self.client.post(
            "/api/students/add-to-my-list/", {"cohort": "28"}, format="json",
        )
        self.assertEqual(response.status_code, 200)
        # a already on list; b added; archived excluded
        on_list = set(
            TeacherStudent.objects.filter(
                teacher=self.teacher, is_active=True
            ).values_list("student_id", flat=True)
        )
        self.assertIn(self.a.id, on_list)
        self.assertIn(self.b.id, on_list)
        self.assertNotIn(self.archived.id, on_list)

    def test_add_requires_ids_or_cohort(self):
        response = self.client.post("/api/students/add-to-my-list/", {}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_remove_by_ids_and_by_cohort(self):
        TeacherStudent.objects.create(teacher=self.teacher, student=self.b)
        TeacherStudent.objects.create(teacher=self.teacher, student=self.c)
        # Remove by ids
        response = self.client.post(
            "/api/students/remove-from-my-list/",
            {"student_ids": [self.a.id]}, format="json",
        )
        self.assertEqual(response.json()["removed"], 1)
        self.assertFalse(
            TeacherStudent.objects.get(teacher=self.teacher, student=self.a).is_active
        )
        # Remove by cohort (b is cohort 28, c is cohort 27)
        response = self.client.post(
            "/api/students/remove-from-my-list/", {"cohort": "28"}, format="json",
        )
        self.assertEqual(response.json()["removed"], 1)  # only b (a already inactive)
        self.assertFalse(
            TeacherStudent.objects.get(teacher=self.teacher, student=self.b).is_active
        )
        self.assertTrue(
            TeacherStudent.objects.get(teacher=self.teacher, student=self.c).is_active
        )

    def test_remove_does_not_touch_roster_and_roster_still_resolves(self):
        """Removing a student from my-students never touches their roster, and
        the class roster keeps resolving the (now inactive) annotation."""
        klass = Class.objects.create(name="Sci", subject="Sci", teacher=self.teacher)
        ClassRoster.objects.create(class_assigned=klass, student=self.a)
        TeacherStudent.objects.filter(
            teacher=self.teacher, student=self.a
        ).update(nickname="Addie", gender="female")

        response = self.client.post(
            "/api/students/remove-from-my-list/",
            {"student_ids": [self.a.id]}, format="json",
        )
        self.assertEqual(response.status_code, 200)

        # Roster entry untouched
        self.assertTrue(
            ClassRoster.objects.get(class_assigned=klass, student=self.a).is_active
        )
        # Roster display still resolves the annotation through the inactive row
        response = self.client.get(f"/api/classes/{klass.id}/")
        roster = response.json()["roster"]
        self.assertEqual(len(roster), 1)
        self.assertEqual(roster[0]["student_nickname"], "Addie")
        self.assertEqual(roster[0]["student_gender"], "female")

    def test_annotations_never_copied_from_another_teacher(self):
        """A teacher adding a student the other teacher has annotated gets a
        blank row - annotations are never shared."""
        TeacherStudent.objects.filter(
            teacher=self.teacher, student=self.a
        ).update(nickname="Addie", gender="female")
        self.client.force_authenticate(user=self.other)
        response = self.client.post(
            "/api/students/add-to-my-list/",
            {"student_ids": [self.a.id]}, format="json",
        )
        self.assertEqual(response.status_code, 200)
        other_row = TeacherStudent.objects.get(teacher=self.other, student=self.a)
        self.assertFalse(other_row.nickname)
        self.assertIsNone(other_row.gender)

    def test_endpoints_require_authentication(self):
        self.client.force_authenticate(user=None)
        for url in (
            "/api/students/school-list/",
        ):
            self.assertEqual(self.client.get(url).status_code, 401)
        self.assertEqual(
            self.client.post(
                "/api/students/add-to-my-list/", {"student_ids": [1]}, format="json"
            ).status_code,
            401,
        )
