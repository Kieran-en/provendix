from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.hashers import make_password
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    Accessoire,
    Client,
    Commande,
    CommandeLotMP,
    Formule,
    LotConsommation,
    LotFournisseur,
    LotPF,
    MP,
    Paiement,
    Parametre,
    UserToken,
    Utilisateur,
)


class ProvendixAPITestCase(TestCase):
    def setUp(self):
        self.superviseur = Utilisateur.objects.create(
            nom='Superviseur Test', login='superviseur', role='superviseur',
            password=make_password('MotDePasse-Solide-2026'),
        )
        self.gerant = Utilisateur.objects.create(
            nom='Gérant Test', login='gerant', role='gerant',
            password=make_password('MotDePasse-Solide-2026'),
        )
        self.client = APIClient()

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def create_production_fixture(self):
        self.authenticate(self.superviseur)
        mp1 = MP.objects.create(nom='Maïs', prix_achat_moyen=Decimal('100'), prix_vente=Decimal('120'), cree_par=self.superviseur)
        mp2 = MP.objects.create(nom='Soja', prix_achat_moyen=Decimal('200'), prix_vente=Decimal('240'), cree_par=self.superviseur)
        today = timezone.localdate()
        for mp, numero, quantite, cout in (
            (mp1, 'LF-MAIS-1', '100', '100'),
            (mp2, 'LF-SOJA-1', '100', '200'),
        ):
            response = self.client.post('/api/lots-fournisseurs', {
                'matiere_premiere_id': mp.id,
                'numero_lot': numero,
                'fournisseur': 'Fournisseur test',
                'quantite_initiale': quantite,
                'cout_kg': cout,
                'date_reception': str(today),
                'date_peremption': str(today + timedelta(days=90)),
            }, format='json')
            self.assertEqual(response.status_code, 201, response.data)

        response = self.client.post('/api/formules', {
            'nom': 'Formule test',
            'code': 'FORMULE-TEST',
            'compositions': [
                {'mp_id': mp1.id, 'pourcentage': '60'},
                {'mp_id': mp2.id, 'pourcentage': '40'},
            ],
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        formule = Formule.objects.get(code='FORMULE-TEST')

        self.authenticate(self.gerant)
        response = self.client.post('/api/productions', {
            'formule': formule.id,
            'quantite': '100',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return formule, mp1, mp2, LotPF.objects.get(pk=response.data['lot_pf'])

    def test_login_uses_httponly_hashed_tokens_and_generic_errors(self):
        response = self.client.post('/api/auth/login', {
            'login': 'superviseur', 'mot_de_passe': 'MotDePasse-Solide-2026',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('access_token', response.data)
        self.assertNotIn('refresh_token', response.data)
        self.assertTrue(response.cookies['access_token']['httponly'])
        self.assertTrue(response.cookies['refresh_token']['httponly'])
        token = UserToken.objects.get(utilisateur=self.superviseur)
        self.assertNotEqual(token.key, response.cookies['access_token'].value)
        self.assertEqual(response.data['settings']['currency_code'], 'XAF')

        bad_user = self.client.post('/api/auth/login', {
            'login': 'inconnu', 'mot_de_passe': 'incorrect',
        }, format='json')
        bad_password = self.client.post('/api/auth/login', {
            'login': 'superviseur', 'mot_de_passe': 'incorrect',
        }, format='json')
        self.assertEqual(bad_user.status_code, 401)
        self.assertEqual(bad_user.data, bad_password.data)

    def test_cookie_authentication_enforces_csrf_on_writes(self):
        browser = APIClient(enforce_csrf_checks=True)
        login = browser.post('/api/auth/login', {
            'login': 'gerant', 'mot_de_passe': 'MotDePasse-Solide-2026',
        }, format='json')
        self.assertEqual(login.status_code, 200)
        denied = browser.post('/api/clients', {'nom': 'Client sans CSRF'}, format='json')
        self.assertEqual(denied.status_code, 403)

        csrf = browser.cookies['csrftoken'].value
        self.assertEqual(browser.post('/api/auth/refresh', format='json').status_code, 403)
        self.assertEqual(
            browser.post('/api/auth/refresh', format='json', HTTP_X_CSRFTOKEN=csrf).status_code,
            200,
        )
        accepted = browser.post(
            '/api/clients', {'nom': 'Client avec CSRF'}, format='json',
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(accepted.status_code, 201, accepted.data)

    def test_role_permissions_and_formula_validation(self):
        self.authenticate(self.gerant)
        denied = self.client.post('/api/matieres-premieres', {
            'nom': 'Interdit', 'prix_kg': '100',
        }, format='json')
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(self.client.get('/api/rapports/ventes').status_code, 403)

        self.authenticate(self.superviseur)
        mp = MP.objects.create(nom='Mil', prix_achat_moyen=Decimal('150'), prix_vente=Decimal('180'))
        invalid = self.client.post('/api/formules', {
            'nom': 'Formule invalide', 'code': 'INVALIDE',
            'compositions': [{'mp_id': mp.id, 'pourcentage': '99.9'}],
        }, format='json')
        self.assertEqual(invalid.status_code, 400)

    def test_production_consumes_supplier_lots_and_snapshots_cost(self):
        formule, mp1, mp2, lot_pf = self.create_production_fixture()
        mp1.refresh_from_db()
        mp2.refresh_from_db()
        self.assertEqual(mp1.stock_disponible, Decimal('40'))
        self.assertEqual(mp2.stock_disponible, Decimal('60'))
        self.assertEqual(LotConsommation.objects.count(), 2)
        self.assertEqual(lot_pf.cout_revient, Decimal('151.20'))
        self.assertEqual(
            sum(LotFournisseur.objects.values_list('quantite', flat=True), Decimal('0')),
            Decimal('100'),
        )
        compositions = list(formule.compositions.order_by('mp_id'))
        compositions[0].pourcentage = Decimal('50')
        compositions[1].pourcentage = Decimal('50')
        for composition in compositions:
            composition.save(update_fields=['pourcentage'])
        self.authenticate(self.superviseur)
        rapport = self.client.get('/api/rapports/ventes')
        consommations = {row['nom']: row['quantite'] for row in rapport.data['mp_consommation']}
        self.assertEqual(consommations['Maïs'], Decimal('60'))
        self.assertEqual(consommations['Soja'], Decimal('40'))

    def test_sale_payment_and_historical_margin(self):
        formule, _, _, lot_pf = self.create_production_fixture()
        customer = Client.objects.create(nom_client='Éleveur Test', cree_par=self.gerant)
        response = self.client.post('/api/commandes', {
            'client_id': customer.id,
            'type_produit': 'pf',
            'lot_pf_id': lot_pf.id,
            'quantite': '10',
            'prix_unitaire': '1000',
            'mode_paiement': 'credit',
            'montant_paye_initial': '5000',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['statut_paiement'], 'partiel')
        self.assertEqual(Paiement.objects.count(), 1)

        commande = Commande.objects.get(pk=response.data['id'])
        formule.prix_unitaire = Decimal('999')
        formule.save(update_fields=['prix_unitaire'])
        self.assertEqual(commande.calculer_marge(), Decimal('8488.00000'))

        paid = self.client.patch(
            f'/api/commandes/{commande.id}/paiement', {'montant': '5000'}, format='json'
        )
        self.assertEqual(paid.status_code, 200, paid.data)
        self.assertEqual(paid.data['statut_paiement'], 'paye')
        self.assertEqual(paid.data['reste_a_payer'], Decimal('0'))
        overpayment = self.client.patch(
            f'/api/commandes/{commande.id}/paiement', {'montant': '1'}, format='json'
        )
        self.assertEqual(overpayment.status_code, 400)
        negative = self.client.patch(
            f'/api/commandes/{commande.id}/paiement', {'montant': '-1'}, format='json'
        )
        self.assertEqual(negative.status_code, 400)

    def test_stock_adjustments_currency_and_report_exports(self):
        mp = MP.objects.create(nom='Son', prix_achat_moyen=Decimal('80'), prix_vente=Decimal('96'), stock_disponible=Decimal('10'))
        self.authenticate(self.gerant)
        self.assertEqual(self.client.post('/api/stocks/ajustement', {
            'type_stock': 'mp', 'mp': mp.id, 'type_ajustement': 'retrait',
            'quantite': '20', 'justification': 'Erreur inventaire',
        }, format='json').status_code, 403)

        self.authenticate(self.superviseur)
        invalid_currency = self.client.post('/api/parametres/bulk_update', {
            'params': {'devise': 'DA'},
        }, format='json')
        self.assertEqual(invalid_currency.status_code, 400)
        valid_currency = self.client.post('/api/parametres/bulk_update', {
            'params': {'devise': 'XOF'},
        }, format='json')
        self.assertEqual(valid_currency.status_code, 200)
        self.assertEqual(Parametre.objects.get(cle='devise').valeur, 'XOF')
        self.assertEqual(self.client.post('/api/parametres', {
            'cle': 'inconnue', 'valeur': 'dangereuse',
        }, format='json').status_code, 405)

        csv_response = self.client.get('/api/rapports/export?type=csv')
        pdf_response = self.client.get('/api/rapports/export?type=pdf')
        self.assertEqual(csv_response.status_code, 200)
        self.assertEqual(csv_response['Content-Type'], 'text/csv; charset=utf-8')
        self.assertEqual(pdf_response.status_code, 200)
        self.assertEqual(pdf_response['Content-Type'], 'application/pdf')

    def test_mp_adjustment_keeps_supplier_lot_traceability(self):
        mp = MP.objects.create(nom='Arachide', prix_achat_moyen=Decimal('300'), prix_vente=Decimal('360'))
        self.authenticate(self.superviseur)
        added = self.client.post('/api/stocks/ajustement', {
            'type_stock': 'mp', 'mp': mp.id, 'type_ajustement': 'ajout',
            'quantite': '10', 'justification': 'Comptage physique supérieur',
        }, format='json')
        self.assertEqual(added.status_code, 201, added.data)
        mp.refresh_from_db()
        lot = LotFournisseur.objects.get(mp=mp)
        self.assertTrue(lot.numero_lot.startswith('AJUST-'))
        self.assertEqual(mp.stock_disponible, lot.quantite)

        removed = self.client.post('/api/stocks/ajustement', {
            'type_stock': 'mp', 'mp': mp.id, 'type_ajustement': 'retrait',
            'quantite': '4', 'justification': 'Comptage physique inférieur',
        }, format='json')
        self.assertEqual(removed.status_code, 201, removed.data)
        mp.refresh_from_db()
        lot.refresh_from_db()
        self.assertEqual(mp.stock_disponible, Decimal('6'))
        self.assertEqual(lot.quantite, Decimal('6'))

    def test_mp_sale_uses_automatic_margin_fefo_and_can_be_cancelled(self):
        self.authenticate(self.superviseur)
        mp = MP.objects.create(nom='Sorgho', prix_achat_moyen=Decimal('100'), prix_vente=Decimal('120'))
        today = timezone.localdate()
        received = self.client.post('/api/lots-fournisseurs', {
            'matiere_premiere_id': mp.id,
            'numero_lot': 'LF-SORGHO',
            'fournisseur': 'Coopérative test',
            'quantite_initiale': '50',
            'cout_kg': '100',
            'date_reception': str(today),
            'date_peremption': str(today + timedelta(days=60)),
        }, format='json')
        self.assertEqual(received.status_code, 201, received.data)
        mp.refresh_from_db()
        self.assertEqual(mp.prix_vente, Decimal('120.00'))

        customer = Client.objects.create(nom_client='Client MP')
        self.authenticate(self.gerant)
        sale = self.client.post('/api/commandes', {
            'client_id': customer.id,
            'type_produit': 'mp',
            'matiere_premiere_id': mp.id,
            'quantite': '10',
            'mode_paiement': 'credit',
        }, format='json')
        self.assertEqual(sale.status_code, 201, sale.data)
        self.assertEqual(sale.data['prix_unitaire'], Decimal('120.00'))
        self.assertEqual(sale.data['produit_nom'], 'Sorgho')
        self.assertEqual(CommandeLotMP.objects.count(), 1)
        mp.refresh_from_db()
        self.assertEqual(mp.stock_disponible, Decimal('40'))

        self.authenticate(self.superviseur)
        cancelled = self.client.post(f"/api/commandes/{sale.data['id']}/annuler", format='json')
        self.assertEqual(cancelled.status_code, 200, cancelled.data)
        mp.refresh_from_db()
        self.assertEqual(mp.stock_disponible, Decimal('50'))
        self.assertEqual(LotFournisseur.objects.get(numero_lot='LF-SORGHO').quantite, Decimal('50'))

    def test_accessory_crud_sale_and_stock_restoration(self):
        self.authenticate(self.gerant)
        denied = self.client.post('/api/accessoires', {
            'nom': 'Interdit', 'prix_vente': '1000', 'stock_disponible': '2',
        }, format='json')
        self.assertEqual(denied.status_code, 403)

        self.authenticate(self.superviseur)
        created = self.client.post('/api/accessoires', {
            'nom': 'Abreuvoir 10 L', 'description': 'Test', 'unite': 'pièce',
            'prix_achat': '4000', 'prix_vente': '5500',
            'stock_disponible': '5', 'seuil_alerte': '1',
        }, format='multipart')
        self.assertEqual(created.status_code, 201, created.data)
        accessory = Accessoire.objects.get(pk=created.data['id'])
        customer = Client.objects.create(nom_client='Client Accessoire')

        self.authenticate(self.gerant)
        sale = self.client.post('/api/commandes', {
            'client_id': customer.id,
            'type_produit': 'accessoire',
            'accessoire_id': accessory.id,
            'quantite': '2',
            'mode_paiement': 'credit',
        }, format='json')
        self.assertEqual(sale.status_code, 201, sale.data)
        self.assertEqual(sale.data['produit_nom'], 'Abreuvoir 10 L')
        accessory.refresh_from_db()
        self.assertEqual(accessory.stock_disponible, Decimal('3'))

        self.authenticate(self.superviseur)
        self.assertEqual(
            self.client.post(f"/api/commandes/{sale.data['id']}/annuler", format='json').status_code,
            200,
        )
        accessory.refresh_from_db()
        self.assertEqual(accessory.stock_disponible, Decimal('5'))
