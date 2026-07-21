from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Sum
from django.utils import timezone

from user.models import Historique, LotPF, MP, Paiement


class Command(BaseCommand):
    help = 'Crée ou met à jour le snapshot quotidien des stocks et encaissements.'

    def handle(self, *args, **options):
        today = timezone.localdate()
        stocks_mp = MP.objects.aggregate(total=Sum('stock_disponible'))['total'] or Decimal('0')
        stocks_pf = LotPF.objects.aggregate(total=Sum('quantite'))['total'] or Decimal('0')
        caisse = Paiement.objects.filter(created_at__date=today).aggregate(total=Sum('montant'))['total'] or Decimal('0')
        snapshot, created = Historique.objects.update_or_create(
            date=today,
            defaults={'stocks_mp': stocks_mp, 'stocks_pf': stocks_pf, 'caisse': caisse},
        )
        action = 'créé' if created else 'mis à jour'
        self.stdout.write(self.style.SUCCESS(f'Snapshot {today} {action} (id={snapshot.pk}).'))
