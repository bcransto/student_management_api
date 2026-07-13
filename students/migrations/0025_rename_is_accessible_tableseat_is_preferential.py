# Generated manually to preserve data via RenameField (GH issue #13:
# repurpose the unused "accessible" seat flag as "preferential seating").

from django.db import migrations, models


def reset_preferential_flags(apps, schema_editor):
    # The old is_accessible field defaulted to True and was never actually
    # used, so nearly every seat carried True. That value has no meaning as
    # "preferential" - start every seat at False so teachers opt in by
    # marking seats in the layout editor.
    TableSeat = apps.get_model("students", "TableSeat")
    TableSeat.objects.update(is_preferential=False)


class Migration(migrations.Migration):

    dependencies = [
        ("students", "0024_class_is_active"),
    ]

    operations = [
        migrations.RenameField(
            model_name="tableseat",
            old_name="is_accessible",
            new_name="is_preferential",
        ),
        migrations.AlterField(
            model_name="tableseat",
            name="is_preferential",
            field=models.BooleanField(default=False, help_text="Is this a preferential seating seat?"),
        ),
        migrations.RunPython(reset_preferential_flags, migrations.RunPython.noop),
    ]
