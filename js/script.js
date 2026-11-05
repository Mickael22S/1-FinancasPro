const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

let state = {
  receitas: JSON.parse(localStorage.getItem('fp_receitas') || '[]'),
  dividas:  JSON.parse(localStorage.getItem('fp_dividas')  || '[]'),
  gastos:   JSON.parse(localStorage.getItem('fp_gastos')   || '[]'),
  metas:    JSON.parse(localStorage.getItem('fp_metas')    || '[]'),
};
// Migração formato antigo
if (state.dividas.length && state.dividas[0] && !('grupoId' in state.dividas[0])) {
  state.dividas = state.dividas.map(d => ({
    ...d, grupoId:d.id, numParcela:1,
    totalParcelas: d.parcelas||1,
    valorParcela: d.valor / Math.max(d.parcelas||1,1),
  }));
  save();
}

let calAno = new Date().getFullYear();
let calMes = new Date().getMonth();
let calDiaSel = null;
let calDrillAberto  = null;
let dashDrillAberto = null;

function save() {
  localStorage.setItem('fp_receitas', JSON.stringify(state.receitas));
  localStorage.setItem('fp_dividas',  JSON.stringify(state.dividas));
  localStorage.setItem('fp_gastos',   JSON.stringify(state.gastos));
  localStorage.setItem('fp_metas',    JSON.stringify(state.metas));
}
function fmt(v) { return 'R$ ' + Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtDate(d) { if(!d) return '—'; const[y,m,day]=d.split('-'); return `${day}/${m}/${y}`; }
function pad(n) { return String(n).padStart(2,'0'); }
function notify(msg) {
  const n = document.getElementById('notif');
  document.getElementById('notif-msg').textContent = msg;
  n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 2800);
}

// ---- TEMA / CONFIGURAÇÕES ----
const _mqEscuro = window.matchMedia('(prefers-color-scheme: dark)');
function temaAtual() { try { return localStorage.getItem('fp_tema') || 'auto'; } catch(e) { return 'auto'; } }
function aplicaTema(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('fp_tema', t); } catch(e) {}
  document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.tema === t ? 'true' : 'false'));
  const escuro = t === 'dark' || (t === 'auto' && _mqEscuro.matches);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', escuro ? '#000000' : '#f5f5f7');
}
_mqEscuro.addEventListener && _mqEscuro.addEventListener('change', () => aplicaTema(temaAtual()));
function abrirConfig() {
  document.getElementById('cfg-overlay').classList.add('open');
  document.getElementById('cfg-sheet').classList.add('open');
}
function fecharConfig() {
  document.getElementById('cfg-overlay').classList.remove('open');
  document.getElementById('cfg-sheet').classList.remove('open');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharConfig(); });
aplicaTema(temaAtual());

// ---- NAVEGAÇÃO ----

/* ===== METAS ===== */
let metaCapaData='';
function esc(t){ return String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function metaCapaSel(inp) {
  const f=inp.files[0]; if(!f) { metaCapaData=''; document.getElementById('meta-capa-prev').style.display='none'; return; }
  const rd=new FileReader();
  rd.onload=()=>{ const im=new Image(); im.onload=()=>{
    const k=Math.min(1,900/Math.max(im.width,im.height)), c=document.createElement('canvas');
    c.width=Math.round(im.width*k); c.height=Math.round(im.height*k);
    c.getContext('2d').drawImage(im,0,0,c.width,c.height);
    metaCapaData=c.toDataURL('image/jpeg',.78);
    const pv=document.getElementById('meta-capa-prev'); pv.style.backgroundImage=`url(${metaCapaData})`; pv.style.display='block';
  }; im.src=rd.result; };
  rd.readAsDataURL(f);
}
function capacidadeMensal() {
  const media=(arr)=>{ const ms=new Set(arr.map(x=>(x.data||'').slice(0,7)).filter(Boolean)); return ms.size? arr.reduce((t,x)=>t+(+x.valor||0),0)/ms.size : 0; };
  if (!state.receitas.length) return null;
  const hoje=new Date(), mesAtual=`${hoje.getFullYear()}-${pad(hoje.getMonth()+1)}`;
  const parcelas=state.dividas.filter(d=>(d.venc||'').startsWith(mesAtual)).reduce((t,d)=>t+(+d.valorParcela||0),0);
  return media(state.receitas)-media(state.gastos)-parcelas;
}
function planoMeta(m) {
  const fim=new Date(m.inicio+'T12:00:00'); fim.setMonth(fim.getMonth()+m.meses);
  const restante=Math.max(m.alvo-(m.guardado||0),0);
  const mesesRest=Math.max(1,Math.ceil((fim-new Date())/(30.44*864e5)));
  const mes=restante/mesesRest, cap=capacidadeMensal();
  const p={fim,restante,mesesRest,mes,semana:mes/4.345,dia:mes/30.44,cor:'blue',nivel:'',dica:''};
  if (restante<=0) { p.cor='green'; p.nivel='Meta atingida'; p.dica='Parabéns! Você já juntou o valor desejado.'; return p; }
  if (cap===null) { p.nivel='Sem dados'; p.dica='Cadastre suas receitas e gastos para eu checar se essa meta cabe no seu orçamento.'; return p; }
  const pct=cap>0? mes/cap : Infinity;
  const estender=cap>0? Math.ceil(restante/(cap*0.7)) : 0;
  if (pct<=0.5) { p.cor='green'; p.nivel='Tranquilo'; p.dica=`Cabe com folga: guarde ${fmt(mes)} por mês (${Math.round(pct*100)}% da sua sobra média de ${fmt(cap)}). Automatize a transferência no dia do pagamento.`; }
  else if (pct<=1) { p.cor='amber'; p.nivel='Apertado'; p.dica=`Usa ${Math.round(pct*100)}% da sua sobra média (${fmt(cap)}). Para ficar mais folgado, estenda para ${estender} meses ou corte ${fmt(mes-cap*0.7)} por mês dos gastos.`; }
  else if (cap>0) { p.cor='red'; p.nivel='Difícil no prazo'; p.dica=`Sua sobra média é ${fmt(cap)}/mês, menos que os ${fmt(mes)} necessários. Guardando 70% da sobra, a meta sai em ${estender} meses — ou aumente a renda em ${fmt(mes-cap)}/mês.`; }
  else { p.cor='red'; p.nivel='Difícil no prazo'; p.dica=`Hoje não sobra dinheiro no mês. Reduza gastos ou aumente a renda em pelo menos ${fmt(mes-cap)} por mês para essa meta caber.`; }
  return p;
}
function atualizaPreviewMeta() {
  const alvo=parseFloat(document.getElementById('meta-alvo').value), meses=parseInt(document.getElementById('meta-meses').value);
  const g=parseFloat(document.getElementById('meta-guardado').value)||0, pv=document.getElementById('meta-preview');
  if (alvo>0 && meses>0) {
    const t=planoMeta({alvo,meses,guardado:g,inicio:new Date().toISOString().slice(0,10)});
    pv.style.display='block';
    document.getElementById('meta-preview-text').innerHTML=`Guardando <span>${fmt(t.mes)}/mês</span> (${fmt(t.semana)}/semana) você chega lá. <span>${t.nivel}</span>.`;
  } else pv.style.display='none';
}
function abrirMetaForm() { document.getElementById('meta-overlay').classList.add('open'); setTimeout(()=>document.getElementById('meta-obj').focus(),50); }
function fecharMetaForm() { document.getElementById('meta-overlay').classList.remove('open'); }
document.addEventListener('keydown',e=>{ if(e.key==='Escape') fecharMetaForm(); });
function addMeta() {
  const titulo=document.getElementById('meta-obj').value.trim();
  const alvo=parseFloat(document.getElementById('meta-alvo').value);
  const meses=parseInt(document.getElementById('meta-meses').value);
  const guardado=parseFloat(document.getElementById('meta-guardado').value)||0;
  if (!titulo||isNaN(alvo)||alvo<=0||!(meses>0)) { notify('Preencha objetivo, quantia e prazo!'); return; }
  state.metas.push({id:Date.now(),titulo,alvo,meses,guardado,inicio:new Date().toISOString().slice(0,10),capa:metaCapaData});
  try { save(); } catch(e) { state.metas[state.metas.length-1].capa=''; try { save(); } catch(e2){} notify('Foto muito grande: meta salva sem capa.'); }
  ['meta-obj','meta-alvo','meta-meses','meta-guardado','meta-capa'].forEach(i=>document.getElementById(i).value='');
  metaCapaData=''; document.getElementById('meta-capa-prev').style.display='none'; document.getElementById('meta-preview').style.display='none';
  fecharMetaForm(); renderMetas(); notify('Meta criada!');
}
function depositarMeta(id) {
  const inp=document.getElementById('dep-'+id), v=parseFloat(inp.value);
  if (isNaN(v)||v<=0) { notify('Informe o valor guardado!'); return; }
  const m=state.metas.find(x=>x.id===id); m.guardado=(m.guardado||0)+v; save(); renderMetas(); notify(`+${fmt(v)} em "${m.titulo}"`);
}
function deleteMeta(id) { state.metas=state.metas.filter(m=>m.id!==id); save(); renderMetas(); }
function renderMetas() {
  const el=document.getElementById('metas-list');
  if (!state.metas.length) { el.innerHTML='<div class="card"><div class="empty">Nenhuma meta ainda. Crie a primeira acima.</div></div>'; return; }
  el.innerHTML=state.metas.map(m=>{
    const t=planoMeta(m), pct=Math.min(100,Math.round((m.guardado||0)/m.alvo*100));
    return `<div class="card meta-card">
      <div class="meta-cover" style="${m.capa?`background-image:url(${m.capa})`:''}"><span class="badge ${t.cor}"><span class="badge-dot"></span>${t.nivel}</span></div>
      <div class="meta-body">
        <div class="meta-top"><div class="card-title">${esc(m.titulo)}</div><button class="delete-btn" aria-label="Remover meta" onclick="deleteMeta(${m.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg></button></div>
        <div class="meta-sub">${fmt(m.guardado||0)} de ${fmt(m.alvo)} · até ${fmtDate(t.fim.toISOString().slice(0,10))}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:var(--accent)"></div></div>
        ${t.restante>0?`<div class="meta-nums"><div><b>${fmt(t.mes)}</b>por mês</div><div><b>${fmt(t.semana)}</b>por semana</div><div><b>${fmt(t.dia)}</b>por dia</div></div>`:''}
        <div class="parcela-info">${t.dica}</div>
        <div class="meta-dep"><input type="number" id="dep-${m.id}" placeholder="Guardei (R$)" step="0.01" min="0" inputmode="decimal"><button class="btn" onclick="depositarMeta(${m.id})">Guardar</button></div>
      </div></div>`;
  }).join('');
}

function showPage(id) {
  fecharMetaForm();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  document.querySelectorAll('[data-page]').forEach(n => n.classList.toggle('active', n.dataset.page === id));
  const titles = {dashboard:'Dashboard',receitas:'Receitas',dividas:'Dívidas',gastos:'Gastos',calendario:'Calendário do mês',metas:'Metas'};
  const subs = {
    dashboard:'O panorama completo das suas finanças.',
    receitas:'Tudo o que entra, em um só lugar.',
    dividas:'Parcelas, bancos e vencimentos.',
    gastos:'Para onde o seu dinheiro está indo.',
    calendario:'Mês a mês, dia a dia.',
    metas:'Seus sonhos, com plano e prazo.'
  };
  document.getElementById('page-title').textContent = titles[id];
  document.getElementById('page-sub').textContent = subs[id];
  window.scrollTo(0,0);
  if (id==='dashboard')  renderDashboard();
  if (id==='receitas')   renderReceitas();
  if (id==='dividas')    renderDividas();
  if (id==='gastos')     renderGastos();
  if (id==='calendario') renderCalendario();
  if (id==='metas')      renderMetas();
}
// Acessibilidade: ativar itens do menu pelo teclado
document.querySelectorAll('.nav-item, .tab').forEach(el => {
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
});

// Rótulos das colunas (usados nas listas em formato de cartão no celular)
function aplicaRotulos() {
  document.querySelectorAll('table').forEach(t => {
    const hs = [...t.querySelectorAll('thead th')].map(h => h.textContent.trim());
    t.querySelectorAll('tbody tr').forEach(tr => {
      if (tr.children.length === 1) { tr.classList.add('grp'); return; }
      [...tr.children].forEach((td,i) => td.setAttribute('data-label', hs[i] || ''));
    });
  });
}
let _rotQueued = false;
new MutationObserver(() => {
  if (_rotQueued) return;
  _rotQueued = true;
  requestAnimationFrame(() => { _rotQueued = false; aplicaRotulos(); });
}).observe(document.body, {childList:true, subtree:true});

// ---- CORES ----
const catColors = {
  salario:'green',freelance:'blue',investimento:'purple',bonus:'amber',outro:'amber',
  moradia:'blue',alimentacao:'amber',transporte:'purple',saude:'green',lazer:'red',educacao:'blue',vestuario:'amber',
};
const bankColors = {
  'Nubank':         {bg:'#6b21a8',text:'#f3e8ff',label:'NU'},
  'Itaú':           {bg:'#1e3a8a',text:'#dbeafe',label:'IU'},
  'Bradesco':       {bg:'#b91c1c',text:'#fee2e2',label:'BD'},
  'Santander':      {bg:'#dc2626',text:'#fee2e2',label:'SN'},
  'Banco do Brasil':{bg:'#854d0e',text:'#fef9c3',label:'BB'},
  'Caixa':          {bg:'#1e40af',text:'#dbeafe',label:'CX'},
  'C6 Bank':        {bg:'#2a2a2a',text:'#e5e5e5',label:'C6'},
  'Inter':          {bg:'#7c2d12',text:'#ffedd5',label:'IN'},
  'XP':             {bg:'#14532d',text:'#dcfce7',label:'XP'},
  'Sicredi':        {bg:'#166534',text:'#dcfce7',label:'SC'},
  'Outro':          {bg:'#374151',text:'#e5e7eb',label:'OT'},
};

// ---- DASHBOARD DRILLS (dados globais) ----
function toggleDashDrill(tipo) {
  document.querySelectorAll('[id^="drill-dash-"]').forEach(p => p.classList.remove('open'));
  if (dashDrillAberto === tipo) { dashDrillAberto = null; return; }
  dashDrillAberto = tipo;
  renderDashDrill(tipo);
  const el = document.getElementById('drill-dash-'+tipo);
  el.classList.add('open');
  setTimeout(() => el.scrollIntoView({behavior:'smooth',block:'nearest'}), 50);
}
function closeDashDrill() {
  document.querySelectorAll('[id^="drill-dash-"]').forEach(p => p.classList.remove('open'));
  dashDrillAberto = null;
}
function renderDashDrill(tipo) {
  const abertas = state.dividas.filter(d => d.status !== 'quitada');
  if (tipo === 'receitas') {
    const el = document.getElementById('drill-dash-receitas-content');
    if (!state.receitas.length) { el.innerHTML = '<div class="empty">Nenhuma receita.</div>'; return; }
    const s = [...state.receitas].sort((a,b) => (b.data||'').localeCompare(a.data||''));
    el.innerHTML = `<table><thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Valor</th></tr></thead><tbody>
      ${s.map(r=>`<tr><td>${r.desc}</td><td><span class="badge ${catColors[r.cat]||'green'}"><span class="badge-dot"></span>${r.cat}</span></td>
      <td style="color:var(--muted)">${fmtDate(r.data)}</td><td style="color:var(--green);font-weight:600">${fmt(r.valor)}</td></tr>`).join('')}
    </tbody></table>`;
  }
  if (tipo === 'dividas') {
    const el = document.getElementById('drill-dash-dividas-content');
    if (!abertas.length) { el.innerHTML = '<div class="empty">Nenhuma parcela em aberto.</div>'; return; }
    const s = [...abertas].sort((a,b) => (a.venc||'').localeCompare(b.venc||''));
    const sb = {'em-dia':'green','atrasada':'red'};
    el.innerHTML = `<table><thead><tr><th>Descrição</th><th>Banco</th><th>Parcela</th><th>Vencimento</th><th>Status</th><th>Valor</th></tr></thead><tbody>
      ${s.map(d=>`<tr><td>${d.desc}</td><td>${d.banco}</td><td style="color:var(--muted)">${d.numParcela}/${d.totalParcelas}</td>
      <td style="color:var(--muted)">${fmtDate(d.venc)}</td>
      <td><span class="badge ${sb[d.status]||'amber'}"><span class="badge-dot"></span>${d.status}</span></td>
      <td style="color:var(--red);font-weight:600">${fmt(d.valorParcela)}</td></tr>`).join('')}
    </tbody></table>`;
  }
  if (tipo === 'gastos') {
    const el = document.getElementById('drill-dash-gastos-content');
    if (!state.gastos.length) { el.innerHTML = '<div class="empty">Nenhum gasto.</div>'; return; }
    const s = [...state.gastos].sort((a,b) => (b.data||'').localeCompare(a.data||''));
    el.innerHTML = `<table><thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Valor</th></tr></thead><tbody>
      ${s.map(g=>`<tr><td>${g.desc}</td><td><span class="badge ${catColors[g.cat]||'amber'}"><span class="badge-dot"></span>${g.cat}</span></td>
      <td style="color:var(--muted)">${fmtDate(g.data)}</td><td style="color:var(--amber);font-weight:600">${fmt(g.valor)}</td></tr>`).join('')}
    </tbody></table>`;
  }
  if (tipo === 'saldo') {
    const tR = state.receitas.reduce((s,r)=>s+r.valor,0);
    const tG = state.gastos.reduce((s,g)=>s+g.valor,0);
    const tD = abertas.reduce((s,d)=>s+d.valorParcela,0);
    const sl = tR - tG - tD;
    document.getElementById('drill-dash-saldo-content').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px">
        <div class="stat-box">
          <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Receitas</div>
          <div style="font-size:18px;font-weight:600;color:var(--green)">${fmt(tR)}</div>
        </div>
        <div class="stat-box">
          <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Gastos</div>
          <div style="font-size:18px;font-weight:600;color:var(--amber)">${fmt(tG)}</div>
        </div>
        <div class="stat-box">
          <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Parcelas abertas</div>
          <div style="font-size:18px;font-weight:600;color:var(--red)">${fmt(tD)}</div>
        </div>
      </div>
      <div class="stat-box" style="font-size:14px;color:var(--muted);line-height:1.9">
        Saldo = receitas (<b style="color:var(--green)">${fmt(tR)}</b>) − gastos (<b style="color:var(--amber)">${fmt(tG)}</b>) − parcelas (<b style="color:var(--red)">${fmt(tD)}</b>) = <b style="color:${sl>=0?'var(--green)':'var(--red)'}">${fmt(sl)}</b>
      </div>`;
  }
}

// ---- CALENDÁRIO DRILLS ----
function calMesPrefix() { return `${calAno}-${pad(calMes+1)}-`; }
function toggleCalDrill(tipo) {
  document.querySelectorAll('[id^="drill-cal-"]').forEach(p => p.classList.remove('open'));
  if (calDrillAberto === tipo) { calDrillAberto = null; return; }
  calDrillAberto = tipo;
  renderCalDrill(tipo);
  const el = document.getElementById('drill-cal-'+tipo);
  el.classList.add('open');
  setTimeout(() => el.scrollIntoView({behavior:'smooth',block:'nearest'}), 50);
}
function closeCalDrill() {
  document.querySelectorAll('[id^="drill-cal-"]').forEach(p => p.classList.remove('open'));
  calDrillAberto = null;
}
function renderCalDrill(tipo) {
  const mp = calMesPrefix();
  const recMes = state.receitas.filter(r => r.data && r.data.startsWith(mp));
  const gasMes = state.gastos.filter(g => g.data && g.data.startsWith(mp));
  const divMes = state.dividas.filter(d => d.venc && d.venc.startsWith(mp) && d.status !== 'quitada');

  if (tipo === 'receitas') {
    const el = document.getElementById('drill-cal-receitas-content');
    if (!recMes.length) { el.innerHTML = '<div class="empty">Nenhuma receita neste mês.</div>'; return; }
    el.innerHTML = `<table><thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Valor</th></tr></thead><tbody>
      ${recMes.map(r=>`<tr><td>${r.desc}</td><td><span class="badge ${catColors[r.cat]||'green'}"><span class="badge-dot"></span>${r.cat}</span></td>
      <td style="color:var(--muted)">${fmtDate(r.data)}</td><td style="color:var(--green);font-weight:600">${fmt(r.valor)}</td></tr>`).join('')}
    </tbody></table>`;
  }
  if (tipo === 'pagar') {
    const el = document.getElementById('drill-cal-pagar-content');
    const todos = [
      ...gasMes.map(g=>({desc:g.desc,tipo:'Gasto',det:g.cat||'—',valor:g.valor,data:g.data,cor:'amber'})),
      ...divMes.map(d=>({desc:`${d.desc} (${d.numParcela}/${d.totalParcelas})`,tipo:'Parcela',det:d.banco,valor:d.valorParcela,data:d.venc,cor:'red'})),
    ].sort((a,b)=>(a.data||'').localeCompare(b.data||''));
    if (!todos.length) { el.innerHTML = '<div class="empty">Nenhum pagamento neste mês.</div>'; return; }
    el.innerHTML = `<table><thead><tr><th>Descrição</th><th>Tipo</th><th>Detalhe</th><th>Data</th><th>Valor</th></tr></thead><tbody>
      ${todos.map(x=>`<tr><td>${x.desc}</td><td><span class="badge ${x.cor}"><span class="badge-dot"></span>${x.tipo}</span></td>
      <td style="color:var(--muted);font-size:14px">${x.det}</td><td style="color:var(--muted)">${fmtDate(x.data)}</td>
      <td style="color:var(--${x.cor});font-weight:600">${fmt(x.valor)}</td></tr>`).join('')}
    </tbody></table>`;
  }
  if (tipo === 'saldo') {
    const tR = recMes.reduce((s,r)=>s+r.valor,0);
    const tG = gasMes.reduce((s,g)=>s+g.valor,0);
    const tD = divMes.reduce((s,d)=>s+d.valorParcela,0);
    const sl = tR - tG - tD;
    document.getElementById('drill-cal-saldo-content').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:14px">
        <div class="stat-box">
          <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Receitas</div>
          <div style="font-size:18px;font-weight:600;color:var(--green)">${fmt(tR)}</div>
        </div>
        <div class="stat-box">
          <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Parcelas</div>
          <div style="font-size:18px;font-weight:600;color:var(--red)">${fmt(tD)}</div>
        </div>
        <div class="stat-box">
          <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Gastos</div>
          <div style="font-size:18px;font-weight:600;color:var(--amber)">${fmt(tG)}</div>
        </div>
      </div>
      <div class="stat-box" style="font-size:14px;color:var(--muted);line-height:1.9">
        Saldo = receitas (<b style="color:var(--green)">${fmt(tR)}</b>) − parcelas (<b style="color:var(--red)">${fmt(tD)}</b>) − gastos (<b style="color:var(--amber)">${fmt(tG)}</b>) = <b style="color:${sl>=0?'var(--green)':'var(--red)'}">${fmt(sl)}</b>
      </div>`;
  }
}

// ---- PREVIEW DÍVIDA ----
function atualizaPreviewDivida() {
  const valor    = parseFloat(document.getElementById('div-valor').value);
  const parcelas = parseInt(document.getElementById('div-parcelas').value);
  const venc     = document.getElementById('div-venc').value;
  const preview  = document.getElementById('div-preview');
  if (valor > 0 && parcelas > 0 && venc) {
    const d = new Date(venc+'T12:00:00');
    const fim = new Date(d.getFullYear(), d.getMonth()+parcelas-1, d.getDate());
    preview.style.display = 'block';
    document.getElementById('div-preview-text').innerHTML =
      `Total <span>${fmt(valor)}</span> ÷ <span>${parcelas} parcelas</span> = <span>${fmt(valor/parcelas)}</span> por parcela.<br>
       De ${MESES[d.getMonth()]}/${d.getFullYear()} até ${MESES[fim.getMonth()]}/${fim.getFullYear()}.`;
  } else { preview.style.display = 'none'; }
}

// ---- CRUD ----
function addReceita() {
  const desc=document.getElementById('rec-desc').value.trim();
  const valor=parseFloat(document.getElementById('rec-valor').value);
  const cat=document.getElementById('rec-cat').value;
  const data=document.getElementById('rec-data').value;
  if (!desc||isNaN(valor)||valor<=0) { notify('Preencha descrição e valor!'); return; }
  state.receitas.push({id:Date.now(),desc,valor,cat,data});
  save(); renderReceitas(); renderDashboard();
  document.getElementById('rec-desc').value=''; document.getElementById('rec-valor').value='';
  notify('Receita adicionada! + '+fmt(valor));
}

function addDivida() {
  const desc=document.getElementById('div-desc').value.trim();
  const valorTotal=parseFloat(document.getElementById('div-valor').value);
  const banco=document.getElementById('div-banco').value;
  const parcelas=parseInt(document.getElementById('div-parcelas').value)||1;
  const vencBase=document.getElementById('div-venc').value;
  const status=document.getElementById('div-status').value;
  if (!desc||isNaN(valorTotal)||valorTotal<=0) { notify('Preencha descrição e valor total!'); return; }
  if (!vencBase) { notify('Informe a data de vencimento!'); return; }
  const grupoId=Date.now();
  const totalCent=Math.round(valorTotal*100), baseCent=Math.floor(totalCent/parcelas), sobra=totalCent-baseCent*parcelas;
  const valorP=(baseCent+(sobra>0?1:0))/100;
  const baseDate=new Date(vencBase+'T12:00:00');
  for (let i=0;i<parcelas;i++) {
    const vd=new Date(baseDate.getFullYear(),baseDate.getMonth()+i,baseDate.getDate());
    state.dividas.push({
      id:grupoId+i, grupoId, numParcela:i+1, totalParcelas:parcelas,
      desc, valorParcela:(baseCent+(i<sobra?1:0))/100, valorTotal, banco,
      venc:`${vd.getFullYear()}-${pad(vd.getMonth()+1)}-${pad(vd.getDate())}`,
      status: i===0 ? status : 'em-dia',
    });
  }
  save(); renderDividas(); renderDashboard();
  document.getElementById('div-desc').value=''; document.getElementById('div-valor').value='';
  document.getElementById('div-parcelas').value=''; document.getElementById('div-preview').style.display='none';
  notify(`${fmt(valorTotal)} em ${parcelas}x de ${fmt(valorTotal/parcelas)} — ${banco}`);
}

function addGasto() {
  const desc=document.getElementById('gas-desc').value.trim();
  const valor=parseFloat(document.getElementById('gas-valor').value);
  const cat=document.getElementById('gas-cat').value;
  const data=document.getElementById('gas-data').value;
  if (!desc||isNaN(valor)||valor<=0) { notify('Preencha descrição e valor!'); return; }
  state.gastos.push({id:Date.now(),desc,valor,cat,data});
  save(); renderGastos(); renderDashboard();
  document.getElementById('gas-desc').value=''; document.getElementById('gas-valor').value='';
  notify('Gasto adicionado: '+fmt(valor));
}

function deleteItem(type,id) {
  state[type]=state[type].filter(x=>x.id!==id);
  save();
  if(type==='receitas') renderReceitas();
  if(type==='dividas')  renderDividas();
  if(type==='gastos')   renderGastos();
  renderDashboard();
  notify('Item removido.');
}

function deleteGrupoDivida(grupoId) {
  const n=state.dividas.filter(d=>d.grupoId===grupoId).length;
  state.dividas=state.dividas.filter(d=>d.grupoId!==grupoId);
  save(); renderDividas(); renderDashboard();
  notify(`${n} parcela(s) removidas.`);
}

function marcarPaga(id) {
  const d=state.dividas.find(x=>x.id===id);
  if(!d) return;
  d.status='quitada';
  save(); renderDividas(); renderDashboard();
  notify('Parcela marcada como paga!');
}

// ---- RENDERS ----
function renderReceitas() {
  const el=document.getElementById('receitas-table');
  const total=state.receitas.reduce((s,r)=>s+r.valor,0);
  document.getElementById('rec-total-badge').textContent=state.receitas.length?'Total: '+fmt(total):'';
  if (!state.receitas.length) { el.innerHTML='<div class="empty">Nenhuma receita registrada.</div>'; return; }
  const s=[...state.receitas].sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  el.innerHTML=`<table><thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Valor</th><th></th></tr></thead><tbody>
    ${s.map(r=>`<tr><td>${r.desc}</td><td><span class="badge ${catColors[r.cat]||'green'}"><span class="badge-dot"></span>${r.cat}</span></td>
    <td style="color:var(--muted)">${fmtDate(r.data)}</td>
    <td style="color:var(--green);font-weight:600">${fmt(r.valor)}</td>
    <td><button class="delete-btn" aria-label="Remover" onclick="deleteItem('receitas',${r.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg></button></td></tr>`).join('')}
  </tbody></table>`;
}

function renderDividas() {
  const el=document.getElementById('dividas-table');
  const abertas=state.dividas.filter(d=>d.status!=='quitada');
  document.getElementById('div-total-badge').textContent=abertas.length
    ?`${abertas.length} em aberto: ${fmt(abertas.reduce((s,d)=>s+d.valorParcela,0))}`:'';
  if (!state.dividas.length) { el.innerHTML='<div class="empty">Nenhuma dívida registrada.</div>'; return; }
  const grupos={};
  state.dividas.forEach(d=>{ if(!grupos[d.grupoId]) grupos[d.grupoId]=[]; grupos[d.grupoId].push(d); });
  const sb={'em-dia':'green','atrasada':'red','quitada':'blue'};
  let rows='';
  Object.values(grupos).forEach(parcs=>{
    parcs.sort((a,b)=>a.numParcela-b.numParcela);
    const g=parcs[0];
    const pagas=parcs.filter(p=>p.status==='quitada').length;
    rows+=`<tr style="background:var(--inset)"><td colspan="5" style="padding:12px 14px;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
        <div style="min-width:0"><span style="font-size:15px;font-weight:600">${g.desc}</span>
        <span style="font-size:13px;color:var(--muted);margin-left:8px">${g.banco} · ${parcs.length}x de ${fmt(g.valorParcela)}</span></div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <span style="font-size:13px;color:var(--muted)">${pagas}/${parcs.length} pagas</span>
          <button class="delete-btn txt" aria-label="Excluir dívida" onclick="deleteGrupoDivida(${g.grupoId})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg>Excluir</button>
        </div>
      </div></td></tr>`;
    parcs.forEach(d=>{
      const acao=d.status!=='quitada'
        ?`<button class="btn-pagar" onclick="marcarPaga(${d.id})">✓ Pago</button>`
        :`<span style="font-size:12px;color:var(--blue)">quitada</span>`;
      rows+=`<tr><td style="padding-left:14px;color:var(--muted);font-size:14px">${d.numParcela}/${d.totalParcelas}</td>
        <td style="color:var(--muted)">${fmtDate(d.venc)}</td>
        <td><span class="badge ${sb[d.status]}"><span class="badge-dot"></span>${d.status}</span></td>
        <td style="color:${d.status==='quitada'?'var(--muted)':'var(--red)'};font-weight:600">${fmt(d.valorParcela)}</td>
        <td>${acao}</td></tr>`;
    });
  });
  el.innerHTML=`<table><thead><tr><th style="padding-left:14px">Parcela</th><th>Vencimento</th><th>Status</th><th>Valor</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderGastos() {
  const el=document.getElementById('gastos-table');
  const total=state.gastos.reduce((s,g)=>s+g.valor,0);
  document.getElementById('gas-total-badge').textContent=state.gastos.length?'Total: '+fmt(total):'';
  if (!state.gastos.length) { el.innerHTML='<div class="empty">Nenhum gasto registrado.</div>'; return; }
  const s=[...state.gastos].sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  el.innerHTML=`<table><thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Valor</th><th></th></tr></thead><tbody>
    ${s.map(g=>`<tr><td>${g.desc}</td><td><span class="badge ${catColors[g.cat]||'amber'}"><span class="badge-dot"></span>${g.cat}</span></td>
    <td style="color:var(--muted)">${fmtDate(g.data)}</td>
    <td style="color:var(--amber);font-weight:600">${fmt(g.valor)}</td>
    <td><button class="delete-btn" aria-label="Remover" onclick="deleteItem('gastos',${g.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg></button></td></tr>`).join('')}
  </tbody></table>`;
}

// Dashboard — panorama GLOBAL (sem filtro de mês)
function renderDashboard() {
  const abertas=state.dividas.filter(d=>d.status!=='quitada');
  const tR=state.receitas.reduce((s,r)=>s+r.valor,0);
  const tG=state.gastos.reduce((s,g)=>s+g.valor,0);
  const tD=abertas.reduce((s,d)=>s+d.valorParcela,0);
  const saldo=tR-tG-tD;

  document.getElementById('dash-receitas').textContent=fmt(tR);
  document.getElementById('dash-receitas-sub').textContent=state.receitas.length+' lançamentos';
  document.getElementById('dash-dividas').textContent=fmt(tD);
  document.getElementById('dash-dividas-sub').textContent=abertas.length+' parcelas em aberto';
  document.getElementById('dash-gastos').textContent=fmt(tG);
  document.getElementById('dash-gastos-sub').textContent=state.gastos.length+' gastos registrados';
  document.getElementById('dash-saldo').textContent=fmt(saldo);
  document.getElementById('dash-saldo-sub').textContent=saldo>=0?'saldo positivo':'saldo negativo';

  const divPct=tR>0?Math.min(100,Math.round((tD/tR)*100)):0;
  const gasPct=tR>0?Math.min(100,Math.round((tG/tR)*100)):0;
  document.getElementById('comprometimento-pct').textContent=divPct+'%';
  document.getElementById('comprometimento-bar').style.cssText=`width:${divPct}%;background:${divPct>70?'var(--red)':divPct>40?'var(--amber)':'var(--green)'}`;
  document.getElementById('gastos-pct').textContent=gasPct+'%';
  document.getElementById('gastos-bar').style.cssText=`width:${gasPct}%;background:${gasPct>80?'var(--red)':gasPct>60?'var(--amber)':'var(--green)'}`;

  let msg='';
  if(tR===0) msg='Adicione suas receitas para ver a análise de saúde financeira.';
  else if(divPct>70) msg='⚠️ Suas parcelas comprometem mais de 70% das receitas. Priorize quitá-las.';
  else if(gasPct>80) msg='⚠️ Seus gastos estão elevados em relação às receitas. Revise despesas.';
  else if(saldo>0&&divPct<30) msg='✓ Situação saudável! Saldo positivo e dívidas controladas.';
  else msg='Situação moderada. Continue acompanhando seus gastos e dívidas.';
  document.getElementById('saude-msg').textContent=msg;

  const all=[
    ...state.receitas.map(r=>({id:r.id,desc:r.desc,valor:r.valor,tipo:'receita'})),
    ...state.dividas.map(d=>({id:d.id,desc:`${d.desc} (${d.numParcela}/${d.totalParcelas})`,valor:d.valorParcela,tipo:'divida'})),
    ...state.gastos.map(g=>({id:g.id,desc:g.desc,valor:g.valor,tipo:'gasto'})),
  ].sort((a,b)=>b.id-a.id).slice(0,7);
  const lEl=document.getElementById('dash-lancamentos-list');
  if(!all.length){lEl.innerHTML='<div class="empty">Nenhum lançamento ainda.</div>';}
  else{
    const cols={receita:'green',divida:'red',gasto:'amber'};
    const labs={receita:'Receita',divida:'Dívida',gasto:'Gasto'};
    lEl.innerHTML=`<table><thead><tr><th>Descrição</th><th>Tipo</th><th>Valor</th></tr></thead><tbody>
      ${all.map(x=>`<tr>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x.desc}</td>
        <td><span class="badge ${cols[x.tipo]}"><span class="badge-dot"></span>${labs[x.tipo]}</span></td>
        <td style="font-weight:600;color:var(--${cols[x.tipo]});white-space:nowrap">${fmt(x.valor)}</td>
      </tr>`).join('')}
    </tbody></table>`;
  }

  const byBank={};
  abertas.forEach(d=>{
    if(!byBank[d.banco]) byBank[d.banco]={total:0,atrasada:false};
    byBank[d.banco].total+=d.valorParcela;
    if(d.status==='atrasada') byBank[d.banco].atrasada=true;
  });
  const banks=Object.entries(byBank).sort((a,b)=>b[1].total-a[1].total);
  const bEl=document.getElementById('dash-banks-list');
  if(!banks.length){bEl.innerHTML='<div class="empty">Nenhuma dívida registrada.</div>';}
  else{
    bEl.innerHTML=banks.map(([banco,info])=>{
      const bc=bankColors[banco]||bankColors['Outro'];
      return `<div class="bank-item">
        <div class="bank-left">
          <div class="bank-icon" style="background:${bc.bg};color:${bc.text}">${bc.label}</div>
          <div><div class="bank-name">${banco}</div><div class="bank-detail">${info.atrasada?'⚠ parcela atrasada':'Em dia'}</div></div>
        </div>
        <div class="bank-value" style="color:${info.atrasada?'var(--red)':'var(--muted)'}">${fmt(info.total)}</div>
      </div>`;
    }).join('');
  }
  renderChart();
  if(dashDrillAberto) renderDashDrill(dashDrillAberto);
}

function renderChart() {
  const now=new Date();
  const months=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    months.push({year:d.getFullYear(),month:d.getMonth(),label:ABREV[d.getMonth()]});
  }
  const vals=months.map(m=>
    state.receitas.filter(r=>{
      if(!r.data) return false;
      const d=new Date(r.data+'T12:00:00');
      return d.getFullYear()===m.year&&d.getMonth()===m.month;
    }).reduce((s,r)=>s+r.valor,0)
  );
  const max=Math.max(...vals,1);
  document.getElementById('chart-bars').innerHTML=months.map((m,i)=>{
    const h=Math.round((vals[i]/max)*100);
    const lbl=vals[i]>=1000?'R$'+(vals[i]/1000).toFixed(1).replace(/\.0$/,'')+'k':vals[i]>0?'R$'+Math.round(vals[i]):'';
    return `<div class="chart-bar-wrap">
      <div style="font-size:10px;color:var(--muted);margin-bottom:3px;text-align:center">${lbl}</div>
      <div class="chart-bar" style="height:${Math.max(h,vals[i]>0?6:2)}%;background:var(--green);opacity:${i===5?1:0.35}"></div>
      <div class="chart-bar-label">${m.label}</div>
    </div>`;
  }).join('');
}

// ---- CALENDÁRIO ----
function calMudaMes(delta) {
  calMes+=delta;
  if(calMes>11){calMes=0;calAno++;}
  if(calMes<0) {calMes=11;calAno--;}
  calDiaSel=null; calDrillAberto=null;
  document.querySelectorAll('[id^="drill-cal-"]').forEach(p=>p.classList.remove('open'));
  renderCalendario();
}

function getEventosDia(dia) {
  const key=`${calAno}-${pad(calMes+1)}-${pad(dia)}`;
  return {
    receitas: state.receitas.filter(r=>r.data===key),
    gastos:   state.gastos.filter(g=>g.data===key),
    dividas:  state.dividas.filter(d=>d.venc===key),
  };
}

function renderCalendario() {
  const mp=calMesPrefix();
  document.getElementById('cal-titulo').textContent=`${MESES[calMes]} ${calAno}`;
  document.getElementById('cal-mes-label').textContent=`${MESES[calMes]} ${calAno}`;

  const hoje=new Date();
  const totalDias=new Date(calAno,calMes+1,0).getDate();
  const primDia=new Date(calAno,calMes,1).getDay();
  let html='';
  for(let i=0;i<primDia;i++) html+=`<div class="cal-day vazio"></div>`;
  for(let d=1;d<=totalDias;d++){
    const ev=getEventosDia(d);
    const isHoje=hoje.getDate()===d&&hoje.getMonth()===calMes&&hoje.getFullYear()===calAno;
    const isSel=calDiaSel===d;
    let pips='';
    if(ev.receitas.length) pips+=`<div class="cal-pip receita"></div>`;
    if(ev.dividas.filter(x=>x.status!=='quitada').length) pips+=`<div class="cal-pip pagar"></div>`;
    if(ev.gastos.length) pips+=`<div class="cal-pip gasto"></div>`;
    html+=`<div class="cal-day${isHoje?' hoje':''}${isSel?' selected':''}" onclick="calSelecionaDia(${d})">
      <div class="cal-day-num">${d}</div>${pips}</div>`;
  }
  document.getElementById('cal-grid').innerHTML=html;

  const recMes=state.receitas.filter(r=>r.data&&r.data.startsWith(mp));
  const gasMes=state.gastos.filter(g=>g.data&&g.data.startsWith(mp));
  const divMes=state.dividas.filter(d=>d.venc&&d.venc.startsWith(mp)&&d.status!=='quitada');
  const tR=recMes.reduce((s,r)=>s+r.valor,0);
  const tG=gasMes.reduce((s,g)=>s+g.valor,0);
  const tD=divMes.reduce((s,d)=>s+d.valorParcela,0);
  const tPag=tG+tD;
  const saldo=tR-tPag;

  document.getElementById('cal-total-receitas').textContent=fmt(tR);
  document.getElementById('cal-sub-receitas').textContent=recMes.length+' lançamento(s)';
  document.getElementById('cal-total-pagar').textContent=fmt(tPag);
  document.getElementById('cal-sub-pagar').textContent=`${divMes.length} parcela(s) + ${gasMes.length} gasto(s)`;
  document.getElementById('cal-saldo').textContent=fmt(saldo);
  document.getElementById('cal-sub-saldo').textContent=saldo>=0?'saldo positivo':'saldo negativo';

  if(calDiaSel) calSelecionaDia(calDiaSel);
  if(calDrillAberto) renderCalDrill(calDrillAberto);

  const proximos=state.dividas
    .filter(d=>d.venc&&d.status!=='quitada')
    .map(d=>({...d,_d:new Date(d.venc+'T00:00:00')}))
    .filter(d=>{ const h=new Date(); h.setHours(0,0,0,0); return d._d>=h; })
    .sort((a,b)=>a._d-b._d).slice(0,5);
  const pEl=document.getElementById('cal-proximos');
  if(!proximos.length) pEl.innerHTML='<div class="empty" style="padding:10px 0">Nenhum vencimento próximo.</div>';
  else pEl.innerHTML=proximos.map(d=>{
    const dia=d.venc.split('-')[2];
    const mes=ABREV[parseInt(d.venc.split('-')[1])-1];
    return `<div class="venc-item">
      <div class="venc-dia">${dia}</div>
      <div class="venc-info"><div class="venc-nome">${d.desc} (${d.numParcela}/${d.totalParcelas})</div>
      <div class="venc-banco">${d.banco} · ${mes}</div></div>
      <div class="venc-valor">${fmt(d.valorParcela)}</div>
    </div>`;
  }).join('');

  const todos=[
    ...recMes.map(r=>({desc:r.desc,tipo:'receita',det:r.cat||'—',valor:r.valor,data:r.data})),
    ...gasMes.map(g=>({desc:g.desc,tipo:'gasto',det:g.cat||'—',valor:g.valor,data:g.data})),
    ...divMes.map(d=>({desc:`${d.desc} (${d.numParcela}/${d.totalParcelas})`,tipo:'divida',det:d.banco,valor:d.valorParcela,data:d.venc})),
  ].sort((a,b)=>(a.data||'').localeCompare(b.data||''));
  const lEl=document.getElementById('cal-lista-mes');
  if(!todos.length){lEl.innerHTML='<div class="empty">Nenhum lançamento neste mês.</div>';return;}
  const cores={receita:'green',gasto:'amber',divida:'red'};
  const labs={receita:'Receita',gasto:'Gasto',divida:'Parcela'};
  lEl.innerHTML=`<table><thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Detalhe</th><th>Valor</th></tr></thead><tbody>
    ${todos.map(x=>`<tr>
      <td style="color:var(--muted);white-space:nowrap">${fmtDate(x.data)}</td>
      <td style="max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x.desc}</td>
      <td><span class="badge ${cores[x.tipo]}"><span class="badge-dot"></span>${labs[x.tipo]}</span></td>
      <td style="color:var(--muted);font-size:14px">${x.det}</td>
      <td style="font-weight:600;color:var(--${cores[x.tipo]});white-space:nowrap">${fmt(x.valor)}</td>
    </tr>`).join('')}
  </tbody></table>`;
}

function calSelecionaDia(dia) {
  calDiaSel=dia;
  document.querySelectorAll('.cal-day:not(.vazio)').forEach((el,i)=>el.classList.toggle('selected',i===dia-1));
  document.getElementById('cal-dia-titulo').textContent=`${pad(dia)}/${pad(calMes+1)}/${calAno}`;
  const ev=getEventosDia(dia);
  const todos=[
    ...ev.receitas.map(r=>({desc:r.desc,tipo:'receita',extra:'',valor:r.valor})),
    ...ev.gastos.map(g=>({desc:g.desc,tipo:'gasto',extra:g.cat||'',valor:g.valor})),
    ...ev.dividas.map(d=>({desc:`${d.desc} (${d.numParcela}/${d.totalParcelas})`,tipo:'divida',extra:d.banco+' · '+d.status,valor:d.valorParcela})),
  ];
  const dEl=document.getElementById('cal-dia-detalhe');
  if(!todos.length){dEl.innerHTML='<div class="empty" style="padding:14px 0">Nenhum lançamento.</div>';return;}
  const cores={receita:'green',gasto:'amber',divida:'red'};
  const labs={receita:'Receita',gasto:'Gasto',divida:'Parcela'};
  dEl.innerHTML=todos.map(x=>`<div class="cal-evento-item">
    <div style="min-width:0;flex:1">
      <div style="font-size:14px;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x.desc}</div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span class="badge ${cores[x.tipo]}" style="font-size:11px"><span class="badge-dot"></span>${labs[x.tipo]}</span>
        ${x.extra?`<span style="font-size:12px;color:var(--muted)">${x.extra}</span>`:''}
      </div>
    </div>
    <div style="font-weight:600;color:var(--${cores[x.tipo]});white-space:nowrap;margin-left:8px">${fmt(x.valor)}</div>
  </div>`).join('');
}

// ---- INIT ----
document.querySelectorAll('input[type="date"]').forEach(el=>{ el.value=new Date().toISOString().split('T')[0]; });
document.getElementById('cal-mes-label').textContent=`${MESES[calMes]} ${calAno}`;
renderDashboard();
renderReceitas();
renderDividas();
renderGastos();
aplicaRotulos();
showPage('calendario');
