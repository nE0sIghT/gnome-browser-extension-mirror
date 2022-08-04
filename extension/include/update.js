// SPDX-License-Identifer: GPL-3.0-or-later

GSC.update = (function () {
    function schedule(updateCheckPeriod, skipCheck) {
        if (!skipCheck) {
            check();
        }

        chrome.alarms.create(
            ALARM_UPDATE_CHECK,
            {
                delayInMinutes: updateCheckPeriod * 60,
                periodInMinutes: updateCheckPeriod * 60
            }
        );

        chrome.runtime.sendMessage(GS_CHROME_ID, MESSAGE_NEXT_UPDATE_CHANGED);
    }

    function check() {
        GSC.onInitialize().then(response => {
            if (response.success) {
                if (GSC.nativeUpdateCheckSupported(response)) {
                    chrome.storage.sync.get(DEFAULT_SYNC_OPTIONS, function (options) {
                        GSC.sendNativeRequest(
                            {
                                execute: 'checkUpdate',
                                url: UPDATE_URL,
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
            GSC.notifications.create(NOTIFICATION_UPDATE_AVAILABLE, {
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
        function onNotificationAction(notificationId, buttonIndex) {
            if (NOTIFICATION_UPDATE_AVAILABLE == notificationId)
                return;

            GSC.notifications.remove(notificationId);
        }

        function onNotificationClicked(notificationId) {
            if (notificationId === NOTIFICATION_UPDATE_AVAILABLE) {
                chrome.tabs.create({
                    url: EXTENSIONS_WEBSITE + 'local/',
                    active: true
                });
            }
        }

        chrome.alarms.onAlarm.addListener(function (alarm) {
            if (alarm.name === ALARM_UPDATE_CHECK) {
                check();

                chrome.alarms.get(ALARM_UPDATE_CHECK, function (alarm) {
                    if (alarm && alarm.periodInMinutes && ((alarm.scheduledTime - Date.now()) / 1000 / 60 < alarm.periodInMinutes * 0.9)) {
                        schedule(alarm.periodInMinutes / 60, true);
                    }
                    else {
                        chrome.runtime.sendMessage(GS_CHROME_ID, MESSAGE_NEXT_UPDATE_CHANGED);
                    }
                });
            }
        });

        GSC.onInitialize().then(response => {
            /*
                @Deprecated: remove browser notifications in version 9
             */
            if (!GSC.nativeNotificationsSupported(response)) {
                chrome.notifications.onClicked.addListener(function (notificationId) {
                    onNotificationClicked(notificationId);
                });

                chrome.notifications.onButtonClicked.addListener(onNotificationAction);
            }
            else {
                window.addEventListener("message", function (event) {
                    if (event.source == window && event.data && event.data.signal) {
                        if (event.data.signal == SIGNAL_NOTIFICATION_ACTION) {
                            onNotificationAction(event.data.name, event.data.button_id);
                        }
                        else if (event.data.signal == SIGNAL_NOTIFICATION_CLICKED) {
                            onNotificationClicked(event.data.name);
                        }
                    }
                });
            }
        });

        chrome.storage.onChanged.addListener(function (changes, areaName) {
            if (changes.updateCheck) {
                if (!changes.updateCheck.newValue) {
                    chrome.alarms.clear(ALARM_UPDATE_CHECK);
                }
                else {
                    chrome.storage.sync.get(DEFAULT_SYNC_OPTIONS, function (options) {
                        schedule(options.updateCheckPeriod);
                    });
                }
            }
            else if (changes.updateCheckPeriod) {
                chrome.storage.sync.get(DEFAULT_SYNC_OPTIONS, function (options) {
                    if (options.updateCheck) {
                        schedule(options.updateCheckPeriod);
                    }
                });
            }
        });

        chrome.storage.sync.get(DEFAULT_SYNC_OPTIONS, function (options) {
            if (options.updateCheck) {
                chrome.alarms.get(ALARM_UPDATE_CHECK, function (alarm) {
                    if (!alarm || !alarm.periodInMinutes || alarm.periodInMinutes !== options.updateCheckPeriod * 60) {
                        schedule(options.updateCheckPeriod);
                    }
                });
            }
        });
    }

    return {
        init: init,
        check: check,
        schedule: schedule
    };
})();
