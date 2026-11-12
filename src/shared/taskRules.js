// İş tamamlama kuralları: bir işin "tamamlandı" yapılabilmesi için neyin eksik olduğunu söyler.
// Arayüz (uyarı ve onay penceresi) ve ince servis katmanı (MCP araçları) aynı fonksiyonu kullanır.

export function taskObstacles(item, workspace) {
  return [
    ...workspace.blockers
      .filter((blocker) => blocker.task === item.id && !blocker.resolved)
      .map((blocker) => blocker.title),
    ...item.depends
      .filter((dependencyId) => workspace.tasks.find((task) => task.id === dependencyId)?.status !== 'done')
      .map(
        (dependencyId) =>
          'Ön koşul: ' +
          (workspace.tasks.find((task) => task.id === dependencyId)?.title || 'Bulunamayan iş'),
      ),
  ];
}

export function completionIssues(item, workspace) {
  return [
    ...taskObstacles(item, workspace),
    ...(item.waitingReason ? ['Bekleme sona erdiğinde bekleme bilgisini kaldır.'] : []),
    ...(item.checklistRequired && item.checklist.some((step) => !step.done)
      ? ['Zorunlu kontrol adımlarını tamamla.']
      : []),
    ...(item.requireApproval && !item.criteria.trim() ? ['Kabul ölçütü henüz tanımlanmadı.'] : []),
    ...(item.requireApproval && !item.verified ? ['Kabul ölçütünü doğrula.'] : []),
  ];
}
