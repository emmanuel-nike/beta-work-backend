import { mkdir } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import { cuid } from '@adonisjs/core/helpers'
import type { MultipartFile } from '@adonisjs/core/bodyparser'

export default class LocalPhotoService {
  static readonly UPLOAD_DIR = 'storage/uploads/artisans'
  static readonly PUBLIC_URL_PREFIX = '/api/v1/uploads/artisans'
  static readonly MAX_SIZE = '5mb'
  static readonly EXTNAMES = ['jpg', 'jpeg', 'png', 'webp'] as const

  /**
   * Persist an artisan photo locally and return its public URL.
   */
  static async storeArtisanPhoto(photo: MultipartFile) {
    return this.storeArtisanFile(photo)
  }

  /**
   * Persist any artisan image upload (profile photo, certificate, or portfolio
   * image) locally and return its public URL.
   */
  static async storeArtisanFile(file: MultipartFile) {
    const directory = app.makePath(this.UPLOAD_DIR)
    await mkdir(directory, { recursive: true })

    const fileName = `${cuid()}.${file.extname}`
    await file.move(directory, { name: fileName })

    if (file.state !== 'moved') {
      throw new Error(file.errors[0]?.message ?? 'Unable to store file')
    }

    return `${this.PUBLIC_URL_PREFIX}/${fileName}`
  }

  /**
   * Resolve a stored photo URL to an absolute filesystem path.
   */
  static absolutePathFromUrl(photoUrl: string) {
    const fileName = photoUrl.split('/').pop()
    if (!fileName) {
      throw new Error('Invalid photo URL')
    }

    return app.makePath(`${this.UPLOAD_DIR}/${fileName}`)
  }

  static absolutePath(relativePath: string) {
    return app.makePath(relativePath)
  }
}
