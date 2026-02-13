# cal

Google Calendar CLI with multi-account support.

## Install

```bash
brew install serhiitroinin/luff/cal
```

## Setup

### 1. Create OAuth2 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID (Desktop app)
3. Enable the **Google Calendar API** in your project
4. Note the Client ID and Client Secret

### 2. Store Credentials

```bash
cal auth-setup <client-id> <client-secret>
```

### 3. Add Accounts

```bash
cal accounts add work you@company.com
cal accounts add personal you@gmail.com
```

### 4. Authenticate

```bash
cal auth-login work     # opens browser for OAuth2
cal auth-login personal
```

### Verify

```bash
cal accounts list
```

## Quick Start

```bash
# Today's events across all accounts
cal today all

# Next 3 days merged agenda
cal agenda --days 3

# Quick-add an event
cal quickadd work "Lunch with team tomorrow at noon"

# Week overview
cal week all
```

## Command Reference

### Auth & Accounts

| Command | Description |
|---------|-------------|
| `auth-setup <id> <secret>` | Save OAuth2 client credentials |
| `auth-login <account>` | OAuth2 browser flow for an account |
| `accounts list` | List accounts and auth status |
| `accounts add <alias> <email>` | Add a Google account |
| `accounts remove <alias>` | Remove an account |

### Read Events

| Command | Description |
|---------|-------------|
| `overview [days]` | Event counts per account (default: 7) |
| `today [account]` | Today's events |
| `week [account]` | Next 7 days |
| `list <account>` | Flexible date range query |
| `agenda` | Merged timeline across all accounts |
| `get <account> <event-id>` | Get event details |
| `calendars [account]` | List available calendars |

**Options for `list`:**
- `--days <n>` — Number of days to show
- `--from <date>` — Start date (YYYY-MM-DD)
- `--to <date>` — End date (YYYY-MM-DD)
- `--json` — Output as JSON

**Options for `agenda`:**
- `--days <n>` — Number of days (default: 3)

### Write Events

| Command | Description |
|---------|-------------|
| `add <account> <summary> <start> <end>` | Create an event |
| `quickadd <account> <text>` | Natural language event creation |
| `update <account> <event-id>` | Update an event |
| `delete <account> <event-id>` | Delete an event |

**Options for `add`:**
- `--location <text>` — Event location
- `--description <text>` — Event description
- `--allday` — Create an all-day event
- `--json` — Output as JSON

**Options for `update`:**
- `--summary <text>` — New title
- `--start <datetime>` — New start time
- `--end <datetime>` — New end time
- `--location <text>` — New location
- `--description <text>` — New description
- `--allday` — Convert to all-day event

## Time Formats

The `add` command accepts flexible time inputs:

```bash
# Full datetime
cal add work "Meeting" "2026-02-14T10:00" "2026-02-14T11:00"

# Date and time separated
cal add work "Meeting" "2026-02-14 10:00" "2026-02-14 11:00"

# Time only (assumes today)
cal add work "Meeting" "10:00" "11:00"

# With keywords
cal add work "Meeting" "tomorrow 14:00" "tomorrow 15:00"

# All-day event
cal add work "Holiday" "2026-02-14" "2026-02-14" --allday
```

## Multi-Account

Use `all` to query across every authenticated account:

```bash
cal today all      # merged timeline
cal week all       # all accounts combined
cal list all       # all accounts, flexible range
```

The agenda command always merges all accounts by default.

See the [Multi-Account Guide](/guide/multi-account) for details.

## Examples

```bash
# Create a meeting with location
cal add work "Team standup" "09:00" "09:30" --location "Room 3B"

# Quick-add with natural language
cal quickadd personal "Dentist appointment next Monday at 2pm"

# See next 5 days of events
cal list all --days 5

# Delete an event
cal delete work abc123def456
```
