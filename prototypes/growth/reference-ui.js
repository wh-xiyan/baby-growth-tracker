/* Prototype extension. Official table nodes are never extrapolated. */
let referenceEnabled=true, referenceDetail=false;
const referenceSex={a:'male',b:'female'};
function monthAge(date,birthday=babies[baby].birthday){
 const d=new Date(date.slice(0,10)+'T00:00:00Z'),b=new Date(birthday+'T00:00:00Z');
 let m=(d.getUTCFullYear()-b.getUTCFullYear())*12+d.getUTCMonth()-b.getUTCMonth();
 const anchor=new Date(Date.UTC(b.getUTCFullYear(),b.getUTCMonth()+m,Math.min(b.getUTCDate(),new Date(Date.UTC(b.getUTCFullYear(),b.getUTCMonth()+m+1,0)).getUTCDate())));
 if(d<anchor)m--;
 const at=n=>new Date(Date.UTC(b.getUTCFullYear(),b.getUTCMonth()+n,Math.min(b.getUTCDate(),new Date(Date.UTC(b.getUTCFullYear(),b.getUTCMonth()+n+1,0)).getUTCDate())));
 return {whole:m,exact:m+(d-at(m))/(at(m+1)-at(m))};
}
function referenceRows(key=metric){return GROWTH_STANDARD.data[referenceSex[babies[baby].id]]?.[key]||[]}
function referenceStatus(r,key=metric){
 const age=monthAge(r.when),rows=referenceRows(key);
 if(!referenceSex[babies[baby].id])return {reason:'宝宝档案尚未填写性别，暂不匹配参考表。实测记录照常保留。'};
 if(age.exact<0||age.exact>=84)return {reason:'该次测量不在出生至未满7周岁的适用范围内，仅展示实测记录。'};
 if(key==='headCircumference'&&age.exact>36)return {reason:'头围参考表覆盖0～3岁；这次测量超出表格范围，仅展示实测记录。'};
 if(key==='height'&&r.method!==(age.whole<24?'lying':'standing'))return {reason:age.whole<24?'此年龄参考表使用卧位身长，本条测量方法为'+(methods[r.method]||'未记录')+'，暂不对照，请核对测量方法。':'此年龄参考表使用站立身高，本条测量方法为'+(methods[r.method]||'未记录')+'，暂不对照，请核对测量方法。'};
 const row=rows.find(x=>x[0]===age.whole);
 if(!row)return {reason:'标准未列出'+age.whole+'整月龄的独立数值。本原型不插值计算百分位，参考相邻节点，并保留实测值。'};
 const value=r[key],p=[3,10,25,50,75,90,97];let pos;
 if(value<row[1])pos='低于 P3';else if(value>row[7])pos='高于 P97';else {const eq=row.slice(1).findIndex(v=>v===value);if(eq>=0)pos='位于 P'+p[eq];else {const i=row.slice(1).findIndex(v=>v>value);pos='位于 P'+p[i-1]+'—P'+p[i]+' 之间'}}
 return {row,age,pos,sex:referenceSex[babies[baby].id]==='male'?'男童':'女童',table:GROWTH_STANDARD.tables[referenceSex[babies[baby].id]][key]};
}
function toggleReference(){referenceEnabled=!referenceEnabled;render()}
function referenceSummary(r){
 const s=referenceStatus(r);if(s.reason)return `<p class="ref-alert">${esc(s.reason)}</p>`;
 return `<div class="ref-position">${s.pos}</div><p class="hint">按测量时${s.age.whole}整月龄 · ${s.sex} · 表${s.table}对照；不是精确百分位计算。</p><div class="ref-values"><span>P3<strong>${s.row[1]}${units[metric]}</strong></span><span>P50<strong>${s.row[4]}${units[metric]}</strong></span><span>P97<strong>${s.row[7]}${units[metric]}</strong></span></div><p class="hint">百分位描述群体中的位置，不代表成长评分。${s.pos.includes('低于')||s.pos.includes('高于')?'建议先核对测量数据与方法，携带连续记录咨询儿保医生。':'结合连续变化与儿保随访观察，不以单次记录判断健康状况。'}</p>`;
}
function growthChart(rs){
 const focus=rs.find(r=>r.id===point)||rs[0],sex=referenceSex[babies[baby].id];
 return `<div class="ref-heading"><h2>生长曲线</h2><button class="ref-switch" type="button" role="switch" aria-checked="${referenceEnabled}" onclick="toggleReference()">标准参考 ${referenceEnabled?'已开启':'已关闭'}</button></div><div class="ref-source"><strong>卫健委 · 7岁以下儿童生长标准</strong><span>WS/T 423—2022 · ${sex?(sex==='male'?'男童':'女童')+'参考表':'待补充性别'}</span><button class="text-link" onclick="openReferenceInfo()">参考依据与设置 ›</button></div>${referenceEnabled?`<div class="ref-options"><span>参考线</span><button class="chip ${!referenceDetail?'active':''}" onclick="referenceDetail=false;render()">简洁 · 3条</button><button class="chip ${referenceDetail?'active':''}" onclick="referenceDetail=true;render()">完整 · 7条</button></div>`:''}${rs.length?`<canvas class="chart reference-chart" id="chart" width="760" height="520" role="img" aria-label="${metricLabels[metric]}生长曲线；下方可选择测量点查看数值与标准对照"></canvas><div class="ref-legend"><span class="actual-legend">宝宝实测 · 实线</span>${referenceEnabled?'<span>标准参考 · 虚线</span><span>P50为中位数</span>':''}</div><p class="hint">横轴：测量时月龄；日期范围沿用上方筛选。参考虚线只连接标准原始节点，不作预测。${metric==='height'?'身长/身高在24月龄处分开绘制；不同测量方式的实测点不连线。':''}</p><div class="point-pills">${rs.slice().reverse().map(r=>`<button class="chip ${focus?.id===r.id?'active':''}" onclick="point='${r.id}';render()">${r.when.slice(5,10)} · ${r[metric]}${units[metric]}</button>`).join('')}</div><section class="ref-insight"><span class="eyebrow">${point?'所选测量':'本范围最近测量'}</span><h3>${focus[metric]} ${units[metric]} <span class="count">${focus.when.slice(0,10)} · ${monthAge(focus.when).whole}个月</span></h3>${referenceEnabled?referenceSummary(focus):'<p class="hint">已隐藏标准参考，仅查看宝宝的实测变化。</p>'}<button class="text-link" onclick="detail('${focus.id}')">查看这条测量记录 ›</button></section>`:'<div class="empty"><strong>这段时间没有测量记录</strong>扩大日期范围或记录一次测量后，即可对照标准。</div>'}<p class="hint">${metric==='weight'?'年龄别体重不等于营养状况判定，不能仅凭这张曲线判断超重或肥胖。':metric==='headCircumference'?'本指标仅使用标准内0～3岁头围参考表，超出范围不延伸参考线。':'2岁以下参考卧位身长，2岁至未满7岁参考站立身高。'}参考线不是必须达到的目标线。</p><button class="text-link" onclick="view='history';render()">查看测量历史 ›</button>`;
}
function openReferenceInfo(){
 let el=$('#reference-dialog');if(!el){el=document.createElement('dialog');el.id='reference-dialog';document.body.appendChild(el)}
 el.innerHTML=`<div class="modal"><h2>这张曲线如何参考？</h2><p class="muted">沿着宝宝自己的节奏，观察持续的变化。</p><h3>标准来源</h3><p>国家卫生健康委员会《7岁以下儿童生长标准》，WS/T 423—2022，2023年3月1日实施。本原型使用附录A的百分位数原始表值。</p><a href="reference-standard.pdf" target="_blank" rel="noopener">查看标准原文 PDF</a><h3 class="subsection">匹配宝宝档案</h3><label for="reference-sex">性别（原型模拟设置，仅用于参考表匹配）</label><select id="reference-sex" onchange="referenceSex[babies[baby].id]=this.value;point=null;render()"><option value="male" ${referenceSex[babies[baby].id]==='male'?'selected':''}>男童</option><option value="female" ${referenceSex[babies[baby].id]==='female'?'selected':''}>女童</option><option value="" ${!referenceSex[babies[baby].id]?'selected':''}>未填写</option></select><p class="hint">实际产品从宝宝档案读取性别、出生日期；本页不提供临时切换参考性别。不同性别沿用同一界面配色。</p><h3 class="subsection">怎样理解 P50？</h3><p>P50是参考群体的中位数，P3、P97也是分布位置。不是合格线、目标线，也不是宝宝的成长评分。</p><h3 class="subsection">范围与测量方法</h3><p>身长/身高、体重适用于出生至未满7岁；头围表列0～3岁。2岁以下用卧位身长，2岁起用站立身高。测量方法不符时保留记录，但暂不进行参考对照，不自动换算数值。</p><h3 class="subsection">数据展示规则</h3><p>测量点按实际月龄定位；数值对照按整月龄查表。只显示原文列出的参考节点，虚线连接不作为精确插值。没有对应整月龄节点时不输出百分位区间；不会外推超出表格末端的数据。</p><p class="hint">家庭测量可存在误差。营养与健康状况需结合其他指标及专业评估，不从年龄别体重直接判断肥胖。</p><button class="primary" onclick="document.querySelector('#reference-dialog').close()">知道了</button></div>`;el.showModal();
}
function drawReferenceChart(){
 const c=$('#chart');if(!c)return;const ctx=c.getContext('2d');
 const rs=current().filter(r=>r.kind==='measurement'&&r[metric]!=null&&within(r)).reverse();if(!rs.length)return;
 const rows=referenceEnabled?referenceRows():[],ages=rs.map(r=>monthAge(r.when).exact);
 const min=Math.max(0,Math.min(...ages)-1),max=Math.max(min+2,Math.max(...ages)+1);
 const visible=rows.filter((r,i)=>r[0]>=min&&r[0]<=max||(r[0]<min&&rows[i+1]?.[0]>min)||(r[0]>max&&rows[i-1]?.[0]<max));
 const vals=[...rs.map(r=>r[metric]),...visible.flatMap(r=>[r[1],r[7]])],pad=(Math.max(...vals)-Math.min(...vals))*.12||1;
 const lo=Math.min(...vals)-pad,hi=Math.max(...vals)+pad,x=m=>70+(m-min)/(max-min)*605,y=v=>420-(v-lo)/(hi-lo)*365;
 ctx.clearRect(0,0,760,520);ctx.font='22px sans-serif';ctx.textAlign='right';ctx.fillStyle='#778279';ctx.lineWidth=1;
 for(let i=0;i<5;i++){const v=lo+(hi-lo)*i/4,yy=y(v);ctx.strokeStyle='#e6e8de';ctx.beginPath();ctx.moveTo(70,yy);ctx.lineTo(675,yy);ctx.stroke();ctx.fillText(v.toFixed(1),60,yy+7)}
 ctx.fillText(units[metric],60,30);ctx.textAlign='center';
 for(let i=0;i<4;i++){const m=min+(max-min)*i/3;ctx.fillText(m.toFixed(1),x(m),465)}ctx.fillText('测量时月龄（月）',380,505);
 ctx.save();ctx.beginPath();ctx.rect(70,45,605,380);ctx.clip();
 const columns=referenceDetail?[1,2,3,4,5,6,7]:[1,4,7];
 for(const col of columns){ctx.strokeStyle=col===4?'#94aa83':'#bec7b2';ctx.lineWidth=col===4?3:2;ctx.setLineDash([9,7]);ctx.beginPath();let prev=null;for(const r of visible){if(prev&&!(metric==='height'&&prev[0]<24&&r[0]>=24))ctx.lineTo(x(r[0]),y(r[col]));else ctx.moveTo(x(r[0]),y(r[col]));prev=r}ctx.stroke()}
 ctx.setLineDash([]);ctx.strokeStyle='#496f56';ctx.lineWidth=4;ctx.beginPath();
 const pts=rs.map(r=>({r,x:x(monthAge(r.when).exact),y:y(r[metric])}));
 pts.forEach((p,i)=>{const prev=pts[i-1],changed=metric==='height'&&prev&&(prev.r.method!==p.r.method||(monthAge(prev.r.when).whole<24)!==(monthAge(p.r.when).whole<24));if(i&&!changed)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y)});ctx.stroke();
 pts.forEach(p=>{ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,p.y,p.r.id===(point||rs.at(-1).id)?9:6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#496f56';ctx.lineWidth=4;ctx.stroke()});ctx.restore();
 if(visible.length){const last=visible.at(-1);ctx.textAlign='left';ctx.font='19px sans-serif';for(const col of columns){ctx.fillStyle=col===4?'#71865f':'#86917c';ctx.fillText('P'+[0,3,10,25,50,75,90,97][col],690,y(last[col])+6)}}
 c.onclick=e=>{const rect=c.getBoundingClientRect(),xx=(e.clientX-rect.left)/rect.width*760,yy=(e.clientY-rect.top)/rect.height*520;const near=pts.map(p=>({...p,d:Math.hypot(xx-p.x,yy-p.y)})).sort((a,b)=>a.d-b.d)[0];if(near?.d<50){point=near.r.id;render()}};
}
