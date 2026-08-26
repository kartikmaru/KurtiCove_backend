import jwt from 'jsonwebtoken'

/**
 * Generates a signed JWT token containing only the user's _id.
 * Role is always fetched fresh from DB in the protect middleware.
 * @param {string} userId - MongoDB ObjectId of the user
 * @returns {string} Signed JWT token valid for 30 days
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.SECRET_KEY, { expiresIn: '30d' })
}

export default generateToken
