import { Command } from "commander";
import { writeConfig, requireConfig } from "../../lib/config.ts";
import * as out from "../../lib/output.ts";
import * as api from "./api.ts";
import type { TodoistConfig } from "./types.ts";

function priorityLabel(p: number): string {
  if (p === 4) return "!!!";
  if (p === 3) return "!!";
  if (p === 2) return "!";
  return "";
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

export function register(parent: Command): void {
  const todoist = parent
    .command("todoist")
    .alias("td")
    .description("Todoist task management");

  // ── Setup ───────────────────────────────────────────────────

  todoist
    .command("setup <token>")
    .description("Save API token")
    .action(async (token: string) => {
      writeConfig<TodoistConfig>("todoist", { apiToken: token });
      out.success("API token saved.");
      // Test it
      try {
        const projects = await api.listProjects();
        out.info(`Connected — ${projects.length} projects found.`);
      } catch (e: unknown) {
        out.error(`Token saved but API check failed: ${(e as Error).message}`);
      }
    });

  todoist
    .command("status")
    .description("Check API connection")
    .action(async () => {
      try {
        const config = requireConfig<TodoistConfig>("todoist");
        const projects = await api.listProjects();
        out.success("Todoist API: OK");
        out.info(`Projects: ${projects.length}`);
        out.info(`Config: ~/.config/life/todoist.json`);
        // show masked token
        const masked = config.apiToken.slice(0, 4) + "..." + config.apiToken.slice(-4);
        out.info(`Token: ${masked}`);
      } catch (e: unknown) {
        out.error((e as Error).message);
        process.exit(1);
      }
    });

  // ── Overview ────────────────────────────────────────────────

  todoist
    .command("overview")
    .description("Today + upcoming + projects dashboard")
    .action(async () => {
      out.heading("Todoist Overview");
      out.blank();

      out.subheading("Today & Overdue");
      const todayTasks = await api.listTasks({ filter: "today | overdue" });
      printTaskTable(todayTasks);
      out.blank();

      out.subheading("Upcoming (next 7 days)");
      const upcoming = await api.listTasks({ filter: "7 days" });
      printTaskTable(upcoming);
      out.blank();

      out.subheading("Projects");
      const projects = await api.listProjects();
      printProjectTable(projects);
    });

  todoist
    .command("today")
    .description("Today's and overdue tasks")
    .action(async () => {
      out.heading("Due Today");
      out.blank();
      const tasks = await api.listTasks({ filter: "today | overdue" });
      printTaskTable(tasks);
    });

  // ── Projects ────────────────────────────────────────────────

  const projects = todoist
    .command("projects")
    .alias("p")
    .description("Manage projects");

  projects
    .command("list")
    .alias("ls")
    .description("List all projects")
    .action(async () => {
      const items = await api.listProjects();
      printProjectTable(items);
    });

  projects
    .command("get <id>")
    .description("Get project details (JSON)")
    .action(async (id: string) => {
      const project = await api.getProject(id);
      out.json(project);
    });

  projects
    .command("create <name>")
    .alias("add")
    .description("Create a project")
    .option("--parent <id>", "Parent project ID")
    .option("--view <style>", "View style: list, board, calendar")
    .option("--color <color>", "Color name")
    .action(async (name: string, opts: { parent?: string; view?: string; color?: string }) => {
      const project = await api.createProject(name, {
        parentId: opts.parent,
        viewStyle: opts.view,
        color: opts.color,
      });
      out.success(`Created project: ${project.name} (ID: ${project.id})`);
    });

  projects
    .command("delete <id>")
    .alias("rm")
    .description("Delete a project")
    .action(async (id: string) => {
      const ok = await api.deleteProject(id);
      if (ok) out.success(`Deleted project ${id}`);
      else out.error(`Failed to delete project ${id}`);
    });

  // ── Tasks ───────────────────────────────────────────────────

  const tasks = todoist
    .command("tasks")
    .alias("t")
    .description("Manage tasks");

  tasks
    .command("list")
    .alias("ls")
    .description("List tasks")
    .option("--project <id>", "Filter by project ID")
    .option("--label <name>", "Filter by label")
    .option("--filter <query>", 'Filter query (e.g. "today | overdue")')
    .action(
      async (opts: { project?: string; label?: string; filter?: string }) => {
        const items = await api.listTasks({
          projectId: opts.project,
          label: opts.label,
          filter: opts.filter,
        });
        printTaskTable(items);
      }
    );

  tasks
    .command("get <id>")
    .description("Get task details (JSON)")
    .action(async (id: string) => {
      const task = await api.getTask(id);
      out.json(task);
    });

  tasks
    .command("create <content>")
    .alias("add")
    .description("Create a task")
    .option("--project <id>", "Project ID")
    .option("--section <id>", "Section ID")
    .option("--priority <n>", "Priority 1-4", parseInt)
    .option("--due <string>", "Due date string")
    .option("--labels <list>", "Comma-separated labels")
    .option("--description <text>", "Description")
    .action(
      async (
        content: string,
        opts: {
          project?: string;
          section?: string;
          priority?: number;
          due?: string;
          labels?: string;
          description?: string;
        }
      ) => {
        const task = await api.createTask(content, {
          projectId: opts.project,
          sectionId: opts.section,
          priority: opts.priority,
          dueString: opts.due,
          labels: opts.labels?.split(","),
          description: opts.description,
        });
        out.success(`Created: ${task.content} (ID: ${task.id})`);
      }
    );

  tasks
    .command("quick <text>")
    .alias("q")
    .description('Quick add with natural language (e.g. "Buy milk tomorrow #Shopping p2")')
    .action(async (text: string) => {
      const task = await api.quickAddTask(text);
      const due = task.due?.date ?? "no date";
      out.success(`Created: ${task.content} (ID: ${task.id}, due: ${due})`);
    });

  tasks
    .command("complete <id>")
    .alias("done")
    .description("Mark task as complete")
    .action(async (id: string) => {
      await api.completeTask(id);
      out.success(`Completed task ${id}`);
    });

  tasks
    .command("reopen <id>")
    .description("Reopen a completed task")
    .action(async (id: string) => {
      await api.reopenTask(id);
      out.success(`Reopened task ${id}`);
    });

  tasks
    .command("update <id>")
    .alias("edit")
    .description("Update a task")
    .option("--content <text>", "New content")
    .option("--priority <n>", "Priority 1-4", parseInt)
    .option("--due <string>", "Due date string")
    .option("--labels <list>", "Comma-separated labels")
    .option("--description <text>", "Description")
    .action(
      async (
        id: string,
        opts: {
          content?: string;
          priority?: number;
          due?: string;
          labels?: string;
          description?: string;
        }
      ) => {
        await api.updateTask(id, {
          content: opts.content,
          priority: opts.priority,
          dueString: opts.due,
          labels: opts.labels?.split(","),
          description: opts.description,
        });
        out.success(`Updated task ${id}`);
      }
    );

  tasks
    .command("move <id>")
    .description("Move a task")
    .option("--project <id>", "Target project ID")
    .option("--section <id>", "Target section ID")
    .option("--parent <id>", "Target parent task ID")
    .action(
      async (
        id: string,
        opts: { project?: string; section?: string; parent?: string }
      ) => {
        if (!opts.project && !opts.section && !opts.parent) {
          out.error("Specify one of: --project, --section, --parent");
          process.exit(1);
        }
        await api.moveTask(id, {
          projectId: opts.project,
          sectionId: opts.section,
          parentId: opts.parent,
        });
        out.success(`Moved task ${id}`);
      }
    );

  tasks
    .command("delete <id>")
    .alias("rm")
    .description("Delete a task")
    .action(async (id: string) => {
      const ok = await api.deleteTask(id);
      if (ok) out.success(`Deleted task ${id}`);
      else out.error(`Failed to delete task ${id}`);
    });

  tasks
    .command("today")
    .description("Today's and overdue tasks")
    .action(async () => {
      out.heading("Due Today");
      out.blank();
      const items = await api.listTasks({ filter: "today | overdue" });
      printTaskTable(items);
    });

  // ── Labels ──────────────────────────────────────────────────

  const labels = todoist
    .command("labels")
    .alias("l")
    .description("Manage labels");

  labels
    .command("list")
    .alias("ls")
    .description("List all labels")
    .action(async () => {
      const items = await api.listLabels();
      items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      out.heading("Labels");
      out.blank();
      out.table(
        ["ID", "Name", "Color", "Fav"],
        items.map((l) => [
          l.id,
          l.name,
          l.color,
          l.is_favorite ? "\u2605" : "",
        ])
      );
    });

  labels
    .command("create <name>")
    .alias("add")
    .description("Create a label")
    .option("--color <color>", "Color name")
    .action(async (name: string, opts: { color?: string }) => {
      const label = await api.createLabel(name, { color: opts.color });
      out.success(`Created label: ${label.name} (ID: ${label.id})`);
    });

  labels
    .command("delete <id>")
    .alias("rm")
    .description("Delete a label")
    .action(async (id: string) => {
      const ok = await api.deleteLabel(id);
      if (ok) out.success(`Deleted label ${id}`);
      else out.error(`Failed to delete label ${id}`);
    });

  // ── Sections ────────────────────────────────────────────────

  const sections = todoist
    .command("sections")
    .alias("s")
    .description("Manage sections");

  sections
    .command("list [projectId]")
    .alias("ls")
    .description("List sections (optionally by project)")
    .action(async (projectId?: string) => {
      const items = await api.listSections(projectId);
      const active = items.filter((s) => !s.is_deleted && !s.is_archived);
      active.sort((a, b) => a.section_order - b.section_order);
      out.heading("Sections");
      out.blank();
      out.table(
        ["ID", "Name", "Project ID"],
        active.map((s) => [s.id, s.name, s.project_id])
      );
    });

  sections
    .command("create <name>")
    .alias("add")
    .description("Create a section")
    .requiredOption("--project <id>", "Project ID")
    .action(async (name: string, opts: { project: string }) => {
      const section = await api.createSection(name, opts.project);
      out.success(
        `Created section: ${section.name} (ID: ${section.id})`
      );
    });
}

// ── Formatters ────────────────────────────────────────────────

function printTaskTable(tasks: Awaited<ReturnType<typeof api.listTasks>>): void {
  const sorted = [...tasks].sort((a, b) => b.priority - a.priority);
  out.info(`${sorted.length} task${sorted.length === 1 ? "" : "s"}`);
  if (sorted.length === 0) return;
  out.blank();
  out.table(
    ["ID", "P", "Due", "Content", "Labels"],
    sorted.map((t) => [
      t.id,
      priorityLabel(t.priority),
      t.due?.date ?? "",
      truncate(t.content, 60),
      t.labels.join(","),
    ])
  );
}

function printProjectTable(
  projects: Awaited<ReturnType<typeof api.listProjects>>
): void {
  const active = projects
    .filter((p) => !p.is_deleted && !p.is_archived)
    .sort((a, b) => a.child_order - b.child_order);
  out.heading("Projects");
  out.blank();
  out.table(
    ["ID", "Name", "View", "Fav"],
    active.map((p) => [
      p.id,
      p.parent_id ? "  \u2514 " + p.name : p.name,
      p.view_style,
      p.is_favorite ? "\u2605" : "",
    ])
  );
}
