import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

const CONFIGURED_BASE_URL = process.env.NEXT_PUBLIC_API_URL

if (!CONFIGURED_BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_URL est manquant. Vérifiez votre fichier .env.local')
}

function resolveBaseUrl(configuredUrl: string): string {
  if (typeof window === 'undefined') return configuredUrl

  try {
    const url = new URL(configuredUrl)
    const localHosts = new Set(['localhost', '127.0.0.1'])
    if (localHosts.has(url.hostname) && localHosts.has(window.location.hostname)) {
      url.hostname = window.location.hostname
      return url.toString().replace(/\/$/, '')
    }
  } catch {
    return configuredUrl
  }

  return configuredUrl
}

const BASE_URL = resolveBaseUrl(CONFIGURED_BASE_URL)

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
})

let refreshPromise: Promise<void> | null = null

function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${BASE_URL}/auth/refresh`, undefined, {
        withCredentials: true,
        withXSRFToken: true,
        xsrfCookieName: 'csrftoken',
        xsrfHeaderName: 'X-CSRFToken',
      })
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

// Auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    const isAuthEndpoint = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh')

    if (error.response?.status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true

      try {
        await refreshSession()
        return api(original)
      } catch {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('provendix-user')
          window.location.assign('/login')
        }
      }
    }

    return Promise.reject(error)
  }
)

export default api
