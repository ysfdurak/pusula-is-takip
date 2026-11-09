export const demoWorkspace = {
  version: 2, name: 'Pusula Örnek Çalışma Alanı',
  currentUser: 'u1',
  members: [{id:'u1',name:'Ayşe Demir',email:'ayse@example.invalid',teamId:'g1',role:'admin',active:true},{id:'u2',name:'Mert Kaya',email:'mert@example.invalid',teamId:'g1',role:'member',active:true},{id:'u3',name:'Deniz Yılmaz',email:'deniz@example.invalid',teamId:'g2',role:'manager',active:true}],
  teams: [{id:'g1',name:'Operasyon',managerId:'u1'},{id:'g2',name:'Planlama',managerId:'u3'}],
  projects: [{id:'p1',name:'Sevkiyat İyileştirme',description:'Sentetik operasyon projesi',teamId:'g1',status:'Devam'}],
  tasks: [{id:'t1',title:'Sevkiyat kontrol listesini doğrula',description:'Örnek iş',ownerId:'u1',teamId:'g1',projectId:'p1',status:'Devam',priority:'Yüksek',due:'2026-11-12',checklist:[{id:'c1',title:'Veriyi kontrol et',done:true},{id:'c2',title:'Raporu doğrula',done:false}],dependencies:[],followers:['u2'],createdAt:'2026-11-09T09:00:00.000Z',updatedAt:'2026-11-09T09:00:00.000Z',revision:1},{id:'t2',title:'Haftalık sayım planını paylaş',description:'',ownerId:'u2',teamId:'g1',projectId:'',status:'Başlanmadı',priority:'Orta',due:'2026-11-14',checklist:[],dependencies:['t1'],followers:[],createdAt:'2026-11-09T09:00:00.000Z',updatedAt:'2026-11-09T09:00:00.000Z',revision:1}],
  decisions: [], blockers: [], comments: [], timeEntries: [], templates: [{id:'s1',name:'Haftalık kontrol',title:'Haftalık kontrolü tamamla',description:'Standart kontrol adımları',checklist:[{title:'Verileri doğrula'},{title:'Sonuçları paylaş'}]}], notifications: [], audit: [], settings: {requireDue:false,notificationOnAssign:true,notificationOnComment:true,allowBackdated:false}
};
