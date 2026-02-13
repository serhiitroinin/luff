# Multi-Account

The `cal` and `mail` tools support multiple accounts, letting you manage several Google or email accounts from a single CLI.

## Supported Tools

| Tool | Multi-account | Providers |
|------|:------------:|-----------|
| `cal` | Yes | Google Calendar |
| `mail` | Yes | Gmail, Fastmail |
| `todo` | No | Todoist |
| `whoop` | No | WHOOP |
| `garmin` | No | Garmin Connect |
| `libre` | No | LibreLinkUp |
| `rescuetime` | No | RescueTime |

## Adding Accounts

Each account gets a short alias for easy reference:

```bash
# Calendar accounts
cal accounts add work you@company.com
cal accounts add personal you@gmail.com

# Mail accounts
mail accounts add work you@company.com google
mail accounts add personal you@gmail.com google
mail accounts add fm you@fastmail.com fastmail
```

After adding, authenticate each account:

```bash
cal auth-login work
cal auth-login personal
mail auth-login work
mail auth-login fm <api-token>
```

## Using Accounts

### Target a specific account

```bash
cal today work
mail list personal
```

### Query all accounts

Use `all` to merge results from every authenticated account:

```bash
cal today all        # merged timeline from all calendars
mail list all        # inbox from every account
mail search all "q"  # search across all accounts
```

### Agenda (cal)

The `cal agenda` command always queries all accounts and merges events into a single sorted timeline:

```bash
cal agenda --days 3
```

Each event is prefixed with its account alias: `[work]`, `[personal]`, etc.

## Managing Accounts

```bash
# List all accounts and their auth status
cal accounts list
mail accounts list

# Remove an account
cal accounts remove old-work
mail accounts remove old-gmail
```

## How It Works

- Account configs are stored in `~/.config/luff/cal-accounts.json` and `~/.config/luff/mail-accounts.json`
- OAuth tokens are stored per-account in the Keychain: `luff-cal-work`, `luff-cal-personal`, etc.
- Client credentials (OAuth2 app) are shared across all accounts of the same tool: `luff-cal`, `luff-mail`
- Each account authenticates independently — you can add/remove accounts without affecting others
