# GNOME Shell browser extension
## Introduction

This repository contains browser extension that provides integration with GNOME Shell and the corresponding
extensions repository https://extensions.gnome.org/.

This extension works in conjuction with [os-native counterpart](https://gitlab.gnome.org/nE0sIghT/gnome-browser-connector).

## Build

First you need to install build requirements:
- meson
- python3
- gettext
- p7zip
- polib python module

Then invoke meson to build extension:
```shell
    meson setup build
    cd build
    meson compile
```

This will produce 2 zip files in `build` folder:
- extension-chrome.zip
- extension-firefox

Those files can be uploaded to corresponding browser Addons website.  
There are also unpacked extensions available under `build/extension` folder that can be loaded in web browsers for development purposes.

## Translations

This project uses [GNOME Translation Project](https://wiki.gnome.org/TranslationProject).   Translation statistics can be obtained on corresponding Damned Lies page.

### Translation strings handling

All user-visible web extension strings are maintained by developers in messages.json file at `extension/extension/_locale/en/` folder. File format is described [here](https://developer.chrome.com/extensions/i18n-messages).

Gettext template located in `po/chrome-gnome-shell.pot` and auto generated using meson:

```shell
    meson -Dbuild_messages=true -Dbuild_extension=false builddir
    cd builddir
    meson compile
```

As result of those commands:
1. New gettext template will be saved to `po/chrome-gnome-shell.pot` file.
2. All `po/*.po` files will be updated by `msgmerge` using new gettext template.
3. All extension locales (messages.json) will be generated from gettext po files.

This process is fully compatible with Damned Lies.

There is limited number of [supported locales](https://developer.chrome.com/webstore/i18n?csw=1#localeTable).  
If you use an unsupported locale, Google Chrome will ignore it.

To create a new translation you can use msginit command (or any po editor) and gettext template. Please refer [Translation Project wiki page](https://wiki.gnome.org/TranslationProject) for further info about optimal translation workflow.
