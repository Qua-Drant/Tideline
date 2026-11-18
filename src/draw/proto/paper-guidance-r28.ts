import {HOST} from '../../host.ts';
import {h,svg,setNodes,insertNodes} from '../dom.ts';
import type {Child} from '../dom.ts';
import {iconEl} from '../ink.ts';
import type {Point} from '../ink.ts';
import {partNodes,parts} from '../scene.ts';
import type {Model,ModelAI,ModelPrompt} from '../../data/types.ts';
import type {createR12Art} from './paper-r12-art.ts';
// R28 guidance (copied from paper-guidance-r12.js, which stays as it was): the R26 look — category flags, the model
// menu, the prompt library with its preview, the composer — with the R27 configuration underneath:
// · settings › 指引 decides whether the assistant is on. Off: only the library and “复制”; the composer, model menu and
//   chat view are gone and the header offers “接入 AI 助手”, which opens that settings group.
// · On: the model menu lists the models of the providers switched on in settings, the default provider's first model
//   preselected; picking one changes only this conversation. A flag click brings its prompt into the composer.
//   Sending adds the message and a sample reply to the thread (nothing is sent anywhere). Enter or Ctrl+Enter follows
//   the setting. The context line also shows the default permission; a pennant on the mast warns when it is
//   “自动接受改动” or the current page is attached automatically, and opens settings.
// 第 4a 期：转 TypeScript，各块（#connection、#privacy、#flags、#prompts、#native-content、#native-error、#native-send、#handoff-outline、#search-icon）
// 改成节点构建（setNodes 整块换掉，与原来 innerHTML 一样每次重画整块）；提示词标题、副标题、正文、笔记名、模型名、错误一律是文本节点或属性值。
// 对话区里的消息仍是 src/ai/controller.js 拼的 HTML：由 HOST.ai.fillThread 写进这里建好的 .native-thread（第 4b 批再改）。
// 原来没转义就拼进去的几处（模型名 data-model 与选项文字、提示词 id 的 data-guidance-prompt / data-flag）现在原样成为属性值 / 文字。
type R12Art=ReturnType<typeof createR12Art>;
/** 设置 › 指引（pages/ai.js 的 syncSettings 写进 d.settingsR27.ai） */
interface GuidanceSettings {enabled: boolean; provider: string; permission: string; send: string; cards: Record<string,{on?: boolean}>|null}
/** 本页用到的 AI 状态（d.ai 上的几项） */
interface GuidanceAIState {model: string; draft: string; thread: unknown[]; error: string; attachedNote: {title: string}|null; models: string[]; agent: string}
interface GuidanceUI {aiView: string; modelMenuOpen: boolean; promptCopied: string|null; query: string; prompt: string|null; copy: unknown}
type GD=Model&{settingsR27?: {ai?: GuidanceSettings}};
interface GuidanceArgs {
 data: Model; art: R12Art;
 announce: (message: string, undo?: () => void) => void;
 update: () => void;
 openSettings?: (group: string) => void;
 currentNote?: () => {title: string}|null|undefined;
}
const tgt=(e: Event)=>e.target as HTMLElement;
export function createGuidance({data,art,announce,update,openSettings,currentNote}: GuidanceArgs){
 const d=data as GD,ai=d.ai as ModelAI&GuidanceAIState,ui=d.ui as Model['ui']&GuidanceUI,cache=d.cache as {promptCopyTimer?: number};
 const $=(s: string)=>HOST.querySelector(s) as HTMLElement|null,$i=(s: string)=>HOST.querySelector(s) as HTMLInputElement;
 const provs=()=>HOST.aiProviders?.()||{};
 const PROV=new Proxy<Record<string,[name: string,models: string[]]>>({},{get:(_,k: string)=>provs()[k],has:(_,k)=>k in provs(),ownKeys:()=>Reflect.ownKeys(provs()),getOwnPropertyDescriptor:(_,k)=>{const v=provs()[k as string];return v?{enumerable:true,configurable:true,value:v}:undefined;}});
 const SA=(): GuidanceSettings=>d.settingsR27?.ai||{enabled:true,provider:'claude',permission:'confirm',send:'enter',cards:null};
 const onIds=()=>Object.keys(PROV).filter(id=>SA().cards?SA().cards![id]?.on:true);
 const modelList=()=>onIds().flatMap(id=>PROV[id][1].map(m=>PROV[id][0]+' · '+m));
 const PERM: Record<string,string>={read:'只读',confirm:'改前确认',auto:'自动接受改动'};
 // 手画线：r12 的 L 的描述版（几何相同）建成节点
 const L=(p: Point[],w: number)=>partNodes(parts(art.LV(p,w)));
 ui.prompt=d.prompts[0]?.id||null;ui.aiView='prompt';ai.model=modelList().find(m=>m.startsWith((PROV[SA().provider]||PROV.claude)[0]))||'';ai.draft='';ai.thread=[];ai.error='';ai.attachedNote=null;ai.models=['Claude','GPT','本地模型'];ui.modelMenuOpen=false;
 function select(id: string){ui.prompt=id;ui.aiView='prompt';ui.query='';$i('#prompt-query').value='';render();update();}
 function renderHeader(){if(ui.page!=='ai')ui.modelMenuOpen=false;ai.models=modelList();if(ai.model&&!ai.models.includes(ai.model))ai.model=ai.models[0]||'';if(!SA().enabled){ui.modelMenuOpen=false;setNodes($('#connection')!,()=>[h('span',{class:'g28-off'},'AI 助手已关闭：这里只有提示词库，提示词可以复制'),h('button',{class:'g28-connect hand-pill','data-guidance':'connect','aria-label':'接入 AI 助手'},iconEl('settings',16),h('span',null,'接入 AI 助手'))]);return;}
  setNodes($('#connection')!,()=>[h('div',{class:'native-model'},
    h('button',{id:'model-trigger',class:'native-model-trigger','data-guidance':'model-toggle','aria-label':'选择模型'+(ai.model?'：'+ai.model:''),'aria-haspopup':'listbox','aria-expanded':String(!!ui.modelMenuOpen),'aria-controls':'native-model-list'},h('span',{class:'model-label'},ai.model||'选择模型'),svg('svg',{viewBox:'0 0 12 10','aria-hidden':'true'},L([[2,3],[6,7],[10,3]],1.3))),
    ui.modelMenuOpen&&h('div',{id:'native-model-list',class:'native-model-menu',role:'listbox','aria-label':'选择模型'},svg('svg',{viewBox:'0 0 178 160',preserveAspectRatio:'none','aria-hidden':'true'},L([[5,2],[90,2.3],[173,2],[176,5],[176,155],[173,158],[5,158],[2,155],[2,5],[5,2]],1.4)),
     ['',...ai.models].map(v=>h('button',{role:'option','data-guidance':'model-pick','data-model':v,'aria-selected':String(ai.model===v)},h('span',null,v||'选择模型'),ai.model===v&&iconEl('check',15))))),
   h('span',{class:'native-agent'},ai.agent),h('button',{class:'native-mode','data-guidance':'view','aria-label':ui.aiView==='chat'?'返回提示词':'查看对话'},art.symbolEl(ui.aiView==='chat'?'note':'chat')),h('button',{'data-guidance':'new','aria-label':'新建对话'},iconEl('plus'))]);}
 function closeModelMenu(restore=false){ui.modelMenuOpen=false;$('#native-model-list')?.remove();$('#model-trigger')?.setAttribute('aria-expanded','false');if(restore)$('#model-trigger')?.focus({preventScroll:true});}
 function modelAction(action: string|undefined,b: HTMLElement){if(action==='model-toggle'){ui.modelMenuOpen=!ui.modelMenuOpen;renderHeader();$('#model-trigger')!.focus({preventScroll:true});return true;}if(action==='model-pick'){ai.model=b.dataset.model!;ui.modelMenuOpen=false;ai.error='';if(ai.model)announce('这一段对话改用 '+ai.model+'，设置里的默认值不变');renderHeader();renderError();$('#model-trigger')!.focus({preventScroll:true});return true;}return false;}
 HOST.addEventListener('pointerdown',e=>{if(ui.modelMenuOpen&&!tgt(e).closest('.native-model'))closeModelMenu();},true);
 HOST.addEventListener('focusout',e=>{const rel=(e as FocusEvent).relatedTarget as Node|null;if(ui.modelMenuOpen&&tgt(e).closest('.native-model')&&rel&&!HOST.querySelector('.native-model')?.contains(rel))closeModelMenu();});
 HOST.addEventListener('keydown',e=>{const ke=e as KeyboardEvent,trigger=tgt(e).id==='model-trigger',option=tgt(e).closest<HTMLElement>('#native-model-list [role=option]');if(!trigger&&!option)return;if(ke.key==='Escape'&&ui.modelMenuOpen){e.preventDefault();e.stopImmediatePropagation();closeModelMenu(true);return;}if(trigger&&['ArrowDown','ArrowUp'].includes(ke.key)){e.preventDefault();e.stopImmediatePropagation();ui.modelMenuOpen=true;renderHeader();const options=[...HOST.querySelectorAll('#native-model-list [role=option]')] as HTMLElement[];(options.find(o=>o.getAttribute('aria-selected')==='true')||options[0]).focus();return;}if(option&&['ArrowDown','ArrowUp','Home','End'].includes(ke.key)){e.preventDefault();e.stopImmediatePropagation();const options=[...HOST.querySelectorAll('#native-model-list [role=option]')] as HTMLElement[],i=options.indexOf(option),next=ke.key==='Home'?0:ke.key==='End'?options.length-1:(i+(ke.key==='ArrowDown'?1:-1)+options.length)%options.length;options[next].focus();}},true);

 function render(){
 const p: ModelPrompt|{id: null; title: string; subtitle: string; category: string; risk: number; scope: number[]; body: string}=d.prompts.find(p=>p.id===ui.prompt)||d.prompts[0]||{id:null,title:'还没有提示词',subtitle:'在 潮线/指引/ 下新建一篇笔记',category:'writing',risk:0,scope:[0,0,0,0],body:'每篇笔记是一条提示词：标题、属性 subtitle 与 category，正文是提示词本身。'};
 renderHeader();
 const on=SA().enabled;$('#ai')!.classList.toggle('ai-off',!on);if(!on&&ui.aiView==='chat')ui.aiView='prompt';
 const attached=on&&ai.attachedNote;
 setNodes($('#privacy')!,()=>on&&[h('button',{class:'native-context','data-guidance':'attach','aria-pressed':String(!!attached)},iconEl(attached?'check':'note',17),h('span',null,attached?attached.title:'附带当前笔记')),h('button',{class:'native-permission','data-guidance':'connect','aria-label':`默认权限：${PERM[SA().permission]}，在设置里修改`},h('small',null,'默认权限'),h('span',null,`${PERM[SA().permission]}`))]);
 const warn=on&&(SA().permission==='auto'||attached);
 setNodes($('#search-icon')!,()=>iconEl('search',17));
 setNodes($('#flags')!,()=>[d.prompts.map(p=>h('button',{class:'flag-button','data-guidance-prompt':p.id,'data-flag':p.id,'aria-pressed':String(p.id===ui.prompt),'aria-label':p.title},art.flagEl(p,p.id===ui.prompt),h('span',null,p.title.slice(0,2),h('br'),p.title.slice(2)))),
  warn&&h('button',{class:'g-warn','data-guidance':'connect','aria-label':`提醒：${SA().permission==='auto'?'默认权限是自动接受改动':'自动附带当前页已打开'}，打开设置`},svg('svg',{viewBox:'0 0 30 40','aria-hidden':'true'},L([[4,2],[4,38]],1.6),L([[4,4],[26,10],[4,18],[4,4]],1.3),L([[13,8],[13,12]],1.4),svg('circle',{cx:'13',cy:'14.6',r:'.9',fill:'#1C2A35'})))]);
 const matches=d.prompts.filter(p=>(p.title+p.subtitle+p.body).includes(ui.query||''));
 setNodes($('#prompts')!,()=>matches.length?matches.map(p=>h('button',{class:'native-prompt','data-guidance-prompt':p.id,'aria-pressed':String(p.id===ui.prompt)},art.symbolEl(p.category,24),h('span',null,h('strong',null,p.title),h('small',null,p.subtitle)))):h('button',{class:'native-empty','data-guidance':'clear','aria-label':'清除搜索'},iconEl('search')));
 setNodes($('#native-content')!,()=>{if(ui.aiView==='chat'){const box=h('div',{class:'native-thread',role:'log','aria-label':'对话'});if(ai.thread.length)HOST.ai?.fillThread(box,d);else box.append(h('div',{class:'native-chat-empty'},art.symbolEl('chat',42)));return box;}
  return h('article',{class:'native-preview'},h('div',{class:'native-prompt-title'},art.symbolEl(p.category,30),h('h2',null,p.title)),h('p',{class:'native-subtitle'},p.subtitle),h('div',{class:'native-prompt-body'},p.body.split('\n').map(s=>h('p',null,s))),
   h('div',{class:'native-scope','aria-label':`操作范围：${['读取','追加','修改','删除'].filter((_,i)=>p.scope[i]).join('、')}`},['book','plus','route','box'].map((ic,i)=>h('span',{style:`opacity:${p.scope[i]?1:.18}`},iconEl(ic,20)))),
   h('div',{class:'native-prompt-actions'},h('button',{class:'outline','data-guidance':'copy','aria-label':'复制提示词'},copyFace(ui.promptCopied===p.id)),on&&h('button',{class:'outline','data-guidance':'use','aria-label':'带入对话'},art.symbolEl('chat',17),h('span',null,'带入对话'))));});
 $i('#handoff-input').value=ai.draft;renderError();setNodes($('#native-send')!,()=>art.symbolEl('send',25));
 setNodes($('#handoff-outline')!,()=>L([[5,2],[300,2],[597,2],[599,5],[599,78],[597,81],[5,81],[2,78],[2,5],[5,2]],1.3));
 }
 // The copy confirmation swaps the face in place; the button keeps its measured box.
 function copyFace(done: boolean): Child{return done?[iconEl('check',17),h('span',null,'已复制')]:[art.symbolEl('copy',17),h('span',null,'复制')];}
 async function copy(b: HTMLElement){const p=d.prompts.find(p=>p.id===ui.prompt)!;try{await navigator.clipboard.writeText(p.body);ui.copy=p.body;}catch{announce('浏览器未允许复制，请选中文本后复制。');return;}ui.promptCopied=p.id;b.dataset.copied='true';b.querySelectorAll(':scope>:not(.hand-button-frame)').forEach(e=>e.remove());insertNodes(b,'beforeend',()=>copyFace(true));announce('提示词已复制。');clearTimeout(cache.promptCopyTimer);cache.promptCopyTimer=window.setTimeout(()=>{ui.promptCopied=null;const live=HOST.querySelector('[data-guidance="copy"]') as HTMLElement|null;if(!live)return;delete live.dataset.copied;live.querySelectorAll(':scope>:not(.hand-button-frame)').forEach(e=>e.remove());insertNodes(live,'beforeend',()=>copyFace(false));},1800);}
 function renderError(){$('#native-error')!.hidden=!ai.error;if(ai.error)setNodes($('#native-error')!,()=>[h('span',null,ai.error),h('button',{class:'text-button','data-guidance':'copy-draft'},ai.draft.trim()?'复制草稿':'复制提示词'),ui.aiView==='chat'&&h('button',{class:'text-button','data-guidance':'back'},'返回提示词')]);}
 function send(){ai.draft=$i('#handoff-input').value;if(!SA().enabled)return;if(!ai.draft.trim()){$i('#handoff-input').focus();return;}if(!ai.model){ai.error='先选择模型，草稿已保留。';renderError();announce(ai.error);return;}HOST.ai?.send(ai.draft.trim(),d);ai.draft='';ai.error='';ui.aiView='chat';render();update();$i('#handoff-input').focus();}
 HOST.addEventListener('click',e=>{void (async()=>{const b=tgt(e).closest<HTMLElement>('[data-guidance],[data-guidance-prompt]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(b.dataset.guidancePrompt){if(SA().enabled&&b.classList.contains('flag-button')){ui.prompt=b.dataset.guidancePrompt;ui.query='';$i('#prompt-query').value='';const p=d.prompts.find(p=>p.id===ui.prompt)!;ai.draft=p.body;ui.aiView='chat';ai.error='';render();update();$i('#handoff-input').focus();return;}select(b.dataset.guidancePrompt);return;}const action=b.dataset.guidance;if(action==='connect'){openSettings?.('guidance');return;}if(modelAction(action,b))return;
 if(action==='copy'){await copy(b);return;}
 if(action==='copy-draft'){try{await navigator.clipboard.writeText(ai.draft.trim()?ai.draft:d.prompts.find(p=>p.id===ui.prompt)!.body);announce(ai.draft.trim()?'草稿已复制。':'提示词已复制。');}catch{announce('浏览器未允许复制，请选中文本后复制。');}return;}
 if(action==='back')ui.aiView='prompt';
 if(action==='attach'){if(ai.attachedNote)ai.attachedNote=null;else {const note=currentNote?.();if(!note){announce('当前没有打开的 Markdown 笔记');return;}ai.attachedNote=note;}}
 if(action==='view')ui.aiView=ui.aiView==='chat'?'prompt':'chat';
 if(action==='use'){const p=d.prompts.find(p=>p.id===ui.prompt)!;ai.draft=p.body+(ai.draft?'\n\n'+ai.draft:'');ui.aiView='chat';ai.error='';}
 if(action==='clear'){ui.query='';$i('#prompt-query').value='';}
 if(action==='new'){const old={draft:ai.draft,thread:[...ai.thread]};ai.draft='';ai.thread=[];ai.error='';ui.aiView='chat';announce('已开启一页对话。',()=>{ai.draft=old.draft;ai.thread=old.thread;render();update();});}
 render();update();if(action==='use'||action==='new')$i('#handoff-input').focus();
 })();},true);
 HOST.addEventListener('input',e=>{const t=tgt(e) as HTMLTextAreaElement;if(t.id==='handoff-input'){ai.draft=t.value;if(ai.error){ai.error=ai.draft.trim()?'尚未接入模型服务，草稿已保留。':'尚未接入模型服务。';renderError();}}});
 HOST.addEventListener('keydown',e=>{const ke=e as KeyboardEvent;if(tgt(e).id==='handoff-input'&&ke.key==='Enter'&&!ke.shiftKey&&!ke.isComposing){if(SA().send==='mod'&&!(ke.ctrlKey||ke.metaKey))return;e.preventDefault();send();}});
 return{render,send,select};
}
