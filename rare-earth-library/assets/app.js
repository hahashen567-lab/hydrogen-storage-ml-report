/* Application source. Plotly.js 3.1.1 (MIT), unchanged, is kept in vendor/. */
(() => {
  'use strict';
  const data = window.MATERIALS_DATA;
  const elements = window.MATERIAL_ELEMENTS;
  const $ = id => document.getElementById(id);
  if (!data || !elements) {
    $('dataset-summary').textContent = '数据未加载：请将整个代码包解压后打开 index.html。';
    return;
  }
  const elementMap = new Map(elements.map(e => [e.symbol, e]));
  const recordMap = new Map(data.records.map(r => [r.id, r]));
  const state = { elements: [], mode: 'contains', page: 1, pageSize: 20, selected: null, repeat: 1, viewer: null, results: data.records };
  const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formula = text => esc(text).replace(/(\d+(?:\.\d+)?)/g, '<sub>$1</sub>');
  const fmt = (value, digits = 4) => value == null ? '—' : Number(value).toFixed(digits);
  const systems = {triclinic:'三斜',monoclinic:'单斜',orthorhombic:'正交',tetragonal:'四方',trigonal:'三方',hexagonal:'六方',cubic:'立方'};
  const colors = {H:'#efb02d',Sc:'#e5984a',Y:'#ac78b7',La:'#ad72bd',Ce:'#d69b53',Pr:'#7cab66',Nd:'#659f88',Pm:'#b0aa54',Sm:'#db8a72',Eu:'#ae72ac',Gd:'#65a577',Tb:'#a3b85d',Dy:'#55aaa6',Ho:'#c79b53',Er:'#cf7c9f',Tm:'#608fb6',Yb:'#b4a75e',Lu:'#8e79b0',Ni:'#258fbb',Co:'#497fbb',Fe:'#cc735a',Mg:'#22a98e',Al:'#8aa4bf',Ge:'#5c7fc0',As:'#4c9c91',Ac:'#637fa9',Si:'#be9850',Pt:'#7b8fa9',Pd:'#6b9fb3',Rh:'#4c9d9d',Ru:'#5e8aa9',Ca:'#9bb45c',Sb:'#a06caa',Bi:'#9478a9',Cu:'#d68b51'};
  const fallbackColors = ['#628eb5','#a277bb','#c58d5e','#76a573','#bd729c','#4fa6a2','#b6a047','#8d8fa8'];
  const color = symbol => colors[symbol] || fallbackColors[elementMap.get(symbol).number % fallbackColors.length];

  function matches(record, selected, mode) {
    return selected.every(symbol => record.elements.includes(symbol)) && (mode !== 'exact' || !selected.length || record.elements.length === selected.length);
  }

  function parseInput(text) {
    const trimmed = text.trim();
    if (!trimmed) return [];
    const tokens = trimmed.split(/[\s,，、;；+\-]+/).filter(Boolean);
    const parsed = [];
    for (const token of tokens) {
      if (/^[A-Z][a-z]?$/.test(token) && elementMap.has(token)) { parsed.push(token); continue; }
      const normalized = token[0].toUpperCase() + token.slice(1).toLowerCase();
      if (/^[a-z]{1,2}$/.test(token) && elementMap.has(normalized)) { parsed.push(normalized); continue; }
      const parts = token.match(/[A-Z][a-z]?/g);
      if (!parts || parts.join('') !== token || parts.some(s => !elementMap.has(s))) throw new Error(`无法识别“${token}”。请使用元素符号，例如 La、Ni、H；无需输入计量数。`);
      parsed.push(...parts);
    }
    return [...new Set(parsed)];
  }

  function setError(message = '') {
    $('search-error').textContent = message;
    $('search-error').hidden = !message;
    $('element-input').setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function buildPeriodicTable() {
    const max = Math.max(...Object.values(data.counts));
    const html = [];
    for (let col=1;col<=18;col++) html.push(`<span class="group-label" style="grid-row:1;grid-column:${col}">${col}</span>`);
    for (const e of elements) {
      const count = data.counts[e.symbol] || 0;
      const strength = count ? .13 + .48 * Math.sqrt(count / max) : 0;
      const rgb = e.rare ? [204,146,83] : [102,149,181];
      const bg = `rgb(${rgb.map(v => Math.round(255 + (v-255)*strength)).join(',')})`;
      const row = e.row + 1;
      html.push(`<button type="button" class="element ${e.rare ? 'rare' : ''} ${count ? '' : 'absent'}" data-element="${e.symbol}" style="grid-row:${row};grid-column:${e.col};--el-bg:${bg}" aria-label="${esc(e.name)} ${e.symbol}，${count} 个条目" aria-pressed="false" title="${esc(e.name)} · ${e.symbol}\n${count} 个独立条目" ${count ? '' : 'disabled'}><span class="atomic-number">${e.number}</span><span class="symbol">${e.symbol}</span><span class="frequency">${count || '—'}</span></button>`);
    }
    html.push('<span class="series-placeholder" style="grid-column:3;grid-row:7">57–71<br>↙</span><span class="series-placeholder" style="grid-column:3;grid-row:8">89–103<br>↙</span><span class="series-label" style="grid-row:10">镧系 →</span><span class="series-label" style="grid-row:11">锕系 →</span>');
    $('periodic-table').innerHTML = html.join('');
    $('periodic-table').addEventListener('click', event => {
      const button = event.target.closest('[data-element]');
      if (!button || button.disabled) return;
      const symbol = button.dataset.element;
      let input;
      try { input = parseInput($('element-input').value); } catch (error) { setError(error.message); return; }
      const merged = [...new Set([...state.elements, ...input])];
      state.elements = merged.includes(symbol) ? merged.filter(e => e !== symbol) : [...merged, symbol];
      $('element-input').value = '';
      setError();
      applyFilter();
    });
  }

  function renderChips() {
    $('element-chips').innerHTML = state.elements.map(e => `<button type="button" class="chip" data-remove="${e}" aria-label="移除 ${e}">${e}<span aria-hidden="true">×</span></button>`).join('');
    $('element-input').placeholder = state.elements.length ? '继续添加元素…' : '选择下方元素，或输入 La、Ni、H';
    document.querySelectorAll('[data-element]').forEach(button => {
      const selected = state.elements.includes(button.dataset.element);
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function applyFilter(notify = true) {
    state.results = data.records.filter(r => matches(r, state.elements, state.mode));
    state.page = 1;
    renderChips();
    renderResults();
    selectRecord(state.results.some(r => r.id === state.selected) ? state.selected : state.results[0]?.id || null);
    if (notify) emit('filter', {elements:[...state.elements], mode:state.mode, count:state.results.length});
  }

  function renderResults() {
    const count = state.results.length;
    const pages = Math.max(1, Math.ceil(count/state.pageSize));
    state.page = Math.min(state.page, pages);
    const start = (state.page-1)*state.pageSize;
    const rows = state.results.slice(start, start+state.pageSize);
    $('result-count').textContent = `${count.toLocaleString()} 条`;
    $('empty-state').hidden = count !== 0;
    document.querySelector('.table-scroll').hidden = count === 0;
    $('results-body').innerHTML = rows.map((r,i) => {
      const structure = data.structures[r.structure];
      const sym = structure?.symmetry;
      const isChild = r.kind === 'hydride';
      const boundary = i > 0 && r.group !== rows[i-1].group;
      return `<tr class="material-row ${state.selected===r.id ? 'active' : ''} ${boundary ? 'group-start' : ''}" data-record="${esc(r.id)}" aria-selected="${state.selected===r.id}"><td><button class="formula-button" aria-label="查看 ${esc(r.formula)} 结构">${isChild ? '<span class="child-arrow" aria-hidden="true">↳</span>' : ''}<span>${formula(r.formula)}</span><span class="row-kind ${isChild ? 'hydride' : ''}">${isChild ? '氢化物' : '母体'}</span></button></td><td>${sym ? esc(sym.symbol)+' <small class="section-note">'+sym.number+'</small>' : structure ? '未识别' : '—'}</td><td class="${r.formationEnergy<0 ? 'energy-negative' : ''}">${fmt(r.formationEnergy)}</td><td class="${r.hydrogenationEnergy<0 ? 'energy-negative' : ''}">${fmt(r.hydrogenationEnergy)}</td><td>${fmt(r.hOverM,2)}</td><td>${structure ? '<span class="view-action">查看晶胞 ↗</span>' : '<span class="missing-inline">CIF 缺失</span>'}</td></tr>`;
    }).join('');
    $('page-summary').textContent = count ? `显示 ${start+1}–${Math.min(start+state.pageSize,count)} 条，共 ${count.toLocaleString()} 条` : '0 条匹配结果';
    $('page-number').textContent = `${state.page} / ${pages}`;
    $('prev-page').disabled = state.page===1;
    $('next-page').disabled = state.page===pages;
    document.querySelector('.table-scroll').scrollTop=0;
  }

  function selectRecord(id) {
    const record = recordMap.get(id);
    state.selected = record ? id : null;
    document.querySelectorAll('[data-record]').forEach(row => {
      row.classList.toggle('active', row.dataset.record===id);
      row.setAttribute('aria-selected', String(row.dataset.record===id));
    });
    $('detail-formula').innerHTML = record ? formula(record.formula) : '请选择材料';
    $('detail-id').textContent = record ? record.materialId : '筛选并选择一个条目以查看结构';
    $('selected-kind').textContent = record ? record.kind==='parent' ? '母体合金' : '氢化物' : '';
    $('related-records').innerHTML = record ? data.records.filter(r => r.group===record.group && matches(r,state.elements,state.mode)).map(r => `<button type="button" data-related="${esc(r.id)}" class="${r.id===id ? 'current' : ''}" aria-label="切换到 ${esc(r.formula)}">${formula(r.formula)}</button>`).join('') : '';
    const s = record && data.structures[record.structure];
    const props = [];
    if (record) {
      props.push(['形成能',`${fmt(record.formationEnergy)} eV/atom`]);
      if (record.kind==='hydride') {
        props.push(['氢化能',`${fmt(record.hydrogenationEnergy)} eV/H`],['氢化能换算',`${fmt(record.hydrogenationKJ,2)} kJ/mol H₂`],['氢 / 非氢原子比 H/M',fmt(record.hOverM,3)]);
      }
      if (s) {
        props.push(['晶系 / 空间群',s.symmetry ? `${systems[s.symmetry.system]} / ${s.symmetry.symbol} (${s.symmetry.number})` : '未识别'],['a / b / c',s.lengths.map(v=>fmt(v,3)).join(' / ')+' Å'],['α / β / γ',s.angles.map(v=>fmt(v,2)).join(' / ')+'°'],['晶胞体积',fmt(s.volume,2)+' Å³'],['密度',fmt(s.density,3)+' g/cm³'],['晶胞位点数',String(s.sites)]);
      } else props.push(['结构文件','当前数据包中缺失']);
      if (record.hullEnergy!=null) props.push(['凸包距离',fmt(record.hullEnergy)+' eV/atom']);
    }
    $('detail-properties').innerHTML = props.map(([name,value])=>`<dt>${esc(name)}</dt><dd>${esc(value)}</dd>`).join('');
    $('download-cif').disabled = !s;
    state.repeat = 1;
    updateRepeatButtons();
    drawStructure(true);
    if (record) emit('select',{id:record.id,formula:record.formula,kind:record.kind,materialId:record.materialId,hasStructure:!!s});
  }

  function updateRepeatButtons() {
    document.querySelectorAll('[data-repeat]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.repeat)===state.repeat)));
  }

  function showViewerMessage(message) {
    $('viewer-message').textContent=message;
    $('viewer-message').hidden=!message;
  }

  let renderRevision = 0;
  const defaultCamera = {eye:{x:1.45,y:1.55,z:1.1},center:{x:0,y:0,z:0},up:{x:0,y:0,z:1},projection:{type:'perspective'}};

  // One smooth sphere template, instanced into each element's mesh using actual atomic centers.
  function sphereTemplate() {
    const latitudes=16,longitudes=24,vertices=[[0,0,1]],faces=[];
    for(let row=1;row<latitudes;row++)for(let col=0;col<longitudes;col++){
      const theta=Math.PI*row/latitudes,phi=2*Math.PI*col/longitudes;
      vertices.push([Math.sin(theta)*Math.cos(phi),Math.sin(theta)*Math.sin(phi),Math.cos(theta)]);
    }
    const south=vertices.length;vertices.push([0,0,-1]);
    for(let col=0;col<longitudes;col++)faces.push([0,1+col,1+(col+1)%longitudes]);
    for(let row=0;row<latitudes-2;row++)for(let col=0;col<longitudes;col++){
      const a=1+row*longitudes+col,b=1+row*longitudes+(col+1)%longitudes,c=a+longitudes,d=b+longitudes;
      faces.push([a,c,b],[b,c,d]);
    }
    for(let col=0;col<longitudes;col++)faces.push([south-longitudes+col,south,south-longitudes+(col+1)%longitudes]);
    return {vertices,faces};
  }
  const sphere=sphereTemplate();

  function atomSurface(atoms,symbol) {
    const x=[],y=[],z=[],i=[],j=[],k=[],customdata=[];
    const radius=symbol==='H'?.25:.43;
    for(const atom of atoms){
      const offset=x.length;
      for(const v of sphere.vertices){
        x.push(atom.x+v[0]*radius);y.push(atom.y+v[1]*radius);z.push(atom.z+v[2]*radius);
        customdata.push([symbol,atom.occupancy,atom.x,atom.y,atom.z]);
      }
      for(const face of sphere.faces){i.push(face[0]+offset);j.push(face[1]+offset);k.push(face[2]+offset);}
    }
    return {type:'mesh3d',name:symbol,x,y,z,i,j,k,customdata,color:color(symbol),flatshading:false,opacity:1,lighting:{ambient:.36,diffuse:.85,specular:.75,roughness:.24,fresnel:.12},lightposition:{x:1000,y:1500,z:2200},meta:{verticesPerAtom:sphere.vertices.length,atomCount:atoms.length},hovertemplate:'<b>%{customdata[0]}</b> · 占位率 %{customdata[1]:.2f}<br>x %{customdata[2]:.3f} Å<br>y %{customdata[3]:.3f} Å<br>z %{customdata[4]:.3f} Å<extra></extra>'};
  }

  async function drawStructure(resetCamera = false) {
    const revision = ++renderRevision;
    const plot = $('crystal-viewer');
    const previousCamera = !resetCamera && plot.layout?.scene?.camera;
    const record=recordMap.get(state.selected);
    const s=record && data.structures[record.structure];
    plot.dataset.renderStatus='loading';
    $('atom-info').textContent='悬停或点击原子查看元素、占位率与坐标';
    $('atom-legend').innerHTML='';
    $('atom-count').textContent='';
    ['show-grid','show-cell','reset-view'].forEach(id=>$(id).disabled=!s);
    document.querySelectorAll('[data-repeat]').forEach(button=>button.disabled=!s);
    if (!s) {
      if (window.Plotly && plot.data) window.Plotly.purge(plot);
      state.viewer=null;
      plot.dataset.renderStatus='empty';
      showViewerMessage(record ? '此母体的 CIF 不在当前数据包中。能量信息仍可查看，请选择相邻氢化物查看已有结构。' : '没有选中的材料。调整上方元素条件后，在结果中选择一条记录。');
      return;
    }
    try {
      if (!window.Plotly) throw new Error('查看器文件未加载，请保留 vendor 文件夹');
      showViewerMessage('');
      const atoms=[];
      const n=state.repeat;
      for(let i=0;i<n;i++) for(let j=0;j<n;j++) for(let k=0;k<n;k++) {
        const offset=s.lattice[0].map((v,d)=>i*v+j*s.lattice[1][d]+k*s.lattice[2][d]);
        for(const atom of s.atoms) atoms.push({...atom,x:atom.x+offset[0],y:atom.y+offset[1],z:atom.z+offset[2]});
      }
      const traces=record.elements.map(symbol=>atomSurface(atoms.filter(atom=>atom.elem===symbol),symbol));
      const corners=Array.from({length:8},(_,bits)=>[0,1,2].map(d=>s.lattice.reduce((v,vec,axis)=>v+((bits>>axis)&1)*vec[d]*n,0)));
      if($('show-cell').checked) {
        const wire=[[],[],[]];
        for(let i=0;i<8;i++)for(const bit of [1,2,4])if(!(i&bit))for(let d=0;d<3;d++)wire[d].push(corners[i][d],corners[i|bit][d],null);
        traces.push({type:'scatter3d',mode:'lines',x:wire[0],y:wire[1],z:wire[2],line:{color:'#708b9f',width:3},hoverinfo:'skip',showlegend:false});
      }
      const grid=$('show-grid').checked;
      const extent=[...atoms.map(a=>[a.x,a.y,a.z]),...corners];
      const axes=Object.fromEntries(['x','y','z'].map((axis,d)=>{
        const values=extent.map(p=>p[d]);
        const min=Math.min(...values),max=Math.max(...values),pad=Math.max((max-min)*.10,.55);
        return [axis+'axis',{title:{text:axis+' / Å',font:{size:12,color:'#617b91'}},range:[min-pad,max+pad],showbackground:grid,backgroundcolor:d===2?'#edf3f8':d===1?'#f5f8fb':'#f0f5f9',showgrid:grid,gridcolor:'#d1dce7',gridwidth:1,zeroline:false,showline:grid,linecolor:'#a6b9ca',linewidth:1,ticks:grid?'outside':'',tickcolor:'#a6b9ca',ticklen:3,nticks:6,tickfont:{size:10,color:'#7b8fa1'},showticklabels:grid,visible:grid,showspikes:false}];
      }));
      // Scale all three physical axes together so elongated cells fit without distorting their shape.
      const spans=['x','y','z'].map(a=>axes[a+'axis'].range[1]-axes[a+'axis'].range[0]);
      const unit=Math.cbrt(spans.reduce((a,b)=>a*b,1));
      const scale=Math.min(1,1.8/(Math.max(...spans)/unit));
      const aspectratio=Object.fromEntries(['x','y','z'].map((a,d)=>[a,spans[d]/unit*scale]));
      await window.Plotly.react(plot,traces,{width:plot.clientWidth,height:plot.clientHeight,margin:{l:4,r:4,t:12,b:4},paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',font:{family:'Segoe UI, Microsoft YaHei, sans-serif'},showlegend:false,hoverlabel:{bgcolor:'#ffffff',bordercolor:'#d4e1ec',font:{size:12,color:'#34556d'}},scene:{...axes,aspectmode:'manual',aspectratio,dragmode:'orbit',camera:previousCamera||structuredClone(defaultCamera)},uirevision:resetCamera?`${record.id}:${n}:${revision}`:undefined},{responsive:false,displayModeBar:false,scrollZoom:true,displaylogo:false});
      if(revision!==renderRevision)return;
      state.viewer=plot;
      plot.removeAllListeners('plotly_click');
      plot.on('plotly_click',event=>{
        const point=event.points?.find(p=>p.customdata);
        if(point)$('atom-info').textContent=`${elementMap.get(point.customdata[0])?.name||''} ${point.customdata[0]} · 占位率 ${fmt(point.customdata[1],2)} · (${point.customdata.slice(2).map(v=>fmt(v,3)).join(', ')}) Å`;
      });
      plot.dataset.renderStatus='ready';
      $('atom-legend').innerHTML=record.elements.map(symbol=>`<span><i style="background:${color(symbol)}"></i>${symbol}</span>`).join('');
      $('atom-count').textContent=`${atoms.length} 个原子球 · ${n===1 ? '单晶胞' : '2 × 2 × 2 超胞'}`;
    } catch(error) {
      if(revision!==renderRevision)return;
      plot.dataset.renderStatus='error';
      showViewerMessage(`三维显示暂不可用：${error.message}。可继续查看基础信息或下载 CIF。`);
    }
  }

  function emit(event, payload) {
    const detail={type:'materials-explorer:'+event,...payload};
    window.dispatchEvent(new CustomEvent('materials-explorer:'+event,{detail}));
    const parentOrigin=new URLSearchParams(location.search).get('parentOrigin');
    if(window.parent!==window && parentOrigin) {
      try { const origin=new URL(parentOrigin).origin; if(origin!=='null') window.parent.postMessage(detail,origin); } catch { /* Invalid parentOrigin disables communication. */ }
    }
  }

  function reset() {
    state.elements=[]; $('element-input').value=''; setError(); applyFilter();
  }

  $('search-form').addEventListener('submit',event=>{
    event.preventDefault();
    try {state.elements=[...new Set([...state.elements,...parseInput($('element-input').value)])];$('element-input').value='';setError();applyFilter();} catch(error) {setError(error.message);}
  });
  $('element-input').addEventListener('input',()=>setError());
  $('element-chips').addEventListener('click',event=>{
    const button=event.target.closest('[data-remove]'); if(!button)return;
    state.elements=state.elements.filter(e=>e!==button.dataset.remove);applyFilter();
  });
  document.querySelectorAll('[name=match]').forEach(radio=>radio.addEventListener('change',()=>{
    state.mode=radio.value;$('match-hint').textContent=state.mode==='exact' ? '材料的全部元素须与选择一致（包括 H）' : '允许材料包含其他元素';applyFilter();
  }));
  $('clear').addEventListener('click',reset);$('empty-clear').addEventListener('click',reset);
  $('periodic-toggle').addEventListener('click',()=>{
    const open=$('periodic-panel').hidden;
    $('periodic-panel').hidden=!open;$('periodic-toggle').setAttribute('aria-expanded',String(open));$('periodic-toggle').setAttribute('aria-label',open ? '收起元素周期表' : '展开元素周期表');
  });
  $('results-body').addEventListener('click',event=>{const row=event.target.closest('[data-record]');if(row)selectRecord(row.dataset.record);});
  $('related-records').addEventListener('click',event=>{const button=event.target.closest('[data-related]');if(button)selectRecord(button.dataset.related);});
  for(const [id,delta] of [['prev-page',-1],['next-page',1]]) $(id).addEventListener('click',()=>{state.page+=delta;renderResults();});
  $('page-size').addEventListener('change',()=>{state.pageSize=Number($('page-size').value);state.page=1;renderResults();});
  document.querySelectorAll('[data-repeat]').forEach(button=>button.addEventListener('click',()=>{state.repeat=Number(button.dataset.repeat);updateRepeatButtons();drawStructure(true);}));
  $('show-grid').addEventListener('change',()=>drawStructure());
  $('show-cell').addEventListener('change',()=>drawStructure());
  $('reset-view').addEventListener('click',()=>drawStructure(true));
  $('download-cif').addEventListener('click',()=>{
    const record=recordMap.get(state.selected), s=record && data.structures[record.structure];if(!s)return;
    const url=URL.createObjectURL(new Blob([s.cif],{type:'chemical/x-cif;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=s.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  new ResizeObserver(()=>{
    const plot=$('crystal-viewer'),width=plot.clientWidth,height=plot.clientHeight;
    if(state.viewer && width && height && (plot.layout.width!==width || plot.layout.height!==height))window.Plotly.relayout(plot,{width,height});
  }).observe($('crystal-viewer'));
  const params=new URLSearchParams(location.search);
  if(params.get('embed')==='1')document.body.classList.add('embedded');
  const missing=data.records.filter(r=>!r.structure).length;
  $('dataset-summary').textContent=`${data.meta.parents.toLocaleString()} 种母体 · ${data.meta.hydrides.toLocaleString()} 种氢化物 · 元素检索与交互晶胞`;
  $('data-status').textContent=`数据说明${missing ? ` · ${missing} 个条目缺少 CIF` : ''}`;
  $('data-note').textContent=`当前展示 ${data.meta.database} 数据，共 ${data.records.length} 个独立条目，${data.meta.availableRecords} 个条目可查看结构；${missing} 个母体条目在原始目录中缺少 CIF。相同材料 ID 已去重，不同含氢量分别保留。周期表计数按独立条目统计，允许重复计入不同元素。空间群由 pymatgen/spglib 以 0.01 Å 容差重新识别；未识别时明确标注。母体与氢化物按去氢后的元素比例关联，不表示相同晶体骨架。形成能与氢化能参考不同，不能直接混用。`;
  buildPeriodicTable();
  try{state.elements=parseInput(params.get('elements')||'');}catch(error){setError(error.message);}
  if(params.get('mode')==='exact'){state.mode='exact';document.querySelector('[name=match][value=exact]').checked=true;$('match-hint').textContent='材料的全部元素须与选择一致（包括 H）';}
  applyFilter(false);
  // Public integration interface. Filtering accepts only valid element symbols.
  window.MaterialsExplorer={
    setFilter(selected,mode='contains'){
      if(!Array.isArray(selected)||selected.some(s=>!elementMap.has(s)))throw new Error('元素必须为有效元素符号数组');
      if(!['contains','exact'].includes(mode))throw new Error('mode 必须是 contains 或 exact');
      state.elements=[...new Set(selected)];state.mode=mode;
      document.querySelector(`[name=match][value=${mode}]`).checked=true;
      $('match-hint').textContent=mode==='exact'?'材料的全部元素须与选择一致（包括 H）':'允许材料包含其他元素';
      $('element-input').value='';setError();applyFilter();
      return state.results.length;
    },
    getResults(){return state.results.map(r=>({...r,elements:[...r.elements]}));},
    getSelection(){const r=recordMap.get(state.selected);return r?{...r,elements:[...r.elements]}:null;},
    select(id){if(!state.results.some(r=>r.id===id))return false;state.page=Math.floor(state.results.findIndex(r=>r.id===id)/state.pageSize)+1;renderResults();selectRecord(id);return true;}
  };
  window.addEventListener('message',event=>{
    const expected=params.get('parentOrigin');
    if(!expected || event.source!==window.parent)return;
    try{if(new URL(expected).origin!==event.origin)return;}catch{return;}
    if(event.data?.type==='materials-explorer:set-filter'){
      try{window.MaterialsExplorer.setFilter(event.data.elements,event.data.mode||'contains');}catch(error){emit('error',{message:error.message});}
    }
  });
  emit('ready',{count:state.results.length});
})();
