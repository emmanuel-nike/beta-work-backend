import type { HttpContext } from '@adonisjs/core/http'
import AddressScope from '#enums/address_scope'
import SavedAddress from '#models/saved_address'
import { saveAddressValidator } from '#validators/address'

const MAX_RECENT = 10
const SCOPES = Object.values(AddressScope) as string[]

export default class AddressesController {
  /**
   * The authenticated user's recent addresses for the given app mode, newest
   * first (max 10). `?scope=client|artisan` (defaults to client) keeps a
   * dual-role user's client and artisan addresses separate.
   */
  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const scope = this.resolveScope(request.input('scope'))

    const recent = await SavedAddress.query()
      .where('userId', user.id)
      .where('scope', scope)
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .limit(MAX_RECENT)

    return response.ok({ data: recent.map((address) => this.serialize(address)) })
  }

  /**
   * Save a selected address within its scope. Re-selecting an existing address
   * moves it to the top, and each scope's list is trimmed to {@link MAX_RECENT}.
   * Returns the updated list for that scope.
   */
  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(saveAddressValidator)
    const scope = this.resolveScope(payload.scope)

    // Dedupe within the scope so re-selecting bumps it to the top.
    await SavedAddress.query()
      .where('userId', user.id)
      .where('scope', scope)
      .where('formattedAddress', payload.address)
      .delete()

    await SavedAddress.create({
      userId: user.id,
      scope,
      formattedAddress: payload.address,
      line1: payload.line1 ?? '',
      city: payload.city ?? '',
      state: payload.state ?? '',
      postalCode: payload.postalCode ?? null,
      latitude: payload.latitude,
      longitude: payload.longitude,
    })

    const all = await SavedAddress.query()
      .where('userId', user.id)
      .where('scope', scope)
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')

    const excess = all.slice(MAX_RECENT)
    if (excess.length > 0) {
      await SavedAddress.query()
        .whereIn(
          'id',
          excess.map((address) => address.id)
        )
        .delete()
    }

    return response.created({
      data: all.slice(0, MAX_RECENT).map((address) => this.serialize(address)),
    })
  }

  /** Resolve a requested scope, defaulting to client for missing/invalid values. */
  private resolveScope(value: unknown): AddressScope {
    return SCOPES.includes(value as string) ? (value as AddressScope) : AddressScope.CLIENT
  }

  private serialize(address: SavedAddress) {
    return {
      id: address.id,
      scope: address.scope,
      address: address.formattedAddress,
      line1: address.line1,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      latitude: address.latitude,
      longitude: address.longitude,
    }
  }
}
