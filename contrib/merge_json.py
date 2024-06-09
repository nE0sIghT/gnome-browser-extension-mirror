# SPDX-License-Identifer: GPL-3.0-or-later

import argparse
import json
import os
import sys


def main():
    parser = argparse.ArgumentParser(os.path.basename(sys.argv[0]))
    parser.add_argument(
        "--delete", default="", help="Remove keys from json, comma separated"
    )
    parser.add_argument("--output", required=True, help="Write output to file")
    parser.add_argument("input", nargs="+", help="Chrome extension key")
    args = parser.parse_args()

    output = {}
    for file in args.input:
        with open(file, "rb") as fp:
            data = json.load(fp)
            for key in args.delete.split(","):
                if key in data:
                    del data[key]

            output = {**output, **data}

    with open(args.output, "wt", encoding="UTF-8") as fp:
        json.dump(output, fp, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
