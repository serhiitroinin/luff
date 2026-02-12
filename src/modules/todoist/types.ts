export interface TodoistConfig {
  apiToken: string;
}

export interface PaginatedResponse<T> {
  results: T[];
  next_cursor: string | null;
}

export interface Project {
  id: string;
  name: string;
  parent_id: string | null;
  child_order: number;
  view_style: string;
  is_favorite: boolean;
  is_shared: boolean;
  is_deleted: boolean;
  is_archived: boolean;
  color: string;
}

export interface Task {
  id: string;
  content: string;
  description: string;
  project_id: string;
  section_id: string | null;
  parent_id: string | null;
  priority: number;
  labels: string[];
  due: {
    date: string;
    string: string;
    is_recurring: boolean;
    datetime: string | null;
  } | null;
  is_completed: boolean;
  created_at: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  order: number;
  is_favorite: boolean;
}

export interface Section {
  id: string;
  name: string;
  project_id: string;
  section_order: number;
  is_deleted: boolean;
  is_archived: boolean;
}
