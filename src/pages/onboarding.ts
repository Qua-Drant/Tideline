// 首次起航（设计说明第 22 节；画面、插画、导览照原型 paper-onboarding-r39.js）。
// 原型里全是示例状态；这里每一步都对真实仓库：
//   1 船舱：真的检查配置笔记、日记与任务文件夹、日记篇数；“创建配置笔记”先列出路径、确认后才写；仓库还是空的时候可以装示例航程（带 example 标签，路径记在本机，设置里可以一键清除）
//   2 日常：勾选的习惯、每日问题、生命之轮领域，开始导览时追加进 潮线/配置.md（已有的同名项不重复加）
//   3 仪表：配色、过场、打开时停在、AI 助手开关，开始导览时存进这台设备的设置
//   4 海图：贴一个 iCal 地址当场取一次，成功列出接下来两个日程、失败写出原因；开始导览时才加进订阅（只存在这台设备上）；AI 服务显示本机 Claude Code 的真实状态
//   5 起航：导览——从思索一路切到大脑（每页停 2.5 秒），再逐页介绍，最后一张完成卡列出这次写入了什么
// 每页都能“跳过”；跳过就什么都不写（已经确认创建的配置笔记、装好的示例除外）。只在第一次打开时出现（记在本机），设置 › 数据 › 关于 里可以重新起航。
// 第 3d 期：转 TypeScript；整页改成 DOM 构建（draw/dom.ts），不再拼 HTML 字符串。每个函数对应原来的一段模板，结构、属性及其先后一一对应；
// 插画（paper-onboarding-art-r31.ts）给的是描述，用 partNodes 建节点。重画仍是“整张起航纸换成新的一张”（redraw：replaceWithNodes，原来是 outerHTML），
// 新纸带 is-still、过场时带 is-arriving，和原来一样；导览卡、完成卡、导览提示同样改成节点（导览提示与导览卡原来用 document.createElement 建，\n// 这里在视图所在的 document 里建；放进 root 之后两者一样）。
// 第 4b 期：pages/ai.js 转成 ai.ts，modelsOf 有了类型，去掉这里的类型断言（ModelOption 也不必再引）。
import {createVoyageArt} from '../draw/proto/paper-onboarding-art-r31.ts';
import {inkEl, circleEl, iconEl} from '../draw/ink.ts';
import {h, svg, setNodes, insertNodes, replaceWithNodes, within} from '../draw/dom.ts';
import type {Attrs, Child} from '../draw/dom.ts';
import {parts, partNodes} from '../draw/scene.ts';
import type {Parts} from '../draw/scene.ts';
import {FOLDERS} from '../data/index.ts';
import {EXAMPLES, EXAMPLE_DATE} from '../data/examples.ts';
import {PROVIDERS} from '../ai/acp.ts';
import {modelsOf, defaultModelOf} from './ai.ts';
import type {HandFont} from '../frame.ts';
import type {CompassView} from '../view.ts';
import type CompassPlugin from '../main.ts';

type PickKind = 'habits' | 'questions' | 'wheel';
type CheckState = 'blank' | 'found' | 'missing';
type Calendar = Awaited<ReturnType<CompassPlugin['calendars']['fetch']>>;
type Upcoming = ReturnType<CompassPlugin['calendars']['upcoming']>;
/** 一次起航的状态（每次打开重新开始） */
interface Voyage {
  step: number; checks: CheckState[]; facts: {days?: number; empty?: boolean; old?: string}; creating: boolean; created: boolean; installing: boolean; installed: number;
  picks: Record<PickKind, Set<string>>; custom: Partial<Record<PickKind, string[]>>; skipDaily: boolean;
  theme: string; motion: string; start: string; ai: boolean; aiProv: string; aiPerm: string; aiAttach: boolean; aiModel: string | null | undefined; zotero: boolean;
  writes: [string, string | null][]; done: [string, string | null][]; t0: number; from: number; motionPicked: boolean;
  ical?: string; ical_state?: 'loading' | 'ok' | 'bad'; ical_cal?: Calendar | null; ical_up?: Upcoming; ical_err?: string;
}
/** 导览：先一路飞过各页（fly），再逐页介绍（intro） */
interface Tour { phase: 'fly' | 'intro'; i: number; timer: ReturnType<typeof setTimeout> | undefined; hint: HTMLElement | null; card: HTMLElement | null; hover: boolean; end(): void; next(): void; prev(): void }
/** 一组按钮的一项：[值, 显示的内容] */
type Option = [value: string, label: Child];

export function createOnboarding({view, plugin, hand}: {view: CompassView; plugin: CompassPlugin; hand: HandFont}){
 const root = view.root, navigate = (p: string) => view.go(p), announce = (m: string) => view.frame.feedback(m), onFrames = () => view.frames(), showHelp = () => view.toggleHelp(true);
 const CONFIG = FOLDERS.config, local = () => plugin.local;
 const VA=createVoyageArt();
 /** 插画的描述 → 节点（在调用方当前的 document 里建） */
 const art=(p: Parts)=>partNodes(parts(p));
 const STEPS=['船舱','日常','仪表','海图','起航'];
 const TOUR: Record<string, {what: string; how: string[]}>={
  thought:{what:'看清方向：目标、本周规划和随手冒出的想法都在这片星空下。',how:['点右上的灯塔，在“规划”和“想法”之间切换','规划一排末尾的 + 新建目标；点目标打开它的详情纸，改每周投入、截止日期和状态','把任务拖到另一天就是改期；灯灭后点星星回看想法，点空白处记下新想法']},
  ai:{what:'在桅顶请 AI 帮忙：提示词库和对话都在这里。',how:['点一面旗挑选提示词，“带入对话”放进下方草稿，或直接复制','左上的模型菜单可以为这一段对话换一家或换个模型','供应商、各家的默认模型、权限和保护名单在 设置 › 指引 里改']},
  today:{what:'今天的一页：海平线以上是要做的，以下是已经发生的。',how:['点“完成”收掉正在推进的这件事；其他任务在右侧','时间轴上品红小船是此刻，浮标是日程（订阅的日历也在这里）','三态笔触记习惯，拖动拨盘打分，最后一行回车就记下随手记']},
  tasks:{what:'货舱里装着全部任务：收件箱、清单、项目和每一行货单。',how:['左栏切换今天、收件箱、清单和项目；把任务拖上去就移过去，加号新建清单','右键一行改日期、优先级、清单、标签；顶上的邮包是要沟通的人，+ 新建人物','点一行，右侧是一张纸：正文直接写，打 / 插入检查项、子任务、标签']},
  projects:{what:'海图室：每个项目是一条航线，船的位置就是进度。',how:['点一艘船，下方展开任务、里程碑、相关人员和文献；项目名可以直接改','把船拖到另一片海域，就改了项目状态','任务栏旁的 + 新建任务；“展开 Markdown”在 Obsidian 标签页里打开项目笔记']},
  review:{what:'船长室的日志：按日、周、季回头看。',how:['顶部切换日 · 周 · 季，左右箭头翻页','日视图对照往年今日；周视图看七天的趋势','季视图拖动花瓣，给生命之轮各个领域打分']},
  library:{what:'深海：文献和读书笔记按阅读深度沉在测深绳上。',how:['悬停纸签先看一句话结论，点开看详情','把纸签拖到另一段深度，就改了阅读阶段','装了 Zotero Integration 时，“Zotero”按钮导入文献；“打开我的知识库”进入书架']},
  brain:{what:'海底的大脑：所有笔记之间的关系。',how:['顶部按类型筛选，放大镜搜索，±缩放','点一个节点，相邻的节点和连线亮起；“去…页”跳过去','右侧排行列出关联最多的节点']}};
 const SCENES: [id: string, scene: string, name: string][]=[['thought','星空','思索'],['ai','桅顶','指引'],['today','海平线','今日'],['tasks','货舱','任务'],['projects','海图室','项目'],['review','船长室','复盘'],['library','深海','知识库'],['brain','海底','大脑']];
 const PICK: Record<PickKind, string[]>={habits:['阅读','运动','早起','冥想','喝够水'],questions:['今天最重要的三件事','有哪些收获或进步','遇到的困难与应对','下一步计划'],wheel:['身体健康','学习成长','工作与事业','人际关系','家人与朋友','休息与玩耍']};
 let state: Voyage | null=null,tour: Tour | null=null;
 /** 画面函数只在起航纸开着（state 有值）时调用 */
 const cur=()=>state!;
 /** 小图标外框：viewBox 0 0 w h 的 svg；pre 是原来用 replace 插在 viewBox 前面的属性 */
 const SVG=(kids: Child,w: number,ht: number,pre?: Attrs)=>svg('svg',{...pre,viewBox:`0 0 ${w} ${ht}`,'aria-hidden':'true'},kids);
 const filled=()=>svg('circle',{cx:'10',cy:'10',r:'5.4',fill:'#1C2A35'});
 const tri=(s: CheckState): Child=>s==='found'?filled():s==='missing'?circleEl(10,10,5.4,1.3):null;
 const dot=(on: boolean)=>SVG(on?filled():circleEl(10,10,5.4,1.3),20,20);
 const dayWord=(d: string)=>{const t=plugin.clock().date,diff=Math.round((Date.parse(d)-Date.parse(t))/86400000);return diff===0?"今天":diff===1?"明天":diff===2?"后天":`${Number(d.slice(5,7))}月${Number(d.slice(8))}日`;};
 function reset(){const D=local().device,A=local().ai;state={step:0,checks:['blank','blank','blank','blank'],facts:{},creating:false,created:false,installing:false,installed:0,picks:{habits:new Set(['阅读','运动']),questions:new Set(['今天最重要的三件事','有哪些收获或进步']),wheel:new Set(['身体健康','学习成长','工作与事业'])},custom:{},skipDaily:false,theme:D.theme,motion:D.motion,start:D.start,ai:!!A.enabled,aiProv:'claude',aiPerm:A.permission,aiAttach:!!(A as typeof A & {attach?: boolean}).attach,aiModel:undefined,zotero:local().zotero?.on!==false,writes:[],done:[],t0:performance.now(),from:0,motionPicked:false};}
 // ——— pages ———
 function course(){const O=cur(),n=STEPS.length;
  return h('div',{class:'ob-course','aria-label':`第 ${Math.max(O.step,0)} 步，共 5 步`},
   SVG(inkEl([[0,30],[700,30]],1.1),700,40,{preserveAspectRatio:'none'}),
   SVG(art(VA.waves(0,700,8,26)),700,40,{class:'ob-water',preserveAspectRatio:'none'}),
   STEPS.map((t,i)=>h('span',{class:`ob-point ${i+1===O.step?'is-here':''} ${i+1<O.step?'is-past':''}`,style:`left:${(i/(n-1)*100).toFixed(2)}%`},
    i+1===O.step?h('i',{class:'ob-ship'},SVG([inkEl([[3,22],[7,27],[25,27],[29,22],[3,22]],1.2),inkEl([[16,2],[16,22]],1.1),inkEl([[15,4],[6,19],[15,19]],1),inkEl([[18,6],[25,19],[18,19]],1)],32,30)):null,
    h('b'),h('small',null,t))));}
 function head(title: string,ic: Child): Child{return [h('header',{class:'ob-head'},ic,h('h2',null,title)),h('div',{class:'ob-rope'},art(VA.rope()))];}
 const btn=(act: string,label: string)=>h('button',{class:'ob-btn hand-pill','data-ob':act},label);
 function page(): Child{const O=cur(),s=O.step;
  if(s===0)return h('div',{class:'ob-cover'},SVG([inkEl([[150,20],[156,32],[168,36],[156,40],[150,52],[144,40],[132,36],[144,32],[150,20]],1.3),inkEl([[60,36],[120,36]],.8),inkEl([[180,36],[240,36]],.8)],300,60),
   h('h1',null,'潮线'),h('p',{class:'ob-lead'},'以规划明确方向，以任务推动行动，以记录积累事实，以复盘形成反馈。'),h('p',{class:'ob-small'},'潮线只读写这个仓库里的笔记；除了你添加的日历和开启的 AI 助手，不联网。'),
   h('div',{class:'ob-art'},art(VA.harbor())),h('button',{class:'ob-go hand-pill','data-ob':'next'},'起航',SVG([inkEl([[4,10],[16,10]],1.3),inkEl([[11,5],[16,10],[11,15]],1.3)],20,20)));
  if(s===1){const f=O.facts,rows=[['配置笔记',CONFIG],['日记文件夹',FOLDERS.journal+'/'],['任务文件夹',FOLDERS.tasks+'/'],['已有日记',(f.days??0)+' 篇']];
   return [head('1. 船舱：检查仓库',iconEl('box',26)),h('div',{class:'ob-step'},h('div',{class:'ob-main'},
    h('ul',{class:'ob-checks hand-panel'},rows.map(([a,b],i)=>h('li',null,SVG(tri(O.checks[i]),20,20),h('b',null,a),h('span',{class:'mono'},O.checks[i]==='missing'?'还没有':b)))),
    f.old?h('p',{class:'ob-note hand-panel'},iconEl('circle',16),h('span',null,`发现 0.32 版本留下的数据（${f.old}）。不会自动迁移，也不会改动它们。`)):null,
    O.created?h('p',{class:'ob-done'},`已创建 ${CONFIG}`):null,
    O.creating?h('div',{class:'ob-confirm hand-panel'},h('p',null,'将要创建：'),h('ul',{class:'mono'},h('li',null,CONFIG)),h('div',null,btn('create-yes','创建'),btn('create-no','取消')))
    :O.installing?h('div',{class:'ob-confirm hand-panel'},h('p',null,`将要写入 ${Object.keys(EXAMPLES).length} 篇示例笔记（带 example 标签，日期换成从今天算起），放进各类笔记原本的文件夹：`),h('ul',{class:'mono'},['日记/','任务/','项目/','人物/','想法/','文献/','书籍/','潮线/'].map(x=>h('li',null,x))),h('div',null,btn('install-yes','装上'),btn('install-no','取消')))
    :O.installed?h('p',{class:'ob-done'},`已装上 ${O.installed} 篇示例笔记；设置 › 数据 里可以一键清除`)
    :h('div',{class:'ob-actions'},h('button',{class:'ob-btn hand-pill','data-ob':'create',disabled:O.checks[0]!=='missing'||O.created},'创建配置笔记'),h('button',{class:'ob-btn hand-pill','data-ob':'install',disabled:!f.empty,title:f.empty?'装一套覆盖各页的示例笔记':'仓库里已经有任务或日记，不装示例'},'装一套示例航程'))),
    h('figure',{class:'ob-vignette'},art(VA.cabin())))];}
  if(s===2){const col=(k: PickKind,t: string)=>h('section',{class:'ob-col hand-panel'},h('h3',null,t,h('small',null,'可多选')),
    [...PICK[k],...(O.custom[k]||[])].map(x=>h('button',{class:'ob-pick','data-ob':`pick|${k}|${x}`,'aria-pressed':String(O.picks[k].has(x))},SVG(O.picks[k].has(x)?[svg('rect',{x:'4',y:'4',width:'12',height:'12',rx:'2',fill:'#1C2A35'}),inkEl([[6.5,10],[9,12.5],[13.5,7]],1.2,'#F4F5F2')]:inkEl([[4,4],[16,4],[16,16],[4,16],[4,4]],1.1),20,20),h('span',null,x))),
    h('form',{class:'ob-custom','data-ob-form':k},h('input',{name:'v',placeholder:'自定义…','aria-label':`自定义${t}`})));
   return [head('2. 日常：习惯、每日问题、生命之轮领域',iconEl('note',26)),h('div',{class:'ob-step'},h('div',{class:'ob-main'},h('div',{class:'ob-cols'},col('habits','习惯'),col('questions','每日问题'),col('wheel','生命之轮领域')),
    h('p',{class:'ob-small'},'选完写进配置笔记，以后在设置里随时改。',h('button',{class:'ob-link','data-ob':'skip-daily'},'这一步先跳过'))),h('figure',{class:'ob-vignette'},art(VA.daily())))];}
  if(s===3){const seg=(k: 'theme'|'motion'|'start',opts: Option[])=>h('span',{class:'ob-seg'},opts.map(([v,l])=>h('button',{'data-ob':`set|${k}|${v}`,'aria-checked':String(O[k]===v)},l)));
   return [head('3. 仪表：这台设备的偏好',iconEl('settings',26)),h('div',{class:'ob-step'},h('div',{class:'ob-main'},h('div',{class:'ob-rows hand-panel'},
    h('div',null,h('b',null,'配色'),seg('theme',[['obsidian','跟随 Obsidian'],['paper','纸'],['night','夜航']])),h('div',null,h('b',null,'过场'),seg('motion',[['brief','滑动'],['off','关闭']])),h('div',null,h('b',null,'打开时停在'),seg('start',[['last','上次所在的页'],['today','今日']])),
    h('div',null,h('b',null,'AI 助手'),h('button',{class:'ob-mark','data-ob':'ai','aria-checked':String(O.ai)},dot(O.ai),h('span',null,O.ai?'开':'关')),h('small',{class:'ob-ai-found'},aiFoundLine())))),h('figure',{class:'ob-vignette'},art(VA.gauges())))];}
  if(s===4)return [head(O.ai?'4. 海图：日历、文献与 AI 服务':'4. 海图：日历订阅与文献（可选）',SVG([inkEl([[3,5],[21,5],[21,21],[3,21],[3,5]],1.2),inkEl([[3,9],[21,9]],1),inkEl([[8,2],[8,6]],1.2),inkEl([[16,2],[16,6]],1.2)],24,24)),h('div',{class:'ob-step'},h('div',{class:'ob-main'},
   h('form',{class:'ob-ical','data-ob-form':'ical'},h('input',{name:'v',class:'mono',placeholder:'粘贴一个 iCal 地址，例如 https://calendar.example.com/me.ics',value:O.ical||'','aria-label':'iCal 地址'}),h('button',{class:'ob-btn hand-pill',type:'submit',disabled:O.ical_state==='loading'},O.ical_state==='loading'?'正在获取…':'测试刷新')),
   O.ical_state==='ok'?h('div',{class:'ob-result hand-panel'},h('p',null,SVG(filled(),20,20),'刷新成功',O.ical_cal?.name?`（${O.ical_cal.name}）`:'','。',O.ical_up?.length?'接下来的日程：':'60 天内没有日程。'),
     h('ul',null,(O.ical_up||[]).map(o=>h('li',null,h('b',null,o.title),h('span',{class:'mono'},`${dayWord(o.date)} ${o.allDay?'全天':o.time+(o.end?' – '+o.end:'')}`)))))
   :O.ical_state==='bad'?h('div',{class:'ob-result hand-panel is-bad'},h('p',null,SVG(circleEl(10,10,5.4,1.3,'#B23A48'),20,20),'获取失败：'+(O.ical_err||''))):null,
   h('p',{class:'ob-small'},'可以添加多个订阅。取回的日程存在这台设备上，到了刷新间隔（默认 6 小时）才重新联网，打开潮线时直接用上次取回的；间隔在 设置 › 日历 里改。也可以把日程直接写在 ',h('span',{class:'mono'},FOLDERS.calendar),'。'),
   zoteroRow(),aiServices()),h('figure',{class:'ob-vignette'},art(VA.chartTable())))];
  return [head('5. 起航：导览',SVG([circleEl(12,12,8,1.2),circleEl(12,12,2,1),[0,1,2,3,4,5,6,7].map(i=>{const t=i*Math.PI/4;return inkEl([[12+Math.cos(t)*2,12+Math.sin(t)*2],[12+Math.cos(t)*11,12+Math.sin(t)*11]],1);})],24,24)),
   h('div',{class:'ob-tour-line'},SCENES.map(([,scene,name],i)=>[i?h('i',null,'·'):null,h('span',null,hand.textEl(name,{size:17}),h('small',null,scene))])),
   h('button',{class:'ob-go hand-pill','data-ob':'tour'},'开始导览'),h('p',{class:'ob-small'},'先从星空一路驶到海底，再逐页介绍每一层怎么用；按 Esc 随时结束。'),h('div',{class:'ob-art is-small'},art(VA.harbor()))];}
 // R37：海图页的 AI 服务（第 3 步开着 AI 助手时出现）
 // 0.3：经 ACP 接入的各家预设（0.9.1 起含 CodeBuddy、DeepSeek Harness），各做一次握手（只握手，不开会话）；找不到时给出安装命令
 const AI_IDS=PROVIDERS.filter(id=>id!=='custom');
 type Found = [id: string, name: string, version: string, state: string, install: string];
 const AI_FOUND=()=>AI_IDS.map((id): Found=>{const st=plugin.ai?.status?.[id],P=plugin.aiProviderInfo?.(id)||{name:id,install:''};return [id,P.name,st?.version||'',!st?'检查中':st.ok?'可用':'未找到',st&&!st.ok?P.install||'':''];});
 // 0.9.3：第 3 步的检测结果按本机真实握手生成（原来是原型里写死的示例）
 const aiFoundLine=()=>{const all=AI_FOUND(),ok=all.filter(x=>x[3]==='可用');if(ok.length)return '检测到：'+ok.map(([,l,v])=>v?l+' '+v:l).join(' · ');return all.some(x=>x[3]==='检查中')?'正在检测本机的 AI 代理…':'没有找到 AI 代理，下一步可以看安装方法';};
 const AI_PERM: [string, string][]=[['read','只读'],['confirm','改前确认'],['auto','自动接受改动']];
 type AiSeg = (k: 'aiProv'|'aiPerm'|'aiModel',opts: Option[])=>HTMLSpanElement;
 function aiServices(){const O=cur();if(!O.ai)return h('p',{class:'ob-small ob-ai-off'},'AI 助手在上一页关掉了；以后可以在 设置 › 指引 里开启。');
  const seg: AiSeg=(k,opts)=>h('span',{class:'ob-seg'},opts.map(([v,l])=>h('button',{'data-ob':`aiset|${k}|${v}`,'aria-checked':String(O[k]===v)},l)));
  return h('section',{class:'ob-ai hand-panel','aria-label':'AI 服务'},h('h3',null,iconEl('flag',18),h('span',null,'AI 服务'),h('small',null,'上一页开启了 AI 助手 · 这些只存在这台设备上')),
   h('div',{class:'ob-ai-row'},h('b',null,'默认供应商'),seg('aiProv',AI_FOUND().map(([v,l,,st]): Option=>[v,[l,h('i',{class:`ob-ai-state ${st==='可用'?'is-ok':st==='未找到'?'is-warn':''}`,title:st})]]))),
   h('ul',{class:'ob-ai-list is-one'},AI_FOUND().filter(x=>x[0]===O.aiProv).map(([,l,ver,st,cmd])=>h('li',{class:st==='未找到'?'is-warn':''},h('b',null,l),h('span',{class:'mono'},ver),h('span',null,st),cmd?h('span',{class:'ob-ai-cmd'},'在终端运行 ',h('code',{class:'mono'},cmd),h('button',{class:'ob-link','data-ob':`aicopy|${cmd}`},'复制')):null))),
   modelRow(seg),
   h('div',{class:'ob-ai-row'},h('b',null,'默认权限'),seg('aiPerm',AI_PERM),h('small',null,O.aiPerm==='auto'?'只限“允许直接改的文件夹”，默认为空':O.aiPerm==='read'?'只读不改':'每次改动前先问你')),
   h('div',{class:'ob-ai-row'},h('b',null,'自动附带当前页'),h('button',{class:'ob-mark','data-ob':'aiattach','aria-checked':String(O.aiAttach)},dot(O.aiAttach),h('span',null,O.aiAttach?'开':'关')),h('small',null,'日记正文不会自动附带')),
   h('p',{class:'ob-small'},'保护名单、各家的模型与密钥在 设置 › 指引 里改。'));}
 // 默认模型：这一家报过模型清单（或是 Claude 的三个预设）就给选；没读到时说明在哪里读
 function modelRow(seg: AiSeg){const O=cur(),ms=modelsOf(plugin,O.aiProv);
  if(!ms?.length)return h('div',{class:'ob-ai-row'},h('b',null,'默认模型'),h('small',null,'用它自己的默认；以后在 设置 › 指引 点“读取”，从它报的模型里挑'));
  if(O.aiModel===undefined)O.aiModel=defaultModelOf(plugin,O.aiProv);
  const list: Option[]=[['','代理默认'],...ms.slice(0,8).map((m): Option=>[m.value,m.name])];return h('div',{class:'ob-ai-row'},h('b',null,'默认模型'),seg('aiModel',list),ms.length>8?h('small',null,`还有 ${ms.length-8} 个在 设置 › 指引 里`):null);}
 // 知识库的文献来源：装了 Zotero Integration 就读它的导入文件夹（0.7）
 function zoteroRow(): Child{const O=cur(),z=plugin.zotero?.();if(!z)return null;
  if(!z.installed)return h('p',{class:'ob-small ob-zotero'},'文献：用 Zotero 管理文献的话，在 Obsidian 里装上 Zotero Integration 插件，它导入的文献笔记会出现在知识库（设置 › 笔记）。');
  return h('div',{class:'ob-ai-row ob-zotero'},h('b',null,'Zotero 文献'),h('button',{class:'ob-mark','data-ob':'zotero','aria-checked':String(O.zotero)},dot(O.zotero),h('span',null,O.zotero?'接入':'不接')),
   h('small',null,!z.enabled?'Zotero Integration 已安装，还没启用':z.folders.length?`读取 ${z.folders.map(f=>f+'/').join('、')} 里的文献笔记；知识库的“Zotero”按钮调它导入`:'没有找到它的导入文件夹，可以在 设置 › 笔记 里填'));}
 function applyAI(){const O=cur(),A=local().ai;A.enabled=O.ai;if(O.ai){A.permission=O.aiPerm as typeof A.permission;(A as typeof A & {attach?: boolean}).attach=O.aiAttach;A.provider=O.aiProv;A.providers??={};A.providers[O.aiProv]={...(A.providers[O.aiProv]||{}),on:true};if(O.aiModel!==undefined)A.providers[O.aiProv].model=O.aiModel as string;plugin.refreshAI?.();}return AI_FOUND().find(x=>x[0]===O.aiProv)?.[1];}

 // 0.3 起只有“滑动 / 关闭”两档：起航插画的手绘动态在“滑动”时照常播放
 const motion=()=>(state?.motionPicked?state.motion:local().device.motion)==='off'?'off':'full';
 const moving=()=>motion()==='full'&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 function sheet(arriving: boolean){const O=cur();
  return h('div',{class:`onboarding hand-panel ${O.step?'':'is-cover'} ${arriving?'is-arriving':''}`,style:`--ob-t:${Math.round(performance.now()-O.t0)}`,'data-motion':motion(),'data-step':O.step,role:'dialog','aria-modal':'true','aria-label':'首次起航'},
   h('button',{class:'ob-skip hand-pill','data-ob':'skip'},'跳过引导'),
   O.step>1?h('button',{class:'ob-back','data-ob':'back','aria-label':'上一步'},SVG(inkEl([[13,5],[7,10],[13,15]],1.3),20,20)):null,
   h('div',{class:'ob-page'},page()),
   O.step?[h('div',{class:'ob-sea'},art(VA.seaBand())),course(),O.step<5?h('button',{class:'ob-next hand-pill','data-ob':'next'},'下一步'):null]:null);}
 function mount(){root.querySelector('.onboarding')?.remove();insertNodes(root.querySelector('#sheet')!,'beforeend',()=>sheet(true));onFrames();}
 // 整张起航纸换成新的一张（原来是 outerHTML 替换：输入框、焦点、动画都随旧纸一起换掉，这里同样）
 function redraw(arriving=false){const el=root.querySelector('.onboarding');if(!el)return;replaceWithNodes(el,()=>sheet(arriving));const n=root.querySelector('.onboarding')!;n.classList.add('is-still');onFrames();if(arriving)sail();}
 // The ship leaves the waypoint it was at and sails to the new one along the course.
 function sail(){const O=cur(),ship=root.querySelector('.ob-ship'),pts=root.querySelectorAll('.ob-point');if(!ship||!O.from||O.from===O.step||!moving())return;const a=pts[O.from-1]?.getBoundingClientRect(),b=pts[O.step-1]?.getBoundingClientRect();if(!a||!b)return;const dx=a.left-b.left;ship.animate([{transform:`translateX(${dx}px) translateY(0)`},{transform:`translateX(${dx*.5}px) translateY(-3px)`,offset:.5},{transform:'translateX(0) translateY(0)'}],{duration:Math.min(1100,420+Math.abs(dx)*1.6),easing:'cubic-bezier(.4,.1,.3,1)'});}
 // 疑似问题批 F1：翻页后 150ms 内按 Esc 或点“跳过”，state 已是 null，计时器再读 cur() 会抛 TypeError；引导已关闭（或换成了新的一次）就直接返回
 function turn(to: number){const O=cur();O.from=O.step;O.step=to;const el=root.querySelector('.onboarding');el?.classList.add('is-turning');setTimeout(()=>{if(state!==O)return;redraw(true);if(cur().step===1)runChecks();},150);}
 function runChecks(){const O=cur(),files=plugin.index.source.files().map(x=>x.path),has=(p: string)=>files.some(x=>x===p||x.startsWith(p+'/')),days=[...plugin.index.days.keys()].length;
  O.facts={days,empty:!files.some(x=>x.startsWith(FOLDERS.tasks+'/')||x.startsWith(FOLDERS.journal+'/')),old:['Meta/Compass Config.md','08 Tasks','01 Journal'].find(has)||''};
  const order: CheckState[]=[has(CONFIG)?'found':'missing',has(FOLDERS.journal)?'found':'missing',has(FOLDERS.tasks)?'found':'missing',days?'found':'missing'];order.forEach((v,i)=>setTimeout(()=>{if(!state||state.step!==1)return;state.checks[i]=v;redraw();},220+i*260));}
 function open(){reset();mount();Promise.all(AI_IDS.map(id=>plugin.detectAI?.(true,id,{models:false}))).then(()=>{if(state&&(state.step===3||state.step===4))redraw();}).catch(()=>{});} // 第 4 步要显示本机 Claude Code 的真实状态，打开时就去查（不发起对话）
 function close(){root.querySelector('.onboarding')?.remove();}
 // 开始导览时才写：日常的勾选追加进配置笔记；设备与 AI 的偏好存进这台设备
 // （原来这里读的是模块里的 O：每次读都取当时的状态，await 之后也一样；这里照样每次用 cur()）
 async function applyAll(){const w=[...cur().done];
  if(!cur().skipDaily){const add: Record<PickKind, string[]>={habits:[],questions:[],wheel:[]};for(const k of ['habits','questions','wheel'] as const)add[k]=[...cur().picks[k]];
   if(add.habits.length||add.questions.length||add.wheel.length){const n: Record<PickKind, number>={habits:0,questions:0,wheel:0};
    await plugin.writer.frontmatter(CONFIG,fm=>{const put=(field: string,nameKey: string,base: string,list: string[],k: PickKind)=>{const was: unknown=fm[field];fm[field]=Array.isArray(was)?was as unknown[]:[];const arr=fm[field] as (Record<string, unknown> | null)[];for(const name of list){if(arr.some(x=>x&&x[nameKey]===name))continue;let i=arr.length+1;while(arr.some(x=>x&&x.id===base+i))i++;arr.push({id:base+i,[nameKey]:name});n[k]++;}};
     put('habits','name','habit_',add.habits,'habits');put('questions','title','question_',add.questions,'questions');put('areas','title','area_',add.wheel,'wheel');});
    for(const[k,l]of [['habits','个习惯'],['questions','个每日问题'],['wheel','个生命之轮领域']] as const)if(n[k])w.push([`添加了 ${n[k]} ${l}`,CONFIG]);}}
  {const O=cur();if(O.ical_state==='ok'&&O.ical_cal){await plugin.calendars.add(O.ical_cal.name||'',O.ical!,O.ical_cal.events);w.push(['添加了 1 个日历订阅（只存在这台设备上）',null]);}}
  {const O=cur(),D=local().device;D.theme=O.theme;D.motion=O.motion;D.start=O.start;}const name=applyAI();
  const z=plugin.zotero?.();if(z?.installed){local().zotero={...(local().zotero||{folder:''}),on:cur().zotero};await plugin.syncZotero?.();if(cur().zotero&&z.folders.length)w.push([`接入了 Zotero 文献（${z.folders.join('、')}/）`,null]);}
  {const O=cur();w.push(['这台设备：配色、过场、打开时停在'+(O.ai?`，AI 助手开（${name}，${AI_PERM.find(x=>x[0]===O.aiPerm)?.[1]}${O.aiAttach?'，自动附带当前页':''}）`:'，AI 助手关'),null]);}
  local().onboarded=true;local().version=plugin.manifest?.version||null;await plugin.saveSettings();view.applyDevice?.();plugin.refreshAI();cur().writes=w;}
 async function startTour(){await applyAll();close();const fast=!moving()||motion()==='off';
  const hint=within(root.ownerDocument,()=>h('div',{class:'tour-hint',role:'status'},'正在从星空驶向海底 · ',h('kbd',null,'Esc'),' 跳过'));root.appendChild(hint);
  const t: Tour={phase:'fly',i:0,timer:undefined,hint,card:null,hover:false,end:()=>endTour(),next:()=>introStep(t.i+1),prev:()=>introStep(Math.max(0,t.i-1))};tour=t;
  const fly=(k: number)=>{if(!tour||tour.phase!=='fly')return;if(k>=SCENES.length){tour.hint?.remove();tour.hint=null;introStep(0);return;}navigate(SCENES[k][0]);tour.timer=setTimeout(()=>fly(k+1),fast?450:2500);};
  fly(0);}
 // 逐页介绍：第 n 页（越界就收尾）
 function introStep(n: number){if(!tour)return;clearTimeout(tour.timer);if(n>=SCENES.length){endTour();return;}tour.phase='intro';tour.i=n;const[id,scene,name]=SCENES[n],t=TOUR[id];
  navigate(id);showHelp?.();
  let c=tour.card;if(!c){const card=within(root.ownerDocument,()=>h('section',{class:'tour-card hand-panel',role:'dialog','aria-label':'导览'}));c=card;root.appendChild(card);
   card.addEventListener('pointerenter',()=>{if(tour)tour.hover=true;card.classList.add('is-paused');});card.addEventListener('pointerleave',()=>{if(!tour)return;tour.hover=false;card.classList.remove('is-paused');arm();});tour.card=card;}
  c.dataset.page=id;
  setNodes(c,()=>[h('p',{class:'tour-count mono'},`${n+1} / ${SCENES.length}`),h('h3',null,hand.textEl(name,{size:22}),h('small',null,scene)),h('p',{class:'tour-what'},t.what),h('ul',null,t.how.map(x=>h('li',null,x))),
   h('div',{class:'tour-bar'},h('i',{style:`--tour-ms:${INTRO_MS}ms`})),h('div',{class:'tour-actions'},h('button',{class:'ob-link','data-ob':'tour-end'},'结束导览'),h('span',null,n?h('button',{class:'ob-btn hand-pill','data-ob':'tour-prev'},'上一页'):null,h('button',{class:'ob-btn hand-pill','data-ob':'tour-next'},n===SCENES.length-1?'完成':'下一页')))]);
  c.classList.remove('is-paused');void c.offsetWidth;place(c);onFrames?.();arm();
  // 说明箭头在纸里，过场时随纸滑动；等过场结束（最多 760ms）再按箭头的最终位置选一次
  const me=tour,card=c;setTimeout(()=>{if(tour===me&&tour.card===card&&card.dataset.page===id)place(card);},760);}
 // 导览卡放在四个角里第一个不压住说明箭头（.help-note）、顶部条和罗盘的位置；都压就选压得最少的
 function place(c: HTMLElement){const R=root.getBoundingClientRect(),W=R.width,H=R.height,w=c.offsetWidth,ht=c.offsetHeight,m=32,top=132;
  const spots: [number, number][]=[[W-w-40,H-ht-m],[W-w-40,top],[150,H-ht-m],[Math.round((W-w)/2+60),H-ht-m],[W-w-40,Math.round((H-ht)/2+40)],[W-w-40,top+70]];
  const avoid=[...root.querySelectorAll('.help-note,#compass-toggle,#capture-toggle')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left-R.left,right:r.right-R.left,top:r.top-R.top,bottom:r.bottom-R.top,width:r.width};}).filter(r=>r.width);
  const cost=([x,y]: [number, number])=>avoid.reduce((s,r)=>s+Math.max(0,Math.min(x+w,r.right)-Math.max(x,r.left))*Math.max(0,Math.min(y+ht,r.bottom)-Math.max(y,r.top)),0);
  const best=spots.map((s): [[number, number], number]=>[s,cost(s)]).sort((a,b)=>a[1]-b[1])[0][0];Object.assign(c.style,{left:best[0]+'px',top:best[1]+'px',right:'auto',bottom:'auto'});}
 const INTRO_MS=9000;
 function arm(){if(!tour||tour.phase!=='intro')return;clearTimeout(tour.timer);if(tour.card?.matches(':hover')){tour.hover=true;tour.card.classList.add('is-paused');}if(tour.hover)return;const bar=tour.card?.querySelector<HTMLElement>('.tour-bar i');if(bar){bar.style.animation='none';void bar.offsetWidth;bar.style.animation='';}tour.timer=setTimeout(()=>{if(!tour)return;if(tour.card?.matches(':hover')){tour.hover=true;tour.card.classList.add('is-paused');return;}tour.next();},INTRO_MS);}
 function endTour(){if(!tour)return;clearTimeout(tour.timer);tour.hint?.remove();tour.card?.remove();tour=null;navigate('today');finale();local().onboarded=true;void plugin.saveSettings();}
 // 收尾：完成卡停留约 6 秒后淡出（鼠标停在卡上会等）
 const FINALE_MS=4000;
 function finale(){root.querySelector('.ob-slip')?.remove();const w=state?.writes||[];
  insertNodes(root.querySelector('#sheet')!,'beforeend',()=>h('div',{class:'ob-slip ob-finale hand-popup',role:'status'},h('h3',{class:'ob-finale-title'},hand.textEl('准备好了，起航',{size:22})),
   w.length?[h('p',null,'这次写入了：'),h('ul',null,w.map(([x,p])=>h('li',null,p?h('button',{'data-ob':`open|${p}`},x):h('span',null,x))))]:h('p',null,'这次什么也没有写入。'),
   h('p',{class:'ob-finale-keys'},'左侧栏在八层之间切换 · 左下舵轮是设置 · 指引页可以请 AI 帮忙')));
  onFrames?.();const el=root.querySelector<HTMLElement>('.ob-finale')!;let left=FINALE_MS,t0=performance.now(),hold=false,timer: ReturnType<typeof setTimeout> | 0=0;
  const go=()=>{timer=setTimeout(()=>{if(!el.isConnected)return;el.classList.add('is-leaving');setTimeout(()=>el.remove(),800);},left);};
  el.addEventListener('pointerenter',()=>{hold=true;clearTimeout(timer);left=Math.max(1200,left-(performance.now()-t0));el.classList.remove('is-leaving');});
  el.addEventListener('pointerleave',()=>{if(!hold)return;hold=false;t0=performance.now();go();});go();}
 function click(e: MouseEvent){const b=(e.target as Element).closest<HTMLElement>('[data-ob]');if(!b)return false;const[a,...r]=b.dataset.ob!.split('|');
  if(a==='slip-close'){root.querySelector('.ob-slip')?.remove();return true;}if(a==='open'){plugin.writer.open(r.join('|'));return true;}
  if(a==='tour-next'){tour?.next();return true;}if(a==='tour-prev'){tour?.prev();return true;}if(a==='tour-end'){tour?.end();return true;}
  if(a==='say'){announce(r.join('|'));return true;}
  const O=state;if(!O)return true;
  // 按按钮上写的键改状态（set / aiset：键名就是 Voyage 的字段名）
  const put=(k: string,v: unknown)=>{(O as unknown as Record<string, unknown>)[k]=v;};
  if(a==='skip'){close();state=null;local().onboarded=true;void plugin.saveSettings();announce('已跳过首次起航，没有再写入什么');return true;}
  if(a==='next'){turn(Math.min(5,O.step+1));return true;}if(a==='back'){turn(Math.max(1,O.step-1));return true;}
  if(a==='create')O.creating=true;else if(a==='create-no')O.creating=false;else if(a==='create-yes'){O.creating=false;void createConfig().then(()=>{const L=cur();L.created=true;L.checks[0]='found';L.done.push(['创建了 '+CONFIG,CONFIG]);redraw();});return true;}
  else if(a==='install')O.installing=true;else if(a==='install-no')O.installing=false;else if(a==='install-yes'){O.installing=false;void installExamples().then(n=>{const L=cur();L.installed=n;L.checks=L.checks.map(()=>'found');L.done.push([`装上了 ${n} 篇示例笔记`,null]);runChecks();redraw();});return true;}
  else if(a==='pick'){const set=O.picks[r[0] as PickKind],v=r.slice(1).join('|');if(set.has(v))set.delete(v);else set.add(v);O.skipDaily=false;}
  else if(a==='skip-daily'){O.skipDaily=true;turn(3);return true;}
  else if(a==='set'){put(r[0],r[1]);if(r[0]==='motion')O.motionPicked=true;}else if(a==='ai')O.ai=!O.ai;else if(a==='aiset'){put(r[0],r[1]);if(r[0]==='aiProv')O.aiModel=undefined;}else if(a==='zotero')O.zotero=!O.zotero;else if(a==='aiattach')O.aiAttach=!O.aiAttach;else if(a==='aicopy'){navigator.clipboard?.writeText(r.join('|')).catch(()=>{});announce('已复制：'+r.join('|'));return true;}else if(a==='tour'){void startTour();return true;}
  redraw();return true;}
 function submit(f: HTMLFormElement){const k=f.dataset.obForm,O=state;if(!k||!O)return false;const input=f.elements.namedItem('v') as HTMLInputElement,v=input.value.trim();
  // 海图：当场取一次，成功列出接下来两个日程；真正加进订阅要等开始导览（跳过就什么都不写）
  if(k==='ical'){if(!v){input.focus();return true;}O.ical=v;O.ical_state='loading';redraw();
   plugin.calendars.fetch(v).then(cal=>{if(!state||state.ical!==v)return;state.ical_cal=cal;state.ical_up=plugin.calendars.upcoming(cal.events!,2);state.ical_state='ok';redraw();},(e: unknown)=>{if(!state||state.ical!==v)return;state.ical_state='bad';state.ical_err=(e as Error)?.message||String(e);state.ical_cal=null;redraw();});return true;}
  if(v){(O.custom[k as PickKind]??=[]).push(v);O.picks[k as PickKind].add(v);}redraw();return true;}
 function key(e: KeyboardEvent){const tg=e.target as Element;if(tour&&tour.phase==='intro'&&!tg.closest?.('input,textarea,[contenteditable]')&&!e.altKey&&!e.ctrlKey&&!e.metaKey){if(e.key==='ArrowRight'||e.key==='Enter'&&!tg.closest?.('button')){tour.next();return true;}if(e.key==='ArrowLeft'){tour.prev();return true;}}
  if(e.key!=='Escape')return false;if(tour){tour.end();return true;}if(root.querySelector('.onboarding')){close();state=null;announce('已跳过首次起航，什么也没有写入');return true;}return false;}
 // 新建配置笔记：只写最少的几项，习惯等在第 2 步、设置里加
 async function createConfig(){if(plugin.writer.exists?.(CONFIG))return;await plugin.writer.create(CONFIG,'---\nhabits: []\nquestions: []\neffortScaleHours: 2\nlists: []\n---\n潮线的设置。习惯与每日问题的 id 写进每天的日记属性里，改名字不影响旧记录。\n');}
 // 示例航程：日期整体平移到今天；已存在的同名笔记不覆盖；装了哪些记在本机，设置里可以一键清除
 async function installExamples(){const today=plugin.clock().date,days=Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(EXAMPLE_DATE+'T12:00:00Z'))/864e5);
  const move=(s: string)=>s.replace(/(\d{4})-(\d{2})-(\d{2})/g,(m,y: string,mo: string,da: string)=>{const t=new Date(Date.UTC(+y,+mo-1,+da,12));t.setUTCDate(t.getUTCDate()+days);return t.toISOString().slice(0,10);});
  const done: string[]=[];for(const [p,text] of Object.entries(EXAMPLES)){const path=move(p);if(plugin.writer.exists?.(path))continue;if(path===CONFIG&&plugin.writer.exists?.(CONFIG))continue;await plugin.writer.create(path,move(text));if(path!==CONFIG)done.push(path);}
  local().examples=[...(local().examples||[]),...done];local().examplesAsked=false;plugin.index.setExamples(local().examples);await plugin.saveSettings();return done.length;}
 const isOpen=()=>!!root.querySelector('.onboarding');
 return{open,close,click,submit,key,isOpen,get touring(){return !!tour;}};}
