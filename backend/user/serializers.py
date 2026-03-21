from rest_framework import serializers
from .models import (
    Utilisateur, Client, Animal, StadeVie, MP, Formule, CompositionFormule,
    LotFournisseur, LotPF, Production, Commande, Vente, Historique,
    AjustementStock, MouvementStock, LogActivite, Parametre,
)


class UtilisateurSerializer(serializers.ModelSerializer):
    login = serializers.CharField(source='nom', read_only=True)

    class Meta:
        model = Utilisateur
        fields = ['id', 'nom', 'login', 'role', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class UtilisateurCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Utilisateur
        fields = ['nom', 'role', 'password', 'is_active']

    def create(self, validated_data):
        from django.contrib.auth.hashers import make_password
        password = validated_data.pop('password')
        utilisateur = Utilisateur.objects.create(**validated_data)
        utilisateur.password = make_password(password)
        utilisateur.save()
        return utilisateur


class LoginSerializer(serializers.Serializer):
    login = serializers.CharField()
    mot_de_passe = serializers.CharField()


class ClientSerializer(serializers.ModelSerializer):
    nom = serializers.CharField(source='nom_client')
    annees_elevage = serializers.IntegerField(source='annees_experience', required=False, default=0)
    cree_par_nom = serializers.CharField(source='cree_par.nom', read_only=True)

    class Meta:
        model = Client
        fields = [
            'id', 'nom', 'contact', 'adresse', 'annees_elevage', 'animaux_eleves',
            'cree_par', 'cree_par_nom', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class AnimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Animal
        fields = ['id', 'nom', 'created_at']


class StadeVieSerializer(serializers.ModelSerializer):
    animal_nom = serializers.CharField(source='animal.nom', read_only=True)

    class Meta:
        model = StadeVie
        fields = ['id', 'nom', 'animal', 'animal_nom', 'created_at']


class MPSerializer(serializers.ModelSerializer):
    quantite = serializers.FloatField(source='stock_disponible', read_only=True)
    prix_kg = serializers.FloatField(source='prix_vente')
    cree_par_nom = serializers.CharField(source='cree_par.nom', read_only=True)

    class Meta:
        model = MP
        fields = [
            'id', 'nom', 'unite', 'prix_kg', 'prix_vente', 'quantite', 'stock_disponible',
            'seuil_alerte', 'cree_par', 'cree_par_nom', 'created_at', 'updated_at',
        ]
        read_only_fields = ['stock_disponible', 'quantite', 'created_at', 'updated_at']


class CompositionFormuleSerializer(serializers.ModelSerializer):
    mp_nom = serializers.CharField(source='mp.nom', read_only=True)
    matiere_premiere_id = serializers.IntegerField(source='mp_id', read_only=True)

    class Meta:
        model = CompositionFormule
        fields = ['id', 'mp', 'matiere_premiere_id', 'mp_nom', 'quantite']


class FormuleSerializer(serializers.ModelSerializer):
    stade_vie_nom = serializers.CharField(source='stade_vie.nom', read_only=True)
    cree_par_nom = serializers.CharField(source='cree_par.nom', read_only=True)
    compositions = CompositionFormuleSerializer(many=True, read_only=True)

    class Meta:
        model = Formule
        fields = [
            'id', 'nom', 'code', 'stade_vie', 'stade_vie_nom', 'prix_unitaire',
            'cree_par', 'cree_par_nom', 'compositions', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class FormuleCreateSerializer(serializers.ModelSerializer):
    compositions = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False
    )
    stade_vie = serializers.PrimaryKeyRelatedField(
        queryset=StadeVie.objects.all(), required=False, allow_null=True
    )
    prix_unitaire = serializers.FloatField(required=False, default=0.0)

    class Meta:
        model = Formule
        fields = ['nom', 'code', 'stade_vie', 'prix_unitaire', 'compositions']

    def create(self, validated_data):
        compositions_data = validated_data.pop('compositions', [])
        formule = Formule.objects.create(**validated_data)
        for comp in compositions_data:
            CompositionFormule.objects.create(
                formule=formule,
                mp_id=comp['mp_id'],
                quantite=comp['quantite']
            )
        return formule

    def update(self, instance, validated_data):
        compositions_data = validated_data.pop('compositions', None)
        instance = super().update(instance, validated_data)
        if compositions_data is not None:
            instance.compositions.all().delete()
            for comp in compositions_data:
                CompositionFormule.objects.create(
                    formule=instance,
                    mp_id=comp['mp_id'],
                    quantite=comp['quantite']
                )
        return instance


class LotFournisseurSerializer(serializers.ModelSerializer):
    mp_nom = serializers.CharField(source='mp.nom', read_only=True)
    cree_par_nom = serializers.CharField(source='cree_par.nom', read_only=True)
    matiere_premiere_id = serializers.IntegerField(source='mp_id', read_only=True)
    cout_kg = serializers.FloatField(source='prix_achat', read_only=True)
    quantite_restante = serializers.FloatField(source='quantite', read_only=True)

    class Meta:
        model = LotFournisseur
        fields = [
            'id', 'mp', 'matiere_premiere_id', 'mp_nom',
            'numero_lot', 'fournisseur',
            'quantite_initiale', 'quantite', 'quantite_restante',
            'prix_achat', 'cout_kg',
            'date_reception', 'date_peremption', 'statut',
            'cree_par', 'cree_par_nom', 'created_at',
        ]
        read_only_fields = ['created_at', 'quantite_initiale']


class LotPFSerializer(serializers.ModelSerializer):
    formule_nom = serializers.CharField(source='formule.nom', read_only=True)
    formule_code = serializers.CharField(source='formule.code', read_only=True)
    quantite_restante = serializers.FloatField(source='quantite', read_only=True)
    cout_revient = serializers.FloatField(source='formule.prix_unitaire', read_only=True)
    date_creation = serializers.DateField(source='date_production', read_only=True)
    production_id = serializers.SerializerMethodField()
    formule_detail = serializers.SerializerMethodField()
    taux_ecoulement = serializers.SerializerMethodField()

    class Meta:
        model = LotPF
        fields = [
            'id', 'formule', 'formule_nom', 'formule_code', 'formule_detail',
            'numero_lot', 'quantite_initiale', 'quantite', 'quantite_restante',
            'cout_revient', 'date_production', 'date_creation', 'date_peremption',
            'statut', 'production_id', 'taux_ecoulement', 'created_at',
        ]
        read_only_fields = ['created_at', 'quantite_initiale']

    def get_production_id(self, obj):
        prod = obj.production.first()
        return prod.id if prod else None

    def get_formule_detail(self, obj):
        return {'id': obj.formule.id, 'nom': obj.formule.nom, 'code': obj.formule.code}

    def get_taux_ecoulement(self, obj):
        """Pourcentage vendu du lot (0-100)."""
        if obj.quantite_initiale and obj.quantite_initiale > 0:
            vendu = obj.quantite_initiale - obj.quantite
            return round((vendu / obj.quantite_initiale) * 100, 1)
        return 0.0


class ProductionSerializer(serializers.ModelSerializer):
    formule_nom = serializers.CharField(source='formule.nom', read_only=True)
    formule_code = serializers.CharField(source='formule.code', read_only=True)
    lot_pf_detail = serializers.SerializerMethodField()
    cree_par_nom = serializers.CharField(source='cree_par.nom', read_only=True)
    date_prevue = serializers.DateField(required=False, allow_null=True)
    date = serializers.DateField(source='date_production', read_only=True)

    class Meta:
        model = Production
        fields = [
            'id', 'formule', 'formule_nom', 'formule_code',
            'lot_pf', 'lot_pf_detail',
            'quantite', 'date', 'date_prevue', 'date_production', 'statut',
            'cree_par', 'cree_par_nom', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_lot_pf_detail(self, obj):
        if not obj.lot_pf:
            return None
        lp = obj.lot_pf
        return {
            'id': lp.id,
            'numero_lot': lp.numero_lot,
            'quantite_initiale': lp.quantite_initiale,
            'quantite': lp.quantite,
            'quantite_restante': lp.quantite,
            'cout_revient': lp.formule.prix_unitaire,
            'date_production': str(lp.date_production),
            'date_peremption': str(lp.date_peremption),
            'statut': lp.statut,
        }


class CommandeSerializer(serializers.ModelSerializer):
    client_nom = serializers.CharField(source='client.nom_client', read_only=True)
    lot_pf_numero = serializers.CharField(source='lot_pf.numero_lot', read_only=True)
    cree_par_nom = serializers.CharField(source='cree_par.nom', read_only=True)
    marge = serializers.SerializerMethodField()
    montant = serializers.FloatField(source='montant_total', read_only=True)
    reste_a_payer = serializers.SerializerMethodField()

    class Meta:
        model = Commande
        fields = [
            'id', 'client', 'client_nom', 'lot_pf', 'lot_pf_numero',
            'numero_commande', 'quantite', 'prix_unitaire',
            'montant', 'montant_total', 'montant_paye', 'reste_a_payer',
            'date_commande', 'date_livraison',
            'statut', 'statut_paiement',
            'cree_par', 'cree_par_nom', 'marge', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_marge(self, obj):
        return obj.calculer_marge()

    def get_reste_a_payer(self, obj):
        return max(0.0, obj.montant_total - obj.montant_paye)


class CommandeCreateSerializer(serializers.ModelSerializer):
    client_id = serializers.PrimaryKeyRelatedField(
        queryset=Client.objects.all(), source='client'
    )
    lot_pf_id = serializers.PrimaryKeyRelatedField(
        queryset=LotPF.objects.all(), source='lot_pf', required=False, allow_null=True
    )

    class Meta:
        model = Commande
        fields = ['client_id', 'lot_pf_id', 'quantite', 'prix_unitaire', 'statut_paiement', 'date_livraison']

    def validate_statut_paiement(self, value):
        allowed = ['cash', 'credit', 'partiel']
        if value not in allowed:
            raise serializers.ValidationError(f"Valeur invalide. Choisir parmi : {allowed}")
        return value


class PaiementSerializer(serializers.Serializer):
    montant = serializers.FloatField(min_value=0.01)


class VenteSerializer(serializers.ModelSerializer):
    client_nom = serializers.CharField(source='client.nom_client', read_only=True)
    utilisateur_nom = serializers.CharField(source='utilisateur.nom', read_only=True)

    class Meta:
        model = Vente
        fields = [
            'id', 'commande', 'client', 'client_nom',
            'utilisateur', 'utilisateur_nom',
            'date', 'quantite', 'montant', 'marge',
        ]


class HistoriqueSerializer(serializers.ModelSerializer):
    cree_par_nom = serializers.CharField(source='cree_par.nom', read_only=True)

    class Meta:
        model = Historique
        fields = ['id', 'vente', 'date', 'stocks_mp', 'stocks_pf', 'caisse', 'cree_par', 'cree_par_nom']


class AjustementStockSerializer(serializers.ModelSerializer):
    mp_nom = serializers.CharField(source='mp.nom', read_only=True)
    lot_pf_numero = serializers.CharField(source='lot_pf.numero_lot', read_only=True)
    cree_par_nom = serializers.CharField(source='cree_par.nom', read_only=True)

    class Meta:
        model = AjustementStock
        fields = [
            'id', 'type_stock', 'mp', 'mp_nom', 'lot_pf', 'lot_pf_numero',
            'type_ajustement', 'quantite', 'justification',
            'cree_par', 'cree_par_nom', 'created_at',
        ]
        read_only_fields = ['created_at']


# ─────────────────────────────────────────────────────────────
# NOUVEAUX SERIALIZERS
# ─────────────────────────────────────────────────────────────

class MouvementStockSerializer(serializers.ModelSerializer):
    mp_nom = serializers.CharField(source='mp.nom', read_only=True)
    lot_pf_numero = serializers.CharField(source='lot_pf.numero_lot', read_only=True)
    cree_par_nom = serializers.CharField(source='cree_par.nom', read_only=True)
    type_mouvement_label = serializers.CharField(source='get_type_mouvement_display', read_only=True)

    class Meta:
        model = MouvementStock
        fields = [
            'id', 'mp', 'mp_nom', 'lot_pf', 'lot_pf_numero',
            'type_mouvement', 'type_mouvement_label',
            'quantite_avant', 'quantite_delta', 'quantite_apres',
            'reference_id', 'reference_type',
            'cree_par', 'cree_par_nom', 'created_at',
        ]
        read_only_fields = ['created_at']


class LogActiviteSerializer(serializers.ModelSerializer):
    utilisateur_nom = serializers.CharField(source='utilisateur.nom', read_only=True)
    utilisateur_role = serializers.CharField(source='utilisateur.role', read_only=True)
    action_label = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = LogActivite
        fields = [
            'id', 'utilisateur', 'utilisateur_nom', 'utilisateur_role',
            'action', 'action_label', 'module', 'objet_id',
            'description', 'ip_address', 'created_at',
        ]
        read_only_fields = ['created_at']


class ParametreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Parametre
        fields = ['id', 'cle', 'valeur', 'description', 'updated_at']
        read_only_fields = ['updated_at']
