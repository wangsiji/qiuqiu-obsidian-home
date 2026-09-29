import { App, PluginSettingTab, Setting } from "obsidian";
import type QiuqiuHomePlugin from "./main";

export class QiuqiuSettingTab extends PluginSettingTab {
  plugin: QiuqiuHomePlugin;

  constructor(app: App, plugin: QiuqiuHomePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const el = this.containerEl;
    el.empty();
    el.createEl("h2", { text: "Qiuqiu Home" });
    el.createEl("p", { text: "个人第二大脑的操作台：少一点信息堆积，多一点下一步行动。" });

    new Setting(el)
      .setName("启动时打开")
      .setDesc("启动 Obsidian 后自动进入首页。")
      .addToggle(t => t.setValue(this.plugin.settings.openOnStartup).onChange(async value => {
        this.plugin.settings.openOnStartup = value;
        await this.plugin.saveSettings();
      }));

    new Setting(el)
      .setName("日记目录")
      .setDesc("例如 00-日记。")
      .addText(t => t.setValue(this.plugin.settings.dailyFolder).onChange(async value => {
        this.plugin.settings.dailyFolder = value.trim();
        await this.plugin.saveSettings();
      }));

    new Setting(el)
      .setName("日记格式")
      .setDesc("支持 YYYY、MM、DD。")
      .addText(t => t.setValue(this.plugin.settings.dailyFormat).onChange(async value => {
        this.plugin.settings.dailyFormat = value.trim() || "YYYY-MM-DD";
        await this.plugin.saveSettings();
      }));

    new Setting(el)
      .setName("Inbox 文件")
      .setDesc("快速捕获默认追加到这里。")
      .addText(t => t.setValue(this.plugin.settings.inboxPath).onChange(async value => {
        this.plugin.settings.inboxPath = value.trim();
        await this.plugin.saveSettings();
      }));

    new Setting(el)
      .setName("新笔记目录")
      .setDesc("搜索无结果时，新建笔记的位置。")
      .addText(t => t.setValue(this.plugin.settings.newNoteFolder).onChange(async value => {
        this.plugin.settings.newNoteFolder = value.trim().replace(/^\/+|\/+$/g, "");
        await this.plugin.saveSettings();
      }));

    new Setting(el)
      .setName("任务回看天数")
      .setDesc("首页扫描最近多少天的任务。")
      .addSlider(s => s.setLimits(1, 60, 1).setValue(this.plugin.settings.taskLookbackDays).setDynamicTooltip().onChange(async value => {
        this.plugin.settings.taskLookbackDays = value;
        await this.plugin.saveSettings();
      }));

    new Setting(el)
      .setName("首页提醒")
      .addText(t => t.setValue(this.plugin.settings.quote).onChange(async value => {
        this.plugin.settings.quote = value;
        await this.plugin.saveSettings();
      }));
  }
}
