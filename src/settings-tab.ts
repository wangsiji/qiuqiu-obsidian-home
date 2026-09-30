import { App, PluginSettingTab, Setting } from "obsidian";
import type QiuqiuHomePlugin from "./main";
import { CARD_META, HomeCardId, HomeSection } from "./settings";

const SECTION_LABELS: Record<HomeSection, string> = {
  overview: "总览",
  action: "行动",
  knowledge: "知识",
  life: "生活"
};

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

    new Setting(el).setName("首页标题").addText(t=>t.setValue(this.plugin.settings.homeTitle).onChange(async v=>{this.plugin.settings.homeTitle=v;await this.plugin.saveSettings();}));
    new Setting(el).setName("首页副标题").addText(t=>t.setValue(this.plugin.settings.homeSubtitle).onChange(async v=>{this.plugin.settings.homeSubtitle=v;await this.plugin.saveSettings();}));
    new Setting(el).setName("壁纸 URL").setDesc("可填本地可访问图片地址；留空保持纯色背景。").addText(t=>t.setValue(this.plugin.settings.wallpaperUrl).onChange(async v=>{this.plugin.settings.wallpaperUrl=v.trim();await this.plugin.saveSettings();}));
    new Setting(el).setName("模板目录").setDesc("模板速建模块读取的 Markdown 目录。").addText(t=>t.setValue(this.plugin.settings.templateFolder).onChange(async v=>{this.plugin.settings.templateFolder=v.trim();await this.plugin.saveSettings();}));
    new Setting(el).setName("常用片段文件").setDesc("常用片段模块读取的 Markdown 文件。").addText(t=>t.setValue(this.plugin.settings.snippetPath).onChange(async v=>{this.plugin.settings.snippetPath=v.trim();await this.plugin.saveSettings();}));
    new Setting(el).setName("每日一问").addText(t=>t.setValue(this.plugin.settings.question).onChange(async v=>{this.plugin.settings.question=v.trim();await this.plugin.saveSettings();}));
    new Setting(el).setName("天气城市").setDesc("例如 Tokyo、Shanghai。天气卡会按需请求公开天气服务。").addText(t=>t.setValue(this.plugin.settings.weatherCity).onChange(async v=>{this.plugin.settings.weatherCity=v.trim();await this.plugin.saveSettings();}));
    new Setting(el).setName("笔记工作集目录").setDesc("可填写多个目录，用逗号分隔。").addText(t=>t.setValue(this.plugin.settings.worksetPaths.join(", ")).onChange(async v=>{this.plugin.settings.worksetPaths=v.split(",").map(x=>x.trim()).filter(Boolean);await this.plugin.saveSettings();}));
    this.renderLayout(el);
    this.renderQuickLinks(el);
    this.renderAreas(el);
  }

  private renderLayout(el: HTMLElement): void {
    el.createEl("h3", { text: "首页布局" });
    el.createEl("p", { text: "首页卡片可以隐藏，也可以直接拖动排序。顺序会保存到插件设置中。" });

    (Object.keys(SECTION_LABELS) as HomeSection[]).forEach(section => {
      const group = el.createDiv("qq-settings-group");
      group.createEl("h4", { text: SECTION_LABELS[section] });
      const order = this.plugin.settings.cardOrder[section] ?? [];

      order.forEach((id, index) => {
        const row = group.createDiv("qq-settings-card-row");
        row.createSpan("qq-settings-drag").setText("⋮⋮");
        const copy = row.createDiv();
        copy.createDiv("qq-settings-card-title").setText(CARD_META[id].title);
        copy.createDiv("qq-settings-card-id").setText(id);

        const toggle = row.createEl("input", { type: "checkbox" });
        toggle.checked = !this.plugin.settings.hiddenCards.includes(id);
        toggle.setAttribute("aria-label", "显示 " + CARD_META[id].title);
        toggle.addEventListener("change", async () => {
          const hidden = new Set(this.plugin.settings.hiddenCards);
          if (toggle.checked) hidden.delete(id);
          else hidden.add(id);
          this.plugin.settings.hiddenCards = [...hidden];
          await this.plugin.saveSettings();
        });

        const moveUp = row.createEl("button", { text: "↑", cls: "qq-settings-move" });
        moveUp.disabled = index === 0;
        moveUp.addEventListener("click", async () => {
          if (index === 0) return;
          const next = [...order];
          [next[index - 1], next[index]] = [next[index], next[index - 1]];
          this.plugin.settings.cardOrder[section] = next;
          await this.plugin.saveSettings();
          this.display();
        });

        const moveDown = row.createEl("button", { text: "↓", cls: "qq-settings-move" });
        moveDown.disabled = index === order.length - 1;
        moveDown.addEventListener("click", async () => {
          if (index >= order.length - 1) return;
          const next = [...order];
          [next[index + 1], next[index]] = [next[index], next[index + 1]];
          this.plugin.settings.cardOrder[section] = next;
          await this.plugin.saveSettings();
          this.display();
        });
      });
    });
  }

  private renderQuickLinks(el: HTMLElement): void {
    el.createEl("h3", { text: "快捷入口" });
    el.createEl("p", { text: "这里管理首页“快捷入口”卡片。target 使用 Vault 相对路径，也可以填写 http/https 地址。" });

    this.plugin.settings.links.forEach((link, index) => {
      const box = el.createDiv("qq-settings-link");
      new Setting(box)
        .setName("入口 " + (index + 1))
        .addText(t => t.setPlaceholder("名称").setValue(link.label).onChange(async value => {
          link.label = value;
          await this.plugin.saveSettings();
        }))
        .addText(t => t.setPlaceholder("路径 / URL").setValue(link.target).onChange(async value => {
          link.target = value.trim();
          await this.plugin.saveSettings();
        }))
        .addText(t => t.setPlaceholder("图标").setValue(link.icon).onChange(async value => {
          link.icon = value.trim() || "link";
          await this.plugin.saveSettings();
        }))
        .addExtraButton(b => b.setIcon("trash-2").setTooltip("删除").onClick(async () => {
          this.plugin.settings.links.splice(index, 1);
          await this.plugin.saveSettings();
          this.display();
        }));
    });

    new Setting(el)
      .setName("新增快捷入口")
      .setDesc("从一个空入口开始编辑。")
      .addButton(b => b.setButtonText("新增").onClick(async () => {
        this.plugin.settings.links.push({
          id: "link-" + Date.now(),
          label: "新入口",
          target: "",
          icon: "link",
          type: "file"
        });
        await this.plugin.saveSettings();
        this.display();
      }));
  }

  private renderAreas(el: HTMLElement): void {
    el.createEl("h3", { text: "人生领域" });
    el.createEl("p", { text: "配置领域对应的 Vault 目录后，首页会显示任务完成情况与入口。" });

    this.plugin.settings.areas.forEach(area => {
      new Setting(el)
        .setName(area.name)
        .setDesc("目录：" + (area.path || "未配置"))
        .addText(t => t.setPlaceholder("例如 20-工作").setValue(area.path).onChange(async value => {
          area.path = value.trim().replace(/^\/+|\/+$/g, "");
          await this.plugin.saveSettings();
        }))
        .addColorPicker(c => c.setValue(area.color).onChange(async value => {
          area.color = value;
          await this.plugin.saveSettings();
        }));
    });
  }
}
