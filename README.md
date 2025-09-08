# GNOME Shell browser extension
## Introduction

This repository contains the browser extension that provides integration with GNOME Shell and the corresponding
extensions repository at https://extensions.gnome.org/.

This extension works in conjunction with its [os-native counterpart](https://gitlab.gnome.org/nE0sIghT/gnome-browser-connector).

## Build

First you need to install the build requirements:
- meson
- python3
- gettext
- p7zip
- polib python module

Then invoke meson to build the extension:
```shell
    meson builddir
    cd builddir
    meson compile
```

This will produce 2 zip files in the `builddir` folder:
- extension-chrome.zip
- extension-firefox.zip

These files can be uploaded to the corresponding browser add-on websites.  
Unpacked extensions are also available in the `builddir/extension` folder which can be loaded in web browsers for development purposes.

## Translations

This project uses the [GNOME Translation Project](https://welcome.gnome.org/ru/team/translation/).   Translation statistics can be obtained on the corresponding Damned Lies page.

### Translation strings handling

All user-visible web extension strings are maintained by developers in the messages.json file, which is located in the `extension/extension/_locale/en/` folder. The file format is described [here](https://developer.chrome.com/extensions/i18n-messages).

The Gettext template is located in `po/gnome-browser-extension.pot` and automatically generated using meson:

```shell
    meson -Dbuild_messages=true -Dbuild_extension=false builddir
    cd builddir
    meson compile
```

As result of those commands:
1. The new gettext template will be saved in `po/gnome-browser-extension.pot`.
2. All `po/*.po` files will be updated by `msgmerge` using the new gettext template.
3. All extension locales (messages.json) will be generated from the gettext po files.

This process is fully compatible with Damned Lies.

There is a limited number of [supported locales](https://developer.chrome.com/webstore/i18n?csw=1#localeTable).  
If you use an unsupported locale, Google Chrome will ignore it.

To create a new translation, you can use the `msginit` command (or any po editor) and the gettext template. Please refer to the [Translation Project wiki page](https://welcome.gnome.org/ru/team/translation/) for further information about optimal translation workflow.
