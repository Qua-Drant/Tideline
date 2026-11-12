// Fictional research week, held in the same data object as the original pages.
export function extendData(d){
 Object.assign(d.ui,{taskFilter:{kind:'all'},taskDetail:null,taskMenu:null,taskArchive:false,newList:false,newView:false,projectSelected:null,projectList:false,projectArchive:false,projectMenu:false,newProject:false,reviewPeriod:'day',reviewDay:3,reviewWeek:0,reviewSource:false,wheelMenu:null,librarySelected:null,libraryFilter:null,libraryMenu:false,libraryHover:null,libraryKnot:null,brainSelected:null,brainType:null,brainQuery:'',brainList:false});
 d.lists=[['research','科研推进',false],['life','日常生活',false],['reading','待读整理',false],['course-old','旧课程',true]].map(([id,title,archived])=>({id,title,archived}));
 d.people=[['lin','林老师','林','先把假设讲清楚，再决定补哪组实验。'],['zhou','周宁','周','参考边界要把屋檐和墙脚分开核对。'],['chen','陈晗','陈','把最小复现需要的输入再缩小一层。']].map(([id,name,initial,text],i)=>({id,name,initial,history:[{date:['2026-10-22','2026-10-27','2026-10-26'][i],text}]}));
 d.projects=[
 {id:'p-paper',title:'论文修改',status:'active',due:'2026-11-18',goalIds:['goal-paper'],peopleIds:['lin','zhou'],ideaIds:['idea-assumption','idea-h16'],literatureIds:['lit-01','lit-04','lit-07'],stations:[['厘清问题与假设','done'],['整理关键对照','done'],['写顺方法论证','in_progress'],['收紧局限与结论','open']],description:'把问题、假设、方法和证据放到同一条论证线上。'},
 {id:'p-align',title:'建筑轮廓对齐',status:'active',due:'2026-11-12',goalIds:['goal-paper'],peopleIds:['zhou','chen'],ideaIds:['idea-error','idea-confidence'],literatureIds:['lit-02','lit-03','lit-08'],stations:[['核对坐标与参考线','done'],['归组失败来源','in_progress'],['复跑边界对照','open'],['整理可复现记录','open']],description:'先解释错位从哪里来，再比较方法带来的变化。'},
 {id:'p-health',title:'恢复跑步节律',status:'active',due:'2026-11-15',goalIds:['goal-body'],peopleIds:[],ideaIds:['idea-walk'],literatureIds:[],stations:[['保护两段散步时间','done'],['找回轻松配速','in_progress'],['稳定每周三次','open']],description:'先恢复轻松而持续的节律，不急着增加距离。'},
 {id:'p-dataset',title:'冬季样本整理',status:'planned',due:'2026-12-08',goalIds:['goal-paper'],peopleIds:['chen'],ideaIds:['idea-h02'],literatureIds:['lit-05'],stations:[],description:'从能推翻假设的样本开始整理下一轮数据。'},
 {id:'p-reading',title:'研究方法重读',status:'paused',resume:'2026-11-09',goalIds:['goal-review'],peopleIds:['lin'],ideaIds:['idea-h04'],literatureIds:['lit-06'],stations:[['整理阅读问题','done'],['写章节观察','open']],description:'先保护论文写作，11月9日回到阅读问题。'},
 {id:'p-post',title:'秋季组会海报',status:'completed',completed:'2026-10-23',goalIds:['goal-paper'],peopleIds:['zhou'],ideaIds:['idea-h09'],literatureIds:['lit-04'],stations:[['整理图与问题','done'],['完成海报','done']],description:'每张对照图只回答一个明确问题。'},
 {id:'p-mail',title:'复现实验交接',status:'completed',completed:'2026-10-16',goalIds:[],peopleIds:['chen'],ideaIds:['idea-h17'],literatureIds:['lit-03'],stations:[['交付最小输入','done']],description:'把复现输入、运行条件和判断依据一起留下。'},
 {id:'p-course',title:'空间分析课程',status:'archived',completed:'2026-07-04',goalIds:[],peopleIds:['lin'],ideaIds:[],literatureIds:[],stations:[],description:'保留课程笔记与一次完整的空间分析练习。'}];
 d.projects.forEach(p=>p.stations=p.stations.map(([title,state],i)=>({id:'s'+i,title,state})));
 const titles={'论文修改':'p-paper','建筑轮廓对齐':'p-align','身体健康':'p-health'};
 for(const t of d.tasks){t.projectId=titles[t.project]||null;t.listId=t.projectId?'research':t.id==='sat'?'reading':'life';t.peopleIds=[];t.priority='medium';if(t.status==='done')t.completed=t.date;}
 for(const[id,extra]of [['focus-method',{priority:'highest',peopleIds:['lin']}],['focus-results',{priority:'high',peopleIds:['zhou']}],['meeting-questions',{discuss:true,peopleIds:['lin'],priority:'high'}],['fri',{discuss:true,peopleIds:['lin'],repeat:'每周'}],['backup',{repeat:'每周'}],['focus-run',{repeat:'每周三次'}]])Object.assign(d.tasks.find(t=>t.id===id),extra);
 ['记下屋檐参考线的疑问','查一查新数据的覆盖范围','联系图书馆预约的书','试一条河边的新跑步路线','整理最近保存的阅读线索','给下个月留一段整块时间'].forEach((title,i)=>d.tasks.push({id:'inbox-0'+(i+1),title,date:null,status:'open',listId:null,projectId:null,peopleIds:[],priority:i===1?'high':'medium'}));
 d.tasks.push({id:'talk-zhou',title:'请周宁核对两处屋檐参考线',date:'2026-10-30',status:'open',listId:'research',projectId:'p-align',peopleIds:['zhou'],discuss:true,priority:'high'},{id:'talk-chen',title:'和陈晗确认最小复现输入',date:'2026-10-30',status:'open',listId:'research',projectId:'p-align',peopleIds:['chen'],discuss:true,priority:'medium'},{id:'talk-chen2',title:'询问冬季样本的来源记录',date:null,status:'open',listId:'research',projectId:'p-dataset',peopleIds:['chen'],discuss:true,priority:'medium'},{id:'read-boundary',title:'重读边界误差的评价口径',date:'2026-10-31',status:'open',listId:'reading',projectId:'p-reading',peopleIds:[],priority:'medium'},{id:'old-course-task',title:'整理课程最后一次练习',date:'2026-07-04',completed:'2026-07-04',status:'done',listId:'course-old',projectId:'p-course',peopleIds:[],priority:'low'});
 d.savedViews=[{id:'v-writing',title:'连续写作',filter:{kind:'project',id:'p-paper'}},{id:'v-talk',title:'见面之前',filter:{kind:'discuss'}}];d.meetingPreparations=[];
 d.literature=[
 ['lit-01','论证与研究设计','deep-done','先说明问题与假设，方法的选择才有可检验的依据。',['p-paper'],'2026-10-27'],
 ['lit-02','多源建筑轮廓的对齐','to-deep','对齐误差需要分开报告配准偏移与边界定义差异。',['p-align']],
 ['lit-03','边界误差的稳健评价','deep-done','单一平均距离会掩盖局部失败，分布和分组同样重要。',['p-align','p-mail'],'2026-10-29'],
 ['lit-04','一张图只回答一个问题','skimmed','图的组织应跟随判断任务，而不是素材的先后顺序。',['p-paper','p-post']],
 ['lit-05','困难样本与覆盖偏差','inbox','困难样本的来源与覆盖范围需要先于精度比较被交代。',['p-dataset']],
 ['lit-06','定性研究中的可追溯性','skimmed','保留判断路径，比事后补一套漂亮分类更可靠。',['p-reading']],
 ['lit-07','写作中的不确定性','to-deep','把观察、解释与承诺分开，可以让结论保持准确。',['p-paper']],
 ['lit-08','遥感轮廓的尺度效应','inbox','不同尺度下的参考线并不天然代表同一处物理边界。',['p-align']],
 ['lit-09','复现实验的最小单元','skimmed','最小复现应保留产生差异所必需的输入和判断口径。',['p-mail']],
 ['lit-10','空间样本的外推边界','inbox','对外推范围的描述应和样本覆盖一起阅读。',['p-dataset']],
 ['lit-11','旧城瓦片分割','dropped','输入尺度与当前问题差异较大，暂不继续。',[]],
 ['lit-12','早期边界模型','dropped','评价口径无法与当前对照统一，保留线索。',[]]
 ].map(([id,title,stage,conclusion,projectIds,readDate])=>({id,title,stage,conclusion,projectIds,readDate}));
 d.books=[['book-01','研究是一门艺术','reading','把问题缩小到能用证据回答的范围。',['p-reading']],['book-02','写作的感觉','done','让读者看见具体对象，也看见推理如何发生。',['p-paper'],'2026-10-18'],['book-03','统计学的世界','want','重新区分数据中的差异与判断中的不确定。',['p-align']],['book-04','深度工作','done','为重要问题保护连续而有限的时间。',[],'2026-09-21'],['book-05','看不见的城市','want','给观察保留另一种组织方式。',[]]].map(([id,title,stage,conclusion,projectIds,readDate])=>({id,title,stage,conclusion,projectIds,readDate}));
 d.review={weekDates:['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01'],trend:[16,22,18,21,25,17,28,23,19,26,24,5],days:[
 {date:'2026-10-26',habits:[true,true,true,false],questions:[7,6],investments:[{id:'paper',title:'论文修改',hours:2},{id:'reading',title:'阅读与整理',hours:.5}],journal:[{time:'10:18',text:'先把参考线落在哪里核对清楚。'}],achievements:['把两种参考线分开归了类。'],gratitude:['陈晗帮忙找回了那组旧输入。'],quote:'把问题缩小之后，反而知道该查什么了。'},
 {date:'2026-10-27',habits:[true,false,true,true],questions:[8,7],investments:[{id:'paper',title:'论文修改',hours:2.5}],journal:[{time:'16:24',text:'把失败样本按来源排，比按误差排更有用。'}],achievements:['找到一处可以稳定复现的差异。'],gratitude:['周宁耐心核对了那两条参考边界。'],quote:'不急着修好，先讲清楚它为什么失败。'},
 {date:'2026-10-28',habits:[true,true,false,true],questions:[6,8],investments:[{id:'paper',title:'论文修改',hours:1.75},{id:'reading',title:'阅读与整理',hours:1}],journal:[{time:'18:07',text:'给每张对照图留一句不带解释的观察。'}],achievements:['方法流程图少了一层多余的分支。'],gratitude:['林老师提醒我先说清适用条件。'],quote:'删掉旁枝之后，真正缺的那一步才显出来。'},
 {date:'2026-10-29',achievements:['把三条关键假设写成了可讨论的句子。'],gratitude:['周宁指出了屋檐和墙脚的区别。'],quote:d.weekly},
 ...['2026-10-30','2026-10-31','2026-11-01'].map(date=>({date,habits:[null,null,null,null],questions:[null,null],investments:[],journal:[],achievements:[],gratitude:[],quote:''}))
 ],wheel:[['health','身体健康',7],['research','研究与学习',8],['family','家人与朋友',6],['rest','休息与玩耍',null],['home','生活环境',7],['finance','财务安排',6],['growth','个人成长',8],['contribution','连接与贡献',null]].map(([id,title,value])=>({id,title,value})),quarterText:'这一季先把论文的论证讲清楚，也保护跑步和见面的时间。空着的领域留到有具体感受时再填。'};
 d.goals.forEach(g=>g.projectIds=d.projects.filter(p=>p.goalIds.includes(g.id)).map(p=>p.id));for(const i of d.ideas)i.projectIds=d.projects.filter(p=>p.ideaIds.includes(i.id)).map(p=>p.id);
 d.graphDefault={goal:['goal-paper','goal-body','goal-review'],idea:['idea-assumption','idea-error','idea-confidence','idea-walk'],project:['p-paper','p-align','p-health','p-dataset','p-reading'],task:['focus-method','focus-results','focus-run','talk-chen'],literature:['lit-01','lit-02','lit-03','lit-06'],person:['lin','zhou','chen'],book:['book-01','book-02']};
}
