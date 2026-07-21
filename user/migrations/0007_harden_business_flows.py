from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


def migrate_existing_data(apps, schema_editor):
    Utilisateur = apps.get_model('user', 'Utilisateur')
    UserToken = apps.get_model('user', 'UserToken')
    Commande = apps.get_model('user', 'Commande')
    Paiement = apps.get_model('user', 'Paiement')
    LotPF = apps.get_model('user', 'LotPF')
    LotFournisseur = apps.get_model('user', 'LotFournisseur')
    LotConsommation = apps.get_model('user', 'LotConsommation')
    Production = apps.get_model('user', 'Production')
    CompositionFormule = apps.get_model('user', 'CompositionFormule')
    Parametre = apps.get_model('user', 'Parametre')

    used_logins = set()
    for utilisateur in Utilisateur.objects.order_by('id'):
        base = (utilisateur.nom or f'utilisateur-{utilisateur.pk}').strip().lower()
        login = base
        suffix = 2
        while login in used_logins:
            login = f'{base}-{suffix}'
            suffix += 1
        utilisateur.login = login
        utilisateur.save(update_fields=['login'])
        used_logins.add(login)

    # Les anciens jetons n'avaient ni expiration ni vrai refresh token.
    UserToken.objects.all().delete()

    for lot_pf in LotPF.objects.select_related('formule'):
        lot_pf.cout_revient = Decimal(str(lot_pf.formule.prix_unitaire or 0))
        lot_pf.save(update_fields=['cout_revient'])

    for commande in Commande.objects.all():
        ancien = commande.statut_paiement
        paye = Decimal(str(commande.montant_paye or 0))
        total = Decimal(str(commande.montant_total or 0))
        commande.mode_paiement = 'cash' if ancien == 'cash' else 'credit'
        commande.statut_paiement = (
            'paye' if paye >= total else ('partiel' if paye > 0 else 'non_paye')
        )
        commande.save(update_fields=['mode_paiement', 'statut_paiement'])
        if paye > 0:
            Paiement.objects.create(
                commande_id=commande.pk,
                montant=paye,
                cree_par_id=commande.cree_par_id,
            )

    Parametre.objects.filter(cle='devise', valeur__in=['DA', 'DZD']).update(
        valeur='XAF', description='Devise ISO (franc CFA d\'Afrique centrale)'
    )
    Parametre.objects.get_or_create(
        cle='coefficient_transformation',
        defaults={'valeur': '1.08', 'description': 'Coefficient des frais de transformation'},
    )

    # Reconstitution FEFO des consommations historiques disponibles.
    for lot in LotFournisseur.objects.exclude(statut='annule'):
        lot.quantite = lot.quantite_initiale
        lot.statut = 'disponible'
        lot.save(update_fields=['quantite', 'statut'])

    productions = Production.objects.filter(statut='terminee').order_by('date_production', 'id')
    for production in productions:
        compositions = CompositionFormule.objects.filter(formule_id=production.formule_id)
        for comp in compositions:
            requis = (
                Decimal(str(comp.quantite)) / Decimal('1000')
            ) * Decimal(str(production.quantite))
            lots = list(
                LotFournisseur.objects.filter(
                    mp_id=comp.mp_id,
                    statut='disponible',
                    quantite__gt=0,
                    date_reception__lte=production.date_production,
                ).order_by('date_peremption', 'date_reception', 'id')
            )
            restant = requis
            for lot in lots:
                if restant <= 0:
                    break
                disponible = Decimal(str(lot.quantite))
                preleve = min(disponible, restant)
                LotConsommation.objects.create(
                    production_id=production.pk,
                    lot_fournisseur_id=lot.pk,
                    quantite=preleve,
                    cout_unitaire=Decimal(str(lot.prix_achat)),
                )
                lot.quantite = disponible - preleve
                if lot.quantite == 0:
                    lot.statut = 'epuise'
                lot.save(update_fields=['quantite', 'statut'])
                restant -= preleve


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [('user', '0006_delete_logactivite')]

    operations = [
        migrations.AddField(
            model_name='utilisateur', name='login',
            field=models.CharField(max_length=100, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='usertoken', name='refresh_key',
            field=models.CharField(max_length=64, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='usertoken', name='access_expires_at',
            field=models.DateTimeField(default=django.utils.timezone.now), preserve_default=False,
        ),
        migrations.AddField(
            model_name='usertoken', name='refresh_expires_at',
            field=models.DateTimeField(default=django.utils.timezone.now), preserve_default=False,
        ),
        migrations.AddField(
            model_name='lotpf', name='cout_revient',
            field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=18),
        ),
        migrations.AddField(
            model_name='commande', name='mode_paiement',
            field=models.CharField(choices=[('cash', 'Espèces'), ('credit', 'Crédit')], default='cash', max_length=20),
        ),
        migrations.CreateModel(
            name='Paiement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('montant', models.DecimalField(decimal_places=2, max_digits=18)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('commande', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='paiements', to='user.commande')),
                ('cree_par', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='paiements_enregistres', to='user.utilisateur')),
            ],
            options={'ordering': ['created_at']},
        ),
        migrations.CreateModel(
            name='LotConsommation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantite', models.DecimalField(decimal_places=3, max_digits=16)),
                ('cout_unitaire', models.DecimalField(decimal_places=2, max_digits=18)),
                ('lot_fournisseur', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='consommations_production', to='user.lotfournisseur')),
                ('production', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='consommations_lots', to='user.production')),
            ],
        ),
        migrations.RunPython(migrate_existing_data, reverse_noop),
        migrations.AlterField(
            model_name='utilisateur', name='login',
            field=models.CharField(max_length=100, unique=True),
        ),
        migrations.AlterField(
            model_name='usertoken', name='refresh_key',
            field=models.CharField(max_length=64, unique=True),
        ),
        migrations.AlterField(model_name='mp', name='prix_vente', field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=18)),
        migrations.AlterField(model_name='mp', name='stock_disponible', field=models.DecimalField(decimal_places=3, default=Decimal('0'), max_digits=16)),
        migrations.AlterField(model_name='mp', name='seuil_alerte', field=models.DecimalField(decimal_places=3, default=Decimal('500'), max_digits=16)),
        migrations.AlterField(model_name='formule', name='prix_unitaire', field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=18)),
        migrations.AlterField(model_name='compositionformule', name='quantite', field=models.DecimalField(decimal_places=3, max_digits=16)),
        migrations.AlterField(model_name='lotfournisseur', name='mp', field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='lots_fournisseurs', to='user.mp')),
        migrations.AlterField(model_name='lotfournisseur', name='quantite_initiale', field=models.DecimalField(decimal_places=3, default=Decimal('0'), max_digits=16)),
        migrations.AlterField(model_name='lotfournisseur', name='quantite', field=models.DecimalField(decimal_places=3, max_digits=16)),
        migrations.AlterField(model_name='lotfournisseur', name='prix_achat', field=models.DecimalField(decimal_places=2, max_digits=18)),
        migrations.AlterField(model_name='lotpf', name='formule', field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='lots_pf', to='user.formule')),
        migrations.AlterField(model_name='lotpf', name='quantite_initiale', field=models.DecimalField(decimal_places=3, default=Decimal('0'), max_digits=16)),
        migrations.AlterField(model_name='lotpf', name='quantite', field=models.DecimalField(decimal_places=3, max_digits=16)),
        migrations.AlterField(model_name='production', name='formule', field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='productions', to='user.formule')),
        migrations.AlterField(model_name='production', name='lot_pf', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='production', to='user.lotpf')),
        migrations.AlterField(model_name='production', name='quantite', field=models.DecimalField(decimal_places=3, max_digits=16)),
        migrations.AlterField(model_name='commande', name='client', field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='commandes', to='user.client')),
        migrations.AlterField(model_name='commande', name='lot_pf', field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='commandes', to='user.lotpf')),
        migrations.AlterField(model_name='commande', name='quantite', field=models.DecimalField(decimal_places=3, max_digits=16)),
        migrations.AlterField(model_name='commande', name='prix_unitaire', field=models.DecimalField(decimal_places=2, max_digits=18)),
        migrations.AlterField(model_name='commande', name='montant_total', field=models.DecimalField(decimal_places=2, max_digits=18)),
        migrations.AlterField(model_name='commande', name='montant_paye', field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=18)),
        migrations.AlterField(model_name='commande', name='statut_paiement', field=models.CharField(choices=[('non_paye', 'Non payé'), ('partiel', 'Partiellement payé'), ('paye', 'Payé')], default='non_paye', max_length=20)),
        migrations.AlterField(model_name='vente', name='commande', field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='vente', to='user.commande')),
        migrations.AlterField(model_name='vente', name='client', field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='ventes', to='user.client')),
        migrations.AlterField(model_name='vente', name='quantite', field=models.DecimalField(decimal_places=3, max_digits=16)),
        migrations.AlterField(model_name='vente', name='montant', field=models.DecimalField(decimal_places=2, max_digits=18)),
        migrations.AlterField(model_name='vente', name='marge', field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=18)),
        migrations.AlterField(model_name='historique', name='date', field=models.DateField(unique=True)),
        migrations.AlterField(model_name='historique', name='stocks_mp', field=models.DecimalField(decimal_places=3, default=Decimal('0'), max_digits=18)),
        migrations.AlterField(model_name='historique', name='stocks_pf', field=models.DecimalField(decimal_places=3, default=Decimal('0'), max_digits=18)),
        migrations.AlterField(model_name='historique', name='caisse', field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=18)),
        migrations.AlterField(model_name='ajustementstock', name='mp', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='ajustements', to='user.mp')),
        migrations.AlterField(model_name='ajustementstock', name='lot_pf', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='ajustements', to='user.lotpf')),
        migrations.AlterField(model_name='ajustementstock', name='quantite', field=models.DecimalField(decimal_places=3, max_digits=16)),
        migrations.AlterField(model_name='mouvementstock', name='mp', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='mouvements', to='user.mp')),
        migrations.AlterField(model_name='mouvementstock', name='lot_pf', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='mouvements', to='user.lotpf')),
        migrations.AlterField(model_name='mouvementstock', name='quantite_avant', field=models.DecimalField(decimal_places=3, max_digits=16)),
        migrations.AlterField(model_name='mouvementstock', name='quantite_delta', field=models.DecimalField(decimal_places=3, max_digits=16)),
        migrations.AlterField(model_name='mouvementstock', name='quantite_apres', field=models.DecimalField(decimal_places=3, max_digits=16)),
        migrations.AlterField(model_name='mouvementstock', name='type_mouvement', field=models.CharField(choices=[('entree_lot', 'Entrée lot fournisseur'), ('consommation', 'Consommation production'), ('vente', 'Vente produit fini'), ('annulation_vente', 'Annulation de vente'), ('ajustement', 'Ajustement inventaire')], max_length=20)),
        migrations.AddConstraint(model_name='mp', constraint=models.CheckConstraint(check=models.Q(('prix_vente__gte', 0)), name='mp_prix_non_negatif')),
        migrations.AddConstraint(model_name='mp', constraint=models.CheckConstraint(check=models.Q(('stock_disponible__gte', 0)), name='mp_stock_non_negatif')),
        migrations.AddConstraint(model_name='mp', constraint=models.CheckConstraint(check=models.Q(('seuil_alerte__gte', 0)), name='mp_seuil_non_negatif')),
        migrations.AddConstraint(model_name='compositionformule', constraint=models.UniqueConstraint(fields=('formule', 'mp'), name='composition_mp_unique')),
        migrations.AddConstraint(model_name='compositionformule', constraint=models.CheckConstraint(check=models.Q(('quantite__gt', 0)), name='composition_quantite_positive')),
        migrations.AddConstraint(model_name='lotfournisseur', constraint=models.CheckConstraint(check=models.Q(('quantite_initiale__gt', 0)), name='lot_f_initiale_positive')),
        migrations.AddConstraint(model_name='lotfournisseur', constraint=models.CheckConstraint(check=models.Q(('quantite__gte', 0)), name='lot_f_quantite_non_negative')),
        migrations.AddConstraint(model_name='lotfournisseur', constraint=models.CheckConstraint(check=models.Q(('prix_achat__gte', 0)), name='lot_f_prix_non_negatif')),
        migrations.AddConstraint(model_name='lotpf', constraint=models.CheckConstraint(check=models.Q(('quantite_initiale__gt', 0)), name='lot_pf_initiale_positive')),
        migrations.AddConstraint(model_name='lotpf', constraint=models.CheckConstraint(check=models.Q(('quantite__gte', 0)), name='lot_pf_quantite_non_negative')),
        migrations.AddConstraint(model_name='lotpf', constraint=models.CheckConstraint(check=models.Q(('cout_revient__gte', 0)), name='lot_pf_cout_non_negatif')),
        migrations.AddConstraint(model_name='production', constraint=models.CheckConstraint(check=models.Q(('quantite__gt', 0)), name='production_quantite_positive')),
        migrations.AddConstraint(model_name='commande', constraint=models.CheckConstraint(check=models.Q(('quantite__gt', 0)), name='commande_quantite_positive')),
        migrations.AddConstraint(model_name='commande', constraint=models.CheckConstraint(check=models.Q(('prix_unitaire__gte', 0)), name='commande_prix_non_negatif')),
        migrations.AddConstraint(model_name='commande', constraint=models.CheckConstraint(check=models.Q(('montant_total__gte', 0)), name='commande_total_non_negatif')),
        migrations.AddConstraint(model_name='commande', constraint=models.CheckConstraint(check=models.Q(('montant_paye__gte', 0)), name='commande_paye_non_negatif')),
        migrations.AddConstraint(model_name='commande', constraint=models.CheckConstraint(check=models.Q(('montant_paye__lte', models.F('montant_total'))), name='commande_paye_sous_total')),
        migrations.AddConstraint(model_name='paiement', constraint=models.CheckConstraint(check=models.Q(('montant__gt', 0)), name='paiement_montant_positif')),
        migrations.AddConstraint(model_name='ajustementstock', constraint=models.CheckConstraint(check=models.Q(('quantite__gt', 0)), name='ajustement_quantite_positive')),
        migrations.AddConstraint(model_name='ajustementstock', constraint=models.CheckConstraint(check=models.Q(models.Q(('lot_pf__isnull', True), ('mp__isnull', False), ('type_stock', 'mp')), models.Q(('lot_pf__isnull', False), ('mp__isnull', True), ('type_stock', 'pf')), _connector='OR'), name='ajustement_cible_coherente')),
        migrations.AddConstraint(model_name='lotconsommation', constraint=models.UniqueConstraint(fields=('production', 'lot_fournisseur'), name='allocation_lot_unique')),
        migrations.AddConstraint(model_name='lotconsommation', constraint=models.CheckConstraint(check=models.Q(('quantite__gt', 0)), name='allocation_quantite_positive')),
    ]
