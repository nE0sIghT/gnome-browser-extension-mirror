// SPDX-License-Identifer: GPL-3.0-or-later

/*
 * Main object that handles extensions synchronization with remote storage.
 */
GSC.sync = (function($) {
	var enabled = true;
	var extensionChangedTimeout = false;
	var extensionChangedQueue = {};

	const SYNC_QUEUE_TIMEOUT = 7000;

	/*
	 * Initialization rutines.
	 */
	function init() {
		if(!COMPAT.SYNC_STORAGE)
		{
			enabled = false;
			return;
		}

		function onIdleStateChanged(state) {
			if (state === 'locked')
			{
				enabled = false;

				// Remove all disabled extensions from queue
				for (const [extensionId, extension] of Object.entries(extensionChangedQueue)) {
					if(extension.state == EXTENSION_STATE.DISABLED)
					{
						delete extensionChangedQueue[extensionId];
					}
				};
			}
			else if (state === 'active')
			{
				enabled = true;
			}
		}

		chrome.permissions.contains({
			permissions: ["idle"]
		}, function (result) {
			if(result)
			{
				chrome.idle.onStateChanged.addListener(onIdleStateChanged);
			}
			else
			{
				enabled = false;
			}
		});

		chrome.permissions.onAdded.addListener(function(permissions) {
			if(permissions.permissions && permissions.permissions.indexOf('idle') !== -1)
			{
				enabled = true;
				chrome.idle.onStateChanged.addListener(onIdleStateChanged);
			}
		});

		chrome.permissions.onRemoved.addListener(function(permissions) {
			if(permissions.permissions && permissions.permissions.indexOf('idle') !== -1)
			{
				enabled = false;
				chrome.idle.onStateChanged.removeListener(onIdleStateChanged);
			}
		});

		function onNotificationAction(notificationId, buttonIndex) {
			if (notificationId !== NOTIFICATION_SYNC_FAILED)
			{
				return;
			}

			GSC.notifications.remove(notificationId);
		}

		onSyncFromRemote();
		chrome.storage.onChanged.addListener(function(changes, areaName) {
			if(areaName === 'sync' && changes.extensions)
			{
				onSyncFromRemote(changes.extensions.newValue);
			}
		});

		chrome.runtime.onMessage.addListener(
			function (request, sender, sendResponse) {
				if (sender.id && sender.id === GS_CHROME_ID && request)
				{
					if (request === MESSAGE_SYNC_FROM_REMOTE)
					{
						onSyncFromRemote();
					}
				}
			}
		);

		GSC.onInitialize().then(response => {
			/*
				@Deprecated: remove browser notifications in version 9
			 */
			if (!GSC.nativeNotificationsSupported(response))
			{
				chrome.notifications.onButtonClicked.addListener(onNotificationAction);
			}
			else
			{
				chrome.runtime.onMessage.addListener(
					function (request, sender, sendResponse) {
						if(
							sender.id && sender.id === GS_CHROME_ID &&
							request && request.signal)
						{
							if(request.signal == SIGNAL_NOTIFICATION_ACTION)
							{
								onNotificationAction(request.name, request.button_id);
							}
						}
					}
				);
			}
		});
	}

	/*
	 * Returns array of all local and remote extensions with structure:
	 * [
	 *	$extension_uuid: {
	 *		uuid:		extension uuid,
	 *		name:		extension name,
	 *		remoteState:	extension state in remote storage,
	 *		localState:	extension state in current GNOME Shell,
	 *		remote:		true if extensions is in remote storage,
	 *		local:		true if extension installed localy
	 *	},
	 *	...
	 * ]
	 */
	function getExtensions(remoteExtensions) {
		return new Promise((resolve, reject) => {
			GSC.sendNativeRequest({
				execute: 'listExtensions'
			}, function(response) {
				if(response && response.success)
				{
					if(remoteExtensions)
					{
						resolve(mergeExtensions(remoteExtensions, response.extensions));
					}
					else
					{
						chrome.storage.sync.get({
							extensions: {}
						}, function(options) {
							if(chrome.runtime.lastError)
							{
								reject(chrome.runtime.lastError.message);
							}
							else
							{
								resolve(mergeExtensions(options.extensions, response.extensions));
							}
						});
					}
				}
				else
				{
					var message = response && response.message ? response.message : m('error_connector_response');
					reject(message);
				}
			});
		});
	}

	/*
	 * Returns merged list of extensions list in remote storage and
	 * locally installed extensions.
	 * 
	 * Both parameters should be in form:
	 * {
	 *	$extension_uuid: {
	 *		uuid:	,
	 *		name:	,
	 *		state:	
	 *	},
	 *	...
	 * }
	 */
	function mergeExtensions(remoteExtensions, localExtensions)
	{
		var extensions = {};

		for (const [key, extension] of Object.entries(remoteExtensions)) {
			if(extension.uuid && extension.name && extension.state)
			{
				extensions[extension.uuid] = {
					uuid:		extension.uuid,
					name:		extension.name,
					remoteState:	extension.state,
					remote:		true,
					local:		false
				};
			}
		};

		for (const [key, extension] of Object.entries(localExtensions)) {
			if(extensions[extension.uuid])
			{
				extensions[extension.uuid].name = extension.name;
				extensions[extension.uuid].localState = extension.state;
				extensions[extension.uuid].local = true;
			}
			else
			{
				extensions[extension.uuid] = {
					uuid:		extension.uuid,
					name:		extension.name,
					remoteState:	EXTENSION_STATE.UNINSTALLED,
					localState:	extension.state,
					remote:		false,
					local:		true
				};
			}
		};

		return extensions;
	}

	/*
	 * Synchronize local changed extensions to remote list.
	 */
	function localExtensionsChanged() {
		extensionChangedTimeout = false;

		if (!isEmptyObject(extensionChangedQueue))
		{
			GSC.sendNativeRequest({
				execute: 'listExtensions'
			}, function (response) {
				if (response && response.success && response.extensions)
				{
					chrome.storage.sync.get({
						extensions: {}
					}, function (options) {
						for (const [extensionId, extension] of Object.entries(extensionChangedQueue)) {
							if ([EXTENSION_STATE.ENABLED, EXTENSION_STATE.DISABLED, EXTENSION_STATE.UNINSTALLED].includes(extension.state))
							{
								// Extension can be uninstalled already
								if (response.extensions[extensionId] && !isEmptyObject(response.extensions[extensionId]))
								{
									extension = response.extensions[extensionId];
								}

								if (extension.state === EXTENSION_STATE.UNINSTALLED && options.extensions[extension.uuid])
								{
									delete options.extensions[extension.uuid];
								}
								else
								{
									options.extensions[extension.uuid] = {
										uuid: extension.uuid,
										name: extension.name,
										state: extension.state
									};
								}
							}
						};

						chrome.storage.sync.set({
							extensions: options.extensions
						});

						extensionChangedQueue = {};
					});
				}
				else
				{
					createSyncFailedNotification();
				}
			});
		}
	}

	/*
	 * Synchronize remote changes with local GNOME Shell.
	 * 
	 * @param remoteExtensions - (optional) remote extensions list
	 */
	function remoteExtensionsChanged(remoteExtensions) {
		getExtensions(remoteExtensions).then((extensions) => {
			var enableExtensions = [];
			for ([uuid, extension] of Object.entries(extensions)) {
				if(extension.remote)
				{
					if(!extension.local)
					{
						GSC.sendNativeRequest({
							execute: "installExtension",
							uuid: extension.uuid
						}, onInstallUninstall);
					}
					else if (extension.remoteState !== extension.localState)
					{
						if(extension.remoteState === EXTENSION_STATE.ENABLED)
						{
							enableExtensions.push({
								uuid: extension.uuid,
								enable: true
							});
						}
						else
						{
							enableExtensions.push({
								uuid: extension.uuid,
								enable: false
							});
						}
					}
				}
				else if(extension.local)
				{
					GSC.sendNativeRequest({
						execute: "uninstallExtension",
						uuid: extension.uuid
					}, onInstallUninstall);
				}
			};

			if(enableExtensions.length > 0)
			{
				GSC.sendNativeRequest({
					execute: "enableExtension",
					extensions: enableExtensions
				});
			}
		}).catch((message) => {
			createSyncFailedNotification(message);
		});
	}

	/*
	 * Callback called when extension is installed or uninstalled as part
	 * of synchronization process.
	 */
	function onInstallUninstall(response) {
		if(response)
		{
			if(!response.success)
			{
				createSyncFailedNotification(response.message);
			}
		}
		else
		{
			createSyncFailedNotification();
		}
	}

	/*
	 * Wrapper for localExtensionChanged that checks if synchronization is
	 * enabled.
	 */
	function onExtensionChanged(request)
	{
		if(!COMPAT.SYNC_STORAGE || !enabled)
		{
			return;
		}

		runIfSyncEnabled(() => {
			if (extensionChangedTimeout)
			{
				clearTimeout(extensionChangedTimeout);
			}

			extensionChangedQueue[request.parameters[EXTENSION_CHANGED_UUID]] = {
				uuid: request.parameters[EXTENSION_CHANGED_UUID],
				state: request.parameters[EXTENSION_CHANGED_STATE],
				error: request.parameters[EXTENSION_CHANGED_ERROR]
			};

			extensionChangedTimeout = setTimeout(function () {
				localExtensionsChanged();
			}, SYNC_QUEUE_TIMEOUT);
		});
	}

	/*
	 * Wrapper for remoteExtensionsChanged that checks if synchronization is
	 * enabled.
	 */
	function onSyncFromRemote(remoteExtensions)
	{
		if(!COMPAT.SYNC_STORAGE)
		{
			return;
		}

		runIfSyncEnabled(function() {
			remoteExtensionsChanged(remoteExtensions);
		});
	}

	/*
	 * Runs callback function if synchronyzation is enabled.
	 * 
	 * @param callback - callback function
	 */
	function runIfSyncEnabled(callback) {
		chrome.storage.local.get({
			syncExtensions: false
		}, function (options) {
			if (options.syncExtensions)
			{
				chrome.permissions.contains({
					permissions: ["idle"]
				}, function (result) {
					if (result)
					{
						callback();
					}
				});

			}
		});
	}

	/*
	 * Create notification when synchronization failed.
	 */
	function createSyncFailedNotification(cause) {
		GSC.notifications.create(NOTIFICATION_SYNC_FAILED, {
			message: m('synchronization_failed', cause ? cause : m('unknown_error'))
		});
	}

	/*
	 * Public methods.
	 */
	return {
		init: init,
		getExtensions: getExtensions,
		onExtensionChanged: onExtensionChanged
	};
})();
