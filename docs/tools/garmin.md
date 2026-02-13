# garmin

Garmin Connect health data CLI with 20+ metrics from your Garmin wearable.

## Install

```bash
brew install serhiitroinin/luff/garmin
```

## Setup

### Direct Login

```bash
garmin login you@email.com yourpassword
garmin status
```

::: warning
Garmin uses SSO authentication with email and password. The credentials are only sent to Garmin's servers and are not stored — only the resulting OAuth tokens are saved to your Keychain.
:::

### Import from garth/garmy

If you already have tokens from [garth](https://github.com/matin/garth) or [garmy](https://github.com/garmy-dev/garmy):

```bash
garmin import-tokens ~/.garmy
```

## Quick Start

```bash
# Full health dashboard
garmin overview

# Training readiness
garmin tr

# Body battery
garmin bb

# Recent activities
garmin activities
```

## Command Reference

### Auth

| Command | Description |
|---------|-------------|
| `login <email> <password>` | SSO login (OAuth1 > OAuth2) |
| `import-tokens [dir]` | Import from garth/garmy (default: `~/.garmy`) |
| `status` | Check auth status and token expiry |
| `logout` | Remove all credentials |

### Core Health

All commands accept an optional `[days]` parameter (default: 7).

| Command | Alias | Description |
|---------|-------|-------------|
| `training-readiness [days]` | `tr` | Readiness score + 5 contributing factors |
| `sleep [days]` | | Sleep score, stages, duration |
| `heart-rate [days]` | `hr` | Resting HR, min/max, 7-day average |
| `hrv [days]` | | HRV nightly avg, baseline, status |
| `stress [days]` | | Daily stress levels (0-100) |
| `body-battery [days]` | `bb` | Energy: charged, drained, high, low |
| `steps [days]` | | Steps, distance, goal progress, floors |
| `activities [days]` | | Workouts: type, duration, HR, calories |
| `daily [days]` | | Combined daily summary |

### Advanced Metrics

| Command | Alias | Default Days | Description |
|---------|-------|-------------|-------------|
| `vo2max [days]` | | 30 | VO2 Max running/cycling |
| `spo2 [days]` | | 7 | Blood oxygen levels |
| `respiration [days]` | `resp` | 7 | Breathing rate (waking + sleeping) |
| `training-status [days]` | `ts` | 7 | Status, load focus, ACWR |
| `race-predictions` | `rp` | — | Predicted race times (5K–marathon) |
| `weight [days]` | | 30 | Weight, BMI, body fat, muscle mass |
| `fitness-age` | `fa` | — | Fitness age vs chronological |
| `intensity [days]` | `im` | 7 | Moderate + vigorous minutes |
| `endurance` | `es` | — | Endurance score |

### Activity Detail

| Command | Alias | Description |
|---------|-------|-------------|
| `activity <id>` | | Full detail: summary + splits + HR zones |
| `records` | `prs` | Personal records (fastest, farthest) |
| `gear` | | Equipment tracking (shoes, bikes) |

### Overview & Raw

| Command | Description |
|---------|-------------|
| `overview [days]` | Full dashboard (all core + advanced) |
| `json <path> [k=v ...]` | Raw JSON from any Garmin endpoint |

## Training Readiness

The readiness score (0-100) is composed of 5 factors:

| Factor | Description |
|--------|-------------|
| Sleep | Sleep quality and duration |
| Recovery Time | Time since last intense activity |
| HRV Status | Heart rate variability trend |
| Acute Training Load | Recent training volume |
| Stress History | Recent stress levels |

## Body Battery

| Level | Meaning |
|-------|---------|
| 76-100 | High energy |
| 26-75 | Medium energy |
| 1-25 | Low energy |

## Examples

```bash
# Last 14 days of training readiness
garmin tr 14

# Detailed activity breakdown
garmin activity 12345678

# VO2 Max trend over 90 days
garmin vo2max 90

# Race predictions
garmin rp

# Raw API call
garmin json /wellness-service/wellness/dailySummaryChart/2026-02-14
```
