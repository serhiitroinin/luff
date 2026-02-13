# rescuetime

[RescueTime](https://www.rescuetime.com) productivity tracking data in your terminal.

## Install

```bash
brew install serhiitroinin/luff/rescuetime
```

## Setup

Get your API key from [RescueTime API Key Management](https://www.rescuetime.com/anapi/manage).

```bash
rescuetime setup <your-api-key>
rescuetime status
```

## Quick Start

```bash
# Full productivity dashboard
rescuetime overview

# Daily productivity pulse scores
rescuetime productivity

# Top apps and websites
rescuetime activities

# Focus session history
rescuetime focus-sessions
```

## Command Reference

### Setup

| Command | Description |
|---------|-------------|
| `setup <apiKey>` | Save RescueTime API key to Keychain |
| `status` | Check API connection |

### Data

All data commands accept an optional `[days]` parameter (default: 7).

| Command | Description |
|---------|-------------|
| `productivity [days]` | Daily productivity pulse (0-100) |
| `categories [days]` | Time by category |
| `activities [days]` | Top apps/sites ranked by time |
| `focus [days]` | Productive vs distracting breakdown |
| `focus-sessions` | Recent focus session history |
| `highlights` | Daily highlight notes |
| `overview [days]` | Full dashboard |

### Raw API

| Command | Description |
|---------|-------------|
| `json <endpoint> [days]` | Raw JSON from API |

**Endpoints:** `summary`, `data`, `focus-started`, `focus-ended`, `highlights`

## Productivity Pulse

| Score | Rating |
|-------|--------|
| 85-100 | Excellent |
| 70-84 | Good |
| 50-69 | Average |
| < 50 | Below average |

## Categories

| Category | Examples |
|----------|---------|
| Software Development | VS Code, Terminal, GitHub |
| Communication | Slack, Email, Zoom |
| Reference & Learning | Docs, Stack Overflow |
| Business Operations | Sheets, Notion |
| Social Networking | Twitter, LinkedIn |
| Entertainment | YouTube, Reddit |

## Examples

```bash
# Last 14 days of productivity
rescuetime productivity 14

# See where your time went today
rescuetime categories 1

# Raw API: daily summary feed
rescuetime json summary 7
```
