import secrets
from django.db import models


class Utilisateur(models.Model):
    ROLE_CHOICES = [
        ("gerant", "Gérant"),
        ("superviseur", "Superviseur"),
        ("admin", "Administrateur"),
    ]

    nom = models.CharField(max_length=100)
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
    key = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def get_or_create(cls, utilisateur):
        try:
            return cls.objects.get(utilisateur=utilisateur), False
        except cls.DoesNotExist:
            token = cls.objects.create(
                utilisateur=utilisateur,
                key=secrets.token_hex(32),
            )
            return token, True

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
    prix_vente = models.FloatField(default=0.0)
    stock_disponible = models.FloatField(default=0.0)
    seuil_alerte = models.FloatField(default=500.0)
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
    prix_unitaire = models.FloatField(default=0.0)
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
        on_delete=models.CASCADE,
        related_name="compositions",
    )
    quantite = models.FloatField()

    def __str__(self):
        return f"{self.formule} - {self.mp}: {self.quantite}"

    class Meta:
        verbose_name = "Composition de Formule"
        verbose_name_plural = "Compositions de Formules"


class LotFournisseur(models.Model):
    STATUT_CHOICES = [
        ("disponible", "Disponible"),
        ("epuise", "Épuisé"),
        ("annule", "Annulé"),
    ]

    mp = models.ForeignKey(
        MP,
        on_delete=models.CASCADE,
        related_name="lots_fournisseurs",
    )
    numero_lot = models.CharField(max_length=100, unique=True)
    fournisseur = models.CharField(max_length=150)
    quantite_initiale = models.FloatField(default=0.0)
    quantite = models.FloatField()
    prix_achat = models.FloatField()
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


class LotPF(models.Model):
    STATUT_CHOICES = [
        ("disponible", "Disponible"),
        ("epuise", "Épuisé"),
        ("perime", "Périmé"),
    ]

    formule = models.ForeignKey(
        Formule,
        on_delete=models.CASCADE,
        related_name="lots_pf",
    )
    numero_lot = models.CharField(max_length=100, unique=True)
    quantite_initiale = models.FloatField(default=0.0)
    quantite = models.FloatField()
    date_production = models.DateField()
    date_peremption = models.DateField()
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="disponible")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Lot PF {self.numero_lot} - {self.formule.nom}"

    class Meta:
        verbose_name = "Lot Produit Fini"


class Production(models.Model):
    STATUT_CHOICES = [
        ("en_attente", "En attente"),
        ("en_cours", "En cours"),
        ("terminee", "Terminée"),
        ("annulee", "Annulée"),
    ]

    formule = models.ForeignKey(
        Formule,
        on_delete=models.CASCADE,
        related_name="productions",
    )
    lot_pf = models.ForeignKey(
        LotPF,
        on_delete=models.CASCADE,
        related_name="production",
        null=True,
        blank=True,
    )
    quantite = models.FloatField()
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


class Commande(models.Model):
    STATUT_CHOICES = [
        ("en_attente", "En attente"),
        ("confirmee", "Confirmée"),
        ("en_preparation", "En préparation"),
        ("livree", "Livrée"),
        ("annulee", "Annulée"),
    ]

    PAIEMENT_CHOICES = [
        ("cash", "Cash"),
        ("credit", "Crédit"),
        ("partiel", "Partiel"),
    ]

    client = models.ForeignKey(
        Client,
        on_delete=models.CASCADE,
        related_name="commandes",
    )
    lot_pf = models.ForeignKey(
        LotPF,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="commandes",
    )
    numero_commande = models.CharField(max_length=100, unique=True)
    quantite = models.FloatField()
    prix_unitaire = models.FloatField()
    montant_total = models.FloatField()
    date_commande = models.DateField(auto_now_add=True)
    date_livraison = models.DateField(null=True, blank=True)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="en_attente")
    # FIX : default "credit" est dans PAIEMENT_CHOICES (l'ancien "non_paye" était invalide)
    statut_paiement = models.CharField(max_length=20, choices=PAIEMENT_CHOICES, default="credit")
    montant_paye = models.FloatField(default=0.0)
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
        if self.lot_pf and self.prix_unitaire:
            cout_production = self.lot_pf.formule.prix_unitaire
            return (self.prix_unitaire - cout_production) * self.quantite
        return 0.0


class Vente(models.Model):
    commande = models.OneToOneField(
        Commande,
        on_delete=models.CASCADE,
        related_name="vente",
        null=True,
        blank=True,
    )
    client = models.ForeignKey(
        Client,
        on_delete=models.CASCADE,
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
    quantite = models.FloatField()
    montant = models.FloatField()
    marge = models.FloatField(default=0.0)

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
    date = models.DateField(auto_now_add=True)
    stocks_mp = models.FloatField(default=0.0)
    stocks_pf = models.FloatField(default=0.0)
    caisse = models.FloatField(default=0.0)
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
    ]

    TYPE_AJUSTEMENT = [
        ("ajout", "Ajout"),
        ("retrait", "Retrait"),
    ]

    type_stock = models.CharField(max_length=10, choices=TYPE_CHOICES)
    mp = models.ForeignKey(
        MP,
        on_delete=models.CASCADE,
        related_name="ajustements",
        null=True,
        blank=True,
    )
    lot_pf = models.ForeignKey(
        LotPF,
        on_delete=models.CASCADE,
        related_name="ajustements",
        null=True,
        blank=True,
    )
    type_ajustement = models.CharField(max_length=20, choices=TYPE_AJUSTEMENT)
    quantite = models.FloatField()
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
        ("ajustement",   "Ajustement inventaire"),
    ]

    mp = models.ForeignKey(
        MP, null=True, blank=True,
        on_delete=models.CASCADE,
        related_name="mouvements",
    )
    lot_pf = models.ForeignKey(
        LotPF, null=True, blank=True,
        on_delete=models.CASCADE,
        related_name="mouvements",
    )
    type_mouvement = models.CharField(max_length=20, choices=TYPE_CHOICES)
    quantite_avant = models.FloatField()
    quantite_delta = models.FloatField()   # positif = entrée, négatif = sortie
    quantite_apres = models.FloatField()
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
        "devise":                "DA",
    }

    def __str__(self):
        return f"{self.cle} = {self.valeur}"

    class Meta:
        verbose_name = "Paramètre"
        verbose_name_plural = "Paramètres"
