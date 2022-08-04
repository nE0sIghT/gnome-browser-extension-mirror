// SPDX-License-Identifer: GPL-3.0-or-later

GS_CHROME_ID				= chrome.runtime.id;
PLATFORMS_WHITELIST			= ["freebsd", "linux", "openbsd"];

COMPAT = {
	IS_FIREFOX:	 CSS.supports("-moz-appearance: none"),
};

NOTIFICATION_SYNC_FAILED		= 'gs-chrome-sync-fail';
NOTIFICATION_UPDATE_AVAILABLE		= 'gs-chrome-update';
ALARM_UPDATE_CHECK			= 'gs-chrome-update-check';

MESSAGE_NEXT_UPDATE_CHANGED		= 'gs-next-update-changed';
MESSAGE_SYNC_FROM_REMOTE		= 'gs-sync-from-remote';
MESSAGE_IDLE_PERMISSION_ADDED	= 'gs-idle-added';
MESSAGE_IDLE_PERMISSION_REMOVED	= 'gs-idle-removed';

SIGNAL_EXTENSION_CHANGED		= 'ExtensionStatusChanged';
SIGNAL_NOTIFICATION_ACTION		= 'NotificationAction';
SIGNAL_NOTIFICATION_CLICKED		= 'NotificationClicked';
SIGNAL_SHELL_SETTING_CHANGED	= 'ShellSettingsChanged';
SIGNAL_SHELL_APPEARED			= 'org.gnome.Shell';

EXTENSION_CHANGED_UUID			= 0;
EXTENSION_CHANGED_STATE			= 1;
EXTENSION_CHANGED_ERROR			= 2;

NATIVE_HOST				= 'org.gnome.chrome_gnome_shell';

EXTENSIONS_WEBSITE			= [
	'https://extensions.gnome.org/',
];
UPDATE_URL				= EXTENSIONS_WEBSITE + 'update-info/';

DEFAULT_SYNC_OPTIONS			= {
	showReleaseNotes:	true,
	updateCheck:		true,
	updateCheckEnabledOnly: true,
	updateCheckPeriod:	6
};

DEFAULT_LOCAL_OPTIONS			= {
	syncExtensions:		false,
	useLightIcon:		false
};

EXTERNAL_MESSAGES			= [
	"error_connector_response",
	"no_gnome_shell",
	"no_host_connector",
	"warning_apis_missing"
];

// gnome-shell/js/ui/extensionSystem.js
EXTENSION_STATE			= {
	ENABLED:	1,
	DISABLED:	2,
	ERROR:		3,
	OUT_OF_DATE:	4,
	DOWNLOADING:	5,
	INITIALIZED:	6,

	// Used as an error state for operations on unknown extensions,
	// should never be in a real extensionMeta object.
	UNINSTALLED:	99
};

// gnome-shell/js/misc/extensionUtils.js
EXTENSION_TYPE			= {
    SYSTEM:		1,
    PER_USER:	2
};
