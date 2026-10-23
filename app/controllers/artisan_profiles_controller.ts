import { unlink } from 'node:fs/promises'
import type { HttpContext } from '@adonisjs/core/http'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import cache from '@adonisjs/cache/services/main'
import VerificationStatus from '#enums/verification_status'
import ArtisanProfile from '#models/artisan_profile'
import LocalPhotoService from '#services/local_photo_service'
import ArtisanLocationService, { type Coordinates } from '#services/artisan_location_service'
import {
  updateArtisanPortfolioValidator,
  updateArtisanProfileValidator,
} from '#validators/artisan_profile'

/** Parse a JSON string field from a multipart request, tolerating absence. */
function parseJsonField(value: unknown): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  if (typeof value !== 'string') {
    return value
  }
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function parseBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  if (typeof value === 'boolean') {
    return value
  }
  return value === 'true' || value === '1'
}

function parseNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export default class ArtisanProfilesController {
  /**
   * Public search of verified, available artisans.
   */
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = Math.min(Number(request.input('limit', 20)), 50)
    const trade = request.input('trade')
    const city = request.input('city')

    const cacheKey = `artisans:search:${trade ?? 'all'}:${city ?? 'all'}:${page}:${limit}`

    const result = await cache.getOrSet({
      key: cacheKey,
      ttl: '2m',
      factory: async () => {
        const query = ArtisanProfile.query()
          .where('verificationStatus', VerificationStatus.APPROVED)
          .where('isAvailable', true)
          .preload('user')

        if (trade) {
          query.whereILike('trade', `%${trade}%`)
        }

        if (city) {
          query.whereILike('city', `%${city}%`)
        }

        const paginated = await query.orderBy('created_at', 'desc').paginate(page, limit)
        const serialized = paginated.serialize()
        // Attach a stable placeholder distance per artisan (no coordinates yet).
        serialized.data = paginated.all().map((profile) => ({
          ...profile.serialize(),
          distanceKm: ArtisanLocationService.placeholderDistanceKm(profile.userId),
        }))
        return serialized
      },
    })

    return response.ok(result)
  }

  /**
   * Public list of verified, available artisans ordered by proximity ("artisans
   * near you"). Distance is a stable placeholder until artisans capture their
   * coordinates; pass `lat`/`lng` to rank by real distance from a point once
   * both sides have coordinates.
   */
  async nearby({ request, response }: HttpContext) {
    const limit = Math.min(Number(request.input('limit', 10)) || 10, 50)
    const trade = request.input('trade')
    const origin = this.parseOrigin(request.input('lat'), request.input('lng'))

    const query = ArtisanProfile.query()
      .where('verificationStatus', VerificationStatus.APPROVED)
      .where('isAvailable', true)
      .preload('user')

    if (trade) {
      query.whereILike('trade', `%${trade}%`)
    }

    const profiles = await query

    const data = profiles
      .map((profile) => ({
        ...profile.serialize(),
        distanceKm: ArtisanLocationService.resolveDistanceKm(
          origin,
          { latitude: profile.latitude, longitude: profile.longitude },
          profile.userId
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit)

    return response.ok({ data })
  }

  /** Parse optional lat/lng query inputs into an origin, or null if absent/invalid. */
  private parseOrigin(lat: unknown, lng: unknown): Coordinates | null {
    const latitude = Number(lat)
    const longitude = Number(lng)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null
    }
    return { latitude, longitude }
  }

  /**
   * Show a single artisan profile (public for approved artisans).
   */
  async show({ params, response }: HttpContext) {
    const profile = await ArtisanProfile.query()
      .where('id', params.id)
      .preload('user')
      .firstOrFail()

    if (profile.verificationStatus !== VerificationStatus.APPROVED) {
      return response.notFound({ message: 'Artisan profile not found' })
    }

    return response.ok({
      artisanProfile: {
        ...profile.serialize(),
        distanceKm: ArtisanLocationService.placeholderDistanceKm(profile.userId),
      },
    })
  }

  /**
   * Get the authenticated artisan's own profile.
   */
  async mine({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    await user.load('artisanProfile')

    if (!user.artisanProfile) {
      return response.notFound({ message: 'Artisan profile not found' })
    }

    return response.ok({ artisanProfile: user.artisanProfile.serialize() })
  }

  /**
   * Return the authenticated artisan's verification status.
   */
  async status({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    await user.load('artisanProfile')

    if (!user.artisanProfile) {
      return response.notFound({ message: 'Artisan profile not found' })
    }

    const { verificationStatus, verifiedAt } = user.artisanProfile

    return response.ok({
      verificationStatus,
      isVerified: verificationStatus === VerificationStatus.APPROVED,
      verifiedAt,
    })
  }

  /**
   * Update the authenticated artisan's profile.
   */
  async update({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    await user.load('artisanProfile')

    if (!user.artisanProfile) {
      return response.notFound({ message: 'Artisan profile not found' })
    }

    const payload = await request.validateUsing(updateArtisanProfileValidator)
    const photo = request.file('photo', {
      size: LocalPhotoService.MAX_SIZE,
      extnames: [...LocalPhotoService.EXTNAMES],
    })

    if (photo) {
      if (!photo.isValid) {
        return response.unprocessableEntity({
          message: photo.errors[0]?.message ?? 'Invalid photo upload',
          errors: photo.errors,
        })
      }

      const previousPhotoUrl = user.artisanProfile.photoUrl

      try {
        user.artisanProfile.photoUrl = await LocalPhotoService.storeArtisanPhoto(photo)
      } catch (error) {
        return response.badRequest({
          message: error instanceof Error ? error.message : 'Unable to store photo',
        })
      }

      if (previousPhotoUrl) {
        await unlink(LocalPhotoService.absolutePathFromUrl(previousPhotoUrl)).catch(() => {})
      }
    }

    user.artisanProfile.merge(payload)
    await user.artisanProfile.save()
    await cache.clear()

    return response.ok({ artisanProfile: user.artisanProfile.serialize() })
  }

  /**
   * Save the authenticated artisan's post-verification portfolio. Accepts a
   * multipart payload: scalar fields, JSON-encoded collections, and image
   * uploads (profile photo, certificate, and portfolio gallery).
   */
  async updatePortfolio({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    await user.load('artisanProfile')

    if (!user.artisanProfile) {
      return response.notFound({ message: 'Artisan profile not found' })
    }

    const profile = user.artisanProfile

    // Decode the multipart text fields before validating the shaped object.
    const raw = request.body()
    let payload: Awaited<ReturnType<typeof updateArtisanPortfolioValidator.validate>>
    try {
      payload = await updateArtisanPortfolioValidator.validate({
        trade: raw.trade,
        bio: raw.bio,
        yearsOfExperience: parseNumber(raw.yearsOfExperience),
        isAvailable: parseBoolean(raw.isAvailable),
        minimumLeadTimeHours: parseNumber(raw.minimumLeadTimeHours),
        additionalServices: parseJsonField(raw.additionalServices),
        languages: parseJsonField(raw.languages),
        servicePricing: parseJsonField(raw.servicePricing),
        weeklySchedule: parseJsonField(raw.weeklySchedule),
      })
    } catch (error) {
      return response.unprocessableEntity({
        message: 'Validation failed',
        errors: (error as { messages?: unknown }).messages ?? error,
      })
    }

    const fileOptions = {
      size: LocalPhotoService.MAX_SIZE,
      extnames: [...LocalPhotoService.EXTNAMES],
    }

    // --- Profile photo (replaces the previous one) ---
    const photo = request.file('photo', fileOptions)
    if (photo) {
      const stored = await this.storeOrFail(photo, response)
      if (!stored.ok) {
        return stored.response
      }
      const previous = profile.photoUrl
      profile.photoUrl = stored.url
      await this.removeLocalFile(previous)
    }

    // --- Certificate (optional) ---
    const certificate = request.file('certificate', fileOptions)
    if (certificate) {
      const stored = await this.storeOrFail(certificate, response)
      if (!stored.ok) {
        return stored.response
      }
      const previous = profile.certificateUrl
      profile.certificateUrl = stored.url
      await this.removeLocalFile(previous)
    }

    // --- Portfolio gallery: kept remote urls + newly uploaded files ---
    const keep = parseJsonField(raw.keepPortfolioImages)
    const keepImages = Array.isArray(keep)
      ? keep.filter((item): item is string => typeof item === 'string')
      : (profile.portfolioImages ?? [])

    const uploads = request.files('portfolioImages', fileOptions)
    const uploadedUrls: string[] = []
    for (const file of uploads) {
      const stored = await this.storeOrFail(file, response)
      if (!stored.ok) {
        return stored.response
      }
      uploadedUrls.push(stored.url)
    }

    const nextImages = [...keepImages, ...uploadedUrls]
    // Drop any previously stored local images the client chose to remove.
    const removedImages = (profile.portfolioImages ?? []).filter((url) => !nextImages.includes(url))
    for (const url of removedImages) {
      await this.removeLocalFile(url)
    }

    profile.trade = payload.trade
    if (payload.bio !== undefined) {
      profile.bio = payload.bio
    }
    if (payload.yearsOfExperience !== undefined) {
      profile.yearsOfExperience = payload.yearsOfExperience
    }
    if (payload.isAvailable !== undefined) {
      profile.isAvailable = payload.isAvailable
    }
    if (payload.minimumLeadTimeHours !== undefined) {
      profile.minimumLeadTimeHours = payload.minimumLeadTimeHours
    }
    if (payload.additionalServices !== undefined) {
      profile.additionalServices = payload.additionalServices
    }
    if (payload.languages !== undefined) {
      profile.languages = payload.languages
    }
    if (payload.servicePricing !== undefined) {
      profile.servicePricing = payload.servicePricing
    }
    if (payload.weeklySchedule !== undefined) {
      profile.weeklySchedule = payload.weeklySchedule
    }
    profile.portfolioImages = nextImages

    await profile.save()
    await cache.clear()

    return response.ok({ artisanProfile: profile.serialize() })
  }

  /**
   * Validate + persist a single upload, returning either its URL or the error
   * response to surface to the client.
   */
  private async storeOrFail(
    file: MultipartFile,
    response: HttpContext['response']
  ): Promise<{ ok: true; url: string } | { ok: false; response: unknown }> {
    if (!file.isValid) {
      return {
        ok: false,
        response: response.unprocessableEntity({
          message: file.errors[0]?.message ?? 'Invalid file upload',
          errors: file.errors,
        }),
      }
    }

    try {
      return { ok: true, url: await LocalPhotoService.storeArtisanFile(file) }
    } catch (error) {
      return {
        ok: false,
        response: response.badRequest({
          message: error instanceof Error ? error.message : 'Unable to store file',
        }),
      }
    }
  }

  /** Delete a locally hosted upload, ignoring remote urls and missing files. */
  private async removeLocalFile(url: string | null | undefined) {
    if (!url || !url.startsWith(LocalPhotoService.PUBLIC_URL_PREFIX)) {
      return
    }
    await unlink(LocalPhotoService.absolutePathFromUrl(url)).catch(() => {})
  }

  /**
   * Stream a locally stored artisan photo.
   */
  async photo({ params, response }: HttpContext) {
    const fileName = params.fileName

    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return response.badRequest({ message: 'Invalid file name' })
    }

    const relativePath = `storage/uploads/artisans/${fileName}`
    const absolutePath = LocalPhotoService.absolutePath(relativePath)

    return response.download(absolutePath)
  }
}
