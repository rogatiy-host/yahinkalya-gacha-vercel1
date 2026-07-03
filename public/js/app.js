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
  try { const data = await api('/api/auth/me'); if(data.user){ setUser(data.user); showApp(); await loadBase(); render(); refreshNotifications(); } else showAuth(); }
  catch { showAuth(); }
  if (window.Telegram?.WebApp){ Telegram.WebApp.ready(); Telegram.WebApp.expand(); $('#tgLoginBtn')?.classList.remove('hidden'); }
}
async function refreshNotifications(){
  try{ const d = await api('/api/social/notifications'); $('#socialDot')?.classList.toggle('hidden', d.total<=0); }catch{}
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
  $('#logoutBtn').addEventListener('click', doLogout);
  $('#logoutBtnMobile').addEventListener('click', doLogout);
}
async function doLogout(){ await api('/api/auth/logout',{method:'POST',body:'{}'}); location.reload(); }
function bindNav(){
  $$('.nav').forEach(btn => btn.addEventListener('click', () => { state.route = btn.dataset.route; state.viewProfileLogin = null; $$('.nav').forEach(b=>b.classList.toggle('active', b===btn)); render(); }));
}
function bindTilt(){
  document.addEventListener('pointermove', e => {
    if(e.pointerType === 'touch') return;
    const card = e.target.closest('.tilt-card'); if(!card) return;
    const r = card.getBoundingClientRect(); const x = (e.clientX-r.left)/r.width-.5; const y=(e.clientY-r.top)/r.height-.5;
    card.style.transform = `perspective(900px) rotateX(${y*-9}deg) rotateY(${x*12}deg) translateY(-2px)`;
    card.style.setProperty('--px', `${(x+0.5)*100}%`);
    const img = $('.card-img', card); if(img) img.style.transform = `scale(1.06) translate(${x*8}px,${y*8}px)`;
  });
  document.addEventListener('pointerleave', e => { const card=e.target.closest?.('.tilt-card'); if(card) resetTilt(card); }, true);
  document.addEventListener('pointerout', e => { const card=e.target.closest?.('.tilt-card'); if(card && !card.contains(e.relatedTarget)) resetTilt(card); });
  document.addEventListener('pointerdown', e => {
    if(e.pointerType !== 'touch') return;
    const card = e.target.closest('.tilt-card'); if(!card) return;
    card.classList.remove('tap-shine'); void card.offsetWidth; card.classList.add('tap-shine');
    setTimeout(()=>card.classList.remove('tap-shine'), 900);
  });
}
function resetTilt(card){ card.style.transform=''; card.style.removeProperty('--px'); const img=$('.card-img',card); if(img) img.style.transform=''; }

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
    if(state.route === 'history') return renderHistory(view);
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
        ${data.bannerCards?.length ? `<div class="banner-cards-strip">${data.bannerCards.map(c=>nodeToString(cardNode(c,{owned:true}))).join('')}</div>` : ''}
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
  const overlay = $('#pullOverlay'), tunnel = $('#rarityTunnel'), stage = $('#resultStage'), orb = $('#summonOrb'), closeBtn = $('#closePull'); let skipped=false;
  $('#skipAnim').onclick = () => skipped = true;
  overlay.classList.remove('hidden'); stage.innerHTML=''; orb.classList.remove('hidden'); closeBtn.classList.add('hidden'); $('#skipAnim').classList.remove('hidden');
  const highest = pulls.reduce((a,p)=>rank(p.card.rarity)>rank(a)?p.card.rarity:a,'R'); tunnel.style.setProperty('--rarity', rarityColor[highest]); orb.style.color = rarityColor[highest];
  await sleep(skipped?50:1250); orb.classList.add('hidden');
  for(const p of pulls){
    if(skipped) break;
    const node = cardNode(p.card, { owned:true, qty:p.card.qty, duplicate:p.isDuplicate, echo:p.echoAwarded });
    const tile = $('.card-tile', node);
    stage.appendChild(node);
    if(rank(p.card.rarity) >= 3) spawnBurst(tile, rarityColor[p.card.rarity]);
    if(rank(p.card.rarity) >= 4) shakeScreen(overlay);
    await sleep(rank(p.card.rarity) >= 4 ? 420 : 230);
  }
  if(skipped){ stage.innerHTML=''; pulls.forEach(p=>{ const node=cardNode(p.card,{owned:true,duplicate:p.isDuplicate,echo:p.echoAwarded}); const tile=$('.card-tile',node); stage.appendChild(node); if(rank(p.card.rarity)>=3) spawnBurst(tile, rarityColor[p.card.rarity]); }); }
  // Результат остаётся на экране, пока игрок сам не нажмёт «Забрать» — успеет сфоткать.
  $('#skipAnim').classList.add('hidden');
  closeBtn.classList.remove('hidden');
  await new Promise(resolve => { closeBtn.onclick = () => resolve(); });
  overlay.classList.add('hidden');
}
function spawnBurst(tile, color){
  const burst = document.createElement('div'); burst.className = 'burst';
  const ring = document.createElement('div'); ring.className = 'ring'; ring.style.setProperty('--spark-color', color); burst.appendChild(ring);
  const count = 16;
  for(let i=0;i<count;i++){
    const spark = document.createElement('div'); spark.className = 'spark';
    const angle = (Math.PI*2*i)/count + Math.random()*0.3;
    const dist = 70 + Math.random()*50;
    spark.style.setProperty('--spark-color', color);
    spark.style.setProperty('--tx', `${Math.cos(angle)*dist}px`);
    spark.style.setProperty('--ty', `${Math.sin(angle)*dist}px`);
    spark.style.animationDelay = `${Math.random()*80}ms`;
    burst.appendChild(spark);
  }
  tile.appendChild(burst);
  setTimeout(()=>burst.remove(), 1000);
}
function shakeScreen(overlay){
  overlay.classList.remove('shake'); void overlay.offsetWidth; overlay.classList.add('shake');
  setTimeout(()=>overlay.classList.remove('shake'), 520);
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
  $('.card-info small',el).textContent = owned ? `#${card.id} · ${card.rarity} · ${card.series_title || 'Без серии'}${opts.duplicate ? ' · дубликат +' + (opts.echo || 0) + ' Эха' : ''}` : `${card.rarity} · ${card.series_title || 'Без серии'}`;
  $('.rarity-ribbon',el).textContent = owned || card.rarity !== 'ONLYYOURS' ? card.rarity : '???';
  const qty = Number(opts.qty || card.owned_qty || card.qty || 0); $('.qty-badge',el).textContent = qty>1 ? `×${qty}` : (opts.duplicate ? 'ДУБЛЬ' : card.rarity);
  if(opts.wishlist){ el.addEventListener('dblclick', async()=>toggleWish(card)); }
  return tpl;
}
async function toggleWish(card){
  try{ await api(`/api/catalog/wishlist/${card.id}`, { method: card.wishlisted ? 'DELETE' : 'POST', body:'{}' }); card.wishlisted=!card.wishlisted; toast(card.wishlisted?'Добавлено в wishlist':'Убрано из wishlist', true); }
  catch(e){ toast(e.message); }
}
function openProfile(login){ state.viewProfileLogin = login; state.route='profile'; $$('.nav').forEach(n=>n.classList.toggle('active', n.dataset.route==='profile')); render(); }
async function renderProfile(view){
  const viewingOther = state.viewProfileLogin && state.viewProfileLogin !== state.user.login;
  const data = viewingOther ? await api('/api/profile/u/'+encodeURIComponent(state.viewProfileLogin)) : await api('/api/profile/me');
  if(!viewingOther) state.lastInventory = data.inventory;
  const friendBtn = (() => {
    if(!viewingOther) return '';
    const f = data.friendship;
    if(!f) return `<button class="primary" id="addFriendBtn">Добавить в друзья</button>`;
    if(f.status==='accepted') return `<span class="pill">🤝 В друзьях</span> <button class="ghost" id="proposeTradeBtn">Предложить трейд</button>`;
    if(f.status==='pending' && f.addressee_id===state.user.id) return `<button class="primary" id="acceptFriendBtn" data-fid="${f.id}">Принять заявку</button>`;
    return `<span class="pill muted">Заявка отправлена</span>`;
  })();
  view.innerHTML = `<section class="panel glass profile-head" style="${data.user.profile_banner_url ? `background-image:linear-gradient(180deg, rgba(9,0,18,.35), rgba(9,0,18,.92)), url('${data.user.profile_banner_url}');background-size:cover;background-position:center` : ''}">
    <div class="big-avatar">${data.user.avatar_card_image ? `<img src="${data.user.avatar_card_image}">` : escapeHtml(data.user.avatar_emoji)}</div>
    <div><h2>${escapeHtml(data.user.login)} ${viewingOther?'':''}</h2><p class="muted">Реферальный код: <b>${data.user.referral_code}</b></p>
    ${viewingOther ? `<div class="actions">${friendBtn}</div>` : `<div class="actions"><select id="emojiPick"></select><button class="ghost" id="saveEmoji">Сменить эмодзи</button><button class="ghost" id="bannerBtn">Фон шапки из своей карты</button></div>`}
    </div>
  </section>
  <section class="panel glass" style="margin-top:16px"><div class="section-title"><h2>Витрина</h2>${viewingOther?'':'<button class="primary" id="saveShowcase">Сохранить витрину</button>'}</div><div class="showcase" id="showcaseSlots">${viewingOther ? data.showcase.map(s=>s.id?nodeToString(cardNode(s,{owned:true,qty:s.qty})):'<div class="task muted">Пусто</div>').join('') : ''}</div></section>
  <section class="panel glass" style="margin-top:16px"><h2>Медальки</h2><div class="medals">${data.achievements.length ? data.achievements.map(a=>`<span class="medal" title="${escapeHtml(a.description)}">${a.medal_emoji} ${escapeHtml(a.title)}</span>`).join('') : '<span class="muted">Пока нет достижений</span>'}</div></section>
  <section class="panel glass" style="margin-top:16px"><h2>${viewingOther?'Коллекция':'Моя коллекция'}</h2><div class="cards-grid">${data.inventory.map(c=>nodeToString(cardNode(c,{owned:true,qty:c.qty}))).join('') || '<p class="muted">Пока пусто</p>'}</div></section>`;
  if(viewingOther){
    $('#addFriendBtn')?.addEventListener('click', async()=>{ try{ await api('/api/social/friends/'+encodeURIComponent(data.user.login),{method:'POST',body:'{}'}); toast('Заявка отправлена',true); openProfile(state.viewProfileLogin); }catch(e){toast(e.message);} });
    $('#acceptFriendBtn')?.addEventListener('click', async()=>{ try{ await api(`/api/social/friends/${$('#acceptFriendBtn').dataset.fid}/respond`,{method:'POST',body:JSON.stringify({accept:true})}); toast('Друг добавлен',true); openProfile(state.viewProfileLogin); refreshNotifications(); }catch(e){toast(e.message);} });
    $('#proposeTradeBtn')?.addEventListener('click', ()=>{ state.route='social'; state.viewProfileLogin=null; state.prefillTradeLogin=data.user.login; $$('.nav').forEach(n=>n.classList.toggle('active', n.dataset.route==='social')); render(); });
    return;
  }
  const emojis = await api('/api/profile/emojis'); $('#emojiPick').innerHTML = emojis.emojis.map(e=>`<option ${e===data.user.avatar_emoji?'selected':''}>${e}</option>`).join('');
  $('#saveEmoji').onclick=async()=>{ const d=await api('/api/profile/me',{method:'PATCH',body:JSON.stringify({avatar_emoji:$('#emojiPick').value})}); setUser(d.user); toast('Аватар обновлён',true); render(); };
  $('#bannerBtn').onclick=async()=>{
    if(!data.inventory.length) return toast('Сначала выбей хотя бы одну карту');
    const pick = data.inventory.map((c,i)=>`${i+1}. ${c.title} (${c.rarity})`).join('\n');
    const idx = Number(prompt('Какую карту поставить фоном шапки профиля? Введи номер:\n'+pick));
    const card = data.inventory[idx-1]; if(!card) return;
    try{ await api('/api/profile/me',{method:'PATCH',body:JSON.stringify({profile_banner_url:card.image_url})}); toast('Фон обновлён',true); render(); }catch(e){toast(e.message);}
  };
  const slots = $('#showcaseSlots');
  for(let i=1;i<=5;i++){ const current=data.showcase.find(s=>s.slot===i); const wrap=document.createElement('div'); wrap.className='task'; wrap.innerHTML=`<b>Слот ${i}</b><select data-slot="${i}"><option value="">Пусто</option>${data.inventory.map(c=>`<option value="${c.id}" ${current?.id===c.id?'selected':''}>${c.rarity} · ${escapeHtml(c.title)}</option>`).join('')}</select>`; slots.appendChild(wrap); }
  $('#saveShowcase').onclick=async()=>{ const arr=$$('[data-slot]').map(s=>s.value||null); await api('/api/profile/showcase',{method:'POST',body:JSON.stringify({slots:arr})}); toast('Витрина сохранена',true); };
}
function nodeToString(node){ const d=document.createElement('div'); d.appendChild(node); return d.innerHTML; }
async function renderTasks(view){
  const data = await api('/api/tasks');
  view.innerHTML = `<div class="section-title"><div><h2>Ежедневные задания</h2><p class="muted">Обновляются каждый день. Telegram-проверка подписки включится после настройки бота.</p></div></div><div class="grid cols2">${data.tasks.map(t=>`<div class="task ${t.today_status?'done':''}"><h3>${escapeHtml(t.title)}</h3><p class="muted">${escapeHtml(t.description)}</p><p>🎲 +${t.reward_spins} · 🫧 +${t.reward_echo}</p><button class="primary" data-claim="${t.id}" ${t.today_status?'disabled':''}>${t.today_status?'Выполнено':'Забрать'}</button></div>`).join('')}</div><section class="panel glass" style="margin-top:16px"><h3>Промокод</h3><div class="actions"><input id="promoInput" placeholder="Введите промокод"><button class="primary" id="promoBtn">Активировать</button></div></section>`;
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
  view.innerHTML = `<div class="grid cols2"><section class="panel glass"><h2>Поиск друзей</h2><div class="actions"><input id="friendSearch" placeholder="логин друга"><button class="primary" id="findFriend">Найти</button></div><div id="searchResults" class="grid"></div><h3>Заявки</h3><div class="grid">${friends.incoming.map(f=>`<div class="friend">${f.avatar_emoji} <span class="friend-link" data-open-profile="${escapeHtml(f.login)}">${escapeHtml(f.login)}</span> <button class="mini" data-accept-friend="${f.id}">Принять</button></div>`).join('') || '<p class="muted">Нет заявок</p>'}</div><h3>Друзья</h3><div class="grid">${friends.friends.map(f=>`<div class="friend">${f.avatar_emoji} <span class="friend-link" data-open-profile="${escapeHtml(f.login)}">${escapeHtml(f.login)}</span></div>`).join('') || '<p class="muted">Пока нет друзей</p>'}</div></section>
  <section class="panel glass"><h2>Предложить трейд</h2><div class="form-grid"><input id="tradeLogin" placeholder="логин друга" value="${escapeHtml(state.prefillTradeLogin||'')}"><select id="giveCard">${me.inventory.map(c=>`<option value="${c.id}">#${c.id} · ${c.rarity} · ${escapeHtml(c.title)}</option>`).join('')}</select><input id="wantCard" placeholder="ID карты друга, которую хотите"><textarea id="tradeMsg" placeholder="сообщение"></textarea><button class="primary" id="sendTrade">Отправить предложение</button></div></section></div>
  <section class="panel glass" style="margin-top:16px"><h2>Трейды</h2><div class="grid">${trades.trades.map(t=>`<div class="trade"><b>${escapeHtml(t.from_login)} → ${escapeHtml(t.to_login)}</b><p>${escapeHtml(t.from_card_title)} ⇄ ${escapeHtml(t.to_card_title)}</p><p class="muted">${escapeHtml(t.status)} ${escapeHtml(t.message||'')}</p>${t.to_user_id===state.user.id&&t.status==='pending'?`<button class="mini" data-trade-ok="${t.id}">Принять</button><button class="mini danger" data-trade-no="${t.id}">Отклонить</button>`:''}</div>`).join('') || '<p class="muted">Трейдов пока нет</p>'}</div></section>`;
  state.prefillTradeLogin = null;
  api('/api/social/seen',{method:'POST',body:'{}'}).then(refreshNotifications);
  $$('[data-open-profile]',view).forEach(el=>el.onclick=()=>openProfile(el.dataset.openProfile));
  $('#findFriend').onclick=async()=>{ const d=await api('/api/social/search?q='+encodeURIComponent($('#friendSearch').value)); $('#searchResults').innerHTML=d.users.map(u=>`<div class="friend">${u.avatar_emoji} <span class="friend-link" data-open-profile="${escapeHtml(u.login)}">${escapeHtml(u.login)}</span> <button class="mini" data-add="${u.login}">Добавить</button></div>`).join(''); $$('[data-open-profile]',$('#searchResults')).forEach(el=>el.onclick=()=>openProfile(el.dataset.openProfile)); $$('[data-add]').forEach(b=>b.onclick=async()=>{await api('/api/social/friends/'+b.dataset.add,{method:'POST',body:'{}'}); toast('Заявка отправлена',true);}); };
  $$('[data-accept-friend]').forEach(b=>b.onclick=async()=>{ await api(`/api/social/friends/${b.dataset.acceptFriend}/respond`,{method:'POST',body:JSON.stringify({accept:true})}); toast('Друг добавлен',true); render(); refreshNotifications(); });
  $('#sendTrade').onclick=async()=>{ try{ await api('/api/social/trades',{method:'POST',body:JSON.stringify({to_login:$('#tradeLogin').value, from_card_id:$('#giveCard').value, to_card_id:$('#wantCard').value, message:$('#tradeMsg').value})}); toast('Трейд отправлен',true); render(); }catch(e){toast(e.message);} };
  $$('[data-trade-ok]').forEach(b=>b.onclick=async()=>{await api(`/api/social/trades/${b.dataset.tradeOk}/respond`,{method:'POST',body:JSON.stringify({accept:true})}); toast('Трейд принят',true); render(); refreshNotifications();});
  $$('[data-trade-no]').forEach(b=>b.onclick=async()=>{await api(`/api/social/trades/${b.dataset.tradeNo}/respond`,{method:'POST',body:JSON.stringify({accept:false})}); toast('Трейд отклонён',true); render(); refreshNotifications();});
}
async function renderHistory(view){
  view.innerHTML = `<div class="section-title"><div><h2>История круток</h2><p class="muted">Всё, что тебе когда-либо выпадало, в хронологическом порядке.</p></div></div><div id="historyList" class="grid"></div><div class="actions" style="justify-content:center"><button class="ghost" id="loadMoreHistory">Показать ещё</button></div>`;
  state.historyOffset = 0;
  await loadHistoryPage();
  $('#loadMoreHistory').onclick = loadHistoryPage;
}
async function loadHistoryPage(){
  const data = await api(`/api/gacha/history?limit=30&offset=${state.historyOffset}`);
  state.historyOffset += data.pulls.length;
  const list = $('#historyList');
  list.innerHTML += data.pulls.map(p=>`<div class="task" style="display:flex;gap:12px;align-items:center">
    <img src="${p.image_url||''}" style="width:44px;height:60px;object-fit:cover;border-radius:8px;border:1px solid var(--line)">
    <div style="flex:1"><b>${escapeHtml(p.title||'Карта удалена')}</b> <span class="rarity-ribbon" style="position:static;display:inline-block;--rarity:${rarityColor[p.rarity]}">${p.rarity}</span>
    <p class="small muted">${new Date(p.created_at).toLocaleString('ru-RU')} · ${escapeHtml(p.series_title||'Без серии')}${p.is_duplicate?` · дубликат +${p.echo_awarded} Эха`:''}${p.banner_title?` · баннер «${escapeHtml(p.banner_title)}»`:''}</p></div>
  </div>`).join('');
  if(data.pulls.length < 30) $('#loadMoreHistory').classList.add('hidden');
}
async function renderAdmin(view){
  if(state.user.role!=='admin'){ view.innerHTML='<div class="panel glass">Нет доступа</div>'; return; }
  view.innerHTML = `<div class="admin-tabs"><button class="mini ${state.adminTab==='cards'?'active':''}" data-admin-tab="cards">Карты</button><button class="mini ${state.adminTab==='series'?'active':''}" data-admin-tab="series">Серии</button><button class="mini ${state.adminTab==='banners'?'active':''}" data-admin-tab="banners">Баннеры</button><button class="mini ${state.adminTab==='tasks'?'active':''}" data-admin-tab="tasks">Задания</button><button class="mini ${state.adminTab==='users'?'active':''}" data-admin-tab="users">Игроки</button><button class="mini ${state.adminTab==='promos'?'active':''}" data-admin-tab="promos">Промокоды</button></div><div id="adminBody"></div>`;
  $$('[data-admin-tab]').forEach(b=>b.onclick=()=>{state.adminTab=b.dataset.adminTab; renderAdmin(view);});
  const body=$('#adminBody');
  if(state.adminTab==='cards') await adminCards(body);
  if(state.adminTab==='series') await adminSeries(body);
  if(state.adminTab==='banners') await adminBanners(body);
  if(state.adminTab==='tasks') await adminTasks(body);
  if(state.adminTab==='users') await adminUsers(body);
  if(state.adminTab==='promos') await adminPromos(body);
}
async function adminCards(body){
  const [cards, series] = await Promise.all([api('/api/admin/cards'), api('/api/admin/series')]);
  body.innerHTML = `<div class="admin-grid"><section class="panel glass"><h2>Добавить карту</h2><form id="cardForm" class="form-grid"><input name="title" placeholder="Название" required><input name="caption" placeholder="Подпись снизу"><select name="rarity">${['R','SR','SSR','UR','ONLYYOURS'].map(r=>`<option>${r}</option>`)}</select><select name="series_id">${series.series.map(s=>`<option value="${s.id}">${escapeHtml(s.title)}</option>`)}</select><input name="shop_price" placeholder="Цена в магазине"><input name="event_weight" placeholder="Вес выпадения" value="100"><input name="tags" placeholder="теги через запятую, напр. winter, jjk"><input name="image_url" placeholder="URL картинки, например https://..."><input type="file" name="image" accept="image/*"><button class="primary">Создать</button></form></section><section class="panel glass"><h2>Карты</h2><p class="small">ID карты — это её номер в базе. Он нужен, например, когда предлагаешь трейд другу («ID карты друга, которую хочешь») или ссылаешься на конкретную карту в баннере.</p><div class="admin-list">${cards.cards.map(c=>`<div class="admin-item" data-card-row="${c.id}"><div style="display:flex;gap:10px;align-items:center;justify-content:space-between"><div style="display:flex;gap:10px;align-items:center"><img src="${c.image_url}" style="width:56px;height:78px;object-fit:cover;border-radius:10px"><div><b>#${c.id} · ${escapeHtml(c.title)}</b><p class="small">${c.rarity} · ${escapeHtml(c.series_title||'')} · вес ${c.event_weight} · shop ${c.shop_price} ${c.is_active?'':'· скрыта'}</p></div></div><div style="display:flex;gap:6px"><button class="mini" data-edit-card="${c.id}">Изменить</button><button class="mini danger" data-delete-card="${c.id}">Удалить</button></div></div><div class="edit-slot hidden" data-edit-slot="${c.id}"></div></div>`).join('')}</div></section></div>`;
  $('#cardForm').onsubmit=async e=>{e.preventDefault(); try{await api('/api/admin/cards',{method:'POST',body:new FormData(e.currentTarget)}); toast('Карта создана',true); render();}catch(err){toast(err.message)}};
  $$('[data-delete-card]').forEach(b=>b.onclick=async()=>{
    const id = b.dataset.deleteCard;
    if(!confirm('Точно удалить эту карту? Отменить не получится.')) return;
    try{
      await api(`/api/admin/cards/${id}`,{method:'DELETE'});
      toast('Карта удалена',true); renderAdmin($('#view'));
    }catch(err){
      if(err.ownersCount){
        if(confirm(`${err.message}\n\nУдалить всё равно? Она пропадёт и из инвентаря игроков.`)){
          try{ await api(`/api/admin/cards/${id}?force=true`,{method:'DELETE'}); toast('Карта удалена',true); renderAdmin($('#view')); }
          catch(err2){ toast(err2.message); }
        }
      } else toast(err.message);
    }
  });
  $$('[data-edit-card]').forEach(b=>b.onclick=()=>{
    const id = b.dataset.editCard;
    const card = cards.cards.find(c=>String(c.id)===String(id));
    const slot = $(`[data-edit-slot="${id}"]`);
    if(!slot.classList.contains('hidden')){ slot.classList.add('hidden'); slot.innerHTML=''; return; }
    $$('.edit-slot').forEach(s=>{ s.classList.add('hidden'); s.innerHTML=''; });
    slot.classList.remove('hidden');
    slot.innerHTML = `<form class="form-grid" data-edit-form="${id}" style="margin-top:10px">
      <input name="title" value="${escapeHtml(card.title)}" placeholder="Название" required>
      <input name="caption" value="${escapeHtml(card.caption||'')}" placeholder="Подпись снизу">
      <select name="rarity">${['R','SR','SSR','UR','ONLYYOURS'].map(r=>`<option ${r===card.rarity?'selected':''}>${r}</option>`).join('')}</select>
      <select name="series_id">${series.series.map(s=>`<option value="${s.id}" ${s.id===card.series_id?'selected':''}>${escapeHtml(s.title)}</option>`).join('')}</select>
      <input name="shop_price" value="${card.shop_price}" placeholder="Цена в магазине">
      <input name="event_weight" value="${card.event_weight}" placeholder="Вес выпадения">
      <input name="tags" value="${escapeHtml((card.tags||[]).join(', '))}" placeholder="теги через запятую">
      <input name="image_url" value="${escapeHtml(card.image_url)}" placeholder="URL картинки">
      <label class="pill"><input type="checkbox" name="is_active" ${card.is_active?'checked':''} style="width:auto"> активна в крутках</label>
      <div class="actions"><button class="primary" type="submit">Сохранить</button></div>
    </form>`;
    $(`[data-edit-form="${id}"]`).onsubmit = async ev => {
      ev.preventDefault();
      const fd = new FormData(ev.currentTarget);
      const payload = Object.fromEntries(fd);
      payload.is_active = fd.get('is_active') ? 'true' : 'false';
      try{ await api(`/api/admin/cards/${id}`,{method:'PATCH',body:JSON.stringify(payload)}); toast('Карта обновлена',true); renderAdmin($('#view')); }
      catch(err){ toast(err.message); }
    };
  });
}
async function adminSeries(body){
  const data=await api('/api/admin/series'); body.innerHTML=`<div class="admin-grid"><section class="panel glass"><h2>Новая серия</h2><form id="seriesForm" class="form-grid"><input name="title" placeholder="Название"><input name="slug" placeholder="slug"><input name="color" value="#9b5cff"><textarea name="description" placeholder="Описание"></textarea><button class="primary">Создать</button></form></section><section class="panel glass"><h2>Серии</h2><div class="admin-list">${data.series.map(s=>`<div class="admin-item"><b>${escapeHtml(s.title)}</b><p class="small">${s.slug} · ${s.color}</p><p>${escapeHtml(s.description||'')}</p></div>`).join('')}</div></section></div>`;
  $('#seriesForm').onsubmit=async e=>{e.preventDefault();await api('/api/admin/series',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});toast('Серия создана',true);render();};
}
async function adminTasks(body){
  const data=await api('/api/admin/tasks'); body.innerHTML=`<div class="admin-grid"><section class="panel glass"><h2>Новое задание</h2><form id="taskForm" class="form-grid"><input name="title" placeholder="Название"><textarea name="description" placeholder="Описание"></textarea><select name="type"><option>daily_login</option><option>telegram_subscribe</option><option>telegram_react</option><option>open_link</option><option>manual</option></select><input name="reward_spins" placeholder="Крутки"><input name="reward_echo" placeholder="Эхо"><input name="sort_order" value="100"><button class="primary">Создать</button></form></section><section class="panel glass"><h2>Задания</h2><div class="admin-list">${data.tasks.map(t=>`<div class="admin-item"><b>${escapeHtml(t.title)}</b><p class="small">${t.type} · +${t.reward_spins} 🎲 · +${t.reward_echo} 🫧 · ${t.active?'on':'off'}</p><p>${escapeHtml(t.description)}</p></div>`).join('')}</div></section></div>`;
  $('#taskForm').onsubmit=async e=>{e.preventDefault();const obj=Object.fromEntries(new FormData(e.currentTarget)); await api('/api/admin/tasks',{method:'POST',body:JSON.stringify(obj)});toast('Задание создано',true);render();};
}
async function adminBanners(body){
  const [banners, cards] = await Promise.all([api('/api/admin/banners'), api('/api/admin/cards')]);
  const cardPicker = (selectedIds=[]) => `<div class="small" style="margin:6px 0">Какие карты явно закрепить за баннером (получают буст веса × 1.8, показываются в его витрине):</div>
    <div class="banner-card-picker">${cards.cards.map(c=>`<label class="pill" style="cursor:pointer"><input type="checkbox" value="${c.id}" ${selectedIds.includes(c.id)?'checked':''} style="width:auto"> #${c.id} ${escapeHtml(c.title)} <span class="small">${c.rarity}</span></label>`).join('')}</div>`;
  body.innerHTML = `<div class="admin-grid"><section class="panel glass"><h2>Новый баннер</h2><form id="bannerForm" class="form-grid">
    <input name="title" placeholder="Название баннера" required>
    <textarea name="description" placeholder="Описание для игроков"></textarea>
    <select name="boost_series_id"><option value="">Без буста серии</option>${(await api('/api/admin/series')).series.map(s=>`<option value="${s.id}">${escapeHtml(s.title)}</option>`).join('')}</select>
    <input name="tags" placeholder="теги через запятую (бустят любые карты с такими тегами)">
    <label class="pill"><input type="checkbox" name="active" checked style="width:auto"> активен</label>
    <label class="small">Начало<input type="datetime-local" name="start_at"></label>
    <label class="small">Конец<input type="datetime-local" name="end_at"></label>
    ${cardPicker()}
    <button class="primary">Создать баннер</button>
  </form></section>
  <section class="panel glass"><h2>Баннеры</h2><div class="admin-list">${banners.banners.map(b=>`<div class="admin-item"><div style="display:flex;justify-content:space-between;align-items:center"><div><b>${escapeHtml(b.title)}</b><p class="small">${b.active?'🟢 активен':'⚪ выключен'} · серия: ${escapeHtml(b.series_title||'—')} · теги: ${(b.tags||[]).join(', ')||'—'} · карт закреплено: ${(b.card_ids||[]).length}</p><p class="small">до ${b.end_at ? new Date(b.end_at).toLocaleString('ru-RU') : '∞'}</p></div><div style="display:flex;gap:6px"><button class="mini" data-toggle-banner="${b.id}" data-active="${b.active}">${b.active?'Выключить':'Включить'}</button><button class="mini danger" data-delete-banner="${b.id}">Удалить</button></div></div></div>`).join('') || '<p class="muted">Баннеров пока нет</p>'}</div></section></div>`;
  $('#bannerForm').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const cardIds = $$('.banner-card-picker input:checked', e.currentTarget).map(i=>i.value);
    const payload = Object.fromEntries(fd);
    payload.active = fd.get('active') ? 'true' : 'false';
    payload.card_ids = cardIds;
    try{ await api('/api/admin/banners',{method:'POST',body:JSON.stringify(payload)}); toast('Баннер создан',true); renderAdmin($('#view')); }
    catch(err){ toast(err.message); }
  };
  $$('[data-toggle-banner]').forEach(b=>b.onclick=async()=>{
    try{ await api(`/api/admin/banners/${b.dataset.toggleBanner}`,{method:'PATCH',body:JSON.stringify({active: b.dataset.active!=='true'})}); toast('Готово',true); renderAdmin($('#view')); }
    catch(err){ toast(err.message); }
  });
  $$('[data-delete-banner]').forEach(b=>b.onclick=async()=>{
    if(!confirm('Удалить баннер?')) return;
    try{ await api(`/api/admin/banners/${b.dataset.deleteBanner}`,{method:'DELETE'}); toast('Баннер удалён',true); renderAdmin($('#view')); }
    catch(err){ toast(err.message); }
  });
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
