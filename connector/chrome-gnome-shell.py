#!/usr/bin/env python
# -*- coding: UTF-8 -*-

"""
    GNOME Shell integration for Chrome
    Copyright (C) 2016-2017  Yuri Konotopov <ykonotopov@gnome.org>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
"""

from __future__ import unicode_literals
from __future__ import print_function
from gi.repository import GLib, Gio
import json
import os
import re
import requests
import signal
import struct
import sys
import traceback

CONNECTOR_VERSION = 8.2
DEBUG_ENABLED = False

SHELL_SCHEMA = "org.gnome.shell"
ENABLED_EXTENSIONS_KEY = "enabled-extensions"
EXTENSION_DISABLE_VERSION_CHECK_KEY = "disable-extension-version-validation"

# https://developer.chrome.com/extensions/nativeMessaging#native-messaging-host-protocol
MESSAGE_LENGTH_SIZE = 4


# https://wiki.gnome.org/Projects/GnomeShell/Extensions/UUIDGuidelines
def is_uuid(uuid):
    return uuid is not None and re.match('[-a-zA-Z0-9@._]+$', uuid) is not None


def debug(message):
    if DEBUG_ENABLED:
        log_error(message)


def log_error(message):
    print('[%d] %s' % (os.getpid(), message), file=sys.stderr)


class ChromeGNOMEShell(Gio.Application):
    def __init__(self, run_as_service):
        Gio.Application.__init__(
            self,
            application_id='org.gnome.ChromeGnomeShell',
            flags=Gio.ApplicationFlags.IS_SERVICE if run_as_service
            else Gio.ApplicationFlags.IS_LAUNCHER | Gio.ApplicationFlags.HANDLES_OPEN
        )

        self.shellAppearedId = None
        self.shellSignalId = None

        # Set custom exception hook
        # noinspection SpellCheckingInspection
        sys.excepthook = self.default_exception_hook

        self.register()

        if not run_as_service:
            self.shell_proxy = Gio.DBusProxy.new_sync(self.get_dbus_connection(),
                                                      Gio.DBusProxyFlags.NONE,
                                                      None,
                                                      'org.gnome.Shell',
                                                      '/org/gnome/Shell',
                                                      'org.gnome.Shell.Extensions',
                                                      None)

            self.get_dbus_connection().signal_subscribe(
                self.get_application_id(),
                self.get_application_id(),
                None,
                "/org/gnome/ChromeGnomeShell",
                None,
                Gio.DBusSignalFlags.NONE,
                self.on_dbus_signal,
                None
            )

            stdin = GLib.IOChannel.unix_new(sys.stdin.fileno())
            stdin.set_encoding(None)
            stdin.set_buffered(False)

            GLib.io_add_watch(stdin, GLib.PRIORITY_DEFAULT, GLib.IOCondition.IN, self.on_input, None)
            GLib.io_add_watch(stdin, GLib.PRIORITY_DEFAULT, GLib.IOCondition.HUP, self.on_hup, None)
            GLib.io_add_watch(stdin, GLib.PRIORITY_DEFAULT, GLib.IOCondition.ERR, self.on_hup, None)
        else:
            self.add_simple_action("create-notification", self.on_create_notification, 'a{sv}')
            self.add_simple_action("on-notification-clicked", self.on_notification_clicked, 's')
            self.add_simple_action("on-notification-action", self.on_notification_action, '(si)')

            GLib.timeout_add_seconds(5 * 60, self.on_service_timeout, None)

        GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, signal.SIGINT, self.on_sigint, None)

        if not run_as_service or not self.get_is_remote():
            self.hold()

    # Is there any way to hook this to shutdown?
    def clean_release(self):
        debug('Release')

        if self.shellAppearedId:
            Gio.bus_unwatch_name(self.shellAppearedId)

        if self.shellSignalId:
            dbus_connection = self.get_dbus_connection()

            if dbus_connection is not None:
                dbus_connection.signal_unsubscribe(self.shellSignalId)

        self.release()

    def default_exception_hook(self, exception_type, value, tb):
        log_error("Uncaught exception of type %s occured" % exception_type)
        traceback.print_tb(tb)
        log_error("Exception: %s" % value)

        self.clean_release()

    def add_simple_action(self, name, callback, parameter_type):
        action = Gio.SimpleAction.new(
            name,
            GLib.VariantType.new(parameter_type) if parameter_type is not None else None
        )
        action.connect('activate', callback)
        self.add_action(action)

    # Service events
    # noinspection PyUnusedLocal
    def on_create_notification(self, source, request):
        debug('On create notification')

        request = request.unpack()

        notification = Gio.Notification.new(request['title'])
        notification.set_body(request['message'])
        notification.set_priority(Gio.NotificationPriority.NORMAL)
        notification.set_default_action_and_target(
            "app.on-notification-clicked",
            GLib.Variant.new_string(request['name'])
        )

        if 'buttons' in request:
            for button_id, button in enumerate(request['buttons']):
                notification.add_button_with_target(
                    button['title'],
                    "app.on-notification-action",
                    GLib.Variant.new_tuple(
                        GLib.Variant.new_string(request['name']),
                        GLib.Variant.new_int32(button_id)
                    )
                )

        self.send_notification(request['name'], notification)

    # noinspection PyUnusedLocal
    def on_notification_action(self, notification, parameters):
        debug('Notification %s action: %s' % parameters.unpack())

        self.get_dbus_connection().emit_signal(
            None,
            self.get_dbus_object_path(),
            self.get_application_id(),
            "NotificationAction",
            parameters
        )

    # noinspection PyUnusedLocal
    def on_notification_clicked(self, notification, notification_name):
        debug('Notification %s clicked' % notification_name)

        self.get_dbus_connection().emit_signal(
            None,
            self.get_dbus_object_path(),
            self.get_application_id(),
            "NotificationClicked",
            GLib.Variant.new_tuple(notification_name)
        )

    # noinspection PyUnusedLocal
    def on_service_timeout(self, data):
        debug('On service timeout')
        self.clean_release()

        return False

    # Native messaging events
    # noinspection PyUnusedLocal
    def on_input(self, source, condition, data):
        debug('On input')
        text_length_bytes = source.read(MESSAGE_LENGTH_SIZE)

        if len(text_length_bytes) == 0:
            debug('Release condition: %s' % str(condition))
            self.clean_release()
            return

        # Unpack message length as 4 byte integer.
        text_length = struct.unpack(b'i', text_length_bytes)[0]

        # Read the text (JSON object) of the message.
        text = source.read(text_length).decode('utf-8')

        request = json.loads(text)

        if 'execute' in request:
            if 'uuid' in request and not is_uuid(request['uuid']):
                return

            self.process_request(request)

        return True

    # noinspection SpellCheckingInspection,PyUnusedLocal
    def on_dbus_signal(self, connection, sender_name, object_path, interface_name, signal_name, parameters, user_data):
        debug('Signal %s from %s' % (signal_name, interface_name))

        if interface_name == "org.gnome.Shell.Extensions" and signal_name == 'ExtensionStatusChanged':
            self.send_message({'signal': signal_name, 'parameters': parameters.unpack()})
        elif interface_name == self.get_application_id():
            if signal_name == 'NotificationAction':
                notification_name, button_id = parameters.unpack()

                self.send_message({
                    'signal': "NotificationAction",
                    'name': notification_name,
                    'button_id': button_id
                })
            elif signal_name == 'NotificationClicked':
                (notification_name,) = parameters.unpack()

                self.send_message({
                    'signal': "NotificationClicked",
                    'name': notification_name
                })

    # noinspection PyUnusedLocal
    def on_shell_appeared(self, connection, name, name_owner):
        debug('Signal: to %s' % name)
        self.send_message({'signal': name})
        debug('Signal: from %s' % name)

    # General events
    # noinspection PyUnusedLocal
    def on_hup(self, source, condition, data):
        debug('On hup: %s' % str(condition))
        self.clean_release()

        return False

    # noinspection PyUnusedLocal
    def on_sigint(self, data):
        debug('On sigint')
        self.clean_release()

        return False

    # Helpers
    # noinspection SpellCheckingInspection
    def dbus_call_response(self, method, parameters, result_property):
        try:
            result = self.shell_proxy.call_sync(method,
                                                parameters,
                                                Gio.DBusCallFlags.NONE,
                                                -1,
                                                None)

            self.send_message({'success': True, result_property: result.unpack()[0]})
        except GLib.GError as e:
            self.send_error(e.message)

    def send_error(self, message):
        self.send_message({'success': False, 'message': message})

    @staticmethod
    def send_message(response):
        """
        Helper function that sends a message to the webapp.
        :param response: dictionary of response data
        :return: None
        """

        message = json.dumps(response)
        message_length = len(message.encode('utf-8'))

        if message_length > 1024*1024:
            log_error('Too long message (%d): "%s"' % (message_length, message))
            return

        try:
            stdout = GLib.IOChannel.unix_new(sys.stdout.fileno())
            stdout.set_encoding(None)
            stdout.set_buffered(False)

            stdout.write_chars(struct.pack(b'I', message_length), MESSAGE_LENGTH_SIZE)

            # Write the message itself.
            stdout.write_chars(message.encode('utf-8'), message_length)
        except IOError as e:
            log_error('IOError occured: %s' % e.strerror)
            sys.exit(1)

    def get_variant(self, data, basic_type=False):
        if isinstance(data, ("".__class__, u"".__class__)) or type(data) is int or basic_type:
            if isinstance(data, ("".__class__, u"".__class__)):
                return GLib.Variant.new_string(data)
            elif type(data) is int:
                return GLib.Variant.new_int32(data)
            else:
                raise Exception("Unknown basic data type: %s, %s" % (type(data), str(data)))
        elif type(data) is list:
            variant_builder = GLib.VariantBuilder.new(GLib.VariantType.new('av'))

            for value in data:
                variant_builder.add_value(GLib.Variant.new_variant(self.get_variant(value)))

            return variant_builder.end()

        elif type(data) is dict:
            variant_builder = GLib.VariantBuilder.new(GLib.VariantType.new('a{sv}'))

            for key in data:
                if data[key] is None:
                    continue

                if sys.version < '3':
                    # pylint: disable=E0602
                    # noinspection PyUnresolvedReferences
                    key_string = unicode(key)
                else:
                    key_string = str(key)

                variant_builder.add_value(
                    GLib.Variant.new_dict_entry(
                        self.get_variant(key_string, True), GLib.Variant.new_variant(self.get_variant(data[key]))
                    )
                )

            return variant_builder.end()
        else:
            raise Exception("Unknown data type: %s" % type(data))

    def process_request(self, request):
        debug('Execute: to %s' % request['execute'])

        if request['execute'] == 'initialize':
            source = Gio.SettingsSchemaSource.get_default()
            shell_version = self.shell_proxy.get_cached_property("ShellVersion")

            if source.lookup(SHELL_SCHEMA, True) is not None and shell_version is not None:
                settings = Gio.Settings.new(SHELL_SCHEMA)

                if EXTENSION_DISABLE_VERSION_CHECK_KEY in settings.keys():
                    disable_version_check = settings.get_boolean(EXTENSION_DISABLE_VERSION_CHECK_KEY)
                else:
                    disable_version_check = False

                self.send_message(
                    {
                        'success': True,
                        'properties': {
                            'connectorVersion': CONNECTOR_VERSION,
                            'shellVersion': shell_version.unpack() if shell_version is not None else None,
                            'versionValidationEnabled': not disable_version_check,
                            'supports': [
                                'notifications',
                                'update-check'
                            ]
                        }
                    }
                )
            else:
                self.send_message(
                    {
                        'success': False,
                        'message': "no_gnome_shell"
                    }
                )

        elif request['execute'] == 'subscribeSignals':
            if not self.shellAppearedId:
                self.shellAppearedId = Gio.bus_watch_name_on_connection(
                    self.get_dbus_connection(),
                    'org.gnome.Shell',
                    Gio.BusNameWatcherFlags.NONE,
                    self.on_shell_appeared,
                    None
                )

            if not self.shellSignalId:
                self.shellSignalId = self.get_dbus_connection().signal_subscribe(
                    "org.gnome.Shell",
                    "org.gnome.Shell.Extensions",
                    "ExtensionStatusChanged",
                    "/org/gnome/Shell",
                    None,
                    Gio.DBusSignalFlags.NONE,
                    self.on_dbus_signal,
                    None
                )

        elif request['execute'] == 'installExtension':
            self.dbus_call_response(
                "InstallRemoteExtension",
                GLib.Variant.new_tuple(GLib.Variant.new_string(request['uuid'])),
                "status"
            )

        elif request['execute'] == 'listExtensions':
            self.dbus_call_response("ListExtensions", None, "extensions")

        elif request['execute'] == 'enableExtension':
            settings = Gio.Settings.new(SHELL_SCHEMA)
            uuids = settings.get_strv(ENABLED_EXTENSIONS_KEY)

            extensions = []
            if 'extensions' in request:
                extensions = request['extensions']
            else:
                extensions.append({'uuid': request['uuid'], 'enable': request['enable']})

            for extension in extensions:
                if not is_uuid(extension['uuid']):
                    continue

                if extension['enable']:
                    if not extension['uuid'] in uuids:
                        uuids.append(extension['uuid'])
                elif extension['uuid'] in uuids:
                    uuids = [value for value in uuids if value != extension['uuid']]

            settings.set_strv(ENABLED_EXTENSIONS_KEY, uuids)

            self.send_message({'success': True})

        elif request['execute'] == 'launchExtensionPrefs':
            self.shell_proxy.call("LaunchExtensionPrefs",
                                  GLib.Variant.new_tuple(GLib.Variant.new_string(request['uuid'])),
                                  Gio.DBusCallFlags.NONE,
                                  -1,
                                  None,
                                  None,
                                  None)

        elif request['execute'] == 'getExtensionErrors':
            self.dbus_call_response("GetExtensionErrors",
                                    GLib.Variant.new_tuple(GLib.Variant.new_string(request['uuid'])),
                                    "extensionErrors")

        elif request['execute'] == 'getExtensionInfo':
            self.dbus_call_response("GetExtensionInfo",
                                    GLib.Variant.new_tuple(GLib.Variant.new_string(request['uuid'])),
                                    "extensionInfo")

        elif request['execute'] == 'uninstallExtension':
            self.dbus_call_response("UninstallExtension",
                                    GLib.Variant.new_tuple(GLib.Variant.new_string(request['uuid'])),
                                    "status")

        elif request['execute'] == 'checkUpdate':
            update_url = 'https://extensions.gnome.org/update-info/'
            if 'url' in request:
                update_url = request['url']

            self.check_update(update_url)

        elif request['execute'] == 'createNotification':
            Gio.DBusActionGroup.get(
                app.get_dbus_connection(),
                app.get_application_id(),
                app.get_dbus_object_path()
            ).activate_action('create-notification', self.get_variant({
                'name': request['name'],
                'title': request['options']['title'],
                'message': request['options']['message'],
                'buttons': request['options']['buttons']
            }))

        elif request['execute'] == 'removeNotification':
            self.withdraw_notification(request['name'])

        debug('Execute: from %s' % request['execute'])

    def check_update(self, update_url):
        result = self.shell_proxy.call_sync(
            "ListExtensions",
            None,
            Gio.DBusCallFlags.NONE,
            -1,
            None
        )

        extensions = result.unpack()[0]

        if extensions:
            http_request = {
                'shell_version': self.shell_proxy.get_cached_property("ShellVersion").unpack(),
                'installed': {}
            }

            for uuid in extensions:
                # gnome-shell/js/misc/extensionUtils.js
                # EXTENSION_TYPE.PER_USER = 2
                if is_uuid(uuid) and extensions[uuid]['type'] == 2:
                    try:
                        http_request['installed'][uuid] = {
                            'version': int(extensions[uuid]['version'])
                        }
                    except (ValueError, KeyError):
                        http_request['installed'][uuid] = {
                            'version': 1
                        }

            http_request['installed'] = json.dumps(http_request['installed'])

            try:
                response = requests.get(
                    update_url,
                    params=http_request,
                    timeout=5
                )
                response.raise_for_status()
                self.send_message({
                    'success': True,
                    'extensions': extensions,
                    'upgrade': response.json()}
                )
            except (
                    requests.ConnectionError, requests.HTTPError, requests.Timeout,
                    requests.TooManyRedirects, requests.RequestException, ValueError
                    ) as ex:
                error_message = str(ex.message) if hasattr(ex, 'message') else str(ex)
                log_error('Unable to check extensions updates: %s' % error_message)

                request_url = ex.response.url if ex.response is not None else ex.request.url
                if request_url:
                    url_parameters = request_url.replace(update_url, "")
                    error_message = error_message.replace(url_parameters, "…")

                self.send_message({'success': False, 'message': error_message})


if __name__ == '__main__':
    debug('Main. Use CTRL+D to quit.')

    run_as_service = False
    if '--gapplication-service' in sys.argv:
        run_as_service = True
        sys.argv.remove('--gapplication-service')

    app = ChromeGNOMEShell(run_as_service)
    app.run(sys.argv)

    debug('Quit')
