"""
API для управления конфигурацией Asterisk: генерация, пуш на сервер, reload.
"""
import subprocess
import tempfile
import os

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    AsteriskSipPeer, AsteriskTrunk, AsteriskRoute,
    AsteriskIvr, AsteriskVoicemail, AsteriskCallRecording,
    SystemSettings
)
from .asterisk_service import asterisk
from .asterisk_config_generator import AsteriskConfigGenerator


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def asterisk_generate_configs_view(request):
    """
    Генерирует конфигурационные файлы Asterisk и возвращает их содержимое.
    Используется для предпросмотра перед отправкой на сервер.
    """
    try:
        peers = AsteriskSipPeer.objects.all()
        trunks = AsteriskTrunk.objects.all()
        routes = AsteriskRoute.objects.select_related('trunk').all()
        ivrs = AsteriskIvr.objects.prefetch_related('options').all()
        voicemails = AsteriskVoicemail.objects.all()

        gen = AsteriskConfigGenerator()
        pjsip = gen.generate_pjsip_conf(peers, trunks)
        extensions = gen.generate_extensions_conf(routes, ivrs, peers, trunks)
        voicemail_conf = gen.generate_voicemail_conf(voicemails)

        return Response({
            'success': True,
            'configs': {
                'pjsip.conf': pjsip,
                'extensions.conf': extensions,
                'voicemail.conf': voicemail_conf,
            },
            'stats': {
                'peers': peers.filter(is_active=True).count(),
                'trunks': trunks.filter(is_active=True).count(),
                'routes': routes.filter(is_active=True).count(),
                'ivrs': ivrs.filter(is_active=True).count(),
                'voicemails': voicemails.filter(is_active=True).count(),
            }
        })
    except Exception as e:
        return Response({'success': False, 'error': str(e)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def asterisk_push_configs_view(request):
    """
    Генерирует конфиги и отправляет их на Asterisk-сервер по SSH.
    После отправки выполняет 'reload' для применения.
    """
    try:
        settings = SystemSettings.objects.first()
        if not settings:
            return Response({'success': False, 'error': 'Системные настройки не найдены'})

        host = settings.asterisk_host
        if not host:
            return Response({'success': False, 'error': 'Не указан хост Asterisk'})

        # Генерируем конфиги
        peers = AsteriskSipPeer.objects.all()
        trunks = AsteriskTrunk.objects.all()
        routes = AsteriskRoute.objects.select_related('trunk').all()
        ivrs = AsteriskIvr.objects.prefetch_related('options').all()
        voicemails = AsteriskVoicemail.objects.all()

        gen = AsteriskConfigGenerator()
        configs = {
            'pjsip.conf': gen.generate_pjsip_conf(peers, trunks),
            'extensions.conf': gen.generate_extensions_conf(routes, ivrs, peers, trunks),
            'voicemail.conf': gen.generate_voicemail_conf(voicemails),
        }

        # Пишем во временные файлы и отправляем по SSH
        push_errors = []
        pushed_files = []

        for filename, content in configs.items():
            try:
                # Создаём временный файл
                with tempfile.NamedTemporaryFile(mode='w', suffix='.conf', delete=False, encoding='utf-8') as f:
                    f.write(content)
                    tmp_path = f.name

                # Отправляем на сервер через ssh + sudo tee
                remote_path = f'/etc/asterisk/{filename}'
                cmd = (
                    f'sshpass -p "96811621" ssh -o StrictHostKeyChecking=no '
                    f'himik@{host} '
                    f'"echo \'96811621\' | sudo -S tee {remote_path}" '
                    f'< {tmp_path}'
                )
                result = subprocess.run(
                    cmd, shell=True, capture_output=True, text=True, timeout=15
                )
                os.unlink(tmp_path)

                if result.returncode != 0:
                    push_errors.append(f'{filename}: {result.stderr.strip()}')
                else:
                    pushed_files.append(filename)

            except Exception as e:
                push_errors.append(f'{filename}: {str(e)}')

        # Если всё ок — делаем reload
        reload_result = None
        if not push_errors:
            try:
                cmd = (
                    f'sshpass -p "96811621" ssh -o StrictHostKeyChecking=no '
                    f'himik@{host} '
                    f'"echo \'96811621\' | sudo -S asterisk -rx \\"module reload\\""'
                )
                r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
                reload_result = r.stdout.strip() if r.returncode == 0 else r.stderr.strip()
            except Exception as e:
                reload_result = str(e)

        return Response({
            'success': len(push_errors) == 0,
            'pushed': pushed_files,
            'errors': push_errors,
            'reload': reload_result,
        })

    except Exception as e:
        return Response({'success': False, 'error': str(e)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def asterisk_dashboard_view(request):
    """
    Дашборд состояния Asterisk: версия, активные каналы, статистика.
    """
    try:
        result = {
            'success': True,
            'connected': False,
            'version': None,
            'active_channels': 0,
            'uptime': None,
            'sip_peers_count': AsteriskSipPeer.objects.filter(is_active=True).count(),
            'trunks_count': AsteriskTrunk.objects.filter(is_active=True).count(),
            'routes_count': AsteriskRoute.objects.filter(is_active=True).count(),
            'ivrs_count': AsteriskIvr.objects.filter(is_active=True).count(),
            'recordings_count': AsteriskCallRecording.objects.count(),
        }

        # Пробуем подключиться к AMI
        if asterisk.connect(timeout=3):
            result['connected'] = True
            cs = asterisk.get_core_settings()
            result['version'] = cs.get('version', '?')
            result['uptime'] = cs.get('uptime_seconds', '0')

            st = asterisk.get_status()
            result['active_channels'] = st.get('active_calls', 0)
            result['channels'] = st.get('channels', [])

            asterisk.disconnect()

        return Response(result)
    except Exception as e:
        return Response({'success': False, 'error': str(e)})
