const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const state = { user: null, route: 'home', series: [], cards: [], authMode: 'login', adminTab: 'cards', lastInventory: [] };
const rarityColor = { R:'#75a7ff', SR:'#b967ff', SSR:'#ffd166', UR:'#00f5d4', ONLYYOURS:'#ff2bd6' };

const api = async (url, opts = {}) => {
  const options = { credentials:'include', headers:{}, ...opts };
  if (!(opts.body instanceof FormData)) options.headers['Content-Type'] = 'application/json';
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
};

function toast(msg, good = false){
  const el = $('#toast'); el.textContent = msg; el.classList.remove('hidden');
  el.style.borderColor = good ? 'rgba(116,252,183,.5)' : 'rgba(255,71,126,.5)';
  setTimeout(()=>el.classList.add('hidden'), 3600);
}
function setUser(user){ state.user = user; if(user){
  $('#helloUser').textContent = `${user.avatar_emoji || '✨'} ${user.login}`;
  $('#spinsCount').textContent = user.spins ?? 0; $('#echoCount').textContent = user.echo ?? 0; $('#avatarBubble').textContent = user.avatar_emoji || '✨';
  $$('.admin-link').forEach(x => x.classList.toggle('hidden', user.role !== 'admin'));
}}
async function boot(){
  bindAuth(); bindNav(); bindTilt();
  try { const data = await api('/api/auth/me'); if(data.user){ setUser(data.user); showApp(); await loadBase(); render(); } else showAuth(); }
  catch { showAuth(); }
  if (window.Telegram?.WebApp){ Telegram.WebApp.ready(); Telegram.WebApp.expand(); $('#tgLoginBtn')?.classList.remove('hidden'); }
}
function showAuth(){ $('#authScreen').classList.remove('hidden'); $('#appShell').classList.add('hidden'); }
function showApp(){ $('#authScreen').classList.add('hidden'); $('#appShell').classList.remove('hidden'); }
async function loadBase(){
  const s = await api('/api/catalog/series'); state.series = s.series;
}
function bindAuth(){
  $$('[data-auth-tab]').forEach(btn => btn.addEventListener('click', () => {
    state.authMode = btn.dataset.authTab; $$('[data-auth-tab]').forEach(b=>b.classList.toggle('active', b===btn));
    $('.register-only').classList.toggle('hidden', state.authMode !== 'register');
    $('#authForm button[type=submit]').textContent = state.authMode === 'register' ? 'Создать аккаунт' : 'Войти';
  }));
  $('#authForm').addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    try{
      const data = await api('/api/auth/' + (state.authMode === 'register' ? 'register' : 'login'), { method:'POST', body: JSON.stringify(Object.fromEntries(fd)) });
      setUser(data.user); showApp(); await loadBase(); render(); toast('Готово! Добро пожаловать ✨', true);
    }catch(err){ toast(err.message); }
  });
  $('#tgLoginBtn').addEventListener('click', async () => {
    try{
      const initData = window.Telegram?.WebApp?.initData;
      if(!initData) throw new Error('Откройте сайт внутри Telegram Mini App');
      const data = await api('/api/auth/telegram', { method:'POST', body: JSON.stringify({ initData }) });
      setUser(data.user); showApp(); await loadBase(); render();
    }catch(err){ toast(err.message); }
  });
  $('#logoutBtn').addEventListener('click', async () => { await api('/api/auth/logout',{method:'POST',body:'{}'}); location.reload(); });
}
function bindNav(){
  $$('.nav').forEach(btn => btn.addEventListener('click', () => { state.route = btn.dataset.route; $$('.nav').forEach(b=>b.classList.toggle('active', b===btn)); render(); }));
}
function bindTilt(){
  document.addEventListener('pointermove', e => {
    const card = e.target.closest('.tilt-card'); if(!card) return;
    const r = card.getBoundingClientRect(); const x = (e.clientX-r.left)/r.width-.5; const y=(e.clientY-r.top)/r.height-.5;
    card.style.transform = `perspective(900px) rotateX(${y*-9}deg) rotateY(${x*12}deg) translateY(-2px)`;
    const img = $('.card-img', card); if(img) img.style.transform = `scale(1.06) translate(${x*8}px,${y*8}px)`;
  });
  document.addEventListener('pointerleave', e => { const card=e.target.closest?.('.tilt-card'); if(card) resetTilt(card); }, true);
  document.addEventListener('pointerout', e => { const card=e.target.closest?.('.tilt-card'); if(card && !card.contains(e.relatedTarget)) resetTilt(card); });
}
function resetTilt(card){ card.style.transform=''; const img=$('.card-img',card); if(img) img.style.transform=''; }

async function render(){
  const view = $('#view');
  try{
    if(state.route === 'home') return renderHome(view);
    if(state.route === 'gacha') return renderGacha(view);
    if(state.route === 'collection') return renderCollection(view);
    if(state.route === 'profile') return renderProfile(view);
    if(state.route === 'tasks') return renderTasks(view);
    if(state.route === 'shop') return renderShop(view);
    if(state.route === 'social') return renderSocial(view);
    if(state.route === 'admin') return renderAdmin(view);
  }catch(err){ view.innerHTML = `<div class="panel glass">${escapeHtml(err.message)}</div>`; }
}
function renderHome(view){
  view.innerHTML = `<div class="hero">
    <section class="panel glass">
      <h2>Выбей свою <span class="gradient-text">ONLYYOURS</span> легенду</h2>
      <p class="muted">Крутки, серии, витрина профиля, трейды, ежедневные задания, рефералы, магазин и промокоды. ONLYYOURS не имеет гаранта — она выпадает только чистой удачей.</p>
      <div class="actions"><button class="primary" data-go="gacha">Крутить сейчас</button><button class="ghost" data-go="collection">Открыть галерею</button></div>
      <div class="stat-row"><div class="stat"><b>${state.user.spins}</b><small>круток</small></div><div class="stat"><b>${state.user.echo}</b><small>Эха</small></div><div class="stat"><b>${state.user.referral_code}</b><small>реф-код</small></div><div class="stat"><b>${state.user.daily_streak || 0}</b><small>стрик</small></div></div>
    </section>
    <section class="panel glass banner-card"><div><div class="orb">✦</div><h3>Neon Wish</h3><p class="muted">Ивент-баннер с повышенным весом выбранной серии.</p></div></section>
  </div>`;
  $$('[data-go]', view).forEach(b=>b.onclick=()=>{ state.route=b.dataset.go; $$('.nav').forEach(n=>n.classList.toggle('active', n.dataset.route===state.route)); render(); });
}
async function renderGacha(view){
  const data = await api('/api/gacha/state'); setUser(data.user);
  view.innerHTML = `<div class="gacha-layout">
    <section class="panel glass summon-panel">
      <div>
        <div class="summon-circle"><div class="summon-core">✦</div></div>
        <h2>Баннер желаний</h2><p class="muted">${escapeHtml(data.banner?.description || 'Активный баннер не выбран')}</p>
        <div class="actions" style="justify-content:center"><button class="primary" data-pull="1">1 крутка</button><button class="primary" data-pull="10">10 круток</button></div>
      </div>
    </section>
    <aside class="panel glass pity-box">
      <h3>Pity-счётчик</h3>
      <div><b>SR+</b><p class="muted">Осталось ${data.pity.srUntil} до гаранта SR+</p><div class="meter"><span style="width:${(data.pity.sr/10)*100}%"></span></div></div>
      <div><b>UR</b><p class="muted">Осталось ${data.pity.urUntil} до гаранта UR. Soft-pity после 60.</p><div class="meter"><span style="width:${(data.pity.ur/80)*100}%"></span></div></div>
      <div class="task"><b>Шансы</b><p class="muted">${escapeHtml(data.chances.note)}</p></div>
    </aside>
  </div>`;
  $$('[data-pull]', view).forEach(b=>b.onclick=()=>pull(Number(b.dataset.pull)));
}
async function pull(count){
  try{
    const data = await api('/api/gacha/pull', { method:'POST', body: JSON.stringify({ count }) }); setUser(data.user);
    await showPullAnimation(data.pulls);
    if(data.achievements?.length) toast('Новое достижение: ' + data.achievements.map(a=>a.medal_emoji+' '+a.title).join(', '), true);
    render();
  }catch(err){ toast(err.message); }
}
async function showPullAnimation(pulls){
  const overlay = $('#pullOverlay'), tunnel = $('#rarityTunnel'), stage = $('#resultStage'), orb = $('#summonOrb'); let skipped=false;
  $('#skipAnim').onclick = () => skipped = true;
  overlay.classList.remove('hidden'); stage.innerHTML=''; orb.classList.remove('hidden');
  const highest = pulls.reduce((a,p)=>rank(p.card.rarity)>rank(a)?p.card.rarity:a,'R'); tunnel.style.setProperty('--rarity', rarityColor[highest]); orb.style.color = rarityColor[highest];
  await sleep(skipped?50:1250); orb.classList.add('hidden');
  for(const p of pulls){ if(skipped) break; stage.appendChild(cardNode(p.card, { owned:true, qty:p.card.qty, duplicate:p.isDuplicate, echo:p.echoAwarded })); await sleep(230); }
  if(skipped){ stage.innerHTML=''; pulls.forEach(p=>stage.appendChild(cardNode(p.card,{owned:true,duplicate:p.isDuplicate,echo:p.echoAwarded}))); }
  await sleep(900 + pulls.length*80); overlay.classList.add('hidden');
}
function rank(r){ return ({R:1,SR:2,SSR:3,UR:4,ONLYYOURS:5})[r] || 0; }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function renderCollection(view){
  const [cardsData] = await Promise.all([api('/api/catalog/cards')]); state.cards = cardsData.cards;
  view.innerHTML = `<div class="section-title"><div><h2>Галерея карточек</h2><p class="muted">Не полученные карты затемнены. ONLYYOURS скрыта полностью чёрным знаком вопроса.</p></div><div class="filters"><select id="rarityFilter"><option value="">Все редкости</option>${['R','SR','SSR','UR','ONLYYOURS'].map(r=>`<option>${r}</option>`).join('')}</select><select id="seriesFilter"><option value="">Все серии</option>${state.series.map(s=>`<option value="${s.slug}">${escapeHtml(s.title)}</option>`).join('')}</select></div></div><div id="cardsGrid" class="cards-grid"></div>`;
  const redraw = () => {
    const rarity=$('#rarityFilter').value, series=$('#seriesFilter').value; const grid=$('#cardsGrid'); grid.innerHTML='';
    state.cards.filter(c=>(!rarity||c.rarity===rarity)&&(!series||c.series_slug===series)).forEach(c=>grid.appendChild(cardNode(c,{owned:Number(c.owned_qty)>0, qty:Number(c.owned_qty), wishlist:true})));
  };
  $('#rarityFilter').onchange=redraw; $('#seriesFilter').onchange=redraw; redraw();
}
function cardNode(card, opts={}){
  const tpl = $('#cardTpl').content.cloneNode(true); const el = $('.card-tile',tpl); const owned = opts.owned ?? Number(card.owned_qty)>0;
  el.classList.add('rarity-'+card.rarity); if(!owned) el.classList.add('unknown'); if(!owned && card.rarity==='ONLYYOURS') el.classList.add('only');
  $('.card-img',el).src = owned || card.rarity !== 'ONLYYOURS' ? card.image_url : '';
  $('.card-img',el).alt = card.title; $('.card-info strong',el).textContent = owned || card.rarity !== 'ONLYYOURS' ? card.title : '???';
  $('.card-info small',el).textContent = `${card.rarity} · ${card.series_title || 'Без серии'}${opts.duplicate ? ' · дубликат +' + (opts.echo || 0) + ' Эха' : ''}`;
  const qty = Number(opts.qty || card.owned_qty || card.qty || 0); $('.qty-badge',el).textContent = qty>1 ? `×${qty}` : (opts.duplicate ? 'ДУБЛЬ' : card.rarity);
  $('.qty-badge',el).style.borderColor = rarityColor[card.rarity] || '#fff';
  if(opts.wishlist){ el.addEventListener('dblclick', async()=>toggleWish(card)); }
  return tpl;
}
async function toggleWish(card){
  try{ await api(`/api/catalog/wishlist/${card.id}`, { method: card.wishlisted ? 'DELETE' : 'POST', body:'{}' }); card.wishlisted=!card.wishlisted; toast(card.wishlisted?'Добавлено в wishlist':'Убрано из wishlist', true); }
  catch(e){ toast(e.message); }
}
async function renderProfile(view){
  const data = await api('/api/profile/me'); state.lastInventory = data.inventory;
  view.innerHTML = `<section class="panel glass profile-head">
    <div class="big-avatar">${data.user.avatar_card_image ? `<img src="${data.user.avatar_card_image}">` : escapeHtml(data.user.avatar_emoji)}</div>
    <div><h2>${escapeHtml(data.user.login)}</h2><p class="muted">Реферальный код: <b>${data.user.referral_code}</b></p><div class="actions"><select id="emojiPick"></select><button class="ghost" id="saveEmoji">Сменить эмодзи</button></div></div>
  </section>
  <section class="panel glass" style="margin-top:16px"><div class="section-title"><h2>Витрина</h2><button class="primary" id="saveShowcase">Сохранить витрину</button></div><div class="showcase" id="showcaseSlots"></div></section>
  <section class="panel glass" style="margin-top:16px"><h2>Медальки</h2><div class="medals">${data.achievements.length ? data.achievements.map(a=>`<span class="medal" title="${escapeHtml(a.description)}">${a.medal_emoji} ${escapeHtml(a.title)}</span>`).join('') : '<span class="muted">Пока нет достижений</span>'}</div></section>
  <section class="panel glass" style="margin-top:16px"><h2>Моя коллекция</h2><div class="cards-grid">${data.inventory.map(c=>nodeToString(cardNode(c,{owned:true,qty:c.qty}))).join('')}</div></section>`;
  const emojis = await api('/api/profile/emojis'); $('#emojiPick').innerHTML = emojis.emojis.map(e=>`<option ${e===data.user.avatar_emoji?'selected':''}>${e}</option>`).join('');
  $('#saveEmoji').onclick=async()=>{ const d=await api('/api/profile/me',{method:'PATCH',body:JSON.stringify({avatar_emoji:$('#emojiPick').value})}); setUser(d.user); toast('Аватар обновлён',true); render(); };
  const slots = $('#showcaseSlots');
  for(let i=1;i<=5;i++){ const current=data.showcase.find(s=>s.slot===i); const wrap=document.createElement('div'); wrap.className='task'; wrap.innerHTML=`<b>Слот ${i}</b><select data-slot="${i}"><option value="">Пусто</option>${data.inventory.map(c=>`<option value="${c.id}" ${current?.id===c.id?'selected':''}>${c.rarity} · ${escapeHtml(c.title)}</option>`).join('')}</select>`; slots.appendChild(wrap); }
  $('#saveShowcase').onclick=async()=>{ const arr=$$('[data-slot]').map(s=>s.value||null); await api('/api/profile/showcase',{method:'POST',body:JSON.stringify({slots:arr})}); toast('Витрина сохранена',true); };
}
function nodeToString(node){ const d=document.createElement('div'); d.appendChild(node); return d.innerHTML; }
async function renderTasks(view){
  const data = await api('/api/tasks');
  view.innerHTML = `<div class="section-title"><div><h2>Ежедневные задания</h2><p class="muted">Обновляются каждый день. Telegram-проверка подписки включится после настройки бота.</p></div></div><div class="grid cols2">${data.tasks.map(t=>`<div class="task ${t.today_status?'done':''}"><h3>${escapeHtml(t.title)}</h3><p class="muted">${escapeHtml(t.description)}</p><p>🎲 +${t.reward_spins} · 🫧 +${t.reward_echo}</p><button class="primary" data-claim="${t.id}" ${t.today_status?'disabled':''}>${t.today_status?'Выполнено':'Забрать'}</button></div>`).join('')}</div><section class="panel glass" style="margin-top:16px"><h3>Промокод</h3><div class="actions"><input id="promoInput" placeholder="YAHINKALYAONLY"><button class="primary" id="promoBtn">Активировать</button></div></section>`;
  $$('[data-claim]',view).forEach(b=>b.onclick=async()=>{ try{ const d=await api(`/api/tasks/${b.dataset.claim}/claim`,{method:'POST',body:'{}'}); setUser(d.user); toast(`Награда получена: +${d.rewardSpins} круток, +${d.rewardEcho} Эха`,true); render(); }catch(e){ toast(e.message); }});
  $('#promoBtn').onclick=async()=>{ try{ const d=await api('/api/tasks/promocode',{method:'POST',body:JSON.stringify({code:$('#promoInput').value})}); setUser(d.user); toast('Промокод активирован!',true); }catch(e){ toast(e.message); }};
}
async function renderShop(view){
  const data = await api('/api/shop');
  view.innerHTML = `<div class="section-title"><div><h2>Мини-магазин</h2><p class="muted">Эхо получается за дубликаты карт. Крутки и обычные карты можно покупать за Эхо.</p></div></div>
  <section class="grid cols3">${data.spinPacks.map(p=>`<div class="shop-item"><h3>🎲 ${p.spins} круток</h3><p class="muted">Цена: ${p.price} Эха</p><button class="primary" data-buy-spins="${p.spins}">Купить</button></div>`).join('')}</section>
  <section style="margin-top:16px" class="cards-grid">${data.cards.map(c=>`<div class="shop-item"><div>${nodeToString(cardNode(c,{owned:true}))}</div><p><b>${c.shop_price}</b> Эха</p><button class="ghost" data-buy-card="${c.id}">Купить карту</button></div>`).join('')}</section>`;
  $$('[data-buy-spins]').forEach(b=>b.onclick=async()=>{ try{ const d=await api('/api/shop/buy-spins',{method:'POST',body:JSON.stringify({spins:Number(b.dataset.buySpins)})}); setUser(d.user); toast('Крутки куплены',true); render(); }catch(e){ toast(e.message); }});
  $$('[data-buy-card]').forEach(b=>b.onclick=async()=>{ try{ const d=await api(`/api/shop/buy-card/${b.dataset.buyCard}`,{method:'POST',body:'{}'}); setUser(d.user); toast('Карта куплена',true); render(); }catch(e){ toast(e.message); }});
}
async function renderSocial(view){
  const friends = await api('/api/social/friends'); const trades = await api('/api/social/trades'); const me = await api('/api/profile/me'); state.lastInventory=me.inventory;
  view.innerHTML = `<div class="grid cols2"><section class="panel glass"><h2>Поиск друзей</h2><div class="actions"><input id="friendSearch" placeholder="логин друга"><button class="primary" id="findFriend">Найти</button></div><div id="searchResults" class="grid"></div><h3>Заявки</h3><div class="grid">${friends.incoming.map(f=>`<div class="friend">${f.avatar_emoji} ${escapeHtml(f.login)} <button class="mini" data-accept-friend="${f.id}">Принять</button></div>`).join('') || '<p class="muted">Нет заявок</p>'}</div><h3>Друзья</h3><div class="grid">${friends.friends.map(f=>`<div class="friend">${f.avatar_emoji} ${escapeHtml(f.login)}</div>`).join('') || '<p class="muted">Пока нет друзей</p>'}</div></section>
  <section class="panel glass"><h2>Предложить трейд</h2><div class="form-grid"><input id="tradeLogin" placeholder="логин друга"><select id="giveCard">${me.inventory.map(c=>`<option value="${c.id}">${c.rarity} · ${escapeHtml(c.title)}</option>`).join('')}</select><input id="wantCard" placeholder="ID карты друга, которую хотите"><textarea id="tradeMsg" placeholder="сообщение"></textarea><button class="primary" id="sendTrade">Отправить предложение</button></div></section></div>
  <section class="panel glass" style="margin-top:16px"><h2>Трейды</h2><div class="grid">${trades.trades.map(t=>`<div class="trade"><b>${escapeHtml(t.from_login)} → ${escapeHtml(t.to_login)}</b><p>${escapeHtml(t.from_card_title)} ⇄ ${escapeHtml(t.to_card_title)}</p><p class="muted">${escapeHtml(t.status)} ${escapeHtml(t.message||'')}</p>${t.to_user_id===state.user.id&&t.status==='pending'?`<button class="mini" data-trade-ok="${t.id}">Принять</button><button class="mini danger" data-trade-no="${t.id}">Отклонить</button>`:''}</div>`).join('') || '<p class="muted">Трейдов пока нет</p>'}</div></section>`;
  $('#findFriend').onclick=async()=>{ const d=await api('/api/social/search?q='+encodeURIComponent($('#friendSearch').value)); $('#searchResults').innerHTML=d.users.map(u=>`<div class="friend">${u.avatar_emoji} ${escapeHtml(u.login)} <button class="mini" data-add="${u.login}">Добавить</button></div>`).join(''); $$('[data-add]').forEach(b=>b.onclick=async()=>{await api('/api/social/friends/'+b.dataset.add,{method:'POST',body:'{}'}); toast('Заявка отправлена',true);}); };
  $$('[data-accept-friend]').forEach(b=>b.onclick=async()=>{ await api(`/api/social/friends/${b.dataset.acceptFriend}/respond`,{method:'POST',body:JSON.stringify({accept:true})}); toast('Друг добавлен',true); render(); });
  $('#sendTrade').onclick=async()=>{ try{ await api('/api/social/trades',{method:'POST',body:JSON.stringify({to_login:$('#tradeLogin').value, from_card_id:$('#giveCard').value, to_card_id:$('#wantCard').value, message:$('#tradeMsg').value})}); toast('Трейд отправлен',true); render(); }catch(e){toast(e.message);} };
  $$('[data-trade-ok]').forEach(b=>b.onclick=async()=>{await api(`/api/social/trades/${b.dataset.tradeOk}/respond`,{method:'POST',body:JSON.stringify({accept:true})}); toast('Трейд принят',true); render();});
  $$('[data-trade-no]').forEach(b=>b.onclick=async()=>{await api(`/api/social/trades/${b.dataset.tradeNo}/respond`,{method:'POST',body:JSON.stringify({accept:false})}); toast('Трейд отклонён',true); render();});
}
async function renderAdmin(view){
  if(state.user.role!=='admin'){ view.innerHTML='<div class="panel glass">Нет доступа</div>'; return; }
  view.innerHTML = `<div class="admin-tabs"><button class="mini ${state.adminTab==='cards'?'active':''}" data-admin-tab="cards">Карты</button><button class="mini ${state.adminTab==='series'?'active':''}" data-admin-tab="series">Серии</button><button class="mini ${state.adminTab==='tasks'?'active':''}" data-admin-tab="tasks">Задания</button><button class="mini ${state.adminTab==='users'?'active':''}" data-admin-tab="users">Игроки</button><button class="mini ${state.adminTab==='promos'?'active':''}" data-admin-tab="promos">Промокоды</button></div><div id="adminBody"></div>`;
  $$('[data-admin-tab]').forEach(b=>b.onclick=()=>{state.adminTab=b.dataset.adminTab; renderAdmin(view);});
  const body=$('#adminBody');
  if(state.adminTab==='cards') await adminCards(body);
  if(state.adminTab==='series') await adminSeries(body);
  if(state.adminTab==='tasks') await adminTasks(body);
  if(state.adminTab==='users') await adminUsers(body);
  if(state.adminTab==='promos') await adminPromos(body);
}
async function adminCards(body){
  const [cards, series] = await Promise.all([api('/api/admin/cards'), api('/api/admin/series')]);
  body.innerHTML = `<div class="admin-grid"><section class="panel glass"><h2>Добавить карту</h2><form id="cardForm" class="form-grid"><input name="title" placeholder="Название" required><input name="caption" placeholder="Подпись снизу"><select name="rarity">${['R','SR','SSR','UR','ONLYYOURS'].map(r=>`<option>${r}</option>`)}</select><select name="series_id">${series.series.map(s=>`<option value="${s.id}">${escapeHtml(s.title)}</option>`)}</select><input name="shop_price" placeholder="Цена в магазине"><input name="event_weight" placeholder="Вес выпадения" value="100"><input name="image_url" placeholder="URL картинки, например https://..."><input type="file" name="image" accept="image/*"><button class="primary">Создать</button></form></section><section class="panel glass"><h2>Карты</h2><div class="admin-list">${cards.cards.map(c=>`<div class="admin-item"><b>${escapeHtml(c.title)}</b><p class="small">${c.rarity} · ${escapeHtml(c.series_title||'')} · вес ${c.event_weight} · shop ${c.shop_price}</p><img src="${c.image_url}" style="width:80px;border-radius:12px"></div>`).join('')}</div></section></div>`;
  $('#cardForm').onsubmit=async e=>{e.preventDefault(); try{await api('/api/admin/cards',{method:'POST',body:new FormData(e.currentTarget)}); toast('Карта создана',true); render();}catch(err){toast(err.message)}};
}
async function adminSeries(body){
  const data=await api('/api/admin/series'); body.innerHTML=`<div class="admin-grid"><section class="panel glass"><h2>Новая серия</h2><form id="seriesForm" class="form-grid"><input name="title" placeholder="Название"><input name="slug" placeholder="slug"><input name="color" value="#9b5cff"><textarea name="description" placeholder="Описание"></textarea><button class="primary">Создать</button></form></section><section class="panel glass"><h2>Серии</h2><div class="admin-list">${data.series.map(s=>`<div class="admin-item"><b>${escapeHtml(s.title)}</b><p class="small">${s.slug} · ${s.color}</p><p>${escapeHtml(s.description||'')}</p></div>`).join('')}</div></section></div>`;
  $('#seriesForm').onsubmit=async e=>{e.preventDefault();await api('/api/admin/series',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});toast('Серия создана',true);render();};
}
async function adminTasks(body){
  const data=await api('/api/admin/tasks'); body.innerHTML=`<div class="admin-grid"><section class="panel glass"><h2>Новое задание</h2><form id="taskForm" class="form-grid"><input name="title" placeholder="Название"><textarea name="description" placeholder="Описание"></textarea><select name="type"><option>daily_login</option><option>telegram_subscribe</option><option>telegram_react</option><option>open_link</option><option>manual</option></select><input name="reward_spins" placeholder="Крутки"><input name="reward_echo" placeholder="Эхо"><input name="sort_order" value="100"><button class="primary">Создать</button></form></section><section class="panel glass"><h2>Задания</h2><div class="admin-list">${data.tasks.map(t=>`<div class="admin-item"><b>${escapeHtml(t.title)}</b><p class="small">${t.type} · +${t.reward_spins} 🎲 · +${t.reward_echo} 🫧 · ${t.active?'on':'off'}</p><p>${escapeHtml(t.description)}</p></div>`).join('')}</div></section></div>`;
  $('#taskForm').onsubmit=async e=>{e.preventDefault();const obj=Object.fromEntries(new FormData(e.currentTarget)); await api('/api/admin/tasks',{method:'POST',body:JSON.stringify(obj)});toast('Задание создано',true);render();};
}
async function adminUsers(body){
  const data=await api('/api/admin/users'); body.innerHTML=`<section class="panel glass"><h2>Игроки</h2><div class="admin-list">${data.users.map(u=>`<div class="admin-item"><b>${u.avatar_emoji} ${escapeHtml(u.login)}</b><p class="small">${u.role} · 🎲 ${u.spins} · 🫧 ${u.echo} · ref ${u.referral_code}</p><button class="mini" data-veteran="${u.id}">Выдать ветерана</button></div>`).join('')}</div></section>`;
  $$('[data-veteran]').forEach(b=>b.onclick=async()=>{await api(`/api/admin/users/${b.dataset.veteran}/veteran`,{method:'POST',body:'{}'});toast('Ветеран выдан',true);});
}
async function adminPromos(body){
  const data=await api('/api/admin/promocodes'); body.innerHTML=`<div class="admin-grid"><section class="panel glass"><h2>Новый промокод</h2><form id="promoForm" class="form-grid"><input name="code" placeholder="CODE"><input name="spins" placeholder="крутки"><input name="echo" placeholder="Эхо"><input name="max_global_uses" placeholder="общий лимит"><input name="max_per_user" value="1"><button class="primary">Создать</button></form></section><section class="panel glass"><h2>Промокоды</h2><div class="admin-list">${data.promocodes.map(p=>`<div class="admin-item"><b>${escapeHtml(p.code)}</b><p class="small">+${p.spins} 🎲 · uses ${p.uses}/${p.max_global_uses} · per acc ${p.max_per_user}</p></div>`).join('')}</div></section></div>`;
  $('#promoForm').onsubmit=async e=>{e.preventDefault();await api('/api/admin/promocodes',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});toast('Промо создан',true);render();};
}
function escapeHtml(v=''){ return String(v).replace(/[&<>'"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s])); }

document.addEventListener('DOMContentLoaded', boot);
