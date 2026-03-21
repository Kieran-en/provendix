from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('user', '0004_alter_formule_stade_vie'),
    ]

    operations = [
        # ─── Ajout seuil_alerte sur MP ───
        migrations.AddField(
            model_name='mp',
            name='seuil_alerte',
            field=models.FloatField(default=500.0),
        ),

        # ─── quantite_initiale sur LotFournisseur ───
        migrations.AddField(
            model_name='lotfournisseur',
            name='quantite_initiale',
            field=models.FloatField(default=0.0),
        ),

        # ─── quantite_initiale sur LotPF ───
        migrations.AddField(
            model_name='lotpf',
            name='quantite_initiale',
            field=models.FloatField(default=0.0),
        ),

        # ─── FIX : statut_paiement default "credit" au lieu de "non_paye" ───
        migrations.AlterField(
            model_name='commande',
            name='statut_paiement',
            field=models.CharField(
                choices=[('cash', 'Cash'), ('credit', 'Crédit'), ('partiel', 'Partiel')],
                default='credit',
                max_length=20,
            ),
        ),

        # ─── FIX : rôle "user" supprimé, default gerant ───
        migrations.AlterField(
            model_name='utilisateur',
            name='role',
            field=models.CharField(
                choices=[
                    ('gerant', 'Gérant'),
                    ('superviseur', 'Superviseur'),
                    ('admin', 'Administrateur'),
                ],
                default='gerant',
                max_length=15,
            ),
        ),

        # ─── NOUVEAU : MouvementStock ───
        migrations.CreateModel(
            name='MouvementStock',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type_mouvement', models.CharField(
                    choices=[
                        ('entree_lot', 'Entrée lot fournisseur'),
                        ('consommation', 'Consommation production'),
                        ('vente', 'Vente produit fini'),
                        ('ajustement', 'Ajustement inventaire'),
                    ],
                    max_length=20,
                )),
                ('quantite_avant', models.FloatField()),
                ('quantite_delta', models.FloatField()),
                ('quantite_apres', models.FloatField()),
                ('reference_id', models.IntegerField(blank=True, null=True)),
                ('reference_type', models.CharField(blank=True, max_length=50, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('cree_par', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='mouvements_stock',
                    to='user.utilisateur',
                )),
                ('mp', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='mouvements',
                    to='user.mp',
                )),
                ('lot_pf', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='mouvements',
                    to='user.lotpf',
                )),
            ],
            options={
                'verbose_name': 'Mouvement de Stock',
                'verbose_name_plural': 'Mouvements de Stock',
                'ordering': ['-created_at'],
            },
        ),

        # ─── NOUVEAU : LogActivite ───
        migrations.CreateModel(
            name='LogActivite',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(
                    choices=[
                        ('login', 'Connexion'),
                        ('logout', 'Déconnexion'),
                        ('create', 'Création'),
                        ('update', 'Modification'),
                        ('delete', 'Suppression'),
                        ('production', 'Production'),
                        ('vente', 'Vente'),
                        ('ajustement', 'Ajustement stock'),
                        ('reset_password', 'Réinitialisation MDP'),
                    ],
                    max_length=20,
                )),
                ('module', models.CharField(max_length=50)),
                ('objet_id', models.IntegerField(blank=True, null=True)),
                ('description', models.TextField()),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('utilisateur', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='logs',
                    to='user.utilisateur',
                )),
            ],
            options={
                'verbose_name': "Log d'activité",
                'verbose_name_plural': "Logs d'activité",
                'ordering': ['-created_at'],
            },
        ),

        # ─── NOUVEAU : Parametre ───
        migrations.CreateModel(
            name='Parametre',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cle', models.CharField(max_length=100, unique=True)),
                ('valeur', models.TextField()),
                ('description', models.CharField(blank=True, max_length=255)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Paramètre',
                'verbose_name_plural': 'Paramètres',
            },
        ),
    ]
