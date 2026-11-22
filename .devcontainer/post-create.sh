#!/usr/bin/env bash
# Runs once after the dev container is created.
set -euo pipefail

echo "▸ Installing website dependencies"
npm ci

if [ -f mod/RepoFieldGuide.Companion.csproj ]; then
  echo "▸ Restoring mod dependencies"
  dotnet restore mod/RepoFieldGuide.Companion.csproj
fi

echo
echo "Tools:"
echo "  node     $(node -v)"
echo "  npm      $(npm -v)"
echo "  dotnet   $(dotnet --version)"
echo "  ilspycmd $(ilspycmd --version 2>/dev/null | head -1)"
echo "  gh       $(gh --version | head -1)"
echo "  claude   $(claude --version 2>/dev/null || echo 'not found')"
echo
if [ -f /game/Managed/Assembly-CSharp.dll ]; then
  echo "Game assemblies: /game/Managed (read-only) ✓"
else
  echo "Game assemblies not mounted. Fix the path in .devcontainer/devcontainer.json to build against the real game."
fi
echo
echo "Website:  npm run dev        (http://localhost:5173)"
echo "Checks:   npm run check"
