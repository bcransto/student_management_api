"""
Workspace directory sync (issue #14 phase 3).

Core logic shared by the ``sync_workspace_directory`` management command and
the ``/api/google/sync-directory/`` "Sync now" endpoint. Written once here so
the command, the cron/systemd timer, and the button all behave identically.

The global :class:`~students.models.Student` list is a pure Google Workspace
mirror. This job:

- upserts every student-cohort directory user (match google_user_id ->
  student_id -> email iexact; backfill google_user_id/email if blank; NEVER
  overwrite student_id; create missing students with their real district ID),
  setting ``cohort``, ``synced_at`` and ``is_active=True`` on each;
- archives (``is_active=False``) any Student with a non-empty google_user_id
  that was NOT seen in the directory fetch (reappearing students reactivate);
- leaves students with no google_user_id alone (conservative);
- NEVER touches :class:`~students.models.TeacherStudent` rows or
  ``date_of_birth``.

Safety valve: if the directory fetch yields fewer than
``MIN_DIRECTORY_STUDENTS`` student-cohort users (i.e. zero), archiving is
skipped entirely so a flaky/partial API response can never archive the whole
school. The upsert of the (empty) result is a harmless no-op.
"""

from django.db import transaction
from django.utils import timezone

from . import google_classroom_service as gcs
from .models import Student

# Minimum number of student-cohort directory users the fetch must return before
# we trust it enough to archive anyone. Zero students almost certainly means a
# broken/partial API response, not that the whole school graduated overnight.
MIN_DIRECTORY_STUDENTS = 1


class DirectorySyncError(Exception):
    """Raised when the directory fetch itself fails (network/API error)."""


def sync_directory(user, dry_run=False):
    """
    Sync the global Student list from the Workspace directory using ``user``'s
    stored Google credentials.

    Raises :class:`~students.google_classroom_service.DirectoryAuthError` when
    the credentials are missing / lack the Directory scope / fail to refresh,
    and :class:`DirectorySyncError` when the directory fetch fails.

    Returns the summary dict from :func:`apply_directory_sync`.
    """
    service = gcs._build_directory_service_for_user(user)
    domain = (user.email or "").split("@")[-1]
    try:
        directory_users = gcs._fetch_domain_users(service, domain)
    except Exception as e:  # network / API failure
        raise DirectorySyncError(f"Failed to fetch the Workspace directory: {e}")
    return apply_directory_sync(directory_users, dry_run=dry_run)


def apply_directory_sync(directory_users, dry_run=False):
    """
    Apply an already-fetched list of raw directory user records to the Student
    table. Split out from :func:`sync_directory` so tests can drive it with a
    fixed fixture and no Google calls.

    Runs inside a single transaction; when ``dry_run`` is true the transaction
    is rolled back at the end, so the returned counts are exact (real rows are
    created to reserve unique IDs, then discarded) without persisting anything.
    """
    now = timezone.now()

    # Only student-cohort users are mirrored; staff (no two-digit email prefix)
    # are excluded. Keep the paired (raw email -> normalized) so we can derive
    # the cohort per row.
    student_records = []
    for u in directory_users:
        cohort = gcs._cohort_prefix(u.get("primaryEmail"))
        if cohort:
            student_records.append((cohort, gcs._normalize_directory_user(u)))

    # "Seen" set for archiving: every google id present anywhere in the fetch
    # (students AND staff) - a DB student whose google id still exists in the
    # directory must never be archived.
    seen_google_ids = {u.get("id") for u in directory_users if u.get("id")}

    safety_valve_triggered = len(student_records) < MIN_DIRECTORY_STUDENTS

    created, reactivated, skipped, archived = [], [], [], []
    updated_count = 0
    unchanged_count = 0

    with transaction.atomic():
        for cohort, data in student_records:
            email = data["email"]
            display_name = (
                f"{data['first_name']} {data['last_name']}".strip() or email
            )

            student = gcs._match_existing_student(data)
            if student:
                update_fields = ["synced_at"]
                changed = False

                # Backfill identifiers on a match; NEVER overwrite student_id.
                if data["google_user_id"] and not student.google_user_id:
                    student.google_user_id = data["google_user_id"]
                    update_fields.append("google_user_id")
                    changed = True
                if data["email"] and not student.email:
                    student.email = data["email"]
                    update_fields.append("email")
                    changed = True
                if student.cohort != cohort:
                    student.cohort = cohort
                    update_fields.append("cohort")
                    changed = True

                was_archived = not student.is_active
                if was_archived:
                    student.is_active = True
                    update_fields.append("is_active")

                student.synced_at = now
                student.save(update_fields=update_fields)

                if was_archived:
                    reactivated.append(display_name)
                elif changed:
                    updated_count += 1
                else:
                    unchanged_count += 1
                continue

            # No match -> create with the real district ID (same fallback logic
            # as the directory import).
            if not data["first_name"] and not data["last_name"]:
                skipped.append(
                    {"name": display_name, "reason": "No name in directory profile"}
                )
                continue

            student_id = data["student_id"][:20]
            if not student_id or Student.objects.filter(student_id=student_id).exists():
                email_local = email.split("@")[0] if email else ""
                google_fallback = (
                    f"G{data['google_user_id']}" if data["google_user_id"] else ""
                )
                student_id = gcs._unique_student_id(email_local, google_fallback)
            if not student_id:
                skipped.append(
                    {
                        "name": display_name,
                        "reason": "Could not determine a unique student ID",
                    }
                )
                continue

            Student.objects.create(
                student_id=student_id,
                first_name=data["first_name"][:30],
                last_name=data["last_name"][:30],
                email=email or None,
                google_user_id=data["google_user_id"] or None,
                cohort=cohort,
                synced_at=now,
                is_active=True,
            )
            created.append({"name": display_name, "student_id": student_id})

        # Archive students who vanished from the directory - unless the safety
        # valve fired (implausibly small fetch).
        if not safety_valve_triggered:
            archive_qs = (
                Student.objects.filter(is_active=True)
                .exclude(google_user_id__isnull=True)
                .exclude(google_user_id="")
                .exclude(google_user_id__in=seen_google_ids)
            )
            archive_list = list(archive_qs)
            archived = [s.get_full_name() for s in archive_list]
            if archive_list:
                Student.objects.filter(
                    id__in=[s.id for s in archive_list]
                ).update(is_active=False)

        if dry_run:
            transaction.set_rollback(True)

    return {
        "created": len(created),
        "updated": updated_count,
        "reactivated": len(reactivated),
        "archived": len(archived),
        "unchanged": unchanged_count,
        "skipped": len(skipped),
        "total_directory": len(student_records),
        "dry_run": dry_run,
        "safety_valve_triggered": safety_valve_triggered,
        "details": {
            "created": created,
            "reactivated": reactivated,
            "archived": archived,
            "skipped": skipped,
        },
    }
