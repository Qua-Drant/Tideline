// 由构建脚本嵌入可公开展示的微信赞赏码。
import type {PluginManifest} from 'obsidian';

const bundledQr: {paper?: string; night?: string} = typeof __TIDELINE_WECHAT_QR__ === 'undefined' ? {} : __TIDELINE_WECHAT_QR__;
export const supportQr: {paper: string; night: string} = {
  paper: bundledQr.paper || bundledQr.night || '',
  night: bundledQr.night || bundledQr.paper || '',
};

// Obsidian 插件详情支持清单里的公开赞赏链接。
export function supportUrl(manifest: Pick<PluginManifest, 'fundingUrl'> | null | undefined): string{
  const value = manifest?.fundingUrl;
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
