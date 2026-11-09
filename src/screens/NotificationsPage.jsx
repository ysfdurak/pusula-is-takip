// Bildirimler. App.jsx'ten ayrıldı; değerleri AppContext üzerinden alır.
import { NotificationGroups } from '../components/NotificationGroups.jsx';
import {
  BellIcon,
  CheckCheckIcon,
  ChevronRightIcon,
  MessageSquareIcon,
  RefreshCwIcon,
  Settings2Icon,
  UserRoundIcon,
} from 'lucide-react';
import { useApp } from '../AppContext.js';

export function NotificationsPage() {
  const {
    groupNotifications,
    memberName,
    myNotifications,
    navigate,
    notificationScope,
    notifications,
    openTaskDetails,
    postAction,
    refresh,
    role,
    setError,
    setGroupNotifications,
    setNotificationScope,
    unreadCount,
    user,
    workspaceId,
  } = useApp();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EKİBİNDEN HABERLER</span>
          <h1>Gözünden kaçmasın.</h1>
          <p>Atamalar, yorumlar ve durum değişiklikleri.</p>
        </div>
        <button className="button" onClick={() => navigate('settings')}>
          <Settings2Icon size={16} />
          {' Bildirim ayarları'}
        </button>
      </div>
      <section className="work-surface">
        <div className="surface-toolbar">
          <div className="work-tabs">
            <button
              className={notificationScope === 'mine' ? 'active' : ''}
              onClick={() => setNotificationScope('mine')}
            >
              {'Bana gelenler '}
              <b>{myNotifications.length}</b>
            </button>
            {role === 'owner' && (
              <button
                className={notificationScope === 'all' ? 'active' : ''}
                onClick={() => setNotificationScope('all')}
              >
                Ekipteki tüm bildirimler
              </button>
            )}
          </div>
          {unreadCount > 0 && (
            <span className="muted small">
              {unreadCount}
              {' okunmamış'}
            </span>
          )}
        </div>
        <div className="notice-view-toggle">
          <button className="text-button" onClick={() => setGroupNotifications(!groupNotifications)}>
            {groupNotifications ? 'Tek tek olayları göster' : 'İşe göre birleştir'}
          </button>
        </div>
        {groupNotifications ? (
          <NotificationGroups
            items={notificationScope === 'all' ? notifications : myNotifications}
            name={memberName}
            onOpen={openTaskDetails}
            onRead={async (e) => {
              try {
                for (let t of e.filter((e) =>
                  myNotifications.some((notification) => notification.id === e && !notification.read_at),
                ))
                  await postAction({
                    action: 'read',
                    id: workspaceId,
                    notification: t,
                  });
                await refresh();
              } catch (err) {
                setError(err.message);
              }
            }}
          />
        ) : (notificationScope === 'all' ? notifications : myNotifications).length ? (
          (notificationScope === 'all' ? notifications : myNotifications).map((notification) => (
            <button
              className={
                'notification-row ' +
                (!notification.read_at && notification.recipient === user ? 'unread' : '')
              }
              onClick={async () => {
                if (notification.recipient === user) {
                  await postAction({
                    action: 'read',
                    id: workspaceId,
                    notification: notification.id,
                  });
                  refresh();
                }
                openTaskDetails(notification.task);
              }}
              key={notification.id}
            >
              <span className={'notice-symbol ' + notification.kind}>
                {notification.kind === 'comment' ? (
                  <MessageSquareIcon size={18} />
                ) : notification.kind === 'completed' ? (
                  <CheckCheckIcon size={18} />
                ) : notification.kind === 'assigned' ? (
                  <UserRoundIcon size={18} />
                ) : (
                  <RefreshCwIcon size={17} />
                )}
              </span>
              <span>
                <strong>{notification.title}</strong>
                <small>
                  {notificationScope === 'all' ? memberName(notification.recipient) + ' · ' : ''}
                  {new Date(notification.created).toLocaleString('tr-TR', {
                    timeZone: 'Europe/Istanbul',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </small>
                <small className="mail-state">
                  {
                    {
                      no_config: 'E-posta bağlantısı bekliyor',
                      queued: 'E-posta sırada',
                      sending: 'E-posta gönderiliyor',
                      accepted: 'E-posta sağlayıcısı kabul etti',
                      failed: 'E-posta gönderilemedi',
                      disabled: 'Bu olayın e-postası kapalı',
                      muted: 'E-posta tercihi kapalı',
                      self: 'Kendi işlemimin e-postası kapalı',
                      cancelled: 'E-posta iptal edildi',
                      unknown: 'Gönderim kontrol edilmeli',
                    }[notification.mail]
                  }
                </small>
              </span>
              <ChevronRightIcon size={17} />
            </button>
          ))
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <BellIcon size={28} />
            </span>
            <h2>Şimdilik her şey güncel.</h2>
            <p>Sana iş atandığında ve ilgili işlerde gelişme olduğunda burada göreceksin.</p>
          </div>
        )}
      </section>
    </>
  );
}
