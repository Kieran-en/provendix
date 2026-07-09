"""
Intégration de django-auditlog avec le modèle utilisateur maison.

Le champ ``actor`` de django-auditlog pointe vers ``AUTH_USER_MODEL``
(``auth.User``), or l'application utilise un modèle ``Utilisateur`` distinct
(voir user/authentication.py). On ne peut donc pas y stocker l'utilisateur
directement.

À la place, on renseigne l'acteur dans le champ JSON ``additional_data`` de
chaque entrée d'audit. On passe une *fonction* à ``set_extra_data`` : elle est
évaluée par django-auditlog au moment où l'entrée est enregistrée, c'est-à-dire
pendant l'exécution de la vue — donc APRÈS l'authentification DRF, quand
``request.user`` est bien l'instance ``Utilisateur`` connectée.
"""
from auditlog.context import set_extra_data


class AuditlogActorMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        def _actor_data():
            user = getattr(request, 'user', None)
            # request.user est un Utilisateur (auth Bearer) une fois la vue authentifiée
            if user is not None and getattr(user, 'pk', None) and hasattr(user, 'role'):
                return {
                    'actor_id': user.pk,
                    'actor_nom': user.nom,
                    'actor_role': user.role,
                }
            return {}

        with set_extra_data({'additional_data': _actor_data}):
            return self.get_response(request)
