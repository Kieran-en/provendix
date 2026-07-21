from django.core.management import BaseCommand, call_command


class Command(BaseCommand):
    help = 'Exécute le snapshot et la sauvegarde quotidiens.'

    def handle(self, *args, **options):
        call_command('snapshot_daily')
        call_command('backup_database')
