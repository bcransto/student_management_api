# Deploy: daily Workspace directory sync (pinto)

Installs a systemd service + timer that runs
`python manage.py sync_workspace_directory` once a day, mirroring the Google
Workspace directory into the global `Student` list (upsert / reactivate /
archive). Runs alongside the existing `student-management.service` gunicorn unit.

## Prerequisites

1. **A sync account connected to Google with the Directory scope.** The command
   uses one teacher account's stored OAuth credentials
   (`GoogleClassroomCredentials`). That account must have completed the Google
   Classroom / Workspace connect flow in the app so its token carries
   `admin.directory.user.readonly`. Verify with `GET /api/google/status/` (the
   `scopes` list must include the directory scope) or just run the command with
   `--dry-run` (see below) — it errors clearly if the scope is missing.

2. **`DIRECTORY_SYNC_USER_EMAIL` set** in the production env file
   `/home/bcransto/student_management_api/.env`, e.g.:

   ```bash
   DIRECTORY_SYNC_USER_EMAIL=bcranston@carlisle.k12.ma.us
   ```

   (Or skip the env var and pass `--user <email>` in the service's `ExecStart`.)

## Try it by hand first

```bash
cd ~/student_management_api
source myenv/bin/activate            # or use ./myenv/bin/python directly
python manage.py sync_workspace_directory --dry-run
# then, for real:
python manage.py sync_workspace_directory
```

`--dry-run` prints the full summary (created / updated / reactivated / archived
/ unchanged / skipped) without writing anything.

## Install the timer

```bash
# From the repo checkout on pinto:
cd ~/student_management_api
sudo cp deploy/sync-workspace-directory.service /etc/systemd/system/
sudo cp deploy/sync-workspace-directory.timer   /etc/systemd/system/
sudo systemctl daemon-reload

# Enable + start the timer (the .service is triggered by the timer, not enabled itself)
sudo systemctl enable --now sync-workspace-directory.timer
```

## Verify / troubleshoot

```bash
# When does it next fire? Is it active?
systemctl list-timers sync-workspace-directory.timer
systemctl status sync-workspace-directory.timer

# Run the sync immediately (out of schedule) to test the unit end-to-end:
sudo systemctl start sync-workspace-directory.service
systemctl status sync-workspace-directory.service   # shows last exit code

# Logs (the command prints its summary to stdout, captured by the journal):
journalctl -u sync-workspace-directory.service -n 50 --no-pager
```

A non-zero exit (auth problem, directory fetch failure) shows up in
`systemctl status` and the journal. The command's safety valve also refuses to
archive anyone if the directory fetch comes back implausibly small.

## Notes

- Edit the schedule in `sync-workspace-directory.timer` (`OnCalendar=`) and
  re-run `daemon-reload` + `restart` the timer to change the time.
- The service reuses the same `EnvironmentFile` as gunicorn, so `DJANGO_ENV=pi`
  and the Google/encryption settings are already in scope.
