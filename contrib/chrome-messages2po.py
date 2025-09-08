# SPDX-License-Identifer: GPL-3.0-or-later

import argparse
import json
import os
from datetime import datetime
from shutil import copyfile

import polib
import pytz

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
        "--write-pot",
        "-p",
        action="store_true",
        dest="write_pot",
        help="Write pot to gnome-browser-extension.pot",
    )
    parser.add_argument(
        "--generate-po",
        "-g",
        action="store_true",
        dest="generate_po",
        help="Generate po files from message.json",
    )
    parser.add_argument(
        "--email",
        "-e",
        dest="email",
        required=True,
        help="Email address for Report-Msgid-Bugs-To header field",
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

    args = parser.parse_args()

    if not args.write_pot and not args.generate_po:
        parser.error("Either --write-pot or --generate-po must be specified")

    return args


def run():
    args = parseArguments()

    with open(os.path.join(args.locales, args.lang, "messages.json"), "rb") as file:
        chromeMessages = json.load(file)

    with open(
        os.path.join(args.chrome_store_description, args.lang), "rt", encoding="utf-8"
    ) as file:
        chromeStoreDescription = file.read()

    po = polib.POFile()
    po.header = "\nGNOME Shell integration for Chrome\n"
    po.header += "\n"
    po.header += "DO NOT EDIT!\n"
    po.header += "This file is auto generated with chrome-messages2po tool."
    po.header += "\n"

    po.metadata = {
        "Project-Id-Version": "1.0",
        "Report-Msgid-Bugs-To": args.email,
        "POT-Creation-Date": datetime.now(pytz.utc).strftime("%Y-%m-%d %H:%M%z"),
        "MIME-Version": "1.0",
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Transfer-Encoding": "8bit",
    }

    for messageKey in chromeMessages:
        msgid = chromeMessages[messageKey]["message"]

        if not msgid:
            msgid = messageKey

        entryData = {"msgid": msgid, "occurrences": [(METADATA_SUFFIX + messageKey, 1)]}

        if "description" in chromeMessages[messageKey]:
            entryData["comment"] = chromeMessages[messageKey]["description"]

        if "placeholders" in chromeMessages[messageKey]:
            if "comment" in entryData:
                entryData["comment"] += "\n\n"
            else:
                entryData["comment"] = ""

            entryData["comment"] += "String placeholders:\n"
            for placeholder in chromeMessages[messageKey]["placeholders"]:
                entryData["comment"] += placeholder + "\n"

        po.append(polib.POEntry(**entryData))

    po.append(
        polib.POEntry(
            msgid=chromeStoreDescription,
            comment="Chrome store description",
            occurrences=[(METADATA_STORE_DESCRIPTION, 1)],
        )
    )

    pot_path = os.path.join(args.po, "gnome-browser-extension.pot")
    if args.write_pot:
        po.sort()
        po.save(pot_path)

    if not args.generate_po:
        return

    with open(os.path.join(args.po, "LINGUAS"), "rt", encoding="UTF-8") as file:
        for line in file:
            lang = line.strip()
            chromeLang = lang
            if lang == "pt":
                chromeLang = "pt_PT"

            if not lang or not os.path.isfile(
                os.path.join(args.locales, chromeLang, "messages.json")
            ):
                continue

            with open(
                os.path.join(args.locales, chromeLang, "messages.json"), "rb"
            ) as file:
                chromeMessages = json.load(file)

            po_path = os.path.join(args.po, lang + ".po")

            copyfile(pot_path, po_path)
            po = polib.pofile(po_path)
            po.header = "\nGNOME Shell integration for Chrome\n"
            po.header += "\n"
            po.header += "This file is auto generated with chrome-messages2po tool."
            po.header += "\n"
            po.metadata["Language"] = lang

            for entry in po:
                messageKey = ""
                for occurrence, line in entry.occurrences:
                    if occurrence.startswith(METADATA_SUFFIX):
                        messageKey = occurrence[len(METADATA_SUFFIX) :]
                        break
                    elif occurrence == METADATA_STORE_DESCRIPTION:
                        if os.path.isfile(
                            os.path.join(args.chrome_store_description, chromeLang)
                        ):
                            with open(
                                os.path.join(args.chrome_store_description, chromeLang),
                                "rt",
                                encoding="UTF-8",
                            ) as file:
                                entry.msgstr = file.read()
                                break

                if not messageKey:
                    continue

                if messageKey in chromeMessages:
                    entry.msgstr = chromeMessages[messageKey]["message"]

            po.sort()
            po.save(po_path)


if __name__ == "__main__":
    run()
