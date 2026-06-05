// Single source of the running app's version + build id.
// These globals are injected by Vite `define` (see vite.config.js) at dev/build
// time; the typeof guards keep this safe if a define is ever missing.
/* global __APP_VERSION__, __APP_BUILD__, __APP_BUILD_TIME__ */
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
export const APP_BUILD = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev';
export const APP_BUILD_TIME = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : '';
