from django.db import migrations


def backfill_cohort(apps, schema_editor):
    """
    Populate Student.cohort from the two-digit prefix of the email local part.

    The cohort is the first two characters of the email local part when both
    are digits (e.g. "28abrenn@school.edu" -> "28"), else blank. This mirrors
    the grouping the Workspace directory import already uses.
    """
    Student = apps.get_model("students", "Student")
    updated = []
    for student in Student.objects.exclude(email__isnull=True).exclude(email="").iterator():
        local = student.email.split("@")[0]
        prefix = local[:2]
        cohort = prefix if len(prefix) == 2 and prefix.isdigit() else ""
        if cohort and student.cohort != cohort:
            student.cohort = cohort
            updated.append(student)
    if updated:
        Student.objects.bulk_update(updated, ["cohort"])


def clear_cohort(apps, schema_editor):
    Student = apps.get_model("students", "Student")
    Student.objects.update(cohort="")


class Migration(migrations.Migration):

    dependencies = [
        ("students", "0020_teacherstudent_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill_cohort, clear_cohort),
    ]
