import { BellIcon, BriefcaseBusinessIcon, LayoutDashboardIcon, UserRoundIcon, UsersIcon } from 'lucide-react';
import { STATUS_LABELS } from '../components/TaskBoard.jsx';

export const TASK_STATUS_LABELS = STATUS_LABELS;

export const PRIORITY_LABELS = {
  low: 'Düşük',
  normal: 'Normal',
  high: 'Yüksek',
  urgent: 'Acil',
};

export const ROLE_LABELS = {
  owner: 'Yönetici',
  editor: 'Ekip üyesi',
  viewer: 'Görüntüleyici',
};

export const NAV_ITEMS = [
  ['mine', 'Benim panom', UserRoundIcon],
  ['dashboard', 'Ekip panosu', LayoutDashboardIcon],
  ['tasks', 'İş listesi', BriefcaseBusinessIcon],
  ['team', 'Ekipler', UsersIcon],
  ['notifications', 'Bildirimler', BellIcon],
];
