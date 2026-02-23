'use strict';

const state = {
  networks: [],
  stats: null,
  settings: null,
  menuConfig: null,
  groups: [],
  tokens: [],
  transactions: [],
  members: [],
  commandCategories: [],
  schedules: [],
  automation: {
    modules: [],
    strikeTriggers: [],
    strikeLadder: [],
    whitelist: [],
    logs: [],
    overview: {
      pending: 0,
      resolved: 0,
      bans: 0,
      strikes: 0
    }
  },
  moderation: {
    overview: {
      pending: 0,
      resolved: 0,
      bans: 0,
      strikes: 0
    },
    logs: []
  },
  broadcasts: [],
  filteredTransactions: [],
  currentView: 'overview',
  automationTab: 'modules',
  periodDays: 30,
  groupSearch: '',
  memberSearch: '',
  commandSearch: '',
  scheduleSearch: '',
  openCommandCategories: new Set(),
  apiBase: '',
  authToken: '',
  authUser: ''
};

const explorerByNetwork = {
  ethereum: 'https://etherscan.io/tx/',
  bsc: 'https://bscscan.com/tx/',
  base: 'https://basescan.org/tx/',
  polygon: 'https://polygonscan.com/tx/',
  solana: 'https://solscan.io/tx/'
};

const viewTitles = {
  overview: 'Relatorios',
  groups: 'Grupos Telegram',
  members: 'Membros Ativos',
  commands: 'Gerenciar Comandos',
  schedules: 'Agendamentos',
  automation: 'Automacoes & Moderacao',
  moderation: 'Moderacao',
  broadcast: 'Broadcast',
  tokens: 'Tokens Monitorados',
  activity: 'Atividade',
  settings: 'Configuracoes'
};

const DEFAULT_GROUP_PERMISSIONS = [
  'buy_alerts',
  'core_commands',
  'moderation',
  'security',
  'welcome',
  'fun',
  'economy',
  'advanced'
];

const GROUP_PERMISSION_OPTIONS = [
  { key: 'buy_alerts', label: 'Buy Alerts' },
  { key: 'core_commands', label: 'Comandos Base' },
  { key: 'moderation', label: 'Moderacao' },
  { key: 'security', label: 'Seguranca' },
  { key: 'welcome', label: 'Boas-vindas' },
  { key: 'fun', label: 'Diversao' },
  { key: 'economy', label: 'Economia' },
  { key: 'advanced', label: 'Avancado' }
];

const SECURITY_LOCK_BY_COMMAND = {
  'security.antispam': 'antispam',
  'security.antilink': 'antilink',
  'security.antiflood': 'antiflood',
  'security.captcha': 'captcha',
  'security.antiraid': 'antiraid'
};

const SECURITY_LOCK_KEYS = ['antispam', 'antilink', 'antiflood', 'captcha', 'antiraid'];

const DEFAULT_MENU_CONFIG = {
  greeting: '( * ) Ola, @(pushName)!\\nBem-vindo ao menu da sua comunidade.',
  siteUrl: 'imavyagent.com.br',
  description: 'Escolha uma categoria abaixo para receber noticias, analises e automacoes do grupo.',
  buttons: [
    { emoji: '📰', label: 'Ultimas Noticias do Livecoins', command: '!ultimas' },
    { emoji: '🔥', label: 'Tendencias do Mercado Agora', command: '!tendenciasmercado' },
    { emoji: '📊', label: 'Radar de Altcoins', command: '!altcoins' },
    { emoji: '📅', label: 'Agenda de Sinais', command: '!agenda' }
  ]
};

const refs = {
  appFrame: document.getElementById('appFrame'),
  loginScreen: document.getElementById('loginScreen'),
  loginForm: document.getElementById('loginForm'),
  loginApiUrlInput: document.getElementById('loginApiUrlInput'),
  loginUserInput: document.getElementById('loginUserInput'),
  loginPasswordInput: document.getElementById('loginPasswordInput'),
  loginCancelBtn: document.getElementById('loginCancelBtn'),
  loginError: document.getElementById('loginError'),

  statusLine: document.getElementById('statusLine'),
  viewTitle: document.getElementById('viewTitle'),
  activeScope: document.getElementById('activeScope'),
  topGroups: document.getElementById('topGroups'),
  topMembers: document.getElementById('topMembers'),
  topVolume: document.getElementById('topVolume'),
  topAlerts: document.getElementById('topAlerts'),
  reloadBtn: document.getElementById('reloadBtn'),
  testAlertBtn: document.getElementById('testAlertBtn'),
  exportBtn: document.getElementById('exportBtn'),
  openLoginBtn: document.getElementById('openLoginBtn'),
  actionsMenuBtn: document.getElementById('actionsMenuBtn'),
  actionsMenu: document.getElementById('actionsMenu'),
  themeSelect: document.getElementById('themeSelect'),
  periodSelect: document.getElementById('periodSelect'),
  navButtons: Array.from(document.querySelectorAll('[data-nav-view]')),
  viewSections: Array.from(document.querySelectorAll('.view')),

  statBuys: document.getElementById('statBuys'),
  statVolume: document.getElementById('statVolume'),
  statTokens: document.getElementById('statTokens'),
  statGroups: document.getElementById('statGroups'),
  statMinUsd: document.getElementById('statMinUsd'),
  statQueue: document.getElementById('statQueue'),
  tokenCloud: document.getElementById('tokenCloud'),
  networkBreakdown: document.getElementById('networkBreakdown'),
  whaleList: document.getElementById('whaleList'),
  runtimeMeta: document.getElementById('runtimeMeta'),

  settingsForm: document.getElementById('settingsForm'),
  minUsdInput: document.getElementById('minUsdInput'),
  scheduleImageUrlInput: document.getElementById('scheduleImageUrlInput'),
  scheduleImageUploadBtn: document.getElementById('scheduleImageUploadBtn'),
  scheduleImageFileInput: document.getElementById('scheduleImageFileInput'),
  tokenForm: document.getElementById('tokenForm'),
  networkSelect: document.getElementById('networkSelect'),
  tokenBuyImageUrlInput: document.getElementById('tokenBuyImageUrlInput'),
  tokenBuyImageUploadBtn: document.getElementById('tokenBuyImageUploadBtn'),
  tokenBuyImageFileInput: document.getElementById('tokenBuyImageFileInput'),

  groupSearchInput: document.getElementById('groupSearchInput'),
  memberSearchInput: document.getElementById('memberSearchInput'),
  commandSearchInput: document.getElementById('commandSearchInput'),
  scheduleSearchInput: document.getElementById('scheduleSearchInput'),

  commandsEnableAllBtn: document.getElementById('commandsEnableAllBtn'),
  commandsDisableAllBtn: document.getElementById('commandsDisableAllBtn'),
  openMenuBuilderBtn: document.getElementById('openMenuBuilderBtn'),
  openScheduleModalBtn: document.getElementById('openScheduleModalBtn'),

  groupCards: document.getElementById('groupCards'),
  membersTbody: document.getElementById('membersTbody'),
  commandsAccordion: document.getElementById('commandsAccordion'),
  schedulesTbody: document.getElementById('schedulesTbody'),
  automationTabs: document.getElementById('automationTabs'),
  automationModulesList: document.getElementById('automationModulesList'),
  strikeTriggersList: document.getElementById('strikeTriggersList'),
  strikeLadderList: document.getElementById('strikeLadderList'),
  whitelistForm: document.getElementById('whitelistForm'),
  whitelistTypeInput: document.getElementById('whitelistTypeInput'),
  whitelistValueInput: document.getElementById('whitelistValueInput'),
  whitelistNoteInput: document.getElementById('whitelistNoteInput'),
  whitelistList: document.getElementById('whitelistList'),
  moderationLogTypeFilter: document.getElementById('moderationLogTypeFilter'),
  moderationLogStatusFilter: document.getElementById('moderationLogStatusFilter'),
  refreshAutomationLogsBtn: document.getElementById('refreshAutomationLogsBtn'),
  moderationLogsList: document.getElementById('moderationLogsList'),
  modPending: document.getElementById('modPending'),
  modBans: document.getElementById('modBans'),
  modResolved: document.getElementById('modResolved'),
  modStrikes: document.getElementById('modStrikes'),
  moderationTableBody: document.getElementById('moderationTableBody'),
  broadcastForm: document.getElementById('broadcastForm'),
  broadcastTitleInput: document.getElementById('broadcastTitleInput'),
  broadcastContentInput: document.getElementById('broadcastContentInput'),
  broadcastMediaUrlInput: document.getElementById('broadcastMediaUrlInput'),
  broadcastMediaUploadBtn: document.getElementById('broadcastMediaUploadBtn'),
  broadcastMediaFileInput: document.getElementById('broadcastMediaFileInput'),
  broadcastGroupChecklist: document.getElementById('broadcastGroupChecklist'),
  broadcastsTbody: document.getElementById('broadcastsTbody'),
  tokensTbody: document.getElementById('tokensTbody'),
  txTbody: document.getElementById('txTbody'),

  previewModal: document.getElementById('previewModal'),
  previewCloseBtn: document.getElementById('previewCloseBtn'),
  previewCommandName: document.getElementById('previewCommandName'),
  previewCommandDescription: document.getElementById('previewCommandDescription'),
  previewCommandKey: document.getElementById('previewCommandKey'),
  previewCommandAliases: document.getElementById('previewCommandAliases'),

  groupPermissionsModal: document.getElementById('groupPermissionsModal'),
  groupPermissionsForm: document.getElementById('groupPermissionsForm'),
  groupPermissionsGroupIdInput: document.getElementById('groupPermissionsGroupIdInput'),
  groupPermissionsGroupLabel: document.getElementById('groupPermissionsGroupLabel'),
  groupPermissionsChecklist: document.getElementById('groupPermissionsChecklist'),
  groupPermissionsCloseBtn: document.getElementById('groupPermissionsCloseBtn'),
  groupPermissionsCancelBtn: document.getElementById('groupPermissionsCancelBtn'),

  scheduleModal: document.getElementById('scheduleModal'),
  scheduleModalTitle: document.querySelector('#scheduleModal .modal-head h3'),
  scheduleForm: document.getElementById('scheduleForm'),
  scheduleIdInput: document.getElementById('scheduleIdInput'),
  scheduleKindSelect: document.getElementById('scheduleKindSelect'),
  scheduleContentInput: document.getElementById('scheduleContentInput'),
  scheduleMediaUrlInput: document.getElementById('scheduleMediaUrlInput'),
  scheduleMediaUploadBtn: document.getElementById('scheduleMediaUploadBtn'),
  scheduleMediaFileInput: document.getElementById('scheduleMediaFileInput'),
  scheduleGroupChecklist: document.getElementById('scheduleGroupChecklist'),
  scheduleSendAtInput: document.getElementById('scheduleSendAtInput'),
  scheduleRecurrenceSelect: document.getElementById('scheduleRecurrenceSelect'),
  scheduleStatusSelect: document.getElementById('scheduleStatusSelect'),
  scheduleCloseBtn: document.getElementById('scheduleCloseBtn'),
  scheduleCancelBtn: document.getElementById('scheduleCancelBtn'),

  menuBuilderModal: document.getElementById('menuBuilderModal'),
  menuBuilderForm: document.getElementById('menuBuilderForm'),
  menuBuilderCloseBtn: document.getElementById('menuBuilderCloseBtn'),
  menuBuilderCancelBtn: document.getElementById('menuBuilderCancelBtn'),
  menuGreetingInput: document.getElementById('menuGreetingInput'),
  menuUrlInput: document.getElementById('menuUrlInput'),
  menuDescriptionInput: document.getElementById('menuDescriptionInput'),
  menuAddButtonBtn: document.getElementById('menuAddButtonBtn'),
  menuButtonsList: document.getElementById('menuButtonsList'),
  menuPreviewGreeting: document.getElementById('menuPreviewGreeting'),
  menuPreviewUrl: document.getElementById('menuPreviewUrl'),
  menuPreviewDescription: document.getElementById('menuPreviewDescription'),
  menuPreviewButtons: document.getElementById('menuPreviewButtons'),

  tourStartBtn: document.getElementById('tourStartBtn'),
  tourOverlay: document.getElementById('tourOverlay'),
  tourSpotlight: document.getElementById('tourSpotlight'),
  tourCursor: document.getElementById('tourCursor'),
  tourTooltip: document.getElementById('tourTooltip'),
  tourStepText: document.getElementById('tourStepText'),
  tourNextBtn: document.getElementById('tourNextBtn'),
  tourSkipBtn: document.getElementById('tourSkipBtn'),

  toast: document.getElementById('toast')
};

let loadInFlight = null;
let refreshTimer = null;
let refreshCycleBusy = false;
let menuDraftButtons = [];
let tourIndex = -1;
let pendingTokenImageUploadId = 0;

const TOUR_STEPS = [
  {
    view: 'groups',
    selector: '#groupCards',
    text: 'Selecione um de seus grupos para gerenciar tudo com foco nesse grupo.'
  },
  {
    view: 'members',
    selector: '#membersTbody',
    text: 'Acompanhe membros em tabela para identificar quem mais engaja no grupo.'
  },
  {
    view: 'commands',
    selector: '#commandsAccordion',
    text: 'Abra categorias em accordion e ajuste comandos sem alterar o codigo.'
  },
  {
    view: 'commands',
    selector: '#commandsAccordion [data-action="preview-command"]',
    text: 'Use Preview para validar a resposta de cada comando antes de publicar.'
  },
  {
    view: 'commands',
    selector: '#previewModal',
    text: 'Feche a previa para voltar a lista de comandos e seguir com a configuracao.'
  },
  {
    view: 'commands',
    selector: '#openMenuBuilderBtn',
    text: 'Use Configurar Menu para montar o menu inicial com preview em tempo real.'
  },
  {
    view: 'commands',
    selector: '#menuBuilderModal',
    text: 'Clique no nome do botao para renomear e deixar o menu mais claro para o grupo.'
  },
  {
    view: 'schedules',
    selector: '#openScheduleModalBtn',
    text: 'Clique em Nova Mensagem para programar envios automaticos no melhor horario.'
  },
  {
    view: 'schedules',
    selector: '#scheduleModal',
    text: 'Defina grupos, data e recorrencia para automatizar o envio com seguranca.'
  }
];

const STORAGE_KEYS = {
  apiBase: 'buy_alert_admin_api_base',
  authToken: 'buy_alert_admin_auth_token',
  authUser: 'buy_alert_admin_auth_user',
  theme: 'buy_alert_admin_theme'
};

const safeStorageGet = (key, fallback = '') => {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch (_error) {
    return fallback;
  }
};

const safeStorageSet = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch (_error) {
    // ignore storage failures
  }
};

const normalizeApiBase = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  return raw.replace(/\/+$/, '');
};

const normalizeOptionalMediaUrl = (value, fieldLabel = 'URL de imagem') => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  let parsed = null;
  try {
    parsed = new URL(raw);
  } catch (_error) {
    throw new Error(`${fieldLabel} invalida.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${fieldLabel} invalida.`);
  }

  return parsed.toString();
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
    reader.readAsDataURL(file);
  });

const validateImageFile = (file, fieldLabel = 'imagem') => {
  if (!file) {
    throw new Error(`Selecione uma ${fieldLabel}.`);
  }

  const mimeType = String(file.type || '').toLowerCase();
  if (!mimeType.startsWith('image/')) {
    throw new Error(`Arquivo invalido para ${fieldLabel}.`);
  }

  const maxBytes = 6 * 1024 * 1024;
  if (Number(file.size || 0) > maxBytes) {
    throw new Error(`${fieldLabel} muito grande (max 6MB).`);
  }
};

const uploadImageFile = async (file, { scope = 'general', fileName = '' } = {}) => {
  validateImageFile(file, 'imagem');
  const dataUrl = await readFileAsDataUrl(file);
  const payload = await apiFetch('/api/uploads/image', {
    method: 'POST',
    body: JSON.stringify({
      scope,
      fileName: fileName || file.name || 'image',
      dataUrl
    })
  });

  const url = normalizeOptionalMediaUrl(payload?.file?.url || '', 'URL da imagem enviada');
  if (!url) {
    throw new Error('Upload concluido sem URL valida.');
  }

  return {
    url,
    size: Number(payload?.file?.size || file.size || 0),
    mimeType: String(payload?.file?.mimeType || file.type || '')
  };
};

const buildApiUrl = (path) => {
  const raw = String(path || '').trim();
  if (!raw) {
    if (!state.apiBase) {
      throw new Error('API nao configurada. Faca login novamente.');
    }
    return state.apiBase;
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const base = normalizeApiBase(state.apiBase || '');
  if (!base) {
    throw new Error('API nao configurada. Faca login novamente.');
  }
  const suffix = raw.startsWith('/') ? raw : `/${raw}`;
  return `${base}${suffix}`;
};

const setApiConnectionState = ({ apiBase, authToken, authUser }) => {
  const resolvedApiBase = apiBase !== undefined ? apiBase : state.apiBase;
  const resolvedAuthToken = authToken !== undefined ? authToken : state.authToken;
  const resolvedAuthUser = authUser !== undefined ? authUser : state.authUser;

  state.apiBase = normalizeApiBase(resolvedApiBase || '');
  state.authToken = String(resolvedAuthToken || '');
  state.authUser = String(resolvedAuthUser || '');

  safeStorageSet(STORAGE_KEYS.apiBase, state.apiBase);
  safeStorageSet(STORAGE_KEYS.authToken, state.authToken);
  safeStorageSet(STORAGE_KEYS.authUser, state.authUser);
};

const defaultApiBaseHint = () =>
  isLikelyVercelHost()
    ? 'https://api.seudominio.com'
    : `${window.location.protocol}//${window.location.hostname}:8787`;

const setLoginError = (message = '') => {
  if (!refs.loginError) {
    return;
  }

  const text = String(message || '').trim();
  refs.loginError.textContent = text;
  refs.loginError.hidden = !text;
};

const syncLoginFormDefaults = () => {
  if (!refs.loginApiUrlInput || !refs.loginUserInput || !refs.loginPasswordInput) {
    return;
  }

  const apiBase = state.apiBase || safeStorageGet(STORAGE_KEYS.apiBase, '') || defaultApiBaseHint();
  const authUser = state.authUser || safeStorageGet(STORAGE_KEYS.authUser, '');

  refs.loginApiUrlInput.value = apiBase;
  refs.loginUserInput.value = authUser;
  refs.loginPasswordInput.value = '';
};

const showLoginScreen = (message = '', { allowBack = false } = {}) => {
  if (!refs.loginScreen || !refs.appFrame) {
    return;
  }

  closeAllOverlays();

  clearInterval(refreshTimer);
  refreshTimer = null;

  syncLoginFormDefaults();
  setLoginError(message);

  refs.loginScreen.hidden = false;
  refs.appFrame.hidden = true;
  document.body.classList.add('auth-locked');

  if (refs.loginCancelBtn) {
    refs.loginCancelBtn.hidden = !allowBack;
  }
};

const hideLoginScreen = () => {
  if (!refs.loginScreen || !refs.appFrame) {
    return;
  }

  refs.loginScreen.hidden = true;
  refs.appFrame.hidden = false;
  setLoginError('');
  document.body.classList.remove('auth-locked');
  if (refs.loginCancelBtn) {
    refs.loginCancelBtn.hidden = true;
  }
};

const toBasicToken = (username, password) => {
  const raw = `${String(username || '')}:${String(password || '')}`;
  return window.btoa(raw);
};

const hasActiveSession = () => Boolean(state.apiBase && state.authToken);

const normalizeTheme = (value) => {
  const theme = String(value || '').trim().toLowerCase();
  if (['blue', 'purple', 'green', 'light'].includes(theme)) {
    return theme;
  }
  return '';
};

const applyTheme = (value, { persist = true } = {}) => {
  const theme = normalizeTheme(value);
  if (theme) {
    document.body.dataset.theme = theme;
  } else {
    delete document.body.dataset.theme;
  }

  if (refs.themeSelect) {
    refs.themeSelect.value = theme;
  }

  if (persist) {
    safeStorageSet(STORAGE_KEYS.theme, theme);
  }
};

const closeActionsMenu = () => {
  if (refs.actionsMenu) {
    refs.actionsMenu.hidden = true;
  }
  if (refs.actionsMenuBtn) {
    refs.actionsMenuBtn.setAttribute('aria-expanded', 'false');
  }
};

const toggleActionsMenu = () => {
  if (!refs.actionsMenu || !refs.actionsMenuBtn) {
    return;
  }

  const willOpen = refs.actionsMenu.hidden;
  refs.actionsMenu.hidden = !willOpen;
  refs.actionsMenuBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
};

const closeAllOverlays = () => {
  if (refs.previewModal) {
    refs.previewModal.hidden = true;
  }
  if (refs.scheduleModal) {
    refs.scheduleModal.hidden = true;
  }
  if (refs.menuBuilderModal) {
    refs.menuBuilderModal.hidden = true;
  }
  if (refs.tourOverlay) {
    refs.tourOverlay.hidden = true;
  }
  closeActionsMenu();

  document.querySelectorAll('.modal-backdrop, .tour-overlay').forEach((node) => {
    node.hidden = true;
  });
};

const configureApiConnection = async ({ forcePrompt = false } = {}) => {
  const fallbackBase = isLikelyVercelHost()
    ? 'https://SEU-DOMINIO-DA-VPS:8787'
    : `${window.location.protocol}//${window.location.hostname}:8787`;
  const defaultBase = state.apiBase || safeStorageGet(STORAGE_KEYS.apiBase, '') || fallbackBase;

  if (!forcePrompt && defaultBase) {
    setApiConnectionState({
      apiBase: defaultBase,
      authToken: safeStorageGet(STORAGE_KEYS.authToken, state.authToken || ''),
      authUser: safeStorageGet(STORAGE_KEYS.authUser, state.authUser || '')
    });
  }

  const requireTokenPrompt = forcePrompt || isLikelyVercelHost();
  const needsPrompt = forcePrompt || !state.apiBase || (requireTokenPrompt && !state.authToken);
  if (!needsPrompt) {
    return true;
  }

  const apiBaseInput = window.prompt('URL da API (VPS), ex: http://SEU_IP:8787', defaultBase);
  if (apiBaseInput === null) {
    return false;
  }

  const apiBase = normalizeApiBase(apiBaseInput);
  if (!apiBase) {
    showToast('URL da API invalida.', true);
    return false;
  }

  const authUser = String(window.prompt('Usuario admin da API', state.authUser || '') || '').trim();
  if (!authUser) {
    showToast('Usuario admin obrigatorio.', true);
    return false;
  }

  const authPass = window.prompt('Senha admin da API', '');
  if (authPass === null || !String(authPass).trim()) {
    showToast('Senha admin obrigatoria.', true);
    return false;
  }

  const authToken = window.btoa(`${authUser}:${String(authPass)}`);
  setApiConnectionState({ apiBase, authToken, authUser });

  return true;
};

const showToast = (message, isError = false) => {
  if (!refs.toast) {
    return;
  }

  refs.toast.textContent = String(message || '');
  refs.toast.style.borderColor = isError ? 'rgba(255,110,141,.7)' : 'rgba(45,223,132,.45)';
  refs.toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => refs.toast.classList.remove('show'), 2600);
};

const apiFetch = async (url, options = {}) => {
  const { skipAuth = false, ...fetchOptions } = options;
  const headers = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers || {})
  };

  if (!skipAuth && state.authToken) {
    headers.Authorization = `Basic ${state.authToken}`;
  }

  let requestUrl = '';
  try {
    requestUrl = buildApiUrl(url);
  } catch (error) {
    showLoginScreen('API nao configurada. Faca login novamente.');
    throw error;
  }

  const response = await fetch(requestUrl, {
    ...fetchOptions,
    headers
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      showLoginScreen('Sessao expirada. Faca login novamente.');
    }
    const error = new Error(payload?.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }

  return payload;
};

const withButtonLock = async (button, callback) => {
  if (button && button.dataset.busy === '1') {
    return;
  }

  if (button) {
    button.dataset.busy = '1';
    button.disabled = true;
  }

  try {
    await callback();
  } finally {
    if (button) {
      button.disabled = false;
      button.dataset.busy = '0';
    }
  }
};

const getSubmitButton = (event) =>
  event.submitter || event.target?.querySelector?.('button[type="submit"]') || null;

const shortText = (value, left = 6, right = 4) => {
  const raw = String(value || '');
  return raw.length <= left + right + 2 ? raw : `${raw.slice(0, left)}...${raw.slice(-right)}`;
};

const initials = (value) => {
  const clean = String(value || '').trim();
  if (!clean) {
    return 'TG';
  }

  const parts = clean
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0].toUpperCase());

  return parts.join('') || clean.slice(0, 2).toUpperCase();
};

const formatUsd = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(numeric);
};

const formatNumber = (value, digits = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '0';
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(numeric);
};

const formatCompact = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '0';
  }
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(numeric);
};

const escapeHtml = (value) =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const daysFromSelection = () => {
  const value = Number(refs.periodSelect?.value || 30);
  return Number.isFinite(value) && value > 0 ? value : 30;
};

const isEnabled = (value) => value === true || value === 1 || value === '1';

const parseGroupIds = (rawValue) => {
  if (Array.isArray(rawValue)) {
    return Array.from(new Set(rawValue.map((item) => String(item || '').trim()).filter(Boolean)));
  }
  return Array.from(
    new Set(
      String(rawValue || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
};

const parseGroupPermissions = (rawValue, { fallbackToDefault = true } = {}) => {
  if (Array.isArray(rawValue)) {
    return Array.from(
      new Set(
        rawValue
          .map((item) => String(item || '').trim().toLowerCase())
          .filter(Boolean)
      )
    );
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return fallbackToDefault ? [...DEFAULT_GROUP_PERMISSIONS] : [];
    }

    if (trimmed.startsWith('[')) {
      try {
        return parseGroupPermissions(JSON.parse(trimmed), { fallbackToDefault: false });
      } catch (_error) {
        return parseGroupPermissions(trimmed.split(','), { fallbackToDefault: false });
      }
    }

    return parseGroupPermissions(trimmed.split(','), { fallbackToDefault: false });
  }

  return fallbackToDefault ? [...DEFAULT_GROUP_PERMISSIONS] : [];
};

const renderPermissionSelector = (container, selected = DEFAULT_GROUP_PERMISSIONS, inputName = 'permissions') => {
  if (!container) {
    return;
  }

  const selectedSet = new Set(parseGroupPermissions(selected));
  container.innerHTML = GROUP_PERMISSION_OPTIONS.map((option) => {
    const checked = selectedSet.has(option.key) ? 'checked' : '';
    return `<label class="permission-check">
      <input type="checkbox" name="${escapeHtml(inputName)}" value="${escapeHtml(option.key)}" ${checked} />
      <span>${escapeHtml(option.label)}</span>
    </label>`;
  }).join('');
};

const readPermissionsFromContainer = (container, inputName) => {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll(`input[name="${inputName}"]:checked`))
    .map((element) => String(element.value || '').trim().toLowerCase())
    .filter(Boolean);
};

const normalizeGroup = (group) => {
  const source = group && typeof group === 'object' ? group : {};
  return {
    ...source,
    permissions: parseGroupPermissions(source.permissions || source.permission || source.permissionsCsv)
  };
};

const safeJsonParse = (value, fallback = null) => {
  if (typeof value !== 'string') {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

const createMenuButtonId = () => `btn_${Math.random().toString(36).slice(2, 10)}`;

const normalizeMenuConfig = (raw) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const srcButtons = Array.isArray(source.buttons) ? source.buttons : [];

  const normalizedButtons = srcButtons
    .map((button, index) => ({
      id: String(button.id || createMenuButtonId() || `btn_${index}`),
      emoji: String(button.emoji || '').trim().slice(0, 4),
      label: String(button.label || '').trim(),
      command: String(button.command || '').trim()
    }))
    .filter((button) => button.label && button.command)
    .slice(0, 10);

  return {
    greeting: String(source.greeting || DEFAULT_MENU_CONFIG.greeting).trim(),
    siteUrl: String(source.siteUrl || DEFAULT_MENU_CONFIG.siteUrl).trim(),
    description: String(source.description || DEFAULT_MENU_CONFIG.description).trim(),
    buttons: normalizedButtons.length
      ? normalizedButtons
      : DEFAULT_MENU_CONFIG.buttons.map((button) => ({
          ...button,
          id: createMenuButtonId()
        }))
  };
};

const resolveTokenLabel = (tokenKey) => {
  const raw = String(tokenKey || '');
  if (raw.includes(':')) {
    const [network, address] = raw.split(':');
    const found = state.tokens.find(
      (item) =>
        item.network === network &&
        String(item.address || '').toLowerCase() === String(address || '').toLowerCase()
    );
    return found ? found.symbol : shortText(address, 8, 5);
  }
  return shortText(raw, 8, 5);
};

const getNetworkLabel = (key) => {
  const found = state.networks.find((item) => item.key === String(key || '').toLowerCase());
  return found ? found.label : String(key || '-');
};

const getGroupLabelById = (chatId) => {
  const found = state.groups.find((item) => String(item.chat_id) === String(chatId));
  return found ? found.label : shortText(chatId, 8, 5);
};

const getPrimaryActiveGroup = () => state.groups.find((group) => isEnabled(group.enabled)) || null;

const syncGroupLockByCommand = async (commandKey, enabled) => {
  const lockKey = SECURITY_LOCK_BY_COMMAND[String(commandKey || '')];
  if (!lockKey) {
    return;
  }

  const activeGroup = getPrimaryActiveGroup();
  if (!activeGroup) {
    return;
  }

  await apiFetch(`/api/groups/${activeGroup.id}/locks`, {
    method: 'PATCH',
    body: JSON.stringify({ lockKey, enabled: Boolean(enabled) })
  });
};

const syncSecurityLocksBulk = async (enabled) => {
  const activeGroup = getPrimaryActiveGroup();
  if (!activeGroup) {
    return;
  }

  const locks = {};
  SECURITY_LOCK_KEYS.forEach((key) => {
    locks[key] = Boolean(enabled);
  });

  await apiFetch(`/api/groups/${activeGroup.id}/locks`, {
    method: 'PATCH',
    body: JSON.stringify({ locks })
  });
};

const getCommandById = (id) => {
  const targetId = Number(id);
  for (const category of state.commandCategories) {
    const found = category.items.find((item) => Number(item.id) === targetId);
    if (found) {
      return found;
    }
  }
  return null;
};

const getScheduleById = (id) => state.schedules.find((item) => Number(item.id) === Number(id)) || null;

const toLocalDateTimeInput = (isoDate) => {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16);
  }
  const offset = parsed.getTimezoneOffset() * 60000;
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16);
};

const closeModal = (element) => {
  if (element) {
    element.hidden = true;
  }
};

const openModal = (element) => {
  if (!element) {
    return false;
  }

  if (!hasActiveSession()) {
    showLoginScreen('Sessao invalida. Faca login novamente.');
    return false;
  }

  if (document.body.classList.contains('auth-locked')) {
    return false;
  }

  element.hidden = false;
  return true;
};

const applyPeriodFilter = () => {
  const now = Date.now();
  const windowMs = state.periodDays * 24 * 60 * 60 * 1000;

  state.filteredTransactions = state.transactions.filter((tx) => {
    const timestamp = new Date(tx.timestamp).getTime();
    return Number.isFinite(timestamp) && now - timestamp <= windowMs;
  });
};

const setCommandCategories = (categories) => {
  state.commandCategories = Array.isArray(categories) ? categories : [];
  const valid = new Set(state.commandCategories.map((item) => item.category));

  Array.from(state.openCommandCategories).forEach((name) => {
    if (!valid.has(name)) {
      state.openCommandCategories.delete(name);
    }
  });

  if (!state.openCommandCategories.size && state.commandCategories.length) {
    state.openCommandCategories.add(state.commandCategories[0].category);
  }
};

const renderView = () => {
  refs.navButtons.forEach((button) => {
    const active = button.dataset.navView === state.currentView;
    button.classList.toggle('active', active);
  });

  refs.viewSections.forEach((section) => {
    const active = section.dataset.view === state.currentView;
    section.classList.toggle('active', active);
  });

  refs.viewTitle.textContent = viewTitles[state.currentView] || 'Painel';
};

const renderNetworkSelect = () => {
  refs.networkSelect.innerHTML = state.networks
    .filter((item) => item.enabled)
    .map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`)
    .join('');
};

const renderScopeChip = () => {
  const activeGroups = state.groups.filter((group) => isEnabled(group.enabled));
  if (!activeGroups.length) {
    refs.activeScope.textContent = 'Nenhum grupo ativo';
    return;
  }

  refs.activeScope.textContent = `${activeGroups[0].label} (${activeGroups.length} ativo${
    activeGroups.length > 1 ? 's' : ''
  })`;
};

const renderStats = () => {
  const stats = state.stats || {};
  const txs = state.filteredTransactions;
  const totalUsd = txs.reduce((sum, tx) => sum + (Number(tx.usd_value) || 0), 0);
  const activeMembers = state.members.filter((item) => String(item.status || '').toLowerCase() === 'ativo').length;

  refs.statBuys.textContent = formatCompact(txs.length);
  refs.statVolume.textContent = formatUsd(totalUsd);
  refs.statTokens.textContent = String(stats.tokens?.active || 0);
  refs.statGroups.textContent = String(stats.groups?.active || 0);
  refs.statMinUsd.textContent = formatUsd(stats.minUsdAlert || 0);
  refs.statQueue.textContent = `Fila process: ${stats.queues?.processSize || 0} | telegram: ${
    stats.queues?.telegramSize || 0
  }`;

  refs.statusLine.textContent = `Atualizado ${new Date().toLocaleTimeString('pt-BR')} | ${
    txs.length
  } compras no periodo | minUSD ${formatUsd(stats.minUsdAlert || 0)} | uptime ${stats.uptimeSec || 0}s`;

  if (refs.topGroups) {
    refs.topGroups.textContent = formatCompact(stats.groups?.total || state.groups.length);
  }
  if (refs.topMembers) {
    refs.topMembers.textContent = formatCompact(activeMembers || state.members.length);
  }
  if (refs.topVolume) {
    refs.topVolume.textContent = formatUsd(totalUsd);
  }
  if (refs.topAlerts) {
    refs.topAlerts.textContent = formatCompact(stats.recentAlerts || 0);
  }
};

const renderTokenCloud = () => {
  const txs = state.filteredTransactions;
  if (!txs.length) {
    refs.tokenCloud.innerHTML = '<p class="placeholder">Sem compras no periodo selecionado.</p>';
    return;
  }

  const counters = new Map();
  txs.forEach((tx) => {
    const key = resolveTokenLabel(tx.token);
    counters.set(key, (counters.get(key) || 0) + 1);
  });

  const top = Array.from(counters.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 18);

  refs.tokenCloud.innerHTML = top
    .map(([token, count]) => `<span class="chip"><strong>${escapeHtml(token)}</strong> ${count}</span>`)
    .join('');
};

const renderNetworkBreakdown = () => {
  const txs = state.filteredTransactions;
  const counts = new Map();

  txs.forEach((tx) => {
    const key = String(tx.network || '').toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const enabledNetworks = state.networks.filter((item) => item.enabled);
  if (!enabledNetworks.length) {
    refs.networkBreakdown.innerHTML = '<p class="placeholder">Sem redes habilitadas.</p>';
    return;
  }

  const max = Math.max(
    1,
    ...enabledNetworks.map((item) => {
      return counts.get(item.key) || 0;
    })
  );

  refs.networkBreakdown.innerHTML = enabledNetworks
    .map((item) => {
      const value = counts.get(item.key) || 0;
      const width = Math.max(4, (value / max) * 100);
      return `<div class="bar-row">
        <span>${escapeHtml(item.label)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${width}%;"></div></div>
        <strong>${value}</strong>
      </div>`;
    })
    .join('');
};

const renderWhales = () => {
  const txs = [...state.filteredTransactions].sort((left, right) => Number(right.usd_value) - Number(left.usd_value));
  const whales = txs.filter((tx) => Number(tx.usd_value) >= 25000).slice(0, 6);
  const selected = whales.length ? whales : txs.slice(0, 6);

  if (!selected.length) {
    refs.whaleList.innerHTML = '<p class="placeholder">Sem transacoes para exibir.</p>';
    return;
  }

  refs.whaleList.innerHTML = selected
    .map((tx) => {
      const token = resolveTokenLabel(tx.token);
      const explorer = (explorerByNetwork[tx.network] || '') + tx.hash;
      return `<article class="whale-item">
        <div class="whale-main">
          <span>${escapeHtml(token)} - ${escapeHtml(formatUsd(tx.usd_value))}</span>
          <a class="hash-link" href="${escapeHtml(explorer)}" target="_blank" rel="noreferrer">${escapeHtml(
            shortText(tx.hash, 12, 8)
          )}</a>
        </div>
        <div class="whale-sub">
          <span>Rede: ${escapeHtml(getNetworkLabel(tx.network))}</span>
          <span>Buyer: ${escapeHtml(shortText(tx.buyer, 6, 4))}</span>
          <span>Amount: ${escapeHtml(formatNumber(tx.amount, 4))}</span>
        </div>
      </article>`;
    })
    .join('');
};

const renderRuntimeMeta = () => {
  const stats = state.stats || {};
  const runtime = state.settings?.runtime || {};
  const settings = state.settings?.settings || {};
  const enabledNetworks = runtime.enabledNetworks || [];
  const scheduleMedia = String(settings.media_schedule_url || '').trim();
  const tokensWithImage = state.tokens.filter((item) => String(item.buy_media_url || '').trim()).length;

  refs.runtimeMeta.innerHTML = [
    `<div>API conectada: <strong>${escapeHtml(state.apiBase || '-')}</strong></div>`,
    `<div>Redes ativas: <strong>${escapeHtml(enabledNetworks.join(', ') || 'nenhuma')}</strong></div>`,
    `<div>Process queue: <strong>${stats.queues?.processSize || 0}</strong> | Telegram queue: <strong>${
      stats.queues?.telegramSize || 0
    }</strong></div>`,
    `<div>Alertas recentes registrados: <strong>${stats.recentAlerts || 0}</strong></div>`,
    `<div>Agendamentos pendentes: <strong>${stats.schedules?.pending || 0}</strong></div>`,
    `<div>Botoes do menu inicial: <strong>${state.menuConfig?.buttons?.length || 0}</strong></div>`,
    `<div>Tokens com imagem de compra: <strong>${tokensWithImage}/${state.tokens.length || 0}</strong></div>`,
    `<div>Imagem avisos: <strong>${escapeHtml(scheduleMedia ? shortText(scheduleMedia, 24, 18) : 'desativada')}</strong></div>`
  ].join('');
};

const renderGroups = () => {
  const query = state.groupSearch.trim().toLowerCase();
  const groups = query
    ? state.groups.filter((group) => {
        return (
          String(group.label || '')
            .toLowerCase()
            .includes(query) || String(group.chat_id || '').toLowerCase().includes(query)
        );
      })
    : state.groups;

  if (!groups.length) {
    refs.groupCards.innerHTML = '<p class="placeholder">Nenhum grupo encontrado.</p>';
    return;
  }

  refs.groupCards.innerHTML = groups
    .map((group) => {
      const enabled = isEnabled(group.enabled);
      const memberHint = Math.max(2, Math.floor((Number(group.id) || 1) * 1.7) % 350);
      const permissions = parseGroupPermissions(group.permissions, { fallbackToDefault: false });
      const permissionsHtml = permissions.length
        ? permissions.map((permission) => `<span class="permission-chip">${escapeHtml(permission)}</span>`).join('')
        : '<span class="permission-chip permission-chip-off">sem_permissoes</span>';

      return `<article class="group-card">
        <div class="group-card-head">
          <div class="group-meta">
            <div class="group-avatar">${escapeHtml(initials(group.label))}</div>
            <div class="group-text">
              <p class="group-name">${escapeHtml(group.label)}</p>
              <p class="group-id">${escapeHtml(shortText(group.chat_id, 8, 5))}</p>
            </div>
          </div>
        </div>
        <div class="group-status">
          <span class="status-badge ${enabled ? 'status-badge-ok' : 'status-badge-off'}"><i class="status-dot ${
            enabled ? 'ok' : 'off'
          }"></i>${enabled ? 'Ativo' : 'Pausado'}</span>
          <span class="group-members-count">${memberHint} membros</span>
        </div>
        <div class="group-permissions">
          ${permissionsHtml}
        </div>
        <div class="group-card-actions">
          <button class="btn btn-small btn-soft" data-action="edit-group-permissions" data-id="${
            group.id
          }" type="button">Permissoes</button>
          <button class="btn btn-small btn-soft" data-action="group-authorize-all" data-id="${group.id}" type="button">Autorizar tudo</button>
          <button class="btn btn-small btn-ghost" data-action="group-deny-all" data-id="${group.id}" type="button">Negar tudo</button>
          <button class="btn btn-small btn-soft" data-action="toggle-group" data-id="${group.id}" data-enabled="${
            enabled ? 1 : 0
          }" type="button">${enabled ? 'Pausar' : 'Ativar'}</button>
          <button class="btn btn-small btn-danger" data-action="delete-group" data-id="${group.id}" type="button">Excluir</button>
        </div>
      </article>`;
    })
    .join('');
};

const renderMembers = () => {
  const query = state.memberSearch.trim().toLowerCase();
  const members = query
    ? state.members.filter((item) => {
        return (
          String(item.name || '')
            .toLowerCase()
            .includes(query) ||
          String(item.wallet || '')
            .toLowerCase()
            .includes(query) ||
          String(item.group || '')
            .toLowerCase()
            .includes(query)
        );
      })
    : state.members;

  if (!members.length) {
    refs.membersTbody.innerHTML = '<tr><td colspan="6" class="placeholder">Sem membros no periodo.</td></tr>';
    return;
  }

  refs.membersTbody.innerHTML = members
    .map((member) => {
      const active = String(member.status || '').toLowerCase() === 'ativo';
      const badgeClass = active ? 'badge badge-ok' : 'badge badge-off';

      return `<tr>
        <td>${escapeHtml(member.name || shortText(member.wallet, 6, 4))}</td>
        <td>${escapeHtml(member.group || '-')}</td>
        <td>${escapeHtml(formatNumber(member.messages || 0, 0))}</td>
        <td>${escapeHtml(formatNumber(member.reactions || 0, 0))}</td>
        <td>${escapeHtml(formatUsd(member.volume_usd || 0))}</td>
        <td><span class="${badgeClass}">${active ? 'Ativo' : 'Inativo'}</span></td>
      </tr>`;
    })
    .join('');
};

const renderCommands = () => {
  const query = state.commandSearch.trim().toLowerCase();
  const blocks = [];

  state.commandCategories.forEach((category) => {
    const categoryMatch = String(category.category || '')
      .toLowerCase()
      .includes(query);

    const items = query
      ? category.items.filter((item) => {
          return (
            categoryMatch ||
            String(item.name || '')
              .toLowerCase()
              .includes(query) ||
            String(item.description || '')
              .toLowerCase()
              .includes(query) ||
            String(item.key || '')
              .toLowerCase()
              .includes(query) ||
            String(item.aliases || '')
              .toLowerCase()
              .includes(query)
          );
        })
      : category.items;

    if (!items.length) {
      return;
    }

    const isOpen = query ? true : state.openCommandCategories.has(category.category);
    const activeInView = items.filter((item) => item.enabled).length;
    const percent = items.length ? Math.round((activeInView / items.length) * 100) : 0;

    const cards = items
      .map((item) => {
        const aliases = String(item.aliases || '')
          .split(',')
          .map((alias) => alias.trim())
          .filter(Boolean);

        const tags = [`<span class="command-tag">${escapeHtml(item.key)}</span>`]
          .concat(aliases.map((alias) => `<span class="command-tag">${escapeHtml(alias)}</span>`))
          .join('');

        return `<article class="command-card">
          <div class="command-head">
            <h4 class="command-name">${escapeHtml(item.name)}</h4>
            <button class="toggle-switch ${item.enabled ? 'on' : ''}" data-action="command-toggle" data-id="${
              item.id
            }" data-enabled="${item.enabled ? 1 : 0}" type="button" aria-label="Ativar comando"></button>
          </div>
          <p class="command-desc">${escapeHtml(item.description || '-')}</p>
          <div class="command-tags">${tags}</div>
          <div class="command-actions">
            <button class="btn btn-small btn-ghost" data-action="preview-command" data-id="${item.id}" type="button">Preview</button>
          </div>
        </article>`;
      })
      .join('');

    blocks.push(`<article class="accordion-item ${isOpen ? 'open' : ''}">
      <button class="accordion-head" data-action="accordion-toggle" data-category="${escapeHtml(
        category.category
      )}" type="button">
        <div class="accordion-title">
          <strong>${escapeHtml(category.category)}</strong>
          <span>${activeInView}/${items.length} ativos</span>
        </div>
        <div class="accordion-right">
          <span class="percent-pill">${percent}%</span>
        </div>
      </button>
      <div class="accordion-body">
        <div class="filter-actions" style="margin-bottom:10px">
          <button class="btn btn-small btn-soft" data-action="command-category-toggle" data-category="${escapeHtml(
            category.category
          )}" data-enable="1" type="button">Ativar categoria</button>
          <button class="btn btn-small btn-ghost" data-action="command-category-toggle" data-category="${escapeHtml(
            category.category
          )}" data-enable="0" type="button">Desativar categoria</button>
        </div>
        <div class="command-grid">${cards}</div>
      </div>
    </article>`);
  });

  refs.commandsAccordion.innerHTML = blocks.length
    ? blocks.join('')
    : '<p class="placeholder">Nenhum comando encontrado.</p>';
};

const renderScheduleGroupChecklist = (selectedGroups = []) => {
  if (!state.groups.length) {
    refs.scheduleGroupChecklist.innerHTML = '<p class="placeholder">Cadastre um grupo antes de agendar.</p>';
    return;
  }

  const selectedSet = new Set(selectedGroups.map(String));
  refs.scheduleGroupChecklist.innerHTML = state.groups
    .map((group) => {
      const checked = selectedSet.has(String(group.chat_id)) ? 'checked' : '';
      const disabled = !isEnabled(group.enabled) ? ' (pausado)' : '';
      return `<label class="group-check-item">
        <input type="checkbox" name="schedule_group_id" value="${escapeHtml(group.chat_id)}" ${checked} />
        <span>${escapeHtml(group.label)} (${escapeHtml(shortText(group.chat_id, 8, 5))})${escapeHtml(disabled)}</span>
      </label>`;
    })
    .join('');
};

const renderSchedules = () => {
  const query = state.scheduleSearch.trim().toLowerCase();
  const defaultScheduleMedia = String(state.settings?.settings?.media_schedule_url || '').trim();
  const schedules = query
    ? state.schedules.filter((schedule) => {
        const groups = parseGroupIds(schedule.group_ids)
          .map((groupId) => getGroupLabelById(groupId))
          .join(' ');

        return (
          String(schedule.content || '')
            .toLowerCase()
            .includes(query) ||
          String(schedule.kind || '')
            .toLowerCase()
            .includes(query) ||
          String(schedule.status || '')
            .toLowerCase()
            .includes(query) ||
          groups.toLowerCase().includes(query)
        );
      })
    : state.schedules;

  if (!schedules.length) {
    refs.schedulesTbody.innerHTML = '<tr><td colspan="6" class="placeholder">Nenhum agendamento cadastrado.</td></tr>';
    return;
  }

  refs.schedulesTbody.innerHTML = schedules
    .map((schedule) => {
      const groups = parseGroupIds(schedule.group_ids);
      const groupLabel = groups.map((item) => getGroupLabelById(item)).join(', ');
      const mediaUrl = String(schedule.media_url || '').trim();
      const status = String(schedule.status || 'pending').toLowerCase();
      const statusMap = {
        pending: 'Pendente',
        sent: 'Enviado',
        disabled: 'Desativado',
        failed: 'Falhou'
      };
      const statusText = statusMap[status] || status;
      const badgeClass = status === 'disabled' || status === 'failed' ? 'badge badge-off' : 'badge badge-ok';

      let toggleText = 'Ativar';
      let toggleStatus = 'pending';
      if (status === 'pending') {
        toggleText = 'Desativar';
        toggleStatus = 'disabled';
      } else if (status === 'disabled') {
        toggleText = 'Ativar';
        toggleStatus = 'pending';
      } else if (status === 'sent' || status === 'failed') {
        toggleText = 'Reativar';
        toggleStatus = 'pending';
      }

      return `<tr>
        <td>
          <strong>${escapeHtml(shortText(schedule.content, 48, 0))}</strong>
          <div class="panel-hint">${escapeHtml(groupLabel || '-')}</div>
          ${
            mediaUrl
              ? `<div class="panel-hint">Imagem: ${escapeHtml(shortText(mediaUrl, 46, 20))}</div>`
              : defaultScheduleMedia
                ? '<div class="panel-hint">Imagem: padrao configurada</div>'
                : '<div class="panel-hint">Imagem: sem imagem</div>'
          }
        </td>
        <td>${schedule.kind === 'poll' ? 'Enquete' : 'Mensagem'}</td>
        <td>${escapeHtml(new Date(schedule.send_at).toLocaleString('pt-BR'))}</td>
        <td>${schedule.recurrence === 'daily' ? 'Diario' : 'Unico'}</td>
        <td><span class="${badgeClass}">${statusText}</span></td>
        <td>
          <div class="actions">
            <button class="btn btn-small btn-soft" data-action="schedule-run" data-id="${schedule.id}" type="button">Run</button>
            <button class="btn btn-small btn-ghost" data-action="schedule-edit" data-id="${schedule.id}" type="button">Editar</button>
            <button class="btn btn-small btn-ghost" data-action="schedule-status" data-id="${schedule.id}" data-next-status="${toggleStatus}" type="button">${toggleText}</button>
            <button class="btn btn-small btn-danger" data-action="schedule-delete" data-id="${schedule.id}" type="button">Excluir</button>
          </div>
        </td>
      </tr>`;
    })
    .join('');
};

const renderAutomation = () => {
  if (!refs.automationModulesList) {
    return;
  }

  const activeGroup = getPrimaryActiveGroup();
  if (!activeGroup) {
    refs.automationModulesList.innerHTML = '<p class="placeholder">Ative um grupo para configurar automacoes.</p>';
    refs.strikeTriggersList.innerHTML = '<p class="placeholder">Ative um grupo para configurar gatilhos.</p>';
    refs.strikeLadderList.innerHTML = '<p class="placeholder">Ative um grupo para configurar escada.</p>';
    refs.whitelistList.innerHTML = '<p class="placeholder">Ative um grupo para configurar whitelist.</p>';
    refs.moderationLogsList.innerHTML = '<p class="placeholder">Sem logs.</p>';
    return;
  }

  const modules = Array.isArray(state.automation?.modules) ? state.automation.modules : [];
  const triggers = Array.isArray(state.automation?.strikeTriggers) ? state.automation.strikeTriggers : [];
  const ladder = Array.isArray(state.automation?.strikeLadder) ? state.automation.strikeLadder : [];
  const whitelist = Array.isArray(state.automation?.whitelist) ? state.automation.whitelist : [];
  const logs = Array.isArray(state.automation?.logs) ? state.automation.logs : [];

  refs.automationModulesList.innerHTML = modules.length
    ? modules
        .map((item) => {
          return `<article class="stack-item">
          <div class="stack-main">
            <strong>${escapeHtml(item.label || item.key)}</strong>
            <p>${escapeHtml(item.description || '-')}</p>
          </div>
          <div class="stack-actions">
            <button
              class="toggle-switch ${item.enabled ? 'on' : ''}"
              data-action="automation-module-toggle"
              data-key="${escapeHtml(item.key)}"
              data-enabled="${item.enabled ? 1 : 0}"
              type="button"
            ></button>
            <button class="btn btn-small btn-soft" data-action="automation-module-config" data-key="${escapeHtml(
              item.key
            )}" type="button">Configurar</button>
          </div>
        </article>`;
        })
        .join('')
    : '<p class="placeholder">Nenhum modulo disponivel.</p>';

  refs.strikeTriggersList.innerHTML = triggers.length
    ? triggers
        .map((item) => {
          return `<article class="stack-item">
          <div class="stack-main">
            <strong>${escapeHtml(item.label || item.key)}</strong>
            <p>${escapeHtml(item.description || '-')}</p>
            <div class="panel-hint">${escapeHtml(
              `${item.strike_points || 1} strike${Number(item.strike_points || 1) > 1 ? 's' : ''}`
            )}</div>
          </div>
          <div class="stack-actions">
            <button
              class="toggle-switch ${item.enabled ? 'on' : ''}"
              data-action="strike-trigger-toggle"
              data-key="${escapeHtml(item.key)}"
              data-enabled="${item.enabled ? 1 : 0}"
              type="button"
            ></button>
            <button class="btn btn-small btn-soft" data-action="strike-trigger-config" data-key="${escapeHtml(
              item.key
            )}" type="button">Configurar</button>
          </div>
        </article>`;
        })
        .join('')
    : '<p class="placeholder">Nenhum gatilho disponivel.</p>';

  refs.strikeLadderList.innerHTML = ladder.length
    ? ladder
        .map((item) => {
          return `<article class="stack-item">
          <div class="stack-main">
            <strong>${escapeHtml(`${item.step}o Strike`)}</strong>
            <p>${escapeHtml(
              `Acao: ${String(item.action || 'warn').toUpperCase()} | Duracao: ${item.duration_minutes || 0} min`
            )}</p>
            <div class="panel-hint">${escapeHtml(shortText(item.message_template || '-', 96, 0))}</div>
          </div>
          <div class="stack-actions">
            <span class="badge ${item.enabled ? 'badge-ok' : 'badge-off'}">${item.enabled ? 'Ativo' : 'Off'}</span>
            <button class="btn btn-small btn-soft" data-action="strike-ladder-config" data-step="${
              item.step
            }" type="button">Configurar</button>
          </div>
        </article>`;
        })
        .join('')
    : '<p class="placeholder">Escada nao configurada.</p>';

  refs.whitelistList.innerHTML = whitelist.length
    ? whitelist
        .map((item) => {
          const value = item.target_type === 'username' ? `@${item.target_value}` : item.target_value;
          return `<article class="stack-item">
          <div class="stack-main">
            <strong>${escapeHtml(item.target_type)}</strong>
            <p>${escapeHtml(value || '-')}</p>
            <div class="panel-hint">${escapeHtml(item.note || 'Sem nota')}</div>
          </div>
          <div class="stack-actions">
            <button class="btn btn-small btn-danger" data-action="whitelist-remove" data-id="${item.id}" type="button">Remover</button>
          </div>
        </article>`;
        })
        .join('')
    : '<p class="placeholder">Nenhum usuario na whitelist.</p>';

  refs.moderationLogsList.innerHTML = logs.length
    ? logs
        .map((item) => {
          return `<article class="stack-item">
          <div class="stack-main">
            <strong>${escapeHtml(item.event_type || '-')}</strong>
            <p>${escapeHtml(item.reason || 'Sem motivo')}</p>
            <div class="panel-hint">${escapeHtml(
              `${new Date(item.created_at).toLocaleString('pt-BR')} | status ${item.status || '-'} | user ${
                item.user_id || '-'
              }`
            )}</div>
          </div>
          <div class="stack-actions">
            <span class="badge badge-soft">${escapeHtml(item.status || '-')}</span>
          </div>
        </article>`;
        })
        .join('')
    : '<p class="placeholder">Nenhum log de moderacao para o periodo.</p>';

  const panes = Array.from(document.querySelectorAll('[data-automation-pane]'));
  const tabs = Array.from(document.querySelectorAll('[data-automation-tab]'));
  panes.forEach((pane) => {
    pane.classList.toggle('active', pane.dataset.automationPane === state.automationTab);
  });
  tabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.automationTab === state.automationTab);
  });
};

const renderModeration = () => {
  if (!refs.moderationTableBody) {
    return;
  }

  const overview = state.moderation?.overview || state.automation?.overview || {};
  const logs = Array.isArray(state.moderation?.logs) ? state.moderation.logs : [];

  if (refs.modPending) {
    refs.modPending.textContent = formatCompact(overview.pending || 0);
  }
  if (refs.modBans) {
    refs.modBans.textContent = formatCompact(overview.bans || 0);
  }
  if (refs.modResolved) {
    refs.modResolved.textContent = formatCompact(overview.resolved || 0);
  }
  if (refs.modStrikes) {
    refs.modStrikes.textContent = formatCompact(overview.strikes || 0);
  }

  if (!logs.length) {
    refs.moderationTableBody.innerHTML =
      '<tr><td colspan="5" class="placeholder">Nenhuma denuncia pendente.</td></tr>';
    return;
  }

  refs.moderationTableBody.innerHTML = logs
    .map((item) => {
      const when = item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '-';
      return `<tr>
        <td>${escapeHtml(when)}</td>
        <td>${escapeHtml(item.event_type || '-')}</td>
        <td>${escapeHtml(item.user_id ? shortText(item.user_id, 6, 4) : '-')}</td>
        <td><span class="badge badge-soft">${escapeHtml(item.status || '-')}</span></td>
        <td>${escapeHtml(shortText(item.reason || '-', 56, 0))}</td>
      </tr>`;
    })
    .join('');
};

const renderBroadcastGroupChecklist = () => {
  if (!refs.broadcastGroupChecklist) {
    return;
  }

  const activeGroups = state.groups.filter((group) => isEnabled(group.enabled));
  if (!activeGroups.length) {
    refs.broadcastGroupChecklist.innerHTML = '<p class="placeholder">Nenhum grupo ativo para broadcast.</p>';
    return;
  }

  refs.broadcastGroupChecklist.innerHTML = activeGroups
    .map((group) => {
      return `<label class="group-check-item">
        <input type="checkbox" name="broadcast_group_id" value="${escapeHtml(group.chat_id)}" />
        <span>${escapeHtml(group.label)} (${escapeHtml(shortText(group.chat_id, 8, 5))})</span>
      </label>`;
    })
    .join('');
};

const renderBroadcasts = () => {
  if (!refs.broadcastsTbody) {
    return;
  }

  const rows = Array.isArray(state.broadcasts) ? state.broadcasts : [];
  if (!rows.length) {
    refs.broadcastsTbody.innerHTML = '<tr><td colspan="5" class="placeholder">Nenhum broadcast enviado.</td></tr>';
    return;
  }

  refs.broadcastsTbody.innerHTML = rows
    .map((item) => {
      return `<tr>
        <td>${escapeHtml(item.title || shortText(item.content || '-', 48, 0))}</td>
        <td><span class="badge badge-soft">${escapeHtml(item.status || '-')}</span></td>
        <td>${escapeHtml(formatNumber(item.sent_count || 0, 0))}</td>
        <td>${escapeHtml(formatNumber(item.fail_count || 0, 0))}</td>
        <td>${escapeHtml(item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '-')}</td>
      </tr>`;
    })
    .join('');
};

const renderTokens = () => {
  if (!state.tokens.length) {
    refs.tokensTbody.innerHTML = '<tr><td colspan="6" class="placeholder">Nenhum token cadastrado.</td></tr>';
    return;
  }

  refs.tokensTbody.innerHTML = state.tokens
    .map((token) => {
      const enabled = isEnabled(token.enabled);
      const buyMedia = String(token.buy_media_url || '').trim();
      return `<tr>
        <td>
          <strong>${escapeHtml(token.symbol)}</strong> ${escapeHtml(token.name)}
          <div class="panel-hint">${escapeHtml(shortText(token.address, 10, 6))}</div>
        </td>
        <td>${escapeHtml(getNetworkLabel(token.network))}</td>
        <td><span class="badge ${enabled ? 'badge-ok' : 'badge-off'}">${enabled ? 'Ativo' : 'Pausado'}</span></td>
        <td>${escapeHtml(shortText(token.pair_address, 10, 6))}</td>
        <td>
          ${
            buyMedia
              ? `<a class="hash-link" href="${escapeHtml(buyMedia)}" target="_blank" rel="noreferrer">${escapeHtml(
                  shortText(buyMedia, 18, 14)
                )}</a>`
              : '<span class="panel-hint">Sem imagem</span>'
          }
        </td>
        <td>
          <div class="actions">
            <button class="btn btn-small btn-soft" data-action="toggle-token" data-id="${token.id}" data-enabled="${
              enabled ? 1 : 0
            }" type="button">${enabled ? 'Pausar' : 'Ativar'}</button>
            <button class="btn btn-small btn-soft" data-action="upload-token-image" data-id="${
              token.id
            }" type="button">Upload</button>
            <button class="btn btn-small btn-ghost" data-action="clear-token-image" data-id="${
              token.id
            }" type="button">Limpar</button>
            <button class="btn btn-small btn-danger" data-action="delete-token" data-id="${token.id}" type="button">Excluir</button>
          </div>
        </td>
      </tr>`;
    })
    .join('');
};

const renderTransactions = () => {
  const txs = state.filteredTransactions;
  if (!txs.length) {
    refs.txTbody.innerHTML = '<tr><td colspan="7" class="placeholder">Sem compras no periodo.</td></tr>';
    return;
  }

  refs.txTbody.innerHTML = txs
    .map((tx) => {
      const explorer = (explorerByNetwork[tx.network] || '') + tx.hash;
      return `<tr>
        <td>${escapeHtml(new Date(tx.timestamp).toLocaleString('pt-BR'))}</td>
        <td>${escapeHtml(resolveTokenLabel(tx.token))}</td>
        <td>${escapeHtml(getNetworkLabel(tx.network))}</td>
        <td>${escapeHtml(shortText(tx.buyer, 6, 4))}</td>
        <td>${escapeHtml(formatNumber(tx.amount, 4))}</td>
        <td>${escapeHtml(formatUsd(tx.usd_value))}</td>
        <td><a class="hash-link" href="${escapeHtml(explorer)}" target="_blank" rel="noreferrer">${escapeHtml(
          shortText(tx.hash, 10, 8)
        )}</a></td>
      </tr>`;
    })
    .join('');
};

const renderSettings = () => {
  const runtime = state.settings?.runtime || {};
  const rawMinUsd =
    runtime.minUsdAlert ??
    state.stats?.minUsdAlert ??
    Number.parseFloat(state.settings?.settings?.min_usd_alert || '0') ??
    0;
  const minUsd = Number(rawMinUsd);
  refs.minUsdInput.value = Number.isFinite(minUsd) ? String(minUsd) : '0';

  const scheduleImageUrl = String(state.settings?.settings?.media_schedule_url || '').trim();
  refs.scheduleImageUrlInput.value = scheduleImageUrl;
};

const isLikelyVercelHost = () => {
  const host = String(window.location.hostname || '').toLowerCase();
  return host.endsWith('.vercel.app');
};

const ensureApiConnectivity = async ({ forcePrompt = false, allowPrompt = true, silent = false } = {}) => {
  const missingAuth = !state.apiBase || !state.authToken;
  const shouldPrompt = allowPrompt && (forcePrompt || missingAuth);

  if (shouldPrompt && !(await configureApiConnection({ forcePrompt }))) {
    return false;
  }

  if (!state.apiBase || !state.authToken) {
    return false;
  }

  try {
    const health = await apiFetch('/healthz', { skipAuth: true });
    if (!health?.ok) {
      throw new Error('API sem resposta');
    }
  } catch (error) {
    if (!silent) {
      showToast(`Falha ao acessar API (${error.message}).`, true);
    }
    return false;
  }

  try {
    await apiFetch('/api/stats');
    return true;
  } catch (error) {
    if (error?.status === 401) {
      if (!silent) {
        showToast('Credenciais invalidas. Reconfigure a conexao.', true);
      }
      return false;
    }

    if (!silent) {
      showToast(`Falha ao autenticar na API (${error.message}).`, true);
    }
    return false;
  }
};

const renderAll = () => {
  renderView();
  renderScopeChip();
  renderStats();
  renderTokenCloud();
  renderNetworkBreakdown();
  renderWhales();
  renderRuntimeMeta();
  renderGroups();
  renderMembers();
  renderCommands();
  renderSchedules();
  renderAutomation();
  renderModeration();
  renderBroadcastGroupChecklist();
  renderBroadcasts();
  renderTokens();
  renderTransactions();
  renderNetworkSelect();
  renderSettings();
};

const loadData = async ({ silent = false, suppressErrors = false } = {}) => {
  if (loadInFlight) {
    return loadInFlight;
  }

  loadInFlight = (async () => {
    try {
      if (!silent) {
        refs.statusLine.textContent = 'Atualizando dados...';
      }

      const days = state.periodDays;
      const [
        networksPayload,
        statsPayload,
        settingsPayload,
        groupsPayload,
        tokensPayload,
        transactionsPayload,
        membersPayload,
        commandsPayload,
        schedulesPayload,
        broadcastsPayload
      ] = await Promise.all([
        apiFetch('/api/networks'),
        apiFetch('/api/stats'),
        apiFetch('/api/settings'),
        apiFetch('/api/groups?includeDisabled=1'),
        apiFetch('/api/tokens?includeDisabled=1'),
        apiFetch('/api/transactions?limit=300'),
        apiFetch(`/api/members?days=${encodeURIComponent(days)}&limit=350`),
        apiFetch('/api/commands'),
        apiFetch('/api/schedules?limit=300'),
        apiFetch('/api/broadcasts?limit=200')
      ]);

      state.networks = networksPayload?.networks || [];
      state.stats = statsPayload || {};
      state.settings = settingsPayload || {};
      state.menuConfig = normalizeMenuConfig(
        safeJsonParse(state.settings?.settings?.menu_config, state.menuConfig || DEFAULT_MENU_CONFIG)
      );
      state.groups = (groupsPayload?.groups || []).map((group) => normalizeGroup(group));
      state.tokens = tokensPayload?.tokens || [];
      state.transactions = transactionsPayload?.transactions || [];
      state.members = membersPayload?.members || [];
      state.schedules = schedulesPayload?.schedules || [];
      state.broadcasts = broadcastsPayload?.broadcasts || [];
      setCommandCategories(commandsPayload?.categories || []);

      const activeGroup = getPrimaryActiveGroup();
      if (activeGroup?.id) {
        const [automationPayload, moderationPayload] = await Promise.all([
          apiFetch(`/api/groups/${activeGroup.id}/automation?limit=180`),
          apiFetch(`/api/moderation?groupId=${encodeURIComponent(activeGroup.id)}&limit=180`)
        ]);

        state.automation = {
          modules: automationPayload?.modules || [],
          strikeTriggers: automationPayload?.strikeTriggers || [],
          strikeLadder: automationPayload?.strikeLadder || [],
          whitelist: automationPayload?.whitelist || [],
          logs: automationPayload?.logs || [],
          overview: automationPayload?.overview || {
            pending: 0,
            resolved: 0,
            bans: 0,
            strikes: 0
          }
        };

        state.moderation = {
          overview: moderationPayload?.overview || state.automation.overview,
          logs: moderationPayload?.logs || state.automation.logs || []
        };
      } else {
        state.automation = {
          modules: [],
          strikeTriggers: [],
          strikeLadder: [],
          whitelist: [],
          logs: [],
          overview: {
            pending: 0,
            resolved: 0,
            bans: 0,
            strikes: 0
          }
        };
        state.moderation = {
          overview: {
            pending: 0,
            resolved: 0,
            bans: 0,
            strikes: 0
          },
          logs: []
        };
      }

      applyPeriodFilter();
      renderAll();
    } catch (error) {
      console.error(error);
      refs.statusLine.textContent = `Falha ao atualizar (${new Date().toLocaleTimeString('pt-BR')}) [API: ${state.apiBase}]`;
      if (error?.status === 401) {
        if (!suppressErrors) {
          showToast('Nao autorizado. Faca login novamente para atualizar credenciais.', true);
        }
        showLoginScreen('Sessao expirada ou credenciais invalidas. Faca login novamente.');
        return;
      }
      if (!suppressErrors) {
        showToast(`Erro ao carregar dados: ${error.message}`, true);
      }
    } finally {
      loadInFlight = null;
    }
  })();

  return loadInFlight;
};

const openPreviewModal = (command) => {
  if (!command) {
    showToast('Comando nao encontrado.', true);
    return;
  }

  refs.previewCommandName.textContent = command.name || '-';
  refs.previewCommandDescription.textContent = command.description || '-';
  refs.previewCommandKey.textContent = command.key || '-';
  refs.previewCommandAliases.textContent = command.aliases || '-';
  openModal(refs.previewModal);
};

const closePreviewModal = () => {
  closeModal(refs.previewModal);
};

const openGroupPermissionsModal = (group) => {
  if (!group) {
    showToast('Grupo nao encontrado.', true);
    return;
  }

  refs.groupPermissionsGroupIdInput.value = String(group.id || '');
  refs.groupPermissionsGroupLabel.textContent = `${group.label || '-'} (${shortText(group.chat_id, 8, 5)})`;
  renderPermissionSelector(refs.groupPermissionsChecklist, group.permissions, 'group_permission_edit');
  openModal(refs.groupPermissionsModal);
};

const closeGroupPermissionsModal = () => {
  closeModal(refs.groupPermissionsModal);
  refs.groupPermissionsForm.reset();
  refs.groupPermissionsGroupIdInput.value = '';
  refs.groupPermissionsGroupLabel.textContent = '-';
};

const openScheduleModal = (schedule = null) => {
  const editing = Boolean(schedule);
  refs.scheduleModalTitle.textContent = editing ? 'Editar Agendamento' : 'Agendar Mensagem';

  refs.scheduleForm.reset();
  refs.scheduleIdInput.value = editing ? String(schedule.id) : '';
  refs.scheduleKindSelect.value = editing ? schedule.kind || 'message' : 'message';
  refs.scheduleContentInput.value = editing ? schedule.content || '' : '';
  refs.scheduleMediaUrlInput.value = editing ? String(schedule.media_url || '').trim() : '';
  refs.scheduleRecurrenceSelect.value = editing ? schedule.recurrence || 'none' : 'none';
  refs.scheduleSendAtInput.value = editing
    ? toLocalDateTimeInput(schedule.send_at)
    : toLocalDateTimeInput(new Date(Date.now() + 10 * 60 * 1000).toISOString());

  const selectedGroups = editing
    ? parseGroupIds(schedule.group_ids)
    : state.groups.filter((item) => isEnabled(item.enabled)).slice(0, 1).map((item) => item.chat_id);

  renderScheduleGroupChecklist(selectedGroups);

  const status = editing ? String(schedule.status || 'pending') : 'pending';
  const existingOption = Array.from(refs.scheduleStatusSelect.options).some((option) => option.value === status);
  if (!existingOption) {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = status;
    refs.scheduleStatusSelect.append(option);
  }
  refs.scheduleStatusSelect.value = status;

  openModal(refs.scheduleModal);
};

const closeScheduleModal = () => {
  closeModal(refs.scheduleModal);
  refs.scheduleForm.reset();
  refs.scheduleIdInput.value = '';
};

const renderMenuButtonsEditor = () => {
  if (!menuDraftButtons.length) {
    refs.menuButtonsList.innerHTML = '<p class="placeholder">Adicione ao menos um botao para o menu.</p>';
    return;
  }

  refs.menuButtonsList.innerHTML = menuDraftButtons
    .map((button, index) => {
      return `<article class="menu-btn-item">
        <input class="emoji-input" data-menu-field="emoji" data-id="${button.id}" type="text" maxlength="4" value="${escapeHtml(
          button.emoji
        )}" placeholder="⭐" />
        <input data-menu-field="label" data-id="${button.id}" type="text" value="${escapeHtml(
          button.label
        )}" placeholder="Nome do botao" />
        <input data-menu-field="command" data-id="${button.id}" type="text" value="${escapeHtml(
          button.command
        )}" placeholder="!comando" />
        <div class="menu-btn-actions">
          <button class="btn btn-ghost btn-small" data-action="menu-btn-up" data-id="${button.id}" ${
            index === 0 ? 'disabled' : ''
          } type="button">^</button>
          <button class="btn btn-ghost btn-small" data-action="menu-btn-down" data-id="${button.id}" ${
            index === menuDraftButtons.length - 1 ? 'disabled' : ''
          } type="button">v</button>
          <button class="btn btn-danger btn-small" data-action="menu-btn-remove" data-id="${
            button.id
          }" type="button">X</button>
        </div>
      </article>`;
    })
    .join('');
};

const renderMenuPreview = () => {
  const greeting = String(refs.menuGreetingInput.value || '').trim();
  const siteUrl = String(refs.menuUrlInput.value || '').trim();
  const description = String(refs.menuDescriptionInput.value || '').trim();

  refs.menuPreviewGreeting.textContent = greeting || '-';
  refs.menuPreviewUrl.textContent = siteUrl ? `Saiba mais: ${siteUrl}` : '-';
  refs.menuPreviewDescription.textContent = description || '-';

  const validButtons = menuDraftButtons.filter((button) => button.label && button.command).slice(0, 10);
  refs.menuPreviewButtons.innerHTML = validButtons
    .map((button) => {
      const emoji = button.emoji ? `${button.emoji} ` : '';
      return `<div class="menu-preview-button">${escapeHtml(emoji)}${escapeHtml(button.label)}</div>`;
    })
    .join('');
};

const readMenuConfigFromForm = () => {
  return normalizeMenuConfig({
    greeting: refs.menuGreetingInput.value,
    siteUrl: refs.menuUrlInput.value,
    description: refs.menuDescriptionInput.value,
    buttons: menuDraftButtons
  });
};

const openMenuBuilderModal = () => {
  const config = normalizeMenuConfig(state.menuConfig || DEFAULT_MENU_CONFIG);
  refs.menuGreetingInput.value = config.greeting;
  refs.menuUrlInput.value = config.siteUrl;
  refs.menuDescriptionInput.value = config.description;
  menuDraftButtons = config.buttons.map((button) => ({ ...button }));
  renderMenuButtonsEditor();
  renderMenuPreview();
  openModal(refs.menuBuilderModal);
};

const closeMenuBuilderModal = () => {
  closeModal(refs.menuBuilderModal);
};

const handleMenuBuilderSave = async () => {
  const config = readMenuConfigFromForm();
  if (!config.buttons.length) {
    showToast('Adicione ao menos um botao valido no menu.', true);
    return;
  }

  await apiFetch('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ menuConfig: config })
  });

  state.menuConfig = config;
  closeMenuBuilderModal();
  showToast('Menu inicial salvo com sucesso.');
  await loadData({ silent: true });
};

const setCurrentView = (view) => {
  if (!view) {
    return;
  }
  state.currentView = view;
  renderView();
};

const closeTour = () => {
  refs.tourOverlay.hidden = true;
  tourIndex = -1;
  closePreviewModal();
  closeGroupPermissionsModal();
  closeMenuBuilderModal();
  closeScheduleModal();
};

const positionTourElements = (target) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (!target) {
    refs.tourSpotlight.style.display = 'none';
    refs.tourCursor.style.display = 'none';
    refs.tourTooltip.style.left = `${Math.max(12, viewportWidth * 0.5 - 190)}px`;
    refs.tourTooltip.style.top = `${Math.max(12, viewportHeight * 0.5 - 90)}px`;
    return;
  }

  const rect = target.getBoundingClientRect();
  const pad = 8;

  refs.tourSpotlight.style.display = 'block';
  refs.tourSpotlight.style.left = `${Math.max(4, rect.left - pad)}px`;
  refs.tourSpotlight.style.top = `${Math.max(4, rect.top - pad)}px`;
  refs.tourSpotlight.style.width = `${Math.max(28, rect.width + pad * 2)}px`;
  refs.tourSpotlight.style.height = `${Math.max(24, rect.height + pad * 2)}px`;

  refs.tourCursor.style.display = 'block';
  refs.tourCursor.style.left = `${Math.max(4, rect.left + Math.min(rect.width * 0.75, rect.width - 26))}px`;
  refs.tourCursor.style.top = `${Math.max(4, rect.top + Math.min(rect.height * 0.8, rect.height - 26))}px`;

  const tooltipWidth = Math.min(420, viewportWidth - 22);
  const preferredLeft = rect.left;
  const left = Math.min(Math.max(12, preferredLeft), viewportWidth - tooltipWidth - 12);
  const below = rect.bottom + 16;
  const above = rect.top - 148;
  const top = below + 130 <= viewportHeight ? below : Math.max(12, above);

  refs.tourTooltip.style.left = `${left}px`;
  refs.tourTooltip.style.top = `${top}px`;
};

const renderTourStep = () => {
  const step = TOUR_STEPS[tourIndex];
  if (!step) {
    closeTour();
    return;
  }

  setCurrentView(step.view);

  if (step.selector !== '#previewModal' && !refs.previewModal.hidden) {
    closePreviewModal();
  }
  if (step.selector !== '#groupPermissionsModal' && !refs.groupPermissionsModal.hidden) {
    closeGroupPermissionsModal();
  }
  if (step.selector !== '#menuBuilderModal' && !refs.menuBuilderModal.hidden) {
    closeMenuBuilderModal();
  }
  if (step.selector !== '#scheduleModal' && !refs.scheduleModal.hidden) {
    closeScheduleModal();
  }

  if (step.selector === '#previewModal' && refs.previewModal.hidden) {
    const firstCommand = state.commandCategories[0]?.items?.[0];
    if (firstCommand) {
      openPreviewModal(firstCommand);
    }
  }

  if (step.selector === '#menuBuilderModal' && refs.menuBuilderModal.hidden) {
    openMenuBuilderModal();
  }

  if (step.selector === '#scheduleModal' && refs.scheduleModal.hidden) {
    openScheduleModal();
  }

  refs.tourStepText.textContent = step.text;
  refs.tourNextBtn.textContent = tourIndex >= TOUR_STEPS.length - 1 ? 'Concluir' : 'Proximo';
  refs.tourOverlay.hidden = false;

  requestAnimationFrame(() => {
    const target = document.querySelector(step.selector);
    positionTourElements(target);
  });
};

const startTour = () => {
  tourIndex = 0;
  renderTourStep();
};

const nextTourStep = () => {
  if (tourIndex >= TOUR_STEPS.length - 1) {
    closeTour();
    return;
  }
  tourIndex += 1;
  renderTourStep();
};

const handleGroupPermissionsSave = async () => {
  const groupId = Number(refs.groupPermissionsGroupIdInput.value || 0);
  const group = state.groups.find((item) => Number(item.id) === groupId);
  if (!group) {
    showToast('Grupo nao encontrado.', true);
    return;
  }

  const permissions = readPermissionsFromContainer(refs.groupPermissionsChecklist, 'group_permission_edit');

  await apiFetch(`/api/groups/${groupId}`, {
    method: 'PUT',
    body: JSON.stringify({ permissions })
  });

  closeGroupPermissionsModal();
  showToast('Permissoes atualizadas.');
  await loadData({ silent: true });
};

const buildTokenUpdatePayload = (token, overrides = {}) => {
  return {
    name: String(token?.name || '').trim(),
    symbol: String(token?.symbol || '').trim().toUpperCase(),
    address: String(token?.address || '').trim(),
    network: String(token?.network || '').trim().toLowerCase(),
    pair_address: String(token?.pair_address || '').trim(),
    decimals: Number(token?.decimals),
    enabled: isEnabled(token?.enabled),
    buy_media_url: normalizeOptionalMediaUrl(
      overrides.buy_media_url !== undefined ? overrides.buy_media_url : token?.buy_media_url || '',
      'URL de imagem do token'
    )
  };
};

const updateTokenImage = async (tokenId, buyMediaUrl) => {
  const id = Number(tokenId);
  const token = state.tokens.find((item) => Number(item.id) === id);
  if (!token) {
    throw new Error('Token nao encontrado.');
  }

  const payload = buildTokenUpdatePayload(token, { buy_media_url: buyMediaUrl });
  await apiFetch(`/api/tokens/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
};

const handleTokenCreate = async () => {
  const formData = new FormData(refs.tokenForm);
  const payload = {
    name: String(formData.get('name') || '').trim(),
    symbol: String(formData.get('symbol') || '').trim().toUpperCase(),
    network: String(formData.get('network') || '').trim().toLowerCase(),
    address: String(formData.get('address') || '').trim(),
    pair_address: String(formData.get('pair_address') || '').trim(),
    buy_media_url: normalizeOptionalMediaUrl(formData.get('buy_media_url') || '', 'URL de imagem do token'),
    decimals: Number(formData.get('decimals'))
  };

  if (
    !payload.name ||
    !payload.symbol ||
    !payload.network ||
    !payload.address ||
    !payload.pair_address ||
    !Number.isInteger(payload.decimals)
  ) {
    showToast('Preencha todos os campos do token.', true);
    return;
  }

  await apiFetch('/api/tokens', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  refs.tokenForm.reset();
  if (refs.tokenBuyImageUrlInput) {
    refs.tokenBuyImageUrlInput.value = '';
  }
  if (refs.tokenBuyImageFileInput) {
    refs.tokenBuyImageFileInput.value = '';
  }
  renderNetworkSelect();
  showToast('Token cadastrado com sucesso.');
  await loadData({ silent: true });
};

const handleSettingsSave = async () => {
  const minUsdAlert = Number(refs.minUsdInput.value);
  if (!Number.isFinite(minUsdAlert) || minUsdAlert < 0) {
    showToast('Filtro minimo invalido.', true);
    return;
  }

  const scheduleImageUrl = normalizeOptionalMediaUrl(
    refs.scheduleImageUrlInput.value || '',
    'URL de imagem de lembretes'
  );

  await apiFetch('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({
      minUsdAlert,
      scheduleImageUrl
    })
  });

  showToast('Configuracoes salvas.');
  await loadData({ silent: true });
};

const handleScheduleSave = async () => {
  const id = Number(refs.scheduleIdInput.value || 0);
  const selectedGroups = Array.from(
    refs.scheduleGroupChecklist.querySelectorAll('input[name="schedule_group_id"]:checked')
  ).map((element) => String(element.value).trim());

  if (!selectedGroups.length) {
    showToast('Selecione ao menos um grupo.', true);
    return;
  }

  const localDate = refs.scheduleSendAtInput.value;
  const parsed = new Date(localDate);
  if (Number.isNaN(parsed.getTime())) {
    showToast('Data/hora invalida.', true);
    return;
  }

  const payload = {
    kind: refs.scheduleKindSelect.value,
    content: String(refs.scheduleContentInput.value || '').trim(),
    media_url: normalizeOptionalMediaUrl(refs.scheduleMediaUrlInput.value || '', 'URL de imagem do agendamento'),
    group_ids: selectedGroups,
    send_at: parsed.toISOString(),
    recurrence: refs.scheduleRecurrenceSelect.value,
    status: refs.scheduleStatusSelect.value
  };

  if (!payload.content) {
    showToast('Mensagem obrigatoria.', true);
    return;
  }

  if (id > 0) {
    await apiFetch(`/api/schedules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    showToast('Agendamento atualizado.');
  } else {
    await apiFetch('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    showToast('Agendamento criado.');
  }

  closeScheduleModal();
  await loadData({ silent: true });
};

const getActiveGroupForAutomation = () => {
  const active = getPrimaryActiveGroup();
  if (!active?.id) {
    throw new Error('Nenhum grupo ativo para automacao.');
  }
  return active;
};

const refreshAutomationLogs = async () => {
  const group = getActiveGroupForAutomation();
  const eventType = String(refs.moderationLogTypeFilter?.value || '').trim();
  const status = String(refs.moderationLogStatusFilter?.value || '').trim();
  const query = new URLSearchParams();
  query.set('limit', '200');
  if (eventType) {
    query.set('eventType', eventType);
  }
  if (status) {
    query.set('status', status);
  }

  const payload = await apiFetch(`/api/groups/${group.id}/automation/logs?${query.toString()}`);
  state.automation.logs = payload?.logs || [];
  state.moderation.logs = state.automation.logs;
  renderAutomation();
  renderModeration();
};

const getSelectedBroadcastGroups = () => {
  if (!refs.broadcastGroupChecklist) {
    return [];
  }
  return Array.from(refs.broadcastGroupChecklist.querySelectorAll('input[name="broadcast_group_id"]:checked'))
    .map((element) => String(element.value || '').trim())
    .filter(Boolean);
};

const handleBroadcastSave = async () => {
  const payload = {
    title: String(refs.broadcastTitleInput?.value || '').trim(),
    content: String(refs.broadcastContentInput?.value || '').trim(),
    media_url: normalizeOptionalMediaUrl(refs.broadcastMediaUrlInput?.value || '', 'URL de imagem do broadcast'),
    group_ids: getSelectedBroadcastGroups()
  };

  if (!payload.content) {
    throw new Error('Mensagem de broadcast obrigatoria.');
  }

  await apiFetch('/api/broadcasts', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  showToast('Broadcast enviado.');
  refs.broadcastForm?.reset();
  await loadData({ silent: true });
};

const handleLoginSubmit = async () => {
  const apiBase = normalizeApiBase(refs.loginApiUrlInput?.value || '');
  const authUser = String(refs.loginUserInput?.value || '').trim();
  const authPass = String(refs.loginPasswordInput?.value || '');

  if (!apiBase) {
    throw new Error('Informe a URL da API.');
  }

  if (!authUser) {
    throw new Error('Informe o usuario admin.');
  }

  if (!authPass) {
    throw new Error('Informe a senha admin.');
  }

  setApiConnectionState({
    apiBase,
    authUser,
    authToken: toBasicToken(authUser, authPass)
  });

  const connected = await ensureApiConnectivity({ forcePrompt: false, allowPrompt: false });
  if (!connected) {
    throw new Error('Nao foi possivel autenticar com a API.');
  }

  hideLoginScreen();
  refs.statusLine.textContent = `Conectado em ${state.apiBase}. Carregando dados...`;
  await loadData();
  startAutoRefresh();
  showToast('Login realizado com sucesso.');
};

const bindEvents = () => {
  if (refs.loginForm) {
    refs.loginForm.addEventListener('submit', (event) => {
      event.preventDefault();
      setLoginError('');
      withButtonLock(getSubmitButton(event), handleLoginSubmit).catch((error) => {
        setLoginError(error.message || 'Falha ao realizar login.');
      });
    });
  }

  if (refs.loginCancelBtn) {
    refs.loginCancelBtn.addEventListener('click', () => {
      hideLoginScreen();
    });
  }

  if (refs.actionsMenuBtn) {
    refs.actionsMenuBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleActionsMenu();
    });
  }

  if (refs.actionsMenu) {
    refs.actionsMenu.addEventListener('click', (event) => {
      event.stopPropagation();
    });
  }

  if (refs.openLoginBtn) {
    refs.openLoginBtn.addEventListener('click', () => {
      closeActionsMenu();
      showLoginScreen('Atualize as credenciais para reconectar a API.', { allowBack: true });
      refs.loginApiUrlInput?.focus();
    });
  }

  if (refs.themeSelect) {
    refs.themeSelect.addEventListener('change', (event) => {
      applyTheme(event.target.value, { persist: true });
      closeActionsMenu();
    });
  }

  refs.navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      closeActionsMenu();
      state.currentView = button.dataset.navView || 'overview';
      renderView();
      if (state.currentView === 'automation') {
        renderAutomation();
      } else if (state.currentView === 'moderation') {
        renderModeration();
      } else if (state.currentView === 'broadcast') {
        renderBroadcastGroupChecklist();
        renderBroadcasts();
      }
    });
  });

  refs.periodSelect.addEventListener('change', async () => {
    state.periodDays = daysFromSelection();
    applyPeriodFilter();
    renderStats();
    renderTokenCloud();
    renderNetworkBreakdown();
    renderWhales();
    renderTransactions();
    await loadData({ silent: true });
  });

  refs.reloadBtn.addEventListener('click', () =>
    withButtonLock(refs.reloadBtn, async () => {
      await loadData();
      showToast('Dados atualizados.');
    })
  );

  refs.testAlertBtn.addEventListener('click', () =>
    withButtonLock(refs.testAlertBtn, async () => {
      closeActionsMenu();
      const activeGroup = state.groups.find((group) => isEnabled(group.enabled));
      const tokenWithMedia = state.tokens.find((item) => String(item.buy_media_url || '').trim());
      const mediaUrl = normalizeOptionalMediaUrl(
        tokenWithMedia?.buy_media_url || state.settings?.settings?.media_buy_alert_url || ''
      );
      await apiFetch('/api/test-alert', {
        method: 'POST',
        body: JSON.stringify({
          chatId: activeGroup ? activeGroup.chat_id : '',
          message: `Teste manual do painel - ${new Date().toLocaleString('pt-BR')}`,
          mediaUrl: mediaUrl || undefined
        })
      });
      showToast('Teste enviado.');
    })
  );

  refs.exportBtn.addEventListener('click', () => {
    closeActionsMenu();
    window.print();
  });

  refs.groupSearchInput.addEventListener('input', (event) => {
    state.groupSearch = event.target.value || '';
    renderGroups();
  });

  refs.memberSearchInput.addEventListener('input', (event) => {
    state.memberSearch = event.target.value || '';
    renderMembers();
  });

  refs.commandSearchInput.addEventListener('input', (event) => {
    state.commandSearch = event.target.value || '';
    renderCommands();
  });

  refs.scheduleSearchInput.addEventListener('input', (event) => {
    state.scheduleSearch = event.target.value || '';
    renderSchedules();
  });

  if (refs.automationTabs) {
    refs.automationTabs.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-automation-tab]');
      if (!tab) {
        return;
      }
      state.automationTab = tab.dataset.automationTab || 'modules';
      renderAutomation();
    });
  }

  if (refs.whitelistForm) {
    refs.whitelistForm.addEventListener('submit', (event) => {
      event.preventDefault();
      withButtonLock(getSubmitButton(event), async () => {
        const group = getActiveGroupForAutomation();
        await apiFetch(`/api/groups/${group.id}/automation/whitelist`, {
          method: 'POST',
          body: JSON.stringify({
            target_type: refs.whitelistTypeInput.value,
            target_value: refs.whitelistValueInput.value,
            note: refs.whitelistNoteInput.value
          })
        });
        refs.whitelistForm.reset();
        showToast('Whitelist atualizada.');
        await loadData({ silent: true });
      }).catch((error) => {
        showToast(error.message || 'Falha ao adicionar whitelist.', true);
      });
    });
  }

  if (refs.refreshAutomationLogsBtn) {
    refs.refreshAutomationLogsBtn.addEventListener('click', () =>
      withButtonLock(refs.refreshAutomationLogsBtn, async () => {
        await refreshAutomationLogs();
        showToast('Logs atualizados.');
      }).catch((error) => {
        showToast(error.message || 'Falha ao atualizar logs.', true);
      })
    );
  }

  if (refs.moderationLogTypeFilter) {
    refs.moderationLogTypeFilter.addEventListener('change', () => {
      refreshAutomationLogs().catch((error) => {
        showToast(error.message || 'Falha ao filtrar logs.', true);
      });
    });
  }

  if (refs.moderationLogStatusFilter) {
    refs.moderationLogStatusFilter.addEventListener('change', () => {
      refreshAutomationLogs().catch((error) => {
        showToast(error.message || 'Falha ao filtrar logs.', true);
      });
    });
  }

  refs.groupPermissionsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    withButtonLock(getSubmitButton(event), handleGroupPermissionsSave).catch((error) => {
      showToast(error.message || 'Erro ao salvar permissoes.', true);
    });
  });

  refs.tokenForm.addEventListener('submit', (event) => {
    event.preventDefault();
    withButtonLock(getSubmitButton(event), handleTokenCreate).catch((error) => {
      showToast(error.message || 'Erro ao salvar token.', true);
    });
  });

  if (refs.tokenBuyImageUploadBtn && refs.tokenBuyImageFileInput) {
    refs.tokenBuyImageUploadBtn.addEventListener('click', () => {
      pendingTokenImageUploadId = 0;
      refs.tokenBuyImageFileInput.value = '';
      refs.tokenBuyImageFileInput.click();
    });

    refs.tokenBuyImageFileInput.addEventListener('change', () => {
      withButtonLock(refs.tokenBuyImageUploadBtn, async () => {
        const file = refs.tokenBuyImageFileInput.files?.[0];
        if (!file) {
          return;
        }

        const targetTokenId = Number(pendingTokenImageUploadId || 0);
        const uploaded = await uploadImageFile(file, {
          scope: 'token-buy',
          fileName: file.name
        });

        if (targetTokenId > 0) {
          await updateTokenImage(targetTokenId, uploaded.url);
          showToast('Imagem de compra atualizada para o token.');
          await loadData({ silent: true });
        } else {
          refs.tokenBuyImageUrlInput.value = uploaded.url;
          showToast('Imagem do token enviada. Agora salve o token.');
        }

        pendingTokenImageUploadId = 0;
        refs.tokenBuyImageFileInput.value = '';
      }).catch((error) => {
        pendingTokenImageUploadId = 0;
        refs.tokenBuyImageFileInput.value = '';
        showToast(error.message || 'Falha no upload da imagem do token.', true);
      });
    });
  }

  refs.settingsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    withButtonLock(getSubmitButton(event), handleSettingsSave).catch((error) => {
      showToast(error.message || 'Erro ao salvar configuracoes.', true);
    });
  });

  if (refs.scheduleImageUploadBtn && refs.scheduleImageFileInput) {
    refs.scheduleImageUploadBtn.addEventListener('click', () => {
      refs.scheduleImageFileInput.value = '';
      refs.scheduleImageFileInput.click();
    });

    refs.scheduleImageFileInput.addEventListener('change', () => {
      withButtonLock(refs.scheduleImageUploadBtn, async () => {
        const file = refs.scheduleImageFileInput.files?.[0];
        if (!file) {
          return;
        }

        const uploaded = await uploadImageFile(file, {
          scope: 'schedule-default',
          fileName: file.name
        });
        refs.scheduleImageUrlInput.value = uploaded.url;
        refs.scheduleImageFileInput.value = '';
        showToast('Imagem de avisos enviada. Clique em Salvar.');
      }).catch((error) => {
        refs.scheduleImageFileInput.value = '';
        showToast(error.message || 'Falha no upload da imagem de avisos.', true);
      });
    });
  }

  if (refs.scheduleMediaUploadBtn && refs.scheduleMediaFileInput) {
    refs.scheduleMediaUploadBtn.addEventListener('click', () => {
      refs.scheduleMediaFileInput.value = '';
      refs.scheduleMediaFileInput.click();
    });

    refs.scheduleMediaFileInput.addEventListener('change', () => {
      withButtonLock(refs.scheduleMediaUploadBtn, async () => {
        const file = refs.scheduleMediaFileInput.files?.[0];
        if (!file) {
          return;
        }

        const uploaded = await uploadImageFile(file, {
          scope: 'schedule-item',
          fileName: file.name
        });
        refs.scheduleMediaUrlInput.value = uploaded.url;
        refs.scheduleMediaFileInput.value = '';
        showToast('Imagem do agendamento enviada.');
      }).catch((error) => {
        refs.scheduleMediaFileInput.value = '';
        showToast(error.message || 'Falha no upload da imagem do agendamento.', true);
      });
    });
  }

  if (refs.broadcastMediaUploadBtn && refs.broadcastMediaFileInput) {
    refs.broadcastMediaUploadBtn.addEventListener('click', () => {
      refs.broadcastMediaFileInput.value = '';
      refs.broadcastMediaFileInput.click();
    });

    refs.broadcastMediaFileInput.addEventListener('change', () => {
      withButtonLock(refs.broadcastMediaUploadBtn, async () => {
        const file = refs.broadcastMediaFileInput.files?.[0];
        if (!file) {
          return;
        }

        const uploaded = await uploadImageFile(file, {
          scope: 'broadcast',
          fileName: file.name
        });
        refs.broadcastMediaUrlInput.value = uploaded.url;
        refs.broadcastMediaFileInput.value = '';
        showToast('Imagem de broadcast enviada.');
      }).catch((error) => {
        refs.broadcastMediaFileInput.value = '';
        showToast(error.message || 'Falha no upload de broadcast.', true);
      });
    });
  }

  if (refs.broadcastForm) {
    refs.broadcastForm.addEventListener('submit', (event) => {
      event.preventDefault();
      withButtonLock(getSubmitButton(event), handleBroadcastSave).catch((error) => {
        showToast(error.message || 'Erro ao enviar broadcast.', true);
      });
    });
  }

  refs.commandsEnableAllBtn.addEventListener('click', () =>
    withButtonLock(refs.commandsEnableAllBtn, async () => {
      await apiFetch('/api/commands/bulk/enabled', {
        method: 'PATCH',
        body: JSON.stringify({ enabled: true })
      });
      await syncSecurityLocksBulk(true);
      showToast('Todos os comandos foram ativados.');
      await loadData({ silent: true });
    }).catch((error) => {
      showToast(error.message || 'Erro ao ativar comandos.', true);
    })
  );

  refs.commandsDisableAllBtn.addEventListener('click', () =>
    withButtonLock(refs.commandsDisableAllBtn, async () => {
      await apiFetch('/api/commands/bulk/enabled', {
        method: 'PATCH',
        body: JSON.stringify({ enabled: false })
      });
      await syncSecurityLocksBulk(false);
      showToast('Todos os comandos foram desativados.');
      await loadData({ silent: true });
    }).catch((error) => {
      showToast(error.message || 'Erro ao desativar comandos.', true);
    })
  );

  refs.openMenuBuilderBtn.addEventListener('click', () => {
    openMenuBuilderModal();
  });

  refs.openScheduleModalBtn.addEventListener('click', () => {
    openScheduleModal();
  });

  refs.menuGreetingInput.addEventListener('input', () => {
    renderMenuPreview();
  });

  refs.menuUrlInput.addEventListener('input', () => {
    renderMenuPreview();
  });

  refs.menuDescriptionInput.addEventListener('input', () => {
    renderMenuPreview();
  });

  refs.menuAddButtonBtn.addEventListener('click', () => {
    if (menuDraftButtons.length >= 10) {
      showToast('Limite maximo de 10 botoes.', true);
      return;
    }

    menuDraftButtons.push({
      id: createMenuButtonId(),
      emoji: '⭐',
      label: 'Novo Botao',
      command: '!novo'
    });

    renderMenuButtonsEditor();
    renderMenuPreview();
  });

  refs.menuButtonsList.addEventListener('input', (event) => {
    const field = event.target?.dataset?.menuField;
    const id = event.target?.dataset?.id;
    if (!field || !id) {
      return;
    }

    const target = menuDraftButtons.find((button) => button.id === id);
    if (!target) {
      return;
    }

    if (field === 'emoji') {
      target[field] = String(event.target.value || '').slice(0, 4);
    } else {
      target[field] = String(event.target.value || '');
    }

    renderMenuPreview();
  });

  refs.menuBuilderForm.addEventListener('submit', (event) => {
    event.preventDefault();
    withButtonLock(getSubmitButton(event), handleMenuBuilderSave).catch((error) => {
      showToast(error.message || 'Erro ao salvar menu.', true);
    });
  });

  refs.scheduleForm.addEventListener('submit', (event) => {
    event.preventDefault();
    withButtonLock(getSubmitButton(event), handleScheduleSave).catch((error) => {
      showToast(error.message || 'Erro ao salvar agendamento.', true);
    });
  });

  refs.previewCloseBtn.addEventListener('click', closePreviewModal);
  refs.groupPermissionsCloseBtn.addEventListener('click', closeGroupPermissionsModal);
  refs.groupPermissionsCancelBtn.addEventListener('click', closeGroupPermissionsModal);
  refs.scheduleCloseBtn.addEventListener('click', closeScheduleModal);
  refs.scheduleCancelBtn.addEventListener('click', closeScheduleModal);
  refs.menuBuilderCloseBtn.addEventListener('click', closeMenuBuilderModal);
  refs.menuBuilderCancelBtn.addEventListener('click', closeMenuBuilderModal);

  refs.tourStartBtn.addEventListener('click', () => {
    startTour();
  });
  refs.tourNextBtn.addEventListener('click', () => {
    nextTourStep();
  });
  refs.tourSkipBtn.addEventListener('click', () => {
    closeTour();
  });

  refs.previewModal.addEventListener('click', (event) => {
    if (event.target === refs.previewModal) {
      closePreviewModal();
    }
  });

  refs.groupPermissionsModal.addEventListener('click', (event) => {
    if (event.target === refs.groupPermissionsModal) {
      closeGroupPermissionsModal();
    }
  });

  refs.scheduleModal.addEventListener('click', (event) => {
    if (event.target === refs.scheduleModal) {
      closeScheduleModal();
    }
  });

  refs.menuBuilderModal.addEventListener('click', (event) => {
    if (event.target === refs.menuBuilderModal) {
      closeMenuBuilderModal();
    }
  });

  refs.tourOverlay.addEventListener('click', (event) => {
    if (event.target === refs.tourOverlay) {
      closeTour();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    if (!refs.scheduleModal.hidden) {
      closeScheduleModal();
    }
    if (!refs.menuBuilderModal.hidden) {
      closeMenuBuilderModal();
    }
    if (!refs.previewModal.hidden) {
      closePreviewModal();
    }
    if (!refs.groupPermissionsModal.hidden) {
      closeGroupPermissionsModal();
    }
    if (!refs.tourOverlay.hidden) {
      closeTour();
    }
    closeActionsMenu();
  });

  document.addEventListener('click', (event) => {
    closeActionsMenu();

    const trigger = event.target.closest('[data-action]');
    if (!trigger) {
      return;
    }

    const action = trigger.dataset.action;

    if (action === 'accordion-toggle') {
      const category = trigger.dataset.category || '';
      if (state.openCommandCategories.has(category)) {
        state.openCommandCategories.delete(category);
      } else {
        state.openCommandCategories.add(category);
      }
      renderCommands();
      return;
    }

    withButtonLock(trigger, async () => {
      if (action === 'menu-btn-up') {
        const id = String(trigger.dataset.id || '');
        const index = menuDraftButtons.findIndex((button) => button.id === id);
        if (index > 0) {
          const [item] = menuDraftButtons.splice(index, 1);
          menuDraftButtons.splice(index - 1, 0, item);
          renderMenuButtonsEditor();
          renderMenuPreview();
        }
        return;
      }

      if (action === 'menu-btn-down') {
        const id = String(trigger.dataset.id || '');
        const index = menuDraftButtons.findIndex((button) => button.id === id);
        if (index >= 0 && index < menuDraftButtons.length - 1) {
          const [item] = menuDraftButtons.splice(index, 1);
          menuDraftButtons.splice(index + 1, 0, item);
          renderMenuButtonsEditor();
          renderMenuPreview();
        }
        return;
      }

      if (action === 'menu-btn-remove') {
        const id = String(trigger.dataset.id || '');
        menuDraftButtons = menuDraftButtons.filter((button) => button.id !== id);
        renderMenuButtonsEditor();
        renderMenuPreview();
        return;
      }

      if (action === 'toggle-group') {
        const id = Number(trigger.dataset.id);
        const enabled = trigger.dataset.enabled === '1';
        await apiFetch(`/api/groups/${id}/enabled`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled: !enabled })
        });
        showToast(`Grupo ${enabled ? 'pausado' : 'ativado'}.`);
        await loadData({ silent: true });
        return;
      }

      if (action === 'group-authorize-all') {
        const id = Number(trigger.dataset.id);
        await apiFetch(`/api/groups/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ permissions: DEFAULT_GROUP_PERMISSIONS })
        });
        showToast('Todas as funcoes foram autorizadas para o grupo.');
        await loadData({ silent: true });
        return;
      }

      if (action === 'group-deny-all') {
        const id = Number(trigger.dataset.id);
        await apiFetch(`/api/groups/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ permissions: [] })
        });
        showToast('Todas as funcoes foram negadas para o grupo.');
        await loadData({ silent: true });
        return;
      }

      if (action === 'edit-group-permissions') {
        const id = Number(trigger.dataset.id);
        const group = state.groups.find((item) => Number(item.id) === id);
        openGroupPermissionsModal(group);
        return;
      }

      if (action === 'delete-group') {
        const id = Number(trigger.dataset.id);
        if (!window.confirm('Excluir este grupo?')) {
          return;
        }
        await apiFetch(`/api/groups/${id}`, { method: 'DELETE' });
        showToast('Grupo excluido.');
        await loadData({ silent: true });
        return;
      }

      if (action === 'automation-module-toggle') {
        const group = getActiveGroupForAutomation();
        const key = String(trigger.dataset.key || '').trim();
        const enabled = trigger.dataset.enabled === '1';
        await apiFetch(`/api/groups/${group.id}/automation/modules`, {
          method: 'PUT',
          body: JSON.stringify({
            key,
            enabled: !enabled
          })
        });
        showToast(`Modulo ${!enabled ? 'ativado' : 'desativado'}.`);
        await loadData({ silent: true });
        return;
      }

      if (action === 'automation-module-config') {
        const group = getActiveGroupForAutomation();
        const key = String(trigger.dataset.key || '').trim();
        const current = (state.automation?.modules || []).find((item) => item.key === key);
        const initial = JSON.stringify(current?.config || {}, null, 2);
        const raw = window.prompt(`Config JSON para modulo "${key}"`, initial);
        if (raw === null) {
          return;
        }
        let config = {};
        try {
          config = JSON.parse(raw || '{}');
        } catch (_error) {
          throw new Error('JSON invalido para configuracao do modulo.');
        }

        await apiFetch(`/api/groups/${group.id}/automation/modules`, {
          method: 'PUT',
          body: JSON.stringify({
            key,
            enabled: current?.enabled ?? true,
            config
          })
        });
        showToast('Configuracao do modulo salva.');
        await loadData({ silent: true });
        return;
      }

      if (action === 'strike-trigger-toggle') {
        const group = getActiveGroupForAutomation();
        const key = String(trigger.dataset.key || '').trim();
        const enabled = trigger.dataset.enabled === '1';
        const current = (state.automation?.strikeTriggers || []).find((item) => item.key === key);
        await apiFetch(`/api/groups/${group.id}/automation/strike-triggers`, {
          method: 'PUT',
          body: JSON.stringify({
            key,
            enabled: !enabled,
            strike_points: current?.strike_points || 1,
            config: current?.config || {}
          })
        });
        showToast(`Gatilho ${!enabled ? 'ativado' : 'desativado'}.`);
        await loadData({ silent: true });
        return;
      }

      if (action === 'strike-trigger-config') {
        const group = getActiveGroupForAutomation();
        const key = String(trigger.dataset.key || '').trim();
        const current = (state.automation?.strikeTriggers || []).find((item) => item.key === key);
        const pointsRaw = window.prompt(`Quantos strikes para "${key}"?`, String(current?.strike_points || 1));
        if (pointsRaw === null) {
          return;
        }
        const strikePoints = Math.max(1, Number(pointsRaw || 1) || 1);
        const configRaw = window.prompt(
          `Config JSON para gatilho "${key}"`,
          JSON.stringify(current?.config || {}, null, 2)
        );
        if (configRaw === null) {
          return;
        }
        let config = {};
        try {
          config = JSON.parse(configRaw || '{}');
        } catch (_error) {
          throw new Error('JSON invalido para gatilho.');
        }

        await apiFetch(`/api/groups/${group.id}/automation/strike-triggers`, {
          method: 'PUT',
          body: JSON.stringify({
            key,
            enabled: current?.enabled ?? true,
            strike_points: strikePoints,
            config
          })
        });
        showToast('Configuracao do gatilho salva.');
        await loadData({ silent: true });
        return;
      }

      if (action === 'strike-ladder-config') {
        const group = getActiveGroupForAutomation();
        const step = Number(trigger.dataset.step || 0);
        if (!step) {
          return;
        }
        const current = (state.automation?.strikeLadder || []).find((item) => Number(item.step) === step);
        const actionName = window.prompt(
          `Acao para ${step}o strike (none|warn|mute|kick|ban)`,
          String(current?.action || 'warn')
        );
        if (actionName === null) {
          return;
        }
        const durationRaw = window.prompt(
          `Duracao em minutos (quando acao for mute)`,
          String(current?.duration_minutes || 0)
        );
        if (durationRaw === null) {
          return;
        }
        const template = window.prompt(
          `Mensagem para ${step}o strike`,
          String(current?.message_template || '')
        );
        if (template === null) {
          return;
        }
        await apiFetch(`/api/groups/${group.id}/automation/strike-ladder`, {
          method: 'PUT',
          body: JSON.stringify({
            items: [
              {
                step,
                action: String(actionName || 'warn').trim().toLowerCase(),
                duration_minutes: Math.max(0, Number(durationRaw || 0) || 0),
                message_template: String(template || ''),
                enabled: current?.enabled ?? true
              }
            ]
          })
        });
        showToast('Escada de punicao atualizada.');
        await loadData({ silent: true });
        return;
      }

      if (action === 'whitelist-remove') {
        const group = getActiveGroupForAutomation();
        const id = Number(trigger.dataset.id || 0);
        if (!id) {
          return;
        }
        await apiFetch(`/api/groups/${group.id}/automation/whitelist/${id}`, {
          method: 'DELETE'
        });
        showToast('Item removido da whitelist.');
        await loadData({ silent: true });
        return;
      }

      if (action === 'toggle-token') {
        const id = Number(trigger.dataset.id);
        const enabled = trigger.dataset.enabled === '1';
        await apiFetch(`/api/tokens/${id}/enabled`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled: !enabled })
        });
        showToast(`Token ${enabled ? 'pausado' : 'ativado'}.`);
        await loadData({ silent: true });
        return;
      }

      if (action === 'upload-token-image') {
        const id = Number(trigger.dataset.id);
        if (!refs.tokenBuyImageFileInput) {
          throw new Error('Input de upload indisponivel.');
        }

        pendingTokenImageUploadId = id;
        refs.tokenBuyImageFileInput.value = '';
        refs.tokenBuyImageFileInput.click();
        return;
      }

      if (action === 'clear-token-image') {
        const id = Number(trigger.dataset.id);
        await updateTokenImage(id, '');
        showToast('Imagem de compra removida do token.');
        await loadData({ silent: true });
        return;
      }

      if (action === 'delete-token') {
        const id = Number(trigger.dataset.id);
        if (!window.confirm('Excluir este token?')) {
          return;
        }
        await apiFetch(`/api/tokens/${id}`, { method: 'DELETE' });
        showToast('Token excluido.');
        await loadData({ silent: true });
        return;
      }

      if (action === 'command-toggle') {
        const id = Number(trigger.dataset.id);
        const enabled = trigger.dataset.enabled === '1';
        const command = getCommandById(id);
        await apiFetch(`/api/commands/${id}/enabled`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled: !enabled })
        });
        if (command?.key) {
          await syncGroupLockByCommand(command.key, !enabled);
        }
        showToast(`Comando ${enabled ? 'desativado' : 'ativado'}.`);
        await loadData({ silent: true });
        return;
      }

      if (action === 'command-category-toggle') {
        const category = trigger.dataset.category || '';
        const shouldEnable = trigger.dataset.enable === '1';
        await apiFetch(`/api/commands/category/${encodeURIComponent(category)}/enabled`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled: shouldEnable })
        });
        if (String(category).toLowerCase() === 'seguranca') {
          await syncSecurityLocksBulk(shouldEnable);
        }
        showToast(`Categoria ${shouldEnable ? 'ativada' : 'desativada'}.`);
        await loadData({ silent: true });
        return;
      }

      if (action === 'preview-command') {
        const id = Number(trigger.dataset.id);
        const command = getCommandById(id);
        openPreviewModal(command);
        return;
      }

      if (action === 'schedule-edit') {
        const id = Number(trigger.dataset.id);
        const schedule = getScheduleById(id);
        openScheduleModal(schedule);
        return;
      }

      if (action === 'schedule-delete') {
        const id = Number(trigger.dataset.id);
        if (!window.confirm('Excluir este agendamento?')) {
          return;
        }
        await apiFetch(`/api/schedules/${id}`, { method: 'DELETE' });
        showToast('Agendamento excluido.');
        await loadData({ silent: true });
        return;
      }

      if (action === 'schedule-status') {
        const id = Number(trigger.dataset.id);
        const nextStatus = String(trigger.dataset.nextStatus || 'pending').toLowerCase();
        await apiFetch(`/api/schedules/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus })
        });
        showToast('Status de agendamento atualizado.');
        await loadData({ silent: true });
        return;
      }

      if (action === 'schedule-run') {
        const id = Number(trigger.dataset.id);
        await apiFetch(`/api/schedules/${id}/run`, { method: 'POST', body: '{}' });
        showToast('Agendamento executado manualmente.');
        await loadData({ silent: true });
      }
    }).catch((error) => {
      showToast(error.message || 'Erro ao executar acao.', true);
    });
  });

  window.addEventListener('resize', () => {
    if (!refs.tourOverlay.hidden && tourIndex >= 0) {
      renderTourStep();
    }
  });

  window.addEventListener('online', () => {
    runAutoSyncCycle({ initial: false });
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      runAutoSyncCycle({ initial: false });
    }
  });
};

const startAutoRefresh = () => {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    runAutoSyncCycle({ initial: false });
  }, 20000);
};

const runAutoSyncCycle = async ({ initial = false } = {}) => {
  if (refreshCycleBusy || document.body.classList.contains('auth-locked')) {
    return;
  }

  refreshCycleBusy = true;
  try {
    const connected = await ensureApiConnectivity({ forcePrompt: false, allowPrompt: false, silent: true });
    if (!connected) {
      refs.statusLine.textContent = `API offline (${new Date().toLocaleTimeString(
        'pt-BR'
      )}). Reconectando automaticamente...`;
      return;
    }

    hideLoginScreen();
    if (initial) {
      refs.statusLine.textContent = `Conectado em ${state.apiBase}. Carregando dados...`;
    }

    await loadData({ silent: !initial, suppressErrors: true });
  } finally {
    refreshCycleBusy = false;
  }
};

const init = async () => {
  setApiConnectionState({
    apiBase: safeStorageGet(STORAGE_KEYS.apiBase, ''),
    authToken: safeStorageGet(STORAGE_KEYS.authToken, ''),
    authUser: safeStorageGet(STORAGE_KEYS.authUser, '')
  });
  applyTheme(safeStorageGet(STORAGE_KEYS.theme, ''), { persist: false });

  state.periodDays = daysFromSelection();
  bindEvents();
  renderView();

  if (!hasActiveSession()) {
    refs.statusLine.textContent = 'Login necessario para acessar o dashboard.';
    showLoginScreen('Conecte sua API para iniciar o painel.');
    refs.loginApiUrlInput?.focus();
    return;
  }

  hideLoginScreen();
  await runAutoSyncCycle({ initial: true });
  startAutoRefresh();
};

init().catch((error) => {
  console.error(error);
  showToast(error.message || 'Falha ao iniciar painel.', true);
});
