"""
Management command : python manage.py seed_data

Purge la base et injecte un jeu de données réaliste pour PROVENDIX.
Provenderie fictive : "Provenderie El Baraka" — Tizi-Ouzou, Algérie
"""
import uuid
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.db import transaction


class Command(BaseCommand):
    help = 'Supprime toutes les données et injecte un jeu de test réaliste'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Suppression des donnees existantes...'))
        self._purge()
        self.stdout.write(self.style.SUCCESS('Base videe'))

        with transaction.atomic():
            self.stdout.write('Creation des donnees...')
            superviseur, gerant1, gerant2 = self._utilisateurs()
            animaux, stades = self._animaux_stades()
            mps = self._matieres_premieres(superviseur)
            formules = self._formules(superviseur, stades, mps)
            self._lots_fournisseurs(superviseur, mps)
            lots_pf = self._productions(gerant1, formules, mps)
            clients = self._clients(gerant1)
            self._commandes(gerant1, gerant2, clients, lots_pf)
            self._parametres()

        self.stdout.write(self.style.SUCCESS('Jeu de donnees cree avec succes !'))
        self.stdout.write('')
        self.stdout.write('Comptes disponibles :')
        self.stdout.write('  admin.baraka  |  superviseur  |  Admin1234!')
        self.stdout.write('  m.kaci        |  gerant       |  Gerant123!')
        self.stdout.write('  f.zerrouk     |  gerant       |  Gerant123!')
        self.stdout.write('')

    # ─────────────────────────────────────────────────────────────
    def _purge(self):
        from user.models import (
            MouvementStock, LogActivite, AjustementStock, Vente, Commande,
            Production, LotPF, LotFournisseur, CompositionFormule,
            Formule, MP, StadeVie, Animal, Client, UserToken,
            Historique, Parametre, Utilisateur,
        )
        MouvementStock.objects.all().delete()
        LogActivite.objects.all().delete()
        AjustementStock.objects.all().delete()
        Vente.objects.all().delete()
        Commande.objects.all().delete()
        Production.objects.all().delete()
        LotPF.objects.all().delete()
        LotFournisseur.objects.all().delete()
        CompositionFormule.objects.all().delete()
        Formule.objects.all().delete()
        MP.objects.all().delete()
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
            nom='admin.baraka', role='superviseur',
            password=pwd_superviseur, is_active=True
        )
        gerant1 = Utilisateur.objects.create(
            nom='m.kaci', role='gerant',
            password=pwd_gerant, is_active=True
        )
        gerant2 = Utilisateur.objects.create(
            nom='f.zerrouk', role='gerant',
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
            ('Maïs',               'kg',  42.0,  1000.0),
            ('Soja tourteau 48%',  'kg',  85.0,   800.0),
            ('Blé tendre',         'kg',  38.0,   500.0),
            ('Son de blé',         'kg',  25.0,   300.0),
            ('Huile de soja',      'kg', 180.0,   100.0),
            ('Carbonate de calcium','kg',  15.0,   200.0),
            ('Prémix Poulet Starter','kg',320.0,    50.0),
            ('Prémix Poulet Finition','kg',290.0,   50.0),
            ('Prémix Dinde',       'kg', 310.0,    50.0),
            ('Prémix Lapin',       'kg', 280.0,    50.0),
            ('Lysine HCl',         'kg', 420.0,    30.0),
            ('Méthionine DL',      'kg', 480.0,    30.0),
        ]

        mps = {}
        for nom, unite, prix, seuil in data:
            mp = MP.objects.create(
                nom=nom, unite=unite,
                prix_vente=prix,
                stock_disponible=0.0,
                seuil_alerte=seuil,
                cree_par=superviseur,
            )
            mps[nom] = mp

        self.stdout.write(f'  OK Matières premières ({len(mps)})')
        return mps

    # ─────────────────────────────────────────────────────────────
    def _formules(self, superviseur, stades, mps):
        from user.models import Formule, CompositionFormule

        F = mps  # alias court

        formules_data = [
            {
                'nom': 'Poulet Démarrage',
                'code': 'PC-DEMARR',
                'stade': 'Poulet_Démarrage (0-10j)',
                'prix_unitaire': 95.0,
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
                'prix_unitaire': 88.0,
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
                'prix_unitaire': 82.0,
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
                'prix_unitaire': 110.0,
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
                'prix_unitaire': 78.0,
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
                prix_unitaire=fd['prix_unitaire'],
                cree_par=superviseur,
            )
            for mp, qte in fd['compositions']:
                CompositionFormule.objects.create(formule=formule, mp=mp, quantite=qte)
            formules[fd['code']] = formule

        self.stdout.write(f'  OK Formules ({len(formules)} avec compositions)')
        return formules

    # ─────────────────────────────────────────────────────────────
    def _lots_fournisseurs(self, superviseur, mps):
        """
        Simule 3 mois d'achats de MP avec plusieurs fournisseurs.
        Chaque lot incrémente directement le stock de la MP.
        """
        from user.models import LotFournisseur, MouvementStock

        today = date.today()

        lots_data = [
            # (mp_key, fournisseur, qte, prix_achat, jours_avant, peremption_jours)
            ('Maïs',                  'SARL Grains du Nord',    8000, 40.0,  75, 365),
            ('Maïs',                  'SARL Grains du Nord',    5000, 41.5,  30, 365),
            ('Soja tourteau 48%',     'Import Agro DZ',         4000, 83.0,  80, 270),
            ('Soja tourteau 48%',     'Import Agro DZ',         3000, 84.5,  25, 270),
            ('Blé tendre',            'Coopérative El Khir',    3000, 37.0,  60, 300),
            ('Son de blé',            'Minoterie Taboukert',    2000, 24.0,  55, 180),
            ('Son de blé',            'Minoterie Taboukert',    1500, 24.5,  10, 180),
            ('Huile de soja',         'Cevital Industrie',       500, 175.0, 45,  90),
            ('Huile de soja',         'Cevital Industrie',       300, 178.0,  8,  90),
            ('Carbonate de calcium',  'Carrière Djurdjura',     1000, 14.0,  70, 730),
            ('Prémix Poulet Starter', 'VICO Nutrition',          200, 315.0, 65,  90),
            ('Prémix Poulet Finition','VICO Nutrition',          200, 285.0, 65,  90),
            ('Prémix Dinde',          'VICO Nutrition',          150, 305.0, 50,  90),
            ('Prémix Lapin',          'VICO Nutrition',          100, 275.0, 40,  90),
            ('Lysine HCl',            'BioChem Alger',           100, 415.0, 60, 180),
            ('Méthionine DL',         'BioChem Alger',           100, 475.0, 60, 180),
        ]

        for mp_key, fournisseur, qte, prix, jours_avant, duree_peremption in lots_data:
            mp = mps[mp_key]
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
            # Incrément stock + mouvement
            avant = mp.stock_disponible
            MouvementStock.objects.create(
                mp=mp,
                type_mouvement='entree_lot',
                quantite_avant=avant,
                quantite_delta=qte,
                quantite_apres=avant + qte,
                reference_id=lot.id,
                reference_type='LotFournisseur',
                cree_par=superviseur,
            )
            mp.stock_disponible += qte
            mp.save()

        self.stdout.write(f'  OK Lots fournisseurs ({len(lots_data)} lots — stocks MP mis à jour)')

    # ─────────────────────────────────────────────────────────────
    def _productions(self, gerant, formules, mps):
        """
        Lance 8 productions sur les 2 derniers mois.
        Décrémente les stocks MP selon les compositions.
        """
        from user.models import Production, LotPF, MouvementStock, CompositionFormule

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
            date_prod = today - timedelta(days=jours_avant)
            date_peremption = date_prod + timedelta(days=180)

            # Décrémentation des stocks MP
            compositions = list(
                CompositionFormule.objects.filter(formule=formule).select_related('mp')
            )
            for comp in compositions:
                consommation = (comp.quantite / 1000.0) * qte_kg
                avant = comp.mp.stock_disponible
                MouvementStock.objects.create(
                    mp=comp.mp,
                    type_mouvement='consommation',
                    quantite_avant=avant,
                    quantite_delta=-consommation,
                    quantite_apres=avant - consommation,
                    reference_type='Production',
                    cree_par=gerant,
                )
                comp.mp.stock_disponible = max(0, avant - consommation)
                comp.mp.save()

            # Création du Lot PF
            numero_pf = f"PF-{code[:2]}-{uuid.uuid4().hex[:6].upper()}"
            lot_pf = LotPF.objects.create(
                formule=formule,
                numero_lot=numero_pf,
                quantite_initiale=qte_kg,
                quantite=qte_kg,
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
            # Mettre à jour reference_id dans les mouvements
            MouvementStock.objects.filter(
                reference_type='Production', reference_id__isnull=True,
                cree_par=gerant,
            ).update(reference_id=prod.id)

            if code not in lots_pf:
                lots_pf[code] = []
            lots_pf[code].append(lot_pf)

        self.stdout.write(f'  OK Productions ({len(productions_data)} — stocks MP décrémentés)')
        return lots_pf

    # ─────────────────────────────────────────────────────────────
    def _clients(self, gerant):
        from user.models import Client

        clients_data = [
            ('Ferme Bouzid & Fils',      '0555 12 34 56', 'Tizi-Ouzou',      12, 'Poulet, Dinde'),
            ('Élevage El Hamel',         '0660 98 76 54', 'Béjaïa',           7, 'Poulet'),
            ('SARL Avicole Djurdjura',   '0771 23 45 67', 'Tizi-Ouzou',      15, 'Poulet, Lapin'),
            ('Ferme Ammour',             '0550 34 56 78', 'Boumerdès',        5, 'Poulet'),
            ('Coopérative Agri-Kabyle',  '0662 45 67 89', 'Tizi-Ouzou',      20, 'Dinde, Lapin'),
            ('M. Ouali Rabah',           '0770 56 78 90', 'Boghni',           3, 'Poulet'),
            ('Élevage Taboukert',        '0558 67 89 01', 'Aïn El Hammam',    9, 'Lapin'),
            ('SARL Proavi Tizi',         '0663 78 90 12', 'Tizi-Ouzou',      18, 'Poulet, Dinde'),
            ('Mme Slimane Fatima',       '0771 89 01 23', 'Draa Ben Khedda',  2, 'Poulet'),
            ('Ferme Cheurfa',            '0554 90 12 34', 'Freha',             6, 'Poulet, Lapin'),
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
        from user.models import Commande, MouvementStock

        today = date.today()

        # Récupérer les lots PF disponibles
        pf_demarr = lots_pf.get('PC-DEMARR', [])
        pf_crois  = lots_pf.get('PC-CROIS',  [])
        pf_fin    = lots_pf.get('PC-FIN',    [])
        pf_dinde  = lots_pf.get('TD-DEMARR', [])
        pf_lapin  = lots_pf.get('LA-CROIS',  [])

        # (client_idx, lot_pf, qte_kg, prix_unit_DA, jours_avant, statut_paiement, montant_paye_ratio)
        commandes_data = [
            (0, pf_demarr[0], 1000, 115.0, 58, 'cash',    1.0),
            (1, pf_crois[0],  2000, 105.0, 52, 'cash',    1.0),
            (2, pf_fin[0],    1500, 98.0,  43, 'credit',  0.0),
            (3, pf_demarr[0], 800,  115.0, 33, 'cash',    1.0),
            (4, pf_dinde[0],  1200, 130.0, 19, 'credit',  0.0),
            (0, pf_crois[0],  3000, 105.0, 27, 'cash',    1.0),
            (5, pf_fin[0],    500,  98.0,  25, 'partiel', 0.5),
            (7, pf_demarr[1], 2000, 116.0, 34, 'cash',    1.0),
            (1, pf_crois[1],  2500, 106.0, 26, 'credit',  0.0),
            (6, pf_lapin[0],  800,  95.0,  22, 'cash',    1.0),
            (2, pf_fin[1],    2000, 99.0,  18, 'cash',    1.0),
            (8, pf_demarr[1], 600,  116.0, 15, 'cash',    1.0),
            (3, pf_crois[1],  1800, 106.0, 13, 'partiel', 0.6),
            (9, pf_fin[1],    1000, 99.0,  11, 'credit',  0.0),
            (4, pf_lapin[0],  500,  95.0,   9, 'cash',    1.0),
            (0, pf_dinde[0],  800,  130.0,  7, 'credit',  0.0),
            (7, pf_crois[1],  1500, 106.0,  4, 'cash',    1.0),
            (5, pf_demarr[1], 400,  116.0,  2, 'partiel', 0.3),
        ]

        gerants = [gerant1, gerant2]
        for i, (cli_idx, lot_pf, qte, prix, jours, paiement, ratio) in enumerate(commandes_data):
            if lot_pf is None or lot_pf.quantite < qte:
                continue

            client = clients[cli_idx]
            gerant = gerants[i % 2]
            date_cmd = today - timedelta(days=jours)
            montant_total = qte * prix
            montant_paye = round(montant_total * ratio, 2)

            commande = Commande.objects.create(
                client=client,
                lot_pf=lot_pf,
                numero_commande=f"CMD-{uuid.uuid4().hex[:8].upper()}",
                quantite=qte,
                prix_unitaire=prix,
                montant_total=montant_total,
                montant_paye=montant_paye,
                statut_paiement=paiement,
                statut='livree' if jours > 5 else 'confirmee',
                date_commande=date_cmd,
                cree_par=gerant,
            )

            # Décrémentation Lot PF + mouvement
            avant = lot_pf.quantite
            MouvementStock.objects.create(
                lot_pf=lot_pf,
                type_mouvement='vente',
                quantite_avant=avant,
                quantite_delta=-qte,
                quantite_apres=avant - qte,
                reference_id=commande.id,
                reference_type='Commande',
                cree_par=gerant,
            )
            lot_pf.quantite -= qte
            if lot_pf.quantite <= 0:
                lot_pf.statut = 'epuise'
            lot_pf.save()

        self.stdout.write(f'  OK Commandes/Ventes ({len(commandes_data)} — lots PF décrémentés)')

    # ─────────────────────────────────────────────────────────────
    def _parametres(self):
        from user.models import Parametre

        params = [
            ('nom_provenderie',     'Provenderie El Baraka',  'Nom affiché sur les factures'),
            ('seuil_alerte_stock',  '500',                    'Seuil d\'alerte stock global (kg)'),
            ('duree_peremption_pf', '180',                    'Durée de péremption PF en jours'),
            ('devise',              'DA',                     'Devise (Dinars Algériens)'),
            ('adresse_provenderie', 'Zone industrielle Oued Aïssi, Tizi-Ouzou 15000', 'Adresse de la provenderie'),
            ('telephone',           '026 21 34 56',           'Téléphone principal'),
            ('nif',                 '00912345678901234',       'Numéro d\'Identification Fiscale'),
        ]

        for cle, valeur, description in params:
            Parametre.objects.create(cle=cle, valeur=valeur, description=description)

        self.stdout.write(f'  OK Paramètres système ({len(params)})')
