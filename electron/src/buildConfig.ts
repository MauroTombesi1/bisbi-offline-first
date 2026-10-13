export const BUILD_CONFIG = {
  FRONTEND_PORT: 7775,
  PRODUCT_NAME: 'Bisbi',
  DEFAULT_HOTKEY: process.platform === 'darwin' ? 'MetaRight' : 'CtrlRight',
  DEFAULT_HANDS_FREE: false,
} as const;
