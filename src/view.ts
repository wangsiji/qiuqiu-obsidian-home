import { ItemView, Notice, TFile, WorkspaceLeaf, moment, setIcon } from "obsidian";
import type QiuqiuHomePlugin from "./main";
import { CARD_META, HomeCardId, HomeSection, dailyPath } from "./settings";

export const VIEW_TYPE_QIUQIU_HOME = "qiuqiu-home-view";

interface TaskItem {
  file: TFile;
  line: number;
  text: string;
  done: boolean;
  startedAt?: number;
  durationMinutes?: number;
  completedAt?: number;
}

const META: Record<HomeSection, { label: string; icon: string; eyebrow: string }> = {
  overview: { label: "总览", icon: "panel-top", eyebrow: "OVERVIEW" },
  action: { label: "行动", icon: "zap", eyebrow: "ACTION" },
  knowledge: { label: "知识", icon: "brain", eyebrow: "KNOWLEDGE" },
  life: { label: "生活", icon: "sun", eyebrow: "LIFE" }
};

export class HomeView extends ItemView {
  plugin: QiuqiuHomePlugin;
  private searchInput?: HTMLInputElement;
  private root?: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: QiuqiuHomePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return VIEW_TYPE_QIUQIU_HOME; }
  getDisplayText(): string { return "Qiuqiu Home"; }
  getIcon(): string { return "layout-dashboard"; }

  async onOpen(): Promise<void> {
    this.render();
    this.registerDomEvent(document, "keydown", event => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      if (this.app.workspace.activeLeaf?.view !== this) return;
      event.preventDefault();
      this.focusSearch();
    });
  }
  async onClose(): Promise<void> { this.root?.empty(); }

  focusSearch(): void {
    this.searchInput?.focus();
    this.searchInput?.select();
  }

  render(): void {
    const container = this.containerEl;
    container.empty();
    container.addClass("qq-home-view");
    this.root = container.createDiv("qq-home");
    this.renderHeader(this.root);
    this.renderSearch(this.root);
    this.renderNav(this.root);

    const body = this.root.createDiv("qq-home-body");
    this.plugin.settings.sectionOrder.forEach(section => this.renderSection(body, section));
    const footer = this.root.createDiv("qq-home-footer");
    footer.setText(this.plugin.settings.quote);
  }

  private renderHeader(root: HTMLElement): void {
    const header = root.createDiv("qq-home-header");
    const brand = header.createDiv("qq-home-brand");
    brand.createDiv("qq-home-mark").setText("Q");
    const copy = brand.createDiv();
    copy.createDiv("qq-home-title").setText("Qiuqiu Home");
    copy.createDiv("qq-home-subtitle").setText("你的第二大脑，从这里开始。");

    const meta = header.createDiv("qq-home-meta");
    const now = new Date();
    meta.createDiv("qq-home-date").setText(now.toLocaleDateString("zh-CN", {
      year: "numeric", month: "long", day: "numeric", weekday: "long"
    }));
    meta.createDiv("qq-home-time").setText(now.toLocaleTimeString("zh-CN", {
      hour: "2-digit", minute: "2-digit"
    }));
  }

  private renderSearch(root: HTMLElement): void {
    const shell = root.createDiv("qq-search-shell");
    setIcon(shell.createSpan("qq-search-icon"), "search");
    this.searchInput = shell.createEl("input", {
      type: "search",
      placeholder: "搜索笔记，或者直接创建……"
    });
    shell.createSpan("qq-search-hint").setText("⌘ K");

    const results = root.createDiv("qq-search-results");
    this.searchInput.addEventListener("input", () => {
      const query = this.searchInput?.value.trim() ?? "";
      if (!query) { results.empty(); return; }
      this.renderSearchResults(query, results);
    });
    this.searchInput.addEventListener("keydown", event => {
      if (event.key === "Enter") void this.runSearch(this.searchInput?.value ?? "");
      if (event.key === "Escape") {
        this.searchInput!.value = "";
        results.empty();
      }
    });
  }

  private renderSearchResults(query: string, results: HTMLElement): void {
    results.empty();
    const q = query.toLowerCase();
    const files = this.plugin.app.vault.getMarkdownFiles()
      .filter(file => file.basename.toLowerCase().includes(q) || file.path.toLowerCase().includes(q))
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, 8);

    if (!files.length) {
      results.createDiv("qq-search-empty").setText("没有匹配笔记，按 Enter 创建「" + query + "」");
      return;
    }

    files.forEach(file => {
      const row = results.createDiv("qq-search-row");
      setIcon(row.createSpan("qq-search-row-icon"), "file-text");
      const copy = row.createDiv();
      copy.createDiv("qq-search-row-title").setText(file.basename);
      copy.createDiv("qq-search-row-path").setText(file.path);
      row.addEventListener("click", () => void this.plugin.app.workspace.getLeaf("tab").openFile(file));
    });
  }

  private async runSearch(query: string): Promise<void> {
    const clean = query.trim();
    if (!clean) return;
    const exact = this.plugin.app.vault.getMarkdownFiles()
      .find(file => file.basename.toLowerCase() === clean.toLowerCase());
    if (exact) {
      await this.plugin.app.workspace.getLeaf("tab").openFile(exact);
      return;
    }

    const safeName = clean.replace(/[\\/:*?"<>|]/g, "-").trim();
    const folder = this.plugin.settings.newNoteFolder;
    const path = folder ? folder + "/" + safeName + ".md" : safeName + ".md";
    try {
      await this.plugin.ensureFolder(folder);
      const file = await this.plugin.app.vault.create(path, "# " + clean + "\n\n");
      await this.plugin.app.workspace.getLeaf("tab").openFile(file);
    } catch {
      new Notice("无法创建笔记，请检查名称或目录。");
    }
  }

  private renderNav(root: HTMLElement): void {
    const nav = root.createDiv("qq-home-nav");
    this.plugin.settings.sectionOrder.forEach(section => {
      const item = nav.createDiv("qq-nav-item");
      setIcon(item.createSpan(), META[section].icon);
      item.createSpan().setText(META[section].label);
      item.addEventListener("click", () => {
        root.querySelector("[data-section='" + section + "']")?.scrollIntoView({ behavior: "smooth" });
      });
    });
    const settings = nav.createDiv("qq-nav-settings");
    setIcon(settings, "settings-2");
    settings.setAttribute("aria-label", "打开插件设置");
    settings.addEventListener("click", () => {
      const app = this.app as typeof this.app & {
        setting?: { open: () => void; openTabById: (id: string) => void };
      };
      app.setting?.open();
      app.setting?.openTabById(this.plugin.manifest.id);
    });
  }

  private renderSection(parent: HTMLElement, section: HomeSection): void {
    const wrapper = parent.createDiv("qq-section");
    wrapper.dataset.section = section;
    const heading = wrapper.createDiv("qq-section-heading");
    const copy = heading.createDiv();
    copy.createDiv("qq-section-eyebrow").setText(META[section].eyebrow);
    copy.createDiv("qq-section-title").setText(META[section].label);
    const icon = heading.createDiv("qq-section-icon");
    setIcon(icon, META[section].icon);

    const grid = wrapper.createDiv("qq-card-grid");
    const order = this.plugin.settings.cardOrder[section] ?? [];
    order.filter(id => CARD_META[id].section === section && !this.plugin.settings.hiddenCards.includes(id))
      .forEach(id => {
        const before = grid.childElementCount;
        this.renderCardById(grid, id);
        const card = grid.children[before] as HTMLElement | undefined;
        if (card) this.enableCardDrag(card, section, id);
      });
  }

  private enableCardDrag(card: HTMLElement, section: HomeSection, id: HomeCardId): void {
    card.draggable = true;
    card.dataset.cardId = id;
    card.addEventListener("dragstart", event => {
      card.classList.add("qq-card-dragging");
      event.dataTransfer?.setData("text/plain", id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => card.classList.remove("qq-card-dragging"));
    card.addEventListener("dragover", event => {
      event.preventDefault();
      card.classList.add("qq-card-drag-over");
    });
    card.addEventListener("dragleave", () => card.classList.remove("qq-card-drag-over"));
    card.addEventListener("drop", event => {
      event.preventDefault();
      card.classList.remove("qq-card-drag-over");
      const from = event.dataTransfer?.getData("text/plain") as HomeCardId;
      if (!from || from === id) return;
      const order = [...this.plugin.settings.cardOrder[section]];
      const fromIndex = order.indexOf(from);
      const toIndex = order.indexOf(id);
      if (fromIndex < 0 || toIndex < 0) return;
      order.splice(fromIndex, 1);
      order.splice(order.indexOf(id), 0, from);
      this.plugin.settings.cardOrder[section] = order;
      void this.plugin.saveSettings();
    });
  }

  private renderCardById(grid: HTMLElement, id: HomeCardId): void {
    switch (id) {
      case "overview.daily": this.renderDailyCard(grid); break;
      case "overview.capture": this.renderCaptureCard(grid); break;
      case "overview.links": this.renderQuickLinks(grid); break;
      case "overview.recent": this.renderRecentCard(grid); break;
      case "action.focus": this.renderFocusCard(grid); break;
      case "action.tasks": this.renderTaskCard(grid); break;
      case "action.projects": this.renderProjectsCard(grid); break;
      case "knowledge.flow": this.renderKnowledgeCard(grid); break;
      case "knowledge.review": this.renderReviewCard(grid); break;
      case "knowledge.stats": this.renderStatsCard(grid); break;
      case "life.areas": this.renderAreaCard(grid); break;
      case "life.rhythm": this.renderLifeMetrics(grid); break;
      case "life.quote": this.renderQuoteCard(grid); break;
    }
  }

  private card(parent: HTMLElement, title: string, icon: string, cls = ""): HTMLElement {
    const card = parent.createDiv(("qq-card " + cls).trim());
    const head = card.createDiv("qq-card-head");
    const titleEl = head.createDiv("qq-card-title");
    setIcon(titleEl.createSpan(), icon);
    titleEl.createSpan().setText(title);
    return card;
  }

  private renderDailyCard(grid: HTMLElement): void {
    const card = this.card(grid, "今天", "calendar-days", "qq-card-feature");
    const path = dailyPath(this.plugin.settings);
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    const date = new Date();
    card.createDiv("qq-big-date").setText(String(date.getDate()));
    card.createDiv("qq-muted").setText(date.toLocaleDateString("zh-CN", { month: "long", weekday: "long" }));
    const actions = card.createDiv("qq-card-actions");
    this.button(actions, "打开日记", "arrow-up-right", () => void this.plugin.openToday());
    if (file instanceof TFile) card.createDiv("qq-stat-line").setText("最后编辑 · " + moment(file.stat.mtime).fromNow());
    else card.createDiv("qq-muted qq-spaced").setText("今天还没有记录。");
    const streak = this.dailyStreak();
    card.createDiv("qq-streak").setText("连续记录 " + streak + " 天");
  }

  private dailyStreak(): number {
    let streak = 0;
    const cursor = new Date();
    for (let i = 0; i < 365; i++) {
      if (!(this.plugin.app.vault.getAbstractFileByPath(dailyPath(this.plugin.settings, cursor)) instanceof TFile)) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  private renderCaptureCard(grid: HTMLElement): void {
    const card = this.card(grid, "快速捕获", "inbox", "qq-card-capture");
    const input = card.createEl("textarea", { placeholder: "想到什么，先放进来……" });
    input.rows = 3;
    const actions = card.createDiv("qq-capture-actions");
    this.button(actions, "写入 Inbox", "corner-down-left", async () => {
      const value = input.value.trim();
      if (!value) return;
      await this.appendToFile(this.plugin.settings.inboxPath, "- " + value);
      input.value = "";
      new Notice("已写入 Inbox");
    });
    this.button(actions, "写入今天", "calendar-plus", async () => {
      const value = input.value.trim();
      if (!value) return;
      await this.appendToFile(dailyPath(this.plugin.settings), "- " + value);
      input.value = "";
      new Notice("已写入今日日记");
    });
  }

  private renderQuickLinks(grid: HTMLElement): void {
    const card = this.card(grid, "快捷入口", "command", "qq-card-links");
    this.plugin.settings.links.slice(0, 8).forEach(link => {
      const row = card.createDiv("qq-link-row");
      setIcon(row.createSpan("qq-link-icon"), link.icon || "link");
      row.createSpan().setText(link.label);
      row.addEventListener("click", () => {
        if (link.id === "today") void this.plugin.openToday();
        else void this.plugin.openTarget(link.target);
      });
    });
  }

  private renderRecentCard(grid: HTMLElement): void {
    const card = this.card(grid, "最近修改", "history");
    this.plugin.app.vault.getMarkdownFiles()
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, 5)
      .forEach(file => {
        const row = card.createDiv("qq-note-row");
        row.createDiv("qq-note-title").setText(file.basename);
        row.createDiv("qq-note-meta").setText(moment(file.stat.mtime).fromNow());
        row.addEventListener("click", () => void this.plugin.app.workspace.getLeaf("tab").openFile(file));
      });
  }

  private renderFocusCard(grid: HTMLElement): void {
    const card = this.card(grid, "今日重点", "target", "qq-card-focus");
    const input = card.createEl("input", { type: "text", placeholder: "今天真正重要的事情是什么？" });
    input.value = this.getTodayFocus();
    input.addEventListener("change", async () => {
      await this.upsertFrontmatter(dailyPath(this.plugin.settings), "focus", input.value.trim());
      new Notice("今日重点已保存");
    });
    card.createDiv("qq-muted qq-spaced").setText("把真正重要的 1 件事放在这里。");
  }

  private getTodayFocus(): string {
    const file = this.plugin.app.vault.getAbstractFileByPath(dailyPath(this.plugin.settings));
    if (!(file instanceof TFile)) return "";
    const value = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter?.focus;
    return typeof value === "string" ? value : "";
  }

  private renderTaskCard(grid: HTMLElement): void {
    const card = this.card(grid, "行动清单", "list-checks");
    card.createDiv("qq-progress-row").setText("读取最近 " + this.plugin.settings.taskLookbackDays + " 天任务……");
    void this.populateTaskCard(card);
  }

  private async populateTaskCard(card: HTMLElement): Promise<void> {
    const tasks = await this.collectTasks();
    const open = tasks.filter(task => !task.done);
    const tracked = tasks.reduce((sum, task) => sum + (task.durationMinutes ?? 0), 0);
    const doing = open.filter(task => task.startedAt).sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));
    const recentDone = tasks
      .filter(task => task.done && task.completedAt)
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
      .slice(0, 3);
    const progress = card.querySelector(".qq-progress-row");
    if (progress instanceof HTMLElement) {
      progress.setText(open.length + " 件未完成 · 已记录 " + this.formatDuration(tracked));
    }

    const next = open.find(task => !task.startedAt) ?? open[0];
    if (next) {
      const nextRow = card.createDiv("qq-next-action");
      nextRow.createDiv("qq-next-label").setText("下一步");
      nextRow.createDiv("qq-next-text").setText(next.text);
      this.button(nextRow, next.startedAt ? "继续" : "开始", "play", () => void this.startTask(next));
    }

    if (doing.length) {
      card.createDiv("qq-task-group-label").setText("进行中");
      doing.slice(0, 3).forEach(task => this.renderTaskRow(card, task));
    }

    const remaining = open.filter(task => !doing.includes(task));
    if (remaining.length) {
      card.createDiv("qq-task-group-label").setText("待处理");
      remaining.slice(0, 4).forEach(task => this.renderTaskRow(card, task));
    }

    if (recentDone.length) {
      card.createDiv("qq-task-group-label").setText("最近完成");
      recentDone.forEach(task => {
        const row = card.createDiv("qq-task-done-row");
        row.createDiv("qq-task-text").setText(task.text);
        row.createDiv("qq-task-timing").setText((task.durationMinutes ? this.formatDuration(task.durationMinutes) + " · " : "") + moment(task.completedAt).fromNow());
      });
    }

    if (!open.length) card.createDiv("qq-empty-state").setText("今天很干净。");
  }

  private renderTaskRow(card: HTMLElement, task: TaskItem): void {
    const row = card.createDiv("qq-task-row");
      const box = row.createEl("input", { type: "checkbox" });
      const copy = row.createDiv("qq-task-copy");
      copy.createDiv("qq-task-text").setText(task.text);
      if (task.startedAt) {
        copy.createDiv("qq-task-timing").setText("进行中 · " + this.formatDuration(Math.max(0, Math.floor((Date.now() - task.startedAt) / 60000))));
      }
      const action = row.createEl("button", { cls: "qq-task-start" });
      action.setText(task.startedAt ? "完成" : "开始");
      action.addEventListener("click", async event => {
        event.stopPropagation();
        if (task.startedAt) {
          await this.toggleTask(task);
        } else {
          await this.startTask(task);
        }
      });
    box.checked = task.done;
    box.addEventListener("change", () => void this.toggleTask(task));
  }

  private formatDuration(minutes: number): string {
    if (minutes < 1) return "0 分钟";
    const hours = Math.floor(minutes / 60);
    return hours ? hours + " 小时 " + (minutes % 60) + " 分钟" : minutes + " 分钟";
  }

  private async collectTasks(): Promise<TaskItem[]> {
    const cutoff = Date.now() - this.plugin.settings.taskLookbackDays * 86400000;
    const result: TaskItem[] = [];
    for (const file of this.plugin.app.vault.getMarkdownFiles()) {
      if (file.stat.mtime < cutoff) continue;
      const lines = (await this.plugin.app.vault.read(file)).split("\n");
      const items = this.plugin.app.metadataCache.getFileCache(file)?.listItems ?? [];
      for (const item of items) {
        if (typeof item.task !== "string") continue;
        const line = item.position.start.line;
        const source = lines[line] ?? "";
        const text = source.replace(/^\s*[-*+]\s+\[[^\]]\]\s*/, "").replace(/<!-- qq:(?:start=\d+|duration=\d+) -->/g, "").trim();
        const startMatch = source.match(/<!-- qq:start=(\d+) -->/);
        const durationMatch = source.match(/<!-- qq:duration=(\d+) -->/);
        result.push({
          file,
          line,
          text,
          done: item.task.toLowerCase() !== " ",
          startedAt: startMatch ? Number(startMatch[1]) : undefined,
          durationMinutes: durationMatch ? Number(durationMatch[1]) : undefined
        });
      }
    }
    return result;
  }

  private async startTask(task: TaskItem): Promise<void> {
    const content = await this.plugin.app.vault.read(task.file);
    const lines = content.split("\n");
    if (task.line >= lines.length || task.done) return;
    if (/<!-- qq:start=\d+ -->/.test(lines[task.line])) return;
    lines[task.line] = lines[task.line]
      .replace(/\s*<!-- qq:start=\d+ -->/, "")
      .replace(/\s*$/, "") + " <!-- qq:start=" + Date.now() + " -->";
    await this.plugin.app.vault.modify(task.file, lines.join("\n"));
    new Notice("已开始记录耗时");
    this.render();
  }

  private readMarker(source: string, marker: "start" | "duration" | "done"): number | undefined {
    const match = source.match(new RegExp("<!-- qq:" + marker + "=(\\d+) -->"));
    return match ? Number(match[1]) : undefined;
  }

  private async toggleTask(task: TaskItem): Promise<void> {
    const content = await this.plugin.app.vault.read(task.file);
    const lines = content.split("\n");
    if (task.line >= lines.length) return;

    let line = lines[task.line];
    const startMatch = line.match(/<!-- qq:start=(\d+) -->/);
    if (!task.done && startMatch) {
      const elapsed = Math.max(1, Math.round((Date.now() - Number(startMatch[1])) / 60000));
      const total = (task.durationMinutes ?? 0) + elapsed;
      line = line
        .replace(/\s*<!-- qq:start=\d+ -->/, "")
        .replace(/\s*<!-- qq:duration=\d+ -->/, "")
        .replace(/\s*$/, "") + " <!-- qq:duration=" + total + " -->";
      new Notice("任务完成 · 本次 " + this.formatDuration(elapsed) + " · 累计 " + this.formatDuration(total));
    }
    line = line.replace(/\s*<!-- qq:done=\d+ -->/, "");
    if (!task.done) {
      line = line.replace(/\s*$/, "") + " <!-- qq:done=" + Date.now() + " -->";
    }
    lines[task.line] = line.replace(/\[[ xX]\]/, task.done ? "[ ]" : "[x]");
    await this.plugin.app.vault.modify(task.file, lines.join("\n"));
    this.render();
  }

  private renderProjectsCard(grid: HTMLElement): void {
    const card = this.card(grid, "进行中的领域", "layers-3");
    this.plugin.settings.areas.slice(0, 4).forEach(area => {
      const row = card.createDiv("qq-area-row");
      const dot = row.createSpan("qq-area-dot");
      dot.style.backgroundColor = area.color;
      const copy = row.createDiv();
      copy.createDiv("qq-area-name").setText(area.name);
      const total = area.path ? this.countAreaTasks(area.path) : 0;
      const done = area.path ? this.countAreaTasks(area.path, true) : 0;
      copy.createDiv("qq-area-meta").setText(area.path ? done + " / " + total + " 个任务完成" : "尚未配置路径");
      if (area.path) row.addEventListener("click", () => void this.plugin.openTarget(area.path));
    });
  }

  private countAreaTasks(path: string, doneOnly = false): number {
    let count = 0;
    for (const file of this.plugin.app.vault.getMarkdownFiles()) {
      if (!(file.path.startsWith(path + "/") || file.path === path)) continue;
      for (const item of this.plugin.app.metadataCache.getFileCache(file)?.listItems ?? []) {
        if (typeof item.task !== "string") continue;
        const match = item.task.match(/^([ xX])/);
        if (!match) continue;
        if (!doneOnly || match[1].toLowerCase() === "x") count++;
      }
    }
    return count;
  }

  private countNotes(path: string): number {
    return this.plugin.app.vault.getMarkdownFiles()
      .filter(file => file.path.startsWith(path + "/") || file.path === path).length;
  }

  private renderKnowledgeCard(grid: HTMLElement): void {
    const card = this.card(grid, "知识流动", "brain");
    const files = this.plugin.app.vault.getMarkdownFiles();
    const active = files.filter(file => file.stat.mtime > Date.now() - 7 * 86400000);
    card.createDiv("qq-number").setText(String(active.length));
    card.createDiv("qq-muted").setText("过去 7 天活跃笔记");
    const tags = new Map<string, number>();
    active.forEach(file => {
      (this.plugin.app.metadataCache.getFileCache(file)?.tags ?? []).forEach(tag => {
        tags.set(tag.tag, (tags.get(tag.tag) ?? 0) + 1);
      });
    });
    const cloud = card.createDiv("qq-tag-cloud");
    [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([tag, count]) => {
      cloud.createSpan("qq-tag").setText(tag.replace("#", "") + " · " + count);
    });
  }

  private renderReviewCard(grid: HTMLElement): void {
    const card = this.card(grid, "回顾入口", "calendar-range");
    const weekStart = this.startOfWeek(new Date());
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const weekFiles = this.plugin.app.vault.getMarkdownFiles().filter(f => f.stat.mtime >= weekStart.getTime()).length;
    const monthFiles = this.plugin.app.vault.getMarkdownFiles().filter(f => f.stat.mtime >= monthStart.getTime()).length;
    card.createDiv("qq-review-metric").setText("本周活跃 · " + weekFiles + " 篇");
    card.createDiv("qq-review-metric").setText("本月活跃 · " + monthFiles + " 篇");
    this.button(card, "随机打开旧笔记", "shuffle", () => {
      const files = this.plugin.app.vault.getMarkdownFiles().filter(file => file.stat.mtime < Date.now() - 30 * 86400000);
      if (!files.length) { new Notice("还没有足够久的旧笔记。"); return; }
      const file = files[Math.floor(Math.random() * files.length)];
      void this.plugin.app.workspace.getLeaf("tab").openFile(file);
    });
  }

  private startOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private renderStatsCard(grid: HTMLElement): void {
    const card = this.card(grid, "库的状态", "database");
    const files = this.plugin.app.vault.getMarkdownFiles();
    const active = files.filter(file => file.stat.mtime > Date.now() - 30 * 86400000).length;
    const links = Object.keys(this.plugin.app.metadataCache.resolvedLinks).length;
    const statGrid = card.createDiv("qq-stat-grid");
    [[String(files.length), "Markdown"], [String(active), "近 30 天活跃"], [String(links), "链接节点"], [String(new Set(files.map(file => file.parent?.path ?? "")).size), "目录"]]
      .forEach(([value, label]) => {
        const cell = statGrid.createDiv();
        cell.createEl("strong", { text: value });
        cell.createEl("span", { text: label });
      });
  }

  private renderAreaCard(grid: HTMLElement): void {
    const card = this.card(grid, "人生领域", "compass");
    this.plugin.settings.areas.forEach(area => {
      const row = card.createDiv("qq-area-row");
      const dot = row.createSpan("qq-area-dot");
      dot.style.backgroundColor = area.color;
      row.createSpan().setText(area.name);
      row.createSpan("qq-area-arrow").setText("→");
      if (area.path) row.addEventListener("click", () => void this.plugin.openTarget(area.path));
    });
  }

  private renderLifeMetrics(grid: HTMLElement): void {
    const card = this.card(grid, "节奏", "activity");
    const active7 = this.plugin.app.vault.getMarkdownFiles().filter(file => file.stat.mtime > Date.now() - 7 * 86400000).length;
    const active30 = this.plugin.app.vault.getMarkdownFiles().filter(file => file.stat.mtime > Date.now() - 30 * 86400000).length;
    card.createDiv("qq-metric").innerHTML = "<strong>" + active7 + "</strong><span>本周活跃笔记</span>";
    card.createDiv("qq-metric qq-spaced").innerHTML = "<strong>" + active30 + "</strong><span>本月活跃笔记</span>";
    card.createDiv("qq-metric qq-spaced").innerHTML = "<strong>" + this.countCompletedTasks() + "</strong><span>最近任务已完成</span>";

  }

  private countCompletedTasks(): number {
    const cutoff = Date.now() - this.plugin.settings.taskLookbackDays * 86400000;
    let count = 0;
    for (const file of this.plugin.app.vault.getMarkdownFiles()) {
      if (file.stat.mtime < cutoff) continue;
      for (const item of this.plugin.app.metadataCache.getFileCache(file)?.listItems ?? []) {
        if (typeof item.task === "string" && item.task.toLowerCase() !== " ") count++;
      }
    }
    return count;
  }

  private renderQuoteCard(grid: HTMLElement): void {
    const card = this.card(grid, "给自己的提醒", "sparkles", "qq-card-quote");
    card.createDiv("qq-quote").setText(this.plugin.settings.quote);
    card.createDiv("qq-muted").setText("不是把系统做复杂，而是让下一步更容易发生。");
  }

  private async appendToFile(path: string, line: string): Promise<void> {
    const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    await this.plugin.ensureFolder(parent);
    const existing = this.plugin.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      const content = await this.plugin.app.vault.read(existing);
      await this.plugin.app.vault.modify(existing, content.replace(/\s*$/, "") + "\n" + line + "\n");
    } else {
      await this.plugin.app.vault.create(path, "# Inbox\n\n" + line + "\n");
    }
  }

  private async upsertFrontmatter(path: string, key: string, value: string): Promise<void> {
    const existing = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!(existing instanceof TFile)) {
      await this.plugin.openToday();
      return this.upsertFrontmatter(path, key, value);
    }
    const content = await this.plugin.app.vault.read(existing);
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
      await this.plugin.app.vault.modify(existing, "---\n" + key + ": " + JSON.stringify(value) + "\n---\n\n" + content);
      return;
    }
    const line = key + ": " + JSON.stringify(value);
    const frontmatter = match[1];
    const re = new RegExp("^" + key.replace(/[.*+?^{}()|[\\]\\\\]/g, "\\\\$&") + ":.*$", "m");
    const nextFrontmatter = re.test(frontmatter) ? frontmatter.replace(re, line) : frontmatter + "\n" + line;
    await this.plugin.app.vault.modify(existing, content.replace(match[0], "---\n" + nextFrontmatter + "\n---"));
  }

  private button(parent: HTMLElement, label: string, icon: string, action: () => void | Promise<void>): HTMLElement {
    const button = parent.createEl("button", { cls: "qq-button" });
    setIcon(button.createSpan(), icon);
    button.createSpan().setText(label);
    button.addEventListener("click", () => void action());
    return button;
  }
}
