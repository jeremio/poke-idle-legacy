import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import User from '#models/user'

/**
 * In-memory maintenance state — avoids DB query on every single request.
 * Refreshed from DB at most once per CACHE_TTL, and instantly on admin toggle.
 */
let maintenanceCache: { enabled: boolean; message: string } | null = null
let maintenanceCacheTime = 0
const CACHE_TTL = 5_000 // 5 seconds

async function getMaintenanceState(): Promise<{ enabled: boolean; message: string }> {
  const now = Date.now()
  if (maintenanceCache && now - maintenanceCacheTime < CACHE_TTL) {
    return maintenanceCache
  }
  const row = await User.query().where('maintenanceMode', true).first()
  maintenanceCache = {
    enabled: !!row,
    message: row?.maintenanceMessage || 'Maintenance en cours',
  }
  maintenanceCacheTime = now
  return maintenanceCache
}

/** Called by admin controller after toggling maintenance to bust the cache instantly. */
export function invalidateMaintenanceCache() {
  maintenanceCache = null
}

/**
 * Maintenance middleware checks if maintenance mode is enabled.
 * Only admins can access the app during maintenance.
 * Returns 503 Service Unavailable with maintenance message for non-admins.
 */
export default class MaintenanceMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const state = await getMaintenanceState()
    if (!state.enabled) return next()

    // Maintenance is ON — only admins may pass
    const authUser = ctx.auth.use('web').user
    if (authUser) {
      // Reload to get current role (in case of recent role change)
      const user = await User.find(authUser.id)
      if (user?.role === 'admin') return next()
    }

    return ctx.response.serviceUnavailable({
      maintenance: true,
      message: state.message,
    })
  }
}
