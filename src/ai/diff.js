// 改前改后的逐行对照（最长公共子序列）。给对照卡用：只显示改动处和前后各 2 行，其余折成“…”。
export function lineDiff(before, after, context = 2){
  const a = String(before ?? '').split('\n'), b = String(after ?? '').split('\n'), n = a.length, m = b.length;
  // 很长的文件：只比较首尾不同的那一段
  let s = 0; while (s < n && s < m && a[s] === b[s]) s++;
  let e = 0; while (e < n - s && e < m - s && a[n - 1 - e] === b[m - 1 - e]) e++;
  const A = a.slice(s, n - e), B = b.slice(s, m - e), dp = Array.from({length: A.length + 1}, () => new Uint32Array(B.length + 1));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const rows = []; for (let k = 0; k < s; k++) rows.push(['=', a[k]]);
  let i = 0, j = 0; while (i < A.length || j < B.length) {
    if (i < A.length && j < B.length && A[i] === B[j]) { rows.push(['=', A[i]]); i++; j++; }
    else if (j < B.length && (i >= A.length || dp[i][j + 1] >= dp[i + 1][j])) rows.push(['+', B[j++]]);
    else rows.push(['-', A[i++]]);
  }
  for (let k = n - e; k < n; k++) rows.push(['=', a[k]]);
  // 折叠没改的长段
  const keep = rows.map((r, k) => r[0] !== '=' || rows.slice(Math.max(0, k - context), k + context + 1).some(x => x[0] !== '='));
  const out = []; let gap = false;
  rows.forEach((r, k) => { if (keep[k]) { out.push(r); gap = false; } else if (!gap) { out.push(['…', '']); gap = true; } });
  return {rows: out, added: rows.filter(r => r[0] === '+').length, removed: rows.filter(r => r[0] === '-').length};
}
