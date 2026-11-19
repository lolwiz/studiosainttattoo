'use strict';
/* =====================================================================
   STUDIO SAINT TATTOO – Agenda e Financeiro  (site versão 8)
   Tudo roda no GitHub:
   - o site fica no GitHub Pages (repositório público)
   - os dados ficam num arquivo JSON num repositório PRIVADO, gravado pela
     API do GitHub com um token guardado em cada aparelho
   - sem internet, tudo fica salvo no aparelho e sincroniza depois
   - a senha de acesso fica no arquivo config.js
   ===================================================================== */
const SITE_VERSAO = 8;
const ARQ_DADOS = 'saint-tattoo-dados.json';
const K = { cfg: 'sst_cfg', db: 'sst_db', sess: 'sst_sess', hide: 'sst_hide', tab: 'sst_tab', wa: 'sst_wa' };
const COLS = ['ag', 'serv', 'tax', 'cx', 'cfg', 'fp', 'fm'];
const ST_ATIVOS = ['Pendente', 'Confirmado'];
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MES3 = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const CAT_SAIDA = ['Material (tintas, agulhas, descartáveis)','Aluguel','Contas (luz, água, internet)','Comissão de tatuador','Marketing','Manutenção / equipamentos','Retirada','Outros'];
const CAT_ENTRADA = ['Venda de produto','Aporte','Outros'];

/* ---------------- utilidades ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const R = v => brl.format(r2(v));
const V = v => `<span class="v">${R(v)}</span>`;
const r2 = n => Math.round((+n || 0) * 100) / 100;
const num = s => { if (typeof s === 'number') return isFinite(s) ? s : 0; s = String(s || '').trim().replace(/\s|R\$/g, ''); if (!s) return 0; if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); const n = parseFloat(s); return isFinite(n) ? n : 0; };
const nf = n => r2(n).toFixed(2).replace('.', ',');
const pct = n => String(r2(n)).replace('.', ',');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const hoje = () => iso(new Date());
const agoraHM = () => new Date().toTimeString().slice(0, 5);
const br = s => s ? String(s).split('-').reverse().join('/') : '';
const brCurto = s => { const d = pd(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} (${DIAS[d.getDay()]})`; };
const somaDias = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return iso(d); };
const kfmt = v => Math.abs(v) >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k' : Math.round(v).toString();
const norm = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
let toastT;
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }

/* ---------------- base64 / criptografia ---------------- */
function u8b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function b64u8(b64) { const s = atob(String(b64).replace(/\s/g, '')); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
const b64enc = txt => u8b64(new TextEncoder().encode(txt));
const b64dec = b64 => new TextDecoder().decode(b64u8(b64));
async function chave(senha, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function decifrar(senha, e) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64u8(e.iv) }, await chave(senha, b64u8(e.salt)), b64u8(e.ct));
  return new TextDecoder().decode(pt);
}

/* ---------------- dados locais ---------------- */
const vazio = () => { const o = {}; COLS.forEach(k => o[k] = []); return o; };
function normDados(d) { const o = vazio(); if (d && typeof d === 'object') for (const k of COLS) if (Array.isArray(d[k])) o[k] = d[k].filter(r => r && r.id); return o; }
function lerLS(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function gravarLS(k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch (e) { toast('⚠️ Não consegui salvar no aparelho: ' + e.message, 5000); return false; } }
let DB = (() => { const d = lerLS(K.db); return d && d.data ? { data: normDados(d.data), pend: d.pend || 0, last: d.last || 0 } : { data: vazio(), pend: 0, last: 0 }; })();
const salvarDB = () => gravarLS(K.db, DB);
const viva = k => DB.data[k].filter(r => !r.del);
function put(k, rec) {
  const arr = DB.data[k], i = arr.findIndex(r => r.id === rec.id);
  rec.u = Math.max(Date.now(), i >= 0 ? (arr[i].u || 0) + 1 : 0);
  if (i >= 0) arr[i] = rec; else arr.push(rec);
}
function apagar(k, id) { put(k, { id, del: 1 }); }
function alterou() { DB.pend++; salvarDB(); renderTudo(); agendarSync(); }
const cfgGet = (id, def) => { const r = DB.data.cfg.find(r => r.id === id && !r.del); return r ? r.v : def; };
const cfgSet = (id, v) => put('cfg', { id, v });

function semear() {
  const temSeed = (k, id) => DB.data[k].some(r => r.id === id);
  const serv = ['Tatuagem', 'Sessão fechada (diária)', 'Cover-up', 'Retoque', 'Piercing', 'Orçamento / consulta'];
  serv.forEach((n, i) => { const id = 'serv-' + i; if (!temSeed('serv', id)) DB.data.serv.push({ id, nome: n, valor: 0, ord: i, u: 1 }); });
  const tax = ['Pix', 'Dinheiro', 'Débito', ...Array.from({ length: 12 }, (_, i) => `Crédito ${i + 1}x`), 'Permuta'];
  tax.forEach((n, i) => { const id = 'tax-' + i; if (!temSeed('tax', id)) DB.data.tax.push({ id, nome: n, taxa: 0, ord: i, u: 1 }); });
  semearFrigobar(temSeed);
}

/* ---------------- frigobar: produtos do cardápio e estoque inicial ---------------- */
const FRIGO_INI = [
  // id, nome, preço, grátis, controla estoque, estoque inicial
  ['fp-0', 'Coca-Cola lata', 5, false, true, 4],
  ['fp-1', 'Coca-Cola Zero lata', 5, false, true, 2],
  ['fp-2', 'Schweppes', 5, false, true, 3],
  ['fp-3', 'Sol', 9, false, true, 6],
  ['fp-4', 'Spaten', 9, false, true, 4],
  ['fp-5', 'Heineken', 0, false, true, 10],
  ['fp-6', 'Monster', 11, false, true, 4],
  ['fp-7', 'Água sem gás', 0, true, true, 4],
  ['fp-8', 'Água com gás', 0, true, true, 4],
  ['fp-9', 'Café', 0, true, false, 0],
  ['fp-10', 'Snack', 0, true, false, 0]
];
function semearFrigobar(temSeed) {
  FRIGO_INI.forEach(([id, nome, preco, gratis, controla], i) => { if (!temSeed('fp', id)) DB.data.fp.push({ id, nome, preco, custo: 0, min: controla ? 2 : 0, gratis, controla, ord: i, u: 1 }); });
  if (!temSeed('fm', 'fm-ini')) DB.data.fm.push({ id: 'fm-ini', tipo: 'inicial', data: hoje(), hora: '', desc: 'Estoque inicial', valor: 0, itens: FRIGO_INI.filter(p => p[5] > 0).map(p => ({ p: p[0], nome: p[1], q: p[5], v: 0 })), u: 1 });
}

/* ---------------- taxas InfinitePay (Visa e Mastercard, recebimento em 1 dia útil) ----------------
   Fonte: tabela oficial infinitepay.io/taxas. Ordem: Débito, Crédito 1x (à vista), 2x ... 12x */
const INFINITEPAY = {
  ate20: { nome: 'Plano Inicial (até R$ 20 mil/mês)', t: [1.37, 3.15, 5.39, 6.12, 6.85, 7.57, 8.28, 8.99, 9.69, 10.38, 11.06, 11.74, 12.40] },
  ac20:  { nome: 'Acima de R$ 20 mil/mês', t: [0.85, 2.89, 4.22, 4.83, 5.44, 6.05, 6.64, 7.24, 7.82, 8.41, 8.98, 9.56, 10.12] },
  ac40:  { nome: 'Acima de R$ 40 mil/mês', t: [0.79, 2.79, 4.08, 4.65, 5.21, 5.77, 6.32, 6.87, 7.42, 7.96, 8.49, 9.03, 9.56] },
  ac80:  { nome: 'Acima de R$ 80 mil/mês', t: [0.75, 2.69, 3.94, 4.46, 4.98, 5.49, 5.99, 6.51, 6.99, 7.51, 7.99, 8.49, 8.99] }
};
/* aplica a tabela nas formas padrão (Pix grátis, Dinheiro e Permuta 0%). Não muda atendimentos já finalizados. */
function aplicarInfinity(faixa) {
  const t = INFINITEPAY[faixa].t;
  const alvo = { 'tax-0': 0, 'tax-1': 0, 'tax-2': t[0], 'tax-15': 0 };
  for (let i = 1; i <= 12; i++) alvo['tax-' + (i + 2)] = t[i];
  for (const [id, taxa] of Object.entries(alvo)) { const r = DB.data.tax.find(x => x.id === id); if (r && !r.del) put('tax', { ...r, taxa }); }
  cfgSet('maquininha', { marca: 'InfinitePay', faixa });
}
/* 1ª vez: aplica o Plano Inicial sozinho (só depois de sincronizar, para não sobrescrever o que outro aparelho já ajustou) */
function migrarInfinity() { if (cfgGet('maquininha', null)) return false; aplicarInfinity('ate20'); return true; }

/* ---------------- cálculos ---------------- */
const taxaDe = forma => { const t = viva('tax').find(t => t.nome === forma); return t ? num(t.taxa) : 0; };
const nomesServ = a => (a.servicos || []).map(s => s.nome).filter(Boolean);
const txtServ = a => nomesServ(a).join(' + ') || '—';
function calc(a, over = {}) {
  const x = Object.assign({}, a, over);
  const bruto = r2((x.servicos || []).reduce((s, l) => s + num(l.valor), 0));
  const desc = Math.min(num(x.desconto), bruto);
  const cobrado = r2(bruto - desc);
  const sinal = r2(num(x.sinal));
  const txS = x.txS != null ? num(x.txS) : taxaDe(x.sinalForma);
  const rest = r2(Math.max(0, cobrado - sinal));
  const txR = x.txR != null && !over.forma ? num(x.txR) : taxaDe(x.forma);
  const taxaS = r2(sinal * txS / 100), taxaR = r2(rest * txR / 100);
  return { bruto, desc, cobrado, sinal, rest, taxaS, taxaR, taxa: r2(taxaS + taxaR), sinalLiq: r2(sinal - taxaS), restLiq: r2(rest - taxaR), liquido: r2(sinal + rest - taxaS - taxaR) };
}
const passou = a => `${a.data}T${a.hora || '23:59'}` <= `${hoje()}T${agoraHM()}`;
const emAberto = a => ST_ATIVOS.includes(a.status) && passou(a);
const sinalRetido = a => (a.status === 'Faltou' || a.status === 'Cancelado') && num(a.sinal) > 0 && !a.sinalDev;
/* receita reconhecida na data do atendimento */
function receitas() {
  const out = [];
  for (const a of viva('ag')) {
    if (a.status === 'Finalizado') { const c = calc(a); out.push({ a, c, tipo: 'at', liq: c.liquido }); }
    else if (sinalRetido(a)) { const c = calc(a); out.push({ a, c, tipo: 'ret', liq: c.sinalLiq }); }
  }
  return out;
}
const ordAg = (x, y) => (x.data + (x.hora || '')).localeCompare(y.data + (y.hora || ''));
const doDia = d => viva('ag').filter(a => a.data === d).sort(ordAg);
function corDia(lst) {
  const at = lst.filter(a => a.status !== 'Cancelado');
  if (!at.length) return '';
  if (at.some(emAberto)) return 'verm';
  if (at.every(a => a.status === 'Finalizado' || a.status === 'Faltou')) return 'verde';
  return '';
}
function telWa(t) { let d = String(t || '').replace(/\D/g, ''); if (!d) return ''; if (d.length <= 11) d = '55' + d; return `https://wa.me/${d}`; }

/* ---------------- lembrete do próximo dia (WhatsApp) ---------------- */
const MSG_PADRAO = 'Olá, {nome}! 🖤\nPassando para lembrar do seu horário no *Studio Saint Tattoo* {quando}, *{data}*, às *{hora}*.\nServiço: {servico}{sessao}\n\nPor favor, confirme respondendo esta mensagem. Até lá! ✨';
const DIAS_EXT = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
function textoLembrete(a, modelo) {
  const d = pd(a.data), amanha = somaDias(hoje(), 1);
  const quando = a.data === amanha ? 'amanhã' : a.data === hoje() ? 'hoje' : DIAS_EXT[d.getDay()];
  const nome = String(a.cliente || '').trim().split(/\s+/)[0] || '';
  const map = { nome, nomecompleto: a.cliente || '', quando, dia: DIAS_EXT[d.getDay()], data: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, hora: a.hora || '', servico: txtServ(a), tatuador: a.tatuador || '',
    sessao: a.sessao ? ` – sessão ${a.sessao}${a.totalSessoes ? ' de ' + a.totalSessoes : ''}` : '', sinal: num(a.sinal) ? R(a.sinal) : '' };
  return String(modelo ?? cfgGet('msgLembrete', MSG_PADRAO)).replace(/\{(\w+)\}/g, (m, k) => k.toLowerCase() in map ? map[k.toLowerCase()] : m);
}
/* Abre o WhatsApp com o texto já escrito.
   Celular: abre direto o app (whatsapp://send) – é o jeito que mantém o texto no iPhone.
   Computador: usa api.whatsapp.com/send (app ou WhatsApp Web).
   Além disso o texto é copiado, para colar caso o WhatsApp não preencha. */
const ehCelular = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function foneWa(t) { let d = String(t || '').replace(/\D/g, ''); if (!d) return ''; if (d.length <= 11) d = '55' + d; return d; }
/* Jeitos de abrir o WhatsApp (escolha salva em cada aparelho, pois cada um se comporta diferente) */
const MODOS_WA = [
  ['auto', 'Automático'],
  ['app', 'App do WhatsApp (whatsapp://)'],
  ['wame', 'Link wa.me'],
  ['web', 'WhatsApp Web (navegador)'],
  ['share', 'Compartilhar (escolher WhatsApp e o contato)']
];
const modoWa = () => { const m = localStorage.getItem(K.wa) || 'auto'; return m === 'auto' ? (ehCelular() ? 'app' : 'web') : m; };
/* tira caracteres invisíveis que alguns WhatsApp não aceitam no link */
const textoLimpo = a => textoLembrete(a).replace(/[\uFE0E\uFE0F\u200D]/g, '').replace(/\r/g, '');
function linkLembrete(a, modo) {
  const f = foneWa(a.tel); if (!f) return '';
  const tx = encodeURIComponent(textoLimpo(a)), m = modo || modoWa();
  if (m === 'app') return `whatsapp://send?phone=${f}&text=${tx}`;
  if (m === 'wame') return `https://wa.me/${f}?text=${tx}`;
  if (m === 'web') return `https://web.whatsapp.com/send?phone=${f}&text=${tx}`;
  if (m === 'share') return 'share:';
  return `https://api.whatsapp.com/send?phone=${f}&text=${tx}`;
}
async function copiarTexto(tx) {
  try { await navigator.clipboard.writeText(tx); return true; } catch (e) {}
  try { const ta = document.createElement('textarea'); ta.value = tx; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, tx.length); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch (e) { return false; }
}
async function enviarLembrete(a) {
  const tx = textoLimpo(a), m = modoWa(), lk = linkLembrete(a, m); if (!lk) return;
  put('ag', { ...a, lembrete: Date.now() }); alterou();
  if (m === 'share') {
    if (navigator.share) { try { await navigator.share({ text: tx }); } catch (e) {} return; }
    toast('Este aparelho não tem "Compartilhar". Escolha outro jeito em "Abrir pelo".', 5000); return;
  }
  copiarTexto(tx).then(ok => { if (ok) toast('📋 Mensagem copiada. Se não aparecer escrita, toque no campo do WhatsApp e escolha Colar.', 6000); });
  if (lk.startsWith('whatsapp:')) location.href = lk; else window.open(lk, '_blank', 'noopener');
}
function diaLembretes() { const hj = hoje(); const p = viva('ag').filter(a => a.data > hj && ST_ATIVOS.includes(a.status)).sort(ordAg)[0]; return p ? p.data : ''; }
function renderLembretes() {
  const sw = $('#waModo'); if (sw && !sw.options.length) { sw.innerHTML = MODOS_WA.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join(''); sw.value = localStorage.getItem(K.wa) || 'auto'; }
  const dia = diaLembretes(), card = $('#cardLemb');
  if (!dia) { card.classList.add('hid'); return; }
  const lst = doDia(dia).filter(a => ST_ATIVOS.includes(a.status));
  const falta = lst.filter(a => !a.lembrete).length;
  card.classList.remove('hid');
  $('#lembTit').textContent = `${dia === somaDias(hoje(), 1) ? 'Amanhã' : 'Próximo dia'} · ${brCurto(dia)}`;
  $('#lembN').innerHTML = falta ? `<span class="et bx">${falta} a enviar</span>` : '<span class="et okk">todos avisados</span>';
  $('#lstLemb').innerHTML = lst.map(a => {
    const lk = linkLembrete(a), env = a.lembrete ? new Date(a.lembrete) : null;
    const st = env ? `<span class="et okk">✅ avisado ${pad(env.getDate())}/${pad(env.getMonth() + 1)} ${pad(env.getHours())}:${pad(env.getMinutes())}</span>` : '';
    return `<div class="at" data-lid="${a.id}"><span class="h">${esc(a.hora || '--:--')}</span>
      <div class="info"><b>${esc(a.cliente)}</b><small>${esc(txtServ(a))}${a.tel ? ' · ' + esc(a.tel) : ' · <span class="neg">sem telefone</span>'} <span class="et st-${esc(a.status)}">${esc(a.status)}</span> ${st}</small></div>
      ${lk ? `<button class="btn ${env ? 'l' : 'ok'} s" type="button" data-lw="${a.id}">📲 ${env ? 'Reenviar' : 'Enviar'}</button><button class="ib" type="button" data-lcp="${a.id}" title="Copiar mensagem" aria-label="Copiar mensagem">📋</button>` : `<button class="btn l s" type="button" data-led="${a.id}">✏️ Pôr telefone</button>`}
      ${a.status === 'Pendente' ? `<button class="ib ok" type="button" data-lconf="${a.id}" title="Cliente confirmou" aria-label="Cliente confirmou">👍</button>` : ''}
    </div>`;
  }).join('');
}


/* ---------------- sincronização GitHub ---------------- */
let CFG = lerLS(K.cfg), TOKEN = null, syncando = false, syncDeNovo = false, syncErro = '', syncT = null;
const modoLocal = () => !CFG || CFG.local;
const urlArq = () => `/repos/${encodeURIComponent(CFG.owner)}/${encodeURIComponent(CFG.repo)}/contents/${ARQ_DADOS}`;
function gh(path, opt = {}) {
  return fetch('https://api.github.com' + path, Object.assign({}, opt, { cache: 'no-store', headers: Object.assign({ Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + TOKEN }, opt.headers || {}) }));
}
async function erroGH(r) {
  let m = ''; try { m = (await r.json()).message || ''; } catch (e) {}
  if (r.status === 401) return 'Token inválido ou vencido (401). Gere um token novo e reconecte o aparelho.';
  if (r.status === 403) return 'Sem permissão (403). Confira se o token tem "Contents: Read and write" no repositório de dados. ' + m;
  if (r.status === 404) return 'Repositório não encontrado (404). Confira o usuário, o nome do repositório e o acesso do token.';
  return `Erro ${r.status} do GitHub. ${m}`;
}
async function lerRemoto() {
  const r = await gh(urlArq() + '?ref=' + encodeURIComponent(CFG.branch || 'main') + '&t=' + Date.now());
  if (r.status === 404) return { data: vazio(), sha: null };
  if (!r.ok) throw new Error(await erroGH(r));
  const j = await r.json();
  let b64 = j.content;
  if (!b64 && j.sha) {
    const rb = await gh(`/repos/${encodeURIComponent(CFG.owner)}/${encodeURIComponent(CFG.repo)}/git/blobs/${j.sha}`);
    if (!rb.ok) throw new Error(await erroGH(rb));
    b64 = (await rb.json()).content;
  }
  const txt = b64 ? b64dec(b64) : '';
  return { data: normDados(txt.trim() ? JSON.parse(txt) : null), sha: j.sha };
}
async function gravarRemoto(data, sha) {
  const body = { message: 'Dados atualizados em ' + new Date().toLocaleString('pt-BR'), content: b64enc(JSON.stringify(data)), branch: CFG.branch || 'main' };
  if (sha) body.sha = sha;
  const r = await gh(urlArq(), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (r.status === 409 || r.status === 422) { const e = new Error('conflito'); e.conflito = true; throw e; }
  if (!r.ok) throw new Error(await erroGH(r));
}
function mesclar(a, b) {
  const o = vazio();
  for (const k of COLS) {
    const m = new Map();
    for (const r of a[k] || []) m.set(r.id, r);
    for (const r of b[k] || []) { const x = m.get(r.id); if (!x || (r.u || 0) > (x.u || 0)) m.set(r.id, r); }
    o[k] = [...m.values()];
  }
  return o;
}
const canon = d => JSON.stringify(COLS.map(k => [...(d[k] || [])].sort((x, y) => x.id < y.id ? -1 : 1)));
function agendarSync(ms = 1500) { clearTimeout(syncT); syncT = setTimeout(() => sincronizar(false), ms); }
async function sincronizar(manual) {
  if (modoLocal() || !TOKEN) { renderStatus(); if (manual) toast('Modo local: este aparelho não sincroniza.'); return; }
  if (!navigator.onLine) { renderStatus(); if (manual) toast('Sem internet. As alterações ficam guardadas no aparelho.'); return; }
  if (syncando) { syncDeNovo = true; return; }
  syncando = true; renderStatus();
  try {
    let ok = false;
    for (let t = 0; t < 5 && !ok; t++) {
      const pend0 = DB.pend;
      const rem = await lerRemoto();
      const junt = mesclar(rem.data, DB.data);
      if (canon(junt) !== canon(rem.data)) {
        try { await gravarRemoto(junt, rem.sha); }
        catch (e) { if (e.conflito) { await new Promise(r => setTimeout(r, 400 + t * 400)); continue; } throw e; }
      }
      DB.data = mesclar(junt, DB.data);
      if (DB.pend === pend0) DB.pend = 0;
      DB.last = Date.now(); ok = true;
    }
    if (!ok) throw new Error('Outro aparelho está gravando ao mesmo tempo. Tente de novo em instantes.');
    semear(); if (migrarInfinity()) { DB.pend++; syncDeNovo = true; } salvarDB(); syncErro = '';
    if (manual) toast('✅ Sincronizado');
  } catch (e) {
    syncErro = navigator.onLine ? (e.message || String(e)) : '';
    if (manual) toast('⚠️ ' + (syncErro || 'Sem internet'), 5000);
  } finally {
    syncando = false; renderStatus(); renderTudo(true);
    if (syncDeNovo || DB.pend) { syncDeNovo = false; if (DB.pend && !syncErro) agendarSync(800); }
  }
}
function renderStatus() {
  const p = $('#stSync'), f = $('#faixaOff'); if (!p) return;
  let cls = 'ok', tx = '🟢 Sincronizado';
  if (modoLocal()) { cls = 'loc'; tx = '⚪ Só neste aparelho'; }
  else if (syncando) { cls = 'pend'; tx = '🔄 Sincronizando…'; }
  else if (!navigator.onLine) { cls = 'pend'; tx = '📴 Offline'; }
  else if (syncErro) { cls = 'err'; tx = '🔴 Erro na sincronização'; }
  else if (DB.pend) { cls = 'pend'; tx = '🟡 Aguardando envio'; }
  p.className = 'pill ' + cls; p.textContent = tx; p.title = syncErro || (DB.last ? 'Última sincronização: ' + new Date(DB.last).toLocaleString('pt-BR') : '');
  const avisos = [];
  if (!modoLocal() && DB.pend && !navigator.onLine) avisos.push(`📴 Sem internet: ${DB.pend} alteração(ões) guardada(s) neste aparelho. Elas serão enviadas quando a conexão voltar.`);
  if (syncErro) avisos.push('⚠️ ' + syncErro);
  f.innerHTML = avisos.map(esc).join('<br>'); f.classList.toggle('hid', !avisos.length);
  const inf = $('#infoSync');
  if (inf) inf.innerHTML = modoLocal()
    ? `<b>Modo:</b> só neste aparelho (sem GitHub).<br>Para sincronizar, use <b>Desconectar este aparelho</b> e configure de novo com o token.<br><b>Site versão ${SITE_VERSAO}</b>`
    : `<b>Repositório de dados:</b> ${esc(CFG.owner)}/${esc(CFG.repo)} (${esc(CFG.branch || 'main')})<br><b>Arquivo:</b> ${ARQ_DADOS}<br><b>Última sincronização:</b> ${DB.last ? new Date(DB.last).toLocaleString('pt-BR') : 'ainda não'}<br><b>Alterações aguardando envio:</b> ${DB.pend}<br><b>Site versão ${SITE_VERSAO}</b>`;
}

/* ---------------- acesso: senha (config.js) e configuração ---------------- */
/* A senha fica no arquivo config.js. Ao trocar a senha lá, todos os aparelhos
   precisam digitar a senha nova (a sessão "manter conectado" é anulada). */
const SENHA = (typeof SENHA_DASHBOARD === 'string' ? SENHA_DASHBOARD : '').trim();
async function hashSenha(s) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('saint|' + s)); return u8b64(new Uint8Array(h)); }
function mostrar(id) { ['telaSetup', 'telaLogin', 'app'].forEach(t => $('#' + t).classList.toggle('hid', t !== id)); }
function irSetup() { if (CFG && CFG.owner) { $('#sOwner').value = CFG.owner; $('#sRepo').value = CFG.repo; } mostrar('telaSetup'); setTimeout(() => $('#sOwner').focus(), 50); }
$('#sLocal').addEventListener('change', e => $('#blocoGH').classList.toggle('hid', e.target.checked));
$('#fSetup').addEventListener('submit', async e => {
  e.preventDefault();
  const er = $('#sErro'), bt = $('#sBtn'); er.textContent = '';
  const local = $('#sLocal').checked, owner = $('#sOwner').value.trim().replace(/^@/, ''), repo = $('#sRepo').value.trim(), token = $('#sToken').value.trim();
  if (!local && (!owner || !repo || !token)) return er.textContent = 'Preencha usuário, repositório e token.';
  bt.disabled = true; bt.textContent = 'Verificando…';
  try {
    let branch = 'main';
    if (!local) {
      TOKEN = token;
      const r = await gh(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
      if (!r.ok) throw new Error(await erroGH(r));
      const j = await r.json();
      branch = j.default_branch || 'main';
      if (j.permissions && !j.permissions.push) throw new Error('O token só tem leitura. Em Permissions → Contents, escolha "Read and write".');
      if (!j.private && !confirm('⚠️ Este repositório é PÚBLICO: os dados das clientes ficariam visíveis para qualquer pessoa. Recomendo usar um repositório privado. Continuar mesmo assim?')) throw new Error('Use um repositório privado para os dados (ex.: saint-dados).');
    }
    CFG = { owner, repo, branch, local, t: local ? '' : token };
    gravarLS(K.cfg, CFG);
    TOKEN = local ? null : token;
    $('#sToken').value = '';
    entrar();
  } catch (err) { er.textContent = err.message || String(err); TOKEN = null; }
  finally { bt.disabled = false; bt.textContent = 'Conectar e entrar'; }
});
$('#fLogin').addEventListener('submit', async e => {
  e.preventDefault();
  const er = $('#lErro'), dig = $('#lSenha').value; er.textContent = '';
  if (!SENHA) return er.textContent = 'Senha não definida: confira o arquivo config.js no GitHub.';
  if (dig !== SENHA) return er.textContent = 'Senha incorreta.';
  $('#lSenha').value = '';
  if ($('#lManter').checked) gravarLS(K.sess, JSON.stringify({ h: await hashSenha(SENHA) })); else localStorage.removeItem(K.sess);
  if (CFG && CFG.enc && CFG.t == null) { // aparelho configurado numa versão antiga
    try { CFG.t = JSON.parse(await decifrar(dig, CFG.enc)).t || ''; delete CFG.enc; gravarLS(K.cfg, CFG); }
    catch (x) { toast('Informe o token de novo para concluir a atualização. Seus dados continuam guardados.', 6000); return irSetup(); }
  }
  if (!CFG) return irSetup();
  TOKEN = CFG.local ? null : (CFG.t || null);
  entrar();
});
function sair() { localStorage.removeItem(K.sess); TOKEN = null; mostrar('telaLogin'); setTimeout(() => $('#lSenha').focus(), 50); }
$('#btSair').addEventListener('click', sair);
$('#btDesc').addEventListener('click', () => {
  const av = DB.pend && !modoLocal() ? `\n\n⚠️ Há ${DB.pend} alteração(ões) que ainda não foram enviadas e serão PERDIDAS.` : (modoLocal() ? '\n\n⚠️ No modo local, os dados existem só neste aparelho. Baixe um backup antes.' : '');
  if (!confirm('Desconectar este aparelho? O token e os dados guardados neste aparelho serão apagados (os dados no GitHub continuam lá).' + av)) return;
  [K.cfg, K.db, K.sess].forEach(k => localStorage.removeItem(k));
  location.reload();
});

let iniciado = false;
function entrar() {
  semear(); if (modoLocal() && migrarInfinity()) DB.pend++; salvarDB();
  mostrar('app');
  if (!iniciado) { iniciado = true; montarApp(); }
  renderTudo(); renderStatus();
  sincronizar(false);
}

/* ---------------- navegação ---------------- */
let ABA = localStorage.getItem(K.tab) || 'agenda';
function irAba(t) {
  if (!$('#t-' + t)) t = 'agenda';
  ABA = t; localStorage.setItem(K.tab, t);
  $$('.tab').forEach(s => s.classList.toggle('hid', s.id !== 't-' + t));
  $$('#abasTopo button, #abasBaixo button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  $('#fab').classList.toggle('hid', t !== 'agenda');
  window.scrollTo(0, 0);
}

/* ---------------- modal ---------------- */
let MODAL = null;
function abrirModal(html, estado) { MODAL = estado || {}; $('#mc').innerHTML = html; $('#modal').classList.remove('hid'); document.body.style.overflow = 'hidden'; }
function fecharModal() { MODAL = null; $('#modal').classList.add('hid'); $('#mc').innerHTML = ''; document.body.style.overflow = ''; }

/* =====================================================================
   AGENDA
   ===================================================================== */
let calRef = new Date(); calRef.setDate(1);
function linhaAt(a, opt = {}) {
  const fin = a.status === 'Finalizado', fal = a.status === 'Faltou', canc = a.status === 'Cancelado', trav = fin || fal || canc;
  const c = calc(a);
  const ses = a.sessao ? `<span class="et ses">Sessão ${esc(a.sessao)}${a.totalSessoes ? '/' + esc(a.totalSessoes) : ''}</span>` : '';
  const sin = num(a.sinal) > 0 && !fin ? `<span class="et sin">Sinal ${V(a.sinal)}</span>` : '';
  const st = `<span class="et st-${esc(a.status)}">${esc(a.status === 'Finalizado' ? 'Compareceu' : a.status)}</span>`;
  const wa = a.tel ? ` <a class="wa" href="${telWa(a.tel)}" target="_blank" rel="noopener" title="WhatsApp">💬</a>` : '';
  let sub = `${esc(txtServ(a))}${a.tatuador ? ' · ' + esc(a.tatuador) : ''}`;
  if (fin) sub += ` · ✅ ${V(c.liquido)} líquido${a.forma && c.rest > 0 ? ' · ' + esc(a.forma) : ''}`;
  else if (fal && sinalRetido(a)) sub += ` · sinal retido ${V(c.sinalLiq)}`;
  else if (!trav && c.cobrado) sub += ` · ${V(c.cobrado)}`;
  const data = opt.comData ? `<small>${brCurto(a.data)}</small>` : '';
  if (opt.simples) return `<div class="at${trav ? ' feito' : ''}" data-dia="${a.data}" style="cursor:pointer"><span class="h">${esc(a.hora || '--:--')}</span><div class="info"><b>${esc(a.cliente)}${ses}${sin}${wa}</b><small>${sub} ${st}</small>${data}</div></div>`;
  return `<div class="at${trav ? ' feito' : ''}" data-id="${a.id}">
    <span class="h">${esc(a.hora || '--:--')}</span>
    <div class="info"><b>${esc(a.cliente)}${ses}${sin}${wa}</b><small>${sub} ${st}</small>${data}</div>
    ${opt.pagar ? `<button class="btn bad s" type="button" data-ac="pagar">💰 Pagar</button>` : `
    <button class="ib ok${fin ? ' on' : ''}" type="button" data-ac="ok" title="Compareceu" aria-label="Compareceu" ${trav ? 'disabled' : ''}>✓</button>
    <button class="ib bad${fal ? ' on' : ''}" type="button" data-ac="falta" title="Não compareceu" aria-label="Não compareceu" ${trav ? 'disabled' : ''}>✗</button>
    <button class="ib" type="button" data-ac="edit" title="${fin ? 'Editar valores e pagamento' : 'Editar'}" aria-label="Editar" ${fal || canc ? 'disabled' : ''}>✏️</button>`}
  </div>`;
}
function renderAgenda() {
  const y = calRef.getFullYear(), m = calRef.getMonth(), hj = hoje();
  $('#calTit').textContent = `${MESES[m]} ${y}`;
  const ini = new Date(y, m, 1); ini.setDate(1 - ini.getDay());
  const porDia = {}; for (const a of viva('ag')) (porDia[a.data] = porDia[a.data] || []).push(a);
  let h = DIAS.map(d => `<div class="dh">${d}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = new Date(ini); d.setDate(ini.getDate() + i);
    if (i >= 35 && d.getMonth() !== m) break;
    const s = iso(d), lst = (porDia[s] || []).sort(ordAg), cor = corDia(lst);
    const nAb = lst.filter(emAberto).length;
    const tag = cor === 'verde' ? '✓' : cor === 'verm' ? `💰${nAb}` : '';
    h += `<button type="button" class="d${d.getMonth() !== m ? ' fora' : ''}${s === hj ? ' hoje' : ''}${cor ? ' ' + cor : ''}" data-dia="${s}" aria-label="${br(s)}: ${lst.length} atendimento(s)">
      <span class="n">${d.getDate()}</span><span class="tag">${tag}</span>
      ${lst.slice(0, 3).map(a => `<span class="ev ${esc(a.status)}">${esc(a.hora || '')} ${esc(a.cliente)}</span>`).join('')}${lst.length > 3 ? `<span class="ev">+${lst.length - 3}</span>` : ''}
      <span class="dots">${lst.map(a => `<i class="${esc(a.status)}"></i>`).join('')}</span></button>`;
  }
  $('#cal').innerHTML = h;
  const abertas = viva('ag').filter(emAberto).sort(ordAg);
  $('#cardCmd').classList.toggle('hid', !abertas.length);
  $('#nCmd').textContent = `(${abertas.length})`;
  let lh = '', ult = '';
  for (const a of abertas) { if (a.data !== ult) { ult = a.data; lh += `<div class="grp">${brCurto(a.data)}</div>`; } lh += linhaAt(a, { pagar: true }); }
  $('#lstCmd').innerHTML = lh;
  const dHj = pd(hj), wIni = somaDias(hj, -dHj.getDay()), wFim = somaDias(wIni, 6);
  const mIni = iso(new Date(y, m, 1)), mFim = iso(new Date(y, m + 1, 0));
  const tot = (a, b) => {
    let liq = 0, prev = 0;
    for (const r of receitas()) if (r.a.data >= a && r.a.data <= b) liq += r.liq;
    for (const x of viva('ag')) if (ST_ATIVOS.includes(x.status) && x.data >= a && x.data <= b) prev += calc(x).cobrado;
    return { liq: r2(liq), prev: r2(liq + prev), falta: r2(prev) };
  };
  const w = tot(wIni, wFim), mm = tot(mIni, mFim);
  $('#res4').innerHTML = `
    <div class="liq"><span>Liquidado da semana</span><b>${V(w.liq)}</b><small>${br(wIni).slice(0, 5)} a ${br(wFim).slice(0, 5)}</small></div>
    <div><span>Previsto da semana</span><b>${V(w.prev)}</b><small>falta receber ${V(w.falta)}</small></div>
    <div class="liq"><span>Liquidado do mês</span><b>${V(mm.liq)}</b><small>${MESES[m]}</small></div>
    <div><span>Previsto do mês</span><b>${V(mm.prev)}</b><small>falta receber ${V(mm.falta)}</small></div>`;
  const lh2 = doDia(hj);
  $('#hojeTit').textContent = brCurto(hj);
  $('#lstHoje').innerHTML = lh2.length ? lh2.map(a => linhaAt(a)).join('') : '<p class="vazio">Nenhum atendimento hoje.</p>';
  const prox = viva('ag').filter(a => a.data > hj && a.status !== 'Cancelado').sort(ordAg)[0];
  if (prox) { $('#proxTit').textContent = brCurto(prox.data); $('#lstProx').innerHTML = doDia(prox.data).filter(a => a.status !== 'Cancelado').map(a => linhaAt(a, { simples: true })).join(''); }
  else { $('#proxTit').textContent = ''; $('#lstProx').innerHTML = '<p class="vazio">Nenhum atendimento marcado nos próximos dias.</p>'; }
}

/* ---------- janela do dia ---------- */
function abrirDia(dia, abrirConf) {
  const lst = doDia(dia);
  abrirModal(`<h3>📅 ${brCurto(dia)} – ${br(dia)}</h3>
    <p class="muted" style="margin-top:-6px">✓ compareceu · ✗ não compareceu · ✏️ editar</p>
    <div id="diaLst">${lst.length ? lst.map(a => linhaAt(a) + `<div class="confw" data-for="${a.id}"></div>`).join('') : '<p class="vazio">Nenhum atendimento neste dia.</p>'}</div>
    <div class="rod"><button class="btn g" type="button" data-novo="${dia}">➕ Novo agendamento neste dia</button></div>`, { tipo: 'dia', dia });
  if (abrirConf) abrirConfirmacao(abrirConf);
}
const formasOrd = () => viva('tax').sort((x, y) => (x.ord ?? 99) - (y.ord ?? 99));
function painelPagamento(a, modo) {
  const c = calc(a), formas = formasOrd();
  const opt = sel => formas.map(t => `<option ${t.nome === sel ? 'selected' : ''}>${esc(t.nome)}</option>`).join('');
  return `<form class="conf" data-conf="${a.id}">
    <b>${modo === 'edit' ? '✏️ Editar valores e pagamento' : '✅ Confirmar atendimento'}</b>
    <div class="row" style="margin-top:8px">
      <div><label>Valor total (R$)</label><input name="total" inputmode="decimal" value="${nf(c.bruto)}"></div>
      <div><label>Desconto (R$)</label><input name="desconto" inputmode="decimal" value="${nf(a.desconto || 0)}"></div>
    </div>
    <div class="row" style="margin-top:8px">
      <div><label>Sinal já pago (R$)</label><input name="sinal" inputmode="decimal" value="${nf(a.sinal || 0)}"></div>
      <div><label>Forma do sinal</label><select name="sinalForma"><option value="">—</option>${opt(a.sinalForma)}</select></div>
    </div>
    <div class="row fRest" style="margin-top:8px"><div><label>Pagamento do restante</label><select name="forma">${opt(a.forma || 'Pix')}</select></div></div>
    <div class="calcbox" data-prev></div>
    <div class="row" style="margin-top:10px"><button class="btn ok">💾 ${modo === 'edit' ? 'Salvar alterações' : 'Confirmar atendimento'}</button><button class="btn l" type="button" data-ac="fecharConf">Cancelar</button></div>
  </form>`;
}
function lerPainel(f, a) {
  const total = num(f.total.value);
  const serv = (a.servicos && a.servicos.length ? a.servicos : [{ nome: 'Tatuagem', valor: 0 }]).map(s => ({ ...s }));
  const soma = serv.reduce((s, l) => s + num(l.valor), 0);
  if (Math.abs(soma - total) > 0.004) {
    if (soma > 0) { let acc = 0; serv.forEach((l, i) => { if (i === serv.length - 1) l.valor = r2(total - acc); else { l.valor = r2(num(l.valor) / soma * total); acc += l.valor; } }); }
    else { serv[0].valor = r2(total); serv.slice(1).forEach(l => l.valor = 0); }
  }
  return { servicos: serv, desconto: r2(num(f.desconto.value)), sinal: r2(num(f.sinal.value)), sinalForma: f.sinalForma.value, forma: f.forma.value };
}
function atualizarPrev(f, a) {
  const o = lerPainel(f, a), c = calc(a, { ...o, txS: taxaDe(o.sinalForma), txR: null });
  f.querySelector('.fRest').classList.toggle('hid', c.rest <= 0);
  f.querySelector('[data-prev]').innerHTML =
    `Valor ${V(c.bruto)}${c.desc ? ` − desconto ${V(c.desc)}` : ''} = cobrado <b class="v">${R(c.cobrado)}</b><br>` +
    (c.sinal ? `Sinal pago antes: ${V(c.sinal)}${c.taxaS ? ` (taxa ${V(c.taxaS)})` : ''}<br>` : '') +
    (c.rest > 0 ? `Restante a receber agora: <b class="v">${R(c.rest)}</b> no ${esc(o.forma)}${c.taxaR ? ` (taxa ${pct(taxaDe(o.forma))}% = ${V(c.taxaR)})` : ''}<br>` : 'Nada a receber agora (tudo pago no sinal).<br>') +
    `<b>Líquido do atendimento: <span class="v" style="color:var(--ok)">${R(c.liquido)}</span></b>` +
    (num(f.sinal.value) > c.cobrado && c.cobrado > 0 ? '<br><span class="neg">⚠️ O sinal é maior que o valor cobrado.</span>' : '');
}
function abrirConfirmacao(id, modo) {
  const a = viva('ag').find(x => x.id === id); if (!a) return;
  $$('#diaLst .confw').forEach(w => w.innerHTML = '');
  const w = $(`#diaLst .confw[data-for="${id}"]`); if (!w) return;
  w.innerHTML = painelPagamento(a, modo || (a.status === 'Finalizado' ? 'edit' : 'conf'));
  const f = w.querySelector('form');
  f.addEventListener('input', () => atualizarPrev(f, a));
  f.addEventListener('change', () => atualizarPrev(f, a));
  f.addEventListener('submit', e => {
    e.preventDefault();
    const o = lerPainel(f, a);
    if (calc(a, o).cobrado <= 0 && !confirm('O valor cobrado está zerado. Confirmar mesmo assim?')) return;
    const novo = Object.assign({}, a, o, { status: 'Finalizado', txS: taxaDe(o.sinalForma), txR: taxaDe(o.forma), sinalData: a.sinalData || (num(o.sinal) > 0 ? a.data : '') });
    put('ag', novo); alterou();
    toast('✅ Atendimento confirmado'); abrirDia(a.data);
  });
  atualizarPrev(f, a);
  f.querySelector('[name=total]').focus();
}
function marcarFalta(id) {
  const a = viva('ag').find(x => x.id === id); if (!a) return;
  if (!confirm(`Marcar ${a.cliente} como NÃO compareceu?`)) return;
  const novo = Object.assign({}, a, { status: 'Faltou' });
  if (num(a.sinal) > 0) novo.sinalDev = !confirm(`A cliente pagou sinal de ${R(a.sinal)}.\n\nOK = o sinal fica com o estúdio (entra no faturamento)\nCancelar = o sinal foi/será devolvido`);
  put('ag', novo); alterou(); abrirDia(a.data);
}

/* ---------- formulário de agendamento ---------- */
function clientesConhecidos() { const m = new Map(); for (const a of viva('ag').sort(ordAg)) if (a.cliente) m.set(norm(a.cliente), { nome: a.cliente, tel: a.tel || '' }); return [...m.values()]; }
function abrirForm(id, dia) {
  const a = id ? viva('ag').find(x => x.id === id) : null;
  if (a && a.status === 'Finalizado') { abrirDia(a.data); abrirConfirmacao(a.id, 'edit'); return; }
  const x = a || { data: dia || hoje(), hora: '', cliente: '', tel: '', servicos: [{ nome: viva('serv')[0]?.nome || 'Tatuagem', valor: viva('serv')[0]?.valor || 0 }], status: 'Pendente' };
  const tats = cfgGet('tatuadores', []);
  const formas = formasOrd();
  abrirModal(`<h3>${a ? '✏️ Editar agendamento' : '➕ Novo agendamento'}</h3>
  <form id="fAg" autocomplete="off">
    <div class="row"><div><label for="agData">Data</label><input type="date" id="agData" value="${esc(x.data)}" required></div>
      <div><label for="agHora">Horário</label><input type="time" id="agHora" value="${esc(x.hora)}" required></div></div>
    <div class="row" style="margin-top:8px"><div style="flex:2 1 200px"><label for="agCli">Cliente</label><input id="agCli" list="dlCli" value="${esc(x.cliente)}" required></div>
      <div><label for="agTel">Telefone / WhatsApp</label><input id="agTel" inputmode="tel" value="${esc(x.tel)}"></div></div>
    <datalist id="dlCli">${clientesConhecidos().map(c => `<option value="${esc(c.nome)}">`).join('')}</datalist>
    <div class="f" style="margin-top:8px"><label>Serviço(s) e valor (R$)</label><div id="agServ"></div>
      <button class="btn l s" type="button" id="agAddServ">➕ Adicionar serviço</button> <span class="muted" id="agTot"></span></div>
    <div class="row"><div><label for="agTat">Tatuador</label><select id="agTat"><option value="">—</option>${tats.map(t => `<option ${t === x.tatuador ? 'selected' : ''}>${esc(t)}</option>`).join('')}${x.tatuador && !tats.includes(x.tatuador) ? `<option selected>${esc(x.tatuador)}</option>` : ''}</select></div>
      <div><label for="agReg">Região do corpo</label><input id="agReg" value="${esc(x.regiao || '')}" placeholder="ex.: antebraço"></div></div>
    <div class="f" style="margin-top:8px"><label for="agDesc">Ideia / referência / tamanho</label><textarea id="agDesc" rows="2">${esc(x.desc || '')}</textarea></div>
    <div class="row"><div><label for="agSes">Sessão nº</label><input id="agSes" inputmode="numeric" value="${esc(x.sessao || '')}"></div>
      <div><label for="agTotS">de (total de sessões)</label><input id="agTotS" inputmode="numeric" value="${esc(x.totalSessoes || '')}"></div></div>
    <div class="muted" id="agSesInfo" style="margin:4px 0 8px"></div>
    <div class="row"><div><label for="agSinal">Sinal pago (R$)</label><input id="agSinal" inputmode="decimal" value="${num(x.sinal) ? nf(x.sinal) : ''}" placeholder="0,00"></div>
      <div><label for="agSinF">Forma do sinal</label><select id="agSinF"><option value="">—</option>${formas.map(t => `<option ${t.nome === x.sinalForma ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select></div>
      <div><label for="agSinD">Data do sinal</label><input type="date" id="agSinD" value="${esc(x.sinalData || '')}"></div></div>
    <div class="row" style="margin-top:8px"><div><label for="agSt">Status</label><select id="agSt">${['Pendente', 'Confirmado', 'Cancelado'].map(s => `<option ${s === x.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
    <div class="f" style="margin-top:8px"><label for="agObs">Observação</label><input id="agObs" value="${esc(x.obs || '')}"></div>
    <div class="erro" id="agErro" aria-live="polite"></div>
    <div class="rod">${a ? '<button class="btn bad" type="button" id="agDel">🗑 Excluir</button>' : ''}<button class="btn l" type="button" data-ac="fechar">Cancelar</button><button class="btn g">💾 Salvar</button></div>
  </form>`, { tipo: 'form' });
  const box = $('#agServ');
  const servs = () => viva('serv').sort((p, q) => (p.ord ?? 99) - (q.ord ?? 99));
  const linhaServ = l => {
    const nomes = servs().map(s => s.nome); if (l.nome && !nomes.includes(l.nome)) nomes.push(l.nome);
    return `<div class="svl"><select aria-label="Serviço">${nomes.map(n => `<option ${n === l.nome ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><input aria-label="Valor" inputmode="decimal" value="${nf(l.valor || 0)}"><button class="ib bad" type="button" data-rm aria-label="Remover">✕</button></div>`;
  };
  const tot = () => { const t = $$('.svl input', box).reduce((s, i) => s + num(i.value), 0); $('#agTot').innerHTML = `Total: <b class="v">${R(t)}</b>`; };
  box.innerHTML = (x.servicos && x.servicos.length ? x.servicos : [{ nome: 'Tatuagem', valor: 0 }]).map(linhaServ).join('');
  tot();
  box.addEventListener('change', e => { if (e.target.tagName === 'SELECT') { const s = servs().find(s => s.nome === e.target.value); const inp = e.target.nextElementSibling; if (s && num(s.valor)) inp.value = nf(s.valor); tot(); sugerirSessao(); } });
  box.addEventListener('input', tot);
  box.addEventListener('click', e => { if (e.target.closest('[data-rm]')) { if ($$('.svl', box).length > 1) e.target.closest('.svl').remove(); tot(); } });
  $('#agAddServ').addEventListener('click', () => { const s = servs()[0] || { nome: 'Tatuagem', valor: 0 }; box.insertAdjacentHTML('beforeend', linhaServ({ nome: s.nome, valor: s.valor })); tot(); });
  $('#agCli').addEventListener('change', () => { const c = clientesConhecidos().find(c => norm(c.nome) === norm($('#agCli').value)); if (c && !$('#agTel').value) $('#agTel').value = c.tel; sugerirSessao(); });
  $('#agSinal').addEventListener('input', () => { if (num($('#agSinal').value) > 0 && !$('#agSinD').value) $('#agSinD').value = hoje(); });
  const infoSes = () => { const s = parseInt($('#agSes').value) || 0, t = parseInt($('#agTotS').value) || 0; $('#agSesInfo').textContent = s && t ? (s >= t ? '⭐ Última sessão do projeto' : `Faltam ${t - s} sessão(ões) depois desta`) : ''; };
  function sugerirSessao() {
    if (a) return infoSes();
    const cli = norm($('#agCli').value), sv = $('.svl select', box)?.value; if (!cli) return infoSes();
    const ant = viva('ag').filter(p => norm(p.cliente) === cli && p.status !== 'Cancelado' && p.totalSessoes && (!sv || nomesServ(p).includes(sv))).sort(ordAg).pop();
    if (ant && (parseInt(ant.sessao) || 0) < parseInt(ant.totalSessoes)) { $('#agSes').value = (parseInt(ant.sessao) || 0) + 1; $('#agTotS').value = ant.totalSessoes; }
    infoSes();
  }
  ['#agSes', '#agTotS'].forEach(s => $(s).addEventListener('input', infoSes)); infoSes();
  if (a) $('#agDel').addEventListener('click', () => { if (confirm(`Excluir o agendamento de ${a.cliente} em ${br(a.data)} às ${a.hora}?`)) { apagar('ag', a.id); alterou(); toast('Agendamento excluído'); abrirDia(a.data); } });
  $('#fAg').addEventListener('submit', e => {
    e.preventDefault();
    const er = $('#agErro');
    const servicos = $$('.svl', box).map(l => ({ nome: l.querySelector('select').value, valor: r2(num(l.querySelector('input').value)) }));
    const sinal = r2(num($('#agSinal').value));
    if (!$('#agCli').value.trim()) return er.textContent = 'Informe a cliente.';
    if (sinal > 0 && !$('#agSinF').value) return er.textContent = 'Escolha a forma de pagamento do sinal.';
    const rec = Object.assign({}, a || { id: uid(), criado: Date.now() }, {
      data: $('#agData').value, hora: $('#agHora').value, cliente: $('#agCli').value.trim(), tel: $('#agTel').value.trim(),
      servicos, tatuador: $('#agTat').value, regiao: $('#agReg').value.trim(), desc: $('#agDesc').value.trim(),
      sessao: $('#agSes').value.trim(), totalSessoes: $('#agTotS').value.trim(),
      sinal, sinalForma: sinal > 0 ? $('#agSinF').value : '', sinalData: sinal > 0 ? ($('#agSinD').value || hoje()) : '', txS: sinal > 0 ? taxaDe($('#agSinF').value) : 0,
      status: $('#agSt').value, obs: $('#agObs').value.trim()
    });
    const choque = viva('ag').find(p => p.id !== rec.id && p.data === rec.data && p.hora === rec.hora && p.status !== 'Cancelado' && (!rec.tatuador || !p.tatuador || p.tatuador === rec.tatuador));
    if (choque && !confirm(`Já existe ${choque.cliente} às ${choque.hora} neste dia${choque.tatuador ? ' com ' + choque.tatuador : ''}. Salvar mesmo assim?`)) return;
    put('ag', rec); alterou();
    if (a) { toast('💾 Agendamento atualizado'); abrirDia(rec.data); return; }
    abrirModal(`<div class="sucesso"><div class="big">✅</div><h3 style="margin:6px 0">Horário marcado!</h3>
      <p><b>${esc(rec.cliente)}</b><br>${brCurto(rec.data)} às <b>${esc(rec.hora)}</b><br>${esc(txtServ(rec))}${rec.tatuador ? ' · ' + esc(rec.tatuador) : ''}${rec.sessao ? `<br>Sessão ${esc(rec.sessao)}${rec.totalSessoes ? ' de ' + esc(rec.totalSessoes) : ''}` : ''}${sinal ? `<br>Sinal recebido: ${V(sinal)}` : ''}</p>
      <div class="rod" style="justify-content:center"><button class="btn l" type="button" data-ac="fechar">Encerrar agendamento</button><button class="btn g" type="button" data-novo="${rec.data}">➕ Agendar outro cliente</button></div></div>`, { tipo: 'ok' });
  });
}

/* =====================================================================
   FINANCEIRO (somente estúdio – o frigobar não entra aqui)
   ===================================================================== */
function opcoes(sel, lista, atual, todos = 'Todos') {
  const v = atual ?? sel.value;
  sel.innerHTML = (todos ? `<option value="">${todos}</option>` : '') + lista.map(o => Array.isArray(o) ? `<option value="${esc(o[0])}">${esc(o[1])}</option>` : `<option>${esc(o)}</option>`).join('');
  if ([...sel.options].some(o => o.value === v)) sel.value = v;
}
function barrasH(el, pares, qtd) {
  pares = pares.filter(p => p[1]); const max = Math.max(...pares.map(p => Math.abs(p[1])), 0) || 1;
  el.innerHTML = pares.length ? pares.map(([l, v, extra]) => `<div class="bh"><span class="bh-l" title="${esc(l)}">${esc(l)}</span><span class="bh-t"><i style="width:${Math.max(2, Math.abs(v) / max * 100)}%"></i></span><span class="bh-v">${qtd ? v : V(v)}${extra ? ` <small class="muted">${extra}</small>` : ''}</span></div>`).join('') : '<p class="vazio">Sem dados no período.</p>';
}
function barrasV(el, pares, qtd) {
  const max = Math.max(...pares.map(p => p[1]), 0) || 1;
  el.innerHTML = pares.some(p => p[1]) ? `<div class="bv">${pares.map(([l, v]) => `<div class="bv-c" title="${esc(l)}: ${qtd ? v : R(v)}"><span class="bv-n${qtd ? '' : ' v'}">${v ? (qtd ? v : kfmt(v)) : ''}</span><i style="height:${v / max * 100}%"></i><span class="bv-l">${esc(l)}</span></div>`).join('')}</div>` : '<p class="vazio">Sem dados no período.</p>';
}
let FIN_ROWS = [];
function filtrosFin() {
  const anos = new Set([new Date().getFullYear()]); viva('ag').forEach(a => a.data && anos.add(+a.data.slice(0, 4)));
  const fAno = $('#fAno'); if (!fAno.dataset.ok) { fAno.dataset.ok = 1; opcoes(fAno, [...anos].sort((a, b) => b - a), String(new Date().getFullYear()), 'Todos'); }
  else opcoes(fAno, [...anos].sort((a, b) => b - a));
  const ano = fAno.value;
  const meses = new Set(); receitas().forEach(r => { if (!ano || r.a.data.startsWith(ano)) meses.add(+r.a.data.slice(5, 7)); });
  opcoes($('#fMes'), [...meses].sort((a, b) => a - b).map(m => [String(m), MESES[m - 1]]));
  opcoes($('#fForma'), formasOrd().map(t => t.nome));
  const sv = new Set(viva('serv').map(s => s.nome)); viva('ag').forEach(a => nomesServ(a).forEach(n => sv.add(n)));
  opcoes($('#fServ'), [...sv].sort());
  const tt = new Set(cfgGet('tatuadores', [])); viva('ag').forEach(a => a.tatuador && tt.add(a.tatuador));
  opcoes($('#fTat'), [...tt].sort());
}
function renderFin() {
  filtrosFin();
  const ano = $('#fAno').value, mes = $('#fMes').value, forma = $('#fForma').value, serv = $('#fServ').value, tat = $('#fTat').value;
  const base = receitas().filter(r => (!forma || r.a.forma === forma || r.a.sinalForma === forma) && (!serv || nomesServ(r.a).includes(serv)) && (!tat || r.a.tatuador === tat));
  const doAno = base.filter(r => !ano || r.a.data.startsWith(ano));
  const rows = doAno.filter(r => !mes || +r.a.data.slice(5, 7) === +mes).sort((x, y) => ordAg(y.a, x.a));
  FIN_ROWS = rows;
  const at = rows.filter(r => r.tipo === 'at'), ret = rows.filter(r => r.tipo === 'ret');
  const liq = r2(rows.reduce((s, r) => s + r.liq, 0)), bruto = r2(at.reduce((s, r) => s + r.c.cobrado, 0)), taxas = r2(at.reduce((s, r) => s + r.c.taxa, 0) + ret.reduce((s, r) => s + r.c.taxaS, 0));
  const desc = r2(at.reduce((s, r) => s + r.c.desc, 0)), retV = r2(ret.reduce((s, r) => s + r.liq, 0));
  const nAb = viva('ag').filter(emAberto).length;
  $('#kpis').innerHTML = `
    <div class="kpi dk"><span>💰 Faturamento líquido</span><b>${V(liq)}</b></div>
    <div class="kpi"><span>Valor cobrado</span><b>${V(bruto)}</b></div>
    <div class="kpi"><span>💳 Taxas da maquininha</span><b>${V(taxas)}</b></div>
    <div class="kpi"><span>🏷️ Descontos</span><b>${V(desc)}</b></div>
    <div class="kpi"><span>🖋️ Atendimentos</span><b>${at.length}</b></div>
    <div class="kpi"><span>Ticket médio (líquido)</span><b>${V(at.length ? (liq - retV) / at.length : 0)}</b></div>
    <div class="kpi"><span>🔒 Sinais retidos (faltas)</span><b>${V(retV)}</b><span>${ret.length} falta(s)</span></div>
    <div class="kpi${nAb ? ' red' : ''}" id="kpiCmd"><span>💳 Comandas em aberto</span><b>${nAb}</b></div>`;
  if (mes) {
    const y = +(ano || new Date().getFullYear()), dias = new Date(y, +mes, 0).getDate(), v = Array(dias).fill(0);
    rows.forEach(r => v[+r.a.data.slice(8, 10) - 1] += r.liq);
    $('#tGrafTempo').textContent = 'Faturamento líquido por dia'; barrasV($('#gTempo'), v.map((x, i) => [String(i + 1), r2(x)]));
  } else {
    const v = Array(12).fill(0); doAno.forEach(r => { if (r.tipo === 'at') v[+r.a.data.slice(5, 7) - 1]++; });
    $('#tGrafTempo').textContent = 'Atendimentos por mês'; barrasV($('#gTempo'), v.map((x, i) => [MES3[i], x]), true);
  }
  const ps = {}; at.forEach(r => { const tot = r.c.bruto || 1; (r.a.servicos || []).forEach(l => { ps[l.nome] = (ps[l.nome] || 0) + r.liq * (r.c.bruto ? num(l.valor) / tot : 1 / r.a.servicos.length); }); });
  barrasH($('#gServ'), Object.entries(ps).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => [k, r2(v)]));
  const pf = {}; rows.forEach(r => { if (r.c.sinal && r.a.sinalForma) pf[r.a.sinalForma] = (pf[r.a.sinalForma] || 0) + r.c.sinalLiq; if (r.tipo === 'at' && r.c.rest > 0) pf[r.a.forma || '—'] = (pf[r.a.forma || '—'] || 0) + r.c.restLiq; });
  barrasH($('#gForma'), Object.entries(pf).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, r2(v), liq ? Math.round(v / liq * 100) + '%' : '']));
  const pc = {}; rows.forEach(r => pc[r.a.cliente] = (pc[r.a.cliente] || 0) + r.liq);
  barrasH($('#gCli'), Object.entries(pc).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => [k, r2(v)]));
  const pt = {}; rows.forEach(r => { const k = r.a.tatuador || 'Sem tatuador'; pt[k] = (pt[k] || 0) + r.liq; });
  barrasH($('#gTat'), Object.entries(pt).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, r2(v)]));
  const pw = Array(7).fill(0); rows.forEach(r => pw[pd(r.a.data).getDay()] += r.liq);
  barrasH($('#gSem'), DIAS.map((d, i) => [d, r2(pw[i])]));
  const pm = Array(12).fill(0); doAno.forEach(r => pm[+r.a.data.slice(5, 7) - 1] += r.liq);
  $('#tAnoMes').textContent = ano ? `(${ano})` : '(todos os anos)';
  barrasV($('#gMes'), pm.map((x, i) => [MES3[i], r2(x)]));
  $('#nAt').textContent = `(${rows.length})`;
  $('#tbAt').innerHTML = rows.length ? `<thead><tr><th>Data</th><th>Cliente</th><th>Serviço(s)</th><th>Tatuador</th><th>Pagamento</th><th class="n">Valor</th><th class="n">Desconto</th><th class="n">Sinal</th><th class="n">Taxa</th><th class="n">Líquido</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td data-l="Data">${br(r.a.data)}</td><td data-l="Cliente"><b>${esc(r.a.cliente)}</b></td><td data-l="Serviço(s)">${esc(txtServ(r.a))}${r.tipo === 'ret' ? ' <span class="et sin">sinal retido</span>' : ''}</td><td data-l="Tatuador">${esc(r.a.tatuador || '—')}</td>
      <td data-l="Pagamento">${esc(r.tipo === 'ret' ? r.a.sinalForma : [r.c.sinal ? 'Sinal: ' + (r.a.sinalForma || '—') : '', r.c.rest > 0 ? r.a.forma : ''].filter(Boolean).join(' · ') || '—')}</td>
      <td class="n" data-l="Valor">${V(r.tipo === 'ret' ? r.c.sinal : r.c.bruto)}</td><td class="n" data-l="Desconto">${r.tipo === 'ret' ? '—' : V(r.c.desc)}</td><td class="n" data-l="Sinal">${V(r.c.sinal)}</td>
      <td class="n" data-l="Taxa">${V(r.tipo === 'ret' ? r.c.taxaS : r.c.taxa)}</td><td class="n" data-l="Líquido"><b>${V(r.liq)}</b></td></tr>`).join('') +
    `<tr class="tot"><td data-l="" colspan="9">Total</td><td class="n" data-l="Líquido">${V(liq)}</td></tr></tbody>` : '<tbody><tr><td class="vazio">Nenhum atendimento finalizado no período. Os atendimentos entram aqui quando você toca em ✓ na agenda.</td></tr></tbody>';
}
function exportarCsv() {
  const L = [['Data', 'Hora', 'Cliente', 'Telefone', 'Servicos', 'Tatuador', 'Tipo', 'Forma sinal', 'Forma restante', 'Valor', 'Desconto', 'Sinal', 'Taxa', 'Liquido']];
  FIN_ROWS.forEach(r => L.push([br(r.a.data), r.a.hora, r.a.cliente, r.a.tel, txtServ(r.a), r.a.tatuador, r.tipo === 'ret' ? 'Sinal retido' : 'Atendimento', r.a.sinalForma, r.c.rest > 0 ? r.a.forma : '', nf(r.c.bruto), nf(r.c.desc), nf(r.c.sinal), nf(r.tipo === 'ret' ? r.c.taxaS : r.c.taxa), nf(r.liq)]));
  baixar('saint-tattoo-financeiro.csv', '\ufeff' + L.map(l => l.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n'), 'text/csv');
}
function baixar(nome, txt, tipo) { const b = new Blob([txt], { type: tipo }); const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href = u; l.download = nome; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); }

/* =====================================================================
   CAIXA (somente estúdio)
   ===================================================================== */
function movimentos() {
  const out = [];
  for (const a of viva('ag')) {
    const c = calc(a);
    if (c.sinal > 0 && !a.sinalDev) out.push({ auto: 1, a, data: a.sinalData || a.data, tipo: 'entrada', cat: 'Sinal', desc: `Sinal – ${a.cliente} (${txtServ(a)})`, forma: a.sinalForma, valor: c.sinalLiq });
    if (a.status === 'Finalizado' && c.rest > 0) out.push({ auto: 1, a, data: a.data, tipo: 'entrada', cat: 'Atendimento', desc: `Atendimento – ${a.cliente} (${txtServ(a)})`, forma: a.forma, valor: c.restLiq });
  }
  for (const m of viva('cx')) out.push({ ...m, valor: num(m.valor) });
  return out.sort((x, y) => (y.data + (y.a?.hora || '')).localeCompare(x.data + (x.a?.hora || '')));
}
const efeito = m => m.tipo === 'saida' ? -num(m.valor) : num(m.valor);
function saldoAtual(movs) { const s = cfgGet('saldoIni', { valor: 0, data: '' }); return r2(num(s.valor) + movs.filter(m => !s.data || m.data >= s.data).filter(m => m.data <= hoje()).reduce((t, m) => t + efeito(m), 0)); }
function renderCaixa() {
  const movs = movimentos();
  const anos = new Set([new Date().getFullYear()]); movs.forEach(m => m.data && anos.add(+m.data.slice(0, 4)));
  const fA = $('#cxfAno'), fM = $('#cxfMes');
  if (!fA.dataset.ok) { fA.dataset.ok = 1; opcoes(fA, [...anos].sort((a, b) => b - a), String(new Date().getFullYear()), 'Todos os anos'); opcoes(fM, MESES.map((m, i) => [String(i + 1), m]), String(new Date().getMonth() + 1), 'Ano todo'); }
  else opcoes(fA, [...anos].sort((a, b) => b - a), null, 'Todos os anos');
  opcoes($('#cxForma'), formasOrd().map(t => t.nome), null, '—');
  const ano = fA.value, mes = fM.value;
  const per = movs.filter(m => (!ano || m.data.startsWith(ano)) && (!mes || +m.data.slice(5, 7) === +mes));
  const ent = r2(per.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0));
  const sai = r2(per.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0));
  const aj = r2(per.filter(m => m.tipo === 'ajuste').reduce((s, m) => s + m.valor, 0));
  const res = r2(ent - sai + aj), sAt = saldoAtual(movs);
  $('#kpisCx').innerHTML = `
    <div class="kpi dk"><span>🏦 Saldo atual</span><b>${V(sAt)}</b></div>
    <div class="kpi"><span>⬆️ Entradas do período</span><b class="pos">${V(ent)}</b></div>
    <div class="kpi"><span>⬇️ Saídas do período</span><b class="neg">${V(sai)}</b></div>
    <div class="kpi"><span>⚖️ Ajustes do período</span><b>${V(aj)}</b></div>
    <div class="kpi"><span>Resultado do período</span><b class="${res >= 0 ? 'pos' : 'neg'}">${V(res)}</b></div>`;
  const s = cfgGet('saldoIni', { valor: 0, data: '' });
  if (document.activeElement !== $('#sdValor')) $('#sdValor').value = nf(s.valor || 0);
  if (document.activeElement !== $('#sdData')) $('#sdData').value = s.data || '';
  $('#sdInfo').innerHTML = `Saldo inicial ${V(s.valor || 0)}${s.data ? ' em ' + br(s.data) : ''} + movimentos até hoje = <b>saldo atual ${V(sAt)}</b>`;
  $('#nCx').textContent = `(${per.length})`;
  const ic = { entrada: '⬆️', saida: '⬇️', ajuste: '⚖️' };
  $('#tbCx').innerHTML = per.length ? `<thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th>Forma</th><th class="n">Valor</th><th></th></tr></thead><tbody>` +
    per.map(m => `<tr><td data-l="Data">${br(m.data)}</td><td data-l="Tipo">${ic[m.tipo] || ''} ${m.tipo === 'saida' ? 'Saída' : m.tipo === 'ajuste' ? 'Ajuste' : 'Entrada'}</td><td data-l="Descrição">${m.auto ? '📅 ' : ''}${esc(m.desc)}</td><td data-l="Categoria">${esc(m.cat || '—')}</td><td data-l="Forma">${esc(m.forma || '—')}</td>
      <td class="n ${efeito(m) >= 0 ? 'pos' : 'neg'}" data-l="Valor"><b>${V(efeito(m))}</b></td>
      <td data-l="">${m.auto ? `<button class="btn l s" type="button" data-dia="${m.a.data}">Ver na agenda</button>` : `<button class="ib" type="button" data-cxe="${m.id}" aria-label="Editar">✏️</button> <button class="ib bad" type="button" data-cxd="${m.id}" aria-label="Excluir">🗑</button>`}</td></tr>`).join('') +
    `<tr class="tot"><td colspan="5" data-l="">Resultado do período</td><td class="n" data-l="Valor">${V(res)}</td><td></td></tr></tbody>` : '<tbody><tr><td class="vazio">Nenhum movimento no período.</td></tr></tbody>';
}
function catsCx() { const t = $('#cxTipo').value; opcoes($('#cxCat'), t === 'saida' ? CAT_SAIDA : t === 'entrada' ? CAT_ENTRADA : ['Conferência de saldo', 'Correção'], null, ''); }
function limparCx() { $('#cxId').value = ''; $('#cxDesc').value = ''; $('#cxValor').value = ''; $('#cxData').value = hoje(); $('#cxCanc').classList.add('hid'); $('#cxErro').textContent = ''; }

/* =====================================================================
   FRIGOBAR – estoque e caixa próprios (separado do estúdio)
   ===================================================================== */
const prodOrd = () => viva('fp').sort((a, b) => (a.ord ?? 99) - (b.ord ?? 99));
const SINAL_FM = { inicial: 1, compra: 1, ajuste: 1, venda: -1, perda: -1 };
function estoques() {
  const e = {};
  for (const m of viva('fm')) { const s = SINAL_FM[m.tipo]; if (!s) continue; for (const it of m.itens || []) e[it.p] = (e[it.p] || 0) + s * (parseInt(it.q) || 0); }
  return e;
}
const liqVenda = m => r2(num(m.valor) - num(m.valor) * num(m.tx) / 100);
function efeitoFm(m) {
  if (m.tipo === 'venda') return liqVenda(m);
  if (m.tipo === 'compra' || m.tipo === 'saida') return -num(m.valor);
  if (m.tipo === 'entrada') return num(m.valor);
  return 0;
}
const nomeProd = it => viva('fp').find(p => p.id === it.p)?.nome || it.nome || '?';
const semPreco = p => !p.gratis && !num(p.preco);
let CART = {};
function situacao(p, q) {
  if (!p.controla) return '<span class="et">não conta</span>';
  if (q <= 0) return '<span class="et bx">Sem estoque</span>';
  if (q <= num(p.min)) return '<span class="et bx">Baixo</span>';
  return '<span class="et okk">OK</span>';
}
function renderCarrinho() {
  const ids = Object.keys(CART).filter(id => CART[id] > 0);
  const box = $('#frCart');
  if (!ids.length) { box.innerHTML = '<p class="vazio">Toque nos produtos acima para montar a venda.</p>'; return; }
  const est = estoques(); let tot = 0;
  const linhas = ids.map(id => {
    const p = viva('fp').find(x => x.id === id); if (!p) return '';
    const q = CART[id], pr = p.gratis ? 0 : num(p.preco), sub = r2(q * pr); tot += sub;
    const falta = p.controla && q > (est[id] || 0);
    return `<div class="ci"><div class="nm"><b>${esc(p.nome)}</b><small>${p.gratis ? 'Grátis' : `${V(pr)} cada`}${falta ? ' · <span class="neg">⚠️ estoque: ' + (est[id] || 0) + '</span>' : ''}</small></div>
      <button class="ib" type="button" data-cq="${id}" data-d="-1" aria-label="Menos">−</button><span class="q">${q}</span><button class="ib" type="button" data-cq="${id}" data-d="1" aria-label="Mais">+</button>
      <b style="min-width:80px;text-align:right">${p.gratis ? 'Grátis' : V(sub)}</b></div>`;
  }).join('');
  tot = r2(tot);
  const formaAtual = $('#frForma')?.value || 'Pix', cliAtual = $('#frCli')?.value || '', dtAtual = $('#frData')?.value || hoje();
  const tx = taxaDe(formaAtual), liq = r2(tot - tot * tx / 100);
  box.innerHTML = linhas + `<div class="tot2"><span>Total</span><span class="v">${R(tot)}</span></div>
    <div class="row">
      ${tot > 0 ? `<div><label for="frForma">Pagamento</label><select id="frForma">${formasOrd().map(t => `<option ${t.nome === formaAtual ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select></div>` : ''}
      <div><label for="frCli">Cliente (opcional)</label><input id="frCli" list="dlCliFr" value="${esc(cliAtual)}"></div>
      <div><label for="frData">Data</label><input type="date" id="frData" value="${esc(dtAtual)}"></div>
    </div>
    <datalist id="dlCliFr">${clientesConhecidos().map(c => `<option value="${esc(c.nome)}">`).join('')}</datalist>
    ${tot > 0 && tx ? `<div class="muted" style="margin-top:6px">Taxa ${pct(tx)}% = ${V(tot - liq)} · líquido <b class="v">${R(liq)}</b></div>` : ''}
    <div class="row" style="margin-top:10px"><button class="btn ok" type="button" id="frReg">✅ ${tot > 0 ? 'Registrar venda' : 'Registrar consumo (grátis)'}</button><button class="btn l" type="button" id="frLimpar">Limpar</button></div>`;
}
function renderFrigo() {
  const est = estoques(), prods = prodOrd();
  $('#frProds').innerHTML = prods.map(p => {
    const q = est[p.id] || 0, cls = p.controla && q <= 0 ? ' zero' : (p.controla && q <= num(p.min) ? ' baixo' : '');
    return `<button type="button" class="prod${cls}" data-fp="${p.id}"><b>${esc(p.nome)}</b><em>${p.gratis ? 'Grátis' : semPreco(p) ? '<span class="neg">⚠️ sem preço</span>' : V(p.preco)}</em><span>${p.controla ? `Estoque: ${q}` : '&nbsp;'}${CART[p.id] ? ` · 🛒 ${CART[p.id]}` : ''}</span></button>`;
  }).join('') || '<p class="vazio">Nenhum produto cadastrado.</p>';
  renderCarrinho();
  // selects
  const cont = prods.filter(p => p.controla).map(p => [p.id, p.nome]);
  opcoes($('#frcProd'), cont, null, ''); opcoes($('#fraProd'), cont, null, '');
  infoAjuste();
  // filtros de período
  const movs = viva('fm');
  const anos = new Set([new Date().getFullYear()]); movs.forEach(m => m.data && anos.add(+m.data.slice(0, 4)));
  const fA = $('#frfAno'), fM = $('#frfMes');
  if (!fA.dataset.ok) { fA.dataset.ok = 1; opcoes(fA, [...anos].sort((a, b) => b - a), String(new Date().getFullYear()), 'Todos os anos'); opcoes(fM, MESES.map((m, i) => [String(i + 1), m]), String(new Date().getMonth() + 1), 'Ano todo'); }
  else opcoes(fA, [...anos].sort((a, b) => b - a), null, 'Todos os anos');
  const ano = fA.value, mes = fM.value;
  const per = movs.filter(m => (!ano || String(m.data).startsWith(ano)) && (!mes || +String(m.data).slice(5, 7) === +mes)).sort((x, y) => (y.data + (y.hora || '')).localeCompare(x.data + (x.hora || '')));
  // KPIs
  const saldo = r2(movs.filter(m => m.data <= hoje()).reduce((s, m) => s + efeitoFm(m), 0));
  const vendas = per.filter(m => m.tipo === 'venda');
  const vBruto = r2(vendas.reduce((s, m) => s + num(m.valor), 0)), vLiq = r2(vendas.reduce((s, m) => s + liqVenda(m), 0));
  const compras = r2(per.filter(m => m.tipo === 'compra').reduce((s, m) => s + num(m.valor), 0));
  const outras = r2(per.filter(m => m.tipo === 'entrada' || m.tipo === 'saida').reduce((s, m) => s + efeitoFm(m), 0));
  const res = r2(per.reduce((s, m) => s + efeitoFm(m), 0));
  let qVend = 0, qCort = 0, custoVend = 0;
  vendas.forEach(m => (m.itens || []).forEach(it => { const q = parseInt(it.q) || 0; if (num(it.v)) qVend += q; else qCort += q; const p = viva('fp').find(x => x.id === it.p); custoVend += q * num(p?.custo); }));
  const nBaixo = prods.filter(p => p.controla && (est[p.id] || 0) <= num(p.min)).length;
  $('#kpisFr').innerHTML = `
    <div class="kpi dk"><span>🥤 Saldo do frigobar</span><b>${V(saldo)}</b></div>
    <div class="kpi"><span>Vendas do período</span><b class="pos">${V(vBruto)}</b><span>líquido ${V(vLiq)}</span></div>
    <div class="kpi"><span>📦 Compras / reposição</span><b class="neg">${V(compras)}</b></div>
    <div class="kpi"><span>Outras entradas/saídas</span><b>${V(outras)}</b></div>
    <div class="kpi"><span>Resultado do período</span><b class="${res >= 0 ? 'pos' : 'neg'}">${V(res)}</b>${custoVend ? `<span>lucro estimado ${V(vLiq - custoVend)}</span>` : ''}</div>
    <div class="kpi"><span>Itens vendidos / cortesias</span><b>${qVend} / ${qCort}</b></div>
    <div class="kpi${nBaixo ? ' red' : ''}"><span>⚠️ Estoque baixo</span><b>${nBaixo}</b></div>`;
  // tabela de estoque
  const ctrl = prods.filter(p => p.controla);
  const totEst = ctrl.reduce((s, p) => s + Math.max(0, est[p.id] || 0), 0);
  $('#tbEst').innerHTML = ctrl.length ? `<thead><tr><th>Produto</th><th class="n">Preço</th><th class="n">Estoque</th><th class="n">Mínimo</th><th>Situação</th><th class="n">Valor em estoque</th></tr></thead><tbody>` +
    ctrl.map(p => { const q = est[p.id] || 0; return `<tr class="${q <= num(p.min) ? 'baixo' : ''}"><td data-l="Produto"><b>${esc(p.nome)}</b></td><td class="n" data-l="Preço">${p.gratis ? 'Grátis' : semPreco(p) ? '<span class="neg">sem preço</span>' : V(p.preco)}</td><td class="n" data-l="Estoque"><b>${q}</b></td><td class="n" data-l="Mínimo">${num(p.min)}</td><td data-l="Situação">${situacao(p, q)}</td><td class="n" data-l="Valor em estoque">${p.gratis ? '—' : V(Math.max(0, q) * num(p.preco))}</td></tr>`; }).join('') +
    `<tr class="tot"><td data-l="">Total</td><td></td><td class="n" data-l="Unidades">${totEst}</td><td></td><td></td><td class="n" data-l="Valor">${V(ctrl.filter(p => !p.gratis).reduce((s, p) => s + Math.max(0, est[p.id] || 0) * num(p.preco), 0))}</td></tr></tbody>` : '<tbody><tr><td class="vazio">Nenhum produto com controle de estoque.</td></tr></tbody>';
  // movimentos
  const rot = m => ({ inicial: '📋 Estoque inicial', compra: '📦 Entrada de estoque', ajuste: '⚖️ Contagem', perda: '🗑 Perda', entrada: '⬆️ Entrada', saida: '⬇️ Saída' }[m.tipo] || (num(m.valor) ? '🛒 Venda' : '🎁 Cortesia'));
  const itensTxt = m => (m.itens || []).map(it => `${m.tipo === 'ajuste' && it.q > 0 ? '+' : ''}${it.q}× ${esc(nomeProd(it))}`).join(', ');
  $('#nFr').textContent = `(${per.length})`;
  $('#tbFr').innerHTML = per.length ? `<thead><tr><th>Data</th><th>Tipo</th><th>Itens / descrição</th><th>Pagamento / cliente</th><th class="n">Valor</th><th></th></tr></thead><tbody>` +
    per.map(m => { const ef = efeitoFm(m); return `<tr><td data-l="Data">${br(m.data)}${m.hora ? ' ' + esc(m.hora) : ''}</td><td data-l="Tipo">${rot(m)}</td><td data-l="Itens">${itensTxt(m) || ''}${m.desc && m.tipo !== 'inicial' ? (m.itens?.length ? ' · ' : '') + esc(m.desc) : ''}</td>
      <td data-l="Pagamento">${esc([m.tipo === 'venda' && num(m.valor) ? m.forma : '', m.cliente].filter(Boolean).join(' · ') || '—')}</td>
      <td class="n ${ef > 0 ? 'pos' : ef < 0 ? 'neg' : ''}" data-l="Valor">${ef ? `<b>${V(ef)}</b>` : '—'}${m.tipo === 'venda' && num(m.tx) ? `<br><small class="muted">bruto ${V(m.valor)}</small>` : ''}</td>
      <td data-l=""><button class="ib bad" type="button" data-fmd="${m.id}" aria-label="Excluir">🗑</button></td></tr>`; }).join('') +
    `<tr class="tot"><td colspan="4" data-l="">Resultado do período</td><td class="n" data-l="Valor">${V(res)}</td><td></td></tr></tbody>` : '<tbody><tr><td class="vazio">Nenhum movimento no período.</td></tr></tbody>';
  // lista de produtos (não atrapalha quem está digitando)
  const at = document.activeElement;
  if (!(at && at.closest && at.closest('#lstProd'))) {
    $('#lstProd').innerHTML = prods.map(p => `<div class="it" data-id="${p.id}">
      <input class="nmp" name="nome" value="${esc(p.nome)}" aria-label="Produto">
      <input name="preco" inputmode="decimal" value="${nf(p.preco)}" aria-label="Preço" ${p.gratis ? 'disabled' : ''}>
      <input name="custo" inputmode="decimal" value="${nf(p.custo)}" aria-label="Custo unitário">
      <input name="min" inputmode="numeric" value="${num(p.min)}" aria-label="Estoque mínimo" ${p.controla ? '' : 'disabled'}>
      <label><input type="checkbox" name="gratis" ${p.gratis ? 'checked' : ''}> grátis</label>
      <label title="Controlar estoque"><input type="checkbox" name="controla" ${p.controla ? 'checked' : ''}> ${p.controla ? (est[p.id] || 0) + ' un' : 'não conta'}</label>
      <button class="ib bad" type="button" data-fpd="${p.id}" aria-label="Remover">🗑</button></div>`).join('');
  }
}
function infoAjuste() {
  const id = $('#fraProd').value, est = estoques(), cont = $('#fraTipo').value === 'cont';
  $('#fraLbl').textContent = cont ? 'Quantidade contada' : 'Quantidade perdida';
  $('#fraInfo').textContent = id ? `No sistema: ${est[id] || 0} un.` + (cont ? ' Digite quantas tem de verdade; a diferença é ajustada.' : '') : '';
}
function registrarVenda() {
  const ids = Object.keys(CART).filter(id => CART[id] > 0); if (!ids.length) return;
  const est = estoques();
  const itens = ids.map(id => { const p = viva('fp').find(x => x.id === id); return p && { p: id, nome: p.nome, q: CART[id], v: p.gratis ? 0 : r2(num(p.preco)) }; }).filter(Boolean);
  const falta = itens.filter(it => { const p = viva('fp').find(x => x.id === it.p); return p.controla && it.q > (est[it.p] || 0); });
  if (falta.length && !confirm(`O estoque no sistema não cobre: ${falta.map(it => `${it.nome} (tem ${est[it.p] || 0})`).join(', ')}.\n\nRegistrar mesmo assim? (o estoque ficará negativo até você lançar a entrada ou a contagem)`)) return;
  const valor = r2(itens.reduce((s, it) => s + it.q * it.v, 0));
  const forma = valor > 0 ? ($('#frForma')?.value || 'Pix') : '';
  put('fm', { id: uid(), tipo: 'venda', data: $('#frData')?.value || hoje(), hora: agoraHM(), itens, valor, forma, tx: valor > 0 ? taxaDe(forma) : 0, cliente: ($('#frCli')?.value || '').trim() });
  CART = {}; alterou();
  toast(valor > 0 ? `✅ Venda de ${R(valor)} registrada` : '✅ Consumo registrado');
}

/* =====================================================================
   VALORES E TAXAS
   ===================================================================== */
function previaLemb() {
  const ex = { cliente: 'Maria Souza', data: somaDias(hoje(), 1), hora: '14:00', servicos: [{ nome: 'Tatuagem' }], tatuador: 'Rafa', sessao: '2', totalSessoes: '3', sinal: 100 };
  $('#msgPrev').textContent = textoLembrete(ex, $('#msgLemb').value);
}
function renderCfg() {
  const mq = cfgGet('maquininha', null), sel = $('#ipFaixa');
  if (sel && !sel.options.length) sel.innerHTML = Object.entries(INFINITEPAY).map(([k, v]) => `<option value="${k}">${esc(v.nome)}</option>`).join('');
  if (sel && mq && mq.faixa && document.activeElement !== sel) sel.value = mq.faixa;
  $('#ipInfo').textContent = mq ? `Tabela aplicada: InfinitePay – ${INFINITEPAY[mq.faixa]?.nome || mq.faixa}. Você pode editar qualquer taxa abaixo.` : 'A tabela da InfinitePay será aplicada na primeira sincronização.';
  if (document.activeElement !== $('#msgLemb')) $('#msgLemb').value = cfgGet('msgLembrete', MSG_PADRAO);
  previaLemb();
  const ativo = document.activeElement;
  if (ativo && ativo.closest && ativo.closest('#lstServ, #lstTax, #lstTat')) return;
  $('#lstServ').innerHTML = viva('serv').sort((a, b) => (a.ord ?? 99) - (b.ord ?? 99)).map(s => `<div class="it" data-k="serv" data-id="${s.id}"><input name="nome" value="${esc(s.nome)}" aria-label="Nome"><input class="val" name="valor" inputmode="decimal" value="${nf(s.valor)}" aria-label="Valor padrão"><button class="ib bad" type="button" data-rmc aria-label="Remover">🗑</button></div>`).join('') || '<p class="vazio">Nenhum serviço.</p>';
  $('#lstTax').innerHTML = formasOrd().map(t => `<div class="it" data-k="tax" data-id="${t.id}"><input name="nome" value="${esc(t.nome)}" aria-label="Forma"><input class="val" name="taxa" inputmode="decimal" value="${pct(t.taxa)}" aria-label="Taxa %"><span>%</span><button class="ib bad" type="button" data-rmc aria-label="Remover">🗑</button></div>`).join('');
  const tats = cfgGet('tatuadores', []);
  $('#lstTat').innerHTML = tats.length ? tats.map((t, i) => `<div class="it"><span style="flex:1">🧑‍🎨 ${esc(t)}</span><button class="ib bad" type="button" data-rmt="${i}" aria-label="Remover">🗑</button></div>`).join('') : '<p class="vazio">Nenhum tatuador cadastrado (opcional).</p>';
}

/* =====================================================================
   montagem e eventos
   ===================================================================== */
function renderTudo(deSync) {
  if ($('#app').classList.contains('hid')) return;
  renderAgenda(); renderLembretes(); renderFin(); renderCaixa(); renderFrigo(); renderCfg(); renderStatus();
  if (deSync && MODAL && MODAL.tipo === 'dia' && !$('#diaLst .conf')) abrirDia(MODAL.dia);
}
function montarApp() {
  $$('#abasTopo button, #abasBaixo button').forEach(b => b.addEventListener('click', () => irAba(b.dataset.t)));
  irAba(ABA);
  document.body.classList.toggle('oculto', localStorage.getItem(K.hide) === '1');
  const atOc = () => $('#btOcultar').innerHTML = document.body.classList.contains('oculto') ? '👁<span class="tx"> Mostrar valores</span>' : '🙈<span class="tx"> Ocultar valores</span>';
  atOc();
  $('#btOcultar').addEventListener('click', () => { const on = document.body.classList.toggle('oculto'); localStorage.setItem(K.hide, on ? '1' : '0'); atOc(); });
  $('#btSync').addEventListener('click', () => sincronizar(true));
  $('#btSync2').addEventListener('click', () => sincronizar(true));
  $('#stSync').addEventListener('click', () => { if (syncErro) alert(syncErro); else sincronizar(true); });
  $('#calAnt').addEventListener('click', () => { calRef.setMonth(calRef.getMonth() - 1); renderAgenda(); });
  $('#calProx').addEventListener('click', () => { calRef.setMonth(calRef.getMonth() + 1); renderAgenda(); });
  $('#calHoje').addEventListener('click', () => { calRef = new Date(); calRef.setDate(1); renderAgenda(); });
  $('#fab').addEventListener('click', () => abrirForm(null, hoje()));
  $('#btAgendar').addEventListener('click', () => abrirForm(null, hoje()));
  // cliques gerais (agenda, modal, caixa)
  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('a.wa')) return;
    if (t.closest('#t-frigo')) return;
    const lw = t.closest('[data-lw]');
    if (lw) { const a = viva('ag').find(x => x.id === lw.dataset.lw); if (a) enviarLembrete(a); return; }
    const lcp = t.closest('[data-lcp]');
    if (lcp) { const a = viva('ag').find(x => x.id === lcp.dataset.lcp); if (a) copiarTexto(textoLembrete(a)).then(ok => toast(ok ? '📋 Mensagem copiada' : 'Não consegui copiar neste aparelho.')); return; }
    const lc = t.closest('[data-lconf]');
    if (lc) { const a = viva('ag').find(x => x.id === lc.dataset.lconf); if (a) { put('ag', { ...a, status: 'Confirmado' }); alterou(); toast(`👍 ${a.cliente} confirmado`); } return; }
    const led = t.closest('[data-led]'); if (led) return abrirForm(led.dataset.led);
    const novo = t.closest('[data-novo]'); if (novo) return abrirForm(null, novo.dataset.novo);
    if (t.closest('[data-ac="fechar"]')) return fecharModal();
    if (t.closest('[data-ac="fecharConf"]')) { t.closest('.confw').innerHTML = ''; return; }
    if (t.closest('#kpiCmd')) { irAba('agenda'); setTimeout(() => $('#cardCmd').scrollIntoView({ behavior: 'smooth' }), 50); return; }
    const linha = t.closest('.at[data-id]');
    const ac = t.closest('[data-ac]');
    if (linha && ac) {
      const id = linha.dataset.id, a = viva('ag').find(x => x.id === id); if (!a) return;
      const noModal = !!t.closest('#modal');
      if (ac.dataset.ac === 'pagar') return abrirDia(a.data, id);
      if (ac.dataset.ac === 'ok') { if (!noModal) return abrirDia(a.data, id); return abrirConfirmacao(id); }
      if (ac.dataset.ac === 'falta') return marcarFalta(id);
      if (ac.dataset.ac === 'edit') { if (a.status === 'Finalizado') { if (!noModal) abrirDia(a.data); return abrirConfirmacao(id, 'edit'); } return abrirForm(id); }
    }
    if (linha && !ac && !t.closest('#modal')) return abrirDia(viva('ag').find(x => x.id === linha.dataset.id)?.data || hoje());
    const dia = t.closest('[data-dia]'); if (dia && !t.closest('#modal .conf')) return abrirDia(dia.dataset.dia);
    const ce = t.closest('[data-cxe]'); if (ce) { const m = viva('cx').find(x => x.id === ce.dataset.cxe); if (m) { $('#cxId').value = m.id; $('#cxTipo').value = m.tipo; catsCx(); $('#cxData').value = m.data; $('#cxCat').value = m.cat || ''; $('#cxForma').value = m.forma || ''; $('#cxDesc').value = m.desc || ''; $('#cxValor').value = nf(m.valor); $('#cxCanc').classList.remove('hid'); $('#fCx').scrollIntoView({ behavior: 'smooth' }); } return; }
    const cd = t.closest('[data-cxd]'); if (cd) { const m = viva('cx').find(x => x.id === cd.dataset.cxd); if (m && confirm(`Excluir "${m.desc || m.cat}" de ${R(m.valor)}?`)) { apagar('cx', m.id); alterou(); } return; }
  });
  $('#mx').addEventListener('click', fecharModal);
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') fecharModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && MODAL) fecharModal(); });
  // financeiro
  ['#fAno', '#fMes', '#fForma', '#fServ', '#fTat'].forEach(s => $(s).addEventListener('change', renderFin));
  $('#btCsv').addEventListener('click', exportarCsv);
  // caixa
  $('#cxTipo').addEventListener('change', catsCx); catsCx();
  opcoes($('#cxForma'), formasOrd().map(t => t.nome), 'Pix', '—');
  $('#cxData').value = hoje();
  ['#cxfAno', '#cxfMes'].forEach(s => $(s).addEventListener('change', renderCaixa));
  $('#cxCanc').addEventListener('click', limparCx);
  $('#fCx').addEventListener('submit', e => {
    e.preventDefault();
    const tipo = $('#cxTipo').value, valor = r2(num($('#cxValor').value));
    if (!$('#cxData').value) return $('#cxErro').textContent = 'Informe a data.';
    if (!valor || (tipo !== 'ajuste' && valor < 0)) return $('#cxErro').textContent = tipo === 'ajuste' ? 'Informe o valor (use negativo para diminuir o saldo).' : 'Informe um valor maior que zero.';
    const id = $('#cxId').value || uid();
    put('cx', { id, tipo, data: $('#cxData').value, cat: $('#cxCat').value, forma: $('#cxForma').value, desc: $('#cxDesc').value.trim() || $('#cxCat').value, valor });
    alterou(); toast('💾 Movimento salvo'); limparCx();
  });
  $('#sdSalvar').addEventListener('click', () => { cfgSet('saldoIni', { valor: r2(num($('#sdValor').value)), data: $('#sdData').value }); $('#sdValor').blur(); alterou(); toast('💾 Saldo inicial salvo'); });
  $('#sdAjustar').addEventListener('click', () => {
    if (!$('#sdReal').value.trim()) return toast('Informe o saldo real contado.');
    const real = r2(num($('#sdReal').value)), atual = saldoAtual(movimentos()), dif = r2(real - atual);
    if (!dif) return toast('O saldo já está certo 👍');
    if (!confirm(`Saldo no dashboard: ${R(atual)}\nSaldo real: ${R(real)}\n\nLançar ajuste de ${R(dif)} hoje?`)) return;
    put('cx', { id: uid(), tipo: 'ajuste', data: hoje(), cat: 'Conferência de saldo', forma: '', desc: 'Ajuste de saldo (conferência)', valor: dif });
    $('#sdReal').value = ''; alterou(); toast('⚖️ Saldo ajustado');
  });
  // ---------- frigobar ----------
  $('#frcData').value = hoje(); $('#frfData').value = hoje();
  ['#frfAno', '#frfMes'].forEach(s => $(s).addEventListener('change', renderFrigo));
  $('#t-frigo').addEventListener('click', e => {
    const t = e.target;
    const pb = t.closest('[data-fp]');
    if (pb) {
      const p = viva('fp').find(x => x.id === pb.dataset.fp); if (!p) return;
      if (semPreco(p)) { toast(`Defina o preço de ${p.nome} em "Produtos e preços" (ou marque como grátis).`, 4000); return; }
      CART[p.id] = (CART[p.id] || 0) + 1;
      const q = estoques()[p.id] || 0;
      if (p.controla && CART[p.id] > q) toast(`⚠️ ${p.nome}: o sistema mostra só ${q} em estoque.`);
      return renderFrigo();
    }
    const cq = t.closest('[data-cq]'); if (cq) { const id = cq.dataset.cq; CART[id] = Math.max(0, (CART[id] || 0) + +cq.dataset.d); if (!CART[id]) delete CART[id]; return renderFrigo(); }
    if (t.closest('#frLimpar')) { CART = {}; return renderFrigo(); }
    if (t.closest('#frReg')) return registrarVenda();
    const fmd = t.closest('[data-fmd]');
    if (fmd) {
      const m = viva('fm').find(x => x.id === fmd.dataset.fmd); if (!m) return;
      if (confirm(`Excluir este movimento de ${br(m.data)}?${(m.itens || []).length ? '\n\nO estoque volta ao que era antes dele.' : ''}`)) { apagar('fm', m.id); alterou(); toast('Movimento excluído'); }
      return;
    }
    const fpd = t.closest('[data-fpd]');
    if (fpd) {
      const p = viva('fp').find(x => x.id === fpd.dataset.fpd);
      if (p && confirm(`Remover "${p.nome}" da lista? Os movimentos já lançados continuam no histórico.`)) { apagar('fp', p.id); delete CART[p.id]; fpd.blur(); alterou(); }
    }
  });
  $('#frCart').addEventListener('change', e => { if (e.target.id === 'frForma') renderCarrinho(); });
  $('#lstProd').addEventListener('change', e => {
    const row = e.target.closest('.it[data-id]'); if (!row) return;
    const p = viva('fp').find(x => x.id === row.dataset.id); if (!p) return;
    const g = n => row.querySelector(`[name=${n}]`);
    const nome = g('nome').value.trim(); if (!nome) return toast('O nome não pode ficar vazio.');
    put('fp', { ...p, nome, preco: r2(num(g('preco').value)), custo: r2(num(g('custo').value)), min: Math.max(0, parseInt(g('min').value) || 0), gratis: g('gratis').checked, controla: g('controla').checked });
    const estrutural = e.target.type === 'checkbox';
    if (estrutural) e.target.blur();
    DB.pend++; salvarDB(); agendarSync(); toast('💾 Salvo');
    renderFrigo();
  });
  $('#fFrP').addEventListener('submit', e => {
    e.preventDefault();
    const nome = $('#npNome').value.trim(); if (!nome) return;
    if (viva('fp').some(p => norm(p.nome) === norm(nome))) return toast('Esse produto já existe.');
    const id = uid(), q = Math.max(0, parseInt($('#npQtd').value) || 0);
    put('fp', { id, nome, preco: r2(num($('#npPreco').value)), custo: 0, min: 2, gratis: false, controla: true, ord: Math.max(0, ...viva('fp').map(p => p.ord ?? 0)) + 1 });
    if (q) put('fm', { id: uid(), tipo: 'inicial', data: hoje(), hora: agoraHM(), desc: 'Estoque inicial', valor: 0, itens: [{ p: id, nome, q, v: 0 }] });
    $('#npNome').value = $('#npPreco').value = $('#npQtd').value = ''; $('#npNome').blur(); alterou(); toast('➕ Produto cadastrado');
  });
  $('#fFrC').addEventListener('submit', e => {
    e.preventDefault();
    const er = $('#frcErro'); er.textContent = '';
    const pid = $('#frcProd').value, q = parseInt($('#frcQtd').value) || 0, valor = r2(num($('#frcValor').value));
    const p = viva('fp').find(x => x.id === pid);
    if (!p) return er.textContent = 'Escolha o produto.';
    if (q <= 0) return er.textContent = 'Informe a quantidade.';
    if (valor < 0) return er.textContent = 'Valor inválido.';
    put('fm', { id: uid(), tipo: 'compra', data: $('#frcData').value || hoje(), hora: agoraHM(), itens: [{ p: pid, nome: p.nome, q, v: q ? r2(valor / q) : 0 }], valor, desc: '' });
    if (valor > 0) put('fp', { ...p, custo: r2(valor / q) });
    $('#frcQtd').value = $('#frcValor').value = ''; alterou(); toast(`📦 +${q} ${p.nome}`);
  });
  $('#fraProd').addEventListener('change', infoAjuste); $('#fraTipo').addEventListener('change', infoAjuste);
  $('#fFrA').addEventListener('submit', e => {
    e.preventDefault();
    const pid = $('#fraProd').value, p = viva('fp').find(x => x.id === pid); if (!p) return toast('Escolha o produto.');
    const v = $('#fraQtd').value.trim(); if (v === '') return toast('Informe a quantidade.');
    const n = Math.max(0, parseInt(v) || 0), atual = estoques()[pid] || 0;
    if ($('#fraTipo').value === 'cont') {
      const d = n - atual; if (!d) return toast('O estoque já está certo 👍');
      if (!confirm(`${p.nome}: sistema ${atual}, contado ${n}.\nAjustar ${d > 0 ? '+' : ''}${d}?`)) return;
      put('fm', { id: uid(), tipo: 'ajuste', data: hoje(), hora: agoraHM(), itens: [{ p: pid, nome: p.nome, q: d, v: 0 }], valor: 0, desc: 'Contagem' });
    } else {
      if (!n) return toast('Informe a quantidade perdida.');
      put('fm', { id: uid(), tipo: 'perda', data: hoje(), hora: agoraHM(), itens: [{ p: pid, nome: p.nome, q: n, v: 0 }], valor: 0, desc: 'Perda / vencido / quebrado' });
    }
    $('#fraQtd').value = ''; alterou(); toast('⚖️ Estoque ajustado');
  });
  $('#fFrF').addEventListener('submit', e => {
    e.preventDefault();
    const er = $('#frfErro'); er.textContent = '';
    const valor = r2(num($('#frfValor').value)); if (valor <= 0) return er.textContent = 'Informe um valor maior que zero.';
    put('fm', { id: uid(), tipo: $('#frfTipo').value, data: $('#frfData').value || hoje(), hora: agoraHM(), itens: [], valor, desc: $('#frfDesc').value.trim() || ($('#frfTipo').value === 'saida' ? 'Saída' : 'Entrada') });
    $('#frfDesc').value = $('#frfValor').value = ''; alterou(); toast('💾 Lançado no caixa do frigobar');
  });
  // valores e taxas
  const editCfg = e => {
    const it = e.target.closest('.it[data-k]'); if (!it) return;
    const k = it.dataset.k, r = viva(k).find(x => x.id === it.dataset.id); if (!r) return;
    const nome = it.querySelector('[name=nome]').value.trim(); if (!nome) return toast('O nome não pode ficar vazio.');
    const novo = { ...r, nome }; if (k === 'serv') novo.valor = r2(num(it.querySelector('[name=valor]').value)); else novo.taxa = num(it.querySelector('[name=taxa]').value);
    put(k, novo); DB.pend++; salvarDB(); agendarSync(); toast('💾 Salvo'); renderFin(); renderAgenda(); renderStatus();
  };
  ['#lstServ', '#lstTax'].forEach(s => { $(s).addEventListener('change', editCfg); $(s).addEventListener('click', e => { const b = e.target.closest('[data-rmc]'); if (!b) return; const it = b.closest('.it'); const r = viva(it.dataset.k).find(x => x.id === it.dataset.id); if (r && confirm(`Remover "${r.nome}" da lista? Os atendimentos já lançados não mudam.`)) { apagar(it.dataset.k, r.id); b.blur(); alterou(); } }); });
  $('#ipAplicar').addEventListener('click', () => {
    const f = $('#ipFaixa').value;
    if (!confirm(`Aplicar as taxas da InfinitePay – ${INFINITEPAY[f].nome}?\n\nDébito, Crédito 1x a 12x são substituídos (Pix, Dinheiro e Permuta ficam 0%). Os atendimentos já finalizados NÃO mudam.`)) return;
    aplicarInfinity(f); $('#ipAplicar').blur(); alterou(); toast('💳 Taxas da InfinitePay aplicadas');
  });
  $('#waModo').addEventListener('change', e => { localStorage.setItem(K.wa, e.target.value); toast('📲 Jeito de abrir salvo neste aparelho'); });
  $('#msgLemb').addEventListener('input', previaLemb);
  $('#msgSalvar').addEventListener('click', () => { const v = $('#msgLemb').value.trim(); if (!v) return toast('A mensagem não pode ficar vazia.'); cfgSet('msgLembrete', v); $('#msgLemb').blur(); alterou(); toast('💾 Mensagem salva'); });
  $('#msgPadrao').addEventListener('click', () => { if (!confirm('Voltar para a mensagem padrão?')) return; cfgSet('msgLembrete', MSG_PADRAO); $('#msgLemb').value = MSG_PADRAO; alterou(); toast('Mensagem padrão restaurada'); });
  const maxOrd = k => Math.max(0, ...viva(k).map(x => x.ord ?? 0)) + 1;
  $('#fServ2').addEventListener('submit', e => { e.preventDefault(); const n = $('#nsNome').value.trim(); if (!n) return; if (viva('serv').some(s => norm(s.nome) === norm(n))) return toast('Esse serviço já existe.'); put('serv', { id: uid(), nome: n, valor: r2(num($('#nsValor').value)), ord: maxOrd('serv') }); $('#nsNome').value = $('#nsValor').value = ''; $('#nsNome').blur(); alterou(); });
  $('#fTax').addEventListener('submit', e => { e.preventDefault(); const n = $('#ntNome').value.trim(); if (!n) return; if (viva('tax').some(s => norm(s.nome) === norm(n))) return toast('Essa forma já existe.'); put('tax', { id: uid(), nome: n, taxa: num($('#ntTaxa').value), ord: maxOrd('tax') }); $('#ntNome').value = $('#ntTaxa').value = ''; $('#ntNome').blur(); alterou(); });
  $('#fTat2').addEventListener('submit', e => { e.preventDefault(); const n = $('#nTat').value.trim(); if (!n) return; const l = cfgGet('tatuadores', []); if (!l.includes(n)) cfgSet('tatuadores', [...l, n]); $('#nTat').value = ''; $('#nTat').blur(); alterou(); });
  $('#lstTat').addEventListener('click', e => { const b = e.target.closest('[data-rmt]'); if (!b) return; const l = [...cfgGet('tatuadores', [])]; const n = l[+b.dataset.rmt]; if (confirm(`Remover ${n}?`)) { l.splice(+b.dataset.rmt, 1); cfgSet('tatuadores', l); b.blur(); alterou(); } });
  // backup
  $('#btBackup').addEventListener('click', () => baixar(`saint-tattoo-backup-${hoje()}.json`, JSON.stringify(DB.data, null, 1), 'application/json'));
  $('#inBackup').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const d = normDados(JSON.parse(await f.text())); if (!confirm(`Importar backup com ${d.ag.filter(r => !r.del).length} agendamento(s)? Ele será juntado aos dados atuais (o registro mais recente vale).`)) return; DB.data = mesclar(DB.data, d); alterou(); toast('✅ Backup importado'); }
    catch (err) { alert('Arquivo de backup inválido: ' + err.message); }
  });
  // conexão
  window.addEventListener('online', () => { renderStatus(); sincronizar(false); });
  window.addEventListener('offline', renderStatus);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { sincronizar(false); renderAgenda(); } });
  setInterval(() => { if (document.visibilityState === 'visible') sincronizar(false); }, 60000);
  setInterval(() => { if (document.visibilityState === 'visible' && !MODAL) renderAgenda(); }, 5 * 60000);
}

/* ---------------- início ---------------- */
(function iniciar() {
  if (!window.crypto || !crypto.subtle) { document.body.innerHTML = '<p style="padding:20px">Abra o dashboard pelo endereço <b>https://</b> do GitHub Pages.</p>'; return; }
  const s = lerLS(K.sess);
  const vai = ok => {
    if (!ok) { mostrar('telaLogin'); return setTimeout(() => $('#lSenha').focus(), 50); }
    if (!CFG || (CFG.enc && CFG.t == null)) return irSetup();
    TOKEN = CFG.local ? null : (CFG.t || null); entrar();
  };
  if (!SENHA) { mostrar('telaLogin'); $('#lErro').textContent = 'Senha não definida: confira o arquivo config.js no GitHub.'; return; }
  if (s && s.h) hashSenha(SENHA).then(h => vai(h === s.h && !(CFG && CFG.enc && CFG.t == null))); else vai(false);
})();

/* ---------------- modo offline / atualização do site ---------------- */
if ('serviceWorker' in navigator) {
  let recarregou = false; const tinhaSW = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (recarregou || !tinhaSW) return; recarregou = true; if (!MODAL) location.reload(); else toast('Nova versão do site instalada. Ela aparece na próxima vez que abrir.', 5000); });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then(r => { r.update(); setInterval(() => r.update(), 30 * 60000); }).catch(() => {}));
}
