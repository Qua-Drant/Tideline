// 插件设置的默认值，以及 Obsidian 自带设置页里的那一小块。
import {PluginSettingTab, Setting} from 'obsidian';

export const DEFAULT_DEVICE = {font: '1', theme: 'obsidian', motion: 'brief', start: 'last', week: true, tooltips: false};
export const DEFAULT_AI = {enabled: true, provider: 'claude', providers: null, model: 'sonnet', effort: 'high', permission: 'confirm', send: 'enter', notice: false, archiveDays: 30, saveFolder: '收件箱/'};

// Obsidian 自带的“设置 → 第三方插件 → 潮线”只放三样（设计说明 21.5）：版本、打开潮线设置、配色与过场。完整的设置在潮线自己的设置页里。
export class CompassSettingTab extends PluginSettingTab {
  constructor(app, plugin){ super(app, plugin); this.plugin = plugin; }
  display(){
    const {containerEl: el} = this, p = this.plugin, D = p.local.device, save = async () => { await p.saveSettings(); p.applyDevice(); };
    el.empty();
    new Setting(el).setName('潮线').setDesc('版本 ' + (p.manifest?.version || '')).addButton(b => b.setButtonText('打开潮线设置').setCta().onClick(() => { this.app.setting?.close(); p.openCompassSettings(); }));
    new Setting(el).setName('配色').addDropdown(d => d.addOptions({obsidian: '跟随 Obsidian', paper: '纸', night: '夜航'}).setValue(D.theme).onChange(async v => { D.theme = v; await save(); }));
    new Setting(el).setName('过场').setDesc('换页时纸面上下滑动；系统开了“减少动态效果”时直接切换').addDropdown(d => d.addOptions({brief: '滑动', off: '关闭'}).setValue(D.motion).onChange(async v => { D.motion = v; await save(); }));
  }
}
