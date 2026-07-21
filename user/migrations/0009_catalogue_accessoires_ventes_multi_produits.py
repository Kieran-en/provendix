from decimal import Decimal

import django.db.models.deletion
from django.db import migrations, models


def migrer_donnees(apps, schema_editor):
    Composition = apps.get_model('user', 'CompositionFormule')
    MP = apps.get_model('user', 'MP')
    Commande = apps.get_model('user', 'Commande')
    Parametre = apps.get_model('user', 'Parametre')

    for composition in Composition.objects.all():
        composition.pourcentage = (
            Decimal(str(composition.pourcentage)) / Decimal('10')
        ).quantize(Decimal('0.001'))
        composition.save(update_fields=['pourcentage'])

    for mp in MP.objects.all():
        prix_achat = Decimal(str(mp.prix_vente or 0))
        mp.prix_achat_moyen = prix_achat
        mp.prix_vente = (prix_achat * Decimal('1.20')).quantize(Decimal('0.01'))
        mp.save(update_fields=['prix_achat_moyen', 'prix_vente'])

    for commande in Commande.objects.select_related('lot_pf').all():
        commande.type_produit = 'pf'
        commande.cout_unitaire = (
            Decimal(str(commande.lot_pf.cout_revient)) if commande.lot_pf_id else Decimal('0')
        )
        commande.save(update_fields=['type_produit', 'cout_unitaire'])

    Parametre.objects.update_or_create(
        cle='marge_vente_mp',
        defaults={'valeur': '20', 'description': 'Marge automatique sur la vente des matières premières (%)'},
    )


def restaurer_donnees(apps, schema_editor):
    Composition = apps.get_model('user', 'CompositionFormule')
    for composition in Composition.objects.all():
        composition.pourcentage = (
            Decimal(str(composition.pourcentage)) * Decimal('10')
        ).quantize(Decimal('0.001'))
        composition.save(update_fields=['pourcentage'])


class Migration(migrations.Migration):

    dependencies = [
        ('user', '0008_strengthen_stock_constraints'),
    ]

    operations = [
        migrations.CreateModel(
            name='Accessoire',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom', models.CharField(max_length=150, unique=True)),
                ('description', models.TextField(blank=True, default='')),
                ('unite', models.CharField(default='pièce', max_length=30)),
                ('photo', models.ImageField(blank=True, null=True, upload_to='accessoires/%Y/%m/')),
                ('prix_achat', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=18)),
                ('prix_vente', models.DecimalField(decimal_places=2, max_digits=18)),
                ('stock_disponible', models.DecimalField(decimal_places=3, default=Decimal('0'), max_digits=16)),
                ('seuil_alerte', models.DecimalField(decimal_places=3, default=Decimal('0'), max_digits=16)),
                ('actif', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('cree_par', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='accessoires_enregistres', to='user.utilisateur')),
            ],
            options={'ordering': ['nom']},
        ),
        migrations.AddField(
            model_name='mp', name='prix_achat_moyen',
            field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=18),
        ),
        migrations.AddField(
            model_name='mp', name='actif', field=models.BooleanField(default=True),
        ),
        migrations.RemoveConstraint(
            model_name='compositionformule', name='composition_quantite_positive',
        ),
        migrations.RenameField(
            model_name='compositionformule', old_name='quantite', new_name='pourcentage',
        ),
        migrations.AlterField(
            model_name='compositionformule', name='pourcentage',
            field=models.DecimalField(decimal_places=3, max_digits=6),
        ),
        migrations.AlterField(
            model_name='commande', name='lot_pf',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='commandes', to='user.lotpf'),
        ),
        migrations.AddField(
            model_name='commande', name='accessoire',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='commandes', to='user.accessoire'),
        ),
        migrations.AddField(
            model_name='commande', name='mp',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='commandes', to='user.mp'),
        ),
        migrations.AddField(
            model_name='commande', name='type_produit',
            field=models.CharField(choices=[('pf', 'Produit fini'), ('mp', 'Matière première'), ('accessoire', 'Accessoire')], default='pf', max_length=20),
        ),
        migrations.AddField(
            model_name='commande', name='cout_unitaire',
            field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=18),
        ),
        migrations.AddField(
            model_name='ajustementstock', name='accessoire',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='ajustements', to='user.accessoire'),
        ),
        migrations.AlterField(
            model_name='ajustementstock', name='type_stock',
            field=models.CharField(choices=[('mp', 'Matière Première'), ('pf', 'Produit Fini'), ('accessoire', 'Accessoire')], max_length=10),
        ),
        migrations.AddField(
            model_name='mouvementstock', name='accessoire',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='mouvements', to='user.accessoire'),
        ),
        migrations.AlterField(
            model_name='mouvementstock', name='type_mouvement',
            field=models.CharField(choices=[('entree_lot', 'Entrée lot fournisseur'), ('consommation', 'Consommation production'), ('vente', 'Vente produit fini'), ('vente_mp', 'Vente matière première'), ('vente_accessoire', 'Vente accessoire'), ('annulation_vente', 'Annulation de vente'), ('ajustement', 'Ajustement inventaire')], max_length=20),
        ),
        migrations.CreateModel(
            name='CommandeLotMP',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantite', models.DecimalField(decimal_places=3, max_digits=16)),
                ('cout_unitaire', models.DecimalField(decimal_places=2, max_digits=18)),
                ('commande', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='lots_mp_vendus', to='user.commande')),
                ('lot_fournisseur', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='ventes_directes', to='user.lotfournisseur')),
            ],
        ),
        migrations.RunPython(migrer_donnees, restaurer_donnees),
        migrations.AddConstraint(
            model_name='accessoire',
            constraint=models.CheckConstraint(condition=models.Q(('prix_achat__gte', 0)), name='accessoire_achat_non_negatif'),
        ),
        migrations.AddConstraint(
            model_name='accessoire',
            constraint=models.CheckConstraint(condition=models.Q(('prix_vente__gt', 0)), name='accessoire_vente_positive'),
        ),
        migrations.AddConstraint(
            model_name='accessoire',
            constraint=models.CheckConstraint(condition=models.Q(('stock_disponible__gte', 0)), name='accessoire_stock_non_negatif'),
        ),
        migrations.AddConstraint(
            model_name='accessoire',
            constraint=models.CheckConstraint(condition=models.Q(('seuil_alerte__gte', 0)), name='accessoire_seuil_non_negatif'),
        ),
        migrations.AddConstraint(
            model_name='mp',
            constraint=models.CheckConstraint(condition=models.Q(('prix_achat_moyen__gte', 0)), name='mp_prix_achat_non_negatif'),
        ),
        migrations.AddConstraint(
            model_name='compositionformule',
            constraint=models.CheckConstraint(condition=models.Q(('pourcentage__gt', 0), ('pourcentage__lte', 100)), name='composition_pourcentage_valide'),
        ),
        migrations.AddConstraint(
            model_name='commande',
            constraint=models.CheckConstraint(condition=models.Q(('cout_unitaire__gte', 0)), name='commande_cout_non_negatif'),
        ),
        migrations.AddConstraint(
            model_name='commande',
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(('accessoire__isnull', True), ('lot_pf__isnull', False), ('mp__isnull', True), ('type_produit', 'pf')),
                    models.Q(('accessoire__isnull', True), ('lot_pf__isnull', True), ('mp__isnull', False), ('type_produit', 'mp')),
                    models.Q(('accessoire__isnull', False), ('lot_pf__isnull', True), ('mp__isnull', True), ('type_produit', 'accessoire')),
                    _connector='OR',
                ),
                name='commande_produit_coherent',
            ),
        ),
        migrations.RemoveConstraint(
            model_name='ajustementstock', name='ajustement_cible_coherente',
        ),
        migrations.AddConstraint(
            model_name='ajustementstock',
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(('accessoire__isnull', True), ('lot_pf__isnull', True), ('mp__isnull', False), ('type_stock', 'mp')),
                    models.Q(('accessoire__isnull', True), ('lot_pf__isnull', False), ('mp__isnull', True), ('type_stock', 'pf')),
                    models.Q(('accessoire__isnull', False), ('lot_pf__isnull', True), ('mp__isnull', True), ('type_stock', 'accessoire')),
                    _connector='OR',
                ),
                name='ajustement_cible_coherente',
            ),
        ),
        migrations.RemoveConstraint(
            model_name='mouvementstock', name='mouvement_cible_coherente',
        ),
        migrations.AddConstraint(
            model_name='mouvementstock',
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(('accessoire__isnull', True), ('lot_pf__isnull', True), ('mp__isnull', False)),
                    models.Q(('accessoire__isnull', True), ('lot_pf__isnull', False), ('mp__isnull', True)),
                    models.Q(('accessoire__isnull', False), ('lot_pf__isnull', True), ('mp__isnull', True)),
                    _connector='OR',
                ),
                name='mouvement_cible_coherente',
            ),
        ),
        migrations.AddConstraint(
            model_name='commandelotmp',
            constraint=models.UniqueConstraint(fields=('commande', 'lot_fournisseur'), name='vente_mp_lot_unique'),
        ),
        migrations.AddConstraint(
            model_name='commandelotmp',
            constraint=models.CheckConstraint(condition=models.Q(('quantite__gt', 0)), name='vente_mp_quantite_positive'),
        ),
        migrations.AddConstraint(
            model_name='commandelotmp',
            constraint=models.CheckConstraint(condition=models.Q(('cout_unitaire__gte', 0)), name='vente_mp_cout_non_negatif'),
        ),
    ]
