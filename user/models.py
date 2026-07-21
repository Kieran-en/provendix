import hashlib
import secrets
from datetime import timedelta
from decimal import Decimal

from django.db import models
from django.db.models import Q
from django.utils import timezone


class Utilisateur(models.Model):
    ROLE_CHOICES = [
        ("gerant", "Gérant"),
        ("superviseur", "Superviseur"),
        ("admin", "Administrateur"),
    ]

    nom = models.CharField(max_length=100)
    login = models.CharField(max_length=100, unique=True)
    role = models.CharField(max_length=15, choices=ROLE_CHOICES, default="gerant")
    password = models.CharField(max_length=128)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.nom


class UserToken(models.Model):
    utilisateur = models.OneToOneField(
        'Utilisateur',
        on_delete=models.CASCADE,
        related_name='auth_token',
    )
    # Seuls les condensats sont persistés : une fuite de base ne suffit pas
    # pour usurper une session active.
    key = models.CharField(max_length=64, unique=True)
    refresh_key = models.CharField(max_length=64, unique=True)
    access_expires_at = models.DateTimeField()
    refresh_expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def _hash(cls, raw_token):
        return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()

    @classmethod
    def issue(cls, utilisateur):
        access_token = secrets.token_urlsafe(48)
        refresh_token = secrets.token_urlsafe(48)
        now = timezone.now()
        cls.objects.filter(utilisateur=utilisateur).delete()
        token = cls.objects.create(
            utilisateur=utilisateur,
            key=cls._hash(access_token),
            refresh_key=cls._hash(refresh_token),
            access_expires_at=now + timedelta(minutes=15),
            refresh_expires_at=now + timedelta(days=7),
        )
        return token, access_token, refresh_token

    def rotate_access_token(self):
        raw_token = secrets.token_urlsafe(48)
        self.key = self._hash(raw_token)
        self.access_expires_at = timezone.now() + timedelta(minutes=15)
        self.save(update_fields=['key', 'access_expires_at'])
        return raw_token

    def __str__(self):
        return f"Token de {self.utilisateur.nom}"


class Client(models.Model):
    nom_client = models.CharField(max_length=150)
    contact = models.CharField(max_length=150, blank=True, default='')
    adresse = models.CharField(max_length=255, blank=True, default='')
    annees_experience = models.PositiveIntegerField(default=0)
    animaux_eleves = models.CharField(max_length=255, blank=True, default='')
    cree_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="clients_enregistres",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.nom_client


class Animal(models.Model):
    nom = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nom


class StadeVie(models.Model):
    nom = models.CharField(max_length=100)
    animal = models.ForeignKey(
        Animal,
        on_delete=models.CASCADE,
        related_name="stades_vie",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.animal} - {self.nom}"


class MP(models.Model):
    nom = models.CharField(max_length=150)
    unite = models.CharField(max_length=20, default="kg")
    prix_achat_moyen = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))
    prix_vente = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))
    stock_disponible = models.DecimalField(max_digits=16, decimal_places=3, default=Decimal('0'))
    seuil_alerte = models.DecimalField(max_digits=16, decimal_places=3, default=Decimal('500'))
    actif = models.BooleanField(default=True)
    cree_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mp_enregistrees",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.nom

    class Meta:
        verbose_name = "Matière Première"
        verbose_name_plural = "Matières Premières"
        constraints = [
            models.CheckConstraint(check=Q(prix_achat_moyen__gte=0), name='mp_prix_achat_non_negatif'),
            models.CheckConstraint(check=Q(prix_vente__gte=0), name='mp_prix_non_negatif'),
            models.CheckConstraint(check=Q(stock_disponible__gte=0), name='mp_stock_non_negatif'),
            models.CheckConstraint(check=Q(seuil_alerte__gte=0), name='mp_seuil_non_negatif'),
        ]


class Accessoire(models.Model):
    nom = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True, default='')
    unite = models.CharField(max_length=30, default='pièce')
    photo = models.ImageField(upload_to='accessoires/%Y/%m/', blank=True, null=True)
    prix_achat = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))
    prix_vente = models.DecimalField(max_digits=18, decimal_places=2)
    stock_disponible = models.DecimalField(max_digits=16, decimal_places=3, default=Decimal('0'))
    seuil_alerte = models.DecimalField(max_digits=16, decimal_places=3, default=Decimal('0'))
    actif = models.BooleanField(default=True)
    cree_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accessoires_enregistres',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.nom

    class Meta:
        ordering = ['nom']
        constraints = [
            models.CheckConstraint(check=Q(prix_achat__gte=0), name='accessoire_achat_non_negatif'),
            models.CheckConstraint(check=Q(prix_vente__gt=0), name='accessoire_vente_positive'),
            models.CheckConstraint(check=Q(stock_disponible__gte=0), name='accessoire_stock_non_negatif'),
            models.CheckConstraint(check=Q(seuil_alerte__gte=0), name='accessoire_seuil_non_negatif'),
        ]


class Formule(models.Model):
    nom = models.CharField(max_length=150)
    code = models.CharField(max_length=50, unique=True)
    stade_vie = models.ForeignKey(
        StadeVie,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="formules",
    )
    prix_unitaire = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))
    cree_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="formules_enregistrees",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.nom


class CompositionFormule(models.Model):
    formule = models.ForeignKey(
        Formule,
        on_delete=models.CASCADE,
        related_name="compositions",
    )
    mp = models.ForeignKey(
        MP,
        on_delete=models.PROTECT,
        related_name="compositions",
    )
    pourcentage = models.DecimalField(max_digits=6, decimal_places=3)

    def __str__(self):
        return f"{self.formule} - {self.mp}: {self.pourcentage}%"

    class Meta:
        verbose_name = "Composition de Formule"
        verbose_name_plural = "Compositions de Formules"
        constraints = [
            models.UniqueConstraint(fields=['formule', 'mp'], name='composition_mp_unique'),
            models.CheckConstraint(
                check=Q(pourcentage__gt=0) & Q(pourcentage__lte=100),
                name='composition_pourcentage_valide',
            ),
        ]


class LotFournisseur(models.Model):
    STATUT_CHOICES = [
        ("disponible", "Disponible"),
        ("epuise", "Épuisé"),
        ("annule", "Annulé"),
    ]

    mp = models.ForeignKey(
        MP,
        on_delete=models.PROTECT,
        related_name="lots_fournisseurs",
    )
    numero_lot = models.CharField(max_length=100, unique=True)
    fournisseur = models.CharField(max_length=150)
    quantite_initiale = models.DecimalField(max_digits=16, decimal_places=3, default=Decimal('0'))
    quantite = models.DecimalField(max_digits=16, decimal_places=3)
    prix_achat = models.DecimalField(max_digits=18, decimal_places=2)
    date_reception = models.DateField()
    date_peremption = models.DateField(null=True, blank=True)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="disponible")
    cree_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lots_fournisseurs_crees",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Lot {self.numero_lot} - {self.mp.nom}"

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(quantite_initiale__gt=0), name='lot_f_initiale_positive'),
            models.CheckConstraint(check=Q(quantite__gte=0), name='lot_f_quantite_non_negative'),
            models.CheckConstraint(check=Q(quantite__lte=models.F('quantite_initiale')), name='lot_f_sous_initiale'),
            models.CheckConstraint(check=Q(prix_achat__gte=0), name='lot_f_prix_non_negatif'),
        ]


class LotPF(models.Model):
    STATUT_CHOICES = [
        ("disponible", "Disponible"),
        ("epuise", "Épuisé"),
        ("perime", "Périmé"),
    ]

    formule = models.ForeignKey(
        Formule,
        on_delete=models.PROTECT,
        related_name="lots_pf",
    )
    numero_lot = models.CharField(max_length=100, unique=True)
    quantite_initiale = models.DecimalField(max_digits=16, decimal_places=3, default=Decimal('0'))
    quantite = models.DecimalField(max_digits=16, decimal_places=3)
    cout_revient = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))
    date_production = models.DateField()
    date_peremption = models.DateField()
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="disponible")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Lot PF {self.numero_lot} - {self.formule.nom}"

    class Meta:
        verbose_name = "Lot Produit Fini"
        constraints = [
            models.CheckConstraint(check=Q(quantite_initiale__gt=0), name='lot_pf_initiale_positive'),
            models.CheckConstraint(check=Q(quantite__gte=0), name='lot_pf_quantite_non_negative'),
            models.CheckConstraint(check=Q(quantite__lte=models.F('quantite_initiale')), name='lot_pf_sous_initiale'),
            models.CheckConstraint(check=Q(cout_revient__gte=0), name='lot_pf_cout_non_negatif'),
        ]


class Production(models.Model):
    STATUT_CHOICES = [
        ("en_attente", "En attente"),
        ("en_cours", "En cours"),
        ("terminee", "Terminée"),
        ("annulee", "Annulée"),
    ]

    formule = models.ForeignKey(
        Formule,
        on_delete=models.PROTECT,
        related_name="productions",
    )
    lot_pf = models.ForeignKey(
        LotPF,
        on_delete=models.PROTECT,
        related_name="production",
        null=True,
        blank=True,
    )
    quantite = models.DecimalField(max_digits=16, decimal_places=3)
    date_prevue = models.DateField()
    date_production = models.DateField(null=True, blank=True)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="en_attente")
    cree_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="productions_crees",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Production {self.id} - {self.formule.nom}"

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(quantite__gt=0), name='production_quantite_positive'),
        ]


class Commande(models.Model):
    STATUT_CHOICES = [
        ("en_attente", "En attente"),
        ("confirmee", "Confirmée"),
        ("en_preparation", "En préparation"),
        ("livree", "Livrée"),
        ("annulee", "Annulée"),
    ]

    MODE_PAIEMENT_CHOICES = [
        ("cash", "Espèces"),
        ("credit", "Crédit"),
    ]

    PAIEMENT_CHOICES = [
        ("non_paye", "Non payé"),
        ("partiel", "Partiellement payé"),
        ("paye", "Payé"),
    ]

    TYPE_PRODUIT_CHOICES = [
        ('pf', 'Produit fini'),
        ('mp', 'Matière première'),
        ('accessoire', 'Accessoire'),
    ]

    client = models.ForeignKey(
        Client,
        on_delete=models.PROTECT,
        related_name="commandes",
    )
    lot_pf = models.ForeignKey(
        LotPF,
        on_delete=models.PROTECT,
        related_name="commandes",
        null=True,
        blank=True,
    )
    mp = models.ForeignKey(
        MP,
        on_delete=models.PROTECT,
        related_name='commandes',
        null=True,
        blank=True,
    )
    accessoire = models.ForeignKey(
        Accessoire,
        on_delete=models.PROTECT,
        related_name='commandes',
        null=True,
        blank=True,
    )
    type_produit = models.CharField(max_length=20, choices=TYPE_PRODUIT_CHOICES, default='pf')
    numero_commande = models.CharField(max_length=100, unique=True)
    quantite = models.DecimalField(max_digits=16, decimal_places=3)
    prix_unitaire = models.DecimalField(max_digits=18, decimal_places=2)
    cout_unitaire = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))
    montant_total = models.DecimalField(max_digits=18, decimal_places=2)
    date_commande = models.DateField(auto_now_add=True)
    date_livraison = models.DateField(null=True, blank=True)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="en_attente")
    mode_paiement = models.CharField(max_length=20, choices=MODE_PAIEMENT_CHOICES, default="cash")
    statut_paiement = models.CharField(max_length=20, choices=PAIEMENT_CHOICES, default="non_paye")
    montant_paye = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))
    cree_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="commandes_crees",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Commande {self.numero_commande} - {self.client.nom_client}"

    def calculer_marge(self):
        return (self.prix_unitaire - self.cout_unitaire) * self.quantite

    @property
    def produit_nom(self):
        if self.type_produit == 'pf' and self.lot_pf:
            return self.lot_pf.formule.nom
        if self.type_produit == 'mp' and self.mp:
            return self.mp.nom
        if self.type_produit == 'accessoire' and self.accessoire:
            return self.accessoire.nom
        return 'Produit indisponible'

    @property
    def unite_produit(self):
        if self.type_produit == 'accessoire' and self.accessoire:
            return self.accessoire.unite
        if self.type_produit == 'mp' and self.mp:
            return self.mp.unite
        return 'kg'

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(quantite__gt=0), name='commande_quantite_positive'),
            models.CheckConstraint(check=Q(prix_unitaire__gte=0), name='commande_prix_non_negatif'),
            models.CheckConstraint(check=Q(cout_unitaire__gte=0), name='commande_cout_non_negatif'),
            models.CheckConstraint(check=Q(montant_total__gte=0), name='commande_total_non_negatif'),
            models.CheckConstraint(check=Q(montant_paye__gte=0), name='commande_paye_non_negatif'),
            models.CheckConstraint(check=Q(montant_paye__lte=models.F('montant_total')), name='commande_paye_sous_total'),
            models.CheckConstraint(
                check=(
                    Q(type_produit='pf', lot_pf__isnull=False, mp__isnull=True, accessoire__isnull=True) |
                    Q(type_produit='mp', lot_pf__isnull=True, mp__isnull=False, accessoire__isnull=True) |
                    Q(type_produit='accessoire', lot_pf__isnull=True, mp__isnull=True, accessoire__isnull=False)
                ),
                name='commande_produit_coherent',
            ),
        ]


class Paiement(models.Model):
    commande = models.ForeignKey(Commande, on_delete=models.PROTECT, related_name='paiements')
    montant = models.DecimalField(max_digits=18, decimal_places=2)
    cree_par = models.ForeignKey(
        Utilisateur, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='paiements_enregistres',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        constraints = [
            models.CheckConstraint(check=Q(montant__gt=0), name='paiement_montant_positif'),
        ]


class Vente(models.Model):
    commande = models.OneToOneField(
        Commande,
        on_delete=models.PROTECT,
        related_name="vente",
        null=True,
        blank=True,
    )
    client = models.ForeignKey(
        Client,
        on_delete=models.PROTECT,
        related_name="ventes",
    )
    utilisateur = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ventes_effectuees",
    )
    date = models.DateField(auto_now_add=True)
    quantite = models.DecimalField(max_digits=16, decimal_places=3)
    montant = models.DecimalField(max_digits=18, decimal_places=2)
    marge = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))

    def __str__(self):
        return f"Vente #{self.id} - {self.client}"


class Historique(models.Model):
    vente = models.ForeignKey(
        Vente,
        on_delete=models.CASCADE,
        related_name="historiques",
        null=True,
        blank=True,
    )
    date = models.DateField(unique=True)
    stocks_mp = models.DecimalField(max_digits=18, decimal_places=3, default=Decimal('0'))
    stocks_pf = models.DecimalField(max_digits=18, decimal_places=3, default=Decimal('0'))
    caisse = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal('0'))
    cree_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="historiques_enregistres",
    )

    def __str__(self):
        return f"Historique {self.date}"


class AjustementStock(models.Model):
    TYPE_CHOICES = [
        ("mp", "Matière Première"),
        ("pf", "Produit Fini"),
        ("accessoire", "Accessoire"),
    ]

    TYPE_AJUSTEMENT = [
        ("ajout", "Ajout"),
        ("retrait", "Retrait"),
    ]

    type_stock = models.CharField(max_length=10, choices=TYPE_CHOICES)
    mp = models.ForeignKey(
        MP,
        on_delete=models.PROTECT,
        related_name="ajustements",
        null=True,
        blank=True,
    )
    lot_pf = models.ForeignKey(
        LotPF,
        on_delete=models.PROTECT,
        related_name="ajustements",
        null=True,
        blank=True,
    )
    accessoire = models.ForeignKey(
        Accessoire,
        on_delete=models.PROTECT,
        related_name='ajustements',
        null=True,
        blank=True,
    )
    type_ajustement = models.CharField(max_length=20, choices=TYPE_AJUSTEMENT)
    quantite = models.DecimalField(max_digits=16, decimal_places=3)
    justification = models.TextField()
    cree_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ajustements_stock",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Ajustement {self.type_stock} - {self.type_ajustement}: {self.quantite}"

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(quantite__gt=0), name='ajustement_quantite_positive'),
            models.CheckConstraint(
                check=(
                    Q(type_stock='mp', mp__isnull=False, lot_pf__isnull=True, accessoire__isnull=True) |
                    Q(type_stock='pf', mp__isnull=True, lot_pf__isnull=False, accessoire__isnull=True) |
                    Q(type_stock='accessoire', mp__isnull=True, lot_pf__isnull=True, accessoire__isnull=False)
                ),
                name='ajustement_cible_coherente',
            ),
        ]


class LotConsommation(models.Model):
    """Allocation d'un lot fournisseur à une production (traçabilité FEFO)."""
    production = models.ForeignKey(Production, on_delete=models.PROTECT, related_name='consommations_lots')
    lot_fournisseur = models.ForeignKey(
        LotFournisseur, on_delete=models.PROTECT, related_name='consommations_production'
    )
    quantite = models.DecimalField(max_digits=16, decimal_places=3)
    cout_unitaire = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['production', 'lot_fournisseur'], name='allocation_lot_unique'),
            models.CheckConstraint(check=Q(quantite__gt=0), name='allocation_quantite_positive'),
            models.CheckConstraint(check=Q(cout_unitaire__gte=0), name='allocation_cout_non_negatif'),
        ]


class CommandeLotMP(models.Model):
    """Lots fournisseurs prélevés pour une vente directe de matière première."""
    commande = models.ForeignKey(Commande, on_delete=models.PROTECT, related_name='lots_mp_vendus')
    lot_fournisseur = models.ForeignKey(
        LotFournisseur, on_delete=models.PROTECT, related_name='ventes_directes'
    )
    quantite = models.DecimalField(max_digits=16, decimal_places=3)
    cout_unitaire = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['commande', 'lot_fournisseur'], name='vente_mp_lot_unique'),
            models.CheckConstraint(check=Q(quantite__gt=0), name='vente_mp_quantite_positive'),
            models.CheckConstraint(check=Q(cout_unitaire__gte=0), name='vente_mp_cout_non_negatif'),
        ]


# ─────────────────────────────────────────────────────────────
# NOUVEAUX MODÈLES
# ─────────────────────────────────────────────────────────────

class MouvementStock(models.Model):
    """
    Historique de chaque variation de stock (MP ou PF).
    Permet de voir exactement pourquoi et quand une quantité a changé.
    """
    TYPE_CHOICES = [
        ("entree_lot",   "Entrée lot fournisseur"),
        ("consommation", "Consommation production"),
        ("vente",        "Vente produit fini"),
        ("vente_mp",     "Vente matière première"),
        ("vente_accessoire", "Vente accessoire"),
        ("annulation_vente", "Annulation de vente"),
        ("ajustement",   "Ajustement inventaire"),
    ]

    mp = models.ForeignKey(
        MP, null=True, blank=True,
        on_delete=models.PROTECT,
        related_name="mouvements",
    )
    lot_pf = models.ForeignKey(
        LotPF, null=True, blank=True,
        on_delete=models.PROTECT,
        related_name="mouvements",
    )
    accessoire = models.ForeignKey(
        Accessoire, null=True, blank=True,
        on_delete=models.PROTECT,
        related_name='mouvements',
    )
    type_mouvement = models.CharField(max_length=20, choices=TYPE_CHOICES)
    quantite_avant = models.DecimalField(max_digits=16, decimal_places=3)
    quantite_delta = models.DecimalField(max_digits=16, decimal_places=3)   # positif = entrée, négatif = sortie
    quantite_apres = models.DecimalField(max_digits=16, decimal_places=3)
    reference_id = models.IntegerField(null=True, blank=True)
    reference_type = models.CharField(max_length=50, null=True, blank=True)
    cree_par = models.ForeignKey(
        Utilisateur, null=True,
        on_delete=models.SET_NULL,
        related_name="mouvements_stock",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        signe = "+" if self.quantite_delta >= 0 else ""
        return f"{self.type_mouvement} {signe}{self.quantite_delta}"

    class Meta:
        verbose_name = "Mouvement de Stock"
        verbose_name_plural = "Mouvements de Stock"
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                check=(Q(mp__isnull=False, lot_pf__isnull=True, accessoire__isnull=True) |
                       Q(mp__isnull=True, lot_pf__isnull=False, accessoire__isnull=True) |
                       Q(mp__isnull=True, lot_pf__isnull=True, accessoire__isnull=False)),
                name='mouvement_cible_coherente',
            ),
            models.CheckConstraint(check=Q(quantite_avant__gte=0), name='mouvement_avant_non_negatif'),
            models.CheckConstraint(check=Q(quantite_apres__gte=0), name='mouvement_apres_non_negatif'),
            models.CheckConstraint(condition=~Q(quantite_delta=0), name='mouvement_delta_non_nul'),
        ]


# Le journal d'activité "maison" (ancien modèle LogActivite) a été remplacé par
# django-auditlog : l'audit des créations/modifications/suppressions est désormais
# automatique via des signaux (voir config/settings.py et user/audit.py).


class Parametre(models.Model):
    """
    Paramètres système configurables par le superviseur.
    """
    cle = models.CharField(max_length=100, unique=True)
    valeur = models.TextField()
    description = models.CharField(max_length=255, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    DEFAULTS = {
        "nom_provenderie":       "PROVENDIX",
        "seuil_alerte_stock":    "500",
        "duree_peremption_pf":   "180",
        "devise":                "XAF",
        "coefficient_transformation": "1.08",
        "marge_vente_mp":        "20",
    }

    def __str__(self):
        return f"{self.cle} = {self.valeur}"

    class Meta:
        verbose_name = "Paramètre"
        verbose_name_plural = "Paramètres"
