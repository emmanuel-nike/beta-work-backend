import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import testUtils from '@adonisjs/core/services/test_utils'

/**
 * Configure Japa plugins.
 */
export const plugins: Config['plugins'] = [assert(), apiClient(), pluginAdonisJS(app)]

/**
 * Global runner hooks.
 */
export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [],
  teardown: [],
}

/**
 * Suite-level hooks.
 */
export const configureSuite: Config['configureSuite'] = (suite) => {
  if (suite.name === 'integration') {
    suite.setup(async () => {
      await testUtils.db().migrate()
      return testUtils.httpServer().start()
    })
  }
}
