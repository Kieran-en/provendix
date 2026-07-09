from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.hashers import check_password
from django.db import transaction
from django.utils import timezone
from auditlog.models import LogEntry
import uuid

from .models import (
    Utilisateur, Client, Animal, StadeVie, MP, Formule, CompositionFormule,
    LotFournisseur, LotPF, Production, Commande, Vente, Historique,
    AjustementStock, MouvementStock, Parametre,
)
from .serializers import (
    UtilisateurSerializer, UtilisateurCreateSerializer, LoginSerializer,
    ClientSerializer, AnimalSerializer, StadeVieSerializer,
    MPSerializer, FormuleSerializer, FormuleCreateSerializer,
    CompositionFormuleSerializer, LotFournisseurSerializer, LotPFSerializer,
    ProductionSerializer, CommandeSerializer, CommandeCreateSerializer,
    PaiementSerializer, VenteSerializer, HistoriqueSerializer,
    AjustementStockSerializer, MouvementStockSerializer,
    LogEntrySerializer, ParametreSerializer,
)
from .permissions import IsAdmin, IsSuperviseurOrAdmin, IsAuthenticated, IsOwnerOrReadOnly


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────
# Note : la journalisation des actions est désormais automatique via
# django-auditlog (voir config/settings.py et user/audit.py). Il n'y a plus
# d'appels _log() manuels ni de capture d'adresse IP.

def _mouvement_mp(mp, delta, type_mouvement, cree_par=None, reference_id=None, reference_type=None):
    avant = mp.stock_disponible
    MouvementStock.objects.create(
        mp=mp,
        type_mouvement=type_mouvement,
        quantite_avant=avant,
        quantite_delta=delta,
        quantite_apres=avant + delta,
        reference_id=reference_id,
        reference_type=reference_type,
        cree_par=cree_par,
    )


def _mouvement_pf(lot_pf, delta, type_mouvement, cree_par=None, reference_id=None, reference_type=None):
    avant = lot_pf.quantite
    MouvementStock.objects.create(
        lot_pf=lot_pf,
        type_mouvement=type_mouvement,
        quantite_avant=avant,
        quantite_delta=delta,
        quantite_apres=avant + delta,
        reference_id=reference_id,
        reference_type=reference_type,
        cree_par=cree_par,
    )


# ─────────────────────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────────────────────

class LoginView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            login = serializer.validated_data['login']
            mot_de_passe = serializer.validated_data['mot_de_passe']
            try:
                utilisateur = Utilisateur.objects.get(nom=login, is_active=True)
                if check_password(mot_de_passe, utilisateur.password):
                    from .models import UserToken
                    token, _ = UserToken.get_or_create(utilisateur)
                    return Response({
                        'user': {
                            'id': utilisateur.id,
                            'nom': utilisateur.nom,
                            'login': utilisateur.nom,
                            'role': utilisateur.role,
                        },
                        'access_token': token.key,
                        'refresh_token': token.key,
                    }, status=status.HTTP_200_OK)
                return Response({'error': 'Identifiants incorrects'}, status=status.HTTP_401_UNAUTHORIZED)
            except Utilisateur.DoesNotExist:
                return Response({'error': 'Utilisateur introuvable'}, status=status.HTTP_404_NOT_FOUND)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .models import UserToken
        try:
            token = UserToken.objects.get(utilisateur=request.user)
            token.delete()
        except UserToken.DoesNotExist:
            pass
        return Response({'message': 'Déconnecté avec succès'}, status=status.HTTP_200_OK)


class RefreshTokenView(APIView):
    permission_classes = []

    def post(self, request):
        refresh_token = request.data.get('refresh_token')
        if not refresh_token:
            return Response({'error': 'refresh_token requis'}, status=status.HTTP_400_BAD_REQUEST)
        from .models import UserToken
        try:
            token = UserToken.objects.get(key=refresh_token)
            return Response({'access_token': token.key}, status=status.HTTP_200_OK)
        except UserToken.DoesNotExist:
            return Response({'error': 'Token invalide'}, status=status.HTTP_401_UNAUTHORIZED)


# ─────────────────────────────────────────────────────────────
# DASHBOARD & RAPPORTS
# ─────────────────────────────────────────────────────────────

class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        commandes_jour = Commande.objects.filter(date_commande=today)
        ventes_jour = commandes_jour.count()
        ca_jour = sum(c.montant_total for c in commandes_jour)
        productions_jour = Production.objects.filter(date_production=today).count()
        clients_total = Client.objects.count()
        alertes_stock = MP.objects.filter(
            stock_disponible__lt=models_seuil_query()
        ).count()

        # Évolution stock MP (7 derniers jours via MouvementStock)
        from datetime import timedelta
        stock_evolution = []
        for i in range(6, -1, -1):
            jour = today - timedelta(days=i)
            mvts = MouvementStock.objects.filter(
                created_at__date=jour, mp__isnull=False
            )
            entrees = sum(m.quantite_delta for m in mvts if m.quantite_delta > 0)
            sorties = sum(abs(m.quantite_delta) for m in mvts if m.quantite_delta < 0)
            stock_evolution.append({
                'date': str(jour),
                'entrees': round(entrees, 2),
                'sorties': round(sorties, 2),
            })

        return Response({
            'ventes_jour': ventes_jour,
            'ca_jour': ca_jour,
            'productions_jour': productions_jour,
            'clients_total': clients_total,
            'alertes_stock': alertes_stock,
            'stock_evolution': stock_evolution,
        })


def models_seuil_query():
    """Retourne une expression pour comparer stock_disponible au seuil de la MP elle-même."""
    from django.db.models import F
    return F('seuil_alerte')


class RapportVentesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from collections import defaultdict

        date_from = request.query_params.get('from')
        date_to = request.query_params.get('to')

        commandes = Commande.objects.all()
        if date_from:
            commandes = commandes.filter(date_commande__gte=date_from)
        if date_to:
            commandes = commandes.filter(date_commande__lte=date_to)

        total_ventes = commandes.count()
        ca_total = sum(c.montant_total for c in commandes)
        marge_totale = sum(c.calculer_marge() for c in commandes)

        productions = Production.objects.all()
        if date_from:
            productions = productions.filter(date_production__gte=date_from)
        if date_to:
            productions = productions.filter(date_production__lte=date_to)
        productions_total = productions.count()

        par_jour = defaultdict(lambda: {'montant': 0, 'nb_ventes': 0})
        for c in commandes:
            jour = str(c.date_commande)
            par_jour[jour]['montant'] += c.montant_total
            par_jour[jour]['nb_ventes'] += 1
        ventes_par_jour = [{'date': j, **v} for j, v in sorted(par_jour.items())]

        top_map = defaultdict(lambda: {'montant': 0, 'nb_commandes': 0})
        for c in commandes:
            nom = c.client.nom_client if c.client else 'Inconnu'
            top_map[nom]['montant'] += c.montant_total
            top_map[nom]['nb_commandes'] += 1
        top_clients = sorted(
            [{'nom': nom, **v} for nom, v in top_map.items()],
            key=lambda x: x['montant'], reverse=True
        )[:10]

        # Consommation MP : la composition est exprimée par tonne (kg / 1000 kg),
        # donc conso = (quantite_par_tonne / 1000) × quantite_produite_kg.
        mp_map = defaultdict(float)
        for prod in productions:
            for comp in prod.formule.compositions.all():
                mp_map[comp.mp.nom] += (comp.quantite / 1000.0) * prod.quantite
        mp_consommation = sorted(
            [{'nom': nom, 'quantite': round(qty, 2)} for nom, qty in mp_map.items()],
            key=lambda x: x['quantite'], reverse=True
        )

        return Response({
            'total_ventes': total_ventes,
            'ca_total': ca_total,
            'marge_totale': marge_totale,
            'productions_total': productions_total,
            'ventes_par_jour': ventes_par_jour,
            'top_clients': top_clients,
            'mp_consommation': mp_consommation,
        })


# ─────────────────────────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────────────────────────

class NotificationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from datetime import timedelta
        today = timezone.now().date()
        notifications = []

        # 1. Stocks MP en dessous du seuil d'alerte
        from django.db.models import F
        mps_bas = MP.objects.filter(stock_disponible__lt=F('seuil_alerte'))
        for mp in mps_bas:
            notifications.append({
                'id': f'stock-mp-{mp.id}',
                'type': 'warning',
                'module': 'stock',
                'titre': f'Stock bas — {mp.nom}',
                'message': f'{mp.stock_disponible:.1f} {mp.unite} restants (seuil : {mp.seuil_alerte} {mp.unite})',
                'lien': f'/inventaire',
            })

        # 2. Lots PF proches de la péremption (≤ 7 jours)
        lots_pf_urgents = LotPF.objects.filter(
            statut='disponible',
            date_peremption__lte=today + timedelta(days=7),
            date_peremption__gte=today,
        )
        for lot in lots_pf_urgents:
            jours = (lot.date_peremption - today).days
            notifications.append({
                'id': f'peremption-pf-{lot.id}',
                'type': 'danger',
                'module': 'production',
                'titre': f'Péremption imminente — {lot.numero_lot}',
                'message': f'Lot {lot.numero_lot} ({lot.formule.nom}) expire dans {jours} jour(s)',
                'lien': f'/production',
            })

        # 3. Lots fournisseurs proches péremption (≤ 7 jours)
        lots_f_urgents = LotFournisseur.objects.filter(
            statut='disponible',
            date_peremption__lte=today + timedelta(days=7),
            date_peremption__gte=today,
        )
        for lot in lots_f_urgents:
            jours = (lot.date_peremption - today).days
            notifications.append({
                'id': f'peremption-lot-{lot.id}',
                'type': 'warning',
                'module': 'lots-fournisseurs',
                'titre': f'Péremption lot fournisseur — {lot.numero_lot}',
                'message': f'{lot.mp.nom} : lot {lot.numero_lot} expire dans {jours} jour(s)',
                'lien': f'/lots-fournisseurs',
            })

        # 4. Commandes en crédit depuis plus de 30 jours
        seuil_credit = today - timedelta(days=30)
        commandes_en_retard = Commande.objects.filter(
            statut_paiement__in=['credit', 'partiel'],
            montant_paye__lt=models_seuil_query_montant(),
            date_commande__lte=seuil_credit,
        )
        for cmd in commandes_en_retard:
            notifications.append({
                'id': f'paiement-{cmd.id}',
                'type': 'info',
                'module': 'ventes',
                'titre': f'Paiement en attente — {cmd.client.nom_client}',
                'message': f'Commande {cmd.numero_commande} : {cmd.montant_total - cmd.montant_paye:.0f} DA restants',
                'lien': f'/ventes/{cmd.id}',
            })

        return Response({
            'count': len(notifications),
            'notifications': notifications,
        })


def models_seuil_query_montant():
    from django.db.models import F
    return F('montant_total')


# ─────────────────────────────────────────────────────────────
# UTILISATEURS
# ─────────────────────────────────────────────────────────────

class UtilisateurViewSet(viewsets.ModelViewSet):
    queryset = Utilisateur.objects.all()
    permission_classes = [IsSuperviseurOrAdmin]

    def get_serializer_class(self):
        if self.action == 'create':
            return UtilisateurCreateSerializer
        return UtilisateurSerializer

    @action(detail=True, methods=['patch'])
    def reset_password(self, request, pk=None):
        utilisateur = self.get_object()
        new_password = request.data.get('password')
        if not new_password:
            return Response({'error': 'Le mot de passe est requis'}, status=status.HTTP_400_BAD_REQUEST)
        from django.contrib.auth.hashers import make_password
        utilisateur.password = make_password(new_password)
        utilisateur.save()
        return Response({'message': 'Mot de passe réinitialisé'}, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────
# CLIENTS
# ─────────────────────────────────────────────────────────────

class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(cree_par=self.request.user)


# ─────────────────────────────────────────────────────────────
# RÉFÉRENTIELS
# ─────────────────────────────────────────────────────────────

class AnimalViewSet(viewsets.ModelViewSet):
    queryset = Animal.objects.all()
    serializer_class = AnimalSerializer
    permission_classes = [IsAuthenticated]


class StadeVieViewSet(viewsets.ModelViewSet):
    queryset = StadeVie.objects.all()
    serializer_class = StadeVieSerializer
    permission_classes = [IsAuthenticated]


# ─────────────────────────────────────────────────────────────
# MATIÈRES PREMIÈRES
# ─────────────────────────────────────────────────────────────

class MPViewSet(viewsets.ModelViewSet):
    queryset = MP.objects.all()
    serializer_class = MPSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(cree_par=self.request.user)


# ─────────────────────────────────────────────────────────────
# LOTS FOURNISSEURS
# ─────────────────────────────────────────────────────────────

class LotFournisseurViewSet(viewsets.ModelViewSet):
    queryset = LotFournisseur.objects.all()
    serializer_class = LotFournisseurSerializer
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        mp_id = data.get('mp') or data.get('matiere_premiere_id')
        quantite = float(data.get('quantite') or data.get('quantite_initiale', 0))
        prix_achat = float(data.get('prix_achat') or data.get('cout_kg', 0))
        numero_lot = data.get('numero_lot') or f"LOT-{uuid.uuid4().hex[:8].upper()}"
        fournisseur = data.get('fournisseur') or 'Non spécifié'
        date_reception = data.get('date_reception') or str(timezone.now().date())
        date_peremption = data.get('date_peremption') or None

        try:
            mp = MP.objects.get(id=mp_id)
        except MP.DoesNotExist:
            return Response({'error': 'Matière première introuvable'}, status=status.HTTP_404_NOT_FOUND)

        lot = LotFournisseur.objects.create(
            mp=mp,
            numero_lot=numero_lot,
            fournisseur=fournisseur,
            quantite_initiale=quantite,
            quantite=quantite,
            prix_achat=prix_achat,
            date_reception=date_reception,
            date_peremption=date_peremption,
            cree_par=request.user,
        )

        # Mise à jour stock + mouvement traçable
        _mouvement_mp(mp, quantite, 'entree_lot',
                      cree_par=request.user,
                      reference_id=lot.id, reference_type='LotFournisseur')
        mp.stock_disponible += quantite
        mp.save()

        return Response(LotFournisseurSerializer(lot).data, status=status.HTTP_201_CREATED)


# ─────────────────────────────────────────────────────────────
# FORMULES
# ─────────────────────────────────────────────────────────────

class FormuleViewSet(viewsets.ModelViewSet):
    queryset = Formule.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return FormuleCreateSerializer
        return FormuleSerializer

    def perform_create(self, serializer):
        serializer.save(cree_par=self.request.user)


# ─────────────────────────────────────────────────────────────
# LOTS PF
# ─────────────────────────────────────────────────────────────

class LotPFViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LotPF.objects.all()
    serializer_class = LotPFSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        disponible = self.request.query_params.get('disponible')
        if disponible == 'true':
            queryset = queryset.filter(statut='disponible')
        return queryset


# ─────────────────────────────────────────────────────────────
# PRODUCTION
# ─────────────────────────────────────────────────────────────

class ProductionViewSet(viewsets.ModelViewSet):
    queryset = Production.objects.all()
    serializer_class = ProductionSerializer
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        formule_id = request.data.get('formule')
        quantite = float(request.data.get('quantite', 0))

        try:
            formule = Formule.objects.get(id=formule_id)
        except Formule.DoesNotExist:
            return Response({'error': 'Formule introuvable'}, status=status.HTTP_404_NOT_FOUND)

        compositions = list(formule.compositions.select_related('mp').all())

        # La composition est exprimée par tonne (kg pour 1000 kg produits) :
        # consommation = (quantite_par_tonne / 1000) × quantite_produite_kg.
        def _consommation(comp):
            return (comp.quantite / 1000.0) * quantite

        # Vérification stocks suffisants
        for comp in compositions:
            required_qty = _consommation(comp)
            if comp.mp.stock_disponible < required_qty:
                return Response({
                    'error': (
                        f'Stock insuffisant pour {comp.mp.nom}. '
                        f'Requis : {required_qty:.2f} {comp.mp.unite}, '
                        f'Disponible : {comp.mp.stock_disponible:.2f} {comp.mp.unite}'
                    )
                }, status=status.HTTP_400_BAD_REQUEST)

        # Création du lot PF
        lot_pf = LotPF.objects.create(
            formule=formule,
            numero_lot=f"PF-{uuid.uuid4().hex[:8].upper()}",
            quantite_initiale=quantite,
            quantite=quantite,
            date_production=timezone.now().date(),
            date_peremption=timezone.now().date() + timezone.timedelta(days=180),
            statut='disponible',
        )

        # Décrément stocks MP + mouvements traçables
        for comp in compositions:
            consommation = _consommation(comp)
            _mouvement_mp(comp.mp, -consommation, 'consommation',
                          cree_par=request.user,
                          reference_id=lot_pf.id, reference_type='LotPF')
            comp.mp.stock_disponible -= consommation
            comp.mp.save()

        # Création Production
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        production = serializer.save(
            lot_pf=lot_pf,
            cree_par=request.user,
            statut='terminee',
            date_production=timezone.now().date(),
            date_prevue=timezone.now().date(),
        )

        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ─────────────────────────────────────────────────────────────
# COMMANDES / VENTES
# ─────────────────────────────────────────────────────────────

class CommandeViewSet(viewsets.ModelViewSet):
    queryset = Commande.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return CommandeCreateSerializer
        return CommandeSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lot_pf = serializer.validated_data.get('lot_pf')
        quantite = float(serializer.validated_data.get('quantite', 0))
        prix_unitaire = float(serializer.validated_data.get('prix_unitaire', 0))
        statut_paiement = serializer.validated_data.get('statut_paiement', 'credit')

        if lot_pf and lot_pf.quantite < quantite:
            return Response({
                'error': f'Stock insuffisant. Requis : {quantite}, Disponible : {lot_pf.quantite}'
            }, status=status.HTTP_400_BAD_REQUEST)

        montant_total = quantite * prix_unitaire
        montant_paye = montant_total if statut_paiement == 'cash' else 0.0

        commande = serializer.save(
            cree_par=request.user,
            numero_commande=f"CMD-{uuid.uuid4().hex[:8].upper()}",
            montant_total=montant_total,
            montant_paye=montant_paye,
        )

        # Décrémentation LotPF + mouvement traçable
        if lot_pf:
            _mouvement_pf(lot_pf, -quantite, 'vente',
                          cree_par=request.user,
                          reference_id=commande.id, reference_type='Commande')
            lot_pf.quantite -= quantite
            if lot_pf.quantite <= 0:
                lot_pf.statut = 'epuise'
            lot_pf.save()

        return Response(CommandeSerializer(commande).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def facture(self, request, pk=None):
        commande = self.get_object()
        return Response({
            'numero_commande': commande.numero_commande,
            'client': commande.client.nom_client,
            'contact': commande.client.contact,
            'quantite': commande.quantite,
            'prix_unitaire': commande.prix_unitaire,
            'montant_total': commande.montant_total,
            'montant': commande.montant_total,
            'montant_paye': commande.montant_paye,
            'reste_a_payer': commande.montant_total - commande.montant_paye,
            'date_commande': commande.date_commande,
            'statut_paiement': commande.statut_paiement,
            'marge': commande.calculer_marge(),
        })

    @action(detail=True, methods=['patch'])
    def paiement(self, request, pk=None):
        commande = self.get_object()
        serializer = PaiementSerializer(data=request.data)
        if serializer.is_valid():
            montant = serializer.validated_data['montant']
            commande.montant_paye = min(commande.montant_paye + montant, commande.montant_total)
            if commande.montant_paye >= commande.montant_total:
                commande.statut_paiement = 'cash'
            commande.save()
            return Response({'message': 'Paiement enregistré', 'montant_paye': commande.montant_paye})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VenteViewSet(viewsets.ModelViewSet):
    queryset = Vente.objects.all()
    serializer_class = VenteSerializer
    permission_classes = [IsAuthenticated]


class HistoriqueViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Historique.objects.all()
    serializer_class = HistoriqueSerializer
    permission_classes = [IsAuthenticated]


# ─────────────────────────────────────────────────────────────
# STOCKS
# ─────────────────────────────────────────────────────────────

class StockViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        mp_stocks = MP.objects.all()
        pf_stocks = LotPF.objects.filter(statut='disponible').select_related('formule')

        mp_data = []
        for mp in mp_stocks:
            lots = list(mp.lots_fournisseurs.all().values(
                'id', 'numero_lot', 'fournisseur',
                'quantite_initiale', 'quantite', 'prix_achat',
                'date_reception', 'date_peremption', 'statut'
            ))
            en_alerte = mp.stock_disponible < mp.seuil_alerte
            mp_data.append({
                'matiere_premiere': {
                    'id': mp.id,
                    'nom': mp.nom,
                    'quantite': mp.stock_disponible,
                    'prix_kg': mp.prix_vente,
                    'unite': mp.unite,
                    'seuil_alerte': mp.seuil_alerte,
                    'en_alerte': en_alerte,
                },
                'quantite_totale': mp.stock_disponible,
                'en_alerte': en_alerte,
                'lots': lots,
            })

        pf_data = []
        for pf in pf_stocks:
            pf_data.append({
                'lot_pf': {
                    'id': pf.id,
                    'numero_lot': pf.numero_lot,
                    'quantite_initiale': pf.quantite_initiale,
                    'quantite_restante': pf.quantite,
                    'cout_revient': pf.formule.prix_unitaire,
                    'date_peremption': str(pf.date_peremption),
                    'statut': pf.statut,
                    'formule': {'id': pf.formule.id, 'nom': pf.formule.nom},
                },
                'quantite_restante': pf.quantite,
            })

        return Response({
            'matieres_premieres': mp_data,
            'produits_finis': pf_data,
        })

    @action(detail=False, methods=['post'])
    def ajustement(self, request):
        serializer = AjustementStockSerializer(data=request.data)
        if serializer.is_valid():
            ajustement = serializer.save(cree_par=request.user)
            type_stock = ajustement.type_stock
            type_ajustement = ajustement.type_ajustement
            quantite = ajustement.quantite
            delta = quantite if type_ajustement == 'ajout' else -quantite

            if type_stock == 'mp' and ajustement.mp:
                mp = ajustement.mp
                _mouvement_mp(mp, delta, 'ajustement',
                              cree_par=request.user,
                              reference_id=ajustement.id, reference_type='AjustementStock')
                if type_ajustement == 'ajout':
                    mp.stock_disponible += quantite
                else:
                    mp.stock_disponible = max(0, mp.stock_disponible - quantite)
                mp.save()

            elif type_stock == 'pf' and ajustement.lot_pf:
                lot_pf = ajustement.lot_pf
                _mouvement_pf(lot_pf, delta, 'ajustement',
                              cree_par=request.user,
                              reference_id=ajustement.id, reference_type='AjustementStock')
                if type_ajustement == 'ajout':
                    lot_pf.quantite += quantite
                else:
                    lot_pf.quantite = max(0, lot_pf.quantite - quantite)
                    if lot_pf.quantite <= 0:
                        lot_pf.statut = 'epuise'
                lot_pf.save()

            return Response({'message': 'Stock ajusté avec succès'}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────────────────────────
# MOUVEMENTS DE STOCK
# ─────────────────────────────────────────────────────────────

class MouvementStockViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MouvementStock.objects.all()
    serializer_class = MouvementStockSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        mp_id = self.request.query_params.get('mp')
        lot_pf_id = self.request.query_params.get('lot_pf')
        type_mvt = self.request.query_params.get('type')
        if mp_id:
            queryset = queryset.filter(mp_id=mp_id)
        if lot_pf_id:
            queryset = queryset.filter(lot_pf_id=lot_pf_id)
        if type_mvt:
            queryset = queryset.filter(type_mouvement=type_mvt)
        return queryset


# ─────────────────────────────────────────────────────────────
# JOURNAL D'AUDIT (django-auditlog)
# ─────────────────────────────────────────────────────────────

class LogEntryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Journal d'activité alimenté automatiquement par django-auditlog.
    Réservé aux superviseurs/administrateurs.
    """
    serializer_class = LogEntrySerializer
    permission_classes = [IsSuperviseurOrAdmin]

    _ACTION_FILTER = {'create': 0, 'update': 1, 'delete': 2, 'access': 3}
    _MODULE_MODELS = {
        'utilisateurs': ['utilisateur'],
        'clients': ['client'],
        'matieres premieres': ['mp'],
        'mp': ['mp'],
        'formules': ['formule', 'compositionformule'],
        'lots fournisseurs': ['lotfournisseur'],
        'lots produits finis': ['lotpf'],
        'production': ['production'],
        'ventes': ['commande'],
        'inventaire': ['ajustementstock'],
        'parametres': ['parametre'],
    }

    def get_queryset(self):
        qs = LogEntry.objects.select_related('content_type').all().order_by('-timestamp')
        action = self.request.query_params.get('action')
        module = self.request.query_params.get('module')
        date_from = self.request.query_params.get('from')
        date_to = self.request.query_params.get('to')

        if action in self._ACTION_FILTER:
            qs = qs.filter(action=self._ACTION_FILTER[action])
        if module:
            key = module.strip().lower()
            models_list = self._MODULE_MODELS.get(key)
            if models_list:
                qs = qs.filter(content_type__model__in=models_list)
            else:
                qs = qs.filter(content_type__model__icontains=key)
        if date_from:
            qs = qs.filter(timestamp__date__gte=date_from)
        if date_to:
            qs = qs.filter(timestamp__date__lte=date_to)
        return qs


# ─────────────────────────────────────────────────────────────
# PARAMÈTRES
# ─────────────────────────────────────────────────────────────

class ParametreViewSet(viewsets.ModelViewSet):
    queryset = Parametre.objects.all()
    serializer_class = ParametreSerializer
    permission_classes = [IsSuperviseurOrAdmin]

    @action(detail=False, methods=['get'])
    def by_key(self, request):
        cle = request.query_params.get('cle')
        if not cle:
            return Response({'error': 'Paramètre cle requis'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            param = Parametre.objects.get(cle=cle)
            return Response(ParametreSerializer(param).data)
        except Parametre.DoesNotExist:
            default = Parametre.DEFAULTS.get(cle)
            if default is not None:
                return Response({'cle': cle, 'valeur': default})
            return Response({'error': 'Paramètre introuvable'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        """Met à jour plusieurs paramètres en une seule requête."""
        params = request.data.get('params', {})
        updated = []
        for cle, valeur in params.items():
            obj, _ = Parametre.objects.update_or_create(
                cle=cle, defaults={'valeur': str(valeur)}
            )
            updated.append({'cle': obj.cle, 'valeur': obj.valeur})
        return Response({'updated': updated})
