import { DEFAULT_NOTIFY_POLICY, EMPTY_STATE, canAccessTask } from '../shared/workspaceModel.js';
import { createWorkspaceService } from '../shared/workspaceService.js';
import { DEMO_USERS, createSampleData } from '../shared/sampleData.js';

// E-posta modu: 'demo' (tarayıcı demosu, e-posta yok), 'off' (sunucu, bağlantı yok), 'live' (gönderim açık)
let mailMode = 'demo';
export function configureDemoMail(mode) {
  mailMode = mode;
}

// Örnek veri ortak katmanda (src/shared/sampleData.js): sunucudaki ziyaretçi demo alanları da aynı veriyi kullanır.
export { DEMO_USERS };
const createDemoData = () => createSampleData();

const DEMO_STORAGE_KEY = 'pusula-offline-design-v5';
const PREVIEW_STORAGE_KEY = 'pusula-pilot-onizleme-v1';

// Pilot önizlemesi: örnek veri olmadan, boş başlar; ilk kişi yönetici olur ve ekibi kendisi kurar.
let preview = false;
let storageKey = DEMO_STORAGE_KEY;
export function configurePreview() {
  preview = true;
  storageKey = PREVIEW_STORAGE_KEY;
  demoCache = null;
}
export const isPreview = () => preview;

function createPreviewData() {
  return {
    actor: '',
    workspaces: [],
    members: {},
    states: {},
    revisions: {},
    policies: {},
    notifications: [],
    comments: [],
    activities: [],
    times: [],
    files: [],
  };
}

/** Önizlemede henüz yönetici tanımlanmadıysa kurulum ekranı gösterilir */
export const previewNeedsSetup = () => preview && !loadDemoData().actor;

export function setupPreview({ name, email, workspaceName }) {
  email = String(email || '').trim().toLowerCase();
  name = String(name || '').trim();
  workspaceName = String(workspaceName || '').trim();
  if (!name || name.length > 120 || !/^\S+@\S+\.\S+$/.test(email) || !workspaceName || workspaceName.length > 120) {
    throw Error('Adını, geçerli bir e-posta adresini ve çalışma alanı adını yaz.');
  }
  let data = createPreviewData();
  data.actor = email;
  data.workspaces.push({ id: 'pilot', name: workspaceName });
  data.members.pilot = [{ email, name, department: '', role: 'owner', active: 1, mail_enabled: 1, notify_self: 0 }];
  data.states.pilot = structuredClone(EMPTY_STATE);
  data.revisions.pilot = 0;
  data.policies.pilot = { ...DEFAULT_NOTIFY_POLICY };
  demoCache = data;
  persistDemoData();
}

const newDemoId = () =>
  crypto.randomUUID?.() ||
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (e) => e.toString(16).padStart(2, '0')).join('');

let demoCache = null;

function loadDemoData() {
  if (!demoCache) {
    let seed = preview ? createPreviewData : createDemoData;
    try {
      let stored = typeof localStorage > 'u' ? null : localStorage.getItem(storageKey);
      demoCache = stored ? JSON.parse(stored) : seed();
      if (!preview && !demoCache?.states?.design) {
        demoCache = createDemoData();
      }
    } catch {
      demoCache = seed();
    }
  }
  return demoCache;
}

function persistDemoData() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(demoCache));
  } catch {}
}

export function setDemoActor(email) {
  let known = preview
    ? Object.values(loadDemoData().members).some((list) => list.some((m) => m.email === email && m.active))
    : DEMO_USERS.some((t) => t.email === email);
  if (!known) {
    throw Error('Geçersiz örnek kullanıcı.');
  }
  loadDemoData().actor = email;
  persistDemoData();
}

export function resetDemoData() {
  clearDemoFiles();
  demoCache = preview ? createPreviewData() : createDemoData();
  persistDemoData();
}

export function createDemoConflict(workspaceId) {
  let snapshot = demoGet(workspaceId);
  let target = snapshot.state.tasks.find((task) => task.id === 'd6') || snapshot.state.tasks[0];
  if (!target) {
    throw Error('Önce örnek bir iş oluştur.');
  }
  let actor = loadDemoData().actor;
  let otherEditor =
    snapshot.members.find(
      (member) =>
        member.active &&
        member.role !== 'viewer' &&
        member.email !== actor &&
        canAccessTask(target, snapshot.state, member.email, member.role),
    )?.email || actor;
  try {
    loadDemoData().actor = otherEditor;
    let space = demoGet(workspaceId);
    let copy = structuredClone(space.state);
    copy.tasks.find((task) => task.id === target.id).title = target.title + ' · ekip planı';
    demoPost({
      action: 'save',
      id: workspaceId,
      revision: space.revision,
      state: copy,
    });
  } finally {
    loadDemoData().actor = actor;
    persistDemoData();
  }
  return {
    snapshot,
    task: {
      ...target,
      title: target.title + ' · benim planım',
    },
  };
}

// Ek dosyalar tarayıcıda ayrı anahtarlarda tutulur; tarayıcı kotası küçük olduğu için sınır 1 MB.
const filePrefix = () => (preview ? 'pusula-pilot-onizleme-file-' : 'pusula-file-');
const memoryFiles = new Map();
const demoBlobs = {
  put(id, data) {
    try {
      localStorage.setItem(filePrefix() + id, data);
    } catch {
      if (typeof localStorage > 'u') return memoryFiles.set(id, data);
      throw Error('Tarayıcı depolama alanı doldu. Önce bazı ekleri sil.');
    }
  },
  get(id) {
    try {
      return localStorage.getItem(filePrefix() + id) ?? memoryFiles.get(id) ?? null;
    } catch {
      return memoryFiles.get(id) ?? null;
    }
  },
  remove(id) {
    memoryFiles.delete(id);
    try {
      localStorage.removeItem(filePrefix() + id);
    } catch {}
  },
};

function clearDemoFiles() {
  memoryFiles.clear();
  try {
    for (let key of Object.keys(localStorage)) if (key.startsWith(filePrefix())) localStorage.removeItem(key);
  } catch {}
}

const service = createWorkspaceService({
  load: loadDemoData,
  persist: persistDemoData,
  blobs: demoBlobs,
  maxFileBytes: 1024 * 1024,
  newId: newDemoId,
  mailMode: () => mailMode,
  profileFor: (email) =>
    DEMO_USERS.find((e) => e.email === email) || { email, name: email.split('@')[0], department: '' },
  accessError: 'Bu örnek çalışma alanında erişimin yok.',
});

export const demoGet = (workspaceId, taskId = '', fileId = '') =>
  service.get(loadDemoData().actor, workspaceId, taskId, fileId);
export const demoPost = (request) => service.post(loadDemoData().actor, request);
export const pendingMail = (limit) => service.pendingMail(limit);
export const markMail = (id, mail, detail) => service.markMail(id, mail, detail);
