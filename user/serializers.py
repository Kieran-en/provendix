from rest_framework import serializers
from auditlog.models import LogEntry
from decimal import Decimal
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from .models import (
    Utilisateur, Client, Animal, StadeVie, MP, Accessoire, Formule, CompositionFormule,
    LotFournisseur, LotPF, Production, Commande, Vente, Historique,
    AjustementStock, MouvementStock, Parametre, Paiement, LotConsommation,
)


class UtilisateurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Utilisateur
        fields = ['id', 'nom', 'login', 'role', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'login']


class UtilisateurCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model = Utilisateur
        fields = ['id', 'nom', 'login', 'role', 'password', 'is_active']

    def validate_login(self, value):
        value = value.strip().lower()
        if Utilisateur.objects.filter(login__iexact=value).exists():
            raise serializers.ValidationError('Cet identifiant est déjà utilisé.')
        return value

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def create(self, validated_data):
        from django.contrib.auth.hashers import make_password
        password = validated_data.pop('password')
        utilisateur = Utilisateur.objects.create(**validated_data)
        utilisateur.password = make_password(password)
        utilisateur.save()
        return utilisateur


class LoginSerializer(serializers.Serializer):
    login = serializers.CharField()
    mot_de_passe = serializers.CharField(write_only=True, trim_whitespace=False)


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
        read_only_fields = ['cree_par', 'created_at', 'updated_at']


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
    prix_achat = serializers.DecimalField(
        source='prix_achat_moyen', max_digits=18, decimal_places=2,
        min_value=Decimal('0.01'), write_only=True,
    )
    prix_kg = serializers.DecimalField(source='prix_vente', max_digits=18, decimal_places=2, read_only=True)
    prix_vente = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    cree_par_nom = serializers.CharField(source='cree_par.nom', read_only=True)

    class Meta:
        model = MP
        fields = [
            'id', 'nom', 'unite', 'prix_achat', 'prix_achat_moyen', 'prix_kg', 'prix_vente',
            'quantite', 'stock_disponible', 'seuil_alerte', 'actif',
            'cree_par', 'cree_par_nom', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'prix_achat_moyen', 'prix_vente', 'stock_disponible', 'quantite',
            'cree_par', 'created_at', 'updated_at',
        ]

    @staticmethod
    def _prix_vente(prix_achat):
        try:
            marge = Decimal(Parametre.objects.get(cle='marge_vente_mp').valeur)
        except (Parametre.DoesNotExist, ValueError, TypeError):
            marge = Decimal(Parametre.DEFAULTS['marge_vente_mp'])
        return (prix_achat * (Decimal('1') + marge / Decimal('100'))).quantize(Decimal('0.01'))

    def create(self, validated_data):
        validated_data['prix_vente'] = self._prix_vente(validated_data['prix_achat_moyen'])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        prix_achat = validated_data.get('prix_achat_moyen', instance.prix_achat_moyen)
        validated_data['prix_vente'] = self._prix_vente(prix_achat)
        return super().update(instance, validated_data)


class AccessoireSerializer(serializers.ModelSerializer):
    cree_par_nom = serializers.CharField(source='cree_par.nom', read_only=True)
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Accessoire
        fields = [
            'id', 'nom', 'description', 'unite', 'photo', 'photo_url',
            'prix_achat', 'prix_vente', 'stock_disponible', 'seuil_alerte', 'actif',
            'cree_par', 'cree_par_nom', 'created_at', 'updated_at',
        ]
        read_only_fields = ['cree_par', 'created_at', 'updated_at']
        extra_kwargs = {
            'prix_achat': {'min_value': Decimal('0')},
            'prix_vente': {'min_value': Decimal('0.01')},
            'stock_disponible': {'min_value': Decimal('0')},
            'seuil_alerte': {'min_value': Decimal('0')},
        }

    def get_photo_url(self, obj):
        if not obj.photo:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url

    def create(self, validated_data):
        if 'actif' not in self.initial_data:
            validated_data['actif'] = True
        return super().create(validated_data)

    def validate_photo(self, value):
        if value and value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('La photo ne doit pas dépasser 5 Mo.')
        content_type = getattr(value, 'content_type', '')
        if value and content_type not in {'image/jpeg', 'image/png', 'image/webp'}:
            raise serializers.ValidationError('Utilisez une image JPEG, PNG ou WebP.')
        return value


class CompositionFormuleSerializer(serializers.ModelSerializer):
    mp_nom = serializers.CharField(source='mp.nom', read_only=True)
    matiere_premiere_id = serializers.IntegerField(source='mp_id', read_only=True)

    class Meta:
        model = CompositionFormule
        fields = ['id', 'mp', 'matiere_premiere_id', 'mp_nom', 'pourcentage']


class CompositionInputSerializer(serializers.Serializer):
    mp_id = serializers.PrimaryKeyRelatedField(queryset=MP.objects.all(), source='mp')
    pourcentage = serializers.DecimalField(
        max_digits=6, decimal_places=3,
        min_value=Decimal('0.001'), max_value=Decimal('100')
    )


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
    compositions = CompositionInputSerializer(many=True, write_only=True, required=True)
    stade_vie = serializers.PrimaryKeyRelatedField(
        queryset=StadeVie.objects.all(), required=False, allow_null=True
    )
    prix_unitaire = serializers.DecimalField(
        max_digits=18, decimal_places=2, read_only=True
    )

    class Meta:
        model = Formule
        fields = ['nom', 'code', 'stade_vie', 'prix_unitaire', 'compositions']

    def validate_compositions(self, value):
        if not value:
            raise serializers.ValidationError('Ajoutez au moins un ingrédient.')
        mp_ids = [item['mp'].pk for item in value]
        if len(mp_ids) != len(set(mp_ids)):
            raise serializers.ValidationError('Une matière première ne peut apparaître qu’une fois.')
        total = sum((item['pourcentage'] for item in value), Decimal('0'))
        if total != Decimal('100.000'):
            raise serializers.ValidationError(
                f'La composition doit totaliser exactement 100 % (total actuel : {total} %).'
            )
        return value

    @staticmethod
    def _cout_reference(compositions):
        try:
            coefficient = Decimal(
                Parametre.objects.get(cle='coefficient_transformation').valeur
            )
        except (Parametre.DoesNotExist, ValueError, TypeError):
            coefficient = Decimal(Parametre.DEFAULTS['coefficient_transformation'])
        cout_matieres = sum(
            (item['mp'].prix_achat_moyen * item['pourcentage'] for item in compositions),
            Decimal('0'),
        ) / Decimal('100')
        return (cout_matieres * coefficient).quantize(Decimal('0.01'))

    @transaction.atomic
    def create(self, validated_data):
        compositions_data = validated_data.pop('compositions')
        formule = Formule.objects.create(
            prix_unitaire=self._cout_reference(compositions_data), **validated_data
        )
        for comp in compositions_data:
            CompositionFormule.objects.create(formule=formule, **comp)
        return formule

    @transaction.atomic
    def update(self, instance, validated_data):
        compositions_data = validated_data.pop('compositions')
        validated_data['prix_unitaire'] = self._cout_reference(compositions_data)
        instance = super().update(instance, validated_data)
        instance.compositions.all().delete()
        for comp in compositions_data:
            CompositionFormule.objects.create(formule=instance, **comp)
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
        read_only_fields = [
            'created_at', 'quantite_initiale', 'quantite', 'statut', 'cree_par'
        ]


class LotFournisseurCreateSerializer(serializers.Serializer):
    matiere_premiere_id = serializers.PrimaryKeyRelatedField(
        queryset=MP.objects.all(), source='mp'
    )
    quantite_initiale = serializers.DecimalField(
        source='quantite',
        max_digits=16, decimal_places=3, min_value=Decimal('0.001')
    )
    cout_kg = serializers.DecimalField(
        max_digits=18, decimal_places=2, min_value=Decimal('0')
    )
    numero_lot = serializers.CharField(max_length=100, required=False, allow_blank=True)
    fournisseur = serializers.CharField(max_length=150)
    date_reception = serializers.DateField(required=False, default=timezone.localdate)
    date_peremption = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs['date_reception'] > timezone.localdate():
            raise serializers.ValidationError({
                'date_reception': 'La date de réception ne peut pas être future.'
            })
        expiration = attrs.get('date_peremption')
        if expiration and expiration < attrs['date_reception']:
            raise serializers.ValidationError({
                'date_peremption': 'La péremption doit être postérieure à la réception.'
            })
        return attrs


class LotPFSerializer(serializers.ModelSerializer):
    formule_nom = serializers.CharField(source='formule.nom', read_only=True)
    formule_code = serializers.CharField(source='formule.code', read_only=True)
    quantite_restante = serializers.FloatField(source='quantite', read_only=True)
    cout_revient = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
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
        try:
            return obj.production.first().id
        except AttributeError:
            return None

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
    consommations_lots = serializers.SerializerMethodField()

    class Meta:
        model = Production
        fields = [
            'id', 'formule', 'formule_nom', 'formule_code',
            'lot_pf', 'lot_pf_detail',
            'quantite', 'date', 'date_prevue', 'date_production', 'statut',
            'cree_par', 'cree_par_nom', 'consommations_lots', 'created_at', 'updated_at',
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
            'cout_revient': lp.cout_revient,
            'date_production': str(lp.date_production),
            'date_peremption': str(lp.date_peremption),
            'statut': lp.statut,
        }

    def get_consommations_lots(self, obj):
        return [
            {
                'lot_fournisseur_id': allocation.lot_fournisseur_id,
                'numero_lot': allocation.lot_fournisseur.numero_lot,
                'matiere_premiere': allocation.lot_fournisseur.mp.nom,
                'quantite': allocation.quantite,
                'cout_unitaire': allocation.cout_unitaire,
            }
            for allocation in obj.consommations_lots.select_related(
                'lot_fournisseur', 'lot_fournisseur__mp'
            ).all()
        ]


class ProductionCreateSerializer(serializers.Serializer):
    formule = serializers.PrimaryKeyRelatedField(queryset=Formule.objects.all())
    quantite = serializers.DecimalField(
        max_digits=16, decimal_places=3, min_value=Decimal('0.001')
    )


class CommandeSerializer(serializers.ModelSerializer):
    client_nom = serializers.CharField(source='client.nom_client', read_only=True)
    lot_pf_numero = serializers.CharField(source='lot_pf.numero_lot', read_only=True, allow_null=True)
    matiere_premiere_id = serializers.IntegerField(source='mp_id', read_only=True, allow_null=True)
    accessoire_id = serializers.IntegerField(read_only=True, allow_null=True)
    produit_nom = serializers.CharField(read_only=True)
    unite = serializers.CharField(source='unite_produit', read_only=True)
    cree_par_nom = serializers.CharField(source='cree_par.nom', read_only=True)
    marge = serializers.SerializerMethodField()
    montant = serializers.FloatField(source='montant_total', read_only=True)
    reste_a_payer = serializers.SerializerMethodField()
    paiements = serializers.SerializerMethodField()

    class Meta:
        model = Commande
        fields = [
            'id', 'client', 'client_nom', 'type_produit', 'produit_nom', 'unite',
            'lot_pf', 'lot_pf_numero', 'matiere_premiere_id', 'accessoire_id',
            'numero_commande', 'quantite', 'prix_unitaire', 'cout_unitaire',
            'montant', 'montant_total', 'montant_paye', 'reste_a_payer',
            'date_commande', 'date_livraison',
            'statut', 'mode_paiement', 'statut_paiement', 'paiements',
            'cree_par', 'cree_par_nom', 'marge', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_marge(self, obj):
        return obj.calculer_marge()

    def get_reste_a_payer(self, obj):
        return max(Decimal('0'), obj.montant_total - obj.montant_paye)

    def get_paiements(self, obj):
        return PaiementSerializer(obj.paiements.all(), many=True).data


class CommandeCreateSerializer(serializers.Serializer):
    client_id = serializers.PrimaryKeyRelatedField(
        queryset=Client.objects.all(), source='client'
    )
    type_produit = serializers.ChoiceField(choices=Commande.TYPE_PRODUIT_CHOICES)
    lot_pf_id = serializers.PrimaryKeyRelatedField(
        queryset=LotPF.objects.all(), source='lot_pf', required=False, allow_null=True
    )
    matiere_premiere_id = serializers.PrimaryKeyRelatedField(
        queryset=MP.objects.all(), source='mp', required=False, allow_null=True
    )
    accessoire_id = serializers.PrimaryKeyRelatedField(
        queryset=Accessoire.objects.all(), source='accessoire', required=False, allow_null=True
    )
    quantite = serializers.DecimalField(
        max_digits=16, decimal_places=3, min_value=Decimal('0.001')
    )
    prix_unitaire = serializers.DecimalField(
        max_digits=18, decimal_places=2, min_value=Decimal('0.01'), required=False
    )
    mode_paiement = serializers.ChoiceField(choices=Commande.MODE_PAIEMENT_CHOICES, default='cash')
    montant_paye_initial = serializers.DecimalField(
        max_digits=18, decimal_places=2, min_value=Decimal('0'),
        required=False, default=Decimal('0'), write_only=True,
    )

    date_livraison = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs):
        type_produit = attrs['type_produit']
        targets = {
            'pf': attrs.get('lot_pf'),
            'mp': attrs.get('mp'),
            'accessoire': attrs.get('accessoire'),
        }
        if not targets[type_produit] or sum(value is not None for value in targets.values()) != 1:
            raise serializers.ValidationError('Sélectionnez exactement un produit correspondant au type de vente.')

        if type_produit == 'pf':
            lot = targets['pf']
            if lot.statut != 'disponible' or lot.date_peremption < timezone.localdate():
                raise serializers.ValidationError({'lot_pf_id': 'Ce lot n’est pas disponible.'})
            if 'prix_unitaire' not in attrs:
                raise serializers.ValidationError({'prix_unitaire': 'Le prix de vente est requis.'})
        elif type_produit == 'mp':
            mp = targets['mp']
            if not mp.actif:
                raise serializers.ValidationError({'matiere_premiere_id': 'Cette matière première est archivée.'})
            if mp.prix_vente <= 0:
                raise serializers.ValidationError({'matiere_premiere_id': 'Le prix de vente automatique est invalide.'})
            attrs['prix_unitaire'] = mp.prix_vente
        else:
            accessoire = targets['accessoire']
            if not accessoire.actif:
                raise serializers.ValidationError({'accessoire_id': 'Cet accessoire est archivé.'})
            attrs['prix_unitaire'] = accessoire.prix_vente

        initial = attrs.get('montant_paye_initial', Decimal('0'))
        total = attrs['quantite'] * attrs['prix_unitaire']
        if initial > total:
            raise serializers.ValidationError({'montant_paye_initial': 'Le montant payé dépasse le total.'})
        if attrs.get('mode_paiement', 'cash') == 'cash' and initial not in (Decimal('0'), total):
            raise serializers.ValidationError({'montant_paye_initial': 'Un paiement comptant doit être intégral.'})
        return attrs


class PaiementSerializer(serializers.ModelSerializer):
    montant = serializers.DecimalField(
        max_digits=18, decimal_places=2, min_value=Decimal('0.01')
    )

    class Meta:
        model = Paiement
        fields = ['id', 'montant', 'created_at']
        read_only_fields = ['id', 'created_at']


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
    accessoire_nom = serializers.CharField(source='accessoire.nom', read_only=True)
    cree_par_nom = serializers.CharField(source='cree_par.nom', read_only=True)

    class Meta:
        model = AjustementStock
        fields = [
            'id', 'type_stock', 'mp', 'mp_nom', 'lot_pf', 'lot_pf_numero',
            'accessoire', 'accessoire_nom',
            'type_ajustement', 'quantite', 'justification',
            'cree_par', 'cree_par_nom', 'created_at',
        ]
        read_only_fields = ['cree_par', 'created_at']

    def validate_quantite(self, value):
        if value <= 0:
            raise serializers.ValidationError('La quantité doit être strictement positive.')
        return value

    def validate_justification(self, value):
        value = value.strip()
        if len(value) < 5:
            raise serializers.ValidationError('La justification doit contenir au moins 5 caractères.')
        return value

    def validate(self, attrs):
        type_stock = attrs.get('type_stock')
        mp = attrs.get('mp')
        lot_pf = attrs.get('lot_pf')
        accessoire = attrs.get('accessoire')
        if type_stock == 'mp' and (not mp or lot_pf or accessoire):
            raise serializers.ValidationError('Une cible MP unique est requise.')
        if type_stock == 'pf' and (not lot_pf or mp or accessoire):
            raise serializers.ValidationError('Un lot PF unique est requis.')
        if type_stock == 'accessoire' and (not accessoire or mp or lot_pf):
            raise serializers.ValidationError('Un accessoire unique est requis.')
        target_qty = (
            mp.stock_disponible if mp else
            lot_pf.quantite if lot_pf else
            accessoire.stock_disponible
        )
        if attrs.get('type_ajustement') == 'retrait' and attrs['quantite'] > target_qty:
            raise serializers.ValidationError({'quantite': 'Le retrait dépasse le stock disponible.'})
        return attrs


# ─────────────────────────────────────────────────────────────
# NOUVEAUX SERIALIZERS
# ─────────────────────────────────────────────────────────────

class MouvementStockSerializer(serializers.ModelSerializer):
    mp_nom = serializers.CharField(source='mp.nom', read_only=True)
    lot_pf_numero = serializers.CharField(source='lot_pf.numero_lot', read_only=True)
    accessoire_nom = serializers.CharField(source='accessoire.nom', read_only=True)
    cree_par_nom = serializers.CharField(source='cree_par.nom', read_only=True)
    type_mouvement_label = serializers.CharField(source='get_type_mouvement_display', read_only=True)

    class Meta:
        model = MouvementStock
        fields = [
            'id', 'mp', 'mp_nom', 'lot_pf', 'lot_pf_numero',
            'accessoire', 'accessoire_nom',
            'type_mouvement', 'type_mouvement_label',
            'quantite_avant', 'quantite_delta', 'quantite_apres',
            'reference_id', 'reference_type',
            'cree_par', 'cree_par_nom', 'created_at',
        ]
        read_only_fields = ['created_at']


# ─────────────────────────────────────────────────────────────
# Journal d'audit (django-auditlog)
# ─────────────────────────────────────────────────────────────

# Correspondances lisibles pour l'interface
_ACTION_MAP = {
    LogEntry.Action.CREATE: ('create', 'Création'),
    LogEntry.Action.UPDATE: ('update', 'Modification'),
    LogEntry.Action.DELETE: ('delete', 'Suppression'),
    LogEntry.Action.ACCESS: ('access', 'Consultation'),
}

# Nom de modèle technique -> module affiché
_MODULE_MAP = {
    'utilisateur': 'Utilisateurs',
    'client': 'Clients',
    'mp': 'Matières premières',
    'accessoire': 'Accessoires',
    'formule': 'Formules',
    'compositionformule': 'Formules',
    'lotfournisseur': 'Lots fournisseurs',
    'lotpf': 'Lots produits finis',
    'production': 'Production',
    'commande': 'Ventes',
    'commandelotmp': 'Ventes',
    'ajustementstock': 'Inventaire',
    'parametre': 'Paramètres',
}


class LogEntrySerializer(serializers.ModelSerializer):
    """Expose les entrées django-auditlog dans le format attendu par le Journal."""
    action = serializers.SerializerMethodField()
    action_label = serializers.SerializerMethodField()
    module = serializers.SerializerMethodField()
    objet = serializers.CharField(source='object_repr', read_only=True)
    objet_id = serializers.IntegerField(source='object_id', read_only=True)
    description = serializers.SerializerMethodField()
    changements = serializers.SerializerMethodField()
    utilisateur_nom = serializers.SerializerMethodField()
    utilisateur_role = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(source='timestamp', read_only=True)

    class Meta:
        model = LogEntry
        fields = [
            'id', 'action', 'action_label', 'module', 'objet', 'objet_id',
            'description', 'changements',
            'utilisateur_nom', 'utilisateur_role', 'created_at',
        ]

    def get_action(self, obj):
        return _ACTION_MAP.get(obj.action, ('update', 'Action'))[0]

    def get_action_label(self, obj):
        return _ACTION_MAP.get(obj.action, ('update', 'Action'))[1]

    def get_module(self, obj):
        model = obj.content_type.model if obj.content_type else ''
        return _MODULE_MAP.get(model, model.capitalize())

    def get_changements(self, obj):
        try:
            return obj.changes_display_dict
        except Exception:
            return {}

    def get_description(self, obj):
        verbe = _ACTION_MAP.get(obj.action, ('', 'Action'))[1]
        module = self.get_module(obj)
        return f"{verbe} — {module} : {obj.object_repr}"

    def get_utilisateur_nom(self, obj):
        return (obj.additional_data or {}).get('actor_nom')

    def get_utilisateur_role(self, obj):
        return (obj.additional_data or {}).get('actor_role')


class ParametreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Parametre
        fields = ['id', 'cle', 'valeur', 'description', 'updated_at']
        read_only_fields = ['updated_at']

    def validate(self, attrs):
        cle = attrs.get('cle', getattr(self.instance, 'cle', None))
        valeur = str(attrs.get('valeur', getattr(self.instance, 'valeur', ''))).strip()
        if cle == 'devise' and valeur not in {'XAF', 'XOF'}:
            raise serializers.ValidationError({'valeur': 'Utilisez XAF ou XOF pour le franc CFA.'})
        if cle in {
            'seuil_alerte_stock', 'duree_peremption_pf',
            'coefficient_transformation', 'marge_vente_mp',
        }:
            try:
                nombre = Decimal(valeur)
            except Exception as exc:
                raise serializers.ValidationError({'valeur': 'Une valeur numérique est requise.'}) from exc
            if nombre <= 0:
                raise serializers.ValidationError({'valeur': 'La valeur doit être positive.'})
            if cle == 'marge_vente_mp' and nombre > 500:
                raise serializers.ValidationError({'valeur': 'La marge ne peut pas dépasser 500 %.'})
        attrs['valeur'] = valeur
        return attrs
