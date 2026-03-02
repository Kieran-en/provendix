from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.hashers import check_password
from django.db import transaction
from django.utils import timezone
import uuid

from .models import (
    Utilisateur, Client, Animal, StadeVie, MP, Formule, CompositionFormule,
    LotFournisseur, LotPF, Production, Commande, Vente, Historique, AjustementStock
)
from .serializers import (
    UtilisateurSerializer, UtilisateurCreateSerializer, LoginSerializer,
    ClientSerializer, AnimalSerializer, StadeVieSerializer,
    MPSerializer, FormuleSerializer, FormuleCreateSerializer,
    CompositionFormuleSerializer, LotFournisseurSerializer, LotPFSerializer,
    ProductionSerializer, CommandeSerializer, CommandeCreateSerializer,
    PaiementSerializer, VenteSerializer, HistoriqueSerializer, AjustementStockSerializer
)
from .permissions import IsAdmin, IsSuperviseurOrAdmin, IsAuthenticated, IsOwnerOrReadOnly


class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            nom = serializer.validated_data['nom']
            password = serializer.validated_data['password']
            try:
                utilisateur = Utilisateur.objects.get(nom=nom, is_active=True)
                if check_password(password, utilisateur.password):
                    from rest_framework.authtoken.models import Token
                    token, created = Token.objects.get_or_create(user=utilisateur)
                    return Response({
                        'id': utilisateur.id,
                        'nom': utilisateur.nom,
                        'role': utilisateur.role,
                        'token': token.key,
                        'message': 'Login successful'
                    }, status=status.HTTP_200_OK)
                return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
            except Utilisateur.DoesNotExist:
                return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from rest_framework.authtoken.models import Token
        try:
            token = Token.objects.get(user=request.user)
            token.delete()
        except Token.DoesNotExist:
            pass
        return Response({'message': 'Logged out successfully'}, status=status.HTTP_200_OK)


class RefreshTokenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response({'message': 'Token refreshed'}, status=status.HTTP_200_OK)


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
            return Response({'error': 'Password is required'}, status=status.HTTP_400_BAD_REQUEST)
        from django.contrib.auth.hashers import make_password
        utilisateur.password = make_password(new_password)
        utilisateur.save()
        return Response({'message': 'Password reset successfully'}, status=status.HTTP_200_OK)


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(cree_par=self.request.user)


class AnimalViewSet(viewsets.ModelViewSet):
    queryset = Animal.objects.all()
    serializer_class = AnimalSerializer
    permission_classes = [IsAuthenticated]


class StadeVieViewSet(viewsets.ModelViewSet):
    queryset = StadeVie.objects.all()
    serializer_class = StadeVieSerializer
    permission_classes = [IsAuthenticated]


class MPViewSet(viewsets.ModelViewSet):
    queryset = MP.objects.all()
    serializer_class = MPSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(cree_par=self.request.user)


class LotFournisseurViewSet(viewsets.ModelViewSet):
    queryset = LotFournisseur.objects.all()
    serializer_class = LotFournisseurSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        lot = serializer.save(cree_par=self.request.user)
        mp = lot.mp
        mp.stock_disponible += lot.quantite
        mp.save()

    def perform_update(self, serializer):
        old_lot = self.get_object()
        new_quantite = self.request.data.get('quantite')
        if new_quantite and new_quantite != old_lot.quantite:
            mp = old_lot.mp
            mp.stock_disponible -= old_lot.quantite
            mp.stock_disponible += float(new_quantite)
            mp.save()
        serializer.save()


class FormuleViewSet(viewsets.ModelViewSet):
    queryset = Formule.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return FormuleCreateSerializer
        return FormuleSerializer

    def perform_create(self, serializer):
        serializer.save(cree_par=self.request.user)


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


class ProductionViewSet(viewsets.ModelViewSet):
    queryset = Production.objects.all()
    serializer_class = ProductionSerializer
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        formule_id = request.data.get('formule')
        quantite = request.data.get('quantite')

        try:
            formule = Formule.objects.get(id=formule_id)
        except Formule.DoesNotExist:
            return Response({'error': 'Formule not found'}, status=status.HTTP_404_NOT_FOUND)

        compositions = formule.compositions.all()
        for comp in compositions:
            required_qty = comp.quantite * quantite
            if comp.mp.stock_disponible < required_qty:
                return Response({
                    'error': f'Insufficient stock for {comp.mp.nom}. Required: {required_qty}, Available: {comp.mp.stock_disponible}'
                }, status=status.HTTP_400_BAD_REQUEST)

        for comp in compositions:
            comp.mp.stock_disponible -= comp.quantite * quantite
            comp.mp.save()

        lot_pf = LotPF.objects.create(
            formule=formule,
            numero_lot=f"PF-{uuid.uuid4().hex[:8].upper()}",
            quantite=quantite,
            date_production=timezone.now().date(),
            date_peremption=timezone.now().date() + timezone.timedelta(days=180),
            statut='disponible'
        )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(lot_pf=lot_pf, cree_par=request.user, statut='terminee', date_production=timezone.now().date())

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CommandeViewSet(viewsets.ModelViewSet):
    queryset = Commande.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return CommandeCreateSerializer
        return CommandeSerializer

    def perform_create(self, serializer):
        serializer.save(cree_par=self.request.user)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lot_pf = serializer.validated_data.get('lot_pf')
        quantite = serializer.validated_data.get('quantite')

        if lot_pf and lot_pf.quantite < quantite:
            return Response({
                'error': f'Insufficient stock. Required: {quantite}, Available: {lot_pf.quantite}'
            }, status=status.HTTP_400_BAD_REQUEST)

        commande = serializer.save()

        if lot_pf:
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
            'montant_paye': commande.montant_paye,
            'reste_a_payer': commande.montant_total - commande.montant_paye,
            'date_commande': commande.date_commande,
            'statut_paiement': commande.statut_paiement,
            'marge': commande.calculer_marge()
        })

    @action(detail=True, methods=['patch'])
    def paiement(self, request, pk=None):
        commande = self.get_object()
        serializer = PaiementSerializer(data=request.data)
        if serializer.is_valid():
            montant = serializer.validated_data['montant']
            commande.montant_paye += montant
            if commande.montant_paye >= commande.montant_total:
                commande.statut_paiement = 'paye'
            elif commande.montant_paye > 0:
                commande.statut_paiement = 'partiellement_paye'
            commande.save()
            return Response({'message': 'Payment recorded', 'montant_paye': commande.montant_paye})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VenteViewSet(viewsets.ModelViewSet):
    queryset = Vente.objects.all()
    serializer_class = VenteSerializer
    permission_classes = [IsAuthenticated]


class HistoriqueViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Historique.objects.all()
    serializer_class = HistoriqueSerializer
    permission_classes = [IsAuthenticated]


class StockViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        mp_stocks = MP.objects.all()
        pf_stocks = LotPF.objects.filter(statut='disponible')

        mp_data = [{'id': mp.id, 'nom': mp.nom, 'stock': mp.stock_disponible, 'unite': mp.unite} for mp in mp_stocks]
        pf_data = [{
            'id': pf.id, 
            'formule': pf.formule.nom, 
            'numero_lot': pf.numero_lot, 
            'quantite': pf.quantite, 
            'date_peremption': pf.date_peremption
        } for pf in pf_stocks]

        return Response({
            'matieres_premieres': mp_data,
            'produits_finis': pf_data
        })

    @action(detail=False, methods=['post'])
    def ajustement(self, request):
        serializer = AjustementStockSerializer(data=request.data)
        if serializer.is_valid():
            ajustement = serializer.save(cree_par=request.user)
            type_stock = ajustement.type_stock
            type_ajustement = ajustement.type_ajustement
            quantite = ajustement.quantite

            if type_stock == 'mp' and ajustement.mp:
                mp = ajustement.mp
                if type_ajustement == 'ajout':
                    mp.stock_disponible += quantite
                else:
                    mp.stock_disponible = max(0, mp.stock_disponible - quantite)
                mp.save()
            elif type_stock == 'pf' and ajustement.lot_pf:
                lot_pf = ajustement.lot_pf
                if type_ajustement == 'ajout':
                    lot_pf.quantite += quantite
                else:
                    lot_pf.quantite = max(0, lot_pf.quantite - quantite)
                    if lot_pf.quantite <= 0:
                        lot_pf.statut = 'epuise'
                lot_pf.save()

            return Response({'message': 'Stock adjusted successfully'}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)