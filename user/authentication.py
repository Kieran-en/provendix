from rest_framework.authentication import BaseAuthentication, CSRFCheck
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from django.utils import timezone
from .models import UserToken


def enforce_csrf(request):
    check = CSRFCheck(lambda _request: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise PermissionDenied(f'Contrôle CSRF échoué : {reason}')


class BearerTokenAuthentication(BaseAuthentication):
    """
    Authentification via le header : Authorization: Bearer <token>
    Utilise le modèle UserToken lié à Utilisateur (pas le Token DRF standard).
    """

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        token_key = ''
        cookie_auth = False
        if auth_header.startswith('Bearer '):
            token_key = auth_header.split(' ', 1)[1].strip()
        if not token_key:
            token_key = request.COOKIES.get('access_token', '')
            cookie_auth = bool(token_key)
        if not token_key:
            return None

        try:
            token = UserToken.objects.select_related('utilisateur').get(
                key=UserToken._hash(token_key)
            )
        except UserToken.DoesNotExist:
            raise AuthenticationFailed('Token invalide ou expiré.')

        if token.access_expires_at <= timezone.now():
            raise AuthenticationFailed('Token invalide ou expiré.')

        if not token.utilisateur.is_active:
            raise AuthenticationFailed('Utilisateur inactif.')

        if cookie_auth:
            enforce_csrf(request)

        return token.utilisateur, token

    def authenticate_header(self, request):
        return 'Bearer'
