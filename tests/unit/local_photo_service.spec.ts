import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import LocalPhotoService from '#services/local_photo_service'

test.group('LocalPhotoService', () => {
  test('exposes expected upload constraints', ({ assert }) => {
    assert.equal(LocalPhotoService.UPLOAD_DIR, 'storage/uploads/artisans')
    assert.equal(LocalPhotoService.PUBLIC_URL_PREFIX, '/api/v1/uploads/artisans')
    assert.equal(LocalPhotoService.MAX_SIZE, '5mb')
    assert.deepEqual([...LocalPhotoService.EXTNAMES], ['jpg', 'jpeg', 'png', 'webp'])
  })

  test('absolutePathFromUrl resolves stored photo URLs', ({ assert }) => {
    const absolute = LocalPhotoService.absolutePathFromUrl('/api/v1/uploads/artisans/demo.jpg')
    assert.equal(absolute, app.makePath('storage/uploads/artisans/demo.jpg'))
  })

  test('absolutePathFromUrl rejects empty file names', ({ assert }) => {
    assert.throws(() => LocalPhotoService.absolutePathFromUrl('/'), 'Invalid photo URL')
  })
})
