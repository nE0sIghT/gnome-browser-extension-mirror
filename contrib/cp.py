# SPDX-License-Identifer: GPL-3.0-or-later

import argparse
import os
import shutil
import sys
import tempfile


def main():
    parser = argparse.ArgumentParser(os.path.basename(sys.argv[0]))
    parser.add_argument("--ignore", help="Ignore files when copying directory")
    parser.add_argument("--rename", help="Rename file")
    parser.add_argument(
        "--es6-module", action="store_true", help="Drop `export` from es6 module"
    )
    parser.add_argument("src", help="Source")
    parser.add_argument("dest", help="Destination")
    args = parser.parse_args()

    os.makedirs(args.dest, exist_ok=True)

    if os.path.isdir(args.src):
        shutil.copytree(
            args.src,
            args.dest,
            ignore=shutil.ignore_patterns(args.ignore),
            dirs_exist_ok=True,
        )
    else:
        target_name: str = (
            args.dest if not args.rename else os.path.join(args.dest, args.rename)
        )
        shutil.copy(
            args.src,
            target_name,
        )

        if args.es6_module:
            with tempfile.NamedTemporaryFile(mode="wt", encoding="UTF-8") as temp:
                with open(target_name, "rt", encoding="UTF-8") as fp:
                    for line in fp:
                        if line.strip().startswith("export "):
                            continue

                        temp.write(line)

                temp.flush()
                shutil.copy(temp.name, target_name)


if __name__ == "__main__":
    main()
