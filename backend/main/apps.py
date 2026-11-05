from django.apps import AppConfig


class MainConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'main'

    def ready(self):
        # Фоновый опрос Telegram (getUpdates) — работает без публичного webhook.
        # Запускаем только в основном веб-процессе (daphne), не в manage.py-командах.
        import sys
        if any('daphne' in a for a in sys.argv):
            _start_telegram_poller()


def _start_telegram_poller():
    import threading
    import time

    def loop():
        from main import telegram_service as tg

        # getUpdates конфликтует с webhook — снимаем webhook при старте
        try:
            tg.delete_webhook()
        except Exception as e:
            print('[Telegram poll] deleteWebhook error:', e)

        while True:
            try:
                updates = tg.poll_updates()
                for update in updates:
                    msg = update.get('message')
                    if not msg:
                        continue
                    chat = msg.get('chat', {})
                    tg.handle_incoming_message(
                        chat.get('id'), chat.get('username', '') or '',
                        msg.get('text') or '',
                    )
            except Exception as e:
                print('[Telegram poll] error:', e)
                time.sleep(3)

    t = threading.Thread(target=loop, daemon=True, name='telegram-poller')
    t.start()
