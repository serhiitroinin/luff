# mail

Email CLI for Gmail and Fastmail with multi-account support.

## Install

```bash
brew install serhiitroinin/luff/mail
```

## Setup

### Gmail (OAuth2)

1. Create OAuth2 credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (Desktop app)
2. Enable the **Gmail API**

```bash
mail auth-setup <client-id> <client-secret> <redirect-uri>
mail accounts add work you@gmail.com google
mail auth-login work   # opens browser
```

### Fastmail (API Token)

1. Get an API token from [Fastmail Settings > Privacy & Security > API Tokens](https://www.fastmail.com/settings/security/tokens)
2. Grant Mail (read/write) scope

```bash
mail accounts add fm you@fastmail.com fastmail
mail auth-login fm <your-api-token>
```

### Verify

```bash
mail overview
```

## Quick Start

```bash
# Unread counts across all accounts
mail overview

# List inbox for a specific account
mail list work

# Read a message
mail read work <message-id>

# Search across all accounts
mail search all "invoice"

# Archive messages
mail archive work <id1> <id2>
```

## Command Reference

### Auth & Accounts

| Command | Description |
|---------|-------------|
| `auth-setup <id> <secret> <uri>` | Save OAuth2 credentials (Gmail) |
| `auth-login <account> [token]` | OAuth2 flow (Gmail) or save API token (Fastmail) |
| `accounts list` | List accounts and auth status |
| `accounts add <alias> <email> <provider>` | Add account (`google` or `fastmail`) |
| `accounts remove <alias>` | Remove an account |

### Read

| Command | Description |
|---------|-------------|
| `overview` | Unread counts across all accounts |
| `list <account>` | List inbox messages |
| `read <account> <id>` | Read full message |
| `search <account> <query>` | Search messages |

**Options for `list`:**
- `--unread` — Show only unread messages
- `--size <n>` — Number of messages (default: 20)
- `--json` — Output as JSON

**Options for `search`:**
- `--size <n>` — Max results
- `--json` — Output as JSON

### Actions

| Command | Description |
|---------|-------------|
| `archive <account> <ids...>` | Archive messages (remove from inbox) |
| `flag <account> <ids...>` | Star/flag messages |
| `trash <account> <ids...>` | Move messages to trash |

### Debug

| Command | Description |
|---------|-------------|
| `raw <account> <method> <path>` | Direct API call (Gmail only) |

## Multi-Account

Use `all` to list or search across every account:

```bash
mail list all           # inbox from all accounts
mail search all "tax"   # search all accounts
```

See the [Multi-Account Guide](/guide/multi-account) for details.

## Provider Differences

| Feature | Gmail | Fastmail |
|---------|-------|----------|
| Auth | OAuth2 (browser flow) | API token |
| Search | Gmail search syntax | JMAP text search |
| Raw API | `mail raw` command | Not available |
| Protocol | Gmail REST API | JMAP |

## Examples

```bash
# List unread messages
mail list work --unread

# Read a message as JSON
mail read work 18d3a4b5c6 --json

# Archive multiple messages
mail archive work 18d3a4b5c6 18d3a4b5c7

# Search for attachments
mail search work "has:attachment from:boss"
```
