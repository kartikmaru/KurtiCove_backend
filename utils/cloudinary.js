import { v2 as cloudinary } from 'cloudinary'

/**
 * Configures and returns the Cloudinary v2 instance.
 * Called lazily inside uploadToCloudinary so that env vars
 * are guaranteed to be loaded by dotenv before config runs.
 */
export const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
  return cloudinary
}

export default cloudinary
