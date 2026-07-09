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
    StudentPartnerPreference,
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


# ---------------------------------------------------------------------------
# Phase 3: Workspace directory sync
# ---------------------------------------------------------------------------

SYNC_FIXTURE = [
    # Matches an existing student by student_id; backfills google id + email.
    {
        "primaryEmail": "28abrenn@school.edu",
        "name": {"givenName": "Anika", "familyName": "Brenne"},
        "externalIds": [{"value": "2887", "type": "organization"}],
        "id": "g-2887",
    },
    # Matches an archived student by google id -> should reactivate.
    {
        "primaryEmail": "28reappear@school.edu",
        "name": {"givenName": "Reap", "familyName": "Pear"},
        "externalIds": [{"value": "2777", "type": "organization"}],
        "id": "g-2777",
    },
    # Brand new student.
    {
        "primaryEmail": "28newkid@school.edu",
        "name": {"givenName": "New", "familyName": "Kid"},
        "externalIds": [{"value": "2999", "type": "organization"}],
        "id": "g-2999",
    },
    # Staff (no digit prefix) -> excluded from the mirror.
    {
        "primaryEmail": "teacher@school.edu",
        "name": {"givenName": "Staff", "familyName": "Member"},
        "id": "g-staff",
    },
]


class DirectorySyncCoreTests(TestCase):
    """The shared sync engine: upsert, reactivate, archive, safety valve."""

    def setUp(self):
        from students import directory_sync

        self.directory_sync = directory_sync
        self.teacher = make_user()

        # Existing, matched by student_id; blank google id/email/cohort.
        self.existing = Student.objects.create(
            student_id="2887", first_name="Anika", last_name="Brenne",
            date_of_birth=date(2012, 3, 4),
        )
        # A teacher annotation the sync must never touch.
        self.annotation = TeacherStudent.objects.create(
            teacher=self.teacher, student=self.existing,
            nickname="Ani", gender="female",
        )
        # Archived, reappears in the directory by google id -> reactivate.
        self.reappearing = Student.objects.create(
            student_id="2777", first_name="Reap", last_name="Pear",
            email="28reappear@school.edu", google_user_id="g-2777",
            cohort="28", is_active=False,
        )
        # Active with a google id NOT in the directory -> archive.
        self.gone = Student.objects.create(
            student_id="2666", first_name="Gone", last_name="Away",
            google_user_id="g-gone", cohort="28", is_active=True,
        )
        # Active with NO google id -> left alone (conservative).
        self.nogoogle = Student.objects.create(
            student_id="2555", first_name="No", last_name="Google",
            is_active=True,
        )

    def test_upsert_reactivate_and_archive(self):
        summary = self.directory_sync.apply_directory_sync(SYNC_FIXTURE)

        self.assertEqual(summary["created"], 1)
        self.assertEqual(summary["updated"], 1)
        self.assertEqual(summary["reactivated"], 1)
        self.assertEqual(summary["archived"], 1)
        self.assertEqual(summary["skipped"], 0)
        self.assertEqual(summary["total_directory"], 3)  # staff excluded
        self.assertFalse(summary["safety_valve_triggered"])

        # Match backfilled but student_id NEVER overwritten; cohort + synced_at set.
        self.existing.refresh_from_db()
        self.assertEqual(self.existing.student_id, "2887")
        self.assertEqual(self.existing.google_user_id, "g-2887")
        self.assertEqual(self.existing.email, "28abrenn@school.edu")
        self.assertEqual(self.existing.cohort, "28")
        self.assertIsNotNone(self.existing.synced_at)

        # New student created with the real district ID.
        newkid = Student.objects.get(student_id="2999")
        self.assertEqual(newkid.google_user_id, "g-2999")
        self.assertEqual(newkid.cohort, "28")
        self.assertTrue(newkid.is_active)
        self.assertIsNotNone(newkid.synced_at)

        # Reappearing archived student reactivated.
        self.reappearing.refresh_from_db()
        self.assertTrue(self.reappearing.is_active)
        self.assertIsNotNone(self.reappearing.synced_at)

        # Vanished student archived; no-google-id student untouched.
        self.gone.refresh_from_db()
        self.assertFalse(self.gone.is_active)
        self.nogoogle.refresh_from_db()
        self.assertTrue(self.nogoogle.is_active)

    def test_teacher_annotation_and_dob_untouched(self):
        self.directory_sync.apply_directory_sync(SYNC_FIXTURE)
        self.annotation.refresh_from_db()
        self.assertEqual(self.annotation.nickname, "Ani")
        self.assertEqual(self.annotation.gender, "female")
        self.existing.refresh_from_db()
        self.assertEqual(str(self.existing.date_of_birth), "2012-03-04")

    def test_empty_directory_safety_valve_skips_archiving(self):
        summary = self.directory_sync.apply_directory_sync([])
        self.assertTrue(summary["safety_valve_triggered"])
        self.assertEqual(summary["archived"], 0)
        self.gone.refresh_from_db()
        self.assertTrue(self.gone.is_active)  # NOT archived

    def test_staff_only_fetch_triggers_safety_valve(self):
        staff_only = [SYNC_FIXTURE[-1]]  # just the staff record
        summary = self.directory_sync.apply_directory_sync(staff_only)
        self.assertTrue(summary["safety_valve_triggered"])
        self.gone.refresh_from_db()
        self.assertTrue(self.gone.is_active)

    def test_dry_run_writes_nothing(self):
        summary = self.directory_sync.apply_directory_sync(SYNC_FIXTURE, dry_run=True)
        # Counts still computed...
        self.assertEqual(summary["created"], 1)
        self.assertEqual(summary["archived"], 1)
        self.assertTrue(summary["dry_run"])
        # ...but nothing persisted.
        self.assertFalse(Student.objects.filter(student_id="2999").exists())
        self.gone.refresh_from_db()
        self.assertTrue(self.gone.is_active)
        self.existing.refresh_from_db()
        self.assertIsNone(self.existing.google_user_id)
        self.assertIsNone(self.existing.synced_at)

    def test_no_name_record_is_skipped(self):
        fixture = SYNC_FIXTURE + [
            {"primaryEmail": "28noname@school.edu", "name": {}, "id": "g-noname"}
        ]
        summary = self.directory_sync.apply_directory_sync(fixture)
        self.assertEqual(summary["skipped"], 1)
        self.assertEqual(summary["details"]["skipped"][0]["reason"],
                         "No name in directory profile")

    def test_sync_directory_wires_fetch(self):
        with patch(
            "students.google_classroom_service._build_directory_service_for_user",
            return_value=object(),
        ), patch(
            "students.google_classroom_service._fetch_domain_users",
            return_value=SYNC_FIXTURE,
        ):
            summary = self.directory_sync.sync_directory(self.teacher)
        self.assertEqual(summary["created"], 1)
        self.assertEqual(summary["archived"], 1)

    def test_sync_directory_wraps_fetch_failure(self):
        with patch(
            "students.google_classroom_service._build_directory_service_for_user",
            return_value=object(),
        ), patch(
            "students.google_classroom_service._fetch_domain_users",
            side_effect=Exception("boom"),
        ):
            with self.assertRaises(self.directory_sync.DirectorySyncError):
                self.directory_sync.sync_directory(self.teacher)


class SyncDirectoryEndpointTests(TestCase):
    """POST /api/google/sync-directory/ (Sync now)."""

    def setUp(self):
        # Sync Now is superuser-only (school-wide mutation).
        self.teacher = make_user()
        self.teacher.is_superuser = True
        self.teacher.save(update_fields=["is_superuser"])
        self.client = APIClient()
        self.client.force_authenticate(user=self.teacher)

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.post("/api/google/sync-directory/")
        self.assertEqual(response.status_code, 401)

    def test_forbidden_for_regular_teacher(self):
        regular = make_user(email="regular@school.edu", username="regular")
        self.client.force_authenticate(user=regular)
        response = self.client.post("/api/google/sync-directory/")
        self.assertEqual(response.status_code, 403)

    def test_needs_reconnect_when_not_connected(self):
        # No GoogleClassroomCredentials -> DirectoryAuthError(not_connected).
        response = self.client.post("/api/google/sync-directory/")
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertTrue(data["needs_reconnect"])
        self.assertIn("auth_url", data)

    def test_summary_shape_on_success(self):
        Student.objects.create(
            student_id="2887", first_name="Anika", last_name="Brenne",
        )
        with patch(
            "students.google_classroom_service._build_directory_service_for_user",
            return_value=object(),
        ), patch(
            "students.google_classroom_service._fetch_domain_users",
            return_value=SYNC_FIXTURE,
        ):
            response = self.client.post("/api/google/sync-directory/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        for key in ("created", "updated", "reactivated", "archived",
                    "unchanged", "skipped", "total_directory", "last_synced"):
            self.assertIn(key, data)
        self.assertIsNotNone(data["last_synced"])

    def test_last_synced_endpoint(self):
        response = self.client.get("/api/students/last-synced/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["last_synced"])


class DashboardStatsScopeTests(TestCase):
    """dashboard_stats counts are scoped to the requesting teacher's list."""

    def setUp(self):
        self.teacher = make_user()
        self.other = make_user(email="other@school.edu", username="other")
        self.client = APIClient()
        self.client.force_authenticate(user=self.teacher)

        # On my list, active global student.
        self.s1 = Student.objects.create(
            student_id="1", first_name="A", last_name="A", is_active=True,
        )
        # On my list, but archived globally (still counts toward total, not active).
        self.s2 = Student.objects.create(
            student_id="2", first_name="B", last_name="B", is_active=False,
        )
        # Was on my list but removed (inactive TeacherStudent) -> excluded.
        self.s3 = Student.objects.create(
            student_id="3", first_name="C", last_name="C", is_active=True,
        )
        # On the OTHER teacher's list only -> excluded.
        self.s4 = Student.objects.create(
            student_id="4", first_name="D", last_name="D", is_active=True,
        )
        TeacherStudent.objects.create(teacher=self.teacher, student=self.s1)
        TeacherStudent.objects.create(teacher=self.teacher, student=self.s2)
        TeacherStudent.objects.create(
            teacher=self.teacher, student=self.s3, is_active=False,
        )
        TeacherStudent.objects.create(teacher=self.other, student=self.s4)

    def test_counts_are_scoped_to_my_students(self):
        response = self.client.get("/api/dashboard/stats/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_students"], 2)   # s1 + s2
        self.assertEqual(data["active_students"], 1)  # s1 only


class StudentGoogleSigninProvisioningTests(TestCase):
    """
    GH issue #16 phase 1: Google Sign-In auto-provisions a passwordless,
    non-teacher User for an email that matches an active global Student, and
    the issued JWT carries is_teacher=false plus the linked Student pk.
    """

    def setUp(self):
        self.client = APIClient()
        self.student = Student.objects.create(
            student_id="S-100",
            first_name="Sam",
            last_name="Student",
            email="sstudent@school.edu",
            is_active=True,
        )

    @patch("students.google_classroom_service.google_id_token.verify_oauth2_token")
    def test_student_email_auto_provisions_non_teacher_user(self, mock_verify):
        # Case-insensitive match against the global Student list.
        mock_verify.return_value = {
            "email": "SStudent@School.edu",
            "email_verified": True,
        }
        response = self.client.post(
            "/api/auth/google/signin/", {"credential": "fake"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("access", data)
        self.assertIn("refresh", data)

        # A non-teacher User now exists, linked one-to-one to the Student, with
        # an unusable password.
        user = User.objects.get(email__iexact="sstudent@school.edu")
        self.assertFalse(user.is_teacher)
        self.assertEqual(user.student_id, self.student.id)
        self.assertFalse(user.has_usable_password())

        # JWT claims: is_teacher false, student_id = linked Student pk.
        import jwt

        payload = jwt.decode(data["access"], options={"verify_signature": False})
        self.assertIs(payload["is_teacher"], False)
        self.assertEqual(payload["student_id"], self.student.id)

    @patch("students.google_classroom_service.google_id_token.verify_oauth2_token")
    def test_unknown_non_student_email_is_still_rejected(self, mock_verify):
        mock_verify.return_value = {
            "email": "nobody@school.edu",
            "email_verified": True,
        }
        response = self.client.post(
            "/api/auth/google/signin/", {"credential": "fake"}, format="json"
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.filter(email__iexact="nobody@school.edu").exists())

    @patch("students.google_classroom_service.google_id_token.verify_oauth2_token")
    def test_archived_student_email_is_rejected(self, mock_verify):
        self.student.is_active = False
        self.student.save(update_fields=["is_active"])
        mock_verify.return_value = {
            "email": "sstudent@school.edu",
            "email_verified": True,
        }
        response = self.client.post(
            "/api/auth/google/signin/", {"credential": "fake"}, format="json"
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.filter(student=self.student).exists())

    @patch("students.google_classroom_service.google_id_token.verify_oauth2_token")
    def test_second_signin_reuses_the_same_user(self, mock_verify):
        mock_verify.return_value = {
            "email": "sstudent@school.edu",
            "email_verified": True,
        }
        first = self.client.post(
            "/api/auth/google/signin/", {"credential": "fake"}, format="json"
        )
        self.assertEqual(first.status_code, 200)
        second = self.client.post(
            "/api/auth/google/signin/", {"credential": "fake"}, format="json"
        )
        self.assertEqual(second.status_code, 200)
        self.assertEqual(User.objects.filter(student=self.student).count(), 1)


class TeacherEndpointLockdownTests(TestCase):
    """
    GH issue #16 phase 1: student accounts hold valid JWTs but the IsTeacher
    permission must 403 them off every teacher endpoint, while teacher accounts
    keep working.
    """

    def setUp(self):
        self.teacher = make_user()
        self.klass = Class.objects.create(
            name="Science", subject="Science", teacher=self.teacher
        )
        self.student = Student.objects.create(
            student_id="S-200",
            first_name="Sam",
            last_name="Student",
            email="sstudent@school.edu",
            is_active=True,
        )
        self.student_user = User.objects.create(
            username="sstudent@school.edu",
            email="sstudent@school.edu",
            first_name="Sam",
            last_name="Student",
            is_teacher=False,
            student=self.student,
        )
        self.student_user.set_unusable_password()
        self.student_user.save()

    def endpoints(self):
        return [
            "/api/students/",
            "/api/classes/",
            "/api/layouts/",
            "/api/attendance/",
            f"/api/classes/{self.klass.id}/partnership-ratings/",
        ]

    def test_student_jwt_is_forbidden_everywhere(self):
        client = APIClient()
        client.force_authenticate(user=self.student_user)
        for url in self.endpoints():
            response = client.get(url)
            self.assertEqual(
                response.status_code, 403, f"expected 403 for student on {url}"
            )

    def test_teacher_jwt_still_works(self):
        client = APIClient()
        client.force_authenticate(user=self.teacher)
        for url in self.endpoints():
            response = client.get(url)
            self.assertEqual(
                response.status_code, 200, f"expected 200 for teacher on {url}"
            )

    def test_student_jwt_forbidden_on_google_endpoints(self):
        client = APIClient()
        client.force_authenticate(user=self.student_user)
        for url in ["/api/google/status/", "/api/google/courses/"]:
            response = client.get(url)
            self.assertEqual(
                response.status_code, 403, f"expected 403 for student on {url}"
            )


class PartnerSurveyTests(TestCase):
    """
    GH issue #16 phase 2: the student-only partner survey endpoints
    (/api/my-partners/<class_id>/). Covers roster/window gates, the GET open
    shape, POST full-replace + caps/validation, and permission lockdown.
    """

    def setUp(self):
        from django.utils import timezone
        from datetime import timedelta

        self.timezone = timezone
        self.timedelta = timedelta

        self.teacher = make_user()
        self.klass = Class.objects.create(
            name="Homeroom", subject="General", teacher=self.teacher,
            survey_enabled=True,
        )

        # Four students on the active roster. The chooser is `me`.
        self.me = Student.objects.create(
            student_id="S-1", first_name="Zoe", last_name="Zimmer",
            email="zoe@school.edu", is_active=True,
        )
        self.alice = Student.objects.create(
            student_id="S-2", first_name="Alice", last_name="Anderson",
            email="alice@school.edu", is_active=True,
        )
        self.bob = Student.objects.create(
            student_id="S-3", first_name="Bob", last_name="Baker",
            email="bob@school.edu", is_active=True,
        )
        self.carol = Student.objects.create(
            student_id="S-4", first_name="Carol", last_name="Carter",
            email="carol@school.edu", is_active=True,
        )
        # A fifth student NOT on this roster (used for off-roster target test).
        self.outsider = Student.objects.create(
            student_id="S-9", first_name="Otto", last_name="Outsider",
            email="otto@school.edu", is_active=True,
        )

        for s in (self.me, self.alice, self.bob, self.carol):
            ClassRoster.objects.create(class_assigned=self.klass, student=s, is_active=True)

        self.me_user = User.objects.create(
            username="zoe@school.edu", email="zoe@school.edu",
            first_name="Zoe", last_name="Zimmer",
            is_teacher=False, student=self.me,
        )
        self.me_user.set_unusable_password()
        self.me_user.save()

        self.client = APIClient()
        self.client.force_authenticate(user=self.me_user)

    def url(self, class_id=None):
        return f"/api/my-partners/{class_id or self.klass.id}/"

    # --- Gates -------------------------------------------------------------

    def test_not_on_roster_returns_404(self):
        other_class = Class.objects.create(
            name="Band", subject="Music", teacher=self.teacher, survey_enabled=True
        )
        response = self.client.get(self.url(other_class.id))
        self.assertEqual(response.status_code, 404)

    def test_nonexistent_class_returns_404(self):
        response = self.client.get(self.url(99999))
        self.assertEqual(response.status_code, 404)

    def test_survey_disabled_returns_not_enabled(self):
        self.klass.survey_enabled = False
        self.klass.save()
        response = self.client.get(self.url())
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["open"])
        self.assertEqual(response.data["reason"], "not_enabled")
        self.assertEqual(response.data["class_name"], "Homeroom")

    def test_window_in_future_returns_not_yet_open(self):
        self.klass.survey_opens_at = self.timezone.now() + self.timedelta(days=1)
        self.klass.save()
        response = self.client.get(self.url())
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["open"])
        self.assertEqual(response.data["reason"], "not_yet_open")

    def test_window_past_returns_closed(self):
        self.klass.survey_closes_at = self.timezone.now() - self.timedelta(days=1)
        self.klass.save()
        response = self.client.get(self.url())
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["open"])
        self.assertEqual(response.data["reason"], "closed")

    def test_enabled_no_window_is_open_with_classmates_and_empty_choices(self):
        response = self.client.get(self.url())
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["open"])
        self.assertEqual(response.data["caps"], {"positive": 5, "negative": 3})
        # Active roster minus self, ordered by last then first name.
        names = [(c["first_name"], c["last_name"]) for c in response.data["classmates"]]
        self.assertEqual(
            names,
            [("Alice", "Anderson"), ("Bob", "Baker"), ("Carol", "Carter")],
        )
        self.assertNotIn(self.me.id, [c["id"] for c in response.data["classmates"]])
        self.assertEqual(response.data["choices"], [])

    def test_inactive_roster_target_excluded_from_classmates(self):
        ClassRoster.objects.filter(
            class_assigned=self.klass, student=self.carol
        ).update(is_active=False)
        response = self.client.get(self.url())
        ids = [c["id"] for c in response.data["classmates"]]
        self.assertNotIn(self.carol.id, ids)

    # --- POST --------------------------------------------------------------

    def test_post_saves_and_echoes_choices(self):
        payload = {"choices": [
            {"target_id": self.alice.id, "preference": 1},
            {"target_id": self.bob.id, "preference": -1},
        ]}
        response = self.client.post(self.url(), payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["open"])
        got = {(c["target_id"], c["preference"]) for c in response.data["choices"]}
        self.assertEqual(got, {(self.alice.id, 1), (self.bob.id, -1)})
        self.assertEqual(
            StudentPartnerPreference.objects.filter(
                class_assigned=self.klass, student=self.me
            ).count(),
            2,
        )

    def test_post_full_replace_removes_omitted_rows(self):
        StudentPartnerPreference.objects.create(
            class_assigned=self.klass, student=self.me, target=self.carol, preference=1
        )
        payload = {"choices": [{"target_id": self.alice.id, "preference": 1}]}
        response = self.client.post(self.url(), payload, format="json")
        self.assertEqual(response.status_code, 200)
        remaining = set(
            StudentPartnerPreference.objects.filter(
                class_assigned=self.klass, student=self.me
            ).values_list("target_id", flat=True)
        )
        self.assertEqual(remaining, {self.alice.id})

    def test_post_positive_cap_enforced(self):
        # Only 3 classmates exist, so build a 6-positive payload against a
        # bigger roster to exceed the cap of 5.
        extra = []
        for i in range(5, 12):
            s = Student.objects.create(
                student_id=f"S-1{i}", first_name=f"E{i}", last_name=f"Extra{i}",
                email=f"e{i}@school.edu", is_active=True,
            )
            ClassRoster.objects.create(class_assigned=self.klass, student=s, is_active=True)
            extra.append(s)
        choices = [{"target_id": s.id, "preference": 1} for s in extra[:6]]
        response = self.client.post(self.url(), {"choices": choices}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_post_negative_cap_enforced(self):
        extra = []
        for i in range(5, 12):
            s = Student.objects.create(
                student_id=f"S-2{i}", first_name=f"N{i}", last_name=f"Neg{i}",
                email=f"n{i}@school.edu", is_active=True,
            )
            ClassRoster.objects.create(class_assigned=self.klass, student=s, is_active=True)
            extra.append(s)
        choices = [{"target_id": s.id, "preference": -1} for s in extra[:4]]
        response = self.client.post(self.url(), {"choices": choices}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_post_self_target_rejected(self):
        payload = {"choices": [{"target_id": self.me.id, "preference": 1}]}
        response = self.client.post(self.url(), payload, format="json")
        self.assertEqual(response.status_code, 400)

    def test_post_off_roster_target_rejected(self):
        payload = {"choices": [{"target_id": self.outsider.id, "preference": 1}]}
        response = self.client.post(self.url(), payload, format="json")
        self.assertEqual(response.status_code, 400)

    def test_post_duplicate_target_rejected(self):
        payload = {"choices": [
            {"target_id": self.alice.id, "preference": 1},
            {"target_id": self.alice.id, "preference": -1},
        ]}
        response = self.client.post(self.url(), payload, format="json")
        self.assertEqual(response.status_code, 400)

    def test_post_bad_preference_rejected(self):
        payload = {"choices": [{"target_id": self.alice.id, "preference": 2}]}
        response = self.client.post(self.url(), payload, format="json")
        self.assertEqual(response.status_code, 400)

    def test_post_while_closed_is_rejected(self):
        self.klass.survey_enabled = False
        self.klass.save()
        payload = {"choices": [{"target_id": self.alice.id, "preference": 1}]}
        response = self.client.post(self.url(), payload, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(
            StudentPartnerPreference.objects.filter(
                class_assigned=self.klass, student=self.me
            ).exists()
        )

    # --- Permission lockdown ----------------------------------------------

    def test_teacher_jwt_forbidden_on_survey(self):
        client = APIClient()
        client.force_authenticate(user=self.teacher)
        response = client.get(self.url())
        self.assertEqual(response.status_code, 403)
        response = client.post(self.url(), {"choices": []}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_student_jwt_still_forbidden_on_teacher_endpoints(self):
        client = APIClient()
        client.force_authenticate(user=self.me_user)
        for url in ["/api/students/", "/api/classes/", f"/api/classes/{self.klass.id}/"]:
            response = client.get(url)
            self.assertEqual(response.status_code, 403, f"expected 403 on {url}")

    def test_unauthenticated_is_rejected(self):
        client = APIClient()
        response = client.get(self.url())
        self.assertIn(response.status_code, (401, 403))


class ClassSurveyFieldSerializerTests(TestCase):
    """The three survey fields round-trip through the Class serializer for the
    owning teacher (GET returns them; PATCH updates them)."""

    def setUp(self):
        self.teacher = make_user()
        self.klass = Class.objects.create(
            name="Chem", subject="Science", teacher=self.teacher
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.teacher)

    def test_get_returns_survey_fields(self):
        response = self.client.get(f"/api/classes/{self.klass.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("survey_enabled", response.data)
        self.assertIn("survey_opens_at", response.data)
        self.assertIn("survey_closes_at", response.data)
        self.assertFalse(response.data["survey_enabled"])

    def test_patch_updates_survey_fields(self):
        response = self.client.patch(
            f"/api/classes/{self.klass.id}/",
            {
                "survey_enabled": True,
                "survey_opens_at": "2026-08-01T09:00:00Z",
                "survey_closes_at": "2026-08-15T17:00:00Z",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.klass.refresh_from_db()
        self.assertTrue(self.klass.survey_enabled)
        self.assertIsNotNone(self.klass.survey_opens_at)
        self.assertIsNotNone(self.klass.survey_closes_at)


class PartnerSignalDerivationTests(TestCase):
    """
    GH issue #16 phase 3: the partnership-ratings GET response derives a student
    pairing signal, surfaces teacher/student conflicts, and exposes an
    effective_grid. Also asserts the privacy boundary (none of this leaks to the
    student-facing my-partners endpoint).
    """

    def setUp(self):
        self.teacher = make_user()
        self.klass = Class.objects.create(
            name="Homeroom", subject="General", teacher=self.teacher,
            survey_enabled=True,
        )
        self.a = Student.objects.create(
            student_id="S-1", first_name="Maya", last_name="Adams",
            email="maya@school.edu", is_active=True,
        )
        self.b = Student.objects.create(
            student_id="S-2", first_name="Jake", last_name="Brown",
            email="jake@school.edu", is_active=True,
        )
        self.c = Student.objects.create(
            student_id="S-3", first_name="Nia", last_name="Carter",
            email="nia@school.edu", is_active=True,
        )
        for s in (self.a, self.b, self.c):
            ClassRoster.objects.create(
                class_assigned=self.klass, student=s, is_active=True
            )

        self.client = APIClient()
        self.client.force_authenticate(user=self.teacher)

    def _pref(self, chooser, target, value):
        StudentPartnerPreference.objects.create(
            class_assigned=self.klass, student=chooser, target=target,
            preference=value,
        )

    def _set_rating(self, s1, s2, rating):
        response = self.client.post(
            f"/api/classes/{self.klass.id}/partnership-ratings/",
            {"student1_id": s1.id, "student2_id": s2.id, "rating": rating},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

    def _get(self):
        response = self.client.get(
            f"/api/classes/{self.klass.id}/partnership-ratings/"
        )
        self.assertEqual(response.status_code, 200)
        return response.data

    def _signal(self, data, s1, s2):
        return data["student_signals"].get(s1.id, {}).get(s2.id)

    def _effective(self, data, s1, s2):
        return data["effective_grid"][s1.id][s2.id]

    # --- Pure derivation function -----------------------------------------

    def test_derive_partner_signal_table(self):
        from students.views import derive_partner_signal

        self.assertEqual(derive_partner_signal(1, 1), 2)     # mutual +
        self.assertEqual(derive_partner_signal(1, None), 1)  # one-way +
        self.assertEqual(derive_partner_signal(None, 1), 1)  # one-way + (other dir)
        self.assertEqual(derive_partner_signal(1, -1), -1)   # + / -
        self.assertEqual(derive_partner_signal(-1, 1), -1)   # - / +
        self.assertEqual(derive_partner_signal(-1, -1), -1)  # mutual -
        self.assertEqual(derive_partner_signal(-1, None), -1)  # one-way -
        self.assertEqual(derive_partner_signal(None, -1), -1)  # one-way - (other)
        self.assertIsNone(derive_partner_signal(None, None))   # nothing

    # --- Signal derivation via the endpoint --------------------------------

    def test_mutual_positive_is_plus_two(self):
        self._pref(self.a, self.b, 1)
        self._pref(self.b, self.a, 1)
        data = self._get()
        self.assertEqual(self._signal(data, self.a, self.b), 2)
        self.assertEqual(self._signal(data, self.b, self.a), 2)  # symmetric

    def test_one_way_positive_is_plus_one(self):
        self._pref(self.a, self.b, 1)
        data = self._get()
        self.assertEqual(self._signal(data, self.a, self.b), 1)
        self.assertEqual(self._signal(data, self.b, self.a), 1)

    def test_positive_and_negative_is_minus_one(self):
        self._pref(self.a, self.b, 1)
        self._pref(self.b, self.a, -1)
        data = self._get()
        self.assertEqual(self._signal(data, self.a, self.b), -1)

    def test_mutual_negative_is_minus_one(self):
        self._pref(self.a, self.b, -1)
        self._pref(self.b, self.a, -1)
        data = self._get()
        self.assertEqual(self._signal(data, self.a, self.b), -1)

    def test_one_way_negative_is_minus_one(self):
        self._pref(self.a, self.b, -1)
        data = self._get()
        self.assertEqual(self._signal(data, self.a, self.b), -1)

    def test_no_preferences_no_signal(self):
        data = self._get()
        self.assertEqual(data["student_signals"], {})

    # --- effective_grid precedence ----------------------------------------

    def test_effective_grid_uses_signal_when_teacher_zero(self):
        self._pref(self.a, self.b, 1)
        self._pref(self.b, self.a, 1)
        data = self._get()
        # teacher rating is 0 -> effective falls back to the +2 signal
        self.assertEqual(self._effective(data, self.a, self.b), 2)
        self.assertEqual(self._effective(data, self.b, self.a), 2)

    def test_teacher_rating_wins_over_signal(self):
        # teacher +1, student signal -1 -> effective +1 (non-zero teacher wins)
        self._set_rating(self.a, self.b, 1)
        self._pref(self.a, self.b, -1)
        data = self._get()
        self.assertEqual(self._effective(data, self.a, self.b), 1)

    def test_teacher_minus_two_wins_and_conflicts(self):
        # teacher -2 with mutual student +1 -> effective -2 AND conflict listed
        self._set_rating(self.a, self.b, -2)
        self._pref(self.a, self.b, 1)
        self._pref(self.b, self.a, 1)
        data = self._get()
        self.assertEqual(self._effective(data, self.a, self.b), -2)
        conflicts = data["conflicts"]
        self.assertEqual(len(conflicts), 1)
        c = conflicts[0]
        self.assertEqual(c["teacher_rating"], -2)
        self.assertEqual(c["student_signal"], 2)
        self.assertIn("Maya Adams", (c["student1_name"], c["student2_name"]))
        self.assertIn("Jake Brown", (c["student1_name"], c["student2_name"]))
        self.assertIn("Never Together", c["detail"])

    def test_effective_grid_never_minus_two_from_students(self):
        # every negative student combination on every pair; no teacher ratings
        self._pref(self.a, self.b, -1)
        self._pref(self.b, self.a, -1)
        self._pref(self.a, self.c, -1)
        self._pref(self.c, self.a, 1)
        data = self._get()
        for s1 in data["effective_grid"]:
            for s2, val in data["effective_grid"][s1].items():
                self.assertNotEqual(val, -2)

    def test_effective_grid_keeps_teacher_minus_two(self):
        self._set_rating(self.a, self.b, -2)
        data = self._get()
        self.assertEqual(self._effective(data, self.a, self.b), -2)

    # --- Conflict detail strings ------------------------------------------

    def test_conflict_names_chooser_one_way_positive_vs_avoid(self):
        # teacher -1 (Avoid), only Maya chose Jake +1
        self._set_rating(self.a, self.b, -1)
        self._pref(self.a, self.b, 1)
        data = self._get()
        self.assertEqual(len(data["conflicts"]), 1)
        detail = data["conflicts"][0]["detail"]
        self.assertIn("Maya chose Jake as a good partner", detail)
        self.assertIn("Avoid if Possible", detail)

    def test_conflict_plus_two_vs_student_negative(self):
        # teacher +2 (Best), Jake chose not to work with Maya
        self._set_rating(self.a, self.b, 2)
        self._pref(self.b, self.a, -1)
        data = self._get()
        self.assertEqual(len(data["conflicts"]), 1)
        detail = data["conflicts"][0]["detail"]
        self.assertIn("Jake chose not to work with Maya", detail)
        self.assertIn("Best Partnership", detail)

    def test_no_conflict_when_teacher_and_students_agree(self):
        # teacher +2, mutual student positive -> no conflict
        self._set_rating(self.a, self.b, 2)
        self._pref(self.a, self.b, 1)
        self._pref(self.b, self.a, 1)
        data = self._get()
        self.assertEqual(data["conflicts"], [])

    def test_teacher_plus_one_vs_student_negative_is_not_a_conflict(self):
        # Documented decision: only teacher -1/-2-vs-chosen and +2-vs-negative
        # are flagged. teacher +1 vs student -1 is NOT surfaced as a conflict.
        self._set_rating(self.a, self.b, 1)
        self._pref(self.a, self.b, -1)
        data = self._get()
        self.assertEqual(data["conflicts"], [])

    # --- Backward compatibility -------------------------------------------

    def test_existing_keys_unchanged(self):
        data = self._get()
        self.assertIn("class_id", data)
        self.assertIn("students", data)
        self.assertIn("grid", data)
        # grid still carries teacher ratings (all 0 default here)
        self.assertEqual(data["grid"][self.a.id]["ratings"][self.b.id], 0)

    # --- Privacy boundary --------------------------------------------------

    def test_my_partners_leaks_no_teacher_signals_or_conflicts(self):
        student_user = User.objects.create(
            username="maya@school.edu", email="maya@school.edu",
            first_name="Maya", last_name="Adams",
            is_teacher=False, student=self.a,
        )
        student_user.set_unusable_password()
        student_user.save()
        self._pref(self.a, self.b, 1)
        self._pref(self.b, self.a, 1)
        self._set_rating(self.a, self.b, -2)

        student_client = APIClient()
        student_client.force_authenticate(user=student_user)

        # GET the survey
        get_resp = student_client.get(f"/api/my-partners/{self.klass.id}/")
        self.assertEqual(get_resp.status_code, 200)
        body = str(get_resp.data)
        for forbidden in ("student_signals", "conflicts", "effective_grid",
                          "grid", "teacher_rating"):
            self.assertNotIn(forbidden, get_resp.data)
        self.assertNotIn("Never Together", body)

        # POST a choice - same privacy guarantee
        post_resp = student_client.post(
            f"/api/my-partners/{self.klass.id}/",
            {"choices": [{"target_id": self.c.id, "preference": 1}]},
            format="json",
        )
        self.assertIn(post_resp.status_code, (200, 201))
        for forbidden in ("student_signals", "conflicts", "effective_grid",
                          "grid", "teacher_rating"):
            self.assertNotIn(forbidden, post_resp.data)

        # And the teacher endpoint still 403s a student JWT.
        forbidden_resp = student_client.get(
            f"/api/classes/{self.klass.id}/partnership-ratings/"
        )
        self.assertEqual(forbidden_resp.status_code, 403)
