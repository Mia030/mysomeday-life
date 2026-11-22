(function createWaitlistStore() {
  const STORAGE_KEY = 'waitlist-v2-data-v2';
  const SCHEMA_VERSION = 2;
  const clone = value => JSON.parse(JSON.stringify(value));
  const defaults = clone(window.WAITLIST_MOCK || {});

  const normalize = input => {
    const source = input && typeof input === 'object' ? input : {};
    return {
      schemaVersion: SCHEMA_VERSION,
      wishlist: Array.isArray(source.wishlist) ? source.wishlist : clone(defaults.wishlist || []),
      bought: Array.isArray(source.bought) ? source.bought : clone(defaults.bought || []),
      letGo: Array.isArray(source.letGo) ? source.letGo : clone(defaults.letGo || []),
      collections: Array.isArray(source.collections) ? source.collections : clone(defaults.collections || []),
      ultimateBuckets: Array.isArray(source.ultimateBuckets) ? source.ultimateBuckets : clone(defaults.ultimateBuckets || []),
      ultimate: source.ultimate && typeof source.ultimate === 'object' ? source.ultimate : clone(defaults.ultimate || {}),
      settings: {
        defaultWaitDays: 30,
        syncMemoryChoices: true,
        gentleReminders: false,
        currency: 'USD',
        ...(source.settings && typeof source.settings === 'object' ? source.settings : {})
      },
      meta: {
        createdAt: source.meta?.createdAt || new Date().toISOString(),
        updatedAt: source.meta?.updatedAt || null
      }
    };
  };

  const read = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return normalize(saved ? JSON.parse(saved) : defaults);
    } catch (error) {
      console.warn('Waitlist local data could not be read. Using starter data.', error);
      return normalize(defaults);
    }
  };

  let state = read();

  const save = nextState => {
    state = normalize(nextState || state);
    state.meta.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.WAITLIST_MOCK = state;
    return state;
  };

  const update = updater => {
    const draft = clone(state);
    const result = updater(draft) || draft;
    return save(result);
  };

  const reset = () => {
    state = normalize(defaults);
    localStorage.removeItem(STORAGE_KEY);
    window.WAITLIST_MOCK = state;
    return state;
  };

  const exportData = () => JSON.stringify(state, null, 2);
  const importData = raw => {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return save(parsed);
  };

  window.WAITLIST_STORE = {
    key: STORAGE_KEY,
    schemaVersion: SCHEMA_VERSION,
    getState: () => state,
    save,
    update,
    reset,
    exportData,
    importData
  };
  window.WAITLIST_MOCK = state;
})();
