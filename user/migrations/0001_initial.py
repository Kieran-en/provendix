import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Utilisateur',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom', models.CharField(max_length=100)),
                ('role', models.CharField(
                    choices=[
                        ('gerant', 'Gérant'),
                        ('superviseur', 'Superviseur'),
                        ('admin', 'Administrateur'),
                        ('user', 'Utilisateur'),
                    ],
                    default='user',
                    max_length=15,
                )),
                ('password', models.CharField(max_length=128)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='Animal',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom', models.CharField(max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='StadeVie',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom', models.CharField(max_length=100)),
                ('animal', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stades_vie', to='user.animal')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='Client',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom_client', models.CharField(max_length=150)),
                ('contact', models.CharField(blank=True, default='', max_length=150)),
                ('adresse', models.CharField(blank=True, default='', max_length=255)),
                ('annees_experience', models.PositiveIntegerField(default=0)),
                ('animaux_eleves', models.CharField(blank=True, default='', max_length=255)),
                ('cree_par', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='clients_enregistres',
                    to='user.utilisateur',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='MP',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom', models.CharField(max_length=150)),
                ('unite', models.CharField(default='kg', max_length=20)),
                ('prix_vente', models.FloatField(default=0.0)),
                ('stock_disponible', models.FloatField(default=0.0)),
                ('cree_par', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='mp_enregistrees',
                    to='user.utilisateur',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Matière Première',
                'verbose_name_plural': 'Matières Premières',
            },
        ),
        migrations.CreateModel(
            name='Formule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom', models.CharField(max_length=150)),
                ('code', models.CharField(max_length=50, unique=True)),
                ('prix_unitaire', models.FloatField(default=0.0)),
                ('stade_vie', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='formules', to='user.stadevie')),
                ('cree_par', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='formules_enregistrees',
                    to='user.utilisateur',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='CompositionFormule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantite', models.FloatField()),
                ('formule', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='compositions', to='user.formule')),
                ('mp', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='compositions', to='user.mp')),
            ],
            options={
                'verbose_name': 'Composition de Formule',
                'verbose_name_plural': 'Compositions de Formules',
            },
        ),
        migrations.CreateModel(
            name='LotFournisseur',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('numero_lot', models.CharField(max_length=100, unique=True)),
                ('fournisseur', models.CharField(max_length=150)),
                ('quantite', models.FloatField()),
                ('prix_achat', models.FloatField()),
                ('date_reception', models.DateField()),
                ('date_peremption', models.DateField(blank=True, null=True)),
                ('statut', models.CharField(
                    choices=[('disponible', 'Disponible'), ('epuise', 'Épuisé'), ('annule', 'Annulé')],
                    default='disponible',
                    max_length=20,
                )),
                ('mp', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lots_fournisseurs', to='user.mp')),
                ('cree_par', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='lots_fournisseurs_crees',
                    to='user.utilisateur',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='LotPF',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('numero_lot', models.CharField(max_length=100, unique=True)),
                ('quantite', models.FloatField()),
                ('date_production', models.DateField()),
                ('date_peremption', models.DateField()),
                ('statut', models.CharField(
                    choices=[('disponible', 'Disponible'), ('epuise', 'Épuisé'), ('perime', 'Périmé')],
                    default='disponible',
                    max_length=20,
                )),
                ('formule', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lots_pf', to='user.formule')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Lot Produit Fini',
            },
        ),
        migrations.CreateModel(
            name='Production',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantite', models.FloatField()),
                ('date_prevue', models.DateField()),
                ('date_production', models.DateField(blank=True, null=True)),
                ('statut', models.CharField(
                    choices=[
                        ('en_attente', 'En attente'),
                        ('en_cours', 'En cours'),
                        ('terminee', 'Terminée'),
                        ('annulee', 'Annulée'),
                    ],
                    default='en_attente',
                    max_length=20,
                )),
                ('formule', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='productions', to='user.formule')),
                ('lot_pf', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='production',
                    to='user.lotpf',
                )),
                ('cree_par', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='productions_crees',
                    to='user.utilisateur',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='Commande',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('numero_commande', models.CharField(max_length=100, unique=True)),
                ('quantite', models.FloatField()),
                ('prix_unitaire', models.FloatField()),
                ('montant_total', models.FloatField()),
                ('date_commande', models.DateField(auto_now_add=True)),
                ('date_livraison', models.DateField(blank=True, null=True)),
                ('statut', models.CharField(
                    choices=[
                        ('en_attente', 'En attente'),
                        ('confirmee', 'Confirmée'),
                        ('en_preparation', 'En préparation'),
                        ('livree', 'Livrée'),
                        ('annulee', 'Annulée'),
                    ],
                    default='en_attente',
                    max_length=20,
                )),
                ('statut_paiement', models.CharField(
                    choices=[('cash', 'Cash'), ('credit', 'Crédit'), ('partiel', 'Partiel')],
                    default='credit',
                    max_length=20,
                )),
                ('montant_paye', models.FloatField(default=0.0)),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='commandes', to='user.client')),
                ('lot_pf', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='commandes',
                    to='user.lotpf',
                )),
                ('cree_par', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='commandes_crees',
                    to='user.utilisateur',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='Vente',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(auto_now_add=True)),
                ('quantite', models.FloatField()),
                ('montant', models.FloatField()),
                ('marge', models.FloatField(default=0.0)),
                ('commande', models.OneToOneField(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='vente',
                    to='user.commande',
                )),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ventes', to='user.client')),
                ('utilisateur', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='ventes_effectuees',
                    to='user.utilisateur',
                )),
            ],
        ),
        migrations.CreateModel(
            name='Historique',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(auto_now_add=True)),
                ('stocks_mp', models.FloatField(default=0.0)),
                ('stocks_pf', models.FloatField(default=0.0)),
                ('caisse', models.FloatField(default=0.0)),
                ('vente', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='historiques',
                    to='user.vente',
                )),
                ('cree_par', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='historiques_enregistres',
                    to='user.utilisateur',
                )),
            ],
        ),
        migrations.CreateModel(
            name='AjustementStock',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type_stock', models.CharField(choices=[('mp', 'Matière Première'), ('pf', 'Produit Fini')], max_length=10)),
                ('type_ajustement', models.CharField(choices=[('ajout', 'Ajout'), ('retrait', 'Retrait')], max_length=20)),
                ('quantite', models.FloatField()),
                ('justification', models.TextField()),
                ('mp', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='ajustements',
                    to='user.mp',
                )),
                ('lot_pf', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='ajustements',
                    to='user.lotpf',
                )),
                ('cree_par', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='ajustements_stock',
                    to='user.utilisateur',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]
