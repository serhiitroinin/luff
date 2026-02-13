# libre

FreeStyle Libre 3 continuous glucose monitor (CGM) data via [LibreLinkUp](https://www.libreview.com).

## Install

```bash
brew install serhiitroinin/luff/libre
```

## Prerequisites

1. Active FreeStyle Libre 3 sensor
2. LibreLinkUp app installed with sharing enabled
3. LibreLinkUp account credentials

## Setup

```bash
libre setup you@email.com yourpassword
libre login     # authenticate and discover patient
libre status    # verify connection
```

::: info
Credentials are stored in macOS Keychain. The LibreLinkUp API requires email/password for authentication — tokens auto-refresh on expiry by re-logging in.
:::

## Quick Start

```bash
# Current glucose reading
libre current

# Overview with TIR analysis
libre overview

# Last 12 hours of readings
libre graph

# Detailed TIR analysis
libre tir
```

## Command Reference

### Auth

| Command | Description |
|---------|-------------|
| `setup <email> <password>` | Save LibreLinkUp credentials |
| `login` | Authenticate and discover patient |
| `status` | Check connection status and token expiry |

### Data

| Command | Description |
|---------|-------------|
| `current` | Current glucose + trend arrow |
| `graph` | Last 12h readings (table) |
| `logbook` | Last ~2 weeks of readings (table) |
| `tir [source]` | TIR/TBR/TAR/CV/SD/GMI analysis |
| `overview` | Current reading + 12h TIR summary |

**Options for `tir`:**
- Source: `graph` (last 12h, default) or `logbook` (~2 weeks)

### Raw API

| Command | Description |
|---------|-------------|
| `json <path>` | Raw JSON from any LibreLinkUp endpoint |

## Glucose Ranges

| Range | mg/dL | Label |
|-------|-------|-------|
| Very Low | < 54 | Urgent action needed |
| Low | 54-69 | Below range |
| In Range | 70-180 | Target zone |
| High | 181-250 | Above range |
| Very High | > 250 | Urgent action needed |

## TIR Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| TIR | Time In Range (70-180 mg/dL) | >= 70% |
| TBR | Time Below Range (< 70 mg/dL) | < 5% |
| TAR | Time Above Range (> 180 mg/dL) | < 25% |
| CV | Coefficient of Variation | < 36% |
| GMI | Glucose Management Indicator | Varies |
| SD | Standard Deviation | Lower is better |

## Trend Arrows

| Arrow | Meaning |
|-------|---------|
| ↑↑ | Rising quickly (> 3 mg/dL/min) |
| ↑ | Rising (2-3 mg/dL/min) |
| → | Stable (< 1 mg/dL/min) |
| ↓ | Falling (2-3 mg/dL/min) |
| ↓↓ | Falling quickly (> 3 mg/dL/min) |

## Examples

```bash
# Current reading with trend
libre current
# Output: 112 mg/dL (6.2 mmol/L) →  [IN RANGE]

# TIR analysis from logbook (2 weeks)
libre tir logbook

# Raw API: get connections
libre json /llu/connections
```
