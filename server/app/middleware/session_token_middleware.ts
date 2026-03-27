import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import User from '#models/user'

/**
 * Session token middleware validates that the user's session token
 * in the database matches the one stored in the session.
 * This enforces single active session across devices.
 */
export default class SessionTokenMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const authUser = ctx.auth.use('web').user

    // If not authenticated, skip
    if (!authUser) {
      return next()
    }

    // Reload fresh user from DB to get latest sessionToken
    const user = await User.find(authUser.id)
    if (!user) {
      await ctx.auth.use('web').logout()
      return ctx.response.unauthorized({ message: 'User not found' })
    }

    // Get the session token that was stored when user logged in
    const sessionTokenAtLogin = ctx.session.get('session_token')

    // Backward compatibility: if no token in session, accept (user logged in before update)
    if (!sessionTokenAtLogin) {
      return next()
    }

    // Check if the session token matches the current one in DB
    if (sessionTokenAtLogin !== user.sessionToken) {
      // Session invalidated - another device logged in
      await ctx.auth.use('web').logout()
      return ctx.response.conflict({
        message: 'Session expired - another device connected',
        code: 'SESSION_EXPIRED',
      })
    }

    return next()
  }
}
