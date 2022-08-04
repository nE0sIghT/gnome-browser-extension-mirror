// SPDX-License-Identifer: GPL-3.0-or-later

/* global chrome, COMPAT */

$ = (...args) => document.querySelector(...args);
$$ = (...args) => document.querySelectorAll(...args);

function empty(element) {
	while(element.firstChild) element.removeChild(element.firstChild);
}

function isEmptyObject(object) {
	for (const k in object) return false;
	return true;
}

function showWithDelay(element, delay, message) {
	if (message) {
		element.innerHtml = message;
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

COMPAT.PERMISSIONS_CONTAINS		= true;
COMPAT.PERMISSIONS_EVENTS		= true;
COMPAT.SYNC_STORAGE				= true;
COMPAT.NOTIFICATIONS_BUTTONS	= (!COMPAT.IS_FIREFOX || false);

if(COMPAT.IS_FIREFOX)
{
	chrome.runtime.onMessageExternal = {
		addListener: chrome.runtime.onMessage.addListener
	};
}

if(typeof(chrome.permissions) === 'undefined')
{
	chrome.permissions = {
		contains: function(permissions, callback) {
			callback(false);
		}
	};
	COMPAT.PERMISSIONS_CONTAINS = false;
}

if(typeof(chrome.permissions.onAdded) === 'undefined' || typeof(chrome.permissions.onRemoved) === 'undefined')
{
	chrome.permissions.onAdded = {
		addListener: function(callback) {
			chrome.runtime.onMessage.addListener(
				function (request, sender, sendResponse) {
					if (sender.id && sender.id === GS_CHROME_ID && request)
					{
						if (request === MESSAGE_IDLE_PERMISSION_ADDED)
						{
							callback({
								permissions: ['idle']
							});
						}
					}
				}
			);
		},
		removeListener: function(callback) {
			chrome.runtime.onMessage.removeListener(callback);
		},
		hasListener: function(callback) {
			return chrome.runtime.onMessage.hasListener(callback);
		}
	}

	chrome.permissions.onRemoved = {
		addListener: function(callback) {
			chrome.runtime.onMessage.addListener(
				function (request, sender, sendResponse) {
					if (sender.id && sender.id === GS_CHROME_ID && request)
					{
						if (request === MESSAGE_IDLE_PERMISSION_REMOVED)
						{
							callback({
								permissions: ['idle']
							});
						}
					}
				}
			);
		},
		removeListener: function(callback) {
			chrome.runtime.onMessage.removeListener(callback);
		},
		hasListener: function(callback) {
			return chrome.runtime.onMessage.hasListener(callback);
		}
	}

	COMPAT.PERMISSIONS_EVENTS = false;
}

if(typeof(chrome.storage.sync) === 'undefined')
{
	chrome.storage.sync = chrome.storage.local;
	COMPAT.SYNC_STORAGE = false;
}
