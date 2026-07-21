"""
Management command : python manage.py seed_data

Purge la base et injecte un jeu de données réaliste pour PROVENDIX.
Provenderie fictive utilisant le franc CFA d'Afrique centrale (XAF).
"""
import uuid
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils import timezone
from auditlog.context import disable_auditlog


def _dt(jour):
    """Convertit une date en datetime aware (10h00) pour antidater les
    champs auto_now_add via .update() — sinon tout l'historique du seed
    serait daté du jour de son exécution."""
    return timezone.make_aware(datetime.combine(jour, time(10, 0)))

# Coût de transformation (énergie, main-d'œuvre, emballage, amortissement) appliqué
# au coût des matières pour obtenir le coût de revient d'une formule.
COEF_TRANSFORMATION = Decimal('1.08')


def _decimal(value):
    return Decimal(str(value))


class Command(BaseCommand):
    help = 'Supprime toutes les données et injecte un jeu de test réaliste'

    def handle(self, *args, **options):
        # L'audit django-auditlog est neutralisé pendant le seed : le journal
        # d'activité ne doit contenir que les actions réelles des utilisateurs,
        # pas les centaines d'insertions du jeu de test.
        with disable_auditlog():
            with transaction.atomic():
                self.stdout.write(self.style.WARNING('Suppression des donnees existantes...'))
                self._purge()
                self.stdout.write(self.style.SUCCESS('Base videe'))
                self.stdout.write('Creation des donnees...')
                superviseur, gerant1, gerant2 = self._utilisateurs()
                animaux, stades = self._animaux_stades()
                mps = self._matieres_premieres(superviseur)
                self._accessoires(superviseur)
                formules = self._formules(superviseur, stades, mps)
                self._lots_fournisseurs(superviseur, mps)
                lots_pf = self._productions(gerant1, formules, mps)
                clients = self._clients(gerant1)
                self._commandes(gerant1, gerant2, clients, lots_pf)
                self._parametres()

        self.stdout.write(self.style.SUCCESS('Jeu de donnees cree avec succes !'))
        self.stdout.write('')
        self.stdout.write('Comptes disponibles :')
        self.stdout.write('  admin.provendix   |  superviseur  |  Admin1234!')
        self.stdout.write('  gerant.principal  |  gerant       |  Gerant123!')
        self.stdout.write('  gerant.adjoint    |  gerant       |  Gerant123!')
        self.stdout.write('')

    # ─────────────────────────────────────────────────────────────
    def _purge(self):
        from user.models import (
            MouvementStock, AjustementStock, Vente, Commande, Paiement,
            Production, LotPF, LotFournisseur, CompositionFormule,
            LotConsommation, CommandeLotMP,
            Formule, MP, Accessoire, StadeVie, Animal, Client, UserToken,
            Historique, Parametre, Utilisateur,
        )
        from auditlog.models import LogEntry
        MouvementStock.objects.all().delete()
        LogEntry.objects.all().delete()
        AjustementStock.objects.all().delete()
        Paiement.objects.all().delete()
        Vente.objects.all().delete()
        CommandeLotMP.objects.all().delete()
        Commande.objects.all().delete()
        LotConsommation.objects.all().delete()
        Production.objects.all().delete()
        LotPF.objects.all().delete()
        LotFournisseur.objects.all().delete()
        CompositionFormule.objects.all().delete()
        Formule.objects.all().delete()
        MP.objects.all().delete()
        Accessoire.objects.all().delete()
        StadeVie.objects.all().delete()
        Animal.objects.all().delete()
        Client.objects.all().delete()
        Historique.objects.all().delete()
        UserToken.objects.all().delete()
        Parametre.objects.all().delete()
        Utilisateur.objects.all().delete()

    # ─────────────────────────────────────────────────────────────
    def _utilisateurs(self):
        from user.models import Utilisateur
        pwd_superviseur = make_password('Admin1234!')
        pwd_gerant = make_password('Gerant123!')

        superviseur = Utilisateur.objects.create(
            nom='Administrateur PROVENDIX', login='admin.provendix', role='superviseur',
            password=pwd_superviseur, is_active=True
        )
        gerant1 = Utilisateur.objects.create(
            nom='Gérant principal', login='gerant.principal', role='gerant',
            password=pwd_gerant, is_active=True
        )
        gerant2 = Utilisateur.objects.create(
            nom='Gérant adjoint', login='gerant.adjoint', role='gerant',
            password=pwd_gerant, is_active=True
        )
        self.stdout.write('  OK Utilisateurs (3)')
        return superviseur, gerant1, gerant2

    # ─────────────────────────────────────────────────────────────
    def _animaux_stades(self):
        from user.models import Animal, StadeVie

        donnees = {
            'Poulet': ['Démarrage (0-10j)', 'Croissance (11-28j)', 'Finition (29-42j)'],
            'Dinde':  ['Démarrage (0-14j)', 'Croissance (15-35j)', 'Finition (36-70j)'],
            'Lapin':  ['Croissance (30-70j)', 'Finition (70-90j)'],
        }

        animaux = {}
        stades = {}
        for nom_animal, noms_stades in donnees.items():
            animal = Animal.objects.create(nom=nom_animal)
            animaux[nom_animal] = animal
            for nom_stade in noms_stades:
                s = StadeVie.objects.create(nom=nom_stade, animal=animal)
                stades[f'{nom_animal}_{nom_stade}'] = s

        self.stdout.write('  OK Animaux + Stades de vie (3 animaux, 8 stades)')
        return animaux, stades

    # ─────────────────────────────────────────────────────────────
    def _matieres_premieres(self, superviseur):
        from user.models import MP

        data = [
            # nom,                 unite, prix_vente, seuil_alerte
            ('Maïs',               'kg', 210.0,  1000.0),
            ('Soja tourteau 48%',  'kg', 425.0,   800.0),
            ('Blé tendre',         'kg', 190.0,   500.0),
            ('Son de blé',         'kg', 125.0,   300.0),
            ('Huile de soja',      'kg', 900.0,   100.0),
            ('Carbonate de calcium','kg',  75.0,   200.0),
            ('Prémix Poulet Starter','kg',1600.0,   50.0),
            ('Prémix Poulet Finition','kg',1450.0,  50.0),
            ('Prémix Dinde',       'kg',1550.0,    50.0),
            ('Prémix Lapin',       'kg',1400.0,    50.0),
            ('Lysine HCl',         'kg',2100.0,    30.0),
            ('Méthionine DL',      'kg',2400.0,    30.0),
        ]

        mps = {}
        for nom, unite, prix, seuil in data:
            mp = MP.objects.create(
                nom=nom, unite=unite,
                prix_achat_moyen=_decimal(prix),
                prix_vente=(_decimal(prix) * Decimal('1.20')).quantize(Decimal('0.01')),
                stock_disponible=Decimal('0'),
                seuil_alerte=_decimal(seuil),
                cree_par=superviseur,
            )
            mps[nom] = mp

        self.stdout.write(f'  OK Matières premières ({len(mps)})')
        return mps

    def _accessoires(self, superviseur):
        from user.models import Accessoire

        data = [
            ('Abreuvoir 10 L', 'Abreuvoir plastique pour volailles', 'pièce', 4500, 6000, 24, 5),
            ('Mangeoire 5 kg', 'Mangeoire suspendue', 'pièce', 3500, 4800, 30, 5),
            ('Poussin d’un jour', 'Poussin de chair', 'tête', 650, 850, 200, 40),
            ('Poulet prêt à élever', 'Poulet démarré et vacciné', 'tête', 2500, 3200, 60, 10),
        ]
        for nom, description, unite, achat, vente, stock, seuil in data:
            Accessoire.objects.create(
                nom=nom, description=description, unite=unite,
                prix_achat=_decimal(achat), prix_vente=_decimal(vente),
                stock_disponible=_decimal(stock), seuil_alerte=_decimal(seuil),
                cree_par=superviseur,
            )
        self.stdout.write(f'  OK Accessoires ({len(data)})')

    # ─────────────────────────────────────────────────────────────
    def _formules(self, superviseur, stades, mps):
        from user.models import Formule, CompositionFormule

        F = mps  # alias court

        formules_data = [
            {
                'nom': 'Poulet Démarrage',
                'code': 'PC-DEMARR',
                'stade': 'Poulet_Démarrage (0-10j)',
                'compositions': [
                    (F['Maïs'],                 550.0),
                    (F['Soja tourteau 48%'],    350.0),
                    (F['Huile de soja'],         30.0),
                    (F['Carbonate de calcium'],  15.0),
                    (F['Prémix Poulet Starter'],  5.0),
                    (F['Lysine HCl'],             3.0),
                    (F['Méthionine DL'],          2.5),
                    (F['Blé tendre'],            44.5),
                ],
            },
            {
                'nom': 'Poulet Croissance',
                'code': 'PC-CROIS',
                'stade': 'Poulet_Croissance (11-28j)',
                'compositions': [
                    (F['Maïs'],                  600.0),
                    (F['Soja tourteau 48%'],     300.0),
                    (F['Huile de soja'],          40.0),
                    (F['Carbonate de calcium'],   10.0),
                    (F['Prémix Poulet Finition'],  5.0),
                    (F['Méthionine DL'],           2.5),
                    (F['Son de blé'],             42.5),
                ],
            },
            {
                'nom': 'Poulet Finition',
                'code': 'PC-FIN',
                'stade': 'Poulet_Finition (29-42j)',
                'compositions': [
                    (F['Maïs'],                  650.0),
                    (F['Soja tourteau 48%'],     240.0),
                    (F['Son de blé'],             50.0),
                    (F['Huile de soja'],          20.0),
                    (F['Carbonate de calcium'],   10.0),
                    (F['Prémix Poulet Finition'],  5.0),
                    (F['Méthionine DL'],           2.0),
                    (F['Blé tendre'],             23.0),
                ],
            },
            {
                'nom': 'Dinde Démarrage',
                'code': 'TD-DEMARR',
                'stade': 'Dinde_Démarrage (0-14j)',
                'compositions': [
                    (F['Maïs'],                  480.0),
                    (F['Soja tourteau 48%'],     410.0),
                    (F['Blé tendre'],             50.0),
                    (F['Carbonate de calcium'],   15.0),
                    (F['Prémix Dinde'],            5.0),
                    (F['Lysine HCl'],              3.0),
                    (F['Méthionine DL'],           2.5),
                    (F['Huile de soja'],          34.5),
                ],
            },
            {
                'nom': 'Lapin Croissance',
                'code': 'LA-CROIS',
                'stade': 'Lapin_Croissance (30-70j)',
                'compositions': [
                    (F['Son de blé'],             300.0),
                    (F['Maïs'],                   250.0),
                    (F['Soja tourteau 48%'],      200.0),
                    (F['Blé tendre'],             200.0),
                    (F['Carbonate de calcium'],    20.0),
                    (F['Prémix Lapin'],             5.0),
                    (F['Huile de soja'],           25.0),
                ],
            },
        ]

        formules = {}
        for fd in formules_data:
            formule = Formule.objects.create(
                nom=fd['nom'],
                code=fd['code'],
                stade_vie=stades.get(fd['stade']),
                prix_unitaire=Decimal('0'),  # calculé ci-dessous à partir de la composition
                cree_par=superviseur,
            )
            for mp, qte in fd['compositions']:
                CompositionFormule.objects.create(
                    formule=formule, mp=mp,
                    pourcentage=(_decimal(qte) / Decimal('10')).quantize(Decimal('0.001')),
                )

            # Coût de revient = coût des matières (par kg) × coût de transformation.
            # La composition est exprimée par tonne, d'où la division par 1000.
            cout_matieres = sum(
                (mp.prix_achat_moyen * _decimal(qte) for mp, qte in fd['compositions']),
                Decimal('0'),
            ) / Decimal('1000')
            formule.prix_unitaire = (cout_matieres * COEF_TRANSFORMATION).quantize(Decimal('0.01'))
            formule.save(update_fields=['prix_unitaire'])

            formules[fd['code']] = formule

        self.stdout.write(f'  OK Formules ({len(formules)} avec compositions, cout de revient calcule)')
        return formules

    # ─────────────────────────────────────────────────────────────
    def _lots_fournisseurs(self, superviseur, mps):
        """
        Simule 3 mois d'achats de MP avec plusieurs fournisseurs.
        Chaque lot incrémente directement le stock de la MP.
        """
        from user.models import LotFournisseur, MouvementStock

        today = date.today()

        # Les quantités couvrent la consommation des 8 productions du seed
        # (39 t d'aliments) tout en laissant un stock final réaliste : la
        # plupart des MP restent au-dessus de leur seuil d'alerte, sauf
        # l'huile de soja et la méthionine (alertes volontaires pour la démo).
        lots_data = [
            # (mp_key, fournisseur, qte, prix_achat, jours_avant, peremption_jours)
            ('Maïs',                  'Coopérative Céréales',  15000, 200.0, 75, 365),
            ('Maïs',                  'Coopérative Céréales',  10000, 207.5, 30, 365),
            ('Soja tourteau 48%',     'Agro Import Services',    7000, 415.0, 80, 270),
            ('Soja tourteau 48%',     'Agro Import Services',    6000, 422.5, 40, 270),
            ('Blé tendre',            'Coopérative Agricole',    3000, 185.0, 60, 300),
            ('Son de blé',            'Minoterie Centrale',      2000, 120.0, 55, 180),
            ('Son de blé',            'Minoterie Centrale',      1500, 122.5, 10, 180),
            ('Huile de soja',         'Huilerie Régionale',       900, 875.0, 80, 90),
            ('Huile de soja',         'Huilerie Régionale',       400, 890.0, 30, 90),
            ('Carbonate de calcium',  'Carrière Régionale',      1000, 70.0, 70, 730),
            ('Prémix Poulet Starter', 'Nutrition Animale',        200, 1575.0, 65, 90),
            ('Prémix Poulet Finition','Nutrition Animale',        200, 1425.0, 65, 90),
            ('Prémix Dinde',          'Nutrition Animale',        150, 1525.0, 50, 90),
            ('Prémix Lapin',          'Nutrition Animale',        100, 1375.0, 40, 90),
            ('Lysine HCl',            'BioChem Afrique',          100, 2075.0, 60, 180),
            ('Méthionine DL',         'BioChem Afrique',          100, 2375.0, 60, 180),
        ]

        for mp_key, fournisseur, qte, prix, jours_avant, duree_peremption in lots_data:
            mp = mps[mp_key]
            qte = _decimal(qte)
            prix = _decimal(prix)
            date_reception = today - timedelta(days=jours_avant)
            date_peremption = date_reception + timedelta(days=duree_peremption)
            numero = f"LOT-{uuid.uuid4().hex[:8].upper()}"

            lot = LotFournisseur.objects.create(
                mp=mp,
                numero_lot=numero,
                fournisseur=fournisseur,
                quantite_initiale=qte,
                quantite=qte,
                prix_achat=prix,
                date_reception=date_reception,
                date_peremption=date_peremption,
                statut='disponible',
                cree_par=superviseur,
            )
            # Incrément stock + mouvement (antidaté au jour de réception)
            avant = mp.stock_disponible
            mvt = MouvementStock.objects.create(
                mp=mp,
                type_mouvement='entree_lot',
                quantite_avant=avant,
                quantite_delta=qte,
                quantite_apres=avant + qte,
                reference_id=lot.id,
                reference_type='LotFournisseur',
                cree_par=superviseur,
            )
            MouvementStock.objects.filter(pk=mvt.pk).update(created_at=_dt(date_reception))
            mp.stock_disponible += qte
            mp.save()

        self.stdout.write(f'  OK Lots fournisseurs ({len(lots_data)} lots — stocks MP mis à jour)')

    # ─────────────────────────────────────────────────────────────
    def _productions(self, gerant, formules, mps):
        """
        Lance 8 productions sur les 2 derniers mois.
        Décrémente les stocks MP selon les compositions.
        """
        from user.models import (
            CompositionFormule, LotConsommation, LotFournisseur, LotPF,
            MouvementStock, Production,
        )

        today = date.today()

        productions_data = [
            # (code_formule, quantite_kg, jours_avant)
            ('PC-DEMARR',  5000, 60),
            ('PC-CROIS',   8000, 55),
            ('PC-FIN',     6000, 45),
            ('PC-DEMARR',  4000, 35),
            ('PC-CROIS',   6000, 28),
            ('TD-DEMARR',  3000, 20),
            ('PC-FIN',     5000, 12),
            ('LA-CROIS',   2000,  5),
        ]

        lots_pf = {}
        for code, qte_kg, jours_avant in productions_data:
            formule = formules[code]
            qte_kg = _decimal(qte_kg)
            date_prod = today - timedelta(days=jours_avant)
            date_peremption = date_prod + timedelta(days=180)

            compositions = list(
                CompositionFormule.objects.filter(formule=formule).select_related('mp')
            )
            allocations = []
            cout_matieres = Decimal('0')
            for comp in compositions:
                restant = (comp.pourcentage / Decimal('100')) * qte_kg
                lots = LotFournisseur.objects.filter(
                    mp=comp.mp, statut='disponible', quantite__gt=0,
                    date_reception__lte=date_prod,
                ).order_by('date_peremption', 'date_reception', 'id')
                for lot in lots:
                    if restant <= 0:
                        break
                    preleve = min(lot.quantite, restant)
                    allocations.append((lot, preleve))
                    cout_matieres += preleve * lot.prix_achat
                    lot.quantite -= preleve
                    if lot.quantite == 0:
                        lot.statut = 'epuise'
                    lot.save(update_fields=['quantite', 'statut'])
                    restant -= preleve
                if restant > 0:
                    raise RuntimeError(f'Lots fournisseurs insuffisants pour {comp.mp.nom}')

            # Création du Lot PF
            numero_pf = f"PF-{code[:2]}-{uuid.uuid4().hex[:6].upper()}"
            lot_pf = LotPF.objects.create(
                formule=formule,
                numero_lot=numero_pf,
                quantite_initiale=qte_kg,
                quantite=qte_kg,
                cout_revient=((cout_matieres * COEF_TRANSFORMATION) / qte_kg).quantize(Decimal('0.01')),
                date_production=date_prod,
                date_peremption=date_peremption,
                statut='disponible',
            )

            # Enregistrement de la production
            prod = Production.objects.create(
                formule=formule,
                lot_pf=lot_pf,
                quantite=qte_kg,
                date_prevue=date_prod,
                date_production=date_prod,
                statut='terminee',
                cree_par=gerant,
            )
            for lot, preleve in allocations:
                LotConsommation.objects.create(
                    production=prod, lot_fournisseur=lot,
                    quantite=preleve, cout_unitaire=lot.prix_achat,
                )
            for comp in compositions:
                consommation = (comp.pourcentage / Decimal('100')) * qte_kg
                avant = comp.mp.stock_disponible
                mouvement = MouvementStock.objects.create(
                    mp=comp.mp, type_mouvement='consommation',
                    quantite_avant=avant, quantite_delta=-consommation,
                    quantite_apres=avant - consommation,
                    reference_id=prod.id, reference_type='Production', cree_par=gerant,
                )
                MouvementStock.objects.filter(pk=mouvement.pk).update(created_at=_dt(date_prod))
                comp.mp.stock_disponible = avant - consommation
                comp.mp.save(update_fields=['stock_disponible', 'updated_at'])

            if code not in lots_pf:
                lots_pf[code] = []
            lots_pf[code].append(lot_pf)

        self.stdout.write(f'  OK Productions ({len(productions_data)} — stocks MP décrémentés)')
        return lots_pf

    # ─────────────────────────────────────────────────────────────
    def _clients(self, gerant):
        from user.models import Client

        clients_data = [
            ('Ferme Espoir & Fils',      '6 55 12 34 56', 'Yaoundé',     12, 'Poulet, Dinde'),
            ('Élevage du Centre',        '6 60 98 76 54', 'Mbalmayo',      7, 'Poulet'),
            ('Aviculture des Collines', '6 71 23 45 67', 'Bafoussam',    15, 'Poulet, Lapin'),
            ('Ferme Horizon',           '6 50 34 56 78', 'Douala',        5, 'Poulet'),
            ('Coopérative AgriPlus',    '6 62 45 67 89', 'Ebolowa',      20, 'Dinde, Lapin'),
            ('Ferme Nkolbisson',        '6 70 56 78 90', 'Yaoundé',       3, 'Poulet'),
            ('Élevage du Littoral',     '6 58 67 89 01', 'Douala',        9, 'Lapin'),
            ('SARL Proavi Centre',      '6 63 78 90 12', 'Yaoundé',      18, 'Poulet, Dinde'),
            ('Ferme Sainte-Marie',      '6 71 89 01 23', 'Bafang',        2, 'Poulet'),
            ('Ferme des Plateaux',      '6 54 90 12 34', 'Bamenda',       6, 'Poulet, Lapin'),
        ]

        clients = []
        for nom, contact, adresse, annees, animaux in clients_data:
            c = Client.objects.create(
                nom_client=nom,
                contact=contact,
                adresse=adresse,
                annees_experience=annees,
                animaux_eleves=animaux,
                cree_par=gerant,
            )
            clients.append(c)

        self.stdout.write(f'  OK Clients ({len(clients)})')
        return clients

    # ─────────────────────────────────────────────────────────────
    def _commandes(self, gerant1, gerant2, clients, lots_pf):
        """
        Crée 18 commandes réalistes avec différents statuts de paiement,
        différentes quantités et différents clients.
        Décrémente automatiquement les Lots PF.
        """
        from user.models import Commande, MouvementStock, Paiement

        today = date.today()

        # Récupérer les lots PF disponibles
        pf_demarr = lots_pf.get('PC-DEMARR', [])
        pf_crois  = lots_pf.get('PC-CROIS',  [])
        pf_fin    = lots_pf.get('PC-FIN',    [])
        pf_dinde  = lots_pf.get('TD-DEMARR', [])
        pf_lapin  = lots_pf.get('LA-CROIS',  [])

        # Prix de vente alignés sur les coûts de revient calculés dans _formules()
        # (~347 / 333 / 302 / 364 / 264 FCFA/kg) pour des marges de démonstration
        # provenderie (12 à 18 %). Les prix augmentent légèrement dans le temps.
        # (client_idx, lot_pf, qte_kg, prix_unit_FCFA, jours_avant, mode_saisi, montant_paye_ratio)
        commandes_data = [
            (0, pf_demarr[0], 1000, 400.0, 58, 'cash',    1.0),
            (1, pf_crois[0],  2000, 380.0, 52, 'cash',    1.0),
            (2, pf_fin[0],    1500, 345.0, 43, 'credit',  0.0),
            (3, pf_demarr[0], 800,  400.0, 33, 'cash',    1.0),
            (4, pf_dinde[0],  1200, 425.0, 19, 'credit',  0.0),
            (0, pf_crois[0],  3000, 380.0, 27, 'cash',    1.0),
            (5, pf_fin[0],    500,  345.0, 25, 'partiel', 0.5),
            (7, pf_demarr[1], 2000, 405.0, 34, 'cash',    1.0),
            (1, pf_crois[1],  2500, 385.0, 26, 'credit',  0.0),
            (6, pf_lapin[0],  800,  310.0, 22, 'cash',    1.0),
            (2, pf_fin[1],    2000, 350.0, 18, 'cash',    1.0),
            (8, pf_demarr[1], 600,  405.0, 15, 'cash',    1.0),
            (3, pf_crois[1],  1800, 385.0, 13, 'partiel', 0.6),
            (9, pf_fin[1],    1000, 350.0, 11, 'credit',  0.0),
            (4, pf_lapin[0],  500,  310.0,  9, 'cash',    1.0),
            (0, pf_dinde[0],  800,  425.0,  7, 'credit',  0.0),
            (7, pf_crois[1],  1500, 385.0,  4, 'cash',    1.0),
            (5, pf_demarr[1], 400,  405.0,  2, 'partiel', 0.3),
        ]

        gerants = [gerant1, gerant2]
        for i, (cli_idx, lot_pf, qte, prix, jours, paiement, ratio) in enumerate(commandes_data):
            qte = _decimal(qte)
            prix = _decimal(prix)
            if lot_pf is None or lot_pf.quantite < qte:
                continue

            client = clients[cli_idx]
            gerant = gerants[i % 2]
            date_cmd = today - timedelta(days=jours)
            montant_total = qte * prix
            montant_paye = (montant_total * _decimal(ratio)).quantize(Decimal('0.01'))
            mode_paiement = 'cash' if paiement == 'cash' else 'credit'
            etat_paiement = 'paye' if montant_paye == montant_total else ('partiel' if montant_paye > 0 else 'non_paye')

            commande = Commande.objects.create(
                client=client,
                lot_pf=lot_pf,
                numero_commande=f"CMD-{uuid.uuid4().hex[:8].upper()}",
                quantite=qte,
                prix_unitaire=prix,
                cout_unitaire=lot_pf.cout_revient,
                montant_total=montant_total,
                montant_paye=montant_paye,
                mode_paiement=mode_paiement,
                statut_paiement=etat_paiement,
                statut='livree' if jours > 5 else 'confirmee',
                cree_par=gerant,
            )
            # date_commande est auto_now_add : on antidate après insertion,
            # sinon toutes les ventes du seed seraient datées d'aujourd'hui
            # (graphique CA sur 30 jours réduit à un seul point).
            Commande.objects.filter(pk=commande.pk).update(date_commande=date_cmd)
            commande.date_commande = date_cmd
            if montant_paye > 0:
                paiement_obj = Paiement.objects.create(
                    commande=commande, montant=montant_paye, cree_par=gerant,
                )
                Paiement.objects.filter(pk=paiement_obj.pk).update(created_at=_dt(date_cmd))

            # Décrémentation Lot PF + mouvement (antidaté au jour de vente)
            avant = lot_pf.quantite
            mvt = MouvementStock.objects.create(
                lot_pf=lot_pf,
                type_mouvement='vente',
                quantite_avant=avant,
                quantite_delta=-qte,
                quantite_apres=avant - qte,
                reference_id=commande.id,
                reference_type='Commande',
                cree_par=gerant,
            )
            MouvementStock.objects.filter(pk=mvt.pk).update(created_at=_dt(date_cmd))
            lot_pf.quantite -= qte
            if lot_pf.quantite <= 0:
                lot_pf.statut = 'epuise'
            lot_pf.save()

        self.stdout.write(f'  OK Commandes/Ventes ({len(commandes_data)} — lots PF décrémentés)')

    # ─────────────────────────────────────────────────────────────
    def _parametres(self):
        from user.models import Parametre

        params = [
            ('nom_provenderie',     'PROVENDIX',               'Nom affiché sur les factures'),
            ('seuil_alerte_stock',  '500',                    'Seuil d\'alerte stock global (kg)'),
            ('duree_peremption_pf', '180',                    'Durée de péremption PF en jours'),
            ('devise',              'XAF',                    'Devise ISO (franc CFA d\'Afrique centrale)'),
            ('coefficient_transformation', '1.08',            'Coefficient des frais de transformation'),
            ('marge_vente_mp',       '20',                    'Marge automatique sur les ventes de MP (%)'),
            ('adresse_provenderie', 'Yaoundé, Cameroun',     'Adresse de la provenderie'),
            ('telephone',           '+237 600 00 00 00',      'Téléphone principal'),
            ('nif',                 'DEMO-NIF',                'Numéro d\'Identification Fiscale'),
        ]

        for cle, valeur, description in params:
            Parametre.objects.create(cle=cle, valeur=valeur, description=description)

        self.stdout.write(f'  OK Paramètres système ({len(params)})')
