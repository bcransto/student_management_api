"""
Sync the global Student list from the Google Workspace directory.

Intended to run daily via cron / systemd timer on pinto (see deploy/), but can
be run by hand at any time.

Sync user selection (first match wins):
  1. --user <email>
  2. settings.DIRECTORY_SYNC_USER_EMAIL (from the DIRECTORY_SYNC_USER_EMAIL env var)
The chosen account must have connected Google with the Directory scope.

Exits non-zero on any failure so cron / systemd flags it.
"""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from students import directory_sync
from students.google_classroom_service import DirectoryAuthError
from students.models import User


class Command(BaseCommand):
    help = "Sync the global Student list from the Google Workspace directory."

    def add_arguments(self, parser):
        parser.add_argument(
            "--user",
            dest="user_email",
            help=(
                "Email of the Google-connected account whose credentials to use. "
                "Defaults to settings.DIRECTORY_SYNC_USER_EMAIL."
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Compute and print the summary without writing any changes.",
        )

    def handle(self, *args, **options):
        email = options.get("user_email") or getattr(
            settings, "DIRECTORY_SYNC_USER_EMAIL", ""
        )
        if not email:
            raise CommandError(
                "No sync user. Pass --user <email> or set the "
                "DIRECTORY_SYNC_USER_EMAIL environment variable."
            )

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            raise CommandError(f"No active user found with email {email!r}.")

        dry_run = options["dry_run"]
        try:
            summary = directory_sync.sync_directory(user, dry_run=dry_run)
        except DirectoryAuthError as e:
            raise CommandError(
                f"Google credentials problem for {user.email}: {e.message} "
                f"The sync account must connect Google with the Directory scope."
            )
        except directory_sync.DirectorySyncError as e:
            raise CommandError(str(e))
        except Exception as e:  # pragma: no cover - defensive
            raise CommandError(f"Directory sync failed: {e}")

        self._print_summary(user, summary, dry_run)

    def _print_summary(self, user, summary, dry_run):
        prefix = "DRY RUN - " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}Workspace directory sync via {user.email}"
            )
        )
        self.stdout.write(
            f"  directory students seen: {summary['total_directory']}"
        )
        self.stdout.write(f"  created:     {summary['created']}")
        self.stdout.write(f"  updated:     {summary['updated']}")
        self.stdout.write(f"  reactivated: {summary['reactivated']}")
        self.stdout.write(f"  archived:    {summary['archived']}")
        self.stdout.write(f"  unchanged:   {summary['unchanged']}")
        self.stdout.write(f"  skipped:     {summary['skipped']}")

        details = summary.get("details", {})
        if summary["skipped"]:
            self.stdout.write(
                self.style.WARNING(
                    "  skipped: "
                    + ", ".join(
                        f"{s['name']} ({s['reason']})" for s in details.get("skipped", [])
                    )
                )
            )
        if summary["archived"]:
            self.stdout.write(
                "  archived: " + ", ".join(details.get("archived", []))
            )

        if summary.get("safety_valve_triggered"):
            self.stdout.write(
                self.style.WARNING(
                    "  SAFETY VALVE: directory returned too few students; "
                    "archiving was skipped."
                )
            )
