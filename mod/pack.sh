#!/usr/bin/env bash
# Build the companion and pack it as a Thunderstore/r2modman zip.
#   bash mod/pack.sh                    → mod/dist/RepoFieldGuide_Companion-<version>.zip
#   bash mod/pack.sh --install Merged   → also copy the DLL into that r2modman profile
set -euo pipefail
cd "$(dirname "$0")"

dotnet build -c Release --nologo -v q
version=$(jq -r .version_number thunderstore/manifest.json)
python3 tools/make-icon.py thunderstore/icon.png

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/plugins" dist
cp thunderstore/manifest.json thunderstore/README.md thunderstore/icon.png "$stage/"
cp bin/Release/netstandard2.1/RepoFieldGuide.Companion.dll "$stage/plugins/"
rm -f "dist/RepoFieldGuide_Companion-$version.zip"
(cd "$stage" && zip -qr "$OLDPWD/dist/RepoFieldGuide_Companion-$version.zip" .)
echo "Packed dist/RepoFieldGuide_Companion-$version.zip"

if [ "${1:-}" = "--install" ]; then
  profile="${2:?profile name, e.g. Merged}"
  target="${R2MODMAN_PROFILES:-/r2modman/profiles}/$profile/BepInEx/plugins/MineTech13-RepoFieldGuide_Companion"
  mkdir -p "$target"
  cp "$stage/plugins/RepoFieldGuide.Companion.dll" "$stage/manifest.json" "$stage/README.md" "$stage/icon.png" "$target/"
  echo "Installed into r2modman profile '$profile' (restart the game to load it)."
fi
