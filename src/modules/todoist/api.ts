import { HttpClient } from "../../lib/http.ts";
import { requireConfig } from "../../lib/config.ts";
import type {
  TodoistConfig,
  PaginatedResponse,
  Project,
  Task,
  Label,
  Section,
} from "./types.ts";

const BASE_URL = "https://api.todoist.com/api/v1";

function createClient(): HttpClient {
  const config = requireConfig<TodoistConfig>("todoist");
  return new HttpClient({
    baseUrl: BASE_URL,
    headers: { Authorization: `Bearer ${config.apiToken}` },
  });
}

/** Paginate through all results for a given endpoint */
async function getAll<T>(
  client: HttpClient,
  path: string,
  params?: Record<string, string>
): Promise<T[]> {
  let all: T[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 50; page++) {
    const p: Record<string, string> = { ...params };
    if (cursor) p.cursor = cursor;

    const res = await client.get<PaginatedResponse<T>>(path, p);
    all = all.concat(res.results);

    if (!res.next_cursor) break;
    cursor = res.next_cursor;
  }

  return all;
}

// ── Projects ────────────────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  const client = createClient();
  return getAll<Project>(client, "/projects");
}

export async function getProject(id: string): Promise<Project> {
  const client = createClient();
  return client.get<Project>(`/projects/${id}`);
}

export async function createProject(
  name: string,
  opts?: { parentId?: string; viewStyle?: string; color?: string }
): Promise<Project> {
  const client = createClient();
  const body: Record<string, unknown> = { name };
  if (opts?.parentId) body.parent_id = opts.parentId;
  if (opts?.viewStyle) body.view_style = opts.viewStyle;
  if (opts?.color) body.color = opts.color;
  return client.post<Project>("/projects", body);
}

export async function deleteProject(id: string): Promise<boolean> {
  const client = createClient();
  return client.delete(`/projects/${id}`);
}

// ── Tasks ───────────────────────────────────────────────────────

export async function listTasks(opts?: {
  projectId?: string;
  label?: string;
  filter?: string;
}): Promise<Task[]> {
  const client = createClient();

  if (opts?.filter) {
    return getAll<Task>(client, "/tasks/filter", { query: opts.filter });
  }

  const params: Record<string, string> = {};
  if (opts?.projectId) params.project_id = opts.projectId;
  if (opts?.label) params.label = opts.label;
  return getAll<Task>(client, "/tasks", params);
}

export async function getTask(id: string): Promise<Task> {
  const client = createClient();
  return client.get<Task>(`/tasks/${id}`);
}

export async function createTask(
  content: string,
  opts?: {
    projectId?: string;
    sectionId?: string;
    priority?: number;
    dueString?: string;
    labels?: string[];
    description?: string;
  }
): Promise<Task> {
  const client = createClient();
  const body: Record<string, unknown> = { content };
  if (opts?.projectId) body.project_id = opts.projectId;
  if (opts?.sectionId) body.section_id = opts.sectionId;
  if (opts?.priority) body.priority = opts.priority;
  if (opts?.dueString) body.due_string = opts.dueString;
  if (opts?.labels?.length) body.labels = opts.labels;
  if (opts?.description) body.description = opts.description;
  return client.post<Task>("/tasks", body);
}

export async function quickAddTask(
  text: string
): Promise<Task> {
  const client = createClient();
  return client.post<Task>("/tasks/quick", { text });
}

export async function completeTask(id: string): Promise<void> {
  const client = createClient();
  await client.post(`/tasks/${id}/close`);
}

export async function reopenTask(id: string): Promise<void> {
  const client = createClient();
  await client.post(`/tasks/${id}/reopen`);
}

export async function updateTask(
  id: string,
  opts: {
    content?: string;
    priority?: number;
    dueString?: string;
    labels?: string[];
    description?: string;
  }
): Promise<Task> {
  const client = createClient();
  const body: Record<string, unknown> = {};
  if (opts.content) body.content = opts.content;
  if (opts.priority) body.priority = opts.priority;
  if (opts.dueString) body.due_string = opts.dueString;
  if (opts.labels) body.labels = opts.labels;
  if (opts.description !== undefined) body.description = opts.description;
  return client.post<Task>(`/tasks/${id}`, body);
}

export async function moveTask(
  id: string,
  target: { projectId?: string; sectionId?: string; parentId?: string }
): Promise<void> {
  const client = createClient();
  const body: Record<string, unknown> = {};
  if (target.projectId) body.project_id = target.projectId;
  if (target.sectionId) body.section_id = target.sectionId;
  if (target.parentId) body.parent_id = target.parentId;
  await client.post(`/tasks/${id}/move`, body);
}

export async function deleteTask(id: string): Promise<boolean> {
  const client = createClient();
  return client.delete(`/tasks/${id}`);
}

// ── Labels ──────────────────────────────────────────────────────

export async function listLabels(): Promise<Label[]> {
  const client = createClient();
  return getAll<Label>(client, "/labels");
}

export async function createLabel(
  name: string,
  opts?: { color?: string }
): Promise<Label> {
  const client = createClient();
  const body: Record<string, unknown> = { name };
  if (opts?.color) body.color = opts.color;
  return client.post<Label>("/labels", body);
}

export async function deleteLabel(id: string): Promise<boolean> {
  const client = createClient();
  return client.delete(`/labels/${id}`);
}

// ── Sections ────────────────────────────────────────────────────

export async function listSections(projectId?: string): Promise<Section[]> {
  const client = createClient();
  const params: Record<string, string> = {};
  if (projectId) params.project_id = projectId;
  return getAll<Section>(client, "/sections", params);
}

export async function createSection(
  name: string,
  projectId: string
): Promise<Section> {
  const client = createClient();
  return client.post<Section>("/sections", {
    name,
    project_id: projectId,
  });
}
