'use strict';

const statuses = ['Por aprobar','Aprobado','En producción','Listo','Entregado'];
const stepLabels = ['Muestra','Aprobado','Bordado','Listo','Entregado'];
const sizes = ['XS','S','M','L','XL','XXL','Único'];
const storage = 'novatec-bordamart-v1';
const example = 'BM-204';
const zone = 'America/Asuncion';
const titles = ['pedidos','taller','entregas'];
const $ = id => document.getElementById(id);
const orderDialog = $('order-dialog');
const newDialog = $('new-dialog');
const resetDialog = $('reset-dialog');
const form = $('new-form');
const search = $('search');
const filter = $('filter');
const deliveryFilter = $('delivery-filter');
const arrow = '<span class="arrow" aria-hidden="true"></span>';
const number = new Intl.NumberFormat('es-PY');
const format = value => number.format(value);
const today = () => new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:zone}).format(new Date());
const localDay = (value,options = {day:'numeric',month:'short'}) => new Intl.DateTimeFormat('es-PY',{timeZone:'UTC',...options}).format(new Date(value+'T12:00:00Z'));
const clean = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const escape = value => String(value).replace(/[&<>"']/g,ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);

function offsetDay(addDays) {
  const date = new Date(today()+'T12:00:00Z');
  date.setUTCDate(date.getUTCDate()+addDays);
  return date.toISOString().slice(0,10);
}

function seed() {
  return [
    {id:example,client:'Colegio Horizonte',type:'Colegio',garment:'Buzos',due:offsetDay(2),size:[0,24,42,36,18,0,0],
      placement:'Pecho izquierdo · ancho 8 cm',note:'Hilo blanco y turquesa sobre buzo azul marino. Separar el lote por talle.',
      sample:'HORIZONTE',art:'',revision:2,state:0,finished:0,approvedAt:''},
    {id:'BM-205',client:'Grupo Vértice',type:'Empresa',garment:'Chombas',due:offsetDay(4),size:[0,12,24,32,20,8,0],
      placement:'Pecho izquierdo · ancho 7 cm',note:'Identificar las bolsas por área.',sample:'VÉRTICE',art:'',revision:1,state:1,finished:0,approvedAt:today()},
    {id:'BM-203',client:'Estación Arrayán',type:'Empresa',garment:'Kepis',due:offsetDay(1),size:[0,0,0,0,0,0,150],
      placement:'Frente · centrado',note:'Controlar el centrado antes de empacar.',sample:'ARRAYÁN',art:'',revision:1,state:2,finished:72,approvedAt:offsetDay(-2)},
    {id:'BM-202',client:'Comercial Aguará',type:'Empresa',garment:'Delantales',due:offsetDay(-1),size:[0,0,0,0,0,0,48],
      placement:'Pecho · ancho 9 cm',note:'Revisar los hilos sueltos al terminar.',sample:'AGUARÁ',art:'',revision:2,state:2,finished:36,approvedAt:offsetDay(-4)},
    {id:'BM-201',client:'Instituto Lapacho',type:'Colegio',garment:'Remeras',due:today(),size:[0,16,24,20,0,0,0],
      placement:'Pecho izquierdo',note:'Preparar cajas para retiro.',sample:'LAPACHO',art:'',revision:1,state:3,finished:60,approvedAt:offsetDay(-4)},
    {id:'BM-200',client:'Taller Laurel',type:'Empresa',garment:'Camperas',due:offsetDay(-2),size:[0,4,8,10,6,0,0],
      placement:'Pecho derecho',note:'',sample:'LAUREL',art:'',revision:1,state:4,finished:28,approvedAt:offsetDay(-7)}
  ];
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(storage));
    if (Array.isArray(saved) && saved.length && saved.every(item => statuses[item.state] && item.due && Array.isArray(item.size))) return saved;
  } catch {}
  return seed();
}

let orders = load();
let activeId = '';
let metric = '';
let toastTimer;
const total = order => order.size.reduce((sum,value)=>sum+value,0);
const getOrder = id => orders.find(order=>order.id===id);
const late = order => order.state<4 && order.due<today();
const pill = order => `<span class="pill s${order.state}">${statuses[order.state]}</span>`;
const meter = order => `<progress class="meter" aria-label="Avance de ${escape(order.id)}" value="${order.finished}" max="${total(order)}"></progress><span class="progress-label">${format(order.finished)} / ${format(total(order))} prendas</span>`;

function persist() {
  try {
    localStorage.setItem(storage,JSON.stringify(orders));
    return true;
  } catch {
    return false;
  }
}

function toast(message) {
  $('toast').textContent=message;
  $('toast').hidden=false;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{$('toast').hidden=true;},3600);
}

function render() {
  $('today').textContent=localDay(today(),{weekday:'long',day:'numeric',month:'long'});
  const metricRows = [
    ['approval','Por aprobar',orders.filter(o=>o.state===0).length,'Muestras pendientes'],
    ['production','En producción',orders.filter(o=>o.state===2).length,'Lotes en máquina'],
    ['late','Entregas vencidas',orders.filter(late).length,'Para revisar']
  ];
  $('metrics').innerHTML=metricRows.map(([id,label,count,help])=>`<button type="button" class="metric" data-action="metric" data-id="${id}" aria-pressed="${metric===id}"><span>${label}</span><strong>${count}</strong><small>${help}</small></button>`).join('');
  renderOrders();
  renderWorkshop();
  renderDeliveries();
}

function renderOrders() {
  const query=clean(search.value.trim());
  const list=orders.filter(order=>
    (!filter.value || String(order.state)===filter.value) &&
    (metric!=='late' || late(order)) &&
    clean([order.id,order.client,order.garment,order.type].join(' ')).includes(query)
  );
  $('count').textContent=list.length+(list.length===1?' pedido':' pedidos')+(metric==='late'?' · Entregas vencidas':'');
  $('orders').innerHTML=list.length ? `<div class="order-head" aria-hidden="true"><span>Cliente</span><span>Prenda</span><span>Avance</span><span>Estado</span><span>Entrega</span><span></span></div>`+list.map(order=>`
    <button class="order-row" type="button" data-action="open" data-id="${order.id}">
      <span class="order-client"><strong>${escape(order.client)}</strong><small>${order.id} · ${escape(order.type)}</small></span>
      <span class="order-item">${escape(order.garment)}</span>
      <span class="order-progress">${meter(order)}</span>
      ${pill(order)}
      <span class="due-date">${localDay(order.due)}${late(order)?'<small>Vencido</small>':''}</span>${arrow}
    </button>`).join('') : '<p class="empty">No hay pedidos con estos filtros.</p>';
}

function renderWorkshop() {
  const list=orders.filter(o=>o.state===1||o.state===2).sort((a,b)=>a.due.localeCompare(b.due));
  $('workbench').innerHTML=list.map(o=>`<article class="bench-card">
    <p>${o.id} · ${escape(o.garment)}</p><h2>${escape(o.client)}</h2>${pill(o)}
    <div>${meter(o)}</div><p>Entrega acordada · ${localDay(o.due)}</p>
    <button class="button secondary" type="button" data-action="open" data-id="${o.id}">Abrir lote ${arrow}</button></article>`).join('') ||
    '<p class="empty">No hay lotes con muestra aprobada o en producción.</p>';
}

function renderDeliveries() {
  const mode=deliveryFilter.value;
  const list=orders.filter(o=>mode==='late'?late(o):mode==='done'?o.state===4:o.state<4).sort((a,b)=>a.due.localeCompare(b.due));
  $('deliveries').innerHTML=list.map(o=>`<button class="agenda-row" type="button" data-action="open" data-id="${o.id}">
    <span><strong>${localDay(o.due)}</strong>${late(o)?'<small>Fecha vencida</small>':''}</span>
    <span><strong>${escape(o.client)}</strong><small>${o.id} · ${escape(o.garment)}</small></span>
    <span class="agenda-type">${format(total(o))} prendas</span>${pill(o)}${arrow}</button>`).join('') ||
    '<p class="empty">No hay entregas para este filtro.</p>';
}

function changeView() {
  const hash=location.hash.slice(1);
  const view=titles.includes(hash)?hash:'pedidos';
  for (const id of titles) $('view-'+id).hidden=id!==view;
  for (const link of document.querySelectorAll('[data-view]')) {
    if (link.dataset.view===view) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  if (hash!=='main') window.scrollTo(0,0);
}

function showOrder(id) {
  const order=getOrder(id);
  if (!order) return;
  activeId=id;
  $('order-code').textContent=id+' · '+order.type;
  $('order-title').textContent=order.client;
  $('order-subtitle').textContent=order.garment+' · '+format(total(order))+' prendas · Entrega '+localDay(order.due);
  const isEditable=order.state<2;
  const isArt=Boolean(order.art||order.sample);
  const isApproved=order.state>=1;
  let preview=order.sample?`<b>${escape(order.sample)}</b>`:'Sin muestra adjunta';
  if (order.art) preview=`<img src="${escape(order.art)}" alt="Arte de bordado adjunto">`;
  const progressForm=order.state===2?`<form id="progress-form" class="production-entry"><label>Prendas bordadas<input name="finished" inputmode="numeric" type="number" step="1" min="0" max="${total(order)}" required value="${order.finished}"></label><button class="button secondary" type="submit">Guardar avance</button></form>`:'';
  let action='';
  if (order.state===0) action=`<button class="button primary" type="button" data-action="approve"${isArt?'':' disabled'}>Aprobar muestra ${arrow}</button>`;
  if (order.state===1) action=`<button class="button primary" type="button" data-action="start">Iniciar producción ${arrow}</button>`;
  if (order.state===2) action=`<button class="button primary" type="button" data-action="ready"${order.finished===total(order)?'':' disabled'}>Validar lote y marcar listo ${arrow}</button>`;
  if (order.state===3) action=`<button class="button primary" type="button" data-action="delivered">Marcar entregado ${arrow}</button>`;
  $('order-body').innerHTML=`
    <ol class="steps" aria-label="Etapas del pedido">${stepLabels.map((label,i)=>`<li${i===order.state?' aria-current="step"':i<order.state?' class="done"':''}>${label}</li>`).join('')}</ol>
    <div class="detail-grid">
      <section class="detail-box"><h3>Muestra de bordado</h3><div class="design-preview">${preview}</div>
      <p>${isArt ? 'Versión '+order.revision+(isApproved?' · Aprobada el '+localDay(order.approvedAt):' · Pendiente de aprobación'):'Adjuntá el arte para poder aprobar la muestra.'}</p>
      <p>${escape(order.placement||'Ubicación por definir.')}</p>
      ${isEditable?'<label class="file-label">'+(isArt?'Cargar nueva versión':'Adjuntar logo')+'<input id="art-input" type="file" accept="image/png,image/jpeg,image/webp"></label>':''}
      </section>
      <section class="detail-box"><h3>Cantidades por talle</h3><div class="size-list">${order.size.map((n,i)=>n?`<span><b>${sizes[i]}</b>${format(n)}</span>`:'').join('')}</div>
      <h3 class="production-title">Avance de bordado</h3>${meter(order)}${progressForm}
      ${order.state===2&&order.finished<total(order)?'<p>Completá la cantidad del lote para marcarlo listo.</p>':''}</section>
    </div>
    ${order.note?`<p class="note"><strong>Indicaciones del taller</strong><br>${escape(order.note)}</p>`:''}
    <div class="actions">${action}</div><p id="order-notice" class="inline-status" role="status"></p>`;
  if (!orderDialog.open) orderDialog.showModal();
}

function updateOrder(order,message) {
  const saved=persist();
  render();
  showOrder(order.id);
  const focus=orderDialog.querySelector('.actions button:not(:disabled)') || $('order-notice');
  if (focus.id==='order-notice') focus.tabIndex=-1;
  focus.focus();
  $('order-notice').textContent=saved?message:message+' Disponible durante esta sesión.';
}

function showNew() {
  form.reset();
  form.elements.due.value=offsetDay(3);
  $('form-error').textContent='';
  $('form-total').textContent='Total · 0 prendas';
  newDialog.showModal();
}

function currentSizes() { return sizes.map((_,i)=>Number(form.elements['size-'+i].value)); }

$('size-inputs').innerHTML=sizes.map((size,i)=>`<label>${size}<input name="size-${i}" type="number" min="0" max="9999" step="1" inputmode="numeric" placeholder="0"></label>`).join('');
form.addEventListener('input',event=>{
  form.elements.client.setCustomValidity('');
  if (event.target.name?.startsWith('size-')) $('form-total').textContent='Total · '+format(currentSizes().reduce((a,b)=>a+b,0))+' prendas';
});

form.addEventListener('submit',event=>{
  event.preventDefault();
  const data=new FormData(form);
  const client=data.get('client').trim();
  if (!client) {
    form.elements.client.setCustomValidity('Ingresá el nombre del cliente.');
    form.elements.client.reportValidity();
    return;
  }
  const size=currentSizes();
  if (!size.some(Boolean)) {
    $('form-error').textContent='Ingresá al menos una prenda en uno de los talles.';
    form.elements['size-0'].focus();
    return;
  }
  const next=Math.max(205,...orders.map(o=>Number(o.id.slice(3))))+1;
  const order={id:'BM-'+next,client,type:data.get('type'),garment:data.get('garment'),due:data.get('due'),size,
    placement:data.get('placement').trim(),note:data.get('note').trim(),sample:'',art:'',revision:0,state:0,finished:0,approvedAt:''};
  orders.unshift(order);
  const saved=persist();
  search.value='';
  filter.value='';
  metric='';
  newDialog.close();
  changeView();
  render();
  showOrder(order.id);
  $('order-notice').textContent=saved?'Pedido registrado.':'Pedido disponible durante esta sesión.';
});

async function attachArtwork(file,order) {
  try {
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>8*1024*1024) {
      throw new Error('Elegí un archivo PNG, JPG o WebP de hasta 8 MB.');
    }
    const bitmap=await createImageBitmap(file);
    const ratio=Math.min(1,460/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*ratio));
    canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    bitmap.close();
    if (order.state>=2 || getOrder(order.id)!==order) return;
    order.art=canvas.toDataURL('image/webp',.83);
    order.revision+=1;
    order.state=0;
    order.approvedAt='';
    if (orderDialog.open&&activeId===order.id) updateOrder(order,'Nueva versión cargada. Pendiente de aprobación.');
    else { persist(); render(); }
  } catch (error) {
    const status=$('order-notice');
    if (status&&activeId===order.id) status.textContent=error instanceof Error&&error.message.startsWith('Elegí')?error.message:'No pudimos abrir la imagen. Probá con otro archivo.';
  }
}

$('order-body').addEventListener('change',event=>{
  if (event.target.id==='art-input'&&event.target.files[0]) attachArtwork(event.target.files[0],getOrder(activeId));
});

$('order-body').addEventListener('submit',event=>{
  if (event.target.id!=='progress-form') return;
  event.preventDefault();
  const order=getOrder(activeId);
  const value=Number(new FormData(event.target).get('finished'));
  if (order.state!==2 || !Number.isInteger(value) || value<0 || value>total(order)) return;
  order.finished=value;
  updateOrder(order,'Avance guardado.');
});

const transitions={
  approve:{from:0,message:'Muestra aprobada.',condition:o=>!!(o.art||o.sample)},
  start:{from:1,message:'Lote enviado a producción.',condition:o=>!!o.approvedAt},
  ready:{from:2,message:'Lote revisado y listo para entregar.',condition:o=>o.finished===total(o)},
  delivered:{from:3,message:'Entrega registrada.',condition:()=>true}
};

document.addEventListener('click',event=>{
  const button=event.target.closest('button[data-action]');
  if (!button) return;
  const {action,id}=button.dataset;
  if (Object.hasOwn(transitions,action)) {
    const order=getOrder(activeId);
    const rule=transitions[action];
    if (order?.state!==rule.from || !rule.condition(order)) return;
    if (action==='approve') order.approvedAt=today();
    order.state+=1;
    updateOrder(order,rule.message);
    return;
  }
  switch(action) {
    case 'new': showNew(); break;
    case 'example': showOrder(example); break;
    case 'open': showOrder(id); break;
    case 'close-order': orderDialog.close(); break;
    case 'close-new': newDialog.close(); break;
    case 'reset': resetDialog.showModal(); break;
    case 'cancel-reset': resetDialog.close(); break;
    case 'confirm-reset':
      orders=seed();
      metric='';
      search.value='';
      filter.value='';
      deliveryFilter.value='pending';
      resetDialog.close();
      render();
      toast(persist()?'Demo reiniciada.':'Demo reiniciada durante esta sesión.');
      break;
    case 'metric':
      metric=metric===id?'':id;
      filter.value=({approval:'0',production:'2'})[metric]||'';
      render();
      document.querySelector(`.metric[data-id="${id}"]`)?.focus();
      break;
  }
});

filter.addEventListener('change',()=>{metric='';render();});
search.addEventListener('input',renderOrders);
deliveryFilter.addEventListener('change',renderDeliveries);
window.addEventListener('hashchange',changeView);
persist();
changeView();
render();
