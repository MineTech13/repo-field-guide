"""Fail if any Config.Bind(section, key, ...) uses characters BepInEx rejects.

BepInEx throws on  = \\n \\t \\ " ' [ ]  in section/key names, and the whole plugin
then fails to load. Catch it at build time instead.
Usage: python3 mod/tools/check-config-keys.py mod/src/*.cs
"""
import re
import sys

BAD = set('=\n\t\\"\'[]')
# Config.Bind(<section expr>, "<key>"   where section is a string literal or an identifier
BIND = re.compile(r'Config\.Bind\(\s*(?:"((?:[^"\\]|\\.)*)"|[A-Za-z_][A-Za-z0-9_]*)\s*,\s*"((?:[^"\\]|\\.)*)"')

errors = []
for path in sys.argv[1:]:
    text = open(path, encoding="utf-8").read()
    for m in BIND.finditer(text):
        for name in (m.group(1), m.group(2)):
            if name is None:
                continue
            raw = name.encode().decode("unicode_escape")
            if set(raw) & BAD:
                line = text.count("\n", 0, m.start()) + 1
                errors.append(f"{path}:{line}: invalid config name {name!r}")

if errors:
    print("\n".join(errors))
    sys.exit(1)
print("config key names ok")
