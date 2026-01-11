#!/usr/bin/env python3

import re
import sys
from pathlib import Path


BUILD_RE = re.compile(
    r"(const\s+BUILD_ID\s*=\s*)(['\"])(\d+)(\2\s*;)"
)


def bump_build_id(app_js_path: Path) -> int:
    text = app_js_path.read_text(encoding="utf-8")

    match = BUILD_RE.search(text)
    if not match:
        raise SystemExit(
            f"Could not find BUILD_ID in {app_js_path}. Expected something like: const BUILD_ID = '1';"
        )

    prefix, quote, number, suffix = match.groups()
    next_number = str(int(number) + 1)

    new_text = BUILD_RE.sub(prefix + quote + next_number + suffix, text, count=1)
    if new_text != text:
        app_js_path.write_text(new_text, encoding="utf-8")
        return int(next_number)

    return int(number)


def set_build_id(app_js_path: Path, new_number: int) -> int:
    text = app_js_path.read_text(encoding="utf-8")

    match = BUILD_RE.search(text)
    if not match:
        raise SystemExit(
            f"Could not find BUILD_ID in {app_js_path}. Expected something like: const BUILD_ID = '1';"
        )

    prefix, quote, _number, suffix = match.groups()
    next_number = str(int(new_number))
    new_text = BUILD_RE.sub(prefix + quote + next_number + suffix, text, count=1)
    if new_text != text:
        app_js_path.write_text(new_text, encoding="utf-8")
    return int(next_number)


def main(argv: list[str]) -> int:
    if len(argv) not in (2, 3):
        print("Usage: bump_build.py /path/to/app.js [NEW_BUILD_NUMBER]", file=sys.stderr)
        return 2

    app_js_path = Path(argv[1]).resolve()
    if not app_js_path.exists():
        print(f"File not found: {app_js_path}", file=sys.stderr)
        return 2

    if len(argv) == 3:
        try:
            new_number = int(argv[2])
        except ValueError:
            print("NEW_BUILD_NUMBER must be an integer", file=sys.stderr)
            return 2
        new_build = set_build_id(app_js_path, new_number)
    else:
        new_build = bump_build_id(app_js_path)

    print(f"BUILD_ID -> {new_build}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
