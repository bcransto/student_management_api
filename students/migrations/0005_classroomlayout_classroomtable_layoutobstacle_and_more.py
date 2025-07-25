# Generated by Django 5.2.3 on 2025-06-24 02:22

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("students", "0004_remove_class_max_groups"),
    ]

    operations = [
        migrations.CreateModel(
            name="ClassroomLayout",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "name",
                    models.CharField(
                        help_text="e.g., 'Room 201 Standard', 'Science Lab Layout'",
                        max_length=100,
                    ),
                ),
                (
                    "description",
                    models.TextField(
                        blank=True, help_text="Description of this layout"
                    ),
                ),
                (
                    "room_width",
                    models.PositiveIntegerField(
                        help_text="Room width in grid units (e.g., 12)"
                    ),
                ),
                (
                    "room_height",
                    models.PositiveIntegerField(
                        help_text="Room height in grid units (e.g., 8)"
                    ),
                ),
                (
                    "is_template",
                    models.BooleanField(
                        default=False,
                        help_text="Can this layout be used by other teachers?",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="ClassroomTable",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "table_number",
                    models.PositiveIntegerField(
                        help_text="Unique table number within the classroom"
                    ),
                ),
                (
                    "table_name",
                    models.CharField(
                        blank=True,
                        help_text="Optional name like 'Front Left', 'Group A'",
                        max_length=50,
                    ),
                ),
                (
                    "x_position",
                    models.PositiveIntegerField(
                        help_text="X coordinate on the room grid"
                    ),
                ),
                (
                    "y_position",
                    models.PositiveIntegerField(
                        help_text="Y coordinate on the room grid"
                    ),
                ),
                (
                    "width",
                    models.PositiveIntegerField(
                        default=2, help_text="Table width in grid units"
                    ),
                ),
                (
                    "height",
                    models.PositiveIntegerField(
                        default=2, help_text="Table height in grid units"
                    ),
                ),
                (
                    "max_seats",
                    models.PositiveIntegerField(
                        default=4, help_text="Maximum number of students at this table"
                    ),
                ),
                (
                    "table_shape",
                    models.CharField(
                        choices=[
                            ("rectangular", "Rectangular"),
                            ("round", "Round"),
                            ("u_shaped", "U-Shaped"),
                            ("individual", "Individual Desk"),
                        ],
                        default="rectangular",
                        max_length=20,
                    ),
                ),
                (
                    "rotation",
                    models.PositiveIntegerField(
                        choices=[(0, "0°"), (90, "90°"), (180, "180°"), (270, "270°")],
                        default=0,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["table_number"],
            },
        ),
        migrations.CreateModel(
            name="LayoutObstacle",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "name",
                    models.CharField(
                        help_text="e.g., 'Teacher Desk', 'Bookshelf', 'Door'",
                        max_length=100,
                    ),
                ),
                (
                    "obstacle_type",
                    models.CharField(
                        choices=[
                            ("teacher_desk", "Teacher Desk"),
                            ("cabinet", "Cabinet"),
                            ("bookshelf", "Bookshelf"),
                            ("door", "Door"),
                            ("window", "Window"),
                            ("whiteboard", "Whiteboard"),
                            ("projector", "Projector"),
                            ("other", "Other"),
                        ],
                        max_length=30,
                    ),
                ),
                ("x_position", models.PositiveIntegerField()),
                ("y_position", models.PositiveIntegerField()),
                ("width", models.PositiveIntegerField(default=1)),
                ("height", models.PositiveIntegerField(default=1)),
                (
                    "color",
                    models.CharField(
                        default="#cccccc", help_text="Hex color code", max_length=7
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name="SeatingAssignment",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "seat_id",
                    models.CharField(
                        help_text="Seat ID from classroom layout (e.g., '1-2' for table 1, seat 2)",
                        max_length=20,
                    ),
                ),
                (
                    "group_number",
                    models.PositiveIntegerField(
                        blank=True, help_text="Group number (1-6 typically)", null=True
                    ),
                ),
                (
                    "group_role",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("leader", "Group Leader"),
                            ("secretary", "Secretary"),
                            ("presenter", "Presenter"),
                            ("researcher", "Researcher"),
                            ("member", "Member"),
                        ],
                        help_text="Student's role within the group",
                        max_length=20,
                    ),
                ),
                (
                    "assignment_notes",
                    models.TextField(
                        blank=True,
                        help_text="Notes specific to this seating assignment",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": [
                    "group_number",
                    "seat_id",
                    "roster_entry__student__last_name",
                ],
            },
        ),
        migrations.CreateModel(
            name="SeatingPeriod",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "name",
                    models.CharField(
                        help_text="e.g., 'Week 1-2', 'September 1-15', 'Quarter 1'",
                        max_length=100,
                    ),
                ),
                ("start_date", models.DateField()),
                ("end_date", models.DateField(blank=True, null=True)),
                (
                    "is_active",
                    models.BooleanField(
                        default=False,
                        help_text="Only one period can be active per class",
                    ),
                ),
                (
                    "notes",
                    models.TextField(
                        blank=True, help_text="Notes about this seating arrangement"
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["-start_date"],
            },
        ),
        migrations.CreateModel(
            name="TableSeat",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "seat_number",
                    models.PositiveIntegerField(
                        help_text="Unique seat number within the table"
                    ),
                ),
                (
                    "relative_x",
                    models.FloatField(
                        help_text="X position relative to table (0.0 - 1.0)"
                    ),
                ),
                (
                    "relative_y",
                    models.FloatField(
                        help_text="Y position relative to table (0.0 - 1.0)"
                    ),
                ),
                (
                    "is_accessible",
                    models.BooleanField(
                        default=True, help_text="Is this seat wheelchair accessible?"
                    ),
                ),
                (
                    "notes",
                    models.CharField(
                        blank=True,
                        help_text="Special notes about this seat",
                        max_length=200,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["seat_number"],
            },
        ),
        migrations.AlterModelOptions(
            name="classroster",
            options={"ordering": ["student__last_name", "student__first_name"]},
        ),
        migrations.AlterUniqueTogether(
            name="classroster",
            unique_together={("class_assigned", "student")},
        ),
        migrations.AddIndex(
            model_name="classroster",
            index=models.Index(
                fields=["is_active"], name="students_cl_is_acti_9715ea_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="classroster",
            index=models.Index(
                fields=["class_assigned", "is_active"],
                name="students_cl_class_a_4ac37d_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="student",
            index=models.Index(
                fields=["is_active"], name="students_st_is_acti_c00e81_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="student",
            index=models.Index(
                fields=["student_id"], name="students_st_student_e7126a_idx"
            ),
        ),
        migrations.AddField(
            model_name="classroomlayout",
            name="created_by",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="created_layouts",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="class",
            name="classroom_layout",
            field=models.ForeignKey(
                blank=True,
                help_text="Physical layout of the classroom",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="classes_using_layout",
                to="students.classroomlayout",
            ),
        ),
        migrations.AddField(
            model_name="classroomtable",
            name="layout",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="tables",
                to="students.classroomlayout",
            ),
        ),
        migrations.AddField(
            model_name="layoutobstacle",
            name="layout",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="obstacles",
                to="students.classroomlayout",
            ),
        ),
        migrations.AddField(
            model_name="seatingassignment",
            name="roster_entry",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="seating_assignments",
                to="students.classroster",
            ),
        ),
        migrations.AddField(
            model_name="seatingperiod",
            name="class_assigned",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="seating_periods",
                to="students.class",
            ),
        ),
        migrations.AddField(
            model_name="seatingassignment",
            name="seating_period",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="seating_assignments",
                to="students.seatingperiod",
            ),
        ),
        migrations.AddField(
            model_name="tableseat",
            name="table",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="seats",
                to="students.classroomtable",
            ),
        ),
        migrations.RemoveField(
            model_name="classroster",
            name="group_number",
        ),
        migrations.RemoveField(
            model_name="classroster",
            name="group_role",
        ),
        migrations.RemoveField(
            model_name="classroster",
            name="seat_number",
        ),
        migrations.AlterUniqueTogether(
            name="classroomtable",
            unique_together={("layout", "table_number")},
        ),
        migrations.AddIndex(
            model_name="seatingperiod",
            index=models.Index(
                fields=["is_active"], name="students_se_is_acti_42c047_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="seatingperiod",
            index=models.Index(
                fields=["class_assigned", "is_active"],
                name="students_se_class_a_460cae_idx",
            ),
        ),
        migrations.AlterUniqueTogether(
            name="seatingperiod",
            unique_together={("class_assigned", "name")},
        ),
        migrations.AddIndex(
            model_name="seatingassignment",
            index=models.Index(
                fields=["seat_id"], name="students_se_seat_id_3c618e_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="seatingassignment",
            index=models.Index(
                fields=["group_number"], name="students_se_group_n_b9081a_idx"
            ),
        ),
        migrations.AlterUniqueTogether(
            name="seatingassignment",
            unique_together={
                ("seating_period", "roster_entry"),
                ("seating_period", "seat_id"),
            },
        ),
        migrations.AlterUniqueTogether(
            name="tableseat",
            unique_together={("table", "seat_number")},
        ),
    ]
