# Generated by Django 4.2.8 on 2024-01-01 11:28

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("zerver", "0550_set_default_value_for_realm_direct_message_initiator_group_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="realm",
            name="direct_message_initiator_group",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.RESTRICT,
                related_name="+",
                to="zerver.usergroup",
            ),
        ),
        migrations.AlterField(
            model_name="realm",
            name="direct_message_permission_group",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.RESTRICT,
                related_name="+",
                to="zerver.usergroup",
            ),
        ),
    ]
