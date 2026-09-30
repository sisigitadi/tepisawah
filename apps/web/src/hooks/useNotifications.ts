/**
 * @tepisawah/web — notifications hook.
 *
 * Phase 0 scaffold: structure and tooling only.
 */

export interface AppNotification {
  id: string;
  message: string;
  read: boolean;
}

export interface NotificationsState {
  notifications: AppNotification[];
  unreadCount: number;
  markAllRead(): void;
}

/**
 * Phase 0 stub: returns an empty inbox.
 */
export function useNotifications(): NotificationsState {
  return {
    notifications: [],
    unreadCount: 0,
    markAllRead() {
      // not implemented (Phase 0)
    },
  };
}
