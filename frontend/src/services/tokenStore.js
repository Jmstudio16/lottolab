/**
 * Secure Auth Token Store
 * ========================
 * Holds the access token and current user in RAM (module scope) so the axios
 * interceptor can read them synchronously without touching localStorage.
 *
 * Persistence is delegated to IndexedDB (`offlineDB`) which is encrypted
 * at the OS level on Android (Capacitor WebView) and isn't exposed to
 * XSS scrapers that target window.localStorage.
 *
 * Lifecycle:
 *   - App boot: `hydrate()` reads IndexedDB and fills the in-memory cache.
 *   - Login: `setSession()` updates RAM + IndexedDB.
 *   - Logout: `clearSession()` wipes both.
 */
import { offlineDB } from '../services/offlineDB';

let memoryToken = null;
let memoryUser = null;
let hydrated = false;
let hydratePromise = null;
const subscribers = new Set();

const notify = () => {
  for (const cb of subscribers) {
    try {
      cb({ token: memoryToken, user: memoryUser });
    } catch (err) {
      console.error('[tokenStore] subscriber error:', err);
    }
  }
};

export const tokenStore = {
  /**
   * Synchronously read the in-memory token.
   * Returns null until hydration completes on first boot.
   */
  getToken() {
    return memoryToken;
  },

  /**
   * Synchronously read the in-memory user.
   */
  getUser() {
    return memoryUser;
  },

  isHydrated() {
    return hydrated;
  },

  /**
   * Load session from IndexedDB into RAM.
   * Idempotent — safe to call multiple times.
   */
  async hydrate() {
    if (hydratePromise) return hydratePromise;
    hydratePromise = (async () => {
      try {
        await offlineDB.ensureReady();
        const session = await offlineDB.getSession();
        if (session) {
          memoryToken = session.token || null;
          memoryUser = session.user || null;
        }
      } catch (err) {
        console.error('[tokenStore] hydrate error:', err);
      } finally {
        hydrated = true;
        notify();
      }
      return { token: memoryToken, user: memoryUser };
    })();
    return hydratePromise;
  },

  /**
   * Replace the active session (login/refresh).
   */
  async setSession(user, token) {
    memoryToken = token;
    memoryUser = user;
    try {
      await offlineDB.saveSession(user, token);
    } catch (err) {
      console.error('[tokenStore] persist error:', err);
    }
    notify();
  },

  /**
   * Update user fields without touching the token.
   */
  async updateUser(updates) {
    memoryUser = { ...memoryUser, ...updates };
    try {
      await offlineDB.updateSessionUser(updates);
    } catch (err) {
      console.error('[tokenStore] updateUser error:', err);
    }
    notify();
  },

  /**
   * Clear in-memory + persisted session.
   */
  async clearSession() {
    memoryToken = null;
    memoryUser = null;
    try {
      await offlineDB.clearSession();
    } catch (err) {
      console.error('[tokenStore] clear error:', err);
    }
    notify();
  },

  /**
   * Subscribe to session changes.
   * Returns an unsubscribe function.
   */
  subscribe(cb) {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  },
};

export default tokenStore;
