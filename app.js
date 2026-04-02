/* Minimal link manager using localStorage. Single-screen, touch-friendly. Added drag-and-drop reorder and simple auth. */
/* Highlight.js eliminado para mejor rendimiento - no se usa actualmente */

const STORAGE_KEY = 'links.v1';
const STORAGE_CODE_KEY = 'codes.v1';
const STORAGE_DELIVERY_KEY = 'delivery.v1';
const AUTH_KEY = 'session.v1';
const STORAGE_CODE_KEY = 'codes.v1';
const STORAGE_DELIVERY_KEY = 'delivery.v1';
const AUTH_KEY = 'session.v1'; // store username when logged in

const el = id => document.getElementById(id);
const qs = s => document.querySelector(s);



/* Pedidos (orders) elements */
const codeTitleIn = el('codeTitle');      // cliente nombre
const codePhoneIn = el('codePhone');      // telefono
const codeAddressIn = el('codeAddress');  // direccion
const codeProductIn = el('codeProduct');  // producto pedido
const codeQuantityIn = el('codeQuantity'); // cantidad
const codeNoteIn = el('codeNote');        // nota opcional
const addCodeBtn = el('addCode');
const clearCodeBtn = el('clearCode');
const codeListEl = el('codeList');
const searchCodeIn = el('searchCode');
const codeTpl = qs('#codeTpl');

// delivery elements
const deliveryNameIn = el('deliveryName');
const deliveryAddrIn = el('deliveryAddr');
const deliveryNoteIn = el('deliveryNote');
const addDeliveryBtn = el('addDelivery');
const clearDeliveryBtn = el('clearDelivery');
const deliveryListEl = el('deliveryList');
const searchDeliveryIn = el('searchDelivery');



const listEl = el('list');
const tpl = qs('#itemTpl');


const loginBtn = el('loginBtn');
const logoutBtn = el('logoutBtn');
const loginOverlay = el('loginOverlay');
const doLogin = el('doLogin');
const cancelLogin = el('cancelLogin');
const loginUser = el('loginUser');
const loginPass = el('loginPass');
const toast = el('toast');
const statusBadge = el('statusBadge');

// profile elements & storage key
const PROFILE_KEY = 'profile.v1';
const profileAvatarEl = el('profileAvatar');
const profileNameEl = el('profileName');
const profileOverlay = el('profileOverlay');
const profileNameInput = el('profileNameInput');
const profileAvatarInput = el('profileAvatarInput');
const saveProfileBtn = el('saveProfile');
const cancelProfileBtn = el('cancelProfile');

let profile = { name: 'Guest', avatar: 'https://www.gravatar.com/avatar/?d=mp' };

function loadProfile(){
  try{
    const raw = localStorage.getItem(PROFILE_KEY);
    if(raw) profile = JSON.parse(raw);
  }catch(e){}
  updateProfileUI();
}
function saveProfile(){
  try{
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }catch(e){}
  updateProfileUI();
}
function updateProfileUI(){
  profileAvatarEl.src = profile.avatar || 'https://www.gravatar.com/avatar/?d=mp';
  profileNameEl.textContent = profile.name || 'Guest';
  // status badge reflects admin/guest
  statusBadge.textContent = isAdmin ? 'Admin' : 'Guest';
}

// profile overlay handlers
profileAvatarEl.addEventListener('click', (e)=>{
  e.stopPropagation();
  profileNameInput.value = profile.name === 'Guest' ? '' : profile.name;
  profileAvatarInput.value = profile.avatar || '';
  profileOverlay.style.display = 'block';
  profileOverlay.setAttribute('aria-hidden','false');
  profileNameInput.focus();
});
saveProfileBtn.addEventListener('click', ()=>{
  const name = (profileNameInput.value || '').trim();
  const avatar = (profileAvatarInput.value || '').trim();
  profile.name = name || (isAdmin ? 'Admin' : 'Guest');
  profile.avatar = avatar || 'https://www.gravatar.com/avatar/?d=mp';
  saveProfile();
  profileOverlay.style.display = 'none';
  profileOverlay.setAttribute('aria-hidden','true');
});
cancelProfileBtn.addEventListener('click', ()=>{
  profileOverlay.style.display = 'none';
  profileOverlay.setAttribute('aria-hidden','true');
});

let links = [];
let codes = [];
let deliveries = [];
let editId = null;
let editCodeId = null;
let draggingId = null;
let draggingDeliveryId = null;
let isAdmin = false;
let activeView = 'links'; // 'links' or 'code' or 'delivery'

// hardcoded credentials
const CREDENTIALS = { user: 'anocgestor', pass: '12457889/Aa' };

function saveAll(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
  localStorage.setItem(STORAGE_CODE_KEY, JSON.stringify(codes));
  localStorage.setItem(STORAGE_DELIVERY_KEY, JSON.stringify(deliveries));
  render();
}

function loadAll(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    links = raw ? JSON.parse(raw) : [];
  }catch(e){ links = [] }
  try{
    const cr = localStorage.getItem(STORAGE_CODE_KEY);
    codes = cr ? JSON.parse(cr) : [];
  }catch(e){ codes = [] }
  try{
    const dr = localStorage.getItem(STORAGE_DELIVERY_KEY);
    deliveries = dr ? JSON.parse(dr) : [];
  }catch(e){ deliveries = [] }
}
function normalizeTags(raw){
  if(!raw) return [];
  return raw.split(',').map(t=>t.trim()).filter(Boolean).slice(0,10);
}
// product helpers (we reuse the links storage to hold products)
function addProduct(name){
  const id = Date.now().toString();
  // set a default price for bottled water; can be extended later
  const price = 1.2;
  const stock = 50;
  // no image URL input anymore; use empty url to fall back to placeholder
  links.unshift({id, url: '', title: name || 'Agua embotellada', tags: [], price, stock});
  saveAll();
}
function updateProduct(id, name){
  const i = links.findIndex(l=>l.id===id);
  if(i>=0){ links[i] = {id, url: links[i].url || '', title: name || 'Agua embotellada', tags: [], price: links[i].price || 1.2, stock: links[i].stock || 50}; saveAll(); }
}
function deleteLink(id){
  links = links.filter(l=>l.id!==id); saveAll();
}
function openInNewTab(url){
  // open product image or info in a new tab
  if(!url) return;
  window.open(url,'_blank','noopener');
}

function reorderById(dragId, beforeId){
  const from = links.findIndex(l=>l.id===dragId);
  if(from === -1) return;
  const item = links.splice(from,1)[0];
  if(!beforeId){
    links.push(item);
  }else{
    const to = links.findIndex(l=>l.id===beforeId);
    if(to === -1){
      links.push(item);
    }else{
      links.splice(to,0,item);
    }
  }
  saveAll();
}

/* Reorder deliveries array by id (used for Reparto drag/drop) */
function reorderDeliveryById(dragId, beforeId){
  const from = deliveries.findIndex(l=>l.id===dragId);
  if(from === -1) return;
  const item = deliveries.splice(from,1)[0];
  if(!beforeId){
    deliveries.push(item);
  }else{
    const to = deliveries.findIndex(l=>l.id===beforeId);
    if(to === -1){
      deliveries.push(item);
    }else{
      deliveries.splice(to,0,item);
    }
  }
  saveAll();
}

function showToast(msg, timeout = 1800){
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(()=> toast.classList.remove('visible'), timeout);
}

/* robust copy helper: try navigator.clipboard, otherwise fallback to textarea+execCommand */
async function copyText(text){
  if(!text) return false;
  // try modern clipboard API first
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(text);
      return true;
    }
  }catch(e){
    // continue to fallback
  }
  // fallback method
  try{
    const ta = document.createElement('textarea');
    ta.value = text;
    // prevent flash on mobile
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.setAttribute('readonly','');
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }catch(e){
    return false;
  }
}

function setAdminState(state){
  isAdmin = !!state;
  if(isAdmin){
    document.documentElement.classList.add('admin-mode');
    statusBadge.textContent = 'Admin';
    loginBtn.style.display = 'none';
    logoutBtn.style.display = '';
  }else{
    document.documentElement.classList.remove('admin-mode');
    statusBadge.textContent = 'Guest';
    loginBtn.style.display = '';
    logoutBtn.style.display = 'none';
  }
  // persist session
  if(isAdmin) localStorage.setItem(AUTH_KEY, CREDENTIALS.user);
  else localStorage.removeItem(AUTH_KEY);

  // show/hide private tabs (Aguhart, Pedidos, Reparto, Clientes, Mapa)
  document.querySelectorAll('.tab[data-private="true"]').forEach(btn=>{
    btn.style.display = isAdmin ? '' : 'none';
  });

  // if the currently active tab became hidden (guest), pick the first visible tab and activate it
  const activeTabBtn = document.querySelector(`.tab[data-view="${activeView}"]`);
  if(activeTabBtn && activeTabBtn.style.display === 'none'){
    // find first visible tab
    const firstVisible = Array.from(document.querySelectorAll('.tab')).find(t => t.style.display !== 'none');
    if(firstVisible){
      // update activeView and active class on tabs
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      firstVisible.classList.add('active');
      activeView = firstVisible.dataset.view || 'links';
    }else{
      // fallback: if none visible, set to links and ensure class cleanup
      activeView = 'links';
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      const linksTab = document.querySelector('.tab[data-view="links"]');
      if(linksTab) linksTab.classList.add('active');
    }
  }

  render(); // re-render to show/hide UI controls
}

/* Link preview helpers: fetch page title/description (best-effort) and show a small card next to cursor */
const previewEl = (()=>{
  const d = document.createElement('div');
  d.className = 'link-preview';
  d.innerHTML = '<div class="pv-row"><div class="pv-favicon"></div><div style="flex:1"><div class="pv-title"></div><div class="pv-url"></div></div></div><div class="pv-desc"></div>';
  document.body.appendChild(d);
  return d;
})();

let previewTimeout = null;
let lastPreviewUrl = null;

async function fetchPreviewData(url){
  // best-effort: try to fetch page HTML and parse title/meta description; may fail due to CORS
  try{
    const res = await fetch(url, { mode: 'cors' });
    const txt = await res.text();
    const doc = new DOMParser().parseFromString(txt, 'text/html');
    const title = (doc.querySelector('title') || {}).textContent || '';
    const descEl = doc.querySelector('meta[name="description"]') || doc.querySelector('meta[property="og:description"]') || {};
    const desc = descEl.content || '';
    return { title: title.trim(), description: desc.trim() };
  }catch(err){
    return null;
  }
}

function showPreviewAt(targetRect, data){
  const el = previewEl;
  const padding = 10;
  // position to the right if enough space, otherwise left
  const viewportW = window.innerWidth;
  let left = targetRect.right + 12;
  if(left + el.offsetWidth + padding > viewportW){
    left = targetRect.left - el.offsetWidth - 12;
    if(left < padding) left = padding;
  }
  let top = Math.max(padding, targetRect.top);
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  // fill content
  el.querySelector('.pv-favicon').innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(data.domain)}&sz=64" alt="" style="width:20px;height:20px">`;
  el.querySelector('.pv-title').textContent = data.title || data.domain;
  el.querySelector('.pv-url').textContent = data.url;
  el.querySelector('.pv-desc').textContent = data.description || '';
  el.classList.add('visible');
}

function hidePreview(){
  previewEl.classList.remove('visible');
  lastPreviewUrl = null;
  if(previewTimeout){ clearTimeout(previewTimeout); previewTimeout = null; }
}

function tryRestoreSession(){
  const user = localStorage.getItem(AUTH_KEY);
  if(user === CREDENTIALS.user){
    setAdminState(true);
  }else{
    setAdminState(false);
  }
}

function render(){
  // toggle visible view
  document.querySelectorAll('.view').forEach(v=>{
    v.style.display = v.dataset.view === activeView ? '' : 'none';
  });

  // show/hide add panels based on admin, but only for their view
  document.querySelectorAll('.view .add-panel').forEach(p=>{
    p.style.display = isAdmin ? '' : 'none';
  });

  // LINKS view rendering
  if(activeView === 'links'){
    // products list
    const q = '';
    listEl.innerHTML = '';
    const filtered = links.filter(l=>{
      const title = (l.title || '').toLowerCase();
      return title.includes(q);
    });
    // no empty placeholder for products (removed "No hay productos." box)
    for(const item of filtered){
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.id = item.id;
      node.draggable = isAdmin;
      if(!isAdmin) node.classList.add('readonly-item');
      node.querySelector('.title').textContent = item.title;
      // price display
      const priceEl = node.querySelector('.price');
      priceEl.textContent = `$${(item.price || 1.2).toFixed(2)} · Stock: ${item.stock ?? 0}`;
      const thumb = node.querySelector('.thumb');
      if(item.url) thumb.src = item.url;
      else thumb.src = 'https://via.placeholder.com/120x120.png?text=Agua';
      const a = node.querySelector('.link');
      a.href = item.url || '#';
      const badgeRow = node.querySelector('.badge-row');
      (item.tags || []).slice(0,4).forEach(t=>{
        const b = document.createElement('div'); b.className='badge'; b.textContent = t; badgeRow.appendChild(b);
      });
      node.querySelector('.open').addEventListener('click', e=>{ e.stopPropagation(); openInNewTab(item.url); });

      // "Comprar" button: simulate adding to cart
      node.querySelector('.copy').addEventListener('click', async e=>{
        e.stopPropagation();
        // decrement stock if available
        const prod = links.find(l=>l.id === item.id);
        if(prod && (prod.stock ?? 0) > 0){
          prod.stock = (prod.stock ?? 0) - 1;
          saveAll();
          showToast('Añadido al carrito');
        }else{
          showToast('Agotado');
        }
      });

      node.querySelector('.edit').addEventListener('click', e=>{
        e.stopPropagation();
        if(!isAdmin) return;
        editId = item.id;
        titleIn.value = item.title || '';
        titleIn.focus();
      });

      const deleteBtn = node.querySelector('.delete');
      if(!isAdmin){
        deleteBtn.style.display = 'none';
      }else{
        deleteBtn.style.display = '';
        deleteBtn.addEventListener('click', e=>{ e.stopPropagation(); if(confirm('Eliminar producto?')) deleteLink(item.id); });
      }

      // keep optional drag handlers for admin reorder
      node.addEventListener('dragstart', (e)=>{
        if(!isAdmin) return;
        draggingId = item.id;
        node.classList.add('dragging');
        document.body.classList.add('dragging-list');
        try{ e.dataTransfer.setData('text/plain', item.id); }catch(err){}
        if(e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      });
      node.addEventListener('dragend', ()=>{
        draggingId = null;
        node.classList.remove('dragging');
        document.body.classList.remove('dragging-list');
        listEl.querySelectorAll('.over').forEach(n=>n.classList.remove('over'));
      });
      node.addEventListener('dragover', (e)=>{
        if(!isAdmin) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const target = e.currentTarget;
        listEl.querySelectorAll('.over').forEach(n=>{ if(n!==target) n.classList.remove('over'); });
        target.classList.add('over');
      });
      node.addEventListener('dragleave', (e)=>{ e.currentTarget.classList.remove('over'); });
      node.addEventListener('drop', (e)=>{
        if(!isAdmin) return;
        e.preventDefault();
        const target = e.currentTarget;
        const beforeId = target.dataset.id === draggingId ? null : target.dataset.id;
        if(draggingId){ reorderById(draggingId, beforeId); }
        target.classList.remove('over');
      });

      listEl.appendChild(node);
    }


  }

  // CODE view rendering (Pedidos list)
  if(activeView === 'code'){
    const q = (searchCodeIn.value || '').trim().toLowerCase();
    codeListEl.innerHTML = '';
    const filtered = codes.filter(c=>{
      return (c.title || '').toLowerCase().includes(q)
        || (c.phone || '').toLowerCase().includes(q)
        || (c.address || '').toLowerCase().includes(q)
        || (c.product || '').toLowerCase().includes(q)
        || (c.note || '').toLowerCase().includes(q);
    });
    if(!filtered.length){ el('emptyCode').style.display = 'block'; } else { el('emptyCode').style.display = 'none' }
    for(const item of filtered){
      const node = document.createElement('li');
      node.className = 'item';
      node.dataset.id = item.id;
      if(!isAdmin) node.classList.add('readonly-item');

      // build order content
      const html = `
        <div class="meta" style="flex:1">
          <div class="title">${escapeHtml(item.title || 'Sin nombre')}</div>
          <div class="url">${escapeHtml(item.product || '')} · Cant: ${escapeHtml(String(item.quantity || 1))}</div>
          <div class="price" style="color:var(--muted);font-size:13px;margin-top:6px">
            ${escapeHtml(item.address || '')}${item.phone ? ' · Tel: ' + escapeHtml(item.phone) : ''}
          </div>
          ${item.note ? `<div style="color:var(--muted);font-size:13px;margin-top:6px">${escapeHtml(item.note)}</div>` : ''}
        </div>
        <div class="item-actions">
          <button class="open" title="Ver en Maps">📍</button>
          <button class="copy" title="Copiar">📋</button>
          <button class="edit" title="Editar">✏️</button>
          <button class="delete" title="Eliminar">🗑️</button>
        </div>
      `;
      node.innerHTML = html;

      // open => maps search for address
      node.querySelector('.open').addEventListener('click', e=>{
        e.stopPropagation();
        const qaddr = encodeURIComponent(item.address || '');
        if(qaddr) window.open(`https://www.google.com/maps/search/?api=1&query=${qaddr}`, '_blank', 'noopener');
      });

      // copy order summary
      node.querySelector('.copy').addEventListener('click', async e=>{
        e.stopPropagation();
        const txt = `Pedido de ${item.title}\nProducto: ${item.product} (x${item.quantity})\nDirección: ${item.address}\nTel: ${item.phone || ''}\nNota: ${item.note || ''}`;
        const ok = await copyText(txt);
        if(ok){ const b = e.currentTarget; const old = b.textContent; b.textContent = '✅'; setTimeout(()=> b.textContent = old, 1200); } else alert('No se pudo copiar');
      });

      // edit opens fields in form for admin
      const editBtn = node.querySelector('.edit');
      editBtn.addEventListener('click', e=>{
        e.stopPropagation();
        if(!isAdmin) return;
        editCodeId = item.id;
        codeTitleIn.value = item.title || '';
        codePhoneIn.value = item.phone || '';
        codeAddressIn.value = item.address || '';
        codeProductIn.value = item.product || '';
        codeQuantityIn.value = item.quantity || '1';
        codeNoteIn.value = item.note || '';
        tabCode.click();
        codeTitleIn.focus();
      });

      const delBtn = node.querySelector('.delete');
      if(!isAdmin) delBtn.style.display = 'none';
      else delBtn.addEventListener('click', e=>{ e.stopPropagation(); if(confirm('Eliminar pedido?')){ codes = codes.filter(c=>c.id!==item.id); saveAll(); } });

      codeListEl.appendChild(node);
    }
  }

  // DELIVERY (Reparto) view rendering
  if(activeView === 'delivery'){
    const q = (searchDeliveryIn.value || '').trim().toLowerCase();
    deliveryListEl.innerHTML = '';
    const filtered = deliveries.filter(d=>{
      return (d.name || '').toLowerCase().includes(q) || (d.address || '').toLowerCase().includes(q) || (d.note || '').toLowerCase().includes(q);
    });
    if(!filtered.length){ el('emptyDelivery').style.display = 'block'; } else { el('emptyDelivery').style.display = 'none' }
    for(const item of filtered){
      const node = document.createElement('li');
      node.className = 'item';
      node.dataset.id = item.id;
      node.draggable = isAdmin;
      const inner = `
        <div class="meta" style="flex:1">
          <div class="title">${escapeHtml(item.name || 'Sin nombre')}</div>
          <div class="url">${escapeHtml(item.address || '')}</div>
          <div class="price" style="color:var(--muted);font-size:13px;margin-top:6px">${escapeHtml(item.note || '')}</div>
        </div>
        <div class="item-actions">
          <button class="open" title="Ver">👁️</button>
          <button class="delete" title="Eliminar">🗑️</button>
        </div>
      `;
      node.innerHTML = inner;

      // open action opens address in maps if possible
      node.querySelector('.open').addEventListener('click', e=>{
        e.stopPropagation();
        const qaddr = encodeURIComponent(item.address || '');
        if(qaddr) window.open(`https://www.google.com/maps/search/?api=1&query=${qaddr}`, '_blank', 'noopener');
      });

      const delBtn = node.querySelector('.delete');
      if(!isAdmin) delBtn.style.display = 'none';
      else delBtn.addEventListener('click', e=>{ e.stopPropagation(); if(confirm('Eliminar reparto?')){ deliveries = deliveries.filter(d=>d.id!==item.id); saveAll(); } });

      // Drag & drop handlers for reordering deliveries (admin only)
      node.addEventListener('dragstart', (e)=>{
        if(!isAdmin) return;
        draggingDeliveryId = item.id;
        node.classList.add('dragging');
        document.body.classList.add('dragging-list');
        try{ e.dataTransfer.setData('text/plain', item.id); }catch(err){}
        if(e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      });
      node.addEventListener('dragend', ()=>{
        draggingDeliveryId = null;
        node.classList.remove('dragging');
        document.body.classList.remove('dragging-list');
        deliveryListEl.querySelectorAll('.over').forEach(n=>n.classList.remove('over'));
      });
      node.addEventListener('dragover', (e)=>{
        if(!isAdmin) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const target = e.currentTarget;
        deliveryListEl.querySelectorAll('.over').forEach(n=>{ if(n!==target) n.classList.remove('over'); });
        target.classList.add('over');
      });
      node.addEventListener('dragleave', (e)=>{ e.currentTarget.classList.remove('over'); });
      node.addEventListener('drop', (e)=>{
        if(!isAdmin) return;
        e.preventDefault();
        const target = e.currentTarget;
        const beforeId = target.dataset.id === draggingDeliveryId ? null : target.dataset.id;
        if(draggingDeliveryId){ reorderDeliveryById(draggingDeliveryId, beforeId); }
        target.classList.remove('over');
      });

      deliveryListEl.appendChild(node);
    }
  }

  // CLIENTS view: simple listing derived from pedidos (unique client names/addresses)
  if(activeView === 'clients'){
    const clientsEl = el('clientsList');
    const emptyClientsEl = el('emptyClients');
    clientsEl.innerHTML = '';
    // derive unique clients from codes (pedidos) and deliveries
    const seen = new Set();
    const clients = [];
    // prefer codes (pedidos) entries
    codes.concat(deliveries).forEach(c=>{
      const key = ((c.title || c.name || '') + '|' + (c.address || '')).trim();
      if(!key) return;
      if(!seen.has(key)){
        seen.add(key);
        clients.push({ name: c.title || c.name || 'Sin nombre', address: c.address || c.address || '', note: c.note || '' });
      }
    });
    if(!clients.length){ emptyClientsEl.style.display = 'block'; } else { emptyClientsEl.style.display = 'none' }
    for(const cl of clients){
      const li = document.createElement('li');
      li.className = 'item';
      li.innerHTML = `<div class="meta" style="flex:1"><div class="title">${escapeHtml(cl.name)}</div><div class="url">${escapeHtml(cl.address)}</div><div class="price" style="color:var(--muted);font-size:13px;margin-top:6px">${escapeHtml(cl.note || '')}</div></div><div class="item-actions"><button class="open" title="Ver">📍</button></div>`;
      li.querySelector('.open').addEventListener('click', e=>{
        e.stopPropagation();
        const qaddr = encodeURIComponent(cl.address || '');
        if(qaddr) window.open(`https://www.google.com/maps/search/?api=1&query=${qaddr}`, '_blank', 'noopener');
      });
      clientsEl.appendChild(li);
    }
  }

  // MAP view: provide quick actions to open delivery addresses in Google Maps
  if(activeView === 'map'){
    // nothing to render inside dynamic list here; buttons handle action
    // show or hide message depending on deliveries available
    const panel = document.querySelector('.view-map .panel');
    const emptyMsg = panel.querySelector('.empty-map');
    if(!deliveries.length){
      if(!emptyMsg){
        const d = document.createElement('div'); d.className = 'empty-map empty'; d.textContent = 'No hay repartos para mostrar en el mapa.'; panel.appendChild(d);
      }
    }else{
      const existing = panel.querySelector('.empty-map');
      if(existing) existing.remove();
    }
  }
}





/* Pedidos add: collect order fields and store in codes (pedidos) */
addCodeBtn.addEventListener('click', ()=>{
  const name = (codeTitleIn.value || '').trim() || 'Cliente';
  const phone = (codePhoneIn.value || '').trim();
  const address = (codeAddressIn.value || '').trim();
  const product = (codeProductIn.value || '').trim() || 'Agua embotellada';
  const quantity = Math.max(1, parseInt(codeQuantityIn.value || '1', 10));
  const note = (codeNoteIn.value || '').trim();

  if(!address){
    showToast('Dirección requerida');
    codeAddressIn.focus();
    return;
  }

  const id = Date.now().toString() + Math.random().toString(36).slice(2,6);
  const order = {
    id,
    title: name,
    phone,
    address,
    product,
    quantity,
    note,
    createdAt: Date.now()
  };

  // add to pedidos (codes)
  codes.unshift(order);

  // also create a reparto entry so the new pedido appears in Reparto
  const deliveryEntry = {
    id: 'd_' + id,
    name: name,
    address: address,
    note: note || `Pedido: ${product} x${quantity}` // keep a short note referencing the pedido
  };
  deliveries.unshift(deliveryEntry);

  saveAll();

  // clear form
  codeTitleIn.value = '';
  codePhoneIn.value = '';
  codeAddressIn.value = '';
  codeProductIn.value = '';
  codeQuantityIn.value = '1';
  codeNoteIn.value = '';
  showToast('Pedido agregado y añadido a Reparto');
});

clearCodeBtn.addEventListener('click', ()=>{
  editCodeId = null;
  codeTitleIn.value = '';
  codeContentIn.value = '';
});






searchCodeIn.addEventListener('input', render);

 // tabs
 const tabLinks = el('tab-links');
 const tabCode = el('tab-code');
 const tabDelivery = el('tab-delivery');
 const tabClients = el('tab-clients');
 const tabMap = el('tab-map');
 tabLinks.addEventListener('click', ()=>{ activeView = 'links'; tabLinks.classList.add('active'); tabCode.classList.remove('active'); tabDelivery.classList.remove('active'); tabClients.classList.remove('active'); tabMap.classList.remove('active'); render(); });
 tabCode.addEventListener('click', ()=>{ activeView = 'code'; tabCode.classList.add('active'); tabLinks.classList.remove('active'); tabDelivery.classList.remove('active'); tabClients.classList.remove('active'); tabMap.classList.remove('active'); render(); });
 tabDelivery.addEventListener('click', ()=>{ activeView = 'delivery'; tabDelivery.classList.add('active'); tabLinks.classList.remove('active'); tabCode.classList.remove('active'); tabClients.classList.remove('active'); tabMap.classList.remove('active'); render(); });
 tabClients.addEventListener('click', ()=>{ activeView = 'clients'; tabClients.classList.add('active'); tabLinks.classList.remove('active'); tabCode.classList.remove('active'); tabDelivery.classList.remove('active'); tabMap.classList.remove('active'); render(); });
 tabMap.addEventListener('click', ()=>{ activeView = 'map'; tabMap.classList.add('active'); tabLinks.classList.remove('active'); tabCode.classList.remove('active'); tabDelivery.classList.remove('active'); tabClients.classList.remove('active'); render(); });

// export / import


 // Map buttons (openMap / openMapAll) handlers
 const openMapBtn = el('openMap');
 const openMapAllBtn = el('openMapAll');
 const mapFrame = el('mapFrame');

 // helper to build a query URL limited to Junín if address seems local
 function buildMapsSearchUrlForAddress(address){
   // try to bias the search to Junín, Buenos Aires by appending the city and province
   const base = `https://www.google.com/maps/search/?api=1&query=`;
   const q = encodeURIComponent(`${address} Junín Provincia de Buenos Aires Argentina`);
   return base + q;
 }

 if(openMapBtn){
   // Load/focus the embedded iframe to Junín (or to first delivery if exists)
   openMapBtn.addEventListener('click', ()=>{
     if(!deliveries.length){
       // keep embedded map centered on Junín
       if(mapFrame) mapFrame.src = "https://www.google.com/maps?q=Jun%C3%ADn+Buenos+Aires+Argentina&output=embed";
       showToast('Mapa de Junín cargado');
       return;
     }
     // if there is at least one delivery, center embed on its address (biased to Junín)
     const addr = deliveries[0].address || '';
     if(mapFrame){
       const q = encodeURIComponent(`${addr} Junín Provincia de Buenos Aires Argentina`);
       mapFrame.src = `https://www.google.com/maps?q=${q}&output=embed`;
       showToast('Mapa centrado en el primer reparto');
     }else{
       window.open(buildMapsSearchUrlForAddress(addr), '_blank', 'noopener');
     }
   });
 }

 if(openMapAllBtn){
   // open a new Google Maps tab with combined addresses; bias to Junín
   openMapAllBtn.addEventListener('click', ()=>{
     if(!deliveries.length){ showToast('No hay repartos'); return; }
     const queries = deliveries.map(d=> (d.address || '') + ' Junín Provincia de Buenos Aires').filter(Boolean);
     if(!queries.length){ showToast('No hay direcciones válidas'); return; }
     // Google Maps does not support multiple pin parameters in a single simple URL without API key,
     // so open a combined search that includes all addresses joined with ' | ' which acts like an OR search in Maps
     const combined = encodeURIComponent(queries.join(' | '));
     window.open(`https://www.google.com/maps/search/${combined}`, '_blank', 'noopener');
   });
 }





/* Login overlay interactions */
loginBtn.addEventListener('click', ()=>{ loginOverlay.style.display = 'block'; loginOverlay.setAttribute('aria-hidden','false'); loginUser.focus(); });
cancelLogin.addEventListener('click', ()=>{ loginOverlay.style.display = 'none'; loginOverlay.setAttribute('aria-hidden','true'); loginUser.value=''; loginPass.value=''; });
doLogin.addEventListener('click', ()=>{
  const u = loginUser.value.trim();
  const p = loginPass.value;
  if(u === CREDENTIALS.user && p === CREDENTIALS.pass){
    setAdminState(true);
    loginOverlay.style.display = 'none';
    loginOverlay.setAttribute('aria-hidden','true');
    loginUser.value=''; loginPass.value='';
    // subtle UI change + toast
    showToast('Welcome, Admin');
  }else{
    showToast('Credenciales incorrectas');
  }
});

 // delivery add/clear handlers
 addDeliveryBtn.addEventListener('click', ()=>{
   const name = (deliveryNameIn.value || '').trim() || 'Sin nombre';
   const address = (deliveryAddrIn.value || '').trim() || '';
   const note = (deliveryNoteIn.value || '').trim() || '';
   if(!address){
     showToast('Dirección requerida');
     deliveryAddrIn.focus();
     return;
   }
   const id = Date.now().toString() + Math.random().toString(36).slice(2,6);
   deliveries.unshift({ id, name, address, note });
   saveAll();
   deliveryNameIn.value = ''; deliveryAddrIn.value = ''; deliveryNoteIn.value = '';
   showToast('Reparto agregado');
 });
 clearDeliveryBtn.addEventListener('click', ()=>{
   deliveryNameIn.value = ''; deliveryAddrIn.value = ''; deliveryNoteIn.value = '';
 });

 // logout
 logoutBtn.addEventListener('click', ()=>{
   if(confirm('Cerrar sesión?')){ setAdminState(false); showToast('Sesion cerrada'); }
 });

/* initial load */
loadAll();
loadProfile();
tryRestoreSession();
render();

// small helper to safely escape text when injecting into simple templates
function escapeHtml(s){
  return String(s || '').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
