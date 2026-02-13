# Authentication

Luff tools use three authentication methods depending on the service. All credentials are stored securely in the macOS Keychain under the service prefix `luff-<tool>`.

## Auth Methods Overview

| Method | Tools | How it works |
|--------|-------|-------------|
| **OAuth2** | `cal`, `mail` (Gmail), `whoop` | Browser-based consent flow, auto-refreshing tokens |
| **API Token** | `todo`, `mail` (Fastmail), `rescuetime` | Paste a token from the service's settings page |
| **Email + Password** | `garmin`, `libre` | Direct login, tokens saved to Keychain |

## OAuth2 Flow

Used by: `cal`, `mail` (Gmail), `whoop`

### Step 1: Create App Credentials

Register an application with the service provider to get a Client ID and Client Secret:

| Service | Where to create |
|---------|----------------|
| Google (cal, mail) | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) — create Desktop OAuth Client |
| WHOOP | [WHOOP Developer Portal](https://developer-dashboard.whoop.com) |

### Step 2: Store Credentials

```bash
cal auth-setup <client-id> <client-secret>
mail auth-setup <client-id> <client-secret> <redirect-uri>
whoop auth-setup <client-id> <client-secret> <redirect-uri>
```

This is a one-time operation. Credentials are stored in your Keychain.

### Step 3: Authenticate

```bash
cal auth-login myalias
mail auth-login myalias
whoop auth-login
```

This opens your browser for the OAuth consent screen. After you approve, a local callback server captures the authorization code, exchanges it for tokens, and saves them to your Keychain.

### Token Refresh

OAuth2 tokens expire (typically after 1 hour). Luff automatically refreshes them using the stored refresh token — you should never need to re-authenticate unless:

- The refresh token itself expires (rare — usually months/years)
- You revoke access in the service's security settings
- You run `auth-logout`

## API Token

Used by: `todo`, `mail` (Fastmail), `rescuetime`

The simplest method — copy a token from the service's settings page and paste it:

| Service | Where to get token |
|---------|--------------------|
| Todoist | [Settings > Integrations > Developer](https://app.todoist.com/app/settings/integrations/developer) |
| Fastmail | [Settings > Privacy & Security > API Tokens](https://www.fastmail.com/settings/security/tokens) |
| RescueTime | [API Key Management](https://www.rescuetime.com/anapi/manage) |

```bash
todo setup <token>
rescuetime setup <api-key>
mail auth-login fm <api-token>  # Fastmail
```

API tokens don't expire automatically but can be revoked in the service's settings.

## Email + Password

Used by: `garmin`, `libre`

These services don't offer public OAuth2 APIs, so authentication uses email and password:

```bash
garmin login you@email.com yourpassword
libre setup you@email.com yourpassword && libre login
```

::: tip
Your password is never stored in plaintext files. For Garmin, credentials are sent once during login and only OAuth tokens are saved. For Libre, credentials are stored in the macOS Keychain (encrypted) because the API requires them for token renewal.
:::

## Keychain Storage

All credentials are stored in the macOS Keychain under predictable service names:

| Pattern | Example |
|---------|---------|
| `luff-<tool>` | `luff-todo`, `luff-rescuetime` |
| `luff-<tool>-<alias>` | `luff-cal-work`, `luff-mail-personal` |

You can inspect stored credentials using Keychain Access.app or the `security` CLI:

```bash
security find-generic-password -s luff-todo -a api-token -w
```

## Troubleshooting

### "Not logged in" errors

Re-run the auth command for your tool:

```bash
cal auth-login myalias
garmin login you@email.com yourpassword
```

### OAuth2 callback fails

Make sure no other process is using the callback port. The callback server starts on a random available port, so conflicts are rare.

### Token expired / refresh failed

If automatic token refresh fails, re-authenticate:

```bash
cal auth-login myalias    # re-runs OAuth2 flow
whoop auth-login          # re-runs OAuth2 flow
garmin login ...          # full re-login
```
