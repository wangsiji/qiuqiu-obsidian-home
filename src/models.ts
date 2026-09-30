import { App, TFile } from "obsidian";

export interface GoalRecord {
  file: TFile;
  title: string;
  status: string;
  current?: number;
  target?: number;
  unit?: string;
  deadline?: string;
}

export interface MilestoneRecord {
  file: TFile;
  title: string;
  status: string;
  project?: string;
  due?: string;
  progress?: number;
}

export interface TaskSession {
  startedAt: number;
  minutes: number;
}

export function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function parseDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : undefined;
}

export function collectGoals(app: App): GoalRecord[] {
  return app.vault.getMarkdownFiles().flatMap(file => {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    if (frontmatter?.type !== "goal") return [];
    return [{
      file,
      title: String(frontmatter.title ?? file.basename),
      status: String(frontmatter.status ?? "active"),
      current: parseNumber(frontmatter.current),
      target: parseNumber(frontmatter.target),
      unit: typeof frontmatter.unit === "string" ? frontmatter.unit : undefined,
      deadline: parseDate(frontmatter.deadline)
    }];
  });
}

export function collectMilestones(app: App): MilestoneRecord[] {
  return app.vault.getMarkdownFiles().flatMap(file => {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    if (frontmatter?.type !== "milestone") return [];
    const progress = parseNumber(frontmatter.progress);
    return [{
      file,
      title: String(frontmatter.title ?? file.basename),
      status: String(frontmatter.status ?? "active"),
      project: typeof frontmatter.project === "string" ? frontmatter.project : undefined,
      due: parseDate(frontmatter.due),
      progress: progress === undefined ? undefined : Math.max(0, Math.min(100, progress))
    }];
  });
}

export function parseTaskSessions(source: string): TaskSession[] {
  const marker = source.match(/<!-- qq:sessions=([^ ]+) -->/);
  if (!marker) return [];
  return marker[1].split(",").flatMap(entry => {
    const [timestamp, minutes] = entry.split(":");
    const startedAt = Number(timestamp);
    const duration = Number(minutes);
    return Number.isFinite(startedAt) && Number.isFinite(duration) ? [{ startedAt, minutes: duration }] : [];
  });
}

export function formatSessionMarker(sessions: TaskSession[]): string {
  return sessions.length ? " <!-- qq:sessions=" + sessions.map(s => s.startedAt + ":" + s.minutes).join(",") + " -->" : "";
}

export function todaySessionMinutes(sessions: TaskSession[], now = new Date()): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  const end = startMs + 86400000;
  return sessions.filter(s => s.startedAt >= startMs && s.startedAt < end).reduce((sum, s) => sum + s.minutes, 0);
}
