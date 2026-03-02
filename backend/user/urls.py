from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoginView, LogoutView, RefreshTokenView,
    UtilisateurViewSet, ClientViewSet, AnimalViewSet, StadeVieViewSet,
    MPViewSet, LotFournisseurViewSet, FormuleViewSet, LotPFViewSet,
    ProductionViewSet, CommandeViewSet, VenteViewSet, HistoriqueViewSet, StockViewSet
)

router = DefaultRouter()
router.register(r'users', UtilisateurViewSet, basename='utilisateur')
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'animaux', AnimalViewSet, basename='animal')
router.register(r'stages-vie', StadeVieViewSet, basename='stadevie')
router.register(r'matieres-premieres', MPViewSet, basename='mp')
router.register(r'lots-fournisseurs', LotFournisseurViewSet, basename='lotfournisseur')
router.register(r'formules', FormuleViewSet, basename='formule')
router.register(r'lots-pf', LotPFViewSet, basename='lotpf')
router.register(r'productions', ProductionViewSet, basename='production')
router.register(r'commandes', CommandeViewSet, basename='commande')
router.register(r'ventes', VenteViewSet, basename='vente')
router.register(r'historiques', HistoriqueViewSet, basename='historique')
router.register(r'stocks', StockViewSet, basename='stock')

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/refresh-token/', RefreshTokenView.as_view(), name='refresh-token'),
    path('', include(router.urls)),
]