import { HttpClient, requireConfig } from "@life/shared";
import type {
  TodoProvider,
  TodoProject,
  TodoTask,
  TodoLabel,
  TodoSection,
} from "../types.ts";

const BASE_URL = "https://api.todoist.com/api/v1";

/** Raw Todoist API shapes (snake_case) */
interface RawProject {
  id: string;
  name: string;
  parent_id: string | null;
  child_order: number;
  view_style: string;
  is_favorite: boolean;
  is_deleted: boolean;
  is_archived: boolean;
}

interface RawTask {
  id: string;
  content: string;
  description: string;
  project_id: string;
  section_id: string | null;
  parent_id: string | null;
  priority: number;
  labels: string[];
  due: { date: string; is_recurring: boolean } | null;
}

interface RawLabel {
  id: string;
  name: string;
  color: string;
  order: number;
  is_favorite: boolean;
}

interface RawSection {
  id: string;
  name: string;
  project_id: string;
  section_order: number;
  is_deleted: boolean;
  is_archived: boolean;
}

interface Paginated<T> {
  results: T[];
  next_cursor: string | null;
}

export interface TodoistConfig {
  apiToken: string;
}

function client(): HttpClient {
  const cfg = requireConfig<TodoistConfig>("todo");
  return new HttpClient({
    baseUrl: BASE_URL,
    headers: { Authorization: `Bearer ${cfg.apiToken}` },
  });
}

async function getAll<T>(
  http: HttpClient,
  path: string,
  params?: Record<string, string>
): Promise<T[]> {
  let all: T[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 50; i++) {
    const p: Record<string, string> = { ...params };
    if (cursor) p.cursor = cursor;
    const res = await http.get<Paginated<T>>(path, p);
    all = all.concat(res.results);
    if (!res.next_cursor) break;
    cursor = res.next_cursor;
  }
  return all;
}

// ── Mappers ─────────────────────────────────────────────────────

function mapProject(r: RawProject): TodoProject {
  return {
    id: r.id,
    name: r.name,
    parentId: r.parent_id,
    order: r.child_order,
    viewStyle: r.view_style,
    isFavorite: r.is_favorite,
  };
}

function mapTask(r: RawTask): TodoTask {
  return {
    id: r.id,
    content: r.content,
    description: r.description,
    projectId: r.project_id,
    sectionId: r.section_id,
    parentId: r.parent_id,
    priority: r.priority,
    labels: r.labels,
    dueDate: r.due?.date ?? null,
    isRecurring: r.due?.is_recurring ?? false,
  };
}

function mapLabel(r: RawLabel): TodoLabel {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    order: r.order,
    isFavorite: r.is_favorite,
  };
}

function mapSection(r: RawSection): TodoSection {
  return {
    id: r.id,
    name: r.name,
    projectId: r.project_id,
    order: r.section_order,
  };
}

// ── Provider ────────────────────────────────────────────────────

export const todoist: TodoProvider = {
  name: "todoist",

  async listProjects() {
    const raw = await getAll<RawProject>(client(), "/projects");
    return raw.filter((p) => !p.is_deleted && !p.is_archived).map(mapProject);
  },

  async getProject(id) {
    return mapProject(await client().get<RawProject>(`/projects/${id}`));
  },

  async createProject(name, opts) {
    const body: Record<string, unknown> = { name };
    if (opts?.parentId) body.parent_id = opts.parentId;
    if (opts?.viewStyle) body.view_style = opts.viewStyle;
    if (opts?.color) body.color = opts.color;
    return mapProject(await client().post<RawProject>("/projects", body));
  },

  async deleteProject(id) {
    return client().delete(`/projects/${id}`);
  },

  async listTasks(opts) {
    const http = client();
    if (opts?.filter) {
      const raw = await getAll<RawTask>(http, "/tasks/filter", { query: opts.filter });
      return raw.map(mapTask);
    }
    const params: Record<string, string> = {};
    if (opts?.projectId) params.project_id = opts.projectId;
    if (opts?.label) params.label = opts.label;
    return (await getAll<RawTask>(http, "/tasks", params)).map(mapTask);
  },

  async getTask(id) {
    return mapTask(await client().get<RawTask>(`/tasks/${id}`));
  },

  async createTask(content, opts) {
    const body: Record<string, unknown> = { content };
    if (opts?.projectId) body.project_id = opts.projectId;
    if (opts?.sectionId) body.section_id = opts.sectionId;
    if (opts?.priority) body.priority = opts.priority;
    if (opts?.dueString) body.due_string = opts.dueString;
    if (opts?.labels?.length) body.labels = opts.labels;
    if (opts?.description) body.description = opts.description;
    return mapTask(await client().post<RawTask>("/tasks", body));
  },

  async quickAddTask(text) {
    return mapTask(await client().post<RawTask>("/tasks/quick", { text }));
  },

  async completeTask(id) {
    await client().post(`/tasks/${id}/close`);
  },

  async reopenTask(id) {
    await client().post(`/tasks/${id}/reopen`);
  },

  async updateTask(id, opts) {
    const body: Record<string, unknown> = {};
    if (opts.content) body.content = opts.content;
    if (opts.priority) body.priority = opts.priority;
    if (opts.dueString) body.due_string = opts.dueString;
    if (opts.labels) body.labels = opts.labels;
    if (opts.description !== undefined) body.description = opts.description;
    return mapTask(await client().post<RawTask>(`/tasks/${id}`, body));
  },

  async moveTask(id, target) {
    const body: Record<string, unknown> = {};
    if (target.projectId) body.project_id = target.projectId;
    if (target.sectionId) body.section_id = target.sectionId;
    if (target.parentId) body.parent_id = target.parentId;
    await client().post(`/tasks/${id}/move`, body);
  },

  async deleteTask(id) {
    return client().delete(`/tasks/${id}`);
  },

  async listLabels() {
    return (await getAll<RawLabel>(client(), "/labels")).map(mapLabel);
  },

  async createLabel(name, opts) {
    const body: Record<string, unknown> = { name };
    if (opts?.color) body.color = opts.color;
    return mapLabel(await client().post<RawLabel>("/labels", body));
  },

  async deleteLabel(id) {
    return client().delete(`/labels/${id}`);
  },

  async listSections(projectId) {
    const params: Record<string, string> = {};
    if (projectId) params.project_id = projectId;
    const raw = await getAll<RawSection>(client(), "/sections", params);
    return raw.filter((s) => !s.is_deleted && !s.is_archived).map(mapSection);
  },

  async createSection(name, projectId) {
    return mapSection(
      await client().post<RawSection>("/sections", { name, project_id: projectId })
    );
  },
};
