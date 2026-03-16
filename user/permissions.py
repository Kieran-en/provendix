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
        return request.user and hasattr(request.user, 'role')


class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.cree_par == request.user or request.user.role == 'admin'