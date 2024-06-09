// SPDX-License-Identifer: GPL-3.0-or-later

import constants from "./include/constants.js";
import { $ } from "./include/dom.js";
import { i18n } from "./include/i18n.js";
import Integration from "./include/integration.js";
import Synchronize from "./include/sync.js";

function empty(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
}

function isEmptyObject(object) {
    for (const k in object) return false;
    return true;
}

function showWithDelay(element, delay, message) {
    if (message) {
        element.innerHTML = message;
    }

    element.classList.remove('hide');
    element.classList.add('show');
    setTimeout(() => {
        element.classList.remove('show');
        setTimeout(() => {
            element.classList.add('hide');
        }, 250);
    }, delay);
}

function init_tabs() {
    let tabLinks = $("[data-tabs]").querySelectorAll('a');
    let updateTabs = (active = null) => {
        tabLinks.forEach((link) => {
            let tab = $(link.getAttribute("href"));

            if ((!active && link.hasAttribute('data-tabs-active')) || link == active) {
                tab.classList.remove('hide');
            }
            else {
                tab.classList.add('hide');
            }
        });
    };

    tabLinks.forEach((link) => {
        link.addEventListener('click', (event) => {
            updateTabs(event.target);
        });
    });

    updateTabs();
}

function save_options() {
    var showReleaseNotes = $('#show_release_notes_yes').checked;
    var syncExtensions = $('#synchronize_extensions_yes').checked;
    var updateCheck = $('#update_check_yes').checked;
    var updateCheckEnabledOnly = $('#update_check_enabled_yes').checked;
    var updateCheckPeriod = $('#update_check_period').value;
    var useLightIcon = $('#use_light_icon_yes').checked;
    updateCheckPeriod = Math.max(3, updateCheckPeriod);

    chrome.storage.sync.set({
        showReleaseNotes: showReleaseNotes,
        updateCheck: updateCheck,
        updateCheckEnabledOnly: updateCheckEnabledOnly,
        updateCheckPeriod: updateCheckPeriod
    }, function () {
        chrome.storage.local.set({
            syncExtensions: syncExtensions,
            useLightIcon: useLightIcon
        }, function () {
            if (syncExtensions) {
                let syncType = document.getElementById('syncChoice').returnValue;
                if (!syncType || syncType === 'local') {
                    Synchronize.getExtensions().then((extensions) => {
                        var localExtensions = {};
                        for (const [uuid, extension] of Object.entries(extensions)) {
                            if (extension.local && extension.localState != constants.EXTENSION_STATE.UNINSTALLED) {
                                localExtensions[extension.uuid] = {
                                    uuid: extension.uuid,
                                    name: extension.name,
                                    state: extension.localState
                                };
                            }
                        };

                        chrome.storage.sync.set({
                            extensions: localExtensions
                        }, function () {
                            showSuccessStatus();
                        });
                    }).catch((message) => {
                        showWithDelay($('#error'), 15000, message);
                    });
                }
                else if (syncType === 'remote') {
                    chrome.runtime.sendMessage(constants.GS_CHROME_ID, constants.MESSAGE_SYNC_FROM_REMOTE);
                    showSuccessStatus();
                }
            }
            else {
                showSuccessStatus();
            }
        });
    });
}

function showSuccessStatus() {
    // Update status to let user know options were saved.
    showWithDelay($('#status'), 750);
}

function restore_options() {
    init_tabs();

    chrome.storage.sync.get(constants.DEFAULT_SYNC_OPTIONS, function (items) {
        function toggle_notice(show, id) {
            let notice = $('#' + id)
                .closest('dl')
                .querySelector('dt br, dt span.notice');

            if (show) {
                notice.style.display = 'block';
            }
            else {
                notice.style.display = 'none';
            }
        }

        function toggle_update_notice(show) {
            toggle_notice(show, "update_check_yes");
        }

        function toggle_update_enable_notice(show) {
            toggle_notice(show, "update_check_enabled_yes");
        }

        function disable_update_check() {
            if (items.updateCheck) {
                items.updateCheck = false;

                chrome.storage.sync.set({
                    updateCheck: items.updateCheck
                });
            }

            toggle_update_notice(true);
        }

        function disable_update_enabled_only() {
            if (items.updateCheckEnabledOnly) {
                items.updateCheckEnabledOnly = false;

                chrome.storage.sync.set({
                    updateCheckEnabledOnly: items.updateCheckEnabledOnly
                });
            }

            toggle_update_enable_notice(true);
        }

        Integration.onInitialize().then(function (response) {
            if (!Integration.nativeUpdateCheckSupported(response)) {
                disable_update_check();
            }
            else {
                $$("input[name='update_check'], #update_check_period").forEach((input) => input.disabled = false);
                $('#update_check_period').value = items.updateCheckPeriod;
                toggle_update_notice(false);
                retrieveUpdateTimes();
            }

            if (!Integration.nativeUpdateCheckEnabledOnlySupported(response)) {
                disable_update_enabled_only();
            }
            else {
                $("input[name='update_check_enabled']").disabled = false;
                toggle_update_enable_notice(false);
            }

            setCheckUpdate(items.updateCheck);
            setCheckUpdateEnabledOnly(items.updateCheckEnabledOnly);
        }, function (response) {
            disable_update_check();
        });

        setReleaseNotes(items.showReleaseNotes);
    });

    updateSynchronizationStatus();

    chrome.storage.local.get(constants.DEFAULT_LOCAL_OPTIONS, function (items) {
        if (items.syncExtensions) {
            chrome.permissions.contains({
                permissions: ["idle"]
            }, function (result) {
                setSyncExtensions(result);
            });
        }
        else {
            setSyncExtensions(false);
        }

        setLightIcon(items.useLightIcon);
    });
}

function retrieveUpdateTimes() {
    chrome.storage.local.get({
        lastUpdateCheck: null
    }, function (items) {
        if (items.lastUpdateCheck) {
            $('#last_update_check').innerText = items.lastUpdateCheck;
        }
        else {
            $('#last_update_check').innerText = m('never');
        }
    });

    retrieveNextUpdateTime();
}

function retrieveNextUpdateTime() {
    chrome.alarms.get(constants.ALARM_UPDATE_CHECK, function (alarm) {
        if (alarm) {
            $('#next_update_check').innerText = new Date(alarm.scheduledTime).toLocaleString();
        }
        else {
            $('#next_update_check').innerText = m('never');
        }
    });
}

function setCheckUpdate(result) {
    if (result)
        $('#update_check_yes').checked = true;
    else
        $('#update_check_no').checked = true;
}

function setCheckUpdateEnabledOnly(result) {
    if (result)
        $('#update_check_enabled_yes').checked = true;
    else
        $('#update_check_enabled_no').checked = true;
}

function setLightIcon(result) {
    if (result)
        $('#use_light_icon_yes').checked = true;
    else
        $('#use_light_icon_no').checked = true;
}

function setReleaseNotes(result) {
    if (result)
        $('#show_release_notes_yes').checked = true;
    else
        $('#show_release_notes_no').checked = true;
}

function setSyncExtensions(result) {
    if (result)
        $('#synchronize_extensions_yes').checked = true;
    else
        $('#synchronize_extensions_no').checked = true;
}

function handleSynchronize() {
    if ($('#synchronize_extensions_yes').checked) {
        chrome.permissions.request({
            permissions: ["idle"]
        }, function (granted) {
            if (granted) {
                chrome.storage.sync.get({
                    extensions: {}
                }, function (options) {
                    if (!isEmptyObject(options.extensions)) {
                        document.getElementById('syncChoice').showModal();
                    }
                });
            }
            else {
                setSyncExtensions(false);
            }
        });
    }
    else {
        chrome.permissions.remove({
            permissions: ["idle"]
        }, function (removed) {
            setSyncExtensions(!removed);
        });
    }
}

function updateSynchronizationStatus() {
    Synchronize.getExtensions().then((extensions) => {
        var keys = Object.keys(extensions).sort(function (a, b) {
            var nameA = extensions[a].name.toLowerCase();
            var nameB = extensions[b].name.toLowerCase();

            if (nameA < nameB) {
                return -1;
            }

            if (nameA > nameB) {
                return 1;
            }

            return 0;
        });

        empty($('#synchronization table tbody'));
        for (const [key, uuid] of Object.entries(keys)) {
            var extension = extensions[uuid];

            $('#synchronization table tbody').insertAdjacentHTML(
                'beforeEnd',
                `<tr>
					<td>${extension.name}</td>
					<td class='${extension.local && 'ok' || 'fail'}'></td>
					<td class='${extension.localState == constants.EXTENSION_STATE.ENABLED && 'ok' || 'fail'}'></td>
					<td class='${extension.remote && 'ok' || 'fail'}'></td>
				</tr>`
            );
        };
    }).catch((message) => {
        showWithDelay($('#error'), 15000, message);
    });
}

i18n();

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);

document.getElementsByName('synchronize_extensions').forEach((control) => {
    control.addEventListener('change', handleSynchronize);
});


document.getElementById('syncChoice').addEventListener('close', function () {
    if (document.getElementById('syncChoice').returnValue === 'cancel') {
        chrome.permissions.remove({
            permissions: ["idle"]
        }, function (removed) {
            setSyncExtensions(!removed);
        });
    }
});

if (!$('#translation_credits div').firstChild) {
    $('.translation_credits_container').remove();
}

chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName === 'local') {
        if (changes.lastUpdateCheck && changes.lastUpdateCheck.newValue) {
            $('#last_update_check').innerText = changes.lastUpdateCheck.newValue;
        }
    }

    if (areaName === 'sync' && changes.extensions) {
        updateSynchronizationStatus();
    }
});

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (sender.id && sender.id === constants.GS_CHROME_ID && request) {
            if (request === constants.MESSAGE_NEXT_UPDATE_CHANGED) {
                retrieveNextUpdateTime();
            }
            else if (request.signal && request.signal === constants.SIGNAL_EXTENSION_CHANGED) {
                updateSynchronizationStatus();
            }
        }
    }
);
