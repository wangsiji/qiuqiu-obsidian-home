import { ItemView, Notice, TFile, WorkspaceLeaf, setIcon } from "obsidian";
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
      case "overview.calendar": this.renderCalendarCard(grid); break;
      case "overview.timeline": this.renderTimelineCard(grid); break;
      case "overview.habits": this.renderHabitsCard(grid); break;
      case "overview.inbox": this.renderInboxCard(grid); break;
      case "action.focus": this.renderFocusCard(grid); break;
      case "action.tasks": this.renderTaskCard(grid); break;
      case "action.projects": this.renderProjectsCard(grid); break;
      case "action.due": this.renderTaskFilterCard(grid, "due"); break;
      case "action.overdue": this.renderTaskFilterCard(grid, "overdue"); break;
      case "action.next": this.renderNextActionsCard(grid); break;
      case "action.milestones": this.renderMilestonesCard(grid); break;
      case "action.goal": this.renderGoalCard(grid); break;
      case "action.timer": this.renderTimerCard(grid); break;
      case "action.countdown": this.renderCountdownCard(grid); break;
      case "action.agenda": this.renderAgendaCard(grid); break;
      case "knowledge.flow": this.renderKnowledgeCard(grid); break;
      case "knowledge.review": this.renderReviewCard(grid); break;
      case "knowledge.stats": this.renderStatsCard(grid); break;
      case "knowledge.tags": this.renderTagsCard(grid); break;
      case "knowledge.unlinked": this.renderUnlinkedCard(grid); break;
      case "knowledge.missing": this.renderMissingLinksCard(grid); break;
      case "knowledge.heatmap": this.renderHeatmapCard(grid); break;
      case "knowledge.workset": this.renderWorksetCard(grid); break;
      case "knowledge.template": this.renderTemplateCard(grid); break;
      case "knowledge.question": this.renderQuestionCard(grid); break;
      case "knowledge.snippets": this.renderSnippetsCard(grid); break;
      case "knowledge.video": this.renderVideoCard(grid); break;
      case "life.areas": this.renderAreaCard(grid); break;
      case "life.rhythm": this.renderLifeMetrics(grid); break;
      case "life.quote": this.renderQuoteCard(grid); break;
      case "life.time": this.renderTimeProgressCard(grid); break;
      case "life.world": this.renderWorldClockCard(grid); break;
      case "life.weather": this.renderWeatherCard(grid); break;
      case "life.noise": this.renderNoiseCard(grid); break;
      case "life.search": this.renderMultiSearchCard(grid); break;
      case "life.learning": this.renderLearningCard(grid); break;
      case "life.integrations": this.renderIntegrationsCard(grid); break;
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
    if (file instanceof TFile) card.createDiv("qq-stat-line").setText("最后编辑 · " + window.moment(file.stat.mtime).fromNow());
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
        row.createDiv("qq-note-meta").setText(window.moment(file.stat.mtime).fromNow());
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
    const now = Date.now();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const todayDone = tasks.filter(task => task.completedAt && task.completedAt >= dayStart.getTime());
    const todayTracked = todayDone.reduce((sum, task) => sum + (task.durationMinutes ?? 0), 0);
    const ongoingMinutes = open
      .filter(task => task.startedAt)
      .reduce((sum, task) => sum + Math.max(0, Math.floor((now - Number(task.startedAt)) / 60000)), 0);
    const doing = open.filter(task => task.startedAt).sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));
    const recentDone = tasks
      .filter(task => task.done && task.completedAt)
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
      .slice(0, 3);
    const progress = card.querySelector(".qq-progress-row");
    if (progress instanceof HTMLElement) {
      progress.setText("今日投入 " + this.formatDuration(todayTracked + ongoingMinutes) + " · " + open.length + " 件未完成");
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
        row.createDiv("qq-task-timing").setText((task.durationMinutes ? this.formatDuration(task.durationMinutes) + " · " : "") + window.moment(task.completedAt).fromNow());
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
        const text = source.replace(/^\s*[-*+]\s+\[[^\]]\]\s*/, "").replace(/<!-- qq:(?:start|duration|done)=\d+ -->/g, "").trim();
        const startMatch = source.match(/<!-- qq:start=(\d+) -->/);
        const durationMatch = source.match(/<!-- qq:duration=(\d+) -->/);
        result.push({
          file,
          line,
          text,
          done: item.task.toLowerCase() !== " ",
          startedAt: startMatch ? Number(startMatch[1]) : undefined,
          durationMinutes: durationMatch ? Number(durationMatch[1]) : undefined,
          completedAt: this.readMarker(source, "done")
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
    const card = this.card(grid, "项目进度", "layers-3");
    const areas = this.plugin.settings.areas.slice(0, 4);
    areas.forEach(area => {
      const row = card.createDiv("qq-project-row");
      const head = row.createDiv("qq-project-head");
      const dot = head.createSpan("qq-area-dot");
      dot.style.backgroundColor = area.color;
      head.createSpan("qq-project-name").setText(area.name);
      const total = area.path ? this.countAreaTasks(area.path) : 0;
      const done = area.path ? this.countAreaTasks(area.path, true) : 0;
      const progress = total ? Math.round(done / total * 100) : 0;
      head.createSpan("qq-project-percent").setText(total ? progress + "%" : "—");
      const bar = row.createDiv("qq-project-bar");
      const fill = bar.createDiv("qq-project-fill");
      fill.style.width = progress + "%";
      row.createDiv("qq-project-meta").setText(area.path ? total + " 个任务 · " + done + " 已完成" : "尚未配置路径");
      if (area.path) row.addEventListener("click", () => void this.plugin.openTarget(area.path));
    });
  }

  private countAreaTasks(path: string, doneOnly = false): number {
    let count = 0;
    for (const file of this.plugin.app.vault.getMarkdownFiles()) {
      if (!(file.path.startsWith(path + "/") || file.path === path)) continue;
      for (const item of this.plugin.app.metadataCache.getFileCache(file)?.listItems ?? []) {
        if (typeof item.task !== "string") continue;
        const done = item.task.toLowerCase() !== " ";
        if (!doneOnly || done) count++;
      }
    }
    return count;
  }

  private renderCalendarCard(grid: HTMLElement): void {
    const card=this.card(grid,"日历","calendar-range");
    const now=new Date(); const days=["一","二","三","四","五","六","日"];
    card.createDiv("qq-calendar-month").setText(now.toLocaleDateString("zh-CN",{year:"numeric",month:"long"}));
    const row=card.createDiv("qq-calendar-week");
    days.forEach(d=>row.createSpan().setText(d));
    const first=new Date(now.getFullYear(),now.getMonth(),1).getDay()||7;
    const count=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
    const gridEl=card.createDiv("qq-calendar-grid");
    for(let i=1;i<first;i++) gridEl.createSpan();
    for(let d=1;d<=count;d++){const cell=gridEl.createEl("button",{text:String(d)});if(d===now.getDate())cell.addClass("qq-calendar-today");cell.addEventListener("click",()=>{const date=new Date(now.getFullYear(),now.getMonth(),d);void this.openDateNote(date);});}
  }

  private async openDateNote(date: Date): Promise<void> {
    const path=dailyPath(this.plugin.settings,date); const file=this.plugin.app.vault.getAbstractFileByPath(path);
    if(file instanceof TFile) await this.plugin.app.workspace.getLeaf("tab").openFile(file);
    else if(date.toDateString()===new Date().toDateString()) await this.plugin.openToday();
    else new Notice("这一天还没有日记。");
  }

  private renderTimelineCard(grid: HTMLElement): void {
    const card=this.card(grid,"今日时间线","list-tree");
    const file=this.plugin.app.vault.getAbstractFileByPath(dailyPath(this.plugin.settings));
    if(!(file instanceof TFile)){card.createDiv("qq-empty-state").setText("今天还没有日记。");return;}
    void this.plugin.app.vault.read(file).then(text=>{const times=[...text.matchAll(/(?:^|\\n)\\s*(?:[-*]\\s*)?(\\d{1,2}:\\d{2})\\s+(.+)/g)].slice(0,8);if(!times.length)card.createDiv("qq-empty-state").setText("在日记里写 09:30 开始的记录，这里会自动出现。");times.forEach(m=>{const row=card.createDiv("qq-note-row");row.createDiv("qq-note-title").setText(m[1]+" · "+m[2]);});});
  }

  private renderHabitsCard(grid: HTMLElement): void {
    const card=this.card(grid,"习惯打卡","check-circle");
    const input=card.createEl("input",{type:"text",placeholder:"习惯名，例如：跑步"}); const today=card.createDiv("qq-habit-row");
    const key="qq-habit-"+new Date().toISOString().slice(0,10);
    const file=this.plugin.app.vault.getAbstractFileByPath(dailyPath(this.plugin.settings));
    this.button(card,"记录一次","check",async()=>{const value=input.value.trim();if(!value)return;await this.appendToFile(dailyPath(this.plugin.settings),"- [x] "+value+" <!-- "+key+" -->");input.value="";today.setText("已记录 · "+value);});
    today.setText(file instanceof TFile?"习惯记录保存在今日日记":"从今天开始记录。");
  }

  private renderInboxCard(grid: HTMLElement): void {
    const card=this.card(grid,"收件箱","inbox"); const file=this.plugin.app.vault.getAbstractFileByPath(this.plugin.settings.inboxPath);
    if(!(file instanceof TFile)){card.createDiv("qq-empty-state").setText("Inbox 还不存在。");this.button(card,"创建 Inbox","plus",async()=>{await this.appendToFile(this.plugin.settings.inboxPath,"- ");this.render();});return;}
    card.createDiv("qq-muted").setText("最后编辑 · "+window.moment(file.stat.mtime).fromNow());
    void this.plugin.app.vault.read(file).then(text=>{const lines=text.split("\n").filter(l=>/^\\s*[-*+]\\s+/.test(l)).slice(-5).reverse();lines.forEach(line=>card.createDiv("qq-note-row").setText(line.replace(/^\\s*[-*+]\\s+/,"")));});
    this.button(card,"打开 Inbox","arrow-up-right",()=>void this.plugin.openTarget(this.plugin.settings.inboxPath));
  }

  private async collectPlainTasks(): Promise<TaskItem[]> { return this.collectTasks(); }

  private renderTaskFilterCard(grid: HTMLElement, mode:"due"|"overdue"): void {
    const card=this.card(grid,mode==="due"?"今日到期":"逾期任务",mode==="due"?"calendar-clock":"alert-circle");
    void this.collectPlainTasks().then(async tasks=>{
      const items: TaskItem[]=[];
      for(const task of tasks){
        if(task.done && mode==="overdue") continue;
        const content=await this.plugin.app.vault.read(task.file);
        const line=content.split("\\n")[task.line]??"";
        const match=line.match(/(?:📅|⏳|🛫|due::)\\s*(\\d{4}-\\d{2}-\\d{2})/);
        if(!match) { if(mode==="overdue" && !task.done) items.push(task); continue; }
        const due=new Date(match[1]+"T23:59:59").getTime();
        const todayEnd=new Date(); todayEnd.setHours(23,59,59,999);
        const todayStart=new Date(); todayStart.setHours(0,0,0,0);
        if(mode==="due" ? due>=todayStart.getTime() && due<=todayEnd.getTime() : due<todayStart.getTime()) items.push(task);
      }
      items.slice(0,6).forEach(t=>this.renderTaskRow(card,t));
      if(!items.length) card.createDiv("qq-empty-state").setText("没有需要处理的任务。");
    });
  }

  private renderNextActionsCard(grid: HTMLElement): void {
    const card=this.card(grid,"项目下一步","arrow-right");
    const open=this.plugin.settings.areas.flatMap(area=>area.path?this.tasksInPath(area.path):[]).filter(t=>!t.done).slice(0,6);
    if(!open.length)card.createDiv("qq-empty-state").setText("没有发现未完成的项目任务。");
    open.forEach(t=>{const row=card.createDiv("qq-note-row");row.createDiv("qq-note-title").setText(t.text);row.createDiv("qq-note-meta").setText(t.file.path);row.addEventListener("click",()=>void this.plugin.app.workspace.getLeaf("tab").openFile(t.file));});
  }

  private tasksInPath(path:string): TaskItem[] {
    const out:TaskItem[]=[]; for(const file of this.plugin.app.vault.getMarkdownFiles()){if(!(file.path.startsWith(path+"/")||file.path===path))continue;const lines=(this.plugin.app.metadataCache.getFileCache(file)?.listItems??[]).filter(i=>typeof i.task==="string");for(const item of lines){const source="";out.push({file,line:item.position.start.line,text:"任务 · "+file.basename,done:item.task?.toLowerCase()!==" "});}}return out;
  }

  private renderMilestonesCard(grid: HTMLElement): void {
    const card=this.card(grid,"近期里程碑","milestone"); const files=this.plugin.app.vault.getMarkdownFiles().filter(f=>f.stat.mtime>Date.now()-30*86400000).sort((a,b)=>b.stat.mtime-a.stat.mtime).slice(0,6);
    files.forEach(f=>{const row=card.createDiv("qq-note-row");row.createDiv("qq-note-title").setText(f.basename);row.createDiv("qq-note-meta").setText(window.moment(f.stat.mtime).fromNow());row.addEventListener("click",()=>void this.plugin.app.workspace.getLeaf("tab").openFile(f));});
  }

  private renderGoalCard(grid: HTMLElement): void {
    const card=this.card(grid,"目标进度","target"); const total=this.plugin.app.vault.getMarkdownFiles().length;const active=this.plugin.app.vault.getMarkdownFiles().filter(f=>f.stat.mtime>Date.now()-7*86400000).length;card.createDiv("qq-number").setText(total?Math.round(active/total*100)+"%":"0%");card.createDiv("qq-muted").setText("近 7 天活跃度，可作为目标执行温度计。");
  }

  private renderTimerCard(grid: HTMLElement): void {
    const card=this.card(grid,"专注计时","timer");const display=card.createDiv("qq-timer-display").setText("25:00");let remaining=25*60;let timer:number|undefined;
    const controls=card.createDiv("qq-card-actions");this.button(controls,"开始","play",()=>{if(timer)return;timer=window.setInterval(()=>{remaining--;display.setText(Math.floor(remaining/60).toString().padStart(2,"0")+":"+String(remaining%60).padStart(2,"0"));if(remaining<=0){window.clearInterval(timer);timer=undefined;new Notice("专注完成");}},1000);});this.button(controls,"重置","rotate-ccw",()=>{if(timer)window.clearInterval(timer);timer=undefined;remaining=25*60;display.setText("25:00");});
  }

  private renderCountdownCard(grid: HTMLElement): void {
    const card=this.card(grid,"倒计时","hourglass");const label=card.createEl("input",{type:"text",placeholder:"事件名称"});label.value=this.plugin.settings.countdownLabel;const date=card.createEl("input",{type:"datetime-local"});date.value=this.plugin.settings.countdownDate;const out=card.createDiv("qq-number");
    const refresh=()=>{const ms=Date.parse(date.value)-Date.now();out.setText(ms>0?this.formatDuration(Math.ceil(ms/60000)):"已到时间");};date.addEventListener("change",async()=>{this.plugin.settings.countdownDate=date.value;await this.plugin.saveSettings();refresh();});label.addEventListener("change",async()=>{this.plugin.settings.countdownLabel=label.value;await this.plugin.saveSettings();});refresh();card.createDiv("qq-muted").setText(label.value||"自定义倒计时");
  }

  private renderAgendaCard(grid: HTMLElement): void {
    const card=this.card(grid,"日程","calendar-days");card.createDiv("qq-muted").setText("支持读取库内 .ics 文件；订阅地址可通过快捷入口打开。");
    const files=this.plugin.app.vault.getFiles().filter(f=>f.extension==="ics").slice(0,5);files.forEach(f=>card.createDiv("qq-note-row").setText(f.path));
  }

  private renderTagsCard(grid: HTMLElement): void {
    const card=this.card(grid,"常用标签","tags");const counts=new Map<string,number>();this.plugin.app.vault.getMarkdownFiles().forEach(f=>(this.plugin.app.metadataCache.getFileCache(f)?.tags??[]).forEach(t=>counts.set(t.tag,(counts.get(t.tag)??0)+1)));[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).forEach(([tag,n])=>card.createSpan("qq-tag").setText(tag.replace(/^#/,"")+" · "+n));
  }

  private renderUnlinkedCard(grid: HTMLElement): void {
    const card=this.card(grid,"待连接笔记","link-2");const files=this.plugin.app.vault.getMarkdownFiles().filter(f=>{const links=this.plugin.app.metadataCache.getFileCache(f)?.links??[];return links.length===0;}).slice(0,6);files.forEach(f=>{const row=card.createDiv("qq-note-row");row.setText(f.basename);row.addEventListener("click",()=>void this.plugin.app.workspace.getLeaf("tab").openFile(f));});
  }

  private renderMissingLinksCard(grid: HTMLElement): void {
    const card=this.card(grid,"待补全链接","link");const unresolved=this.plugin.app.metadataCache.unresolvedLinks;const items=Object.entries(unresolved).filter(([,n])=>Object.values(n).some(v=>v>0)).slice(0,8);items.forEach(([path])=>card.createDiv("qq-note-row").setText(path));
    if(!items.length)card.createDiv("qq-empty-state").setText("没有发现未解析链接。");
  }

  private renderHeatmapCard(grid: HTMLElement): void {
    const card=this.card(grid,"笔记热力图","grid-3x3");const wrap=card.createDiv("qq-heatmap");const now=Date.now();for(let i=41;i>=0;i--){const day=new Date(now-i*86400000);const count=this.plugin.app.vault.getMarkdownFiles().filter(f=>f.stat.mtime>=new Date(day.getFullYear(),day.getMonth(),day.getDate()).getTime()&&f.stat.mtime<new Date(day.getFullYear(),day.getMonth(),day.getDate()+1).getTime()).length;wrap.createSpan("qq-heat-cell").setAttribute("data-level",String(Math.min(4,Math.ceil(count/2))));}
  }

  private renderWorksetCard(grid: HTMLElement): void {
    const card=this.card(grid,"笔记工作集","layers");const paths=this.plugin.settings.worksetPaths.length?this.plugin.settings.worksetPaths:[""];const files=this.plugin.app.vault.getMarkdownFiles().filter(f=>!paths[0]||f.path.startsWith(paths[0])).sort((a,b)=>b.stat.mtime-a.stat.mtime).slice(0,6);files.forEach(f=>{const row=card.createDiv("qq-note-row");row.setText(f.basename);row.addEventListener("click",()=>void this.plugin.app.workspace.getLeaf("tab").openFile(f));});
  }

  private renderTemplateCard(grid: HTMLElement): void {
    const card=this.card(grid,"模板速建","copy-plus");const files=this.plugin.app.vault.getMarkdownFiles().filter(f=>f.path.startsWith(this.plugin.settings.templateFolder+"/")).slice(0,8);files.forEach(f=>this.button(card,f.basename,"file-plus",async()=>{const name=window.prompt("新笔记名称",f.basename);if(!name)return;const source=await this.plugin.app.vault.read(f);const path=(this.plugin.settings.newNoteFolder?this.plugin.settings.newNoteFolder+"/":"")+name.replace(/[\\/:*?"<>|]/g,"-")+".md";await this.plugin.ensureFolder(this.plugin.settings.newNoteFolder);const created=await this.plugin.app.vault.create(path,source);await this.plugin.app.workspace.getLeaf("tab").openFile(created);}));
    if(!files.length)card.createDiv("qq-empty-state").setText("在 "+this.plugin.settings.templateFolder+" 放入 Markdown 模板。");
  }

  private renderQuestionCard(grid: HTMLElement): void {
    const card=this.card(grid,"每日一问","help-circle");const q=this.plugin.settings.question;card.createDiv("qq-review-title").setText(q);const input=card.createEl("textarea",{placeholder:"写下今天的答案…"});input.rows=3;this.button(card,"写入今日日记","pen-line",async()=>{const value=input.value.trim();if(!value)return;await this.appendToFile(dailyPath(this.plugin.settings),"- Q: "+q+"\\n- A: "+value);input.value="";new Notice("已记录");});
  }

  private renderSnippetsCard(grid: HTMLElement): void {
    const card=this.card(grid,"常用片段","text-quote");const file=this.plugin.app.vault.getAbstractFileByPath(this.plugin.settings.snippetPath);if(!(file instanceof TFile)){card.createDiv("qq-empty-state").setText("配置一个片段文件即可。");return;}void this.plugin.app.vault.read(file).then(text=>text.split("\n").filter(Boolean).slice(0,6).forEach(line=>{const row=card.createDiv("qq-note-row");row.setText(line.replace(/^[-*+]\s+/,""));row.addEventListener("click",()=>navigator.clipboard?.writeText(row.textContent??""));}));
  }

  private renderVideoCard(grid: HTMLElement): void {
    const card=this.card(grid,"视频笔记","video");const input=card.createEl("input",{type:"url",placeholder:"粘贴视频链接"});const title=card.createEl("input",{type:"text",placeholder:"笔记标题"});this.button(card,"创建视频笔记","file-plus",async()=>{const url=input.value.trim(),name=title.value.trim();if(!url||!name)return;const path=(this.plugin.settings.newNoteFolder?this.plugin.settings.newNoteFolder+"/":"")+name+".md";await this.plugin.ensureFolder(this.plugin.settings.newNoteFolder);await this.plugin.app.vault.create(path,"---\\nsource: "+url+"\\n---\\n\\n# "+name+"\\n\\n");await this.plugin.app.workspace.getLeaf("tab").openFile(path);});
  }

  private renderTimeProgressCard(grid: HTMLElement): void {
    const card=this.card(grid,"时间进度","clock-3");const now=new Date();const start=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();const end=start+86400000;const p=Math.round((Date.now()-start)/(end-start)*100);card.createDiv("qq-number").setText(p+"%");card.createDiv("qq-muted").setText("今天已经过去");
  }

  private renderWorldClockCard(grid: HTMLElement): void {
    const card=this.card(grid,"世界时钟","globe-2");[["东京","Asia/Tokyo"],["上海","Asia/Shanghai"],["纽约","America/New_York"],["伦敦","Europe/London"]].forEach(([name,zone])=>{const row=card.createDiv("qq-note-row");row.createDiv("qq-note-title").setText(name);row.createDiv("qq-note-meta").setText(new Intl.DateTimeFormat("zh-CN",{timeZone:zone,hour:"2-digit",minute:"2-digit"}).format(new Date()));});
  }

  private renderWeatherCard(grid: HTMLElement): void {
    const card=this.card(grid,"天气","cloud-sun");const city=this.plugin.settings.weatherCity;if(!city){card.createDiv("qq-empty-state").setText("在设置里填写城市后显示天气。");return;}card.createDiv("qq-muted").setText(city+" · 可通过快捷入口打开天气服务。");
  }

  private renderNoiseCard(grid: HTMLElement): void {
    const card=this.card(grid,"专注白噪音","waves");card.createDiv("qq-muted").setText("本地生成，不请求网络。");let ctx:AudioContext|undefined;let source:AudioBufferSourceNode|undefined;this.button(card,"播放","play",()=>{if(ctx)return;ctx=new AudioContext();const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(ctx.destination);source.start();});this.button(card,"停止","square",()=>{source?.stop();void ctx?.close();ctx=undefined;source=undefined;});
  }

  private renderMultiSearchCard(grid: HTMLElement): void {
    const card=this.card(grid,"多站搜索","search");const input=card.createEl("input",{type:"search",placeholder:"输入关键词"});[["Google","https://www.google.com/search?q="],["Bing","https://www.bing.com/search?q="],["GitHub","https://github.com/search?q="],["YouTube","https://www.youtube.com/results?search_query="]].forEach(([name,url])=>this.button(card,name,"external-link",()=>{const q=input.value.trim();if(q)window.open(url+encodeURIComponent(q),"_blank","noopener,noreferrer");}));
  }

  private renderLearningCard(grid: HTMLElement): void {
    const card=this.card(grid,"学习工具","graduation-cap");[["论文","https://scholar.google.com/scholar?q="],["电子书","https://www.google.com/search?tbm=bks&q="],["视频","https://www.youtube.com/results?search_query="],["词典","https://www.google.com/search?q=define+"]].forEach(([name,url])=>this.button(card,name,"search",()=>{const q=window.prompt(name+"关键词");if(q)window.open(url+encodeURIComponent(q),"_blank","noopener,noreferrer");}));
  }

  private renderIntegrationsCard(grid: HTMLElement): void {
    const card=this.card(grid,"插件工具","puzzle");const checks=[["QuickAdd","quickadd"],["Dataview","dataview"],["Omnisearch","omnisearch"],["Excalidraw","excalidraw"],["Kanban","kanban"],["Spaced Repetition","spaced-repetition"]];checks.forEach(([name,id])=>{const available=this.plugin.app.plugins.enabledPlugins.has(id);this.button(card,name,available?"check":"download",()=>{if(available)new Notice(name+" 已启用，可从快捷入口使用。");else{const app=this.app as typeof this.app & {setting?:{open():void;openTabById(id:string):void}};app.setting?.open();app.setting?.openTabById("community-plugins");}});});
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
