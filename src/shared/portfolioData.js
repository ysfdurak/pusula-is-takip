// Portföy veri seti: Yusuf Durak'ın gerçek proje geçmişi (GitHub birleştirmeleri ve proje kararları, gerçek tarihlerle).
// Kaynak: portfolio.json. Elle düzenlenebilir; tarihler UTC.
//
// Kullananlar:
//   - Ziyaretçi demosu, DEMO_DATASET=portfoy iken (server/demo.js). Varsayılan demo (örnek depo ekibi) değişmez.
//   - Kendi hesabına ayrı çalışma alanı yükleyen betik (server/portfoy-yukle.js).
import { DEFAULT_NOTIFY_POLICY, normalizeState, validateStructure } from './workspaceModel.js';
import { DEMO_USERS } from './sampleData.js';
import PORTFOLIO from './portfolio.json' with { type: 'json' };

export const PORTFOLIO_OWNER = { email: 'yusuf@example.test', name: 'Yusuf Durak', department: 'Operasyon', role: 'editor' };

/**
 * Pusula çalışma alanı durumu (state). `owner`: işlerin sorumlusu; `viewer`: alanın yöneticisi (demoda ziyaretçi).
 * @param {{ owner?: string, manager?: string }} [o]
 */
export function portfolioState({ owner = PORTFOLIO_OWNER.email, manager = DEMO_USERS[0].email } = {}) {
  const people = [...new Set([manager, owner])];
  const state = normalizeState({
    teams: PORTFOLIO.teams.map((team) => ({ ...team, members: people, leads: [owner], active: true, workTypes: [] })),
    projects: PORTFOLIO.projects,
    tasks: PORTFOLIO.tasks.map((task) => ({
      ...task,
      assignees: [owner],
      createdBy: owner,
      originalDueAt: task.dueAt || '',
      requireApproval: false,
      checklist: (task.checklist || []).map((step) => ({ ...step, doneBy: step.done ? owner : '' })),
    })),
    decisions: PORTFOLIO.decisions,
    blockers: PORTFOLIO.blockers,
  });
  const error = validateStructure(state);
  if (error) throw new Error(`Portföy veri seti geçersiz: ${error}`);
  return state;
}

/** createSampleData ile aynı biçim: tek çalışma alanı ('design'). Demo yöneticisi (DEMO_USERS[0]) ziyaretçiye dönüşür. */
export function createPortfolioData() {
  const manager = DEMO_USERS[0];
  return {
    actor: manager.email,
    workspaces: [{ id: 'design', name: PORTFOLIO.name }],
    members: {
      design: [manager, PORTFOLIO_OWNER].map((m) => ({ ...m, active: 1, mail_enabled: 0, notify_self: 0 })),
    },
    states: { design: portfolioState() },
    revisions: { design: 1 },
    policies: { design: DEFAULT_NOTIFY_POLICY },
    notifications: [],
    comments: [],
    activities: [],
    times: [],
  };
}

export const PORTFOLIO_NAME = PORTFOLIO.name;
