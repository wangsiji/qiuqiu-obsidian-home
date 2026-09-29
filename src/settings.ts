import type { App } from "obsidian";

export type HomeSection = "overview" | "action" | "knowledge" | "life";

export interface QuickLink {
  id: string;
  label: string;
  target: string;
  icon: string;
  type: "file" | "folder" | "url";
}

export interface LifeArea {
  id: string;
  name: string;
  path: string;
  color: string;
}

export interface HomeSettings {
  openOnStartup: boolean;
  dailyFolder: string;
  dailyFormat: string;
  inboxPath: string;
  newNoteFolder: string;
  areas: LifeArea[];
  links: QuickLink[];
  sectionOrder: HomeSection[];
  quote: string;
  taskLookbackDays: number;
}

export const DEFAULT_SETTINGS: HomeSettings = {
  openOnStartup: true,
  dailyFolder: "00-日记",
  dailyFormat: "YYYY-MM-DD",
  inboxPath: "00-Inbox.md",
  newNoteFolder: "",
  areas: [
    { id: "work", name: "工作 / 一人公司", path: "", color: "#5E81AC" },
    { id: "knowledge", name: "知识 / 学习", path: "", color: "#88C0D0" },
    { id: "life", name: "生活 / 旅居", path: "", color: "#A3BE8C" },
    { id: "health", name: "运动 / 健康", path: "", color: "#B48EAD" }
  ],
  links: [
    { id: "today", label: "今日日记", target: "", icon: "calendar-days", type: "file" },
    { id: "inbox", label: "Inbox", target: "00-Inbox.md", icon: "inbox", type: "file" },
    { id: "projects", label: "项目", target: "", icon: "layers-3", type: "folder" }
  ],
  sectionOrder: ["overview", "action", "knowledge", "life"],
  quote: "把注意力放回真正重要的事情上。",
  taskLookbackDays: 14
};

export function normalizeSettings(raw: unknown): HomeSettings {
  const data = raw && typeof raw === "object" ? raw as Partial<HomeSettings> : {};
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    areas: Array.isArray(data.areas) ? data.areas : structuredClone(DEFAULT_SETTINGS.areas),
    links: Array.isArray(data.links) ? data.links : structuredClone(DEFAULT_SETTINGS.links),
    sectionOrder: Array.isArray(data.sectionOrder) ? data.sectionOrder : [...DEFAULT_SETTINGS.sectionOrder],
    taskLookbackDays: typeof data.taskLookbackDays === "number"
      ? Math.max(1, Math.min(60, Math.floor(data.taskLookbackDays)))
      : DEFAULT_SETTINGS.taskLookbackDays
  };
}

export function dailyPath(settings: HomeSettings, date = new Date()): string {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const name = settings.dailyFormat.replace("YYYY", y).replace("MM", m).replace("DD", d);
  return settings.dailyFolder ? settings.dailyFolder + "/" + name + ".md" : name + ".md";
}

export function resolveArea(app: App, path: string): number {
  if (!path) return 0;
  return app.vault.getMarkdownFiles().filter(file => file.path.startsWith(path + "/") || file.path === path).length;
}
