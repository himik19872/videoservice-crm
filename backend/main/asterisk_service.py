"""
Интеграция с Asterisk PBX через AMI (Asterisk Manager Interface).
"""
import socket
import threading
import logging
from datetime import datetime

logger = logging.getLogger('asterisk')


class AsteriskAMI:
    """Клиент Asterisk Manager Interface (AMI)."""

    def __init__(self, host=None, port=None, username=None, secret=None):
        self._host = host
        self._port = port
        self._username = username
        self._secret = secret
        self._socket = None
        self._lock = threading.Lock()
        self._connected = False
        self._action_id = 0

    @property
    def host(self):
        if self._host: return self._host
        try:
            from main.models import SystemSettings
            s = SystemSettings.objects.first()
            return s.asterisk_host if s else '127.0.0.1'
        except Exception: return '127.0.0.1'

    @property
    def port(self):
        if self._port: return self._port
        try:
            from main.models import SystemSettings
            s = SystemSettings.objects.first()
            return s.asterisk_port if s else 5038
        except Exception: return 5038

    @property
    def username(self):
        if self._username: return self._username
        try:
            from main.models import SystemSettings
            s = SystemSettings.objects.first()
            return s.asterisk_user if s else ''
        except Exception: return ''

    @property
    def secret(self):
        if self._secret: return self._secret
        try:
            from main.models import SystemSettings
            s = SystemSettings.objects.first()
            return s.asterisk_secret if s else ''
        except Exception: return ''

    @property
    def is_configured(self):
        return bool(self.host and self.username and self.secret)

    # ── Подключение ──

    def connect(self, timeout=10):
        with self._lock:
            if self._connected: return True
            try:
                self._socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self._socket.settimeout(timeout)
                self._socket.connect((self.host, self.port))
                banner = self._recv_until(b'\r\n', timeout=5)
                logger.info(f"AMI: connected, banner={banner[:80].decode()}")
                self._send(f"Action: Login\r\nUsername: {self.username}\r\nSecret: {self.secret}\r\n\r\n")
                # Читаем ответ логина + все последующие события (FullyBooted...)
                raw = self._recv_until(b'\r\n\r\n', timeout=5)
                if b'Response: Success' in raw:
                    self._connected = True
                    # Вычитываем оставшиеся события из буфера (FullyBooted и т.д.)
                    self._drain_events(0.5)
                    logger.info("AMI: login OK")
                    return True
                self._close()
                logger.error(f"AMI: login failed: {raw[:200]}")
                return False
            except Exception as e:
                self._close()
                self._connected = False
                logger.error(f"AMI: connect error: {e}")
                return False

    def disconnect(self):
        with self._lock:
            if self._socket:
                try: self._send("Action: Logoff\r\n\r\n")
                except: pass
            self._close()
            self._connected = False

    def _close(self):
        if self._socket:
            try: self._socket.close()
            except: pass
            self._socket = None

    def _send(self, data):
        if isinstance(data, str): data = data.encode('utf-8')
        self._socket.sendall(data)

    def _recv_until(self, delimiter, timeout=10):
        """Читать из сокета пока не встретится delimiter."""
        self._socket.settimeout(timeout)
        data = b''
        while len(data) < 5 * 1024 * 1024:
            try:
                ch = self._socket.recv(1)
                if not ch: break
                data += ch
                if data.endswith(delimiter): break
            except socket.timeout:
                break
        return data

    def _recv_all(self, timeout=3):
        """Прочитать всё доступное из сокета."""
        self._socket.settimeout(timeout)
        data = b''
        while True:
            try:
                chunk = self._socket.recv(65536)
                if not chunk: break
                data += chunk
            except socket.timeout:
                break
        return data

    def _drain_events(self, timeout=0.3):
        """Вычитать и выбросить висящие события из буфера."""
        try:
            self._socket.settimeout(timeout)
            while True:
                self._socket.recv(4096)
        except socket.timeout:
            pass
        except Exception:
            pass

    # ── Парсинг AMI-ответа ──

    def _parse_ami(self, raw_bytes):
        """Разобрать AMI-ответ. Возвращает {'response': {...}, 'events': [...], 'output': ''}."""
        text = raw_bytes.decode('utf-8', errors='replace')
        result = {'response': {}, 'events': [], 'output': '', 'raw': text}
        current = {}
        
        for line in text.split('\r\n'):
            line = line.strip()
            if not line:
                if current:
                    if 'Response' in current:
                        result['response'] = current
                    elif 'Output' in current:
                        result['output'] += current.get('Output', '')
                    elif 'Event' in current:
                        result['events'].append(current)
                    current = {}
                continue
            # Пропускаем строки без ':'
            if ': ' not in line:
                continue
            k, v = line.split(': ', 1)
            current[k] = v
        
        # Последний блок
        if current:
            if 'Response' in current:
                result['response'] = current
            elif 'Output' in current:
                result['output'] += current.get('Output', '')
            elif 'Event' in current:
                result['events'].append(current)
        
        return result

    # ── Отправка Action ──

    def send_action(self, action, **params):
        """Отправить AMI Action и вернуть разобранный ответ."""
        if not self._connected and not self.connect():
            return {'error': 'No connection'}
        
        with self._lock:
            self._action_id += 1
            req = f"Action: {action}\r\nActionID: {self._action_id}\r\n"
            for k, v in params.items():
                req += f"{k}: {v}\r\n"
            req += "\r\n"
            self._send(req)
            
            # Читаем ответ
            raw = self._recv_all(timeout=5)
            
            # Команды CLI возвращают результат в несколько приёмов
            if action == 'Command' or 'Command' in params:
                # Ждём --END COMMAND--
                total = raw
                max_wait = 30
                waited = 0
                while b'--END COMMAND--' not in total and waited < max_wait:
                    more = self._recv_all(timeout=1)
                    if not more: break
                    total += more
                    waited += 1
                return self._parse_ami(total)
        
        return self._parse_ami(raw)

    # ── Высокоуровневые методы ──

    def ping(self):
        r = self.send_action('Ping')
        resp = r.get('response', {})
        return {'success': resp.get('Response') == 'Success',
                'ping': resp.get('Ping', ''), 'timestamp': resp.get('Timestamp', '')}

    def get_core_settings(self):
        r = self.send_action('CoreSettings')
        resp = r.get('response', {})
        return {
            'success': resp.get('Response') == 'Success',
            'version': resp.get('AsteriskVersion', '?'),
            'max_calls': resp.get('CoreMaxCalls', '0'),
            'uptime_seconds': resp.get('CoreUptimeSeconds', '0'),
            'reload_date': resp.get('CoreReloadDate', ''),
        }

    def get_status(self):
        r = self.send_action('Status')
        channels = []
        for ev in r.get('events', []):
            if ev.get('Event') == 'Status' and ev.get('Channel'):
                channels.append({
                    'channel': ev.get('Channel', ''),
                    'state': ev.get('ChannelStateDesc', ev.get('State', '')),
                    'caller_id': ev.get('CallerIDNum', ''),
                    'seconds': ev.get('Seconds', '0'),
                })
        return {
            'success': r.get('response', {}).get('Response') == 'Success',
            'channels': channels,
            'active_calls': len(channels),
        }

    def execute_command(self, command):
        r = self.send_action('Command', Command=command)
        # output уже собран в _parse_ami из событий Output
        return {
            'success': r.get('response', {}).get('Response') in ('Success', 'Follows'),
            'command': command,
            'output': r.get('output', '').strip(),
        }

    def get_sip_peers(self):
        r = self.execute_command('pjsip show endpoints')
        if not r.get('success'):
            r = self.execute_command('sip show peers')
        peers = []
        for line in r.get('output', '').split('\n'):
            line = line.strip()
            if not line or '---' in line or line.startswith('Endpoint') or line.startswith('Name'):
                continue
            parts = line.split()
            if len(parts) >= 2:
                peers.append({'name': parts[0], 'status': parts[-1], 'raw': line})
        return {'success': r.get('success'), 'peers': peers, 'count': len(peers)}

    def originate_call(self, channel, context, exten, priority=1, caller_id=None, timeout=30000):
        params = {
            'Channel': channel, 'Context': context, 'Exten': exten,
            'Priority': str(priority), 'Timeout': str(timeout),
        }
        if caller_id: params['CallerID'] = caller_id
        r = self.send_action('Originate', **params)
        resp = r.get('response', {})
        return {'success': resp.get('Response') == 'Success', 'message': resp.get('Message', '')}

    def hangup_channel(self, channel):
        r = self.send_action('Hangup', Channel=channel)
        return {'success': r.get('response', {}).get('Response') == 'Success'}

    def get_cdr(self, start_time=None, end_time=None, limit=100):
        cmd = 'core show cdrs'
        if start_time and end_time:
            if isinstance(start_time, datetime):
                start_time = start_time.strftime('%Y-%m-%d %H:%M:%S')
            if isinstance(end_time, datetime):
                end_time = end_time.strftime('%Y-%m-%d %H:%M:%S')
            cmd += f' from "{start_time}" to "{end_time}"'
        r = self.execute_command(cmd)
        cdrs = []
        for line in r.get('output', '').split('\n'):
            line = line.strip()
            if not line or line.startswith('Channel') or line.startswith('--'):
                continue
            parts = line.split()
            if len(parts) >= 5:
                cdrs.append({
                    'src': parts[0], 'dst': parts[1], 'start': parts[2],
                    'duration': parts[3], 'disposition': parts[4], 'raw': line,
                })
        return {'success': r.get('success'), 'cdrs': cdrs[:limit], 'count': len(cdrs)}


asterisk = AsteriskAMI()
