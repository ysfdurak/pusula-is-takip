// Pusula MCP kapısı: ince servis komutlarını (src/shared/taskCommands.js) MCP araçları olarak sunar.
//
// İkili yapı:  çekirdek (workspaceService + kurallar)
//                ├─ web kapısı: /api/workspace  (oturum çerezi, arayüz)
//                └─ MCP kapısı: /mcp            (erişim anahtarı, Claude ve diğer MCP istemcileri)
// Bu dosya kural İÇERMEZ: yalnızca kimliği belirler, aracı doğru komuta bağlar ve sonucu MCP biçimine çevirir.
//
// Bilerek MCP'ye açılmayanlar: üye ve rol yönetimi, çalışma kuralları, iş silme, ek dosya.
// Yapay zekânın yanlış yorumlamasının bedeli yüksek olan işlemler yalnızca web arayüzünden yapılır.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { createTaskCommands } from '../src/shared/taskCommands.js';

const ws = z.string().optional().describe('Çalışma alanı kimliği. Kullanıcının tek çalışma alanı varsa boş bırak.');
const taskId = z.string().describe('İşin kimliği (isleri_listele veya gundemim sonucundaki "id").');
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Tarih, YYYY-AA-GG (ör. 2026-11-20). Türkiye saatiyle gün sonu kabul edilir.');
const people = z.array(z.string()).describe('Sorumluların e-posta adresleri. Kullanıcının kendisi için "ben" yazılabilir. Boş liste sorumluyu kaldırır.');

const READ = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

/**
 * Araç tanımları: ad, açıklama (Claude aracı buna bakarak seçer), girdi şeması ve hangi komutu çağırdığı.
 * Açıklamalar bilerek ayrıntılı: kötü açıklama, Claude'un yanlış aracı seçmesinin en sık nedenidir.
 */
const TOOLS = [
  ['calisma_alanlarim', 'Kullanıcının üyesi olduğu Pusula çalışma alanlarını, rolünü (owner = yönetici, editor = ekip üyesi, viewer = görüntüleyici), ekip ve proje adlarını listeler. Hangi alanı ya da ekibi kullanacağını bilemezsen önce bunu çağır.', {}, READ,
    (c, actor) => c.listWorkspaces(actor)],
  ['gundemim', 'Kullanıcının kendi gündemi: geciken işleri, bugün ve bu hafta termini olanlar; ekip yöneticisiyse ekibinde sorumlu bekleyen işler. "Bugün ne yapmalıyım", "gecikenlerim" gibi sorular için.', { calismaAlani: ws }, READ,
    (c, actor, a) => c.myAgenda(actor, a)],
  ['isleri_listele', 'İşleri filtreleyerek listeler. Termine göre sıralı en fazla 200 iş döner; "toplam" tüm eşleşen sayısıdır.', {
    calismaAlani: ws,
    durum: z.enum(['acik', 'todo', 'doing', 'done', 'cancelled']).optional().describe('acik = tamamlanmamış ve iptal edilmemiş tüm işler'),
    sorumlu: z.string().optional().describe('Sorumlunun e-postası ya da kullanıcının kendisi için "ben"'),
    ekip: z.string().optional().describe('Ekip adı ya da kimliği'),
    proje: z.string().optional().describe('Proje adı ya da kimliği'),
    geciken: z.boolean().optional().describe('true ise yalnızca termini geçmiş açık işler'),
    limit: z.number().int().min(1).max(200).optional(),
  }, READ, (c, actor, a) => c.listTasks(actor, a)],
  ['is_detayi', 'Bir işin ayrıntısı: açıklama, kabul ölçütü, kontrol listesi (madde kimlikleriyle), son yorumlar ve tamamlanmak için eksik kalanlar.', { calismaAlani: ws, isId: taskId }, READ,
    (c, actor, a) => c.taskDetail(actor, a)],
  ['ekip_durumu', 'Ekip panosundaki tablo: açık, geciken, sorumlu bekleyen, engelli ve onay bekleyen işler; zamanında tamamlama oranları; kişi başı iş yükü; önümüzdeki 7 günün terminleri. Yönetici özetleri için.', {
    calismaAlani: ws, ekip: z.string().optional().describe('Ekip adı ya da kimliği; boşsa görünen tüm işler'),
  }, READ, (c, actor, a) => c.teamStatus(actor, a)],
  ['engelleri_listele', 'Açık bir engel ya da bitmemiş ön koşul yüzünden duran işleri, engelleri ve çözüm sorumlularını listeler.', { calismaAlani: ws }, READ,
    (c, actor, a) => c.listBlockers(actor, a)],
  ['proje_durumu', 'Projelerin sağlığı: ilerleme yüzdesi, açık/geciken/engelli iş sayısı ve durum (late = gecikmede, risk = riskli, ontrack = yolunda, done = bitti).', { calismaAlani: ws }, READ,
    (c, actor, a) => c.projectStatus(actor, a)],
  ['is_olustur', 'Yeni iş açar. Sorumlu verilmezse iş sahipsiz kalır (ekip verilirse ekip havuzuna düşer). Sorumlulara atama bildirimi gider.', {
    calismaAlani: ws,
    baslik: z.string().min(1).max(4000),
    aciklama: z.string().max(4000).optional(),
    ekip: z.string().optional().describe('Ekip adı ya da kimliği (calisma_alanlarim sonucunda)'),
    sorumlular: people.optional(),
    termin: day.optional(),
    oncelik: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    proje: z.string().optional().describe('Proje adı ya da kimliği (calisma_alanlarim sonucunda)'),
  }, WRITE, (c, actor, a) => c.createTask(actor, a)],
  ['durum_degistir', 'İşin durumunu değiştirir: todo (yapılacak), doing (devam ediyor), done (tamamlandı), cancelled (iptal). "done" için tüm tamamlama koşulları sağlanmış olmalı; değilse eksikler hata olarak döner, kullanıcıya bunları söyle.', {
    calismaAlani: ws, isId: taskId, durum: z.enum(['todo', 'doing', 'done', 'cancelled']),
  }, WRITE, (c, actor, a) => c.changeStatus(actor, a)],
  ['sorumlu_ata', 'İşin sorumlularını verilen listeyle DEĞİŞTİRİR (ekleme değil). Mevcut sorumluları korumak için onları da listeye yaz.', {
    calismaAlani: ws, isId: taskId, sorumlular: people,
  }, WRITE, (c, actor, a) => c.assignTask(actor, a)],
  ['termin_degistir', 'İşin terminini değiştirir. Gerekçe zorunludur ve iş geçmişine yazılır; ilk termin korunur. Gerekçeyi kullanıcıdan al, kendin uydurma.', {
    calismaAlani: ws, isId: taskId, termin: day, gerekce: z.string().min(1).max(1000),
  }, WRITE, (c, actor, a) => c.changeDue(actor, a)],
  ['kontrol_maddesi_isaretle', 'İşin kontrol listesindeki bir maddeyi tamamlandı ya da tamamlanmadı olarak işaretler. Madde kimliği is_detayi sonucundadır.', {
    calismaAlani: ws, isId: taskId, maddeId: z.string(), tamam: z.boolean(),
  }, WRITE, (c, actor, a) => c.toggleChecklistItem(actor, a)],
  ['yorum_ekle', 'İşe yorum ekler. İşin ilgililerine bildirim gider.', {
    calismaAlani: ws, isId: taskId, metin: z.string().min(1).max(5000),
  }, WRITE, (c, actor, a) => c.addComment(actor, a)],
];

export const MCP_TOOL_NAMES = TOOLS.map(([name]) => name);

/**
 * @param {object} o
 * @param {ReturnType<import('../src/shared/workspaceService.js').createWorkspaceService>} o.service
 * @param {() => string} o.newId
 * @param {(email: string, tool: string, detail: string) => void} o.audit
 * @param {() => void} o.afterWrite   yazma araçlarından sonra (ör. e-posta kuyruğunu gönder)
 * @param {(msg: string) => void} o.log
 */
export function createMcpHandler({ service, newId, audit, afterWrite = () => {}, log = () => {} }) {
  const commands = createTaskCommands(service, { newId });

  /** Her istek için yeni sunucu: kimlik isteğe bağlıdır, istekler arasında durum tutulmaz (stateless). */
  function buildServer(actor) {
    const server = new McpServer(
      { name: 'pusula', version: '0.8.0' },
      { instructions: 'Pusula, Türkçe bir iş ve ekip takip sistemidir. Tarihler Türkiye saatine göredir. Kullanıcı yalnızca yetkisi olan işleri görür ve değiştirebilir. Bir işlem reddedilirse hata mesajını kullanıcıya olduğu gibi aktar.' },
    );
    for (const [name, description, inputSchema, annotations, run] of TOOLS) {
      server.registerTool(name, { description, inputSchema, annotations }, async (args) => {
        try {
          const result = run(commands, actor, args);
          if (!annotations.readOnlyHint) {
            audit(actor, 'mcp:' + name, args.isId || args.baslik || '');
            afterWrite();
          }
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          // İş kuralı hataları (Error) kullanıcıya gösterilir; beklenmeyenler gösterilmez (web kapısıyla aynı kural).
          if (err instanceof Error && err.constructor === Error) {
            return { isError: true, content: [{ type: 'text', text: err.message }] };
          }
          log(`MCP hatası (${name}): ${err?.stack || err}`);
          return { isError: true, content: [{ type: 'text', text: 'İstek işlenemedi.' }] };
        }
      });
    }
    return server;
  }

  /** /mcp isteğini işler. `actor` kimliği doğrulanmış kullanıcının e-postasıdır. */
  async function handle(req, res, actor, body) {
    const server = buildServer(actor);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  }

  return { handle, commands };
}
