import { configureCloudinary } from './cloudinary.js'

/**
 * Uploads a file buffer to Cloudinary via upload_stream.
 * Calls configureCloudinary() on every invocation so that
 * env vars (loaded by dotenv at server start) are always current.
 *
 * No disk storage — buffer goes straight to Cloudinary over HTTPS.
 *
 * @param {Buffer} buffer   - File buffer from multer memoryStorage
 * @param {string} mimetype - MIME type, e.g. 'image/jpeg'
 * @returns {Promise<string>} Resolves with the Cloudinary secure_url
 */
export const uploadToCloudinary = (buffer, mimetype) => {
  return new Promise((resolve, reject) => {
    // Configure with live env vars (safe: dotenv.config() has already run)
    const cloudinary = configureCloudinary()

    // Guard: fail fast with a clear message if credentials are missing
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return reject(
        new Error(
          'Cloudinary credentials are not configured. ' +
          'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in server/.env'
        )
      )
    }

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'kurti-cove/products',
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error)
        if (!result || !result.secure_url) {
          return reject(new Error('Cloudinary upload succeeded but returned no secure_url'))
        }
        resolve(result.secure_url)
      }
    )

    stream.end(buffer)
  })
}
