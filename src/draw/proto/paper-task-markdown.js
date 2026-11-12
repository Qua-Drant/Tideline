import {marked,Renderer} from './vendor/marked.mjs';
export function taskMarkdown(a,t){
 const {d,esc,button:B,stateMark}=a,root=document.createElement('div');
 const findTitle=title=>[['project',d.projects],['person',d.people],['goal',d.goals],['idea',d.ideas],['literature',d.literature],['book',d.books],['task',d.tasks]].flatMap(([kind,items])=>items.map(item=>({kind,...item}))).find(item=>(item.title||item.name)===title);
 const source=(t.markdown??t.description??'').replace(/\[\[([^\]]+)\]\]/g,(_,name)=>{const item=findTitle(name);return item?`[${name}](#compass:${item.kind}:${item.id})`:name;});
 const renderer=new Renderer();renderer.html=token=>esc(token.text);root.innerHTML=marked.parse(source,{async:false,gfm:true,breaks:false,renderer});
 for(const link of root.querySelectorAll('a')){const href=link.getAttribute('href')||'';if(href.startsWith('#compass:')){const[,kind,id]=href.split(':');link.outerHTML=B('open-object',id,esc(link.textContent),'打开 '+link.textContent,`data-kind="${kind}" class="markdown-link"`);}else if(!/^(https?:|mailto:|#)/i.test(href)){link.removeAttribute('href');}else{link.rel='noopener noreferrer';}}
 let index=0;for(const check of root.querySelectorAll('input[type="checkbox"]')){const label=check.parentElement.textContent.trim(),checked=check.checked;check.outerHTML=B('task-subtask',t.id+'|'+index++,stateMark(checked?'done':'open'),label,`class="markdown-check" aria-pressed="${checked}"`);}
 return root.innerHTML;
}
export function seedTaskMarkdown(d){if(d.cache.taskMarkdownSeeded)return;d.cache.taskMarkdownSeeded=true;const bodies={
 'focus-method':'把三条关键假设写清楚，再核对符号和适用范围。\n\n## 让推理沿着一条线走\n\n先说明**我们比较的是什么**，再交代参考边界来自哪里。实现细节跟在假设后面，避免读者在两种定义之间来回猜。\n\n1. 写出输入、参照与输出各自的含义。\n2. 把适用条件放在方法之前。\n3. 让每一张对照图只回答一个问题。\n\n### 这一轮核对\n\n- [x] 分开屋檐与墙脚的参考定义\n- [ ] 统一图 3 与图 4 的符号\n- [ ] 补上不适用的两类情形\n\n> 先把假设写在纸上，再决定该补哪一张图。\n\n与 [[建筑轮廓对齐]] 对照，保留能够追溯到原始输入的判断。',
 'focus-results':'把对照结果连回同一套输入和参照。\n\n## 比较之前\n\n| 观察 | 先核对什么 |\n| --- | --- |\n| 轮廓整体偏移 | 配准与坐标约定 |\n| 局部边缘不一致 | 屋檐和墙脚的定义 |\n| 小目标断开 | 输入分辨率与覆盖范围 |\n\n- [ ] 保留原始轮廓，不覆盖上一轮结果\n- [ ] 给每张图留一句不带解释的观察\n\n回到 [[论文修改]]，只写证据能够支持的结论。',
 'inbox-01':'先留下一条简短的线索，再决定它属于哪一段工作。\n\n- [ ] 找到对应的输入\n- [ ] 写下需要核对的依据'
 };for(const t of d.tasks)if(t.markdown===undefined&&bodies[t.id])t.markdown=bodies[t.id];
}
