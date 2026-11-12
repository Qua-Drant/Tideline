// 由构建脚本嵌入可公开展示的微信赞赏码。
const bundledQr = typeof __TIDELINE_WECHAT_QR__ === 'undefined' ? {} : __TIDELINE_WECHAT_QR__;
export const supportQr = {
  paper: bundledQr.paper || bundledQr.night || '',
  night: bundledQr.night || bundledQr.paper || '',
};

// Obsidian 插件详情支持清单里的公开赞赏链接。
export function supportUrl(manifest){
  const value = manifest?.fundingUrl;
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
