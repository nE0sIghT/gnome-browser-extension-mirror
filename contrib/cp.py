#!/usr/bin/python3

import argparse
import os
import shutil
import sys


def main():
    parser = argparse.ArgumentParser(os.path.basename(sys.argv[0]))
    parser.add_argument(
        "--ignore",
        help="Ignore files when copying directory"
    )
    parser.add_argument(
        "--rename",
        help="Rename file"
    )
    parser.add_argument(
        "src",
        help="Source"
    )
    parser.add_argument(
        "dest",
        help="Destination"
    )
    args = parser.parse_args()

    os.makedirs(args.dest, exist_ok=True)

    if os.path.isdir(args.src):
        shutil.copytree(
            args.src,
            args.dest,
            ignore=shutil.ignore_patterns(args.ignore),
            dirs_exist_ok=True
    )
    else:
        shutil.copy(
            args.src,
            (
                args.dest
                if not args.rename
                else os.path.join(args.dest, args.rename)
            )
        )


if __name__ == '__main__':
    main()
