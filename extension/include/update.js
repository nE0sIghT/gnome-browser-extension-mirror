// SPDX-License-Identifer: GPL-3.0-or-later

import bus from "./bus.js";
import constants from "./constants.js";
import { m } from "./i18n.js";
import Integration from "./integration.js";
import Notifications from "./notifications.js";

const Updater = (function () {
    function schedule(updateCheckPeriod, skipCheck) {
        if (!skipCheck) {
            check();
        }

        chrome.alarms.create(
            constants.ALARM_UPDATE_CHECK,
            {
                delayInMinutes: updateCheckPeriod * 60,
                periodInMinutes: updateCheckPeriod * 60
            }
        );

        chrome.runtime.sendMessage(constants.GS_CHROME_ID, constants.MESSAGE_NEXT_UPDATE_CHANGED);
    }

    function check() {
        Integration.onInitialize().then(response => {
            if (response.success) {
                if (Integration.nativeUpdateCheckSupported(response)) {
                    chrome.storage.sync.get(constants.DEFAULT_SYNC_OPTIONS, function (options) {
                        Integration.sendNativeRequest(
                            {
                                execute: 'checkUpdate',
                                url: constants.UPDATE_URL,
                                enabledOnly: options.updateCheckEnabledOnly
                            }, function (response) {
                                if (response.success) {
                                    onSweetToothResponse(response.upgrade, response.extensions);
                                }
                                else if (console) {
                                    console.error(response.message ? response.message : m('native_request_failed', 'checkUpdate'));
                                }
                            });
                    });
                }
                else {
                    chrome.storage.sync.set({
                        updateCheck: false
                    });
                }
            }
            else if (console) {
                console.error(response.message ? response.message : m('native_request_failed', 'initialize'));
            }
        });
    }

    function onSweetToothResponse(data, installedExtensions) {
        var toUpgrade = [];
        for (uuid in data) {
            if (installedExtensions[uuid] && ['upgrade', 'downgrade'].includes(data[uuid])) {
                toUpgrade.push({
                    title: installedExtensions[uuid].name,
                    message: m('extension_status_' + data[uuid])
                });
            }
        }

        if (toUpgrade.length > 0) {
            Notifications.create(constants.NOTIFICATION_UPDATE_AVAILABLE, {
                type: chrome.notifications.TemplateType.LIST,
                title: m('update_available'),
                message: '',
                items: toUpgrade
            });
        }

        chrome.storage.local.set({
            lastUpdateCheck: new Date().toLocaleString()
        });
    }

    function init() {
        chrome.alarms.onAlarm.addListener(function (alarm) {
            if (alarm.name === constants.ALARM_UPDATE_CHECK) {
                check();

                chrome.alarms.get(constants.ALARM_UPDATE_CHECK, function (alarm) {
                    if (alarm && alarm.periodInMinutes && ((alarm.scheduledTime - Date.now()) / 1000 / 60 < alarm.periodInMinutes * 0.9)) {
                        schedule(alarm.periodInMinutes / 60, true);
                    }
                    else {
                        chrome.runtime.sendMessage(constants.GS_CHROME_ID, constants.MESSAGE_NEXT_UPDATE_CHANGED);
                    }
                });
            }
        });

        Integration.onInitialize().then(response => {
            if (!Integration.nativeNotificationsSupported(response)) {
                bus.removeEventListener("message", on_message);
            }
        });

        chrome.storage.onChanged.addListener(function (changes, areaName) {
            if (changes.updateCheck) {
                if (!changes.updateCheck.newValue) {
                    chrome.alarms.clear(constants.ALARM_UPDATE_CHECK);
                }
                else {
                    chrome.storage.sync.get(constants.DEFAULT_SYNC_OPTIONS, function (options) {
                        schedule(options.updateCheckPeriod);
                    });
                }
            }
            else if (changes.updateCheckPeriod) {
                chrome.storage.sync.get(constants.DEFAULT_SYNC_OPTIONS, function (options) {
                    if (options.updateCheck) {
                        schedule(options.updateCheckPeriod);
                    }
                });
            }
        });

        chrome.storage.sync.get(constants.DEFAULT_SYNC_OPTIONS, function (options) {
            if (options.updateCheck) {
                chrome.alarms.get(constants.ALARM_UPDATE_CHECK, function (alarm) {
                    if (!alarm || !alarm.periodInMinutes || alarm.periodInMinutes !== options.updateCheckPeriod * 60) {
                        schedule(options.updateCheckPeriod);
                    }
                });
            }
        });
    }

    function on_message(event) {
        function onNotificationAction(notificationId, buttonIndex) {
            if (constants.NOTIFICATION_UPDATE_AVAILABLE == notificationId)
                return;

            Notifications.remove(notificationId);
        }

        function onNotificationClicked(notificationId) {
            if (notificationId === constants.NOTIFICATION_UPDATE_AVAILABLE) {
                chrome.tabs.create({
                    url: constants.EXTENSIONS_MAIN_WEBSITE + 'local/',
                    active: true
                });
            }
        }

        Integration.onInitialize().then(response => {
            if (!Integration.nativeNotificationsSupported(response)) {
                return
            }

            if (event?.data?.signal) {
                if (event.data.signal == constants.SIGNAL_NOTIFICATION_ACTION) {
                    onNotificationAction(event.data.name, event.data.button_id);
                }
                else if (event.data.signal == constants.SIGNAL_NOTIFICATION_CLICKED) {
                    onNotificationClicked(event.data.name);
                }
            }
        });
    }

    bus.addEventListener("message", on_message);

    return {
        init: init,
        check: check,
        schedule: schedule
    };
})();

export default Updater;
