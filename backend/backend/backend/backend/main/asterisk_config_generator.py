"""
Генератор конфигурационных файлов Asterisk на основе моделей Django.
Генерирует: pjsip.conf, extensions.conf, voicemail.conf
"""
from django.utils import timezone


class AsteriskConfigGenerator:
    """Генерирует текст конфигов Asterisk из моделей БД."""

    @staticmethod
    def generate_pjsip_conf(sip_peers, trunks):
        """Генерирует pjsip.conf — SIP-аккаунты и транки."""
        lines = [
            '; ════════════════════════════════════════════════════════',
            '; Автоматически сгенерировано CRM VideoService',
            f'; Дата: {timezone.now().strftime("%d.%m.%Y %H:%M")}',
            '; ════════════════════════════════════════════════════════',
            '',
            '[global]',
            'type=global',
            'user_agent=Asterisk PBX VideoService CRM',
            '',
            '; ── Транспорты ──',
            '[transport-udp]',
            'type=transport',
            'protocol=udp',
            'bind=0.0.0.0',
            '',
        ]

        # ── Транки (провайдеры) ──
        trunk_names = []
        for i, trunk in enumerate(trunks):
            if not trunk.is_active:
                continue
            trunk_name = f'trunk-{trunk.name.replace(" ", "-").lower()}'
            trunk_names.append(trunk_name)

            auth_section = f'auth-{trunk_name}'
            aor_section = f'aor-{trunk_name}'
            endpoint_section = f'endpoint-{trunk_name}'
            identify_section = f'identify-{trunk_name}'

            lines.append(f'; ── Транк: {trunk.name} ──')
            lines.append('')

            # Auth
            lines.append(f'[{auth_section}]')
            lines.append('type=auth')
            lines.append(f'auth_type=userpass')
            if trunk.username:
                lines.append(f'username={trunk.username}')
            lines.append(f'password={trunk.secret}')
            lines.append('')

            # AOR
            lines.append(f'[{aor_section}]')
            lines.append('type=aor')
            lines.append(f'contact=sip:{trunk.host}:{trunk.port}')
            lines.append(f'max_contacts={trunk.max_channels}')
            lines.append('')

            # Endpoint
            lines.append(f'[{endpoint_section}]')
            lines.append('type=endpoint')
            lines.append(f'context={trunk.context}')
            lines.append(f'transport=transport-udp')
            lines.append(f'auth={auth_section}')
            lines.append(f'aors={aor_section}')
            lines.append(f'allow={trunk.codecs}')
            lines.append(f'dtmf_mode=rfc4733')
            lines.append(f'disallow=all')
            for codec in trunk.codecs.split(','):
                lines.append(f'allow={codec.strip()}')
            if trunk.caller_id:
                lines.append(f'callerid={trunk.caller_id}')
            if trunk.from_user:
                lines.append(f'from_user={trunk.from_user}')
            if trunk.from_domain:
                lines.append(f'from_domain={trunk.from_domain}')
            lines.append('')

            # Identify (входящий трафик от провайдера)
            lines.append(f'[{identify_section}]')
            lines.append('type=identify')
            lines.append(f'endpoint={endpoint_section}')
            lines.append(f'match={trunk.host}')
            lines.append('')

            # Регистрация (исходящий транк)
            if trunk.register and trunk.username:
                reg_section = f'reg-{trunk_name}'
                lines.append(f'[{reg_section}]')
                lines.append('type=registration')
                lines.append(f'outbound_auth={auth_section}')
                lines.append(f'server_uri=sip:{trunk.host}:{trunk.port}')
                lines.append(f'client_uri=sip:{trunk.username}@{trunk.host}:{trunk.port}')
                if trunk.auth_username:
                    lines.append(f'auth_username={trunk.auth_username}')
                lines.append('')

        # ── SIP-аккаунты (внутренние номера) ──
        for peer in sip_peers:
            if not peer.is_active:
                continue
            pname = peer.name.replace(' ', '-').lower()
            auth_section = f'auth-{pname}'
            aor_section = f'aor-{pname}'
            endpoint_section = f'endpoint-{pname}'

            lines.append(f'; ── SIP-аккаунт: {peer.name} {peer.display_name} ──')
            lines.append('')

            # Auth
            lines.append(f'[{auth_section}]')
            lines.append('type=auth')
            lines.append('auth_type=userpass')
            lines.append(f'username={peer.name}')
            lines.append(f'password={peer.secret}')
            lines.append('')

            # AOR
            lines.append(f'[{aor_section}]')
            lines.append('type=aor')
            lines.append(f'max_contacts=2')
            lines.append('')

            # Endpoint
            lines.append(f'[{endpoint_section}]')
            lines.append('type=endpoint')
            lines.append(f'context={peer.context}')
            lines.append(f'transport=transport-udp')
            lines.append(f'auth={auth_section}')
            lines.append(f'aors={aor_section}')
            lines.append(f'callerid={peer.caller_id or peer.display_name or peer.name} <{peer.name}>')
            if peer.mailbox:
                lines.append(f'mailboxes={peer.mailbox}')
            lines.append('disallow=all')
            for codec in peer.allow.split(','):
                lines.append(f'allow={codec.strip()}')
            lines.append(f'dtmf_mode=rfc4733')
            if peer.nat:
                lines.append('force_rport=yes')
                lines.append('rewrite_contact=yes')
                lines.append('rtp_symmetric=yes')
            lines.append('')

        return '\n'.join(lines)

    @staticmethod
    def generate_extensions_conf(routes, ivrs, sip_peers, trunks):
        """Генерирует extensions.conf — диалплан маршрутизации."""
        lines = [
            '; ════════════════════════════════════════════════════════',
            '; Автоматически сгенерировано CRM VideoService',
            f'; Дата: {timezone.now().strftime("%d.%m.%Y %H:%M")}',
            '; ════════════════════════════════════════════════════════',
            '',
            '[globals]',
            '',
            '[internal]',
            '; Внутренние звонки между сотрудниками',
        ]

        # Внутренняя маршрутизация: по имени SIP-аккаунта
        for peer in sip_peers:
            if peer.is_active:
                lines.append(f'exten => {peer.name},1,Dial(PJSIP/{peer.name},30)')
                lines.append(f'  same => n,Hangup()')
        lines.append('')

        # Общий internal: любой внутренний номер по шаблону
        lines.append('exten => _XXX,1,NoOp(Внутренний звонок на ${EXTEN})')
        lines.append('  same => n,Dial(PJSIP/${EXTEN},30)')
        lines.append('  same => n,Hangup()')
        lines.append('')
        lines.append('; ── Голосовая почта ──')
        lines.append('exten => _*97XX,1,VoiceMailMain(${EXTEN:4}@default)')
        lines.append('  same => n,Hangup()')
        lines.append('')
        lines.append('exten => *98,1,VoiceMailMain()')
        lines.append('  same => n,Hangup()')
        lines.append('')

        # ── IVR ──
        if ivrs:
            lines.append('; ── Голосовые меню (IVR) ──')
            for ivr in ivrs:
                if not ivr.is_active:
                    continue
                ivr_name = f'ivr-{ivr.name.replace(" ", "-").lower()}'
                lines.append(f'; IVR: {ivr.name}')
                lines.append(f'[{ivr_name}]')
                if ivr.greeting_audio:
                    lines.append(f'exten => s,1,Answer()')
                    lines.append(f'  same => n,Wait(1)')
                    lines.append(f'  same => n,Background({ivr.greeting_audio})')
                else:
                    lines.append(f'exten => s,1,Answer()')
                    lines.append(f'  same => n,Wait(1)')
                    lines.append(f'  same => n,Playback(beep)')

                lines.append(f'  same => n,WaitExten({ivr.timeout})')
                lines.append('')

                for opt in ivr.options.order_by('order'):
                    digit = opt.digit
                    if opt.action == 'extension':
                        lines.append(f'exten => {digit},1,Goto(internal,{opt.destination},1)')
                    elif opt.action == 'queue':
                        lines.append(f'exten => {digit},1,Queue({opt.destination})')
                        lines.append(f'  same => n,Hangup()')
                    elif opt.action == 'ivr':
                        lines.append(f'exten => {digit},1,Goto({opt.destination},s,1)')
                    elif opt.action == 'playback':
                        lines.append(f'exten => {digit},1,Playback({opt.destination})')
                        lines.append(f'  same => n,Goto(s,{ivr.exit_destination})')
                    elif opt.action == 'voicemail':
                        lines.append(f'exten => {digit},1,VoiceMail({opt.destination})')
                        lines.append(f'  same => n,Hangup()')
                    elif opt.action == 'hangup':
                        lines.append(f'exten => {digit},1,Hangup()')
                    elif opt.action == 'dial':
                        lines.append(f'exten => {digit},1,Dial({opt.destination},60)')
                        lines.append(f'  same => n,Hangup()')

                # Таймаут
                t_opt = ivr.options.filter(digit='t').first()
                if t_opt:
                    if t_opt.action == 'extension':
                        lines.append(f'exten => t,1,Goto(internal,{t_opt.destination},1)')
                    else:
                        lines.append(f'exten => t,1,Goto({t_opt.destination},s,1)')
                elif ivr.exit_destination == 'hangup':
                    lines.append(f'exten => t,1,Hangup()')
                else:
                    lines.append(f'exten => t,1,Goto({ivr.exit_destination},s,1)')

                # Неверный ввод
                invalid_opt = ivr.options.filter(digit='i').first()
                if invalid_opt:
                    lines.append(f'exten => i,1,Goto({invalid_opt.destination},s,1)')
                else:
                    if ivr.invalid_audio:
                        lines.append(f'exten => i,1,Playback({ivr.invalid_audio})')
                    lines.append(f'  same => n,Goto(s,1)')
                lines.append('')

        # ── Входящие звонки ──
        lines.append('[inbound]')
        inbound_routes = [r for r in routes if r.direction == 'inbound' and r.is_active]
        if inbound_routes:
            for route in sorted(inbound_routes, key=lambda x: x.priority):
                pattern = route.match_pattern
                dest = route.destination or 'internal,s,1'
                if dest.startswith('ivr-'):
                    lines.append(f'exten => {pattern},{route.priority},Goto({dest},s,1)')
                elif dest.startswith('SIP/') or dest.startswith('PJSIP/'):
                    peer_name = dest.replace('SIP/', '').replace('PJSIP/', '')
                    lines.append(f'exten => {pattern},{route.priority},Dial(PJSIP/{peer_name},30)')
                    lines.append(f'  same => n,Hangup()')
                elif dest.startswith('queue-'):
                    qname = dest.replace('queue-', '')
                    lines.append(f'exten => {pattern},{route.priority},Queue({qname})')
                    lines.append(f'  same => n,Hangup()')
                else:
                    lines.append(f'exten => {pattern},{route.priority},Goto({dest},s,1)')
        else:
            lines.append('; Нет настроенных входящих маршрутов')
            lines.append('exten => _X.,1,NoOp(Входящий звонок)')
            lines.append('  same => n,Goto(internal,${EXTEN},1)')
        lines.append('')

        # ── Исходящие звонки ──
        lines.append('[outbound]')
        outbound_routes = [r for r in routes if r.direction == 'outbound' and r.is_active]
        if outbound_routes:
            for route in sorted(outbound_routes, key=lambda x: x.priority):
                pattern = route.match_pattern
                trunk = route.trunk
                if trunk and trunk.is_active:
                    trunk_ep = f'endpoint-trunk-{trunk.name.replace(" ", "-").lower()}'
                    lines.append(f'; Маршрут: {route.name} → {trunk.name}')

                    if route.strip > 0:
                        dial_expr = f'${{EXTEN:{route.strip}}}'
                    else:
                        dial_expr = '${EXTEN}'

                    if route.prepend:
                        dial_expr = f'{route.prepend}{dial_expr}'

                    if route.caller_id_override:
                        lines.append(f'exten => {pattern},{route.priority},Set(CALLERID(num)={route.caller_id_override})')
                    lines.append(f'exten => {pattern},{route.priority},Dial(PJSIP/{dial_expr}@{trunk_ep},60)')
                    lines.append(f'  same => n,Hangup()')

                    if route.failover_destination:
                        lines.append(f'; Failover на {route.failover_destination}')
                        lines.append(f'exten => {pattern},{route.priority+1},Dial({route.failover_destination},60)')
                        lines.append(f'  same => n,Hangup()')
        else:
            lines.append('; Нет настроенных исходящих маршрутов')
            lines.append('exten => _X.,1,NoOp(Исходящий звонок)')
        lines.append('')

        return '\n'.join(lines)

    @staticmethod
    def generate_voicemail_conf(voicemails):
        """Генерирует voicemail.conf."""
        lines = [
            '; ════════════════════════════════════════════════════════',
            '; Автоматически сгенерировано CRM VideoService',
            f'; Дата: {timezone.now().strftime("%d.%m.%Y %H:%M")}',
            '; ════════════════════════════════════════════════════════',
            '',
            '[general]',
            'format=wav49|wav',
            'serveremail=voicemail@videoservice.ru',
            'attach=yes',
            'skipms=3000',
            'maxsilence=10',
            'silencethreshold=128',
            'maxlogins=3',
            'sendvoicemail=yes',
            '',
            '[default]',
        ]

        for vm in voicemails:
            if not vm.is_active:
                continue
            parts = vm.mailbox.split('@', 1)
            mailbox_num = parts[0]
            context = parts[1] if len(parts) > 1 else 'default'

            lines.append(f'{mailbox_num} => {vm.password},{vm.display_name or mailbox_num},')
            if vm.email:
                attach_flag = 'attach=yes|' if vm.email_attachment else ''
                delete_flag = 'delete=yes|' if vm.delete_after_email else ''
                lines[-1] += f'{vm.email},{attach_flag}{delete_flag}'
            else:
                lines[-1] += ','

            lines.append(f'; maxmsg={vm.max_messages},maxsecs={vm.max_seconds},minsecs={vm.min_seconds}')
        lines.append('')

        return '\n'.join(lines)
