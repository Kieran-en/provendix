import csv
import io
import uuid
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from auditlog.models import LogEntry
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import F, Q, Sum
from django.db.models.deletion import ProtectedError
from django.http import HttpResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import (
    Accessoire,
    AjustementStock,
    Animal,
    Client,
    Commande,
    CommandeLotMP,
    Formule,
    Historique,
    LotConsommation,
    LotFournisseur,
    LotPF,
    MP,
    MouvementStock,
    Paiement,
    Parametre,
    Production,
    StadeVie,
    UserToken,
    Utilisateur,
    Vente,
)
from .permissions import (
    IsAuthenticated,
    IsSuperviseurOrAdmin,
    IsSuperviseurWriteAuthenticatedRead,
)
from .authentication import enforce_csrf
from .serializers import (
    AccessoireSerializer,
    AjustementStockSerializer,
    AnimalSerializer,
    ClientSerializer,
    CommandeCreateSerializer,
    CommandeSerializer,
    FormuleCreateSerializer,
    FormuleSerializer,
    HistoriqueSerializer,
    LoginSerializer,
    LogEntrySerializer,
    LotFournisseurCreateSerializer,
    LotFournisseurSerializer,
    LotPFSerializer,
    MPSerializer,
    MouvementStockSerializer,
    PaiementSerializer,
    ParametreSerializer,
    ProductionCreateSerializer,
    ProductionSerializer,
    StadeVieSerializer,
    UtilisateurCreateSerializer,
    UtilisateurSerializer,
    VenteSerializer,
)


def _system_config():
    values = dict(Parametre.DEFAULTS)
    values.update(dict(Parametre.objects.values_list('cle', 'valeur')))
    return values


def _currency_code():
    code = _system_config().get('devise', 'XAF').upper()
    return code if code in {'XAF', 'XOF'} else 'XAF'


def _currency_label():
    return 'FCFA' if _currency_code() in {'XAF', 'XOF'} else _currency_code()


def _cookie_options(max_age, path='/'):
    return {
        'max_age': max_age,
        'httponly': True,
        'secure': settings.AUTH_COOKIE_SECURE,
        'samesite': settings.AUTH_COOKIE_SAMESITE,
        'path': path,
        'domain': settings.AUTH_COOKIE_DOMAIN,
    }


def _set_access_cookie(response, raw_token):
    response.set_cookie('access_token', raw_token, **_cookie_options(15 * 60))


def _set_auth_cookies(response, access_token, refresh_token, role):
    _set_access_cookie(response, access_token)
    response.set_cookie(
        'refresh_token', refresh_token,
        **_cookie_options(7 * 24 * 60 * 60, path='/api/auth'),
    )
    response.set_cookie('user_role', role, **_cookie_options(7 * 24 * 60 * 60))


def _clear_auth_cookies(response):
    response.delete_cookie('access_token', path='/', domain=settings.AUTH_COOKIE_DOMAIN)
    response.delete_cookie('refresh_token', path='/api/auth', domain=settings.AUTH_COOKIE_DOMAIN)
    response.delete_cookie('user_role', path='/', domain=settings.AUTH_COOKIE_DOMAIN)


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


def _mouvement_accessoire(accessoire, delta, type_mouvement, cree_par=None, reference_id=None, reference_type=None):
    avant = accessoire.stock_disponible
    MouvementStock.objects.create(
        accessoire=accessoire,
        type_mouvement=type_mouvement,
        quantite_avant=avant,
        quantite_delta=delta,
        quantite_apres=avant + delta,
        reference_id=reference_id,
        reference_type=reference_type,
        cree_par=cree_par,
    )


def _prix_vente_mp(prix_achat):
    try:
        marge = Decimal(_system_config().get('marge_vente_mp', '20'))
    except InvalidOperation:
        marge = Decimal('20')
    return (prix_achat * (Decimal('1') + marge / Decimal('100'))).quantize(Decimal('0.01'))


def _parse_report_dates(request):
    raw_from = request.query_params.get('from')
    raw_to = request.query_params.get('to')
    date_from = parse_date(raw_from) if raw_from else None
    date_to = parse_date(raw_to) if raw_to else None
    if (raw_from and not date_from) or (raw_to and not date_to):
        raise ValueError('Les dates doivent utiliser le format AAAA-MM-JJ.')
    if date_from and date_to and date_from > date_to:
        raise ValueError('La date de début doit précéder la date de fin.')
    return date_from, date_to


def _rapport_data(date_from=None, date_to=None):
    commandes = Commande.objects.exclude(statut='annulee').select_related(
        'client', 'lot_pf', 'lot_pf__formule', 'mp', 'accessoire'
    )
    if date_from:
        commandes = commandes.filter(date_commande__gte=date_from)
    if date_to:
        commandes = commandes.filter(date_commande__lte=date_to)

    productions = Production.objects.filter(statut='terminee').select_related('formule')
    if date_from:
        productions = productions.filter(date_production__gte=date_from)
    if date_to:
        productions = productions.filter(date_production__lte=date_to)

    commandes_list = list(commandes)
    productions_list = list(productions.prefetch_related(
        'formule__compositions__mp',
        'consommations_lots__lot_fournisseur__mp',
    ))
    ca_total = sum((c.montant_total for c in commandes_list), Decimal('0'))
    marge_totale = sum((c.calculer_marge() for c in commandes_list), Decimal('0'))

    par_jour = defaultdict(lambda: {'montant': Decimal('0'), 'nb_ventes': 0})
    top_map = defaultdict(lambda: {'montant': Decimal('0'), 'nb_commandes': 0})
    for commande in commandes_list:
        jour = str(commande.date_commande)
        par_jour[jour]['montant'] += commande.montant_total
        par_jour[jour]['nb_ventes'] += 1
        top_map[commande.client.nom_client]['montant'] += commande.montant_total
        top_map[commande.client.nom_client]['nb_commandes'] += 1

    mp_map = defaultdict(lambda: Decimal('0'))
    for production in productions_list:
        consommations = list(production.consommations_lots.all())
        if consommations:
            for consommation in consommations:
                mp_map[consommation.lot_fournisseur.mp.nom] += consommation.quantite
        else:
            for comp in production.formule.compositions.all():
                mp_map[comp.mp.nom] += (comp.pourcentage / Decimal('100')) * production.quantite

    return {
        'total_ventes': len(commandes_list),
        'ca_total': ca_total,
        'marge_totale': marge_totale,
        'productions_total': len(productions_list),
        'ventes_par_jour': [{'date': j, **v} for j, v in sorted(par_jour.items())],
        'top_clients': sorted(
            [{'nom': nom, **v} for nom, v in top_map.items()],
            key=lambda item: item['montant'], reverse=True,
        )[:10],
        'mp_consommation': sorted(
            [{'nom': nom, 'quantite': qty} for nom, qty in mp_map.items()],
            key=lambda item: item['quantite'], reverse=True,
        ),
    }


class LoginView(APIView):
    permission_classes = []
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        login = serializer.validated_data['login'].strip()
        mot_de_passe = serializer.validated_data['mot_de_passe']
        utilisateur = Utilisateur.objects.filter(login__iexact=login, is_active=True).first()
        if not utilisateur or not check_password(mot_de_passe, utilisateur.password):
            return Response({'error': 'Identifiants incorrects'}, status=status.HTTP_401_UNAUTHORIZED)

        _, access_token, refresh_token = UserToken.issue(utilisateur)
        config = _system_config()
        get_token(request)
        response = Response({
            'user': UtilisateurSerializer(utilisateur).data,
            'settings': {
                'currency_code': _currency_code(),
                'currency_label': _currency_label(),
                'nom_provenderie': config.get('nom_provenderie', 'PROVENDIX'),
            },
        })
        _set_auth_cookies(response, access_token, refresh_token, utilisateur.role)
        return response


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.auth:
            request.auth.delete()
        response = Response({'message': 'Déconnecté avec succès'})
        _clear_auth_cookies(response)
        return response


class RefreshTokenView(APIView):
    permission_classes = []
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'refresh'

    def post(self, request):
        cookie_refresh = request.COOKIES.get('refresh_token')
        if cookie_refresh:
            enforce_csrf(request)
        refresh_token = cookie_refresh or request.data.get('refresh_token')
        if not refresh_token:
            return Response({'error': 'Session expirée'}, status=status.HTTP_401_UNAUTHORIZED)
        token = UserToken.objects.select_related('utilisateur').filter(
            refresh_key=UserToken._hash(refresh_token)
        ).first()
        if (
            not token
            or token.refresh_expires_at <= timezone.now()
            or not token.utilisateur.is_active
        ):
            if token:
                token.delete()
            response = Response({'error': 'Session expirée'}, status=status.HTTP_401_UNAUTHORIZED)
            _clear_auth_cookies(response)
            return response
        access_token = token.rotate_access_token()
        response = Response({'message': 'Session renouvelée'})
        _set_access_cookie(response, access_token)
        return response


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        commandes_jour = Commande.objects.filter(date_commande=today).exclude(statut='annulee')
        ca_jour = commandes_jour.aggregate(total=Sum('montant_total'))['total'] or Decimal('0')
        stock_evolution = []
        for offset in range(6, -1, -1):
            jour = today - timedelta(days=offset)
            mouvements = list(MouvementStock.objects.filter(created_at__date=jour, mp__isnull=False))
            stock_evolution.append({
                'date': str(jour),
                'entrees': sum((m.quantite_delta for m in mouvements if m.quantite_delta > 0), Decimal('0')),
                'sorties': sum((-m.quantite_delta for m in mouvements if m.quantite_delta < 0), Decimal('0')),
            })
        return Response({
            'ventes_jour': commandes_jour.count(),
            'ca_jour': ca_jour,
            'productions_jour': Production.objects.filter(date_production=today, statut='terminee').count(),
            'clients_total': Client.objects.count(),
            'alertes_stock': (
                MP.objects.filter(actif=True, stock_disponible__lt=F('seuil_alerte')).count() +
                Accessoire.objects.filter(actif=True, stock_disponible__lte=F('seuil_alerte')).count()
            ),
            'stock_evolution': stock_evolution,
        })


class RapportVentesView(APIView):
    permission_classes = [IsSuperviseurOrAdmin]

    def get(self, request):
        try:
            date_from, date_to = _parse_report_dates(request)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_rapport_data(date_from, date_to))


class RapportExportView(APIView):
    permission_classes = [IsSuperviseurOrAdmin]

    def get(self, request):
        try:
            date_from, date_to = _parse_report_dates(request)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        export_type = request.query_params.get('type', 'csv').lower()
        data = _rapport_data(date_from, date_to)
        if export_type == 'csv':
            response = HttpResponse(content_type='text/csv; charset=utf-8')
            response['Content-Disposition'] = 'attachment; filename="rapport_ventes.csv"'
            response.write('\ufeff')
            writer = csv.writer(response)
            writer.writerow(['Date', 'Nombre de ventes', f'Montant ({_currency_label()})'])
            for row in data['ventes_par_jour']:
                writer.writerow([row['date'], row['nb_ventes'], row['montant']])
            writer.writerow([])
            writer.writerow(['CA total', data['ca_total']])
            writer.writerow(['Marge totale', data['marge_totale']])
            return response
        if export_type == 'pdf':
            from reportlab.lib.pagesizes import A4
            from reportlab.pdfgen import canvas

            buffer = io.BytesIO()
            pdf = canvas.Canvas(buffer, pagesize=A4)
            config = _system_config()
            pdf.setTitle('Rapport des ventes PROVENDIX')
            pdf.setFont('Helvetica-Bold', 16)
            pdf.drawString(50, 800, config.get('nom_provenderie', 'PROVENDIX'))
            pdf.setFont('Helvetica', 11)
            pdf.drawString(50, 775, f"Rapport des ventes - {date_from or 'début'} au {date_to or 'aujourd’hui'}")
            pdf.drawString(50, 750, f"Ventes : {data['total_ventes']}")
            pdf.drawString(50, 732, f"CA total : {data['ca_total']} {_currency_label()}")
            pdf.drawString(50, 714, f"Marge totale : {data['marge_totale']} {_currency_label()}")
            y = 680
            pdf.setFont('Helvetica-Bold', 10)
            pdf.drawString(50, y, 'Date')
            pdf.drawString(180, y, 'Ventes')
            pdf.drawString(280, y, f'Montant ({_currency_label()})')
            pdf.setFont('Helvetica', 10)
            for row in data['ventes_par_jour']:
                y -= 18
                if y < 60:
                    pdf.showPage()
                    y = 800
                pdf.drawString(50, y, row['date'])
                pdf.drawString(180, y, str(row['nb_ventes']))
                pdf.drawString(280, y, str(row['montant']))
            pdf.save()
            response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
            response['Content-Disposition'] = 'attachment; filename="rapport_ventes.pdf"'
            return response
        return Response({'error': 'Format accepté : csv ou pdf'}, status=status.HTTP_400_BAD_REQUEST)


class NotificationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        notifications = []
        for mp in MP.objects.filter(actif=True, stock_disponible__lt=F('seuil_alerte')):
            notifications.append({
                'id': f'stock-mp-{mp.id}', 'type': 'warning', 'module': 'stock',
                'titre': f'Stock bas — {mp.nom}',
                'message': f'{mp.stock_disponible} {mp.unite} restants (seuil : {mp.seuil_alerte} {mp.unite})',
                'lien': '/stocks',
            })
        for accessoire in Accessoire.objects.filter(
            actif=True, stock_disponible__lte=F('seuil_alerte')
        ):
            notifications.append({
                'id': f'stock-accessoire-{accessoire.id}', 'type': 'warning', 'module': 'stock',
                'titre': f'Stock bas — {accessoire.nom}',
                'message': f'{accessoire.stock_disponible} {accessoire.unite} restants (seuil : {accessoire.seuil_alerte})',
                'lien': '/stocks',
            })
        for lot in LotPF.objects.filter(
            statut='disponible', date_peremption__range=(today, today + timedelta(days=7))
        ).select_related('formule'):
            notifications.append({
                'id': f'peremption-pf-{lot.id}', 'type': 'danger', 'module': 'production',
                'titre': f'Péremption imminente — {lot.numero_lot}',
                'message': f'Lot {lot.numero_lot} ({lot.formule.nom}) expire dans {(lot.date_peremption - today).days} jour(s)',
                'lien': '/production',
            })
        if request.user.role in {'superviseur', 'admin'}:
            for lot in LotFournisseur.objects.filter(
                statut='disponible', date_peremption__range=(today, today + timedelta(days=7))
            ).select_related('mp'):
                notifications.append({
                    'id': f'peremption-lot-{lot.id}', 'type': 'warning', 'module': 'lots-fournisseurs',
                    'titre': f'Péremption lot fournisseur — {lot.numero_lot}',
                    'message': f'{lot.mp.nom} : lot {lot.numero_lot} expire dans {(lot.date_peremption - today).days} jour(s)',
                    'lien': '/lots-fournisseurs',
                })
        overdue = Commande.objects.filter(
            statut_paiement__in=['non_paye', 'partiel'],
            montant_paye__lt=F('montant_total'),
            date_commande__lte=today - timedelta(days=30),
        ).exclude(statut='annulee').select_related('client')
        for commande in overdue:
            notifications.append({
                'id': f'paiement-{commande.id}', 'type': 'info', 'module': 'ventes',
                'titre': f'Paiement en attente — {commande.client.nom_client}',
                'message': f'Commande {commande.numero_commande} : {commande.montant_total - commande.montant_paye} {_currency_label()} restants',
                'lien': f'/ventes/{commande.id}',
            })
        return Response({'count': len(notifications), 'notifications': notifications})


class UtilisateurViewSet(viewsets.ModelViewSet):
    queryset = Utilisateur.objects.all().order_by('nom')
    permission_classes = [IsSuperviseurOrAdmin]

    def get_serializer_class(self):
        return UtilisateurCreateSerializer if self.action == 'create' else UtilisateurSerializer

    def destroy(self, request, *args, **kwargs):
        utilisateur = self.get_object()
        if utilisateur.pk == request.user.pk:
            return Response({'error': 'Vous ne pouvez pas supprimer votre propre compte.'}, status=400)
        if utilisateur.role in {'admin', 'superviseur'} and not Utilisateur.objects.filter(
            role__in=['admin', 'superviseur'], is_active=True
        ).exclude(pk=utilisateur.pk).exists():
            return Response({'error': 'Au moins un superviseur actif est requis.'}, status=400)
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        utilisateur = self.get_object()
        nouveau_role = request.data.get('role', utilisateur.role)
        nouvelle_activite = request.data.get('is_active', utilisateur.is_active)
        if utilisateur.pk == request.user.pk and nouvelle_activite is False:
            return Response({'error': 'Vous ne pouvez pas désactiver votre propre compte.'}, status=400)
        perd_supervision = (
            utilisateur.role in {'admin', 'superviseur'}
            and (nouveau_role not in {'admin', 'superviseur'} or nouvelle_activite is False)
        )
        if perd_supervision and not Utilisateur.objects.filter(
            role__in=['admin', 'superviseur'], is_active=True
        ).exclude(pk=utilisateur.pk).exists():
            return Response({'error': 'Au moins un superviseur actif est requis.'}, status=400)
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=['patch'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        utilisateur = self.get_object()
        new_password = request.data.get('password', '')
        try:
            validate_password(new_password)
        except DjangoValidationError as exc:
            return Response({'password': list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
        utilisateur.password = make_password(new_password)
        utilisateur.save(update_fields=['password', 'updated_at'])
        UserToken.objects.filter(utilisateur=utilisateur).delete()
        return Response({'message': 'Mot de passe réinitialisé'})


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Client.objects.select_related('cree_par').all().order_by('nom_client')
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(Q(nom_client__icontains=search) | Q(contact__icontains=search) | Q(adresse__icontains=search))
        return qs

    def perform_create(self, serializer):
        serializer.save(cree_par=self.request.user)

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {'error': 'Ce client possède des ventes et ne peut pas être supprimé.'},
                status=status.HTTP_409_CONFLICT,
            )


class AnimalViewSet(viewsets.ModelViewSet):
    queryset = Animal.objects.all().order_by('nom')
    serializer_class = AnimalSerializer
    permission_classes = [IsSuperviseurWriteAuthenticatedRead]


class StadeVieViewSet(viewsets.ModelViewSet):
    queryset = StadeVie.objects.select_related('animal').all().order_by('animal__nom', 'nom')
    serializer_class = StadeVieSerializer
    permission_classes = [IsSuperviseurWriteAuthenticatedRead]


class MPViewSet(viewsets.ModelViewSet):
    serializer_class = MPSerializer
    permission_classes = [IsSuperviseurWriteAuthenticatedRead]

    def get_queryset(self):
        qs = MP.objects.select_related('cree_par').all().order_by('nom')
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(nom__icontains=search)
        if self.request.query_params.get('actif') == 'true':
            qs = qs.filter(actif=True)
        if self.request.query_params.get('disponible') == 'true':
            qs = qs.filter(actif=True, stock_disponible__gt=0)
        return qs

    def perform_create(self, serializer):
        serializer.save(cree_par=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.stock_disponible > 0:
            instance.actif = False
            instance.save(update_fields=['actif', 'updated_at'])
            return Response(
                {'message': 'Matière première archivée car son stock n’est pas nul.'},
                status=status.HTTP_200_OK,
            )
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            instance.actif = False
            instance.save(update_fields=['actif', 'updated_at'])
            return Response(
                {'message': 'Matière première archivée car elle est déjà utilisée.'},
                status=status.HTTP_200_OK,
            )


class AccessoireViewSet(viewsets.ModelViewSet):
    serializer_class = AccessoireSerializer
    permission_classes = [IsSuperviseurWriteAuthenticatedRead]

    def get_queryset(self):
        qs = Accessoire.objects.select_related('cree_par').all().order_by('nom')
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(Q(nom__icontains=search) | Q(description__icontains=search))
        if self.request.query_params.get('actif') == 'true':
            qs = qs.filter(actif=True)
        if self.request.query_params.get('disponible') == 'true':
            qs = qs.filter(actif=True, stock_disponible__gt=0)
        return qs

    def perform_create(self, serializer):
        serializer.save(cree_par=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.stock_disponible > 0:
            instance.actif = False
            instance.save(update_fields=['actif', 'updated_at'])
            return Response(
                {'message': 'Accessoire archivé car son stock n’est pas nul.'},
                status=status.HTTP_200_OK,
            )
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            instance.actif = False
            instance.save(update_fields=['actif', 'updated_at'])
            return Response(
                {'message': 'Accessoire archivé car il apparaît dans l’historique des ventes.'},
                status=status.HTTP_200_OK,
            )


class LotFournisseurViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    permission_classes = [IsSuperviseurWriteAuthenticatedRead]

    def get_queryset(self):
        qs = LotFournisseur.objects.select_related('mp', 'cree_par').all().order_by('-date_reception', '-id')
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(Q(numero_lot__icontains=search) | Q(fournisseur__icontains=search) | Q(mp__nom__icontains=search))
        return qs

    def get_serializer_class(self):
        return LotFournisseurCreateSerializer if self.action == 'create' else LotFournisseurSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        mp = MP.objects.select_for_update().get(pk=data['mp'].pk)
        quantite = data['quantite']
        numero_lot = data.get('numero_lot') or f"LOT-{uuid.uuid4().hex[:8].upper()}"
        lot = LotFournisseur.objects.create(
            mp=mp, numero_lot=numero_lot, fournisseur=data['fournisseur'],
            quantite_initiale=quantite, quantite=quantite, prix_achat=data['cout_kg'],
            date_reception=data['date_reception'], date_peremption=data.get('date_peremption'),
            cree_par=request.user,
        )
        _mouvement_mp(mp, quantite, 'entree_lot', request.user, lot.id, 'LotFournisseur')
        nouveau_stock = mp.stock_disponible + quantite
        mp.prix_achat_moyen = (
            ((mp.stock_disponible * mp.prix_achat_moyen) + (quantite * data['cout_kg'])) /
            nouveau_stock
        ).quantize(Decimal('0.01'))
        mp.prix_vente = _prix_vente_mp(mp.prix_achat_moyen)
        mp.stock_disponible = nouveau_stock
        mp.save(update_fields=['stock_disponible', 'prix_achat_moyen', 'prix_vente', 'updated_at'])
        return Response(LotFournisseurSerializer(lot).data, status=status.HTTP_201_CREATED)


class FormuleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSuperviseurWriteAuthenticatedRead]

    def get_queryset(self):
        qs = Formule.objects.select_related('stade_vie', 'cree_par').prefetch_related('compositions__mp').all().order_by('code')
        search = self.request.query_params.get('search', '').strip()
        return qs.filter(Q(nom__icontains=search) | Q(code__icontains=search)) if search else qs

    def get_serializer_class(self):
        return FormuleCreateSerializer if self.action in ['create', 'update', 'partial_update'] else FormuleSerializer

    def perform_create(self, serializer):
        serializer.save(cree_par=self.request.user)

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response({'error': 'Une formule ayant servi en production ne peut pas être supprimée.'}, status=409)


class LotPFViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LotPFSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        today = timezone.localdate()
        LotPF.objects.filter(statut='disponible', date_peremption__lt=today).update(statut='perime')
        qs = LotPF.objects.select_related('formule').all().order_by('-date_production', '-id')
        if self.request.query_params.get('disponible') == 'true':
            qs = qs.filter(statut='disponible', quantite__gt=0, date_peremption__gte=today)
        return qs


class ProductionViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Production.objects.select_related(
            'formule', 'lot_pf', 'cree_par'
        ).prefetch_related(
            'consommations_lots__lot_fournisseur__mp'
        ).all().order_by('-date_production', '-id')

    def get_serializer_class(self):
        return ProductionCreateSerializer if self.action == 'create' else ProductionSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        formule = Formule.objects.prefetch_related('compositions__mp').get(pk=serializer.validated_data['formule'].pk)
        quantite = serializer.validated_data['quantite']
        compositions = list(formule.compositions.all())
        if not compositions or sum((c.pourcentage for c in compositions), Decimal('0')) != Decimal('100'):
            return Response({'error': 'La formule doit contenir exactement 100 % de composition.'}, status=400)

        locked_mps = {
            mp.pk: mp for mp in MP.objects.select_for_update().filter(pk__in=[c.mp_id for c in compositions])
        }
        today = timezone.localdate()
        allocations = []
        cout_matieres = Decimal('0')
        for comp in compositions:
            mp = locked_mps[comp.mp_id]
            requis = (comp.pourcentage / Decimal('100')) * quantite
            if mp.stock_disponible < requis:
                return Response({'error': f'Stock insuffisant pour {mp.nom}. Requis : {requis} {mp.unite}, disponible : {mp.stock_disponible} {mp.unite}'}, status=400)
            lots = list(
                LotFournisseur.objects.select_for_update()
                .filter(mp=mp, statut='disponible', quantite__gt=0, date_reception__lte=today)
                .filter(Q(date_peremption__isnull=True) | Q(date_peremption__gte=today))
                .order_by(F('date_peremption').asc(nulls_last=True), 'date_reception', 'id')
            )
            restant = requis
            for lot in lots:
                if restant <= 0:
                    break
                preleve = min(lot.quantite, restant)
                allocations.append((mp, lot, preleve))
                cout_matieres += preleve * lot.prix_achat
                restant -= preleve
            if restant > 0:
                return Response({'error': f'Aucun lot fournisseur valide ne couvre {requis} {mp.unite} de {mp.nom}.'}, status=400)

        config = _system_config()
        try:
            coefficient = Decimal(config.get('coefficient_transformation', '1.08'))
            duree = int(config.get('duree_peremption_pf', '180'))
        except (InvalidOperation, ValueError):
            return Response({'error': 'Paramètres de production invalides.'}, status=500)
        cout_unitaire = ((cout_matieres * coefficient) / quantite).quantize(Decimal('0.01'))
        lot_pf = LotPF.objects.create(
            formule=formule, numero_lot=f"PF-{uuid.uuid4().hex[:8].upper()}",
            quantite_initiale=quantite, quantite=quantite, cout_revient=cout_unitaire,
            date_production=today, date_peremption=today + timedelta(days=duree), statut='disponible',
        )
        production = Production.objects.create(
            formule=formule, lot_pf=lot_pf, quantite=quantite,
            date_prevue=today, date_production=today, statut='terminee', cree_par=request.user,
        )
        for mp, lot, preleve in allocations:
            LotConsommation.objects.create(
                production=production, lot_fournisseur=lot,
                quantite=preleve, cout_unitaire=lot.prix_achat,
            )
            lot.quantite -= preleve
            if lot.quantite == 0:
                lot.statut = 'epuise'
            lot.save(update_fields=['quantite', 'statut'])
        for comp in compositions:
            mp = locked_mps[comp.mp_id]
            consommation = (comp.pourcentage / Decimal('100')) * quantite
            _mouvement_mp(mp, -consommation, 'consommation', request.user, production.id, 'Production')
            mp.stock_disponible -= consommation
            mp.save(update_fields=['stock_disponible', 'updated_at'])
        return Response(ProductionSerializer(production).data, status=status.HTTP_201_CREATED)


class CommandeViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Commande.objects.select_related(
            'client', 'lot_pf', 'lot_pf__formule', 'mp', 'accessoire', 'cree_par'
        ).prefetch_related('paiements', 'lots_mp_vendus__lot_fournisseur').all().order_by('-date_commande', '-id')
        search = self.request.query_params.get('search', '').strip()
        date_value = parse_date(self.request.query_params.get('date', ''))
        client_id = self.request.query_params.get('client')
        if search:
            qs = qs.filter(
                Q(numero_commande__icontains=search) |
                Q(client__nom_client__icontains=search) |
                Q(lot_pf__formule__nom__icontains=search) |
                Q(mp__nom__icontains=search) |
                Q(accessoire__nom__icontains=search)
            )
        if date_value:
            qs = qs.filter(date_commande=date_value)
        if client_id:
            qs = qs.filter(client_id=client_id)
        type_produit = self.request.query_params.get('type_produit')
        if type_produit in {'pf', 'mp', 'accessoire'}:
            qs = qs.filter(type_produit=type_produit)
        return qs

    def get_serializer_class(self):
        return CommandeCreateSerializer if self.action == 'create' else CommandeSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        quantite = data['quantite']
        type_produit = data['type_produit']
        allocations_mp = []

        if type_produit == 'pf':
            lot_pf = LotPF.objects.select_for_update().select_related('formule').get(pk=data['lot_pf'].pk)
            if lot_pf.statut != 'disponible' or lot_pf.date_peremption < timezone.localdate():
                return Response({'error': 'Ce lot n’est plus disponible.'}, status=400)
            if lot_pf.quantite < quantite:
                return Response({'error': f'Stock insuffisant. Requis : {quantite}, disponible : {lot_pf.quantite}'}, status=400)
            data['lot_pf'] = lot_pf
            cout_unitaire = lot_pf.cout_revient
        elif type_produit == 'mp':
            mp = MP.objects.select_for_update().get(pk=data['mp'].pk)
            if not mp.actif or mp.stock_disponible < quantite:
                return Response({'error': f'Stock insuffisant pour {mp.nom}.'}, status=400)
            today = timezone.localdate()
            lots = list(
                LotFournisseur.objects.select_for_update()
                .filter(mp=mp, statut='disponible', quantite__gt=0, date_reception__lte=today)
                .filter(Q(date_peremption__isnull=True) | Q(date_peremption__gte=today))
                .order_by(F('date_peremption').asc(nulls_last=True), 'date_reception', 'id')
            )
            restant = quantite
            cout_total = Decimal('0')
            for lot in lots:
                if restant <= 0:
                    break
                preleve = min(lot.quantite, restant)
                allocations_mp.append((lot, preleve))
                cout_total += preleve * lot.prix_achat
                restant -= preleve
            if restant > 0:
                return Response({'error': f'Les lots valides ne couvrent pas la vente de {mp.nom}.'}, status=400)
            data['mp'] = mp
            data['prix_unitaire'] = mp.prix_vente
            cout_unitaire = (cout_total / quantite).quantize(Decimal('0.01'))
        else:
            accessoire = Accessoire.objects.select_for_update().get(pk=data['accessoire'].pk)
            if not accessoire.actif or accessoire.stock_disponible < quantite:
                return Response({'error': f'Stock insuffisant pour {accessoire.nom}.'}, status=400)
            data['accessoire'] = accessoire
            data['prix_unitaire'] = accessoire.prix_vente
            cout_unitaire = accessoire.prix_achat

        montant_total = (quantite * data['prix_unitaire']).quantize(Decimal('0.01'))
        initial = data.pop('montant_paye_initial', Decimal('0'))
        if data.get('mode_paiement', 'cash') == 'cash':
            initial = montant_total
        statut_paiement = 'paye' if initial == montant_total else ('partiel' if initial > 0 else 'non_paye')
        commande = Commande.objects.create(
            **data, cree_par=request.user, numero_commande=f"CMD-{uuid.uuid4().hex[:8].upper()}",
            montant_total=montant_total, montant_paye=initial, cout_unitaire=cout_unitaire,
            statut='confirmee', statut_paiement=statut_paiement,
        )
        if initial > 0:
            Paiement.objects.create(commande=commande, montant=initial, cree_par=request.user)

        if type_produit == 'pf':
            _mouvement_pf(lot_pf, -quantite, 'vente', request.user, commande.id, 'Commande')
            lot_pf.quantite -= quantite
            if lot_pf.quantite == 0:
                lot_pf.statut = 'epuise'
            lot_pf.save(update_fields=['quantite', 'statut'])
        elif type_produit == 'mp':
            _mouvement_mp(mp, -quantite, 'vente_mp', request.user, commande.id, 'Commande')
            for lot, preleve in allocations_mp:
                CommandeLotMP.objects.create(
                    commande=commande, lot_fournisseur=lot,
                    quantite=preleve, cout_unitaire=lot.prix_achat,
                )
                lot.quantite -= preleve
                if lot.quantite == 0:
                    lot.statut = 'epuise'
                lot.save(update_fields=['quantite', 'statut'])
            mp.stock_disponible -= quantite
            mp.save(update_fields=['stock_disponible', 'updated_at'])
        else:
            _mouvement_accessoire(
                accessoire, -quantite, 'vente_accessoire', request.user, commande.id, 'Commande'
            )
            accessoire.stock_disponible -= quantite
            accessoire.save(update_fields=['stock_disponible', 'updated_at'])
        return Response(CommandeSerializer(commande).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def facture(self, request, pk=None):
        commande = self.get_object()
        config = _system_config()
        data = CommandeSerializer(commande).data
        data.update({
            'produit': commande.produit_nom,
            'configuration': {
                'nom_provenderie': config.get('nom_provenderie', 'PROVENDIX'),
                'adresse': config.get('adresse_provenderie', ''),
                'telephone': config.get('telephone', ''),
                'nif': config.get('nif', ''),
                'devise': _currency_code(),
            },
        })
        return Response(data)

    @action(detail=True, methods=['patch'])
    @transaction.atomic
    def paiement(self, request, pk=None):
        commande = Commande.objects.select_for_update().get(pk=pk)
        serializer = PaiementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if commande.statut == 'annulee':
            return Response({'error': 'Une commande annulée ne peut pas être encaissée.'}, status=400)
        restant = commande.montant_total - commande.montant_paye
        montant = serializer.validated_data['montant']
        if montant > restant:
            return Response({'error': f'Le montant dépasse le reste à payer ({restant}).'}, status=400)
        Paiement.objects.create(commande=commande, montant=montant, cree_par=request.user)
        commande.montant_paye += montant
        commande.statut_paiement = 'paye' if commande.montant_paye == commande.montant_total else 'partiel'
        commande.save(update_fields=['montant_paye', 'statut_paiement', 'updated_at'])
        return Response(CommandeSerializer(commande).data)

    @action(detail=True, methods=['post'], permission_classes=[IsSuperviseurOrAdmin])
    @transaction.atomic
    def annuler(self, request, pk=None):
        commande = Commande.objects.select_for_update().select_related(
            'lot_pf', 'mp', 'accessoire'
        ).get(pk=pk)
        if commande.statut == 'annulee':
            return Response({'error': 'Cette commande est déjà annulée.'}, status=400)
        if commande.montant_paye > 0:
            return Response({'error': 'Remboursez les paiements avant d’annuler la commande.'}, status=400)
        if commande.type_produit == 'pf':
            lot_pf = LotPF.objects.select_for_update().get(pk=commande.lot_pf_id)
            _mouvement_pf(lot_pf, commande.quantite, 'annulation_vente', request.user, commande.id, 'Commande')
            lot_pf.quantite += commande.quantite
            lot_pf.statut = 'disponible' if lot_pf.date_peremption >= timezone.localdate() else 'perime'
            lot_pf.save(update_fields=['quantite', 'statut'])
        elif commande.type_produit == 'mp':
            mp = MP.objects.select_for_update().get(pk=commande.mp_id)
            allocations = list(commande.lots_mp_vendus.select_related('lot_fournisseur').all())
            lots = {
                lot.pk: lot for lot in LotFournisseur.objects.select_for_update().filter(
                    pk__in=[allocation.lot_fournisseur_id for allocation in allocations]
                )
            }
            _mouvement_mp(mp, commande.quantite, 'annulation_vente', request.user, commande.id, 'Commande')
            for allocation in allocations:
                lot = lots[allocation.lot_fournisseur_id]
                lot.quantite += allocation.quantite
                lot.statut = 'disponible'
                lot.save(update_fields=['quantite', 'statut'])
            mp.stock_disponible += commande.quantite
            mp.save(update_fields=['stock_disponible', 'updated_at'])
        else:
            accessoire = Accessoire.objects.select_for_update().get(pk=commande.accessoire_id)
            _mouvement_accessoire(
                accessoire, commande.quantite, 'annulation_vente', request.user, commande.id, 'Commande'
            )
            accessoire.stock_disponible += commande.quantite
            accessoire.save(update_fields=['stock_disponible', 'updated_at'])
        commande.statut = 'annulee'
        commande.save(update_fields=['statut', 'updated_at'])
        return Response(CommandeSerializer(commande).data)


class VenteViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Vente.objects.select_related('commande', 'client', 'utilisateur').all()
    serializer_class = VenteSerializer
    permission_classes = [IsAuthenticated]


class HistoriqueViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Historique.objects.all().order_by('-date')
    serializer_class = HistoriqueSerializer
    permission_classes = [IsSuperviseurOrAdmin]


class StockViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action == 'ajustement':
            return [IsSuperviseurOrAdmin()]
        return super().get_permissions()

    def list(self, request):
        mp_stocks = MP.objects.prefetch_related('lots_fournisseurs').all().order_by('nom')
        pf_stocks = LotPF.objects.filter(statut='disponible', quantite__gt=0).select_related('formule')
        accessoires = Accessoire.objects.filter(actif=True).order_by('nom')
        mp_data = []
        for mp in mp_stocks:
            lots = list(mp.lots_fournisseurs.all().values(
                'id', 'numero_lot', 'fournisseur', 'quantite_initiale', 'quantite',
                'prix_achat', 'date_reception', 'date_peremption', 'statut',
            ))
            en_alerte = mp.stock_disponible < mp.seuil_alerte
            mp_data.append({
                'matiere_premiere': {
                    'id': mp.id, 'nom': mp.nom, 'quantite': mp.stock_disponible,
                    'prix_kg': mp.prix_vente, 'unite': mp.unite,
                    'seuil_alerte': mp.seuil_alerte, 'en_alerte': en_alerte,
                },
                'quantite_totale': mp.stock_disponible,
                'en_alerte': en_alerte,
                'lots': lots,
            })
        pf_data = [{
            'lot_pf': {
                'id': pf.id, 'numero_lot': pf.numero_lot,
                'quantite_initiale': pf.quantite_initiale,
                'quantite_restante': pf.quantite,
                'cout_revient': pf.cout_revient,
                'date_peremption': pf.date_peremption,
                'statut': pf.statut,
                'formule': {'id': pf.formule.id, 'nom': pf.formule.nom},
            },
            'quantite_restante': pf.quantite,
        } for pf in pf_stocks]
        accessoires_data = AccessoireSerializer(accessoires, many=True, context={'request': request}).data
        return Response({
            'matieres_premieres': mp_data,
            'produits_finis': pf_data,
            'accessoires': accessoires_data,
        })

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def ajustement(self, request):
        serializer = AjustementStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        quantite = data['quantite']
        delta = quantite if data['type_ajustement'] == 'ajout' else -quantite
        lots_mp = []
        if data['type_stock'] == 'mp':
            cible = MP.objects.select_for_update().get(pk=data['mp'].pk)
            disponible = cible.stock_disponible
            lots_mp = list(
                LotFournisseur.objects.select_for_update()
                .filter(mp=cible, statut='disponible', quantite__gt=0)
                .order_by(F('date_peremption').asc(nulls_last=True), 'date_reception', 'id')
            )
            stock_trace = sum((lot.quantite for lot in lots_mp), Decimal('0'))
            if delta < 0 and quantite > stock_trace:
                return Response({
                    'error': f'Le retrait dépasse le stock traçable par lots ({stock_trace}).'
                }, status=400)
        elif data['type_stock'] == 'pf':
            cible = LotPF.objects.select_for_update().get(pk=data['lot_pf'].pk)
            disponible = cible.quantite
        else:
            cible = Accessoire.objects.select_for_update().get(pk=data['accessoire'].pk)
            disponible = cible.stock_disponible
        if delta < 0 and quantite > disponible:
            return Response({'error': 'Le retrait dépasse le stock disponible.'}, status=400)
        ajustement = AjustementStock.objects.create(**data, cree_par=request.user)
        if data['type_stock'] == 'mp':
            _mouvement_mp(cible, delta, 'ajustement', request.user, ajustement.id, 'AjustementStock')
            if delta > 0:
                LotFournisseur.objects.create(
                    mp=cible,
                    numero_lot=f'AJUST-{ajustement.id}-{uuid.uuid4().hex[:6].upper()}',
                    fournisseur='Ajustement d’inventaire',
                    quantite_initiale=quantite,
                    quantite=quantite,
                    prix_achat=cible.prix_achat_moyen,
                    date_reception=timezone.localdate(),
                    statut='disponible',
                    cree_par=request.user,
                )
            else:
                restant = quantite
                for lot in lots_mp:
                    if restant <= 0:
                        break
                    preleve = min(lot.quantite, restant)
                    lot.quantite -= preleve
                    restant -= preleve
                    if lot.quantite == 0:
                        lot.statut = 'epuise'
                    lot.save(update_fields=['quantite', 'statut'])
            cible.stock_disponible += delta
            cible.save(update_fields=['stock_disponible', 'updated_at'])
        elif data['type_stock'] == 'pf':
            _mouvement_pf(cible, delta, 'ajustement', request.user, ajustement.id, 'AjustementStock')
            cible.quantite += delta
            if cible.quantite == 0:
                cible.statut = 'epuise'
            elif cible.date_peremption >= timezone.localdate():
                cible.statut = 'disponible'
            cible.save(update_fields=['quantite', 'statut'])
        else:
            _mouvement_accessoire(
                cible, delta, 'ajustement', request.user, ajustement.id, 'AjustementStock'
            )
            cible.stock_disponible += delta
            cible.save(update_fields=['stock_disponible', 'updated_at'])
        return Response(AjustementStockSerializer(ajustement).data, status=status.HTTP_201_CREATED)


class MouvementStockViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MouvementStockSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = MouvementStock.objects.select_related('mp', 'lot_pf', 'accessoire', 'cree_par').all()
        if self.request.query_params.get('mp'):
            qs = qs.filter(mp_id=self.request.query_params['mp'])
        if self.request.query_params.get('lot_pf'):
            qs = qs.filter(lot_pf_id=self.request.query_params['lot_pf'])
        if self.request.query_params.get('accessoire'):
            qs = qs.filter(accessoire_id=self.request.query_params['accessoire'])
        if self.request.query_params.get('type'):
            qs = qs.filter(type_mouvement=self.request.query_params['type'])
        return qs


class LogEntryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LogEntrySerializer
    permission_classes = [IsSuperviseurOrAdmin]
    _ACTION_FILTER = {'create': 0, 'update': 1, 'delete': 2, 'access': 3}
    _MODULE_MODELS = {
        'utilisateurs': ['utilisateur'], 'clients': ['client'],
        'matieres premieres': ['mp'], 'mp': ['mp'],
        'accessoires': ['accessoire'],
        'formules': ['formule', 'compositionformule'],
        'lots fournisseurs': ['lotfournisseur'], 'lots produits finis': ['lotpf'],
        'production': ['production', 'lotconsommation'],
        'ventes': ['commande', 'paiement', 'commandelotmp'], 'inventaire': ['ajustementstock'],
        'parametres': ['parametre'],
    }

    def get_queryset(self):
        qs = LogEntry.objects.select_related('content_type').all().order_by('-timestamp')
        action_value = self.request.query_params.get('action')
        module = self.request.query_params.get('module')
        date_from = parse_date(self.request.query_params.get('from', ''))
        date_to = parse_date(self.request.query_params.get('to', ''))
        if action_value in self._ACTION_FILTER:
            qs = qs.filter(action=self._ACTION_FILTER[action_value])
        if module:
            key = module.strip().lower()
            models_list = self._MODULE_MODELS.get(key)
            qs = qs.filter(content_type__model__in=models_list) if models_list else qs.filter(content_type__model__icontains=key)
        if date_from:
            qs = qs.filter(timestamp__date__gte=date_from)
        if date_to:
            qs = qs.filter(timestamp__date__lte=date_to)
        return qs


class ParametreViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Parametre.objects.all().order_by('cle')
    serializer_class = ParametreSerializer
    permission_classes = [IsSuperviseurOrAdmin]

    @action(detail=False, methods=['get'])
    def by_key(self, request):
        cle = request.query_params.get('cle')
        if not cle:
            return Response({'error': 'Paramètre cle requis'}, status=400)
        param = Parametre.objects.filter(cle=cle).first()
        if param:
            return Response(ParametreSerializer(param).data)
        default = Parametre.DEFAULTS.get(cle)
        return Response({'cle': cle, 'valeur': default}) if default is not None else Response({'error': 'Paramètre introuvable'}, status=404)

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_update(self, request):
        params = request.data.get('params')
        if not isinstance(params, dict):
            return Response({'error': 'Le champ params doit être un objet.'}, status=400)
        allowed = set(Parametre.DEFAULTS) | {'adresse_provenderie', 'telephone', 'nif'}
        unknown = set(params) - allowed
        if unknown:
            return Response({'error': f"Paramètres inconnus : {', '.join(sorted(unknown))}"}, status=400)
        updated = []
        for cle, valeur in params.items():
            instance = Parametre.objects.filter(cle=cle).first()
            serializer = ParametreSerializer(instance, data={
                'cle': cle, 'valeur': str(valeur),
                'description': instance.description if instance else '',
            })
            serializer.is_valid(raise_exception=True)
            updated.append(serializer.save())
        if 'marge_vente_mp' in params:
            matieres = list(MP.objects.all())
            now = timezone.now()
            for mp in matieres:
                mp.prix_vente = _prix_vente_mp(mp.prix_achat_moyen)
                mp.updated_at = now
            MP.objects.bulk_update(matieres, ['prix_vente', 'updated_at'])
        return Response({'updated': ParametreSerializer(updated, many=True).data})
