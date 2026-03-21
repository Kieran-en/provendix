from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('user', '0003_usertoken'),
    ]

    operations = [
        migrations.AlterField(
            model_name='formule',
            name='stade_vie',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='formules',
                to='user.stadevie',
            ),
        ),
    ]
