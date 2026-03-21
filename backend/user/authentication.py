from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .models import UserToken

class BearerTokenAuthentication(BaseAuthentication):
    """
    Authentification via le header : Authorization: Bearer <token>
    Utilise le modèle UserToken lié à Utilisateur (pas le Token DRF standard).
    """

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None

        token_key = auth_header.split(' ', 1)[1].strip()
        if not token_key:
            return None

        try:
            token = UserToken.objects.select_related('utilisateur').get(key=token_key)
        except UserToken.DoesNotExist:
            raise AuthenticationFailed('Token invalide ou expiré.')

        if not token.utilisateur.is_active:
            raise AuthenticationFailed('Utilisateur inactif.')

        return token.utilisateur, token

    def authenticate_header(self, request):
        return 'Bearer'
