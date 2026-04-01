// ============================================================
//  CONFIGURAÇÃO SUPABASE
// ============================================================
const SUPABASE_URL = 'https://gnfottqvxqtfrxftoxmg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xnThR76-u89SSctSORpu6Q_h0zPfkRI';

async function sbFetch(path, options = {}) {
  var res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    headers: Object.assign({
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }, options.headers || {}),
    method: options.method || 'GET',
    body: options.body || undefined
  });
  if (!res.ok) {
    var err = await res.text();
    throw new Error(err);
  }
  var text = await res.text();
  return text ? JSON.parse(text) : [];
}

var SETORES = [
  'RH', 'Compras', 'Financeiro', 'PCP', 'Projetos',
  'Programação', 'Corte', 'Dobra', 'Solda', 'DCQ',
  'Pintura', 'Ajustagem', 'Montagem', 'Expedição'
];

const PIN_HASH = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
let pinDestino    = null;
let rhAutenticado = false;

async function sha256(texto) {
  var buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buffer)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
}

let pedidos = [];
let setores = SETORES.map(function(nome, i){ return { id: i+1, nome: nome }; });

async function carregarPedidos() {
  try {
    var data = await sbFetch('pedidos?ativo=eq.true&order=id.desc');
    pedidos = data.map(function(p) {
      return {
        id: p.id, data: p.data, setor: p.setor, qtd: p.qtd,
        horario: p.horario, pao: p.pao, massinha: p.massinha, cafe: p.cafe,
        saborLanche: p.sabor_lanche, choco260: p.choco260, choco900: p.choco900,
        refriLata: p.refri_lata, refri2l: p.refri2l, saborRefri: p.sabor_refri,
        obs: p.obs, criadoEm: p.criado_em
      };
    });
  } catch(e) { console.error('Erro ao carregar pedidos:', e); }
}

async function salvarPedidoSupabase(pedido) {
  return await sbFetch('pedidos', {
    method: 'POST',
    body: JSON.stringify({
      id: pedido.id, data: pedido.data, setor: pedido.setor, qtd: pedido.qtd,
      horario: pedido.horario, pao: pedido.pao, massinha: pedido.massinha, cafe: pedido.cafe,
      sabor_lanche: pedido.saborLanche, choco260: pedido.choco260, choco900: pedido.choco900,
      refri_lata: pedido.refriLata, refri2l: pedido.refri2l, sabor_refri: pedido.saborRefri,
      obs: pedido.obs, criado_em: pedido.criadoEm, ativo: true
    })
  });
}

async function excluirPedidoSupabase(id) {
  return await sbFetch('pedidos?id=eq.' + id, {
    method: 'PATCH',
    body: JSON.stringify({ ativo: false })
  });
}

function updateRelogio() {
  var now = new Date();
  var h = String(now.getHours()).padStart(2,'0');
  var m = String(now.getMinutes()).padStart(2,'0');
  document.getElementById('relogio').textContent = h + ':' + m;
  var dias  = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  var meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  document.getElementById('data-atual').textContent =
    dias[now.getDay()] + ', ' + now.getDate() + ' de ' + meses[now.getMonth()] + ' de ' + now.getFullYear();
  checkDeadline();
}

function checkDeadline() {
  var now = new Date();
  var min = now.getHours() * 60 + now.getMinutes();
  var d1  = 9 * 60 + 15;
  var d2  = 15 * 60;
  var el  = document.getElementById('alert-deadline');
  if (!el) return;
  if (min < d1) {
    var r = d1 - min;
    el.innerHTML = '<div class="alert alert-info">⏰ <strong>Prazo para lanche das 15h:</strong> preencher até as 09:15. Faltam ' + r + ' minuto' + (r!==1?'s':'') + '.</div>';
  } else if (min < d2) {
    var r = d2 - min;
    el.innerHTML = '<div class="alert alert-warning">⚠️ Prazo das 09:15 encerrado. Pedidos agora são para noite/madrugada/manhã seguinte. Prazo até as 15:00 — faltam ' + r + ' minuto' + (r!==1?'s':'') + '.</div>';
  } else {
    el.innerHTML = '<div class="alert alert-danger">🔴 Prazo das 15:00 encerrado. Pedidos serão para o próximo turno.</div>';
  }
}

function setTab(tab) {
  if (!tab) return;
  document.querySelectorAll('.tab').forEach(function(el){ el.classList.remove('active'); });
  document.querySelectorAll('.section').forEach(function(el){ el.classList.remove('active'); });
  document.querySelector('.tab[data-tab="' + tab + '"]').classList.add('active');
  document.getElementById('sec-' + tab).classList.add('active');
  if (tab === 'painel')    { carregarPedidos().then(renderPainel); }
  if (tab === 'whatsapp')  { carregarPedidos().then(renderWpp); }
  if (tab === 'setores')   renderSetores();
  if (tab === 'relatorio') renderRelatorio();
}

function v(id) { return document.getElementById(id).value.trim(); }
function n(id) { return parseInt(document.getElementById(id).value) || 0; }

function limparForm() {
  ['data','qtd','horario','pao','massinha','cafe',
   'sabor-lanche','choco260','choco900','refri-lata','refri2l','sabor-refri','obs']
    .forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('setor').value = '';
  document.getElementById('msg-erro').style.display = 'none';
  document.getElementById('data').value = new Date().toISOString().split('T')[0];
}

function mostrarFeedback(secId, classe, msg) {
  var el = document.createElement('div');
  el.className = 'alert ' + classe;
  el.textContent = msg;
  el.style.marginTop = '12px';
  var sec = document.getElementById(secId);
  var btnRow = sec.querySelector('.btn-row');
  if (btnRow) { btnRow.insertAdjacentElement('afterend', el); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  else { sec.appendChild(el); }
  setTimeout(function(){ el.remove(); }, 4000);
}

function popularSelectSetor() {
  var sel = document.getElementById('setor');
  sel.innerHTML = '<option value="">Selecione o setor...</option>';
  setores.forEach(function(s) {
    var opt = document.createElement('option');
    opt.value = s.nome; opt.textContent = s.nome;
    sel.appendChild(opt);
  });
}

async function salvarPedido() {
  var err = document.getElementById('msg-erro');
  if (!v('data') || !v('setor') || !n('qtd') || !v('horario')) {
    err.style.display = 'block';
    err.textContent = 'Preencha os campos obrigatórios: Data, Setor, Quantidade de pessoas e Horário.';
    return;
  }
  err.style.display = 'none';
  var pedido = {
    id: Date.now(), data: v('data'), setor: v('setor'), qtd: n('qtd'),
    horario: v('horario'), pao: n('pao'), massinha: n('massinha'), cafe: n('cafe'),
    saborLanche: v('sabor-lanche'), choco260: n('choco260'), choco900: n('choco900'),
    refriLata: n('refri-lata'), refri2l: n('refri2l'), saborRefri: v('sabor-refri'),
    obs: v('obs'),
    criadoEm: new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })
  };
  try {
    await salvarPedidoSupabase(pedido);
    pedidos.unshift(pedido);
    limparForm();
    mostrarFeedback('sec-pedido', 'alert-success', '✅ Pedido salvo com sucesso!');
  } catch(e) {
    mostrarFeedback('sec-pedido', 'alert-danger', '❌ Erro ao salvar pedido. Verifique a conexão.');
    console.error(e);
  }
}

function badgeHorario(h) {
  if (h && h.indexOf('Manhã') >= 0)  return '<span class="badge badge-manha">Manhã 07:00</span>';
  if (h && h.indexOf('Tarde') >= 0)  return '<span class="badge badge-tarde">Tarde 15:00</span>';
  if (h && h.indexOf('Noite') >= 0)  return '<span class="badge badge-noite">Noite 20:00</span>';
  return '<span class="badge badge-madrugada">Madrugada</span>';
}

function renderPainel() {
  var totalPedidos = pedidos.length;
  var totalPessoas = pedidos.reduce(function(a,p){ return a+(p.qtd||0); },0);
  var totalLanches = pedidos.reduce(function(a,p){ return a+(p.pao||0)+(p.massinha||0); },0);
  var totalBebidas = pedidos.reduce(function(a,p){ return a+(p.choco260||0)+(p.choco900||0)+(p.refriLata||0)+(p.refri2l||0); },0);

  document.getElementById('stats-cards').innerHTML =
    '<div class="stat-card"><div class="stat-num">'+totalPedidos+'</div><div class="stat-lbl">Pedidos</div></div>'+
    '<div class="stat-card"><div class="stat-num">'+totalPessoas+'</div><div class="stat-lbl">Pessoas</div></div>'+
    '<div class="stat-card"><div class="stat-num">'+totalLanches+'</div><div class="stat-lbl">Lanches</div></div>'+
    '<div class="stat-card"><div class="stat-num">'+totalBebidas+'</div><div class="stat-lbl">Bebidas</div></div>';

  var lista = document.getElementById('lista-pedidos');
  if (!pedidos.length) { lista.innerHTML='<div class="empty">Nenhum pedido registrado ainda.</div>'; return; }

  lista.innerHTML = pedidos.map(function(p) {
    var dataFmt = p.data ? new Date(p.data+'T12:00:00').toLocaleDateString('pt-BR') : '—';
    var itens = [];
    if(p.pao)         itens.push('Pão: '+p.pao+' unid.');
    if(p.massinha)    itens.push('Massinha: '+p.massinha+' unid.');
    if(p.cafe)        itens.push('Café: '+p.cafe+' unid.');
    if(p.saborLanche) itens.push('Sabor: '+p.saborLanche);
    if(p.choco260)    itens.push('Chocoleite 260ml: '+p.choco260);
    if(p.choco900)    itens.push('Chocoleite 900ml: '+p.choco900);
    if(p.refriLata)   itens.push('Refri Lata: '+p.refriLata);
    if(p.refri2l)     itens.push('Refri 2L: '+p.refri2l+(p.saborRefri?' ('+p.saborRefri+')':''));
    return '<div class="pedido-item">'+
      '<div>'+badgeHorario(p.horario)+'</div>'+
      '<div>'+
        '<h3>'+p.setor.toUpperCase()+' — '+p.qtd+' pessoa'+(p.qtd>1?'s':'')+
          '<span style="font-size:11px;color:var(--text-hint);font-weight:400;"> &nbsp;📅 '+dataFmt+'</span></h3>'+
        '<p>'+(itens.length?itens.join(' · '):'Nenhum item registrado')+'</p>'+
        (p.obs?'<p style="margin-top:4px;color:var(--text-hint);">Obs: '+p.obs+'</p>':'')+
        '<p style="margin-top:4px;font-size:11px;color:var(--text-hint);">Registrado às '+p.criadoEm+'</p>'+
      '</div>'+
      '<button class="btn btn-outline" style="font-size:12px;padding:5px 12px;color:var(--danger-text);border-color:var(--danger-border);" onclick="excluirPedido('+p.id+')">Excluir</button>'+
    '</div>';
  }).join('');
}

async function excluirPedido(id) {
  if (!confirm('Excluir este pedido?')) return;
  try {
    await excluirPedidoSupabase(id);
    pedidos = pedidos.filter(function(p){ return p.id !== id; });
    renderPainel();
  } catch(e) {
    alert('Erro ao excluir pedido. Verifique a conexão.');
    console.error(e);
  }
}

async function limparTodos() {
  if (!confirm('Excluir TODOS os pedidos? Esta ação não pode ser desfeita.')) return;
  try {
    await sbFetch('pedidos?ativo=eq.true', { method: 'PATCH', body: JSON.stringify({ ativo: false }) });
    pedidos = [];
    renderPainel();
  } catch(e) {
    alert('Erro ao limpar pedidos. Verifique a conexão.');
    console.error(e);
  }
}

async function renderRelatorio() {
  var mesAtual = new Date().getMonth();
  var anoAtual = new Date().getFullYear();
  var meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  var selMes = document.getElementById('rel-filtro-mes');
  var selAno = document.getElementById('rel-filtro-ano');
  var filtroMes = selMes ? parseInt(selMes.value) : mesAtual;
  var filtroAno = selAno ? parseInt(selAno.value) : anoAtual;

  var todosDoPeriodo = [];
  try {
    todosDoPeriodo = await sbFetch('pedidos?order=id.desc');
  } catch(e) { console.error('Erro ao carregar relatório:', e); }

  var pedidosFiltrados = todosDoPeriodo.filter(function(p) {
    if (!p.data) return false;
    var d = new Date(p.data + 'T12:00:00');
    return d.getMonth() === filtroMes && d.getFullYear() === filtroAno;
  });

  var porSetor = {};
  pedidosFiltrados.forEach(function(p) {
    var s = p.setor || 'Sem setor';
    if (!porSetor[s]) porSetor[s] = { qtd:0, pao:0, massinha:0, cafe:0, choco260:0, choco900:0, refriLata:0, refri2l:0 };
    porSetor[s].qtd      += p.qtd        || 0;
    porSetor[s].pao      += p.pao        || 0;
    porSetor[s].massinha += p.massinha   || 0;
    porSetor[s].cafe     += p.cafe       || 0;
    porSetor[s].choco260 += p.choco260   || 0;
    porSetor[s].choco900 += p.choco900   || 0;
    porSetor[s].refriLata+= p.refri_lata || 0;
    porSetor[s].refri2l  += p.refri2l    || 0;
  });

  var optsMes = meses.map(function(m,i){
    return '<option value="'+i+'"'+(i===filtroMes?' selected':'')+'>'+m+'</option>';
  }).join('');

  var anosDisponiveis = [anoAtual-1, anoAtual, anoAtual+1];
  var optsAno = anosDisponiveis.map(function(a){
    return '<option value="'+a+'"'+(a===filtroAno?' selected':'')+'>'+a+'</option>';
  }).join('');

  var setoresOrdenados = Object.keys(porSetor).sort();

  var linhasTabela = setoresOrdenados.length ? setoresOrdenados.map(function(s) {
    var r = porSetor[s];
    var nomeEscapado = s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return '<tr style="border-bottom:1px solid var(--border);">'+
      '<td style="padding:9px 10px;font-weight:600;color:var(--text-primary);">'+s+'</td>'+
      '<td style="padding:9px 10px;text-align:center;">'+r.qtd+'</td>'+
      '<td style="padding:9px 10px;text-align:center;">'+(r.pao||'—')+'</td>'+
      '<td style="padding:9px 10px;text-align:center;">'+(r.massinha||'—')+'</td>'+
      '<td style="padding:9px 10px;text-align:center;">'+(r.cafe||'—')+'</td>'+
      '<td style="padding:9px 10px;text-align:center;">'+(r.choco260||'—')+'</td>'+
      '<td style="padding:9px 10px;text-align:center;">'+(r.choco900||'—')+'</td>'+
      '<td style="padding:9px 10px;text-align:center;">'+(r.refriLata||'—')+'</td>'+
      '<td style="padding:9px 10px;text-align:center;">'+(r.refri2l||'—')+'</td>'+
      '<td style="padding:9px 10px;text-align:center;">'+
        '<button class="btn-excluir-setor" onclick="event.stopPropagation();deletarSetorRelatorio(\''+nomeEscapado+'\')">🗑 Excluir</button>'+
      '</td>'+
    '</tr>';
  }).join('') : '<tr><td colspan="10" style="text-align:center;color:var(--text-hint);padding:28px;">Nenhum pedido registrado em '+meses[filtroMes]+'/'+filtroAno+'</td></tr>';

  var totalRow = setoresOrdenados.reduce(function(acc, s) {
    var r = porSetor[s];
    acc.qtd+=r.qtd; acc.pao+=r.pao; acc.massinha+=r.massinha; acc.cafe+=r.cafe;
    acc.choco260+=r.choco260; acc.choco900+=r.choco900; acc.refriLata+=r.refriLata; acc.refri2l+=r.refri2l;
    return acc;
  }, {qtd:0,pao:0,massinha:0,cafe:0,choco260:0,choco900:0,refriLata:0,refri2l:0});

  var totalLinhaHTML = setoresOrdenados.length ?
    '<tr style="background:var(--orange-bg);font-weight:700;border-top:2px solid var(--orange);">'+
      '<td style="padding:10px;color:var(--orange);">TOTAL</td>'+
      '<td style="padding:10px;text-align:center;">'+totalRow.qtd+'</td>'+
      '<td style="padding:10px;text-align:center;">'+(totalRow.pao||'—')+'</td>'+
      '<td style="padding:10px;text-align:center;">'+(totalRow.massinha||'—')+'</td>'+
      '<td style="padding:10px;text-align:center;">'+(totalRow.cafe||'—')+'</td>'+
      '<td style="padding:10px;text-align:center;">'+(totalRow.choco260||'—')+'</td>'+
      '<td style="padding:10px;text-align:center;">'+(totalRow.choco900||'—')+'</td>'+
      '<td style="padding:10px;text-align:center;">'+(totalRow.refriLata||'—')+'</td>'+
      '<td style="padding:10px;text-align:center;">'+(totalRow.refri2l||'—')+'</td>'+
      '<td></td>'+
    '</tr>' : '';

  var conteudo =
    '<div class="card">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:1.25rem;">'+
        '<h2 class="card-title" style="margin-bottom:0;">📊 Relatório Mensal por Setor</h2>'+
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'+
          '<select id="rel-filtro-mes" onchange="renderRelatorio()" style="padding:7px 12px;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-input);color:var(--text-primary);font-family:var(--font);font-size:13px;cursor:pointer;">'+optsMes+'</select>'+
          '<select id="rel-filtro-ano" onchange="renderRelatorio()" style="padding:7px 12px;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-input);color:var(--text-primary);font-family:var(--font);font-size:13px;cursor:pointer;">'+optsAno+'</select>'+
          '<button class="btn btn-primary" onclick="exportarRelatorio()" style="font-size:13px;">⬇️ Exportar CSV</button>'+
        '</div>'+
      '</div>'+
      '<p class="card-hint">Consolidado de todos os pedidos do período, agrupado por setor.</p>'+
      '<div style="overflow-x:auto;">'+
        '<table style="width:100%;border-collapse:collapse;font-size:13px;">'+
          '<thead>'+
            '<tr style="border-bottom:2px solid var(--border);background:var(--bg-page);">'+
              '<th style="text-align:left;padding:9px 10px;color:var(--text-secondary);font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Setor</th>'+
              '<th style="padding:9px 10px;color:var(--text-secondary);font-size:11px;text-transform:uppercase;text-align:center;">Pessoas</th>'+
              '<th style="padding:9px 10px;color:var(--text-secondary);font-size:11px;text-transform:uppercase;text-align:center;">Pão</th>'+
              '<th style="padding:9px 10px;color:var(--text-secondary);font-size:11px;text-transform:uppercase;text-align:center;">Massinha</th>'+
              '<th style="padding:9px 10px;color:var(--text-secondary);font-size:11px;text-transform:uppercase;text-align:center;">Café</th>'+
              '<th style="padding:9px 10px;color:var(--text-secondary);font-size:11px;text-transform:uppercase;text-align:center;">260ml</th>'+
              '<th style="padding:9px 10px;color:var(--text-secondary);font-size:11px;text-transform:uppercase;text-align:center;">900ml</th>'+
              '<th style="padding:9px 10px;color:var(--text-secondary);font-size:11px;text-transform:uppercase;text-align:center;">R.Lata</th>'+
              '<th style="padding:9px 10px;color:var(--text-secondary);font-size:11px;text-transform:uppercase;text-align:center;">R.2L</th>'+
              '<th style="padding:9px 10px;"></th>'+
            '</tr>'+
          '</thead>'+
          '<tbody>'+linhasTabela+totalLinhaHTML+'</tbody>'+
        '</table>'+
      '</div>'+
    '</div>';

  document.getElementById('sec-relatorio').innerHTML = conteudo;
}

async function deletarSetorRelatorio(nomeSetor) {
  var filtroMes = parseInt(document.getElementById('rel-filtro-mes').value);
  var filtroAno = parseInt(document.getElementById('rel-filtro-ano').value);

  // Busca os IDs do setor na hora de excluir
  var todos = [];
  try { todos = await sbFetch('pedidos?order=id.desc'); } catch(e) { alert('Erro ao buscar pedidos.'); return; }

  var ids = todos
    .filter(function(p) {
      if (!p.data || p.setor !== nomeSetor) return false;
      var d = new Date(p.data + 'T12:00:00');
      return d.getMonth() === filtroMes && d.getFullYear() === filtroAno;
    })
    .map(function(p) { return p.id; });

  if (!ids.length) { alert('Nenhum pedido encontrado para este setor.'); return; }
  if (!confirm('Excluir ' + ids.length + ' pedido(s) do setor "' + nomeSetor + '"?\nEsta ação não pode ser desfeita.')) return;

  try {
    await Promise.all(ids.map(function(id) {
      return sbFetch('pedidos?id=eq.' + id, { method: 'PATCH', body: JSON.stringify({ ativo: false }) });
    }));
    renderRelatorio();
  } catch(e) {
    alert('Erro ao excluir. Verifique a conexão.');
    console.error(e);
  }
}

async function exportarRelatorio() {
  var filtroMes = parseInt(document.getElementById('rel-filtro-mes').value);
  var filtroAno = parseInt(document.getElementById('rel-filtro-ano').value);
  var meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  var todosDoPeriodo = [];
  try { todosDoPeriodo = await sbFetch('pedidos?order=id.desc'); }
  catch(e) { console.error(e); return; }

  var pedidosFiltrados = todosDoPeriodo.filter(function(p) {
    if (!p.data) return false;
    var d = new Date(p.data + 'T12:00:00');
    return d.getMonth() === filtroMes && d.getFullYear() === filtroAno;
  });

  var porSetor = {};
  pedidosFiltrados.forEach(function(p) {
    var s = p.setor || 'Sem setor';
    if (!porSetor[s]) porSetor[s] = { qtd:0, pao:0, massinha:0, cafe:0, choco260:0, choco900:0, refriLata:0, refri2l:0 };
    porSetor[s].qtd      += p.qtd        || 0;
    porSetor[s].pao      += p.pao        || 0;
    porSetor[s].massinha += p.massinha   || 0;
    porSetor[s].cafe     += p.cafe       || 0;
    porSetor[s].choco260 += p.choco260   || 0;
    porSetor[s].choco900 += p.choco900   || 0;
    porSetor[s].refriLata+= p.refri_lata || 0;
    porSetor[s].refri2l  += p.refri2l    || 0;
  });

  var csv = 'Setor;Pessoas;Pão;Massinha;Café;Chocoleite 260ml;Chocoleite 900ml;Refri Lata;Refri 2L\n';
  Object.keys(porSetor).sort().forEach(function(s) {
    var r = porSetor[s];
    csv += [s, r.qtd, r.pao, r.massinha, r.cafe, r.choco260, r.choco900, r.refriLata, r.refri2l].join(';') + '\n';
  });

  var blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'relatorio-lanches-'+meses[filtroMes]+'-'+filtroAno+'.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function renderSetores() {
  var lista = document.getElementById('lista-setores');
  if (!setores.length) { lista.innerHTML = '<div class="empty">Nenhum setor cadastrado.</div>'; return; }
  lista.innerHTML = setores.map(function(s) {
    return '<div class="setor-item">'+
      '<span class="setor-nome">'+s.nome+'</span>'+
      '<button class="btn btn-outline" style="font-size:12px;padding:4px 12px;color:var(--danger-text);border-color:var(--danger-border);" onclick="excluirSetor('+s.id+',\''+s.nome.replace(/'/g,"\\'")+'\')">' +
        'Remover</button>'+
    '</div>';
  }).join('');
}

function adicionarSetor() {
  var nome  = document.getElementById('novo-setor').value.trim();
  var msgEl = document.getElementById('msg-setor');
  msgEl.style.display = 'none';
  if (!nome) {
    msgEl.className = 'alert alert-danger';
    msgEl.textContent = 'Digite o nome do setor.';
    msgEl.style.display = 'block';
    return;
  }
  var existe = setores.some(function(s){ return s.nome.toLowerCase() === nome.toLowerCase(); });
  if (existe) {
    msgEl.className = 'alert alert-danger';
    msgEl.textContent = 'Setor "' + nome + '" já existe.';
    msgEl.style.display = 'block';
    return;
  }
  var novoId = setores.length ? Math.max.apply(null, setores.map(function(s){ return s.id; })) + 1 : 1;
  setores.push({ id: novoId, nome: nome });
  salvarSetoresStorage();
  popularSelectSetor();
  document.getElementById('novo-setor').value = '';
  msgEl.className = 'alert alert-success';
  msgEl.textContent = '✅ Setor "' + nome + '" adicionado!';
  msgEl.style.display = 'block';
  setTimeout(function(){ msgEl.style.display='none'; }, 2500);
  renderSetores();
}

function excluirSetor(id, nome) {
  if (!confirm('Remover o setor "' + nome + '"?')) return;
  setores = setores.filter(function(s){ return s.id !== id; });
  salvarSetoresStorage();
  popularSelectSetor();
  renderSetores();
}

function salvarSetoresStorage() {
  localStorage.setItem('setores_usimetal', JSON.stringify(setores));
}

function gerarMensagem() {
  if (!pedidos.length) return 'Nenhum pedido registrado.';
  var agora = new Date().toLocaleString('pt-BR');
  var sep   = '──────────────────────────────────────';
  var msg   = ' USIMETAL — PEDIDO DE LANCHE (HORA EXTRA)\n Gerado em: '+agora+'\n'+sep+'\n';
  pedidos.forEach(function(p,i){
    var dataFmt = p.data ? new Date(p.data+'T12:00:00').toLocaleDateString('pt-BR') : '—';
    msg += '\n*'+(i+1)+'. '+p.setor.toUpperCase()+'*\n';
    msg += '• Data: '+dataFmt+'\n• Horário: '+p.horario+'\n• Pessoas: '+p.qtd+'\n';
    if(p.pao)         msg+='• Pão: '+p.pao+' unid.\n';
    if(p.massinha)    msg+='• Massinha: '+p.massinha+' unid.\n';
    if(p.cafe)        msg+='• Café: '+p.cafe+' unid.\n';
    if(p.saborLanche) msg+='• Sabor/Tipo: '+p.saborLanche+'\n';
    if(p.choco260)    msg+='• Chocoleite 260ml: '+p.choco260+'\n';
    if(p.choco900)    msg+='• Chocoleite 900ml: '+p.choco900+'\n';
    if(p.refriLata)   msg+='• Refri Lata: '+p.refriLata+'\n';
    if(p.refri2l)     msg+='• Refri 2L: '+p.refri2l+(p.saborRefri?' ('+p.saborRefri+')':'')+'\n';
    if(p.obs)         msg+='• Obs: '+p.obs+'\n';
  });
  msg+='\n'+sep+'\n TOTAL\n';
  msg+=' Pessoas: '+pedidos.reduce(function(a,p){return a+(p.qtd||0);},0)+'\n';
  var tp=pedidos.reduce(function(a,p){return a+(p.pao||0);},0);
  var tm=pedidos.reduce(function(a,p){return a+(p.massinha||0);},0);
  var tc=pedidos.reduce(function(a,p){return a+(p.cafe||0);},0);
  var tc2=pedidos.reduce(function(a,p){return a+(p.choco260||0);},0);
  var tc9=pedidos.reduce(function(a,p){return a+(p.choco900||0);},0);
  var trl=pedidos.reduce(function(a,p){return a+(p.refriLata||0);},0);
  var tr2=pedidos.reduce(function(a,p){return a+(p.refri2l||0);},0);
  if(tp)  msg+=' Pão: '+tp+' unid.\n';
  if(tm)  msg+=' Massinha: '+tm+' unid.\n';
  if(tc)  msg+=' Café: '+tc+' unid.\n';
  if(tc2) msg+=' Chocoleite 260ml: '+tc2+'\n';
  if(tc9) msg+=' Chocoleite 900ml: '+tc9+'\n';
  if(trl) msg+=' Refri Lata: '+trl+'\n';
  if(tr2) msg+=' Refri 2L: '+tr2+'\n';
  return msg;
}

function renderWpp() {
  var msg = gerarMensagem();
  var el  = document.getElementById('wpp-text');
  el.textContent = msg; el.dataset.msg = msg;
}

function copiarWpp() {
  var txt = document.getElementById('wpp-text').dataset.msg || document.getElementById('wpp-text').textContent;
  navigator.clipboard.writeText(txt).then(function(){
    var el = document.getElementById('msg-copiado');
    el.style.display='block';
    setTimeout(function(){ el.style.display='none'; },2500);
  });
}

function abrirWpp() {
  var txt = encodeURIComponent(document.getElementById('wpp-text').dataset.msg||document.getElementById('wpp-text').textContent);
  window.open('https://wa.me/?text='+txt,'_blank');
}

function abrirPin(aba) {
  if (rhAutenticado) { setTab(aba); return; }
  pinDestino = aba;
  limparCamposPin();
  document.getElementById('pin-overlay').classList.add('open');
  setTimeout(function(){ document.getElementById('pin0').focus(); },100);
}

function fecharPin() {
  document.getElementById('pin-overlay').classList.remove('open');
  pinDestino = null;
  limparCamposPin();
}

function fecharPinOverlay(e) {
  if (e.target === document.getElementById('pin-overlay')) fecharPin();
}

function limparCamposPin() {
  for (var i=0; i<4; i++) {
    var el = document.getElementById('pin'+i);
    el.value=''; el.classList.remove('erro');
  }
  document.getElementById('pin-erro').textContent='';
}

function pinDigit(idx) {
  var el = document.getElementById('pin'+idx);
  el.value = el.value.replace(/[^0-9]/g,'').slice(-1);
  if (el.value && idx<3) document.getElementById('pin'+(idx+1)).focus();
  if (idx===3 && el.value) confirmarPin();
}

function pinKey(e, idx) {
  if (e.key==='Backspace' && !document.getElementById('pin'+idx).value && idx>0)
    document.getElementById('pin'+(idx-1)).focus();
  if (e.key==='Enter')  confirmarPin();
  if (e.key==='Escape') fecharPin();
}

async function confirmarPin() {
  if (!document.getElementById('pin-overlay').classList.contains('open')) return;
  var digitado = [0,1,2,3].map(function(i){ return document.getElementById('pin'+i).value; }).join('');
  if (digitado.length<4) { document.getElementById('pin-erro').textContent='Digite os 4 dígitos.'; return; }
  var hashDigitado = await sha256(digitado);
  if (hashDigitado === PIN_HASH) {
    rhAutenticado = true;
    var destino = pinDestino;
    fecharPin();
    setTab(destino);
    var badge = document.getElementById('rh-badge');
    if (badge) badge.style.display='inline-flex';
  } else {
    document.getElementById('pin-erro').textContent='PIN incorreto. Tente novamente.';
    for (var i=0; i<4; i++) {
      var el=document.getElementById('pin'+i);
      el.classList.add('erro'); el.value='';
    }
    setTimeout(function(){
      for(var i=0;i<4;i++) document.getElementById('pin'+i).classList.remove('erro');
      document.getElementById('pin0').focus();
    },600);
  }
}

function sairRH() {
  rhAutenticado = false;
  setTab('pedido');
  var badge = document.getElementById('rh-badge');
  if (badge) badge.style.display='none';
}

document.addEventListener('DOMContentLoaded', function() {
  var setoresSalvos = localStorage.getItem('setores_usimetal');
  if (setoresSalvos) { setores = JSON.parse(setoresSalvos); }
  popularSelectSetor();
  updateRelogio();
  setInterval(updateRelogio, 30000);
  document.getElementById('data').value = new Date().toISOString().split('T')[0];
  carregarPedidos();
});