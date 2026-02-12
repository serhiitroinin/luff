/** Provider-agnostic types for the todo CLI */

export interface TodoProject {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  viewStyle: string;
  isFavorite: boolean;
}

export interface TodoTask {
  id: string;
  content: string;
  description: string;
  projectId: string;
  sectionId: string | null;
  parentId: string | null;
  priority: number; // 1 (none) to 4 (urgent)
  labels: string[];
  dueDate: string | null;
  isRecurring: boolean;
}

export interface TodoLabel {
  id: string;
  name: string;
  color: string;
  order: number;
  isFavorite: boolean;
}

export interface TodoSection {
  id: string;
  name: string;
  projectId: string;
  order: number;
}

/** Every todo provider must implement this interface */
export interface TodoProvider {
  name: string;

  // Projects
  listProjects(): Promise<TodoProject[]>;
  getProject(id: string): Promise<TodoProject>;
  createProject(name: string, opts?: { parentId?: string; viewStyle?: string; color?: string }): Promise<TodoProject>;
  deleteProject(id: string): Promise<boolean>;

  // Tasks
  listTasks(opts?: { projectId?: string; label?: string; filter?: string }): Promise<TodoTask[]>;
  getTask(id: string): Promise<TodoTask>;
  createTask(content: string, opts?: {
    projectId?: string; sectionId?: string; priority?: number;
    dueString?: string; labels?: string[]; description?: string;
  }): Promise<TodoTask>;
  quickAddTask(text: string): Promise<TodoTask>;
  completeTask(id: string): Promise<void>;
  reopenTask(id: string): Promise<void>;
  updateTask(id: string, opts: {
    content?: string; priority?: number; dueString?: string;
    labels?: string[]; description?: string;
  }): Promise<TodoTask>;
  moveTask(id: string, target: { projectId?: string; sectionId?: string; parentId?: string }): Promise<void>;
  deleteTask(id: string): Promise<boolean>;

  // Labels
  listLabels(): Promise<TodoLabel[]>;
  createLabel(name: string, opts?: { color?: string }): Promise<TodoLabel>;
  deleteLabel(id: string): Promise<boolean>;

  // Sections
  listSections(projectId?: string): Promise<TodoSection[]>;
  createSection(name: string, projectId: string): Promise<TodoSection>;
}
