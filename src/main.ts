import { Plugin, WorkspaceLeaf, Notice, TFile, TFolder } from "obsidian";
import { HomeView, VIEW_TYPE_QIUQIU_HOME } from "./view";
import { DEFAULT_SETTINGS, HomeSettings, dailyPath, normalizeSettings } from "./settings";
import { QiuqiuSettingTab } from "./settings-tab";

export default class QiuqiuHomePlugin extends Plugin {
  settings: HomeSettings = normalizeSettings(DEFAULT_SETTINGS);

  async onload(): Promise<void> {
    this.settings = normalizeSettings(await this.loadData());
    this.registerView(VIEW_TYPE_QIUQIU_HOME, leaf => new HomeView(leaf, this));

    this.addRibbonIcon("layout-dashboard", "打开 Qiuqiu Home", () => void this.openHome());
    this.addCommand({
      id: "open-home",
      name: "打开 Qiuqiu Home",
      callback: () => void this.openHome()
    });
    this.addCommand({
      id: "open-today",
      name: "打开今日日记",
      callback: () => void this.openToday()
    });
    this.addCommand({
      id: "focus-search",
      name: "聚焦首页搜索",
      callback: async () => {
        const view = await this.openHome();
        view?.focusSearch();
      }
    });

    this.addSettingTab(new QiuqiuSettingTab(this.app, this));
    this.app.workspace.onLayoutReady(() => {
      if (this.settings.openOnStartup) void this.openHome();
    });
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.app.workspace.getLeavesOfType(VIEW_TYPE_QIUQIU_HOME).forEach(leaf => {
      if (leaf.view instanceof HomeView) leaf.view.render();
    });
  }

  async openHome(): Promise<HomeView | null> {
    let leaf: WorkspaceLeaf | undefined = this.app.workspace.getLeavesOfType(VIEW_TYPE_QIUQIU_HOME)[0];
    if (!leaf) leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE_QIUQIU_HOME, active: true });
    await this.app.workspace.revealLeaf(leaf);
    return leaf.view instanceof HomeView ? leaf.view : null;
  }

  async ensureFolder(path: string): Promise<void> {
    const clean = path.replace(/^\/+/g, "").replace(/\/+$/g, "");
    if (!clean) return;
    const parts = clean.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current = current ? current + "/" + part : part;
      if (!(this.app.vault.getAbstractFileByPath(current))) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  async openToday(): Promise<void> {
    const path = dailyPath(this.settings);
    const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    await this.ensureFolder(parent);
    let file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      try {
        file = await this.app.vault.create(path, "# " + path.split("/").pop()?.replace(/\.md$/, "") + "\n\n");
      } catch {
        new Notice("无法创建今日日记，请检查日记目录。");
        return;
      }
    }
    if (file instanceof TFile) await this.app.workspace.getLeaf("tab").openFile(file);
  }

  async openTarget(target: string): Promise<void> {
    if (!target) return;
    const file = this.app.vault.getAbstractFileByPath(target);
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf("tab").openFile(file);
      return;
    }
    if (file instanceof TFolder) {
      const explorer = this.app.workspace.getLeavesOfType("file-explorer")[0];
      if (explorer?.view && "revealInFolder" in explorer.view) {
        try { const candidate=this.app.vault.getMarkdownFiles().find(f=>f.path.startsWith(((file as TFolder).path)+"/")); if(candidate) (explorer.view as { revealInFolder: (file:TFile)=>void }).revealInFolder(candidate); } catch { /* best effort */ }
      }
      new Notice("已定位到目录：" + target);
      return;
    }
    if (target.startsWith("http://") || target.startsWith("https://") || target.startsWith("obsidian://")) {
      window.open(target, "_blank", "noopener,noreferrer");
      return;
    }
    new Notice("找不到：" + target);
  }
}
