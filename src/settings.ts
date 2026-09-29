import type { App } from "obsidian";

export type HomeSection = "overview" | "action" | "knowledge" | "life";

export type HomeCardId =
  | "overview.daily"
  | "overview.capture"
  | "overview.links"
  | "overview.recent"
  | "action.focus"
  | "action.tasks"
  | "action.projects"
  | "knowledge.flow"
  | "knowledge.review"
  | "knowledge.stats"
  | "life.areas"
  | "life.rhythm"
  | "life.quote";

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
  cardOrder: Record<HomeSection, HomeCardId[]>;
  hiddenCards: HomeCardId[];
  quote: string;
  taskLookbackDays: number;
}

export const CARD_META: Record<HomeCardId, { section: HomeSection; title: string }> = {
  "overview.daily": { section: "overview", title: "今天" },
  "overview.capture": { section: "overview", title: "快速捕获" },
  "overview.links": { section: "overview", title: "快捷入口" },
  "overview.recent": { section: "overview", title: "最近修改" },
  "action.focus": { section: "action", title: "今日重点" },
  "action.tasks": { section: "action", title: "行动清单" },
  "action.projects": { section: "action", title: "进行中的领域" },
  "knowledge.flow": { section: "knowledge", title: "知识流动" },
  "knowledge.review": { section: "knowledge", title: "随机回顾" },
  "knowledge.stats": { section: "knowledge", title: "库的状态" },
  "life.areas": { section: "life", title: "人生领域" },
  "life.rhythm": { section: "life", title: "节奏" },
  "life.quote": { section: "life", title: "给自己的提醒" }
};

export const DEFAULT_CARD_ORDER: Record<HomeSection, HomeCardId[]> = {
  overview: ["overview.daily", "overview.capture", "overview.links", "overview.recent"],
  action: ["action.focus", "action.tasks", "action.projects"],
  knowledge: ["knowledge.flow", "knowledge.review", "knowledge.stats"],
  life: ["life.areas", "life.rhythm", "life.quote"]
};

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
  cardOrder: structuredClone(DEFAULT_CARD_ORDER),
  hiddenCards: [],
  quote: "把注意力放回真正重要的事情上。",
  taskLookbackDays: 14
};

function isSection(value: unknown): value is HomeSection {
  return value === "overview" || value === "action" || value === "knowledge" || value === "life";
}

function isCardId(value: unknown): value is HomeCardId {
  return typeof value === "string" && value in CARD_META;
}

function normalizeCardOrder(raw: unknown): Record<HomeSection, HomeCardId[]> {
  const source = raw && typeof raw === "object" ? raw as Partial<Record<HomeSection, unknown>> : {};
  const result = structuredClone(DEFAULT_CARD_ORDER);
  (Object.keys(result) as HomeSection[]).forEach(section => {
    const value = source[section];
    if (!Array.isArray(value)) return;
    const valid = value.filter(isCardId).filter(id => CARD_META[id].section === section);
    const missing = DEFAULT_CARD_ORDER[section].filter(id => !valid.includes(id));
    result[section] = [...valid, ...missing];
  });
  return result;
}

export function normalizeSettings(raw: unknown): HomeSettings {
  const data = raw && typeof raw === "object" ? raw as Partial<HomeSettings> : {};
  const sectionOrder = Array.isArray(data.sectionOrder)
    ? data.sectionOrder.filter(isSection)
    : [...DEFAULT_SETTINGS.sectionOrder];

  return {
    ...DEFAULT_SETTINGS,
    ...data,
    areas: Array.isArray(data.areas) ? data.areas : structuredClone(DEFAULT_SETTINGS.areas),
    links: Array.isArray(data.links) ? data.links : structuredClone(DEFAULT_SETTINGS.links),
    sectionOrder: sectionOrder.length ? sectionOrder : [...DEFAULT_SETTINGS.sectionOrder],
    cardOrder: normalizeCardOrder(data.cardOrder),
    hiddenCards: Array.isArray(data.hiddenCards) ? data.hiddenCards.filter(isCardId) : [],
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
