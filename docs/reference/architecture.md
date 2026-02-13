# Architecture

Luff is a Bun monorepo containing 7 CLI tools and a shared utility package.

## Monorepo Structure

```
luff/
├── packages/
│   ├── shared/       # @luff/shared — utilities used by all tools
│   ├── todo/         # Todoist task management
│   ├── cal/          # Google Calendar
│   ├── mail/         # Gmail + Fastmail
│   ├── whoop/        # WHOOP health data
│   ├── garmin/       # Garmin Connect
│   ├── libre/        # FreeStyle Libre 3
│   └── rescuetime/   # RescueTime productivity
├── docs/             # This documentation (VitePress)
├── dist/             # Compiled binaries (local builds)
├── package.json      # Workspace root
└── .github/
    └── workflows/
        ├── release.yml   # Build + release pipeline
        └── docs.yml      # Documentation deployment
```

Each package under `packages/` is independent and follows the same structure:

```
packages/<tool>/
├── package.json
└── src/
    ├── cli.ts              # Commander.js entry point
    ├── types.ts             # TypeScript interfaces
    └── providers/
        └── <provider>.ts    # API implementation
```

## Provider Pattern

Every tool separates the CLI layer from the API implementation using a provider interface:

```
CLI (cli.ts)  →  Provider Interface (types.ts)  →  Implementation (providers/*.ts)
```

For example, `todo` defines a `TodoProvider` interface that the Todoist implementation satisfies. This means:

- The CLI only knows about the interface, not the API details
- You can add a new backend (e.g., Linear, GitHub Issues) by implementing the same interface
- Testing and mocking are straightforward

Tools with multi-account support (cal, mail) route to the correct provider based on the account's configuration.

## Shared Package

`@luff/shared` provides utilities used across all tools:

| Module | Purpose |
|--------|---------|
| `keychain` | macOS Keychain read/write via `security` CLI (using `execFileSync` — no shell) |
| `oauth2` | OAuth2 flow helpers: authorize URL, code exchange, token refresh, token storage |
| `http` | HTTP client with JSON parsing, error handling, query params |
| `config` | JSON config files in `~/.config/luff/` with secure permissions (0o600) |
| `accounts` | Multi-account registry management |
| `output` | Terminal formatting: headings, tables, JSON, colors |

## Build System

Each tool compiles to a standalone binary using `bun build --compile`:

```bash
bun build packages/todo/src/cli.ts --compile --outfile dist/todo
```

The resulting binary:
- Is ~60MB (includes the Bun runtime)
- Has **zero runtime dependencies** — no Node.js, no Bun installation needed
- Runs on the target platform without any setup

## Release Pipeline

Releases are triggered by pushing a git tag matching `<tool>-v<version>`:

```bash
git tag todo-v0.1.1
git push origin todo-v0.1.1
```

The CI pipeline then:

1. **Builds** the binary on 4 platforms:
   - macOS ARM64 (Apple Silicon)
   - macOS x64 (Intel)
   - Linux x64
   - Linux ARM64

2. **Creates a GitHub Release** with all 4 tarballs + SHA256 checksums

3. **Updates the Homebrew formula** in [serhiitroinin/homebrew-luff](https://github.com/serhiitroinin/homebrew-luff) — auto-detects platform at install time

## Credential Security

Luff takes credential security seriously:

| Mechanism | Implementation |
|-----------|---------------|
| Secret storage | macOS Keychain (encrypted at rest) |
| Shell injection | `execFileSync` — no shell invocation, arguments passed directly |
| Config files | Created with `0o600` permissions (owner read/write only) |
| Token refresh | Automatic, preserves refresh tokens across exchanges |
| Error messages | API responses truncated to prevent credential leakage |
| Region redirects | Validated against strict patterns before following |

## Adding a New Tool

1. Create `packages/<tool>/` with `package.json`, `src/cli.ts`, `src/types.ts`, `src/providers/<name>.ts`
2. Define a provider interface in `types.ts`
3. Implement the provider against the API
4. Wire up Commander.js commands in `cli.ts`
5. Add to the root `package.json` workspaces
6. Test: `bun run packages/<tool>/src/cli.ts <command>`
7. Build: `bun build packages/<tool>/src/cli.ts --compile --outfile dist/<tool>`
8. Tag and push: `git tag <tool>-v0.1.0 && git push origin <tool>-v0.1.0`

## Adding a New Provider

To add a second backend to an existing tool (e.g., Linear tasks alongside Todoist):

1. Create `packages/todo/src/providers/linear.ts`
2. Implement the same `TodoProvider` interface
3. Add provider selection logic in `cli.ts` (e.g., via config or flag)
4. The CLI layer requires zero changes beyond routing
