# todo

Task management CLI powered by [Todoist](https://todoist.com).

## Install

```bash
brew install serhiitroinin/luff/todo
```

## Setup

Get your API token from [Todoist Settings > Integrations > Developer](https://app.todoist.com/app/settings/integrations/developer).

```bash
todo setup <your-api-token>
todo status
```

## Quick Start

```bash
# See what's due today
todo today

# Full dashboard
todo overview

# Quick-add a task with natural language
todo tasks quick "Buy groceries tomorrow #Shopping p2"

# Complete a task
todo tasks done <task-id>
```

## Command Reference

### Overview

| Command | Description |
|---------|-------------|
| `setup <token>` | Save Todoist API token to macOS Keychain |
| `status` | Check API connection |
| `overview` | Today + upcoming + projects dashboard |
| `today` | Today's and overdue tasks |

### Projects <Badge type="tip" text="alias: p" />

| Command | Description |
|---------|-------------|
| `projects list` | List all projects |
| `projects get <id>` | Get project details (JSON) |
| `projects create <name>` | Create a project |
| `projects delete <id>` | Delete a project |

**Options for `create`:**
- `--parent <id>` — Parent project ID
- `--view <style>` — View style: `list`, `board`, `calendar`
- `--color <color>` — Color name

### Tasks <Badge type="tip" text="alias: t" />

| Command | Description |
|---------|-------------|
| `tasks list` | List tasks (with filters) |
| `tasks get <id>` | Get task details (JSON) |
| `tasks create <content>` | Create a task |
| `tasks quick <text>` | Quick-add with natural language |
| `tasks complete <id>` | Mark task as complete |
| `tasks reopen <id>` | Reopen a completed task |
| `tasks update <id>` | Update a task |
| `tasks move <id>` | Move task to project/section |
| `tasks delete <id>` | Delete a task |
| `tasks today` | Today's and overdue tasks |

**Options for `list`:**
- `--project <id>` — Filter by project ID
- `--label <name>` — Filter by label
- `--filter <query>` — Todoist filter query

**Options for `create`:**
- `--project <id>` — Project ID
- `--section <id>` — Section ID
- `--priority <n>` — Priority 1-4
- `--due <string>` — Due date string
- `--labels <list>` — Comma-separated labels
- `--description <text>` — Description

### Labels <Badge type="tip" text="alias: l" />

| Command | Description |
|---------|-------------|
| `labels list` | List all labels |
| `labels create <name>` | Create a label |
| `labels delete <id>` | Delete a label |

### Sections <Badge type="tip" text="alias: s" />

| Command | Description |
|---------|-------------|
| `sections list [projectId]` | List sections |
| `sections create <name>` | Create a section (requires `--project`) |

## Filter Syntax

Todoist filters let you query tasks flexibly:

```bash
todo tasks list --filter "today | overdue"
todo tasks list --filter "p1"
todo tasks list --filter "@deepwork"
todo tasks list --filter "#Work"
todo tasks list --filter "7 days"
todo tasks list --filter "no date"
```

## Priority Mapping

| Display | API Value | Flag |
|---------|-----------|------|
| p1 (urgent) | 4 | `!!!` |
| p2 (high) | 3 | `!!` |
| p3 (medium) | 2 | `!` |
| No priority | 1 | |

::: tip
The API priority is inverted from the display priority. `--priority 4` sets p1 (urgent).
:::

## Examples

```bash
# Create a task in a specific project with labels
todo tasks create "Review PR" --project 12345 --priority 3 --labels "deepwork,work"

# Quick-add with natural language (parses project, priority, date)
todo tasks quick "Call dentist tomorrow p2 #Personal"

# Move a task to a different section
todo tasks move 67890 --section 11111

# List all tasks in a project
todo tasks list --project 12345
```
