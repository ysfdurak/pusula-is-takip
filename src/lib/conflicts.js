const sameJson = (workRules, t) => JSON.stringify(workRules) === JSON.stringify(t);

const SYSTEM_FIELDS = new Set([
  'assignee',
  'revisionCount',
  'dueRevisionCount',
  'originalDueAt',
  'createdAt',
  'createdBy',
  'startedAt',
  'completedAt',
  'closedAt',
]);

export function buildConflictReport(workspace, proposed, state) {
  let copy = structuredClone(state);
  let i = [];
  let a = [];
  let o = (e, t, n, r, workRules, s, c) => {
    i.push(r);
    a.push({
      key: e,
      id: t,
      field: n,
      label: r,
      before: workRules,
      local: s,
      remote: c,
    });
  };
  if (!sameJson(workspace.workRules, proposed.workRules)) {
    if (!sameJson(workspace.workRules, state.workRules) && !sameJson(proposed.workRules, state.workRules)) {
      o(
        'workRules',
        '',
        'record',
        'Çalışma kuralları',
        workspace.workRules,
        proposed.workRules,
        state.workRules,
      );
    } else {
      copy.workRules = proposed.workRules;
    }
  }
  for (let i of ['teams', 'tasks', 'projects', 'blockers', 'decisions', 'templates']) {
    let a = new Map(workspace[i].map((e) => [e.id, e]));
    let lookup = new Map(proposed[i].map((e) => [e.id, e]));
    let c = new Map(state[i].map((e) => [e.id, e]));
    for (let e of new Set([...a.keys(), ...lookup.keys()])) {
      let t = a.get(e);
      let n = lookup.get(e);
      let r = c.get(e);
      let l = n?.title || n?.name || t?.title || t?.name || e;
      if (sameJson(t, n)) {
        continue;
      }
      if (!t) {
        if (r && !sameJson(n, r)) {
          o(i, e, 'record', l + ' (yeni kayıt)', t, n, r);
        } else {
          c.set(e, n);
        }
        continue;
      }
      if (!n) {
        if (r && !sameJson(t, r)) {
          o(i, e, 'record', l + ' (silme)', t, n, r);
        } else {
          c.delete(e);
        }
        continue;
      }
      if (!r) {
        o(i, e, 'record', l + ' (kayıt kaldırılmış)', t, n, r);
        continue;
      }
      let u = {
        ...r,
      };
      for (let a of Object.keys(n)) {
        if (!((i === 'tasks' && SYSTEM_FIELDS.has(a)) || sameJson(t[a], n[a]))) {
          if (!sameJson(t[a], r[a]) && !sameJson(n[a], r[a])) {
            o(i, e, a, l, t[a], n[a], r[a]);
          } else {
            u[a] = n[a];
          }
        }
      }
      c.set(e, u);
    }
    copy[i] = [...c.values()];
  }
  return {
    state: copy,
    conflicts: i,
    details: a,
  };
}

export function applyConflictChoices(report, t) {
  let copy = structuredClone(report.state);
  report.details.forEach((detail, index) => {
    let i = t[index] === 'local' ? detail.local : detail.remote;
    if (detail.key === 'workRules') {
      copy.workRules = structuredClone(i);
      return;
    }
    let a = copy[detail.key];
    let o = a.findIndex((t) => t.id === detail.id);
    if (detail.field === 'record') {
      if (i === undefined) {
        if (o >= 0) {
          a.splice(o, 1);
        }
      } else {
        if (o >= 0) {
          a[o] = structuredClone(i);
        } else {
          a.push(structuredClone(i));
        }
      }
    } else {
      if (o >= 0) {
        a[o][detail.field] = structuredClone(i);
      }
    }
  });
  return copy;
}
