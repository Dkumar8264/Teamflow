const localApiBaseUrl = 'http://localhost:5000/api';
const deployedApiBaseUrl = 'https://teamflow-wdrw.onrender.com/api';
const isLocalApp =
  typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const apiBaseUrl =
  import.meta.env.VITE_API_URL || (isLocalApp ? localApiBaseUrl : deployedApiBaseUrl);

/**
 * The access token lives here — a module-scoped variable, never localStorage or
 * sessionStorage. It does not survive a reload; `restoreSession` re-obtains one from
 * the httpOnly refresh cookie instead.
 */
let accessToken = null;

// Endpoints that establish or clear a session. They need no bearer token, and they are
// the only ones the browser sends the refresh cookie to.
const SESSION_PATHS = new Set([
  '/auth/signup',
  '/auth/login',
  '/auth/google',
  '/auth/refresh-token',
  '/auth/logout',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/forgot-password',
  '/auth/reset-password'
]);

export const setAccessToken = (token) => {
  accessToken = token || null;
};

export const getAccessToken = () => accessToken;

export const clearAccessToken = () => {
  accessToken = null;
};

const getErrorMessage = (payload, fallback) => {
  if (payload?.errors?.length > 0) {
    return payload.errors.join(', ');
  }

  if (payload?.details?.length > 0) {
    return payload.details.join(', ');
  }

  return payload?.message || fallback;
};

class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const rawRequest = async (path, { body, method = 'GET', token } = {}) => {
  let response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      // Required for the httpOnly refresh cookie to be sent and set. The API's CORS
      // origin allowlist is what keeps this from being usable by other sites.
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (_error) {
    throw new ApiError(
      'API server is not reachable. Check VITE_API_URL in your frontend deployment.',
      0,
      'NETWORK_ERROR'
    );
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    throw new ApiError(
      getErrorMessage(payload, 'Request failed'),
      response.status,
      payload.code,
      payload.details
    );
  }

  return payload;
};

/**
 * In-flight refresh, shared by every caller.
 *
 * This must be single-flight. The backend rotates refresh tokens and treats a second
 * presentation of an already-consumed token as theft, revoking the whole family. Two
 * parallel refreshes would therefore log the user out. Since `loadWorkspace` fires
 * several requests at once, that is a real scenario, not a theoretical one.
 */
let refreshPromise = null;
let onSessionLost = () => {};

export const setSessionLostHandler = (handler) => {
  onSessionLost = typeof handler === 'function' ? handler : () => {};
};

export const refreshSession = () => {
  if (!refreshPromise) {
    refreshPromise = rawRequest('/auth/refresh-token', { method: 'POST' })
      .then((payload) => {
        setAccessToken(payload.token);
        return payload;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

/**
 * Authenticated request with one transparent retry.
 *
 * Access tokens last ~15 minutes, so expiry during a normal session is expected rather
 * than exceptional. On a 401 we refresh once and replay the request; if the refresh
 * itself fails the session is genuinely over and the app is notified.
 */
export const apiRequest = async (path, options = {}) => {
  const isSessionPath = SESSION_PATHS.has(path);
  const token = options.token ?? accessToken;

  if (!isSessionPath && !token) {
    throw new ApiError('Please log in again', 401, 'NO_ACCESS_TOKEN');
  }

  try {
    return await rawRequest(path, { ...options, token: isSessionPath ? undefined : token });
  } catch (error) {
    const canRetry =
      !isSessionPath &&
      error.status === 401 &&
      !options._retried;

    if (!canRetry) {
      throw error;
    }

    try {
      await refreshSession();
    } catch (refreshError) {
      clearAccessToken();
      onSessionLost(refreshError);
      throw refreshError;
    }

    return apiRequest(path, { ...options, token: undefined, _retried: true });
  }
};

/**
 * Called once on app start. Trades the httpOnly refresh cookie for a fresh access
 * token so a page reload does not require re-entering credentials. A failure here is
 * the normal "not signed in" case, not an error worth surfacing.
 */
export const restoreSession = async () => {
  try {
    return await refreshSession();
  } catch (_error) {
    clearAccessToken();
    return null;
  }
};

export { ApiError };
