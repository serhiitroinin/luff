# whoop

WHOOP recovery, sleep, and workout data from the [WHOOP API v2](https://developer.whoop.com).

## Install

```bash
brew install serhiitroinin/luff/whoop
```

## Setup

1. Create an app at [WHOOP Developer Portal](https://developer-dashboard.whoop.com)
2. Set redirect URI to `http://localhost` (any port)
3. Request read scopes: `read:recovery`, `read:sleep`, `read:workout`, `read:cycles`, `read:profile`, `read:body_measurement`

```bash
whoop auth-setup <client-id> <client-secret> <redirect-uri>
whoop auth-login    # opens browser for OAuth2
whoop auth-status   # verify token
```

## Quick Start

```bash
# Full dashboard
whoop overview

# Today's recovery
whoop recovery 1

# Last 7 days of sleep
whoop sleep

# Recent workouts
whoop workouts
```

## Command Reference

### Auth

| Command | Description |
|---------|-------------|
| `auth-setup <id> <secret> <uri>` | Save OAuth2 credentials |
| `auth-login` | Interactive OAuth2 flow |
| `auth-status` | Check token validity and expiry |
| `auth-logout` | Remove all credentials |

### Profile

| Command | Description |
|---------|-------------|
| `profile` | User profile (name, email) |
| `body` | Body measurements (height, weight, max HR) |

### Health Data

All data commands accept an optional `[days]` parameter (default: 7).

| Command | Description |
|---------|-------------|
| `recovery [days]` | Recovery scores, HRV, RHR, SpO2, skin temp |
| `sleep [days]` | Sleep stages, performance, efficiency |
| `workouts [days]` | Workout strain, HR zones, distance |
| `cycles [days]` | Physiological cycles (day strain, HR, kJ) |
| `overview [days]` | Full dashboard (all of the above) |

### Raw API

| Command | Description |
|---------|-------------|
| `json <path> [k=v ...]` | Raw JSON from any WHOOP API endpoint |

## Recovery Metrics

| Metric | Description |
|--------|-------------|
| Recovery Score | 0-100%, green (67+), yellow (34-66), red (0-33) |
| HRV (ms) | Heart rate variability (rMSSD) |
| RHR (bpm) | Resting heart rate |
| SpO2 (%) | Blood oxygen saturation |
| Skin Temp | Skin temperature deviation |

## Sleep Metrics

| Metric | Description |
|--------|-------------|
| Performance | % of sleep need achieved |
| Efficiency | Time asleep / time in bed |
| Stages | REM, Deep (SWS), Light, Awake durations |
| Respiratory Rate | Breaths per minute during sleep |
| Sleep Needed | Total sleep need breakdown |

## Examples

```bash
# Last 14 days of recovery
whoop recovery 14

# Raw API: get activity data
whoop json /v2/activity/sleep limit=5

# Check if token is still valid
whoop auth-status
```
