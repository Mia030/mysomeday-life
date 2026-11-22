const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const persistData = () => window.WAITLIST_STORE?.save(window.WAITLIST_MOCK);

async function loadPartial(target, path) {
  const node = document.querySelector(target);
  if (!node) return;
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Could not load ${path}`);
    node.innerHTML = await response.text();
  } catch (error) {
    node.innerHTML = '';
  }
}

function activateNav() {
  const page = document.body.dataset.page;
  $$(`[data-nav="${page}"]`).forEach(el => el.classList.add('active'));
  const bubblePage = page === 'account' ? 'account' : page === 'wishlist' ? 'wishlist' : null;
  $$('[data-bubble-page]').forEach(el => el.classList.toggle('active', Boolean(bubblePage) && el.dataset.bubblePage === bubblePage));
  const titles = { history: 'History', review: 'Memory', account: 'Account' };
  if ($('#siteContextTitle')) $('#siteContextTitle').textContent = titles[page] || '';
}

function ensureQuickNav() {
  if ($('.bubble-nav')) return;
  const nav = document.createElement('nav');
  nav.className = 'bubble-nav shared-bubble-nav';
  nav.setAttribute('aria-label', 'Quick navigation');
  nav.innerHTML = `<a class="bubble-nav-item" data-bubble-page="wishlist" href="wishlist.html"><span>♡</span><small>Wishlist</small></a><a class="bubble-nav-item add-bubble" href="wishlist.html#add" aria-label="Add something"><span>+</span></a><a class="bubble-nav-item" data-bubble-page="account" href="account.html"><span>○</span><small>Account</small></a>`;
  document.body.append(nav);
}

function setupTheme() {
  const saved = localStorage.getItem('waitlist-theme');
  if (saved) document.documentElement.dataset.theme = saved;
  $('#themeToggle')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('waitlist-theme', next);
  });
}

function toast(message) {
  let el = $('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function daysSince(date) {
  return Math.max(0, Math.floor((Date.now() - new Date(date)) / 86400000));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
}

function formatMoney(value = 0) {
  const currency = WAITLIST_MOCK.settings?.currency || 'USD';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function starsTemplate(rating = 0, interactive = false, id = '') {
  return `<div class="stars ${interactive ? 'interactive' : ''}" ${id ? `data-id="${id}"` : ''} aria-label="${rating} out of 5 stars">${[1,2,3,4,5].map(n => interactive ? `<button class="${n <= rating ? 'on':''}" data-rating="${n}" aria-label="${n} stars">★</button>` : `<span class="${n <= rating ? 'on':''}">★</span>`).join('')}</div>`;
}

function enhanceStandaloneSelect(select) {
  if (!select || select.closest('.frost-select')) return;
  const shell = document.createElement('div');
  shell.className = 'frost-select';
  select.parentNode.insertBefore(shell, select);
  shell.append(select);
  select.classList.add('native-select-hidden');
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'frost-select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  const menu = document.createElement('div');
  menu.className = 'frost-select-menu';
  const update = () => {
    trigger.firstElementChild.textContent = select.options[select.selectedIndex].textContent;
    $$('.frost-select-option', menu).forEach((item, index) => item.classList.toggle('selected', index === select.selectedIndex));
  };
  [...select.options].forEach(option => {
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = `frost-select-option ${option.selected ? 'selected' : ''}`;
    choice.textContent = option.textContent;
    choice.onclick = event => {
      event.stopPropagation();
      select.value = option.value;
      select.dispatchEvent(new Event('change'));
      update();
      shell.classList.remove('open');
    };
    menu.append(choice);
  });
  trigger.innerHTML = `<span>${select.options[select.selectedIndex].textContent}</span><span class="select-chevron">⌄</span>`;
  trigger.onclick = event => {
    event.stopPropagation();
    const open = shell.classList.toggle('open');
    trigger.setAttribute('aria-expanded', String(open));
  };
  shell.append(trigger, menu);
  document.addEventListener('click', () => shell.classList.remove('open'));
  return { refresh: update };
}

function cardTemplate(item) {
  return `<article class="product-card visual-card reveal-card" data-id="${item.id}" tabindex="0" role="button" aria-label="Open ${item.name}">
    <div class="product-image-wrap"><img src="${item.image}" alt="">${item.favorite ? '<span class="favorite-badge" aria-label="Favorite">♥</span>' : ''}<span class="product-hover-meta"><strong>${escapeHtml(item.name)}</strong><small>${formatMoney(item.price ?? item.saved)}</small></span></div>
    <div class="card-manage-overlay"><span>Manage wish</span><div><button class="card-manage-select" type="button">Select</button><button class="card-manage-delete" type="button">Delete</button></div></div>
  </article>`;
}

function initWishlist() {
  const grid = $('#wishlistGrid');
  if (!grid) return;
  let items = [...WAITLIST_MOCK.wishlist];
  const historyItems = [...WAITLIST_MOCK.bought, ...WAITLIST_MOCK.letGo];
  const collections = WAITLIST_MOCK.collections || [];
  const ultimateBuckets = WAITLIST_MOCK.ultimateBuckets || [];
  let activeSavingsBucketId = null;
  let savingsTransactionMode = 'add';
  let pendingSavingsItem = null;
  const allItems = () => [...items, ...historyItems];
  const persistWishlistState = () => {
    WAITLIST_MOCK.wishlist = items.filter(item => item.status === 'waiting');
    WAITLIST_MOCK.bought = historyItems.filter(item => item.status === 'bought');
    WAITLIST_MOCK.letGo = historyItems.filter(item => item.status === 'letGo');
    WAITLIST_MOCK.collections = collections;
    WAITLIST_MOCK.ultimateBuckets = ultimateBuckets;
    persistData();
  };
  const moveToHistory = (item, status) => {
    const wishlistIndex = items.indexOf(item);
    if (wishlistIndex >= 0) items.splice(wishlistIndex, 1);
    item.status = status;
    if (!historyItems.includes(item)) historyItems.unshift(item);
  };

  const refreshCollectionSelects = () => {
    $('#collectionFilter').innerHTML = `<option value="all">All collections</option>${collections.map(collection => `<option value="${collection.id}">${collection.name}</option>`).join('')}`;
    $('#addCollectionSelect').innerHTML = `<option value="">No collection</option>${collections.map(collection => `<option value="${collection.id}">${collection.name}</option>`).join('')}<option value="__new__">＋ Create new collection</option>`;
  };
  refreshCollectionSelects();
  enhanceSelect($('#wishlistFilter'));
  const collectionFilterUi = enhanceSelect($('#collectionFilter'));
  enhanceSelect($('#sortSelect'));
  const addCollectionUi = enhanceSelect($('#addCollectionSelect'));
  $('#savingsBucketSelect').innerHTML = ultimateBuckets.map(bucket => `<option value="${bucket.id}">${escapeHtml(bucket.name)}</option>`).join('');
  const savingsBucketUi = enhanceSelect($('#savingsBucketSelect'));
  const refreshSavingsBucketSelect = () => {
    const selected = $('#savingsBucketSelect').value;
    $('#savingsBucketSelect').innerHTML = ultimateBuckets.map(bucket => `<option value="${bucket.id}">${escapeHtml(bucket.name)}</option>`).join('');
    $('#savingsBucketSelect').value = ultimateBuckets.some(bucket => bucket.id === selected) ? selected : ultimateBuckets[0]?.id || '';
    savingsBucketUi.refresh();
  };

  const render = () => {
    const sort = $('#sortSelect').value;
    const filter = $('#wishlistFilter').value;
    const collectionFilter = $('#collectionFilter').value;
    const query = $('#wishlistSearch').value.trim().toLowerCase();
    let visible = filter === 'bought' ? allItems().filter(item => item.status === 'bought')
      : filter === 'letGo' ? allItems().filter(item => item.status === 'letGo')
      : filter === 'favorites' ? allItems().filter(item => item.favorite)
      : items;
    if (collectionFilter !== 'all') visible = visible.filter(item => item.collectionId === collectionFilter);
    visible = visible.filter(item => item.name.toLowerCase().includes(query));
    visible.sort((a,b) => sort === 'priceLow' ? a.price-b.price : sort === 'priceHigh' ? b.price-a.price : sort === 'wanted' ? (b.wantCount || 0)-(a.wantCount || 0) : new Date(b.addedAt || b.date)-new Date(a.addedAt || a.date));
    grid.innerHTML = visible.length ? visible.map(cardTemplate).join('') : '<div class="empty-state"><span>♡</span><h3>No wishes found</h3><p>Try another filter or search.</p></div>';
    $$('.product-card', grid).forEach(card => {
      let holdTimer;
      let held = false;
      const enterManageMode = () => {
        held = true;
        $$('.product-card.manage-open', grid).forEach(other => other !== card && other.classList.remove('manage-open'));
        card.classList.add('manage-open');
      };
      card.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest('button')) return;
        held = false;
        holdTimer = setTimeout(enterManageMode, 520);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => card.addEventListener(type, () => clearTimeout(holdTimer)));
      card.addEventListener('contextmenu', event => { event.preventDefault(); enterManageMode(); });
      card.addEventListener('click', event => {
        if (event.target.closest('.card-manage-select')) {
          event.stopPropagation();
          openCollectionBuilder('organize', Number(card.dataset.id));
          return;
        }
        if (event.target.closest('.card-manage-delete')) {
          event.stopPropagation();
          deleteWish(Number(card.dataset.id));
          return;
        }
        if (held || card.classList.contains('manage-open')) {
          event.preventDefault();
          held = false;
          return;
        }
        openProduct(Number(card.dataset.id));
      });
      card.addEventListener('keydown', event => {
        if (event.target !== card) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openProduct(Number(card.dataset.id));
        }
      });
    });
    revealCards(grid);
  };

  function revealCards(root) {
    const cards = $$('.reveal-card', root);
    if (!('IntersectionObserver' in window)) {
      cards.forEach(card => card.classList.add('visible'));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    cards.forEach((card, index) => {
      card.style.setProperty('--reveal-delay', `${Math.min(index % 6, 5) * 45}ms`);
      observer.observe(card);
    });
  }

  function enhanceSelect(select) {
    const shell = document.createElement('div');
    shell.className = 'frost-select';
    select.parentNode.insertBefore(shell, select);
    shell.append(select);
    select.classList.add('native-select-hidden');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'frost-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div');
    menu.className = 'frost-select-menu';
    menu.setAttribute('role', 'listbox');

    function buildOptions() {
      menu.innerHTML = '';
      [...select.options].forEach(option => {
        const choice = document.createElement('button');
        choice.type = 'button';
        choice.className = 'frost-select-option';
        choice.dataset.value = option.value;
        choice.textContent = option.textContent;
        choice.setAttribute('role', 'option');
        choice.addEventListener('click', event => {
          event.stopPropagation();
          select.value = option.value;
          select.dispatchEvent(new Event('change'));
          updateSelect();
          shell.classList.remove('open');
          trigger.setAttribute('aria-expanded', 'false');
        });
        menu.append(choice);
      });
    }

    function updateSelect() {
      trigger.innerHTML = `<span>${select.options[select.selectedIndex].textContent}</span><span class="select-chevron">⌄</span>`;
      $$('.frost-select-option', menu).forEach(option => {
        const selected = option.dataset.value === select.value;
        option.classList.toggle('selected', selected);
        option.setAttribute('aria-selected', String(selected));
      });
    }

    trigger.addEventListener('click', event => {
      event.stopPropagation();
      $$('.frost-select.open').forEach(other => {
        if (other !== shell) other.classList.remove('open');
      });
      const open = shell.classList.toggle('open');
      trigger.setAttribute('aria-expanded', String(open));
    });
    shell.append(trigger, menu);
    buildOptions();
    updateSelect();
    return { refresh: () => { buildOptions(); updateSelect(); } };
  }
  document.addEventListener('click', () => $$('.frost-select.open').forEach(select => select.classList.remove('open')));
  document.addEventListener('pointerdown', event => {
    const activeCard = $('.product-card.manage-open', grid);
    if (activeCard && !event.target.closest('.product-card.manage-open')) {
      activeCard.classList.remove('manage-open');
    }
  });

  render();
  $('#wishlistSearch').addEventListener('input', render);
  $('#wishlistFilter').addEventListener('change', render);
  $$('.view-btn').forEach(btn => btn.addEventListener('click', () => {
    $$('.view-btn').forEach(other => other.classList.remove('active'));
    btn.classList.add('active');
    grid.classList.toggle('list', btn.dataset.view === 'list');
  }));
  const closeFilterDrawer = () => {
    $('#filterDrawer').classList.remove('open');
    $('#filterDrawerBackdrop').classList.remove('open');
  };
  $('#openFilters').addEventListener('click', () => {
    $('#filterDrawer').classList.add('open');
    $('#filterDrawerBackdrop').classList.add('open');
  });
  $('#closeFilters').addEventListener('click', closeFilterDrawer);
  $('#filterDrawerBackdrop').addEventListener('click', closeFilterDrawer);
  $('#applyFilters').addEventListener('click', () => {
    render();
    closeFilterDrawer();
  });
  const closeQuickAdd = () => {
    $('#quickAddMenu').classList.remove('open');
    $('#quickAddBackdrop').classList.remove('open');
    $('#quickAdd').classList.remove('open');
  };
  const revealAddFields = () => $('#addItemFields').classList.remove('hidden');
  const resetAddExperience = () => {
    $('#addForm').reset();
    $('#addItemFields').classList.add('hidden');
    $('#getProductDetails').classList.add('hidden');
    $('#productFetchPreview').classList.add('hidden');
    $('#productFetchStatus').textContent = '';
    $('#productFetchStatus').classList.remove('error');
  };
  const openAddModal = (collectionId = null) => {
    closeQuickAdd();
    resetAddExperience();
    $('#addCollectionSelect').value = collectionId || '';
    addCollectionUi.refresh();
    $('#newCollectionLabel').classList.add('hidden');
    $('#newCollectionName').required = false;
    $('#addModal').classList.add('open');
  };
  $('#addWishFromPage').addEventListener('click', () => openAddModal());
  $('#addCollectionFromHome').addEventListener('click', () => openCollectionBuilder('create'));
  $('#closeAdd').addEventListener('click', () => $('#addModal').classList.remove('open'));
  $('#addProductManually').addEventListener('click', revealAddFields);
  $('#addProductUrl').addEventListener('input', event => {
    const hasUrl = Boolean(event.target.value.trim());
    $('#getProductDetails').classList.toggle('hidden', !hasUrl);
    if (hasUrl) revealAddFields();
    $('#productFetchStatus').textContent = '';
    $('#productFetchStatus').classList.remove('error');
  });
  $('#addProductImage').addEventListener('input', event => {
    if (!event.target.value.trim()) return;
    $('#productPreviewImage').src = event.target.value.trim();
    $('#productPreviewName').textContent = $('#addProductName').value || 'Product preview';
    $('#productFetchPreview').classList.remove('hidden');
  });
  $('#getProductDetails').addEventListener('click', async () => {
    const url = $('#addProductUrl').value.trim();
    if (!url) return;
    const button = $('#getProductDetails');
    button.disabled = true;
    button.textContent = 'Getting details…';
    $('#productFetchStatus').textContent = 'Reading the product page…';
    $('#productFetchStatus').classList.remove('error');
    revealAddFields();
    try {
      const response = await fetch('./api/product-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const product = await response.json();
      if (!response.ok) throw new Error(product.error || 'Product details unavailable.');
      if (product.name) $('#addProductName').value = product.name;
      if (product.price !== null && product.price !== undefined) $('#addProductPrice').value = product.price;
      if (product.image) {
        $('#addProductImage').value = product.image;
        $('#productPreviewImage').src = product.image;
        $('#productPreviewName').textContent = product.name || 'Product preview';
        $('#productFetchPreview').classList.remove('hidden');
      }
      $('#productFetchStatus').textContent = 'Details added. Check and edit anything before saving.';
    } catch (error) {
      const fallbackText = /manually/i.test(error.message) ? '' : ' You can still add it manually.';
      $('#productFetchStatus').textContent = `${error.message}${fallbackText}`;
      $('#productFetchStatus').classList.add('error');
    } finally {
      button.disabled = false;
      button.textContent = 'Get product details';
    }
  });
  $('#addCollectionSelect').addEventListener('change', () => {
    const creating = $('#addCollectionSelect').value === '__new__';
    $('#newCollectionLabel').classList.toggle('hidden', !creating);
    $('#newCollectionName').required = creating;
  });
  $('#addForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const favorite = fd.get('favorite') === 'on';
    let collectionId = fd.get('collectionId') || null;
    if (collectionId === '__new__') {
      const collectionName = fd.get('newCollectionName').trim();
      collectionId = `${collectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'collection'}-${Date.now()}`;
      collections.push({ id: collectionId, name: collectionName, description: 'A new collection to shape over time.' });
      refreshCollectionSelects();
      collectionFilterUi.refresh();
      addCollectionUi.refresh();
    }
    items.unshift({ id: Date.now(), name: fd.get('name'), image: fd.get('image') || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80', productUrl: fd.get('productUrl'), price: Number(fd.get('price')), originalPrice: Number(fd.get('originalPrice')) || null, addedAt: new Date().toISOString(), wantCount: 1, status: 'waiting', collectionId, favorite, favoriteCount: favorite ? 1 : 0, note: fd.get('note') });
    persistWishlistState();
    resetAddExperience();
    addCollectionUi.refresh();
    $('#addModal').classList.remove('open');
    $('#newCollectionLabel').classList.add('hidden');
    render(); renderCollections(); updateJourney();
    if (document.body.classList.contains('collection-open') && currentCollectionId === collectionId) openCollection(currentCollectionId, false);
    toast('Added to your waiting room.');
  });

  function openEditProduct(id) {
    const item = allItems().find(x => x.id === id);
    const options = `<option value="">No collection</option>${collections.map(collection => `<option value="${collection.id}" ${collection.id === item.collectionId ? 'selected' : ''}>${collection.name}</option>`).join('')}`;
    $('#editContent').innerHTML = `<button class="icon-button close" id="closeEdit" aria-label="Close">×</button><p class="eyebrow">Edit record</p><h2>${escapeHtml(item.name)}</h2><form class="form-grid edit-record-form" id="editRecordForm"><label class="full">Product name<input name="name" value="${escapeHtml(item.name)}" required></label><label>Price<input name="price" type="number" min="0" step="0.01" value="${item.price}" required></label><label>Original price<input name="originalPrice" type="number" min="0" step="0.01" value="${item.originalPrice || ''}"></label><label class="full">Collection <span class="optional">Optional</span><select name="collectionId">${options}</select></label><label class="full">Product URL <span class="optional">Optional</span><input name="productUrl" type="url" value="${escapeHtml(item.productUrl || '')}" placeholder="https://"></label><label class="full">Image URL <span class="optional">Optional</span><input name="image" type="url" value="${escapeHtml(item.image || '')}"></label><label class="favorite-check full"><input name="favorite" type="checkbox" ${item.favorite ? 'checked' : ''}> Favorite</label><label class="full">Note <span class="optional">Optional</span><textarea name="note" rows="3">${escapeHtml(item.note || '')}</textarea></label><button class="button full" type="submit">Save changes</button></form>`;
    $('#editModal').classList.add('open');
    $('#closeEdit').onclick = () => $('#editModal').classList.remove('open');
    $('#editRecordForm').onsubmit = event => {
      event.preventDefault();
      const viewingCollection = document.body.classList.contains('collection-open') ? location.hash.replace('#collection-', '') : null;
      const data = new FormData(event.target);
      item.name = data.get('name');
      item.price = Number(data.get('price'));
      item.originalPrice = Number(data.get('originalPrice')) || null;
      item.collectionId = data.get('collectionId') || null;
      item.productUrl = data.get('productUrl');
      item.image = data.get('image') || item.image;
      item.favorite = data.get('favorite') === 'on';
      item.favoriteCount = item.favorite ? 1 : 0;
      item.note = data.get('note');
      persistWishlistState();
      $('#editModal').classList.remove('open');
      render(); renderCollections();
      if (viewingCollection) openCollection(viewingCollection, false);
      toast('Record updated.');
    };
  }

  function openProduct(id) {
    const item = allItems().find(x => x.id === id);
    const modal = $('#detailModal');
    const collection = collections.find(x => x.id === item.collectionId);
    const wishlistDays = item.wishlistDays ?? daysSince(item.addedAt || item.date);
    const productLink = item.productUrl ? `<a class="open-product-button" href="${item.productUrl}" target="_blank" rel="noopener">Open Product ↗</a>` : '';
    const statusContent = item.status === 'bought'
      ? `<div class="outcome-record bought-record"><span>Purchase record</span><strong>Waited ${wishlistDays} days, then bought it.</strong><small>${item.date || 'Recently purchased'}</small></div><section class="purchase-review"><div class="review-heading"><div><span>Shopping satisfaction</span><h3>Your experience</h3></div>${starsTemplate(item.satisfaction || 0, true, item.id)}</div>${item.reflection ? `<div class="comment-display" id="commentDisplay"><p>${escapeHtml(item.reflection)}</p><button class="button ghost" id="editComment">Edit comment</button></div>` : ''}<form class="experience-form ${item.reflection ? '' : 'open'}" id="experienceForm"><label>Comment<textarea id="experienceComment" rows="3" placeholder="How did this purchase feel?">${escapeHtml(item.reflection || '')}</textarea></label><button class="button secondary" type="submit">${item.reflection ? 'Update experience' : 'Save experience'}</button></form></section><div class="detail-edit-row"><button class="detail-edit-button" id="editRecordFromDetail">✎ Edit record</button></div>`
      : item.status === 'letGo'
        ? `<div class="outcome-record letgo-record"><span>Let-go record</span><strong>You waited ${wishlistDays} days, then let it go.</strong><small>${formatMoney(item.saved || item.price)} stayed with you</small></div><div class="modal-actions"><button class="button secondary" id="restoreWish">Restore to wishlist</button><button class="detail-edit-button" id="editRecordFromDetail">✎ Edit</button></div>`
        : `${item.note ? `<div class="detail-note"><span>Note</span><p>${item.note}</p></div>` : ''}<p class="detail-meta">${wishlistDays} days in your wishlist · liked ${item.wantCount || 0} times</p><div class="modal-actions"><button class="button" id="wantAgain">Like again</button><button class="button secondary" id="markBought">Bought</button><button class="button ghost" id="letGo">Let go</button><button class="detail-edit-button" id="editRecordFromDetail" aria-label="Edit record">✎</button></div>`;
    $('#detailContent').innerHTML = `<button class="icon-button close detail-close" id="closeDetail" aria-label="Close">×</button><div class="detail-image-stage"><img src="${item.image}" alt="${item.name}"></div><div class="detail-secondary"><div class="detail-heading"><div>${collection ? `<span class="collection-label">${collection.name}</span>` : ''}<h2>${item.name}</h2></div><button class="detail-favorite ${item.favorite ? 'on' : ''}" id="toggleFavorite" aria-label="Toggle favorite">${item.favorite ? '♥' : '♡'}</button></div><div class="detail-commerce-row"><div class="price-row"><span class="price">${formatMoney(item.price)}</span>${item.originalPrice ? `<span class="original-price">${formatMoney(item.originalPrice)}</span>` : ''}</div>${productLink}</div>${statusContent}</div>`;
    modal.classList.add('open');
    $('#closeDetail').onclick = () => modal.classList.remove('open');
    $('#toggleFavorite').onclick = () => { item.favorite = !item.favorite; item.favoriteCount = item.favorite ? 1 : 0; persistWishlistState(); render(); renderCollections(); modal.classList.remove('open'); openProduct(id); };
    $('#editRecordFromDetail').onclick = () => { modal.classList.remove('open'); openEditProduct(id); };
    if (item.status === 'waiting') {
      $('#wantAgain').onclick = () => { item.wantCount = (item.wantCount || 0) + 1; persistWishlistState(); render(); updateJourney(); modal.classList.remove('open'); toast('Your interest was recorded.'); };
      $('#markBought').onclick = () => {
        moveToHistory(item, 'bought'); item.wishlistDays = wishlistDays; item.date = new Date().toISOString().slice(0, 10);
        persistWishlistState();
        render(); modal.classList.remove('open');
        openSavingsTransaction({ mode: 'subtract', amount: item.price, item, optional: true });
      };
      $('#letGo').onclick = () => {
        moveToHistory(item, 'letGo');
        item.wishlistDays = wishlistDays;
        item.date = new Date().toISOString().slice(0, 10);
        item.saved = item.price;
        persistWishlistState();
        render(); modal.classList.remove('open');
        openSavingsTransaction({ mode: 'add', amount: item.price, item, optional: true });
      };
    } else if (item.status === 'bought') {
      $$('.stars.interactive button', modal).forEach(button => button.onclick = () => {
        item.satisfaction = Number(button.dataset.rating);
        persistWishlistState();
        modal.classList.remove('open'); openProduct(id); toast('Satisfaction updated.');
      });
      $('#editComment')?.addEventListener('click', () => {
        $('#commentDisplay').classList.add('hidden');
        $('#experienceForm').classList.add('open');
        $('#experienceComment').focus();
      });
      $('#experienceForm').addEventListener('submit', event => {
        event.preventDefault();
        item.reflection = $('#experienceComment').value.trim();
        persistWishlistState();
        modal.classList.remove('open');
        toast('Shopping experience saved.');
      });
    } else {
      $('#restoreWish').onclick = () => {
        const historyIndex = historyItems.indexOf(item);
        if (historyIndex >= 0) historyItems.splice(historyIndex, 1);
        if (!items.includes(item)) items.unshift(item);
        item.status = 'waiting';
        item.addedAt = new Date(Date.now() - wishlistDays * 86400000).toISOString();
        if (item.ultimateSavedTransaction) {
          const bucket = ultimateBuckets.find(entry => entry.id === item.ultimateSavedTransaction.bucketId);
          if (bucket) bucket.points = Math.max(0, bucket.points - item.ultimateSavedTransaction.amount);
          item.ultimateSavedTransaction = null;
          renderUltimateBuckets();
        }
        persistWishlistState();
        render(); renderCollections(); updateJourney();
        modal.classList.remove('open'); toast('Restored to your wishlist.');
      };
    }
  }

  function showPanel(name) {
    document.body.classList.remove('collection-open');
    $('#collectionPage').classList.remove('active');
    $('#v2Panels').classList.remove('hidden');
    $$('.v2-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.panel === name));
    $$('.v2-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panelView === name));
  }
  $$('.v2-tab').forEach(tab => tab.addEventListener('click', () => showPanel(tab.dataset.panel)));
  if (location.hash === '#ultimate') showPanel('ultimate');
  $$('[data-go-panel]').forEach(button => button.addEventListener('click', () => showPanel(button.dataset.goPanel)));
  let touchStart = 0;
  $('#v2Panels').addEventListener('touchstart', event => { touchStart = event.changedTouches[0].clientX; }, { passive: true });
  $('#v2Panels').addEventListener('touchend', event => {
    const distance = event.changedTouches[0].clientX - touchStart;
    if (Math.abs(distance) < 60) return;
    const order = ['home', 'wishlist', 'ultimate'];
    const current = order.findIndex(name => $(`[data-panel-view="${name}"]`).classList.contains('active'));
    showPanel(order[Math.max(0, Math.min(2, current + (distance < 0 ? 1 : -1)))]);
  }, { passive: true });

  $('#quickAdd').addEventListener('click', () => {
    const open = !$('#quickAddMenu').classList.contains('open');
    closeQuickAdd();
    if (open) {
      $('#quickAddMenu').classList.add('open');
      $('#quickAddBackdrop').classList.add('open');
      $('#quickAdd').classList.add('open');
    }
  });
  $('#quickAddBackdrop').addEventListener('click', closeQuickAdd);
  $('[data-add="wishlist"]').addEventListener('click', () => openAddModal());
  $('[data-add="collection"]').addEventListener('click', () => { closeQuickAdd(); openCollectionBuilder('create'); });
  $('[data-add="ultimate"]').addEventListener('click', () => { closeQuickAdd(); $('#ultimateBuilderModal').classList.add('open'); });
  if (location.hash === '#add') {
    $('#quickAddMenu').classList.add('open');
    $('#quickAddBackdrop').classList.add('open');
    $('#quickAdd').classList.add('open');
  }

  let collectionBuilderMode = 'create';
  let editingCollectionId = null;
  let currentCollectionId = null;
  let selectedWishIds = new Set();
  let collectionSelectMode = false;
  let selectedCollectionItemIds = new Set();
  $('#targetCollectionSelect').innerHTML = collections.map(collection => `<option value="${collection.id}">${collection.name}</option>`).join('');
  const targetCollectionUi = enhanceSelect($('#targetCollectionSelect'));

  const collectionPickerItems = () => collectionBuilderMode === 'remove'
    ? items.filter(item => item.collectionId === editingCollectionId)
    : items;

  function renderCollectionPicker() {
    const pickerItems = collectionPickerItems();
    $('#collectionPickerGrid').innerHTML = pickerItems.length ? pickerItems.map(item => `<label class="collection-pick ${selectedWishIds.has(item.id) ? 'selected' : ''}">
      <input type="checkbox" value="${item.id}" ${selectedWishIds.has(item.id) ? 'checked' : ''}>
      <img src="${item.image}" alt=""><span class="pick-check">✓</span>
    </label>`).join('') : '<div class="empty-state"><span>○</span><h3>No items</h3></div>';
    $('#selectionCount').textContent = `${selectedWishIds.size} selected`;
    $$('.collection-pick input', $('#collectionPickerGrid')).forEach(input => input.addEventListener('change', () => {
      const id = Number(input.value);
      input.checked ? selectedWishIds.add(id) : selectedWishIds.delete(id);
      input.closest('.collection-pick').classList.toggle('selected', input.checked);
      $('#selectionCount').textContent = `${selectedWishIds.size} selected`;
    }));
  }

  function openCollectionBuilder(mode, initialId = null, collectionId = null) {
    collectionBuilderMode = mode;
    editingCollectionId = mode === 'edit' || mode === 'remove' ? collectionId : null;
    selectedWishIds = mode === 'edit'
      ? new Set(items.filter(item => item.collectionId === collectionId).map(item => item.id))
      : new Set(initialId ? [initialId] : []);
    const creating = mode === 'create';
    const editing = mode === 'edit';
    const removing = mode === 'remove';
    $('#collectionCreateFields').classList.toggle('hidden', !creating);
    $('#collectionTargetField').classList.toggle('hidden', creating || editing || removing);
    $('#collectionName').required = creating;
    $('#collectionBuilderTitle').textContent = creating ? 'New collection' : removing ? 'Remove items' : editing ? 'Manage items' : 'Add items';
    $('#collectionPickerLabel').textContent = removing ? 'Select items to remove' : 'Choose items';
    $('#saveCollectionBuilder').textContent = creating ? 'Create collection' : removing ? 'Remove selected' : editing ? 'Save items' : 'Add selected';
    $('#targetCollectionSelect').innerHTML = collections.map(collection => `<option value="${collection.id}">${collection.name}</option>`).join('');
    if (!creating && !editing && !removing && collectionId) $('#targetCollectionSelect').value = collectionId;
    targetCollectionUi.refresh();
    renderCollectionPicker();
    $('#collectionBuilderModal').classList.add('open');
  }

  function deleteWish(id) {
    const item = allItems().find(entry => entry.id === id);
    if (!item || !confirm(`Delete “${item.name}” permanently?`)) return;
    const source = items.includes(item) ? items : historyItems;
    source.splice(source.indexOf(item), 1);
    persistWishlistState();
    render(); renderCollections(); updateJourney();
    toast('Record deleted.');
  }

  $('#closeCollectionBuilder').onclick = () => $('#collectionBuilderModal').classList.remove('open');
  $('#selectAllWishes').onclick = () => {
    const pickerItems = collectionPickerItems();
    selectedWishIds = selectedWishIds.size === pickerItems.length ? new Set() : new Set(pickerItems.map(item => item.id));
    renderCollectionPicker();
  };
  $('#collectionBuilderForm').onsubmit = event => {
    event.preventDefault();
    const data = new FormData(event.target);
    let collectionId = data.get('targetCollection');
    if (collectionBuilderMode === 'create') {
      const name = data.get('collectionName').trim();
      collectionId = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'collection'}-${Date.now()}`;
      collections.push({ id: collectionId, name, description: data.get('collectionDescription').trim() || 'A collection to shape over time.' });
      refreshCollectionSelects();
      collectionFilterUi.refresh();
      addCollectionUi.refresh();
    }
    if (collectionBuilderMode === 'remove') {
      collectionId = editingCollectionId;
      items.forEach(item => {
        if (selectedWishIds.has(item.id) && item.collectionId === collectionId) item.collectionId = null;
      });
    } else if (collectionBuilderMode === 'edit') {
      collectionId = editingCollectionId;
      items.forEach(item => {
        if (selectedWishIds.has(item.id)) item.collectionId = collectionId;
        else if (item.collectionId === collectionId) item.collectionId = null;
      });
    } else {
      items.forEach(item => { if (selectedWishIds.has(item.id)) item.collectionId = collectionId; });
    }
    event.target.reset();
    $('#collectionBuilderModal').classList.remove('open');
    render(); renderCollections(); updateJourney();
    persistWishlistState();
    if (collectionBuilderMode === 'edit' || collectionBuilderMode === 'remove') openCollection(collectionId, false);
    toast(collectionBuilderMode === 'create' ? 'Collection created.' : collectionBuilderMode === 'remove' ? 'Items removed from collection.' : collectionBuilderMode === 'edit' ? 'Collection items updated.' : 'Items added to collection.');
  };
  const renderUltimateBuckets = () => {
    const total = ultimateBuckets.reduce((sum, bucket) => sum + bucket.points, 0);
    $('#ultimateTotalSaved').textContent = formatMoney(total);
    $('#ultimateBucketCount').textContent = `${ultimateBuckets.length} goals`;
    $('#ultimateBucketGrid').innerHTML = ultimateBuckets.map(bucket => {
      const percent = Math.min(100, Math.round(bucket.points / bucket.target * 100));
      const progress = `<div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div><div class="goal-values"><strong>${formatMoney(bucket.points)} saved</strong><span>${formatMoney(bucket.target)} goal</span></div>`;
      return `<article class="ultimate-bucket-card" data-bucket-id="${bucket.id}"><div class="bucket-card-heading"><div><span class="bucket-type">Goal</span><h2>${escapeHtml(bucket.name)}</h2></div><strong>${percent}%</strong></div>${bucket.description ? `<p>${escapeHtml(bucket.description)}</p>` : ''}${progress}<div class="bucket-actions"><button class="button secondary bucket-add-savings" data-bucket-id="${bucket.id}">＋ Add</button><button class="button ghost bucket-subtract-savings" data-bucket-id="${bucket.id}">− Subtract</button></div></article>`;
    }).join('');
    $$('.bucket-add-savings', $('#ultimateBucketGrid')).forEach(button => button.addEventListener('click', () => {
      openSavingsTransaction({ mode: 'add', bucketId: button.dataset.bucketId });
    }));
    $$('.bucket-subtract-savings', $('#ultimateBucketGrid')).forEach(button => button.addEventListener('click', () => {
      openSavingsTransaction({ mode: 'subtract', bucketId: button.dataset.bucketId });
    }));
  };
  const closeSavingsTransaction = () => {
    $('#savingsModal').classList.remove('open');
    $('#savingsForm').reset();
    pendingSavingsItem = null;
  };
  function openSavingsTransaction({ mode, bucketId = null, amount = '', item = null, optional = false }) {
    savingsTransactionMode = mode;
    pendingSavingsItem = item;
    activeSavingsBucketId = bucketId || ultimateBuckets[0]?.id;
    $('#savingsBucketSelect').value = activeSavingsBucketId;
    savingsBucketUi.refresh();
    $('#savingsAmount').value = amount || '';
    $('#savingsModalTitle').textContent = item ? (mode === 'add' ? 'Add let-go savings' : 'Deduct this purchase?') : (mode === 'add' ? 'Add savings' : 'Subtract savings');
    $('#saveSavingsTransaction').textContent = mode === 'add' ? 'Add savings' : 'Subtract';
    $('#skipSavingsTransaction').classList.toggle('hidden', !optional);
    $('#savingsModal').classList.add('open');
  }
  $('#closeUltimateBuilder').onclick = () => $('#ultimateBuilderModal').classList.remove('open');
  $('#addUltimateFromPage').onclick = () => $('#ultimateBuilderModal').classList.add('open');
  $('#ultimateBuilderForm').onsubmit = event => {
    event.preventDefault();
    const data = new FormData(event.target);
    const name = data.get('name').trim();
    ultimateBuckets.push({ id: `goal-${Date.now()}`, name, description: data.get('description').trim(), target: Number(data.get('target')), points: 0 });
    refreshSavingsBucketSelect();
    persistWishlistState();
    renderUltimateBuckets();
    event.target.reset();
    $('#ultimateBuilderModal').classList.remove('open');
    showPanel('ultimate');
    toast(`${name} added.`);
  };
  $('#closeSavingsModal').onclick = closeSavingsTransaction;
  $('#skipSavingsTransaction').onclick = () => {
    const message = savingsTransactionMode === 'add' ? 'Let go saved without adding money.' : 'Purchase saved without changing your goals.';
    closeSavingsTransaction(); toast(message);
  };
  $('#savingsForm').onsubmit = event => {
    event.preventDefault();
    const data = new FormData(event.target);
    const amount = Number(data.get('amount'));
    const bucket = ultimateBuckets.find(entry => entry.id === data.get('bucketId'));
    const previous = bucket.points;
    bucket.points = savingsTransactionMode === 'add' ? Math.min(bucket.target, bucket.points + amount) : Math.max(0, bucket.points - amount);
    const changed = Math.abs(bucket.points - previous);
    if (pendingSavingsItem && changed > 0) {
      if (savingsTransactionMode === 'add') pendingSavingsItem.ultimateSavedTransaction = { bucketId: bucket.id, amount: changed };
      else pendingSavingsItem.ultimatePurchaseDeduction = { bucketId: bucket.id, amount: changed };
    }
    persistWishlistState();
    renderUltimateBuckets();
    const verb = savingsTransactionMode === 'add' ? 'added to' : 'subtracted from';
    closeSavingsTransaction();
    toast(changed > 0 ? `${formatMoney(changed)} ${verb} ${bucket.name}.` : savingsTransactionMode === 'add' ? 'This goal is already fully funded.' : 'This bucket is already empty.');
  };
  renderUltimateBuckets();

  function renderCollections() {
    $('#collectionList').innerHTML = collections.map(collection => {
      const collectionItems = allItems().filter(item => item.collectionId === collection.id);
      const images = collectionItems.slice(0, 4).map(item => `<img src="${item.image}" alt="">`).join('');
      return `<button class="collection-preview preview-pop" data-collection="${collection.id}"><span class="collection-collage">${images || '<span class="collection-empty">+</span>'}</span><span class="collection-preview-meta"><strong>${collection.name}</strong><small>${collectionItems.length} items</small></span></button>`;
    }).join('');
    $$('.collection-preview').forEach(button => button.addEventListener('click', () => openCollection(button.dataset.collection)));
  }

  function openCollection(id, pushState = true) {
    const collection = collections.find(item => item.id === id);
    currentCollectionId = id;
    const collectionItems = allItems().filter(item => item.collectionId === id);
    $('#collectionPageName').textContent = collection.name;
    $('#collectionPageDescription').textContent = collection.description;
    $('#collectionPageCount').textContent = `${collectionItems.length} ${collectionItems.length === 1 ? 'item' : 'items'}`;
    $('#collectionPageGrid').innerHTML = collectionItems.map(item => `<article class="product-card visual-card reveal-card collection-select-card ${collectionSelectMode ? 'select-mode' : ''} ${selectedCollectionItemIds.has(item.id) ? 'selected' : ''}" data-id="${item.id}" tabindex="0" role="button" aria-label="${collectionSelectMode ? 'Select' : 'Open'} ${escapeHtml(item.name)}">
      <div class="product-image-wrap"><img src="${item.image}" alt="">${item.favorite ? '<span class="favorite-badge" aria-label="Favorite">♥</span>' : ''}<span class="product-hover-meta"><strong>${escapeHtml(item.name)}</strong><small>${formatMoney(item.price ?? item.saved)}</small></span>${collectionSelectMode ? `<span class="collection-select-check" aria-hidden="true">${selectedCollectionItemIds.has(item.id) ? '✓' : ''}</span>` : ''}</div>
    </article>`).join('');
    $('#collectionSelectionBar').classList.toggle('hidden', !collectionSelectMode);
    $('#editCollection').classList.toggle('active', collectionSelectMode);
    $('#editCollection').innerHTML = collectionSelectMode ? '<span>×</span> Done' : '<span>✓</span> Select';
    const updateSelectionBar = () => {
      $('#collectionSelectedCount').textContent = `${selectedCollectionItemIds.size} selected`;
      $('#removeSelectedFromCollection').disabled = selectedCollectionItemIds.size === 0;
    };
    updateSelectionBar();
    $('#v2Panels').classList.add('hidden');
    $('#collectionPage').classList.add('active');
    document.body.classList.add('collection-open');
    $$('.product-card', $('#collectionPageGrid')).forEach(card => {
      card.addEventListener('click', () => {
        const itemId = Number(card.dataset.id);
        if (!collectionSelectMode) return openProduct(itemId);
        selectedCollectionItemIds.has(itemId) ? selectedCollectionItemIds.delete(itemId) : selectedCollectionItemIds.add(itemId);
        card.classList.toggle('selected', selectedCollectionItemIds.has(itemId));
        $('.collection-select-check', card).textContent = selectedCollectionItemIds.has(itemId) ? '✓' : '';
        updateSelectionBar();
      });
      card.addEventListener('keydown', event => {
        if (event.target !== card) return;
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); card.click(); }
      });
    });
    revealCards($('#collectionPageGrid'));
    if (pushState) history.pushState({ collectionId: id }, '', `#collection-${id}`);
    scrollTo({ top: 0, behavior: 'smooth' });
  }
  const closeCollectionPage = () => {
    collectionSelectMode = false;
    selectedCollectionItemIds.clear();
    document.body.classList.remove('collection-open');
    $('#collectionPage').classList.remove('active');
    $('#v2Panels').classList.remove('hidden');
    showPanel('home');
    scrollTo({ top: 0, behavior: 'smooth' });
  };
  $('#collectionBack').addEventListener('click', () => {
    if (location.hash.startsWith('#collection-')) history.back();
    else closeCollectionPage();
  });
  $('#editCollection').addEventListener('click', () => {
    if (!currentCollectionId) return;
    collectionSelectMode = !collectionSelectMode;
    selectedCollectionItemIds.clear();
    openCollection(currentCollectionId, false);
  });
  $('#cancelCollectionSelection').addEventListener('click', () => {
    collectionSelectMode = false;
    selectedCollectionItemIds.clear();
    openCollection(currentCollectionId, false);
  });
  $('#removeSelectedFromCollection').addEventListener('click', () => {
    if (!selectedCollectionItemIds.size) return;
    allItems().forEach(item => {
      if (selectedCollectionItemIds.has(item.id) && item.collectionId === currentCollectionId) item.collectionId = null;
    });
    persistWishlistState();
    const removedCount = selectedCollectionItemIds.size;
    collectionSelectMode = false;
    selectedCollectionItemIds.clear();
    render(); renderCollections(); updateJourney(); openCollection(currentCollectionId, false);
    toast(`${removedCount} ${removedCount === 1 ? 'item' : 'items'} removed from collection.`);
  });
  $('#addToCollection').addEventListener('click', () => {
    if (currentCollectionId) $('#collectionAddModal').classList.add('open');
  });
  $('#closeCollectionAdd').addEventListener('click', () => $('#collectionAddModal').classList.remove('open'));
  $('#addNewWishToCollection').addEventListener('click', () => {
    $('#collectionAddModal').classList.remove('open');
    openAddModal(currentCollectionId);
  });
  $('#chooseExistingForCollection').addEventListener('click', () => {
    $('#collectionAddModal').classList.remove('open');
    openCollectionBuilder('add', null, currentCollectionId);
  });
  addEventListener('popstate', () => {
    if (!location.hash.startsWith('#collection-')) closeCollectionPage();
  });

  function updateJourney() {
    $('#journeyItems').textContent = items.length;
    $('#journeyLists').textContent = collections.length;
    $('#journeyLikes').textContent = items.reduce((sum, item) => sum + (item.wantCount || 0), 0);
  }
  renderCollections();
  updateJourney();
}

function initHistory() {
  const list = $('#historyList');
  if (!list) return;
  let active = 'bought';
  const historyItems = { bought: WAITLIST_MOCK.bought, letGo: WAITLIST_MOCK.letGo };
  const persistHistoryState = () => {
    WAITLIST_MOCK.bought = historyItems.bought;
    WAITLIST_MOCK.letGo = historyItems.letGo;
    persistData();
  };
  const historyOutcomeUi = enhanceStandaloneSelect($('#historyOutcome'));
  const render = () => {
    const items = historyItems[active];
    list.innerHTML = items.map(item => {
      const wishlistDays = item.wishlistDays ?? (item.addedAt ? daysSince(item.addedAt) : 0);
      const wantCount = item.wantCount ?? 0;
      const outcome = active === 'bought' ? 'Purchased' : 'Let go';
      return `<article class="history-row" data-id="${item.id}"><img src="${item.image}" alt="${item.name}"><div class="history-row-main"><div class="history-row-heading"><div><span class="outcome-pill ${active}">${outcome}</span><h3>${item.name}</h3></div><span class="price">${formatMoney(item.price || item.saved)}</span></div><div class="history-journey"><span><strong>${wishlistDays}</strong> days in wishlist</span><span><strong>${wantCount}</strong> likes</span><span><strong>${outcome}</strong> in the end</span></div><div class="history-row-footer">${active === 'bought' ? starsTemplate(item.satisfaction) : '<span class="saved-label">Stayed in your pocket</span>'}<span>${item.date || 'Recently'} · View details →</span></div></div></article>`;
    }).join('');
    $$('.history-row', list).forEach(card => card.addEventListener('click', () => openHistoryItem(Number(card.dataset.id))));
  };
  render();
  $$('.history-tab').forEach(btn => btn.addEventListener('click', () => {
    $$('.history-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); active = btn.dataset.tab; render();
  }));
  $('#openHistoryAdd').addEventListener('click', () => $('#historyAddModal').classList.add('open'));
  $('#closeHistoryAdd').addEventListener('click', () => $('#historyAddModal').classList.remove('open'));
  if (location.hash === '#add') $('#historyAddModal').classList.add('open');
  $('#historyAddForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const status = fd.get('status');
    const price = Number(fd.get('price'));
    historyItems[status].unshift({
      id: Date.now(), name: fd.get('name'), status, price, saved: price,
      image: fd.get('image') || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
      productUrl: fd.get('productUrl'), date: new Date().toISOString().slice(0, 10),
      collectionId: null, favorite: false, favoriteCount: 0,
      wishlistDays: fd.get('wishlistDays') === '' ? null : Number(fd.get('wishlistDays')),
      wantCount: fd.get('wantCount') === '' ? null : Number(fd.get('wantCount')),
      satisfaction: Number(fd.get('satisfaction')) || 0, reflection: fd.get('reflection')
    });
    persistHistoryState();
    active = status;
    $$('.history-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === active));
    e.target.reset(); historyOutcomeUi.refresh(); $('#historyAddModal').classList.remove('open'); render(); toast('Added to your history.');
  });

  function openHistoryItem(id) {
    const item = [...historyItems.bought, ...historyItems.letGo].find(x => x.id === id);
    const modal = $('#historyDetailModal');
    const bought = item.status === 'bought';
    const wishlistDays = item.wishlistDays ?? 0;
    const productLink = item.productUrl ? `<a class="open-product-button" href="${item.productUrl}" target="_blank" rel="noopener">Open Product ↗</a>` : '';
    const outcomeContent = bought
      ? `<div class="outcome-record bought-record"><span>Purchase record</span><strong>Waited ${wishlistDays} days, then bought it.</strong><small>${item.date || 'Recently purchased'}</small></div><section class="purchase-review"><div class="review-heading"><div><span>Shopping satisfaction</span><h3>Your experience</h3></div>${starsTemplate(item.satisfaction || 0, true, item.id)}</div>${item.reflection ? `<div class="comment-display" id="historyCommentDisplay"><p>${escapeHtml(item.reflection)}</p><button class="button ghost" id="editHistoryComment">Edit comment</button></div>` : ''}<form class="experience-form ${item.reflection ? '' : 'open'}" id="historyExperienceForm"><label>Comment<textarea id="historyExperienceComment" rows="3" placeholder="How did this purchase feel?">${escapeHtml(item.reflection || '')}</textarea></label><button class="button secondary" type="submit">${item.reflection ? 'Update experience' : 'Save experience'}</button></form></section><div class="detail-edit-row"><button class="detail-edit-button" id="editHistoryRecord">✎ Edit record</button></div>`
      : `<div class="outcome-record letgo-record"><span>Let-go record</span><strong>You waited ${wishlistDays} days, then let it go.</strong><small>${formatMoney(item.saved || item.price)} stayed with you</small></div><div class="modal-actions"><button class="button secondary" id="restoreHistoryWish">Restore to wishlist</button><button class="detail-edit-button" id="editHistoryRecord">✎ Edit</button></div>`;
    $('#historyDetailContent').innerHTML = `<button class="icon-button close detail-close" id="closeHistoryDetail" aria-label="Close">×</button><div class="detail-image-stage"><img src="${item.image}" alt="${escapeHtml(item.name)}"></div><div class="detail-secondary"><div class="detail-heading"><div><span class="collection-label">${bought ? 'Bought' : 'Let go'}</span><h2>${escapeHtml(item.name)}</h2></div><button class="detail-favorite ${item.favorite ? 'on' : ''}" id="toggleHistoryFavorite" aria-label="Toggle favorite">${item.favorite ? '♥' : '♡'}</button></div><div class="detail-commerce-row"><div class="price-row"><span class="price">${formatMoney(item.price || item.saved)}</span></div>${productLink}</div>${outcomeContent}</div>`;
    modal.classList.add('open');
    $('#closeHistoryDetail').onclick = () => modal.classList.remove('open');
    $('#toggleHistoryFavorite').onclick = () => {
      item.favorite = !item.favorite;
      item.favoriteCount = item.favorite ? 1 : 0;
      persistHistoryState();
      modal.classList.remove('open'); openHistoryItem(id);
    };
    $('#editHistoryRecord').onclick = () => openHistoryEdit(item);
    if (bought) {
      $$('.stars.interactive button', modal).forEach(button => button.onclick = () => {
        item.satisfaction = Number(button.dataset.rating);
        persistHistoryState();
        modal.classList.remove('open'); render(); openHistoryItem(id); toast('Satisfaction updated.');
      });
      $('#editHistoryComment')?.addEventListener('click', () => {
        $('#historyCommentDisplay').classList.add('hidden');
        $('#historyExperienceForm').classList.add('open');
        $('#historyExperienceComment').focus();
      });
      $('#historyExperienceForm').onsubmit = event => {
        event.preventDefault();
        item.reflection = $('#historyExperienceComment').value.trim();
        persistHistoryState();
        modal.classList.remove('open');
        render();
        toast('Shopping experience saved.');
      };
    } else {
      $('#restoreHistoryWish').onclick = () => {
        const index = historyItems.letGo.indexOf(item);
        if (index >= 0) historyItems.letGo.splice(index, 1);
        item.status = 'waiting';
        item.addedAt = new Date(Date.now() - wishlistDays * 86400000).toISOString();
        if (item.ultimateSavedTransaction) {
          const bucket = WAITLIST_MOCK.ultimateBuckets.find(entry => entry.id === item.ultimateSavedTransaction.bucketId);
          if (bucket) bucket.points = Math.max(0, bucket.points - item.ultimateSavedTransaction.amount);
          item.ultimateSavedTransaction = null;
        }
        WAITLIST_MOCK.wishlist.unshift(item);
        persistHistoryState();
        modal.classList.remove('open');
        render();
        toast('Restored to your wishlist.');
      };
    }
  }

  function openHistoryEdit(item) {
    const modal = $('#historyDetailModal');
    $('#historyDetailContent').innerHTML = `<button class="icon-button close" id="closeHistoryEdit" aria-label="Close">×</button><p class="eyebrow">Edit record</p><h2>${escapeHtml(item.name)}</h2><form class="form-grid" id="historyEditForm"><label class="full">Product name<input name="name" value="${escapeHtml(item.name)}" required></label><label>Price<input name="price" type="number" min="0" step="0.01" value="${item.price || item.saved}" required></label><label>Days on wishlist<input name="wishlistDays" type="number" min="0" value="${item.wishlistDays ?? ''}"></label><label class="full">Product URL <span class="optional">Optional</span><input name="productUrl" type="url" value="${escapeHtml(item.productUrl || '')}"></label><label class="full">Image URL <span class="optional">Optional</span><input name="image" type="url" value="${escapeHtml(item.image || '')}"></label><label class="full">Shopping review <span class="optional">Optional</span><textarea name="reflection" rows="3">${escapeHtml(item.reflection || '')}</textarea></label><button class="button full" type="submit">Save changes</button></form>`;
    $('#closeHistoryEdit').onclick = () => modal.classList.remove('open');
    $('#historyEditForm').onsubmit = event => {
      event.preventDefault();
      const data = new FormData(event.target);
      item.name = data.get('name').trim();
      item.price = Number(data.get('price'));
      if (item.status === 'letGo') item.saved = item.price;
      item.wishlistDays = data.get('wishlistDays') === '' ? null : Number(data.get('wishlistDays'));
      item.productUrl = data.get('productUrl');
      item.image = data.get('image') || item.image;
      item.reflection = data.get('reflection').trim();
      persistHistoryState();
      modal.classList.remove('open');
      render();
      toast('Record updated.');
    };
  }
}

function initMemory() {
  const shell = $('#memoryShell');
  if (!shell) return;
  const items = WAITLIST_MOCK.wishlist;
  const buckets = WAITLIST_MOCK.ultimateBuckets;
  let index = 0;
  let pendingLetGoItem = null;
  $('#memoryBucketSelect').innerHTML = buckets.map(bucket => `<option value="${bucket.id}">${escapeHtml(bucket.name)}</option>`).join('');
  const memoryBucketUi = enhanceStandaloneSelect($('#memoryBucketSelect'));
  const finishChoice = message => {
    pendingLetGoItem = null;
    $('#memorySavingsModal').classList.remove('open');
    toast(message);
    render();
  };
  const moveMemoryItemToHistory = item => {
    const wishlistDays = daysSince(item.addedAt);
    const sourceIndex = WAITLIST_MOCK.wishlist.indexOf(item);
    if (sourceIndex >= 0) WAITLIST_MOCK.wishlist.splice(sourceIndex, 1);
    item.status = 'letGo';
    item.date = new Date().toISOString().slice(0, 10);
    item.wishlistDays = wishlistDays;
    item.saved = item.price;
    WAITLIST_MOCK.letGo.unshift(item);
    persistData();
  };
  const render = () => {
    if (!items[index]) { shell.innerHTML = '<div class="memory-card"><h2>You’ve checked in with everything.</h2><p>Nothing needs an answer right now.</p><button class="button" onclick="location.reload()">Review again</button></div>'; return; }
    const item = items[index];
    shell.innerHTML = `<div class="memory-card"><img src="${item.image}" alt="${item.name}"><p class="eyebrow">Card ${index+1} of ${items.length}</p><h2>${item.name}</h2><p>${formatMoney(item.price)} · waiting ${daysSince(item.addedAt)} days</p><label><input type="checkbox" id="syncChoice" ${WAITLIST_MOCK.settings?.syncMemoryChoices !== false ? 'checked' : ''}> Update my wishlist with this choice</label><div class="memory-actions"><button data-choice="want" class="want">Want</button><button data-choice="neutral">Neutral</button><button data-choice="letgo">Let go</button></div><div class="progress-dots">${items.map((_,i)=>`<span class="${i===index?'active':''}"></span>`).join('')}</div></div>`;
    $$('[data-choice]', shell).forEach(btn => btn.addEventListener('click', () => {
      const sync = $('#syncChoice').checked;
      if (sync && btn.dataset.choice === 'want') {
        item.wantCount = (item.wantCount || 0) + 1;
        persistData();
      }
      if (sync && btn.dataset.choice === 'letgo') {
        pendingLetGoItem = item;
        moveMemoryItemToHistory(item);
        $('#memorySavingsAmount').value = item.price;
        memoryBucketUi.refresh();
        $('#memorySavingsModal').classList.add('open');
        return;
      }
      index += 1;
      toast(btn.dataset.choice === 'want' ? 'Still wanted. That matters.' : 'No change recorded.');
      render();
    }));
  };
  const skipMemorySavings = () => finishChoice('Moved to history without adding savings.');
  $('#skipMemorySavings').onclick = skipMemorySavings;
  $('#closeMemorySavings').onclick = skipMemorySavings;
  $('#memorySavingsForm').onsubmit = event => {
    event.preventDefault();
    const data = new FormData(event.target);
    const bucket = buckets.find(entry => entry.id === data.get('bucketId'));
    const amount = Number(data.get('amount'));
    const previous = bucket.points;
    bucket.points = Math.min(bucket.target, bucket.points + amount);
    const added = bucket.points - previous;
    if (pendingLetGoItem && added > 0) pendingLetGoItem.ultimateSavedTransaction = { bucketId: bucket.id, amount: added };
    persistData();
    finishChoice(added > 0 ? `${formatMoney(added)} added to ${bucket.name}.` : 'Moved to history. This goal is already full.');
  };
  render();
}

function initUltimate() {
  const goal = WAITLIST_MOCK.ultimate;
  const update = () => {
    $('#goalName').textContent = goal.name;
    $('#goalDescription').textContent = goal.description;
    $('#goalProgress').style.width = `${Math.min(100, goal.points/goal.target*100)}%`;
    $('#goalNumbers').textContent = `$${goal.points} of $${goal.target}`;
    $('#goalPercent').textContent = `${Math.round(goal.points/goal.target*100)}%`;
  };
  if (!$('#goalProgress')) return;
  update();
  $('#addPoints').addEventListener('click', () => { goal.points = Math.min(goal.target, goal.points + 25); update(); toast('$25 moved toward what matters more.'); });
  $('#editGoal').addEventListener('click', () => $('#goalModal').classList.add('open'));
  $('#closeGoal').addEventListener('click', () => $('#goalModal').classList.remove('open'));
  $('#goalForm').addEventListener('submit', e => { e.preventDefault(); const fd = new FormData(e.target); goal.name = fd.get('name'); goal.description = fd.get('description'); goal.target = Number(fd.get('target')); $('#goalModal').classList.remove('open'); update(); toast('Ultimate wish updated.'); });
}

function initAccount() {
  if (!$('#saveAccount')) return;
  const settings = WAITLIST_MOCK.settings;
  const controls = {
    defaultWaitDays: $('#settingDefaultWait'),
    syncMemoryChoices: $('#settingSyncMemory'),
    gentleReminders: $('#settingReminders')
  };
  const setToggle = (button, enabled) => {
    button.classList.toggle('on', enabled);
    button.setAttribute('aria-pressed', String(enabled));
  };
  setToggle(controls.defaultWaitDays, settings.defaultWaitDays === 30);
  setToggle(controls.syncMemoryChoices, settings.syncMemoryChoices !== false);
  setToggle(controls.gentleReminders, settings.gentleReminders === true);
  $('#settingCurrency').value = settings.currency || 'USD';
  Object.values(controls).forEach(button => button.addEventListener('click', () => setToggle(button, !button.classList.contains('on'))));

  const reviewed = WAITLIST_MOCK.bought.length + WAITLIST_MOCK.letGo.length;
  const saved = WAITLIST_MOCK.ultimateBuckets.reduce((sum, bucket) => sum + bucket.points, 0);
  const ratings = WAITLIST_MOCK.bought.map(item => Number(item.satisfaction)).filter(Boolean);
  const satisfaction = ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null;
  $('#accountReviewed').textContent = reviewed;
  $('#accountSaved').textContent = formatMoney(saved);
  $('#accountSatisfaction').textContent = satisfaction ? `${satisfaction.toFixed(1)}/5` : '—';

  $('#saveAccount').addEventListener('click', () => {
    settings.defaultWaitDays = controls.defaultWaitDays.classList.contains('on') ? 30 : 0;
    settings.syncMemoryChoices = controls.syncMemoryChoices.classList.contains('on');
    settings.gentleReminders = controls.gentleReminders.classList.contains('on');
    settings.currency = $('#settingCurrency').value;
    persistData();
    $('#accountSaved').textContent = formatMoney(saved);
    toast('Preferences saved on this device.');
  });

  $('#exportLocalData').addEventListener('click', () => {
    const blob = new Blob([WAITLIST_STORE.exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `waitlist-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast('Backup exported.');
  });
  $('#importLocalData').addEventListener('click', () => $('#importLocalDataFile').click());
  $('#importLocalDataFile').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      WAITLIST_STORE.importData(await file.text());
      toast('Backup imported. Reloading…');
      setTimeout(() => location.reload(), 500);
    } catch (error) {
      toast('This backup file could not be imported.');
    }
  });
  $('#resetLocalData').addEventListener('click', () => {
    if (!confirm('Reset all local Waitlist data on this device?')) return;
    WAITLIST_STORE.reset();
    location.reload();
  });
}

function setupPwa() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    const register = () => navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    document.readyState === 'complete' ? register() : addEventListener('load', register, { once: true });
  }
  let installPrompt = null;
  addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    $('#installPwa')?.classList.remove('hidden');
  });
  $('#installPwa')?.addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    $('#installPwa').classList.add('hidden');
  });
}

(async function boot(){
  setupPwa();
  await Promise.all([loadPartial('#header-root', 'partials/header.html'), loadPartial('#footer-root', 'partials/footer.html')]);
  ensureQuickNav(); activateNav(); setupTheme(); initWishlist(); initHistory(); initMemory(); initUltimate(); initAccount();
})();
