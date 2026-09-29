import { Plugin, WorkspaceLeaf, Notice, TFile } from "obsidian";
import { HomeView, VIEW_TYPE_QIUQIU_HOME } from "./view";
import { DEFAULT_SETTINGS, HomeSettings, dailyPath, normalizeSettings } from "./settings";
import { QiuqiuSettingTab } from "./settings-tab";

export default class QiuqiuHomePlugin extends Plugin {
  settings: HomeSettings = structuredClone(DEFAULT_SETTINGS);

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

  async openToday(): Promise<void> {
    const path = dailyPath(this.settings);
    let file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      try {
        file = await this.app.vault.create(path, "# " + path.split("/").pop()?.replace(/\.md$/, "") + "\n\n");
      } catch {
        new Notice("无法创建今日日记，请检查日记目录。");
        return;
      }
    }
    await this.app.workspace.getLeaf("tab").openFile(file);
  }

  async openTarget(target: string): Promise<void> {
    if (!target) return;
    const file = this.app.vault.getAbstractFileByPath(target);
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf("tab").openFile(file);
      return;
    }
    if (target.startsWith("http://") || target.startsWith("https://")) {
      window.open(target, "_blank", "noopener,noreferrer");
      return;
    }
    new Notice("找不到：" + target);
  }
}
