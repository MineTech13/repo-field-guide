# R.E.P.O. Field Guide dev container.
# Everything needed to work on the website and the companion mod lives here,
# so nothing has to be installed on the host. Works with Podman or Docker.
#
#   .NET 8 SDK  - build the BepInEx mod (from the base image)
#   Node 22     - website (Vite, tests)
#   ilspycmd    - decompile the game assembly to check game data
#   gh          - GitHub CLI (releases, PRs)
#   claude      - Claude Code CLI
FROM docker.io/library/node:22-bookworm-slim AS node

FROM mcr.microsoft.com/devcontainers/dotnet:1-8.0-bookworm

# Node 22 from the official image (same Debian base, so the binary is compatible).
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -sf /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
 && ln -sf /usr/local/lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack

# GitHub CLI from its official apt repo, plus small helpers.
# The base image ships a Yarn apt source with an expired key; we don't use Yarn, so drop it.
RUN set -eux; \
    rm -f /etc/apt/sources.list.d/yarn.list; \
    install -d -m 0755 /etc/apt/keyrings; \
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli-archive-keyring.gpg; \
    chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg; \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends gh zip unzip jq; \
    rm -rf /var/lib/apt/lists/*

# Login shells reset PATH, so put the per-user tool folders back on it there too.
RUN printf '%s\n' 'export PATH="$HOME/.npm-global/bin:$HOME/.dotnet/tools:$PATH"' > /etc/profile.d/repoguide-tools.sh

USER vscode
ENV NPM_CONFIG_PREFIX=/home/vscode/.npm-global \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1 \
    PATH=/home/vscode/.npm-global/bin:/home/vscode/.dotnet/tools:$PATH

# Decompiler for checking game data (output never goes into the repo).
# Pinned: ilspycmd 10+ needs a newer SDK than the .NET 8 in this image.
RUN dotnet tool install --global ilspycmd --version 9.1.0.7988

# Claude Code CLI, so this project's session can continue inside the container.
RUN npm install -g @anthropic-ai/claude-code

USER root
