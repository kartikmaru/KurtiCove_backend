import jwt from 'jsonwebtoken'
import UserModel from '../models/UserModel.js'

/**
 * Protect middleware — verifies JWT from cookie or Authorization header.
 * Attaches the full user document to req.user.
 */
export const protect = async (req, res, next) => {
  try {
    let token = null

    // 1. Check httpOnly cookie first
    if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt
    }
    // 2. Fallback to Authorization Bearer header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (!token) {
      return res.status(401).json({ success: false, msg: 'Not authorized. No token provided.' })
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.SECRET_KEY)

    // Fetch user from DB — role is always from DB, never from token
    const user = await UserModel.findById(decoded.id).select('-password -otp -otpExpire')
    if (!user) {
      return res.status(401).json({ success: false, msg: 'User not found. Token invalid.' })
    }

    if (!user.isVerified) {
      return res.status(401).json({ success: false, msg: 'Account not verified. Please verify your OTP.' })
    }

    req.user = user
    next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, msg: 'Token expired. Please login again.' })
    }
    return res.status(401).json({ success: false, msg: 'Invalid token.' })
  }
}

/**
 * Authorize middleware — restricts access to specific roles.
 * Must be used AFTER protect middleware.
 * @param {...string} roles - Allowed roles (e.g. 'admin', 'superAdmin')
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        msg: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user?.role || 'none'}`,
      })
    }
    next()
  }
}
