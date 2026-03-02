import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class AdminMiddleware {
  async handle({ auth, response }: HttpContext, next: NextFn) {
    const user = auth.user

    if (!user) {
      return response.unauthorized({ message: 'You must be logged in to access this resource' })
    }

    if (user.role !== 'admin') {
      return response.forbidden({ message: 'Access denied. Admin role required.' })
    }

    const output = await next()
    return output
  }
}