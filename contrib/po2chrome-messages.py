# SPDX-License-Identifer: GPL-3.0-or-later

import argparse
import json
import os
from copy import copy

import polib

METADATA_SUFFIX = "chrome-gnome-shell-key-"
METADATA_STORE_DESCRIPTION = "chrome-gnome-shell-store-description"


class Directory(argparse.Action):
    def __call__(self, parser, namespace, values, option_string=None):
        prospective_dir = values
        if not os.path.isdir(prospective_dir):
            raise argparse.ArgumentTypeError(
                "Directory: {0} is not a valid path".format(prospective_dir)
            )
        if os.access(prospective_dir, os.R_OK):
            setattr(namespace, self.dest, prospective_dir)
        else:
            raise argparse.ArgumentTypeError(
                "Directory: {0} is not a readable dir".format(prospective_dir)
            )


def parseArguments():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--reference-lang", "-l", dest="lang", default="en", help="Reference language"
    )
    parser.add_argument(
        "chrome_store_description",
        action=Directory,
        metavar="<chrome store dir>",
        help="Directory contains Chrome store description files",
    )
    parser.add_argument(
        "locales",
        action=Directory,
        metavar="<locales dir>",
        help="Path to extension _locales directory",
    )
    parser.add_argument(
        "po", action=Directory, metavar="<po dir>", help="Directory for gettext files"
    )

    return parser.parse_args()


def find_chrome_entry(po, key, exact=False):
    for entry in po:
        for occurrence, line in entry.occurrences:
            if exact and occurrence == key:
                return entry
            elif occurrence == METADATA_SUFFIX + key:
                return entry


def run():
    args = parseArguments()

    with open(os.path.join(args.locales, args.lang, "messages.json"), "rb") as file:
        chromeMessages = json.load(file)

    with open(os.path.join(args.po, "LINGUAS"), "rt", encoding="utf-8") as file:
        for line in file:
            lang = line.strip()
            chromeLang = lang
            if lang == "pt":
                chromeLang = "pt_PT"

            po_path = os.path.join(args.po, lang + ".po")

            if not lang or not os.path.isfile(po_path):
                continue

            print("Processing " + lang)

            with open(po_path, "rt", encoding="utf-8") as file:
                po = polib.pofile(po_path)

            messages = {
                "_DO_NOT_EDIT": {
                    "message": "",
                    "description": "This file is auto generated with po2chrome-messages tool from "
                    + lang
                    + ".po.",
                }
            }
            for messageKey in chromeMessages:
                messageEntry = copy(chromeMessages[messageKey])

                entry = find_chrome_entry(po, messageKey)
                if entry and entry.msgstr and "fuzzy" not in entry.flags:
                    messageEntry["message"] = entry.msgstr

                messages[messageKey] = messageEntry

            os.makedirs(os.path.join(args.locales, chromeLang), exist_ok=True)
            with open(
                os.path.join(args.locales, chromeLang, "messages.json"),
                "wt",
                encoding="UTF-8",
            ) as file:
                json.dump(messages, file, indent="\t", sort_keys=True)
                file.write("\n")

            entry = find_chrome_entry(po, METADATA_STORE_DESCRIPTION, exact=True)
            if entry and entry.msgstr and "fuzzy" not in entry.flags:
                with open(
                    os.path.join(args.chrome_store_description, chromeLang),
                    "wt",
                    encoding="UTF-8",
                ) as file:
                    file.write(entry.msgstr)
            else:
                try:
                    os.remove(os.path.join(args.chrome_store_description, chromeLang))
                except FileNotFoundError:
                    pass


if __name__ == "__main__":
    run()
