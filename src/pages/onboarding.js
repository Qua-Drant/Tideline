// 首次起航（设计说明第 22 节；画面、插画、导览照原型 paper-onboarding-r39.js）。
// 原型里全是示例状态；这里每一步都对真实仓库：
//   1 船舱：真的检查配置笔记、日记与任务文件夹、日记篇数；“创建配置笔记”先列出路径、确认后才写；仓库还是空的时候可以装示例航程（带 example 标签，路径记在本机，设置里可以一键清除）
//   2 日常：勾选的习惯、每日问题、生命之轮领域，开始导览时追加进 潮线/配置.md（已有的同名项不重复加）
//   3 仪表：配色、过场、打开时停在、AI 助手开关，开始导览时存进这台设备的设置
//   4 海图：贴一个 iCal 地址当场取一次，成功列出接下来两个日程、失败写出原因；开始导览时才加进订阅（只存在这台设备上）；AI 服务显示本机 Claude Code 的真实状态
//   5 起航：导览——从思索一路切到大脑（每页停 2.5 秒），再逐页介绍，最后一张完成卡列出这次写入了什么
// 每页都能“跳过”；跳过就什么都不写（已经确认创建的配置笔记、装好的示例除外）。只在第一次打开时出现（记在本机），设置 › 数据 › 关于 里可以重新起航。
import {createVoyageArt} from '../draw/proto/paper-onboarding-art-r31.js';
import {FOLDERS} from '../data/index.js';
import {EXAMPLES, EXAMPLE_DATE} from '../data/examples.js';
import {PROVIDERS} from '../ai/acp.js';
import {modelsOf, defaultModelOf} from './ai.js';
 export function createOnboarding({view, plugin, ink, circle, icon, esc, hand}){
 const root = view.root, navigate = p => view.go(p), announce = m => view.frame.feedback(m), onFrames = () => view.frames(), showHelp = () => view.toggleHelp(true);
 const CONFIG = FOLDERS.config, local = () => plugin.local;
 const VA=createVoyageArt({ink,circle});
 const STEPS=['船舱','日常','仪表','海图','起航'];
 const TOUR={
  thought:{what:'看清方向：目标、本周规划和随手冒出的想法都在这片星空下。',how:['点右上的灯塔，在“规划”和“想法”之间切换','规划一排末尾的 + 新建目标；点目标打开它的详情纸，改每周投入、截止日期和状态','把任务拖到另一天就是改期；灯灭后点星星回看想法，点空白处记下新想法']},
  ai:{what:'在桅顶请 AI 帮忙：提示词库和对话都在这里。',how:['点一面旗挑选提示词，“带入对话”放进下方草稿，或直接复制','左上的模型菜单可以为这一段对话换一家或换个模型','供应商、各家的默认模型、权限和保护名单在 设置 › 指引 里改']},
  today:{what:'今天的一页：海平线以上是要做的，以下是已经发生的。',how:['点“完成”收掉正在推进的这件事；其他任务在右侧','时间轴上品红小船是此刻，浮标是日程（订阅的日历也在这里）','三态笔触记习惯，拖动拨盘打分，最后一行回车就记下随手记']},
  tasks:{what:'货舱里装着全部任务：收件箱、清单、项目和每一行货单。',how:['左栏切换今天、收件箱、清单和项目；把任务拖上去就移过去，加号新建清单','右键一行改日期、优先级、清单、标签；顶上的邮包是要沟通的人，+ 新建人物','点一行，右侧是一张纸：正文直接写，打 / 插入检查项、子任务、标签']},
  projects:{what:'海图室：每个项目是一条航线，船的位置就是进度。',how:['点一艘船，下方展开任务、里程碑、相关人员和文献；项目名可以直接改','把船拖到另一片海域，就改了项目状态','任务栏旁的 + 新建任务；“展开 Markdown”在 Obsidian 标签页里打开项目笔记']},
  review:{what:'船长室的日志：按日、周、季回头看。',how:['顶部切换日 · 周 · 季，左右箭头翻页','日视图对照往年今日；周视图看七天的趋势','季视图拖动花瓣，给生命之轮各个领域打分']},
  library:{what:'深海：文献和读书笔记按阅读深度沉在测深绳上。',how:['悬停纸签先看一句话结论，点开看详情','把纸签拖到另一段深度，就改了阅读阶段','装了 Zotero Integration 时，“Zotero”按钮导入文献；“打开我的知识库”进入书架']},
  brain:{what:'海底的大脑：所有笔记之间的关系。',how:['顶部按类型筛选，放大镜搜索，±缩放','点一个节点，相邻的节点和连线亮起；“去…页”跳过去','右侧排行列出关联最多的节点']}};
 const SCENES=[['thought','星空','思索'],['ai','桅顶','指引'],['today','海平线','今日'],['tasks','货舱','任务'],['projects','海图室','项目'],['review','船长室','复盘'],['library','深海','知识库'],['brain','海底','大脑']];
 const PICK={habits:['阅读','运动','早起','冥想','喝够水'],questions:['今天最重要的三件事','有哪些收获或进步','遇到的困难与应对','下一步计划'],wheel:['身体健康','学习成长','工作与事业','人际关系','家人与朋友','休息与玩耍']};
 let O=null,tour=null;
 const SVG=(s,w,h)=>`<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">${s}</svg>`;
 const tri=state=>state==='found'?`<circle cx="10" cy="10" r="5.4" fill="#1C2A35"/>`:state==='missing'?circle(10,10,5.4,1.3):'';
 const P=d=>'#F4F5F2';
 const dayWord=d=>{const t=plugin.clock().date,diff=Math.round((Date.parse(d)-Date.parse(t))/86400000);return diff===0?"今天":diff===1?"明天":diff===2?"后天":`${Number(d.slice(5,7))}月${Number(d.slice(8))}日`;};
 function reset(){const D=local().device,A=local().ai;O={step:0,checks:['blank','blank','blank','blank'],facts:{},creating:false,created:false,installing:false,installed:0,picks:{habits:new Set(['阅读','运动']),questions:new Set(['今天最重要的三件事','有哪些收获或进步']),wheel:new Set(['身体健康','学习成长','工作与事业'])},custom:{},skipDaily:false,theme:D.theme,motion:D.motion,start:D.start,ai:!!A.enabled,aiProv:'claude',aiPerm:A.permission,aiAttach:!!A.attach,aiModel:undefined,zotero:local().zotero?.on!==false,writes:[],done:[],t0:performance.now(),from:0,motionPicked:false};}
 // ——— art ———
 function harborR27(){let s='';const W=760,H=300,y=210;
  s+=`<circle cx="380" cy="${y-6}" r="34" fill="none" stroke="#B6C0C5" stroke-width="1.2"/>`;for(let i=0;i<7;i++)s+=ink([[380-50+i*4,y-50-i*.5],[380-40+i*4,y-53]],.4,'#B6C0C5');
  s+=ink([[0,y],[160,y-1],[300,y+1],[460,y],[760,y-1]],1.2)+ink([[0,y+3],[760,y+3]],.4,'#B6C0C5');for(let i=0;i<22;i++){const x=(i*137)%740+10,yy=y+12+(i%5)*12;s+=ink([[x,yy],[x+18+(i%3)*8,yy-.4]],.5,i%2?'#B6C0C5':'#5B6871');}
  // shore, lighthouse, pier
  s+=ink([[0,y-30],[40,y-46],[90,y-40],[150,y-24],[200,y-4]],1.3)+ink([[20,y-36],[60,y-44]],.5,'#5B6871');const lx=110;s+=ink([[lx-12,y-40],[lx-8,y-120],[lx+8,y-120],[lx+12,y-40]],1.4)+ink([[lx-10,y-126],[lx+10,y-126],[lx+10,y-138],[lx-10,y-138],[lx-10,y-126]],1.2)+ink([[lx-13,y-138],[lx,y-150],[lx+13,y-138]],1.2)+ink([[lx-10,y-100],[lx+10,y-100]],.7)+ink([[lx-11,y-75],[lx+11,y-75]],.7)+ink([[lx-30,y-132],[lx-14,y-132]],.5,'#B6C0C5')+ink([[lx+14,y-132],[lx+30,y-132]],.5,'#B6C0C5');
  s+=ink([[150,y-10],[250,y-10]],1.2)+ink([[150,y-4],[250,y-4]],1);for(const x of [160,190,220,248])s+=ink([[x,y-14],[x,y+10]],1.2);
  // sailboat
  const bx=560;s+=ink([[bx-70,y-8],[bx-58,y+8],[bx+56,y+8],[bx+74,y-8],[bx-70,y-8]],1.5)+ink([[bx,y-8],[bx,y-160]],1.4)+ink([[bx-3,y-150],[bx-60,y-18],[bx-3,y-18],[bx-3,y-150]],1.2)+ink([[bx+4,y-140],[bx+52,y-18],[bx+4,y-18],[bx+4,y-140]],1.2)+ink([[bx,y-160],[bx+18,y-154],[bx,y-148]],1,'#5B6871');for(let i=1;i<5;i++)s+=ink([[bx-3-i*8,y-150+i*24],[bx-3,y-150+i*24]],.4,'#5B6871');
  s+=ink([[bx-74,y+14],[bx+80,y+13]],.6,'#5B6871');for(const[x,yy]of [[300,70],[330,58],[640,90]])s+=ink([[x-6,yy],[x,yy-4],[x+6,yy]],.8)+ink([[x+6,yy-1],[x+11,yy-4],[x+16,yy-1]],.8);
  return SVG(s,W,H);}
 function prop(kind){let s='';if(kind==='crates'){s=ink([[4,60],[60,60],[60,20],[4,20],[4,60]],1.3)+ink([[4,20],[60,60]],.7)+ink([[60,20],[4,60]],.7)+ink([[64,60],[100,60],[100,34],[64,34],[64,60]],1.2)+ink([[108,60],[108,30],[130,26],[134,60]],1.2);return SVG(s,140,64);}
  if(kind==='books'){for(let i=0;i<3;i++)s+=ink([[10+i*4,60-i*16],[110-i*6,60-i*16],[110-i*6,46-i*16],[10+i*4,46-i*16],[10+i*4,60-i*16]],1.2);return SVG(s,120,64);}
  if(kind==='sextant'){s=ink([[10,58],[60,8],[110,58]],1.3)+ink([[20,58],[100,58]],1.2)+ink([[60,8],[60,58]],1)+circle(60,8,4,1.1)+ink([[30,40],[88,40]],.7);return SVG(s,120,64);}
  if(kind==='compass'){s=circle(60,34,26,1.4)+circle(60,34,20,.7)+ink([[60,14],[66,34],[60,54],[54,34],[60,14]],1.1)+ink([[10,60],[110,56]],.8);return SVG(s,120,64);}
  return '';}
 // ——— pages ———
 function course(){const n=STEPS.length;return `<div class="ob-course" aria-label="第 ${Math.max(O.step,0)} 步，共 5 步">${SVG(ink([[0,30],[700,30]],1.1),700,40).replace('<svg ','<svg preserveAspectRatio="none" ')}${SVG(VA.waves(0,700,8,26),700,40).replace('<svg ','<svg class="ob-water" preserveAspectRatio="none" ')}${STEPS.map((t,i)=>`<span class="ob-point ${i+1===O.step?'is-here':''} ${i+1<O.step?'is-past':''}" style="left:${(i/(n-1)*100).toFixed(2)}%">${i+1===O.step?`<i class="ob-ship">${SVG(ink([[3,22],[7,27],[25,27],[29,22],[3,22]],1.2)+ink([[16,2],[16,22]],1.1)+ink([[15,4],[6,19],[15,19]],1)+ink([[18,6],[25,19],[18,19]],1),32,30)}</i>`:''}<b></b><small>${t}</small></span>`).join('')}</div>`;}
 function head(title,ic){return `<header class="ob-head">${ic}<h2>${title}</h2></header><div class="ob-rope">${VA.rope()}</div>`;}
 function page(){const s=O.step;
  if(s===0)return `<div class="ob-cover">${SVG(ink([[150,20],[156,32],[168,36],[156,40],[150,52],[144,40],[132,36],[144,32],[150,20]],1.3)+ink([[60,36],[120,36]],.8)+ink([[180,36],[240,36]],.8),300,60)}<h1>潮线</h1><p class="ob-lead">以规划明确方向，以任务推动行动，以记录积累事实，以复盘形成反馈。</p><p class="ob-small">潮线只读写这个仓库里的笔记；除了你添加的日历和开启的 AI 助手，不联网。</p><div class="ob-art">${VA.harbor()}</div><button class="ob-go hand-pill" data-ob="next">起航${SVG(ink([[4,10],[16,10]],1.3)+ink([[11,5],[16,10],[11,15]],1.3),20,20)}</button></div>`;
  if(s===1){const f=O.facts,rows=[['配置笔记',CONFIG],['日记文件夹',FOLDERS.journal+'/'],['任务文件夹',FOLDERS.tasks+'/'],['已有日记',(f.days??0)+' 篇']];
   return head('1. 船舱：检查仓库',icon('box',26))+'<div class="ob-step"><div class="ob-main">'+`<ul class="ob-checks hand-panel">${rows.map(([a,b],i)=>`<li>${SVG(tri(O.checks[i]),20,20)}<b>${a}</b><span class="mono">${O.checks[i]==='missing'?'还没有':esc(b)}</span></li>`).join('')}</ul>`
   +(f.old?`<p class="ob-note hand-panel">${icon('circle',16)}<span>发现 0.32 版本留下的数据（${esc(f.old)}）。不会自动迁移，也不会改动它们。</span></p>`:'')
   +(O.created?`<p class="ob-done">已创建 ${esc(CONFIG)}</p>`:'')+(O.creating?`<div class="ob-confirm hand-panel"><p>将要创建：</p><ul class="mono"><li>${esc(CONFIG)}</li></ul><div><button class="ob-btn hand-pill" data-ob="create-yes">创建</button><button class="ob-btn hand-pill" data-ob="create-no">取消</button></div></div>`:O.installing?`<div class="ob-confirm hand-panel"><p>将要写入 ${Object.keys(EXAMPLES).length} 篇示例笔记（带 example 标签，日期换成从今天算起），放进各类笔记原本的文件夹：</p><ul class="mono">${['日记/','任务/','项目/','人物/','想法/','文献/','书籍/','潮线/'].map(x=>`<li>${x}</li>`).join('')}</ul><div><button class="ob-btn hand-pill" data-ob="install-yes">装上</button><button class="ob-btn hand-pill" data-ob="install-no">取消</button></div></div>`:O.installed?`<p class="ob-done">已装上 ${O.installed} 篇示例笔记；设置 › 数据 里可以一键清除</p>`:`<div class="ob-actions"><button class="ob-btn hand-pill" data-ob="create" ${O.checks[0]!=='missing'||O.created?'disabled':''}>创建配置笔记</button><button class="ob-btn hand-pill" data-ob="install" ${f.empty?'':'disabled'} title="${f.empty?'装一套覆盖各页的示例笔记':'仓库里已经有任务或日记，不装示例'}">装一套示例航程</button></div>`)+`</div><figure class="ob-vignette">${VA.cabin()}</figure></div>`;}
  if(s===2){const col=(k,t)=>`<section class="ob-col hand-panel"><h3>${t}<small>可多选</small></h3>${[...PICK[k],...(O.custom[k]||[])].map(x=>`<button class="ob-pick" data-ob="pick|${k}|${esc(x)}" aria-pressed="${O.picks[k].has(x)}">${SVG(O.picks[k].has(x)?`<rect x="4" y="4" width="12" height="12" rx="2" fill="#1C2A35"/>${ink([[6.5,10],[9,12.5],[13.5,7]],1.2,'#F4F5F2')}`:ink([[4,4],[16,4],[16,16],[4,16],[4,4]],1.1),20,20)}<span>${esc(x)}</span></button>`).join('')}<form class="ob-custom" data-ob-form="${k}"><input name="v" placeholder="自定义…" aria-label="自定义${t}"></form></section>`;
   return head('2. 日常：习惯、每日问题、生命之轮领域',icon('note',26))+'<div class="ob-step"><div class="ob-main">'+`<div class="ob-cols">${col('habits','习惯')}${col('questions','每日问题')}${col('wheel','生命之轮领域')}</div><p class="ob-small">选完写进配置笔记，以后在设置里随时改。<button class="ob-link" data-ob="skip-daily">这一步先跳过</button></p></div><figure class="ob-vignette">${VA.daily()}</figure></div>`;}
  if(s===3){const seg=(k,opts)=>`<span class="ob-seg">${opts.map(([v,l])=>`<button data-ob="set|${k}|${v}" aria-checked="${O[k]===v}">${l}</button>`).join('')}</span>`;
   return head('3. 仪表：这台设备的偏好',icon('settings',26))+'<div class="ob-step"><div class="ob-main">'+`<div class="ob-rows hand-panel"><div><b>配色</b>${seg('theme',[['obsidian','跟随 Obsidian'],['paper','纸'],['night','夜航']])}</div><div><b>过场</b>${seg('motion',[['brief','滑动'],['off','关闭']])}</div><div><b>打开时停在</b>${seg('start',[['last','上次所在的页'],['today','今日']])}</div><div><b>AI 助手</b><button class="ob-mark" data-ob="ai" aria-checked="${O.ai}">${SVG(O.ai?'<circle cx="10" cy="10" r="5.4" fill="#1C2A35"/>':circle(10,10,5.4,1.3),20,20)}<span>${O.ai?'开':'关'}</span></button><small class="ob-ai-found">${esc(aiFoundLine())}</small></div></div></div><figure class="ob-vignette">${VA.gauges()}</figure></div>`;}
  if(s===4)return head(O.ai?'4. 海图：日历、文献与 AI 服务':'4. 海图：日历订阅与文献（可选）',SVG(ink([[3,5],[21,5],[21,21],[3,21],[3,5]],1.2)+ink([[3,9],[21,9]],1)+ink([[8,2],[8,6]],1.2)+ink([[16,2],[16,6]],1.2),24,24))+'<div class="ob-step"><div class="ob-main">'+`<form class="ob-ical" data-ob-form="ical"><input name="v" class="mono" placeholder="粘贴一个 iCal 地址，例如 https://calendar.example.com/me.ics" value="${esc(O.ical||'')}" aria-label="iCal 地址"><button class="ob-btn hand-pill" type="submit" ${O.ical_state==='loading'?'disabled':''}>${O.ical_state==='loading'?'正在获取…':'测试刷新'}</button></form>`
   +(O.ical_state==='ok'?`<div class="ob-result hand-panel"><p>${SVG('<circle cx="10" cy="10" r="5.4" fill="#1C2A35"/>',20,20)}刷新成功${O.ical_cal?.name?`（${esc(O.ical_cal.name)}）`:''}。${O.ical_up?.length?'接下来的日程：':'60 天内没有日程。'}</p><ul>${(O.ical_up||[]).map(o=>`<li><b>${esc(o.title)}</b><span class="mono">${dayWord(o.date)} ${o.allDay?'全天':o.time+(o.end?' – '+o.end:'')}</span></li>`).join('')}</ul></div>`:O.ical_state==='bad'?`<div class="ob-result hand-panel is-bad"><p>${SVG(circle(10,10,5.4,1.3,'#B23A48'),20,20)}获取失败：${esc(O.ical_err||'')}</p></div>`:'')+`<p class="ob-small">可以添加多个订阅。取回的日程存在这台设备上，到了刷新间隔（默认 6 小时）才重新联网，打开潮线时直接用上次取回的；间隔在 设置 › 日历 里改。也可以把日程直接写在 <span class="mono">${esc(FOLDERS.calendar)}</span>。</p>`
   +zoteroRow()+`${aiServices()}</div><figure class="ob-vignette">${VA.chartTable()}</figure></div>`;
  return head('5. 起航：导览',SVG(circle(12,12,8,1.2)+circle(12,12,2,1)+[0,1,2,3,4,5,6,7].map(i=>{const t=i*Math.PI/4;return ink([[12+Math.cos(t)*2,12+Math.sin(t)*2],[12+Math.cos(t)*11,12+Math.sin(t)*11]],1);}).join(''),24,24))+`<div class="ob-tour-line">${SCENES.map(([id,scene,name])=>`<span>${hand.text(name,{size:17})}<small>${scene}</small></span>`).join('<i>·</i>')}</div><button class="ob-go hand-pill" data-ob="tour">开始导览</button><p class="ob-small">先从星空一路驶到海底，再逐页介绍每一层怎么用；按 Esc 随时结束。</p><div class="ob-art is-small">${VA.harbor()}</div>`;}
 // R37：海图页的 AI 服务（第 3 步开着 AI 助手时出现）
 // 0.3：经 ACP 接入的各家预设（0.9.1 起含 CodeBuddy、DeepSeek Harness），各做一次握手（只握手，不开会话）；找不到时给出安装命令
 const AI_IDS=PROVIDERS.filter(id=>id!=='custom');
 const AI_FOUND=()=>AI_IDS.map(id=>{const st=plugin.ai?.status?.[id],P=plugin.aiProviderInfo?.(id)||{name:id};return [id,P.name,st?.version||'',!st?'检查中':st.ok?'可用':'未找到',st&&!st.ok?P.install||'':''];});
 // 0.9.3：第 3 步的检测结果按本机真实握手生成（原来是原型里写死的示例）
 const aiFoundLine=()=>{const all=AI_FOUND(),ok=all.filter(x=>x[3]==='可用');if(ok.length)return '检测到：'+ok.map(([,l,v])=>v?l+' '+v:l).join(' · ');return all.some(x=>x[3]==='检查中')?'正在检测本机的 AI 代理…':'没有找到 AI 代理，下一步可以看安装方法';};
 const AI_PERM=[['read','只读'],['confirm','改前确认'],['auto','自动接受改动']];
 function aiServices(){if(!O.ai)return `<p class="ob-small ob-ai-off">AI 助手在上一页关掉了；以后可以在 设置 › 指引 里开启。</p>`;
  const seg=(k,opts)=>`<span class="ob-seg">${opts.map(([v,l])=>`<button data-ob="aiset|${k}|${v}" aria-checked="${O[k]===v}">${l}</button>`).join('')}</span>`;
  const dot=on=>SVG(on?'<circle cx="10" cy="10" r="5.4" fill="#1C2A35"/>':circle(10,10,5.4,1.3),20,20);
  return `<section class="ob-ai hand-panel" aria-label="AI 服务"><h3>${icon('flag',18)}<span>AI 服务</span><small>上一页开启了 AI 助手 · 这些只存在这台设备上</small></h3>`
   +`<div class="ob-ai-row"><b>默认供应商</b>${seg('aiProv',AI_FOUND().map(([v,l,,st])=>[v,`${l}<i class="ob-ai-state ${st==='可用'?'is-ok':st==='未找到'?'is-warn':''}" title="${st}"></i>`]))}</div>`
   +`<ul class="ob-ai-list is-one">${AI_FOUND().filter(x=>x[0]===O.aiProv).map(([v,l,ver,st,cmd])=>`<li class="${st==='未找到'?'is-warn':''}"><b>${l}</b><span class="mono">${ver}</span><span>${st}</span>${cmd?`<span class="ob-ai-cmd">在终端运行 <code class="mono">${cmd}</code><button class="ob-link" data-ob="aicopy|${cmd}">复制</button></span>`:''}</li>`).join('')}</ul>`
   +modelRow(seg)
   +`<div class="ob-ai-row"><b>默认权限</b>${seg('aiPerm',AI_PERM)}<small>${O.aiPerm==='auto'?'只限“允许直接改的文件夹”，默认为空':O.aiPerm==='read'?'只读不改':'每次改动前先问你'}</small></div>`
   +`<div class="ob-ai-row"><b>自动附带当前页</b><button class="ob-mark" data-ob="aiattach" aria-checked="${O.aiAttach}">${dot(O.aiAttach)}<span>${O.aiAttach?'开':'关'}</span></button><small>日记正文不会自动附带</small></div>`
   +`<p class="ob-small">保护名单、各家的模型与密钥在 设置 › 指引 里改。</p></section>`;}
 // 默认模型：这一家报过模型清单（或是 Claude 的三个预设）就给选；没读到时说明在哪里读
 function modelRow(seg){const ms=modelsOf(plugin,O.aiProv);
  if(!ms?.length)return `<div class="ob-ai-row"><b>默认模型</b><small>用它自己的默认；以后在 设置 › 指引 点“读取”，从它报的模型里挑</small></div>`;
  if(O.aiModel===undefined)O.aiModel=defaultModelOf(plugin,O.aiProv);
  const list=[['','代理默认'],...ms.slice(0,8).map(m=>[m.value,esc(m.name)])];return `<div class="ob-ai-row"><b>默认模型</b>${seg('aiModel',list)}${ms.length>8?`<small>还有 ${ms.length-8} 个在 设置 › 指引 里</small>`:''}</div>`;}
 // 知识库的文献来源：装了 Zotero Integration 就读它的导入文件夹（0.7）
 function zoteroRow(){const z=plugin.zotero?.();if(!z)return '';
  const dot=on=>SVG(on?'<circle cx="10" cy="10" r="5.4" fill="#1C2A35"/>':circle(10,10,5.4,1.3),20,20);
  if(!z.installed)return `<p class="ob-small ob-zotero">文献：用 Zotero 管理文献的话，在 Obsidian 里装上 Zotero Integration 插件，它导入的文献笔记会出现在知识库（设置 › 笔记）。</p>`;
  return `<div class="ob-ai-row ob-zotero"><b>Zotero 文献</b><button class="ob-mark" data-ob="zotero" aria-checked="${O.zotero}">${dot(O.zotero)}<span>${O.zotero?'接入':'不接'}</span></button><small>${!z.enabled?'Zotero Integration 已安装，还没启用':z.folders.length?`读取 ${z.folders.map(f=>esc(f)+'/').join('、')} 里的文献笔记；知识库的“Zotero”按钮调它导入`:'没有找到它的导入文件夹，可以在 设置 › 笔记 里填'}</small></div>`;}
 function applyAI(){const A=local().ai;A.enabled=O.ai;if(O.ai){A.permission=O.aiPerm;A.attach=O.aiAttach;A.provider=O.aiProv;A.providers??={};A.providers[O.aiProv]={...(A.providers[O.aiProv]||{}),on:true};if(O.aiModel!==undefined)A.providers[O.aiProv].model=O.aiModel;plugin.refreshAI?.();}return AI_FOUND().find(x=>x[0]===O.aiProv)?.[1];}

 // 0.3 起只有“滑动 / 关闭”两档：起航插画的手绘动态在“滑动”时照常播放
 const motion=()=>(O.motionPicked?O.motion:local().device.motion)==='off'?'off':'full';
 const moving=()=>motion()==='full'&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 function html(arriving){return `<div class="onboarding hand-panel ${O.step?'':'is-cover'} ${arriving?'is-arriving':''}" style="--ob-t:${Math.round(performance.now()-O.t0)}" data-motion="${motion()}" data-step="${O.step}" role="dialog" aria-modal="true" aria-label="首次起航">${O.step<5||true?`<button class="ob-skip hand-pill" data-ob="skip">跳过引导</button>`:''}${O.step>1?`<button class="ob-back" data-ob="back" aria-label="上一步">${SVG(ink([[13,5],[7,10],[13,15]],1.3),20,20)}</button>`:''}<div class="ob-page">${page()}</div>${O.step?`<div class="ob-sea">${VA.seaBand()}</div>${course()}${O.step<5?`<button class="ob-next hand-pill" data-ob="next">下一步</button>`:''}`:''}</div>`;}
 function mount(){root.querySelector('.onboarding')?.remove();root.querySelector('#sheet').insertAdjacentHTML('beforeend',html(true));onFrames();}
 function redraw(arriving=false){const el=root.querySelector('.onboarding');if(!el)return;el.outerHTML=html(arriving);const n=root.querySelector('.onboarding');n.classList.add('is-still');onFrames();if(arriving)sail();}
 // The ship leaves the waypoint it was at and sails to the new one along the course.
 function sail(){const ship=root.querySelector('.ob-ship'),pts=root.querySelectorAll('.ob-point');if(!ship||!O.from||O.from===O.step||!moving())return;const a=pts[O.from-1]?.getBoundingClientRect(),b=pts[O.step-1]?.getBoundingClientRect();if(!a||!b)return;const dx=a.left-b.left;ship.animate([{transform:`translateX(${dx}px) translateY(0)`},{transform:`translateX(${dx*.5}px) translateY(-3px)`,offset:.5},{transform:'translateX(0) translateY(0)'}],{duration:Math.min(1100,420+Math.abs(dx)*1.6),easing:'cubic-bezier(.4,.1,.3,1)'});}
 function turn(to){O.from=O.step;O.step=to;const el=root.querySelector('.onboarding');el?.classList.add('is-turning');setTimeout(()=>{redraw(true);if(O.step===1)runChecks();},150);}
 function runChecks(){const files=plugin.index.source.files().map(x=>x.path),has=p=>files.some(x=>x===p||x.startsWith(p+'/')),days=[...plugin.index.days.keys()].length;
  O.facts={days,empty:!files.some(x=>x.startsWith(FOLDERS.tasks+'/')||x.startsWith(FOLDERS.journal+'/')),old:['Meta/Compass Config.md','08 Tasks','01 Journal'].find(has)||''};
  const order=[has(CONFIG)?'found':'missing',has(FOLDERS.journal)?'found':'missing',has(FOLDERS.tasks)?'found':'missing',days?'found':'missing'];order.forEach((v,i)=>setTimeout(()=>{if(!O||O.step!==1)return;O.checks[i]=v;redraw();},220+i*260));}
 function open(){reset();mount();Promise.all(AI_IDS.map(id=>plugin.detectAI?.(true,id,{models:false}))).then(()=>{if(O&&(O.step===3||O.step===4))redraw();}).catch(()=>{});} // 第 4 步要显示本机 Claude Code 的真实状态，打开时就去查（不发起对话）
 function close(){root.querySelector('.onboarding')?.remove();}
 function finishSlip(){}
 // 开始导览时才写：日常的勾选追加进配置笔记；设备与 AI 的偏好存进这台设备
 async function applyAll(){const w=[...O.done];
  if(!O.skipDaily){const add={habits:[],questions:[],wheel:[]};for(const k of ['habits','questions','wheel'])add[k]=[...O.picks[k]];
   if(add.habits.length||add.questions.length||add.wheel.length){let n={habits:0,questions:0,wheel:0};
    await plugin.writer.frontmatter(CONFIG,fm=>{const put=(field,nameKey,base,list,k)=>{fm[field]=Array.isArray(fm[field])?fm[field]:[];for(const name of list){if(fm[field].some(x=>x&&x[nameKey]===name))continue;let i=fm[field].length+1;while(fm[field].some(x=>x&&x.id===base+i))i++;fm[field].push({id:base+i,[nameKey]:name});n[k]++;}};
     put('habits','name','habit_',add.habits,'habits');put('questions','title','question_',add.questions,'questions');put('areas','title','area_',add.wheel,'wheel');});
    for(const[k,l]of [['habits','个习惯'],['questions','个每日问题'],['wheel','个生命之轮领域']])if(n[k])w.push([`添加了 ${n[k]} ${l}`,CONFIG]);}}
  if(O.ical_state==='ok'&&O.ical_cal){await plugin.calendars.add(O.ical_cal.name||'',O.ical,O.ical_cal.events);w.push(['添加了 1 个日历订阅（只存在这台设备上）',null]);}
  const D=local().device;D.theme=O.theme;D.motion=O.motion;D.start=O.start;const name=applyAI();
  const z=plugin.zotero?.();if(z?.installed){local().zotero={...(local().zotero||{folder:''}),on:O.zotero};await plugin.syncZotero?.();if(O.zotero&&z.folders.length)w.push([`接入了 Zotero 文献（${z.folders.join('、')}/）`,null]);}
  w.push(['这台设备：配色、过场、打开时停在'+(O.ai?`，AI 助手开（${name}，${AI_PERM.find(x=>x[0]===O.aiPerm)?.[1]}${O.aiAttach?'，自动附带当前页':''}）`:'，AI 助手关'),null]);
  local().onboarded=true;local().version=plugin.manifest?.version||null;await plugin.saveSettings();view.applyDevice?.();plugin.refreshAI();O.writes=w;}
 async function startTour(){await applyAll();close();const fast=!moving()||motion()==='off';
  const hint=document.createElement('div');hint.className='tour-hint';hint.setAttribute('role','status');hint.innerHTML='正在从星空驶向海底 · <kbd>Esc</kbd> 跳过';root.appendChild(hint);
  tour={phase:'fly',i:0,timer:null,hint,card:null,hover:false,end:()=>endTour(),next:()=>introStep(tour.i+1),prev:()=>introStep(Math.max(0,tour.i-1))};
  const fly=k=>{if(!tour||tour.phase!=='fly')return;if(k>=SCENES.length){tour.hint.remove();tour.hint=null;introStep(0);return;}navigate(SCENES[k][0]);tour.timer=setTimeout(()=>fly(k+1),fast?450:2500);};
  fly(0);}
 // 逐页介绍：第 n 页（越界就收尾）
 function introStep(n){if(!tour)return;clearTimeout(tour.timer);if(n>=SCENES.length){endTour();return;}tour.phase='intro';tour.i=n;const[id,scene,name]=SCENES[n],t=TOUR[id];
  navigate(id);showHelp?.();
  let c=tour.card;if(!c){c=document.createElement('section');c.className='tour-card hand-panel';c.setAttribute('role','dialog');c.setAttribute('aria-label','导览');root.appendChild(c);
   c.addEventListener('pointerenter',()=>{tour&&(tour.hover=true);c.classList.add('is-paused');});c.addEventListener('pointerleave',()=>{if(!tour)return;tour.hover=false;c.classList.remove('is-paused');arm();});tour.card=c;}
  c.dataset.page=id;
  c.innerHTML=`<p class="tour-count mono">${n+1} / ${SCENES.length}</p><h3>${hand.text(name,{size:22})}<small>${scene}</small></h3><p class="tour-what">${esc(t.what)}</p><ul>${t.how.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`
   +`<div class="tour-bar"><i style="--tour-ms:${INTRO_MS}ms"></i></div><div class="tour-actions"><button class="ob-link" data-ob="tour-end">结束导览</button><span>${n?`<button class="ob-btn hand-pill" data-ob="tour-prev">上一页</button>`:''}<button class="ob-btn hand-pill" data-ob="tour-next">${n===SCENES.length-1?'完成':'下一页'}</button></span></div>`;
  c.classList.remove('is-paused');void c.offsetWidth;place(c);onFrames?.();arm();
  // 说明箭头在纸里，过场时随纸滑动；等过场结束（最多 760ms）再按箭头的最终位置选一次
  const me=tour;setTimeout(()=>{if(tour===me&&tour.card===c&&c.dataset.page===id)place(c);},760);}
 // 导览卡放在四个角里第一个不压住说明箭头（.help-note）、顶部条和罗盘的位置；都压就选压得最少的
 function place(c){const R=root.getBoundingClientRect(),W=R.width,H=R.height,w=c.offsetWidth,h=c.offsetHeight,m=32,top=132;
  const spots=[[W-w-40,H-h-m],[W-w-40,top],[150,H-h-m],[Math.round((W-w)/2+60),H-h-m],[W-w-40,Math.round((H-h)/2+40)],[W-w-40,top+70]];
  const avoid=[...root.querySelectorAll('.help-note,#compass-toggle,#capture-toggle')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left-R.left,right:r.right-R.left,top:r.top-R.top,bottom:r.bottom-R.top,width:r.width};}).filter(r=>r.width);
  const cost=([x,y])=>avoid.reduce((n,r)=>n+Math.max(0,Math.min(x+w,r.right)-Math.max(x,r.left))*Math.max(0,Math.min(y+h,r.bottom)-Math.max(y,r.top)),0);
  const best=spots.map(s=>[s,cost(s)]).sort((a,b)=>a[1]-b[1])[0][0];Object.assign(c.style,{left:best[0]+'px',top:best[1]+'px',right:'auto',bottom:'auto'});}
 const INTRO_MS=9000;
 function arm(){if(!tour||tour.phase!=='intro')return;clearTimeout(tour.timer);if(tour.card?.matches(':hover')){tour.hover=true;tour.card.classList.add('is-paused');}if(tour.hover)return;const bar=tour.card?.querySelector('.tour-bar i');if(bar){bar.style.animation='none';void bar.offsetWidth;bar.style.animation='';}tour.timer=setTimeout(()=>{if(!tour)return;if(tour.card?.matches(':hover')){tour.hover=true;tour.card.classList.add('is-paused');return;}tour.next();},INTRO_MS);}
 function endTour(){if(!tour)return;clearTimeout(tour.timer);tour.hint?.remove();tour.card?.remove();tour=null;navigate('today');finale();local().onboarded=true;plugin.saveSettings();}
 // 收尾：完成卡停留约 6 秒后淡出（鼠标停在卡上会等）
 const FINALE_MS=4000;
 function finale(){root.querySelector('.ob-slip')?.remove();const w=O?.writes||[];
  root.querySelector('#sheet').insertAdjacentHTML('beforeend',`<div class="ob-slip ob-finale hand-popup" role="status"><h3 class="ob-finale-title">${hand.text('准备好了，起航',{size:22})}</h3>${w.length?`<p>这次写入了：</p><ul>${w.map(([x,p])=>`<li>${p?`<button data-ob="open|${esc(p)}">${esc(x)}</button>`:`<span>${esc(x)}</span>`}</li>`).join('')}</ul>`:'<p>这次什么也没有写入。</p>'}<p class="ob-finale-keys">左侧栏在八层之间切换 · 左下舵轮是设置 · 指引页可以请 AI 帮忙</p></div>`);
  onFrames?.();const el=root.querySelector('.ob-finale');let left=FINALE_MS,t0=performance.now(),hold=false,timer=0;
  const go=()=>{timer=setTimeout(()=>{if(!el.isConnected)return;el.classList.add('is-leaving');setTimeout(()=>el.remove(),800);},left);};
  el.addEventListener('pointerenter',()=>{hold=true;clearTimeout(timer);left=Math.max(1200,left-(performance.now()-t0));el.classList.remove('is-leaving');});
  el.addEventListener('pointerleave',()=>{if(!hold)return;hold=false;t0=performance.now();go();});go();}
 function click(e){const b=e.target.closest('[data-ob]');if(!b)return false;const[a,...r]=b.dataset.ob.split('|');
  if(a==='slip-close'){root.querySelector('.ob-slip')?.remove();return true;}if(a==='open'){plugin.writer.open(r.join('|'));return true;}
  if(a==='tour-next'){tour?.next();return true;}if(a==='tour-prev'){tour?.prev();return true;}if(a==='tour-end'){tour?.end();return true;}
  if(a==='say'){announce(r.join('|'));return true;}
  if(!O)return true;
  if(a==='skip'){close();O=null;local().onboarded=true;plugin.saveSettings();announce('已跳过首次起航，没有再写入什么');return true;}
  if(a==='next'){turn(Math.min(5,O.step+1));return true;}if(a==='back'){turn(Math.max(1,O.step-1));return true;}
  if(a==='create')O.creating=true;else if(a==='create-no')O.creating=false;else if(a==='create-yes'){O.creating=false;createConfig().then(()=>{O.created=true;O.checks[0]='found';O.done.push(['创建了 '+CONFIG,CONFIG]);redraw();});return true;}
  else if(a==='install')O.installing=true;else if(a==='install-no')O.installing=false;else if(a==='install-yes'){O.installing=false;installExamples().then(n=>{O.installed=n;O.checks=O.checks.map(()=>'found');O.done.push([`装上了 ${n} 篇示例笔记`,null]);runChecks();redraw();});return true;}
  else if(a==='pick'){const set=O.picks[r[0]],v=r.slice(1).join('|');set.has(v)?set.delete(v):set.add(v);O.skipDaily=false;}
  else if(a==='skip-daily'){O.skipDaily=true;turn(3);return true;}
  else if(a==='set'){O[r[0]]=r[1];if(r[0]==='motion')O.motionPicked=true;}else if(a==='ai')O.ai=!O.ai;else if(a==='aiset'){O[r[0]]=r[1];if(r[0]==='aiProv')O.aiModel=undefined;}else if(a==='zotero')O.zotero=!O.zotero;else if(a==='aiattach')O.aiAttach=!O.aiAttach;else if(a==='aicopy'){navigator.clipboard?.writeText(r.join('|')).catch(()=>{});announce('已复制：'+r.join('|'));return true;}else if(a==='tour'){startTour();return true;}
  redraw();return true;}
 function submit(f){const k=f.dataset.obForm;if(!k||!O)return false;const v=f.elements.v.value.trim();
  // 海图：当场取一次，成功列出接下来两个日程；真正加进订阅要等开始导览（跳过就什么都不写）
  if(k==='ical'){if(!v){f.elements.v.focus();return true;}O.ical=v;O.ical_state='loading';redraw();
   plugin.calendars.fetch(v).then(cal=>{if(!O||O.ical!==v)return;O.ical_cal=cal;O.ical_up=plugin.calendars.upcoming(cal.events,2);O.ical_state='ok';redraw();},e=>{if(!O||O.ical!==v)return;O.ical_state='bad';O.ical_err=e?.message||String(e);O.ical_cal=null;redraw();});return true;}
  if(v){(O.custom[k]??=[]).push(v);O.picks[k].add(v);}redraw();return true;}
 function key(e){if(tour&&tour.phase==='intro'&&!e.target.closest?.('input,textarea,[contenteditable]')&&!e.altKey&&!e.ctrlKey&&!e.metaKey){if(e.key==='ArrowRight'||e.key==='Enter'&&!e.target.closest?.('button')){tour.next();return true;}if(e.key==='ArrowLeft'){tour.prev();return true;}}
  if(e.key!=='Escape')return false;if(tour){tour.end();return true;}if(root.querySelector('.onboarding')){close();O=null;announce('已跳过首次起航，什么也没有写入');return true;}return false;}
 // 新建配置笔记：只写最少的几项，习惯等在第 2 步、设置里加
 async function createConfig(){if(plugin.writer.exists?.(CONFIG))return;await plugin.writer.create(CONFIG,'---\nhabits: []\nquestions: []\neffortScaleHours: 2\nlists: []\n---\n潮线的设置。习惯与每日问题的 id 写进每天的日记属性里，改名字不影响旧记录。\n');}
 // 示例航程：日期整体平移到今天；已存在的同名笔记不覆盖；装了哪些记在本机，设置里可以一键清除
 async function installExamples(){const today=plugin.clock().date,days=Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(EXAMPLE_DATE+'T12:00:00Z'))/864e5);
  const move=s=>s.replace(/(\d{4})-(\d{2})-(\d{2})/g,(m,y,mo,da)=>{const t=new Date(Date.UTC(+y,+mo-1,+da,12));t.setUTCDate(t.getUTCDate()+days);return t.toISOString().slice(0,10);});
  const done=[];for(const [p,text] of Object.entries(EXAMPLES)){const path=move(p);if(plugin.writer.exists?.(path))continue;if(path===CONFIG&&plugin.writer.exists?.(CONFIG))continue;await plugin.writer.create(path,move(text));if(path!==CONFIG)done.push(path);}
  local().examples=[...(local().examples||[]),...done];local().examplesAsked=false;plugin.index.setExamples(local().examples);await plugin.saveSettings();return done.length;}
 const isOpen=()=>!!root.querySelector('.onboarding');
 return{open,close,click,submit,key,isOpen,get touring(){return !!tour;}};}
