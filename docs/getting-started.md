# Getting Started

## Prerequisites

- **macOS** — Luff uses the macOS Keychain to store credentials securely. Linux support is planned.
- **Homebrew** — for installing pre-built binaries.

## Installation

### Install all tools

```bash
brew tap serhiitroinin/luff
brew install todo cal mail whoop garmin libre rescuetime
```

### Install individual tools

```bash
brew install serhiitroinin/luff/todo
brew install serhiitroinin/luff/cal
# ... etc
```

### From GitHub Releases

Download the binary for your platform from [GitHub Releases](https://github.com/serhiitroinin/luff/releases), extract, and move to a directory in your `PATH`:

```bash
tar xzf todo-darwin-arm64.tar.gz
mv todo /usr/local/bin/
```

### Build from Source

Requires [Bun](https://bun.sh) v1.1+.

```bash
git clone https://github.com/serhiitroinin/luff.git
cd luff
bun install
bun build packages/todo/src/cli.ts --compile --outfile dist/todo
```

## First Run

Each tool requires a one-time setup to store credentials. The setup pattern varies by authentication method:

### API Token (simplest)

Tools: `todo`, `rescuetime`

```bash
todo setup <your-todoist-api-token>
todo status  # verify connection
```

### OAuth2 (browser flow)

Tools: `cal`, `mail` (Gmail), `whoop`

```bash
# 1. Store client credentials (one-time)
cal auth-setup <client-id> <client-secret>

# 2. Authenticate each account (opens browser)
cal auth-login myalias
```

### Email + Password

Tools: `garmin`, `libre`

```bash
garmin login you@email.com yourpassword
garmin status  # verify connection
```

See the [Authentication Guide](/guide/authentication) for detailed setup instructions per service.

## Verify Installation

```bash
todo status
cal accounts list
mail overview
whoop auth-status
garmin status
libre status
rescuetime status
```

Each tool should report a successful connection or tell you which setup step to run.

## What's Next?

- Browse the [Tools](/tools/todo) section for full command references
- Read the [Authentication Guide](/guide/authentication) for detailed service setup
- Check the [Architecture](/reference/architecture) to understand how luff is built
