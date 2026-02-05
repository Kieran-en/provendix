from django.shortcuts import render

# Create your views here.
from django.db import models


class Utilisateur(models.Model):
    ROLE_CHOICES = [
        ("admin", "Administrateur"),
        ("user", "Utilisateur"),
    ]

    nom = models.CharField(max_length=100)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="user")
    password = models.CharField(max_length=128)  # idéalement : hashé

    def __str__(self):
        return self.nom


class Client(models.Model):
    nom_client = models.CharField(max_length=150)
    contact = models.CharField(max_length=150)
    annees_experience = models.PositiveIntegerField()
    cree_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="clients_enregistres",
    )

    def __str__(self):
        return self.nom_client


class Animal(models.Model):
    nom = models.CharField(max_length=100)

    def __str__(self):
        return self.nom


class StadeVie(models.Model):
    nom = models.CharField(max_length=100)
    animal = models.ForeignKey(
        Animal,
        on_delete=models.CASCADE,
        related_name="stades_vie",
    )

    def __str__(self):
        return f"{self.animal} - {self.nom}"


class Formule(models.Model):
    nom = models.CharField(max_length=150)
    code = models.CharField(max_length=50, unique=True)
    stade_vie = models.ForeignKey(
        StadeVie,
        on_delete=models.CASCADE,
        related_name="formules",
    )
    cree_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="formules_enregistrees",
    )

    def __str__(self):
        return self.nom


class MP(models.Model):
    nom = models.CharField(max_length=150)
    quantite_entree = models.FloatField()
    fournisseur = models.CharField(max_length=150)
    prix_entree = models.FloatField()
    date_entree = models.DateField()
    prix_vente = models.FloatField()
    stock_disponible = models.FloatField()
    formule = models.ForeignKey(
        Formule,
        on_delete=models.CASCADE,
        related_name="materiaux_premiers",
    )
    cree_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mp_enregistrees",
    )

    def __str__(self):
        return self.nom


class Vente(models.Model):
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
    date = models.DateField()
    quantite = models.FloatField()
    montant = models.FloatField()

    def __str__(self):
        return f"Vente #{self.id} - {self.client}"


class Historique(models.Model):
    vente = models.ForeignKey(
        Vente,
        on_delete=models.CASCADE,
        related_name="historiques",
    )
    date = models.DateField()
    stocks = models.FloatField()
    caisse = models.FloatField()
    cree_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="historiques_enregistres",
    )

    def __str__(self):
        return f"Historique {self.date}"