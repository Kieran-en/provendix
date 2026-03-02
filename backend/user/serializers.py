from rest_framework import serializers
from .models import (
    Utilisateur, Client, Animal, StadeVie, MP, Formule, CompositionFormule,
    LotFournisseur, LotPF, Production, Commande, Vente, Historique, AjustementStock
)


class UtilisateurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Utilisateur
        fields = ['id', 'nom', 'role', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class UtilisateurCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Utilisateur
        fields = ['nom', 'role', 'password', 'is_active']

    def create(self, validated_data):
        password = validated_data.pop('password')
        utilisateur = Utilisateur.objects.create(**validated_data)
        from django.contrib.auth.hashers import make_password
        utilisateur.password = make_password(password)
        utilisateur.save()
        return utilisateur


class LoginSerializer(serializers.Serializer):
    nom = serializers.CharField()
    password = serializers.CharField()


class ClientSerializer(serializers.ModelSerializer):
    cree_par_nom = serializers.CharField(source='cree_par.nom', read_only=True)

    class Meta:
        model = Client
        fields = ['id', 'nom_client', 'contact', 'annees_experience', 'cree_par', 'cree_par_nom', 'created_at', 'updated_at']
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
    cree_par_nom = serializers.CharField(source='cree_par.nom', read_only=True)

    class Meta:
        model = MP
        fields = ['id', 'nom', 'unite', 'prix_vente', 'stock_disponible', 'cree_par', 'cree_par_nom', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class CompositionFormuleSerializer(serializers.ModelSerializer):
    mp_nom = serializers.CharField(source='mp.nom', read_only=True)

    class Meta:
        model = CompositionFormule
        fields = ['id', 'mp', 'mp_nom', 'quantite']


class FormuleSerializer(serializers.ModelSerializer):
    stade_vie_nom = serializers.CharField(source='stade_vie.nom', read_only=True)
    cree_par_nom = serializers.CharField(source='cree_par.nom', read_only=True)
    compositions = CompositionFormuleSerializer(many=True, read_only=True)

    class Meta:
        model = Formule
        fields = ['id', 'nom', 'code', 'stade_vie', 'stade_vie_nom', 'prix_unitaire', 'cree_par', 'cree_par_nom', 'compositions', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class FormuleCreateSerializer(serializers.ModelSerializer):
    compositions = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False
    )

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

    class Meta:
        model = LotFournisseur
        fields = ['id', 'mp', 'mp_nom', 'numero_lot', 'fournisseur', 'quantite', 'prix_achat', 
                  'date_reception', 'date_peremption', 'statut', 'cree_par', 'cree_par_nom', 'created_at']
        read_only_fields = ['created_at']


class LotPFSerializer(serializers.ModelSerializer):
    formule_nom = serializers.CharField(source='formule.nom', read_only=True)
    formule_code = serializers.CharField(source='formule.code', read_only=True)

    class Meta:
        model = LotPF
        fields = ['id', 'formule', 'formule_nom', 'formule_code', 'numero_lot', 'quantite', 
                  'date_production', 'date_peremption', 'statut', 'created_at']
        read_only_fields = ['created_at']


class ProductionSerializer(serializers.ModelSerializer):
    formule_nom = serializers.CharField(source='formule.nom', read_only=True)
    formule_code = serializers.CharField(source='formule.code', read_only=True)
    lot_pf_numero = serializers.CharField(source='lot_pf.numero_lot', read_only=True)
    cree_par_nom = serializers.CharField(source='cree_par.nom', read_only=True)

    class Meta:
        model = Production
        fields = ['id', 'formule', 'formule_nom', 'formule_code', 'lot_pf', 'lot_pf_numero', 
                  'quantite', 'date_prevue', 'date_production', 'statut', 'cree_par', 'cree_par_nom', 
                  'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class CommandeSerializer(serializers.ModelSerializer):
    client_nom = serializers.CharField(source='client.nom_client', read_only=True)
    lot_pf_numero = serializers.CharField(source='lot_pf.numero_lot', read_only=True)
    cree_par_nom = serializers.CharField(source='cree_par.nom', read_only=True)
    marge = serializers.SerializerMethodField()

    class Meta:
        model = Commande
        fields = ['id', 'client', 'client_nom', 'lot_pf', 'lot_pf_numero', 'numero_commande', 
                  'quantite', 'prix_unitaire', 'montant_total', 'date_commande', 'date_livraison', 
                  'statut', 'statut_paiement', 'montant_paye', 'cree_par', 'cree_par_nom', 
                  'marge', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

    def get_marge(self, obj):
        return obj.calculer_marge()


class CommandeCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Commande
        fields = ['client', 'lot_pf', 'quantite', 'prix_unitaire', 'montant_total', 'date_livraison']

    def create(self, validated_data):
        validated_data['montant_total'] = validated_data['quantite'] * validated_data['prix_unitaire']
        return super().create(validated_data)


class PaiementSerializer(serializers.Serializer):
    montant = serializers.FloatField(min_value=0.01)


class VenteSerializer(serializers.ModelSerializer):
    client_nom = serializers.CharField(source='client.nom_client', read_only=True)
    utilisateur_nom = serializers.CharField(source='utilisateur.nom', read_only=True)

    class Meta:
        model = Vente
        fields = ['id', 'commande', 'client', 'client_nom', 'utilisateur', 'utilisateur_nom', 
                  'date', 'quantite', 'montant', 'marge']


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
        fields = ['id', 'type_stock', 'mp', 'mp_nom', 'lot_pf', 'lot_pf_numero', 
                  'type_ajustement', 'quantite', 'justification', 'cree_par', 'cree_par_nom', 'created_at']
        read_only_fields = ['created_at']