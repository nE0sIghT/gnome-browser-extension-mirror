/*
    GNOME Shell integration for Chrome
    Copyright (C) 2016-2018  Yuri Konotopov <ykonotopov@gnome.org>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
 */

/* global chrome, COMPAT */

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
