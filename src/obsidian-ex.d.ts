// Obsidian 没有公开、或 obsidian 1.14.4 类型包里没有写的接口，集中在这里用模块扩充声明，别处不再 as any。
// （loadLocalStorage / saveLocalStorage / secretStorage 类型包里已经公开，不在这里。）
// 这些接口随 Obsidian 版本可能变化，用到的地方都按“可能没有”写（可选链、try）。

declare module 'obsidian' {
  interface App {
    /** 设置窗口（未公开）：潮线只用 close()，从 Obsidian 设置页跳到潮线自己的设置时关掉它 */
    setting?: {open(): void; close(): void};
    /** 命令表（未公开）：Zotero Integration 的导入命令从这里找、从这里执行 */
    commands: {
      commands: Record<string, Command>;
      executeCommandById(id: string): boolean;
    };
    /** 社区插件（未公开）：看 Zotero Integration 装没装、开没开，读它的设置 */
    plugins: {
      manifests: Record<string, PluginManifest>;
      plugins: Record<string, Plugin>;
    };
    /** 这个仓库在本机的 id（未公开）：日历缓存按仓库分开时用 */
    appId?: string;
  }
  interface DataAdapter {
    /** 桌面版（FileSystemAdapter）的仓库根目录。属性未公开；getBasePath() 只在 FileSystemAdapter 上有 */
    basePath?: string;
    getBasePath?(): string;
  }
  interface Component {
    /**
     * registerDomEvent 做的只是 el.addEventListener，并在卸载时 removeEventListener，任何 EventTarget 都能用；
     * 类型包只写了 Window / Document / HTMLElement 三种。潮线视图还用在这两处：减弱动态的系统偏好（MediaQueryList）、字体到达（FontFaceSet）。
     */
    registerDomEvent(el: MediaQueryList, type: 'change', callback: (ev: MediaQueryListEvent) => unknown, options?: boolean | AddEventListenerOptions): void;
    registerDomEvent(el: FontFaceSet, type: 'loadingdone', callback: (ev: FontFaceSetLoadEvent) => unknown, options?: boolean | AddEventListenerOptions): void;
  }
  interface PluginManifest {
    /** manifest.json 里的赞赏链接（Obsidian 支持，类型包里没写）：一个地址，或 名称 → 地址 */
    fundingUrl?: string | Record<string, string>;
  }
}

declare global {
  interface Window {
    /** Electron 渲染进程（桌面版 Obsidian）里的 Node require。插件 isDesktopOnly；测试工具的浏览器里没有，但那里不会走到用它的代码 */
    require: NodeJS.Require;
  }
}

export {};
