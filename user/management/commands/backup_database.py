import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone


class Command(BaseCommand):
    help = 'Crée une sauvegarde datée de la base et conserve 30 jours par défaut.'

    def add_arguments(self, parser):
        parser.add_argument('--retention-days', type=int, default=30)

    def handle(self, *args, **options):
        retention_days = options['retention_days']
        if retention_days < 1:
            raise ValueError('La rétention doit être d’au moins un jour.')
        backup_dir = Path(settings.BASE_DIR) / 'backups'
        backup_dir.mkdir(parents=True, exist_ok=True)
        stamp = timezone.localtime().strftime('%Y%m%d_%H%M%S')

        if connection.vendor == 'sqlite':
            destination = backup_dir / f'provendix_backup_{stamp}.sqlite3'
            connection.ensure_connection()
            target = sqlite3.connect(destination)
            try:
                connection.connection.backup(target)
            finally:
                target.close()
        else:
            destination = backup_dir / f'provendix_backup_{stamp}.json'
            with destination.open('w', encoding='utf-8') as stream:
                call_command('dumpdata', natural_foreign=True, natural_primary=True, stdout=stream)

        cutoff = timezone.localtime() - timedelta(days=retention_days)
        for candidate in backup_dir.glob('provendix_backup_*'):
            modified = datetime.fromtimestamp(candidate.stat().st_mtime, tz=timezone.get_current_timezone())
            if modified < cutoff:
                candidate.unlink()
        self.stdout.write(self.style.SUCCESS(f'Sauvegarde créée : {destination}'))
