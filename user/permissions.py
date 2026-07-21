from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and hasattr(request.user, 'role') and request.user.role == 'admin'


class IsSuperviseurOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return (request.user and hasattr(request.user, 'role') and 
                request.user.role in ['admin', 'superviseur'])


class IsAuthenticated(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and hasattr(request.user, 'role')
            and getattr(request.user, 'is_active', False)
        )


class IsSuperviseurWriteAuthenticatedRead(permissions.BasePermission):
    """Lecture pour tout utilisateur actif, écriture pour le contrôle administratif."""

    def has_permission(self, request, view):
        if not (
            request.user
            and hasattr(request.user, 'role')
            and getattr(request.user, 'is_active', False)
        ):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.role in ['admin', 'superviseur']


class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.cree_par == request.user or request.user.role == 'admin'
