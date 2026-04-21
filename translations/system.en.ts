/**
 * System namespace (EN) — User Config, User Management, Health,
 * Notifications, Manual.
 *
 * Bottom navigation / admin labels. Low-traffic keys; preferred here over
 * the monolith for clean bucket separation.
 */

interface SystemPack {
  [key: string]: string;
}

export const systemEn: SystemPack = {
  // User config
  sysUserConfigHeader: 'User configuration',
  sysUserConfigLanguage: 'Language',
  sysUserConfigTheme: 'Theme',
  sysUserConfigDensity: 'Density',
  sysUserConfigSave: 'Save preferences',

  // User management
  sysUsersHeader: 'User management',
  sysUsersInvite: 'Invite user',
  sysUsersRole: 'Role',
  sysUsersStatus: 'Status',
  sysUsersLastLogin: 'Last login',

  // Health dashboard
  sysHealthHeader: 'System health',
  sysHealthLatency: 'Latency',
  sysHealthUptime: 'Uptime',
  sysHealthErrorRate: 'Error rate',
  sysHealthWorkers: 'Background workers',
  sysHealthAdapters: 'Integration adapters',

  // Notifications
  sysNotificationsHeader: 'Notifications',
  sysNotificationsMarkAllRead: 'Mark all as read',
  sysNotificationsEmpty: 'No notifications.',

  // Manual
  sysManualHeader: 'User manual',
  sysManualSearch: 'Search in the manual',
  sysManualNotFound: 'No section matches this query.',
};

export type SystemTranslationKeys = typeof systemEn;
