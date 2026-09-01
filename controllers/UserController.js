import Cryptr from 'cryptr'
import UserModel from '../models/UserModel.js'
import generateToken from '../utils/generateToken.js'
import { sendOtpMail } from '../utils/SendOtpMail.js'
import { sendWelcomeEmail } from '../services/emailService.js'

/** Cookie options based on environment */
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
})

/** Generate a 6-digit OTP */
const generateOTP = () => Math.floor(100000 + Math.random() * 900000)

// ─────────────────────────────────────────────────────────────
// @desc    Register new user + send OTP email
// @route   POST /api/user/create
// @access  Public
// ─────────────────────────────────────────────────────────────
export const registerUser = async (req, res) => {
  try {
    // Guard: ensure CRYPTR_SECRET is loaded before instantiating
    if (!process.env.CRYPTR_SECRET) {
      console.error('registerUser: CRYPTR_SECRET is not set in environment variables.')
      return res.status(500).json({ success: false, msg: 'Server configuration error.' })
    }
    const cryptr = new Cryptr(process.env.CRYPTR_SECRET)

    const { name, email, password, mobile } = req.body

    // Guard: ensure req.body was parsed (catches missing Content-Type header)
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ success: false, msg: 'Request body is missing or not valid JSON.' })
    }

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, msg: 'Name, email and password are required.' })
    }

    if (typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, msg: 'Please provide a valid email address.' })
    }

    const existing = await UserModel.findOne({ email: email.toLowerCase() })
    if (existing) {
      return res.status(400).json({ success: false, msg: 'Email already registered.' })
    }

    const encryptedPassword = cryptr.encrypt(password)
    const otp = generateOTP()
    const otpExpire = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    const user = await UserModel.create({
      name,
      email: email.toLowerCase(),
      password: encryptedPassword,
      mobile: mobile || '',
      otp,
      otpExpire,
      isVerified: false,
    })

    // Send OTP email — wrapped so email failure never crashes the server
    try {
      await sendOtpMail(user.email, otp)
    } catch (emailErr) {
      console.error('OTP email failed:', emailErr.message)
    }

    return res.status(201).json({
      success: true,
      msg: 'Registration successful. Check your email for the OTP.',
      data: { email: user.email },
    })
  } catch (error) {
    console.error('registerUser error:', error)
    return res.status(500).json({ success: false, msg: 'Server error during registration.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Verify OTP + auto-login
// @route   POST /api/user/verify-otp
// @access  Public
// ─────────────────────────────────────────────────────────────
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body

    if (!email || !otp) {
      return res.status(400).json({ success: false, msg: 'Email and OTP are required.' })
    }

    const user = await UserModel.findOne({ email: email.toLowerCase() })
    if (!user) {
      return res.status(404).json({ success: false, msg: 'User not found.' })
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, msg: 'Account already verified.' })
    }

    if (user.otp !== Number(otp)) {
      return res.status(400).json({ success: false, msg: 'Invalid OTP.' })
    }

    if (!user.otpExpire || user.otpExpire < new Date()) {
      return res.status(400).json({ success: false, msg: 'OTP has expired. Please request a new one.' })
    }

    user.isVerified = true
    user.otp = null
    user.otpExpire = null
    await user.save()

    // Send welcome email — fire-and-forget, never block the response
    try {
      if (process.env.BREVO_API_KEY) {
        await sendWelcomeEmail(user.email, user.name)
      }
    } catch (emailErr) {
      console.error('Welcome email failed (non-fatal):', emailErr.message)
    }

    const token = generateToken(user._id)
    res.cookie('jwt', token, cookieOptions())

    return res.status(200).json({
      success: true,
      msg: 'Account verified successfully.',
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          mobile: user.mobile,
        },
      },
    })
  } catch (error) {
    console.error('verifyOtp error:', error)
    return res.status(500).json({ success: false, msg: 'Server error during OTP verification.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Resend OTP
// @route   POST /api/user/reset-otp
// @access  Public
// ─────────────────────────────────────────────────────────────
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ success: false, msg: 'Email is required.' })
    }

    const user = await UserModel.findOne({ email: email.toLowerCase() })
    if (!user) {
      return res.status(404).json({ success: false, msg: 'User not found.' })
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, msg: 'Account already verified.' })
    }

    const otp = generateOTP()
    user.otp = otp
    user.otpExpire = new Date(Date.now() + 10 * 60 * 1000)
    await user.save()

    try {
      await sendOtpMail(user.email, otp)
    } catch (emailErr) {
      console.error('Resend OTP email failed:', emailErr.message)
    }

    return res.status(200).json({ success: true, msg: 'OTP resent successfully.' })
  } catch (error) {
    console.error('resendOtp error:', error)
    return res.status(500).json({ success: false, msg: 'Server error during OTP resend.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Login user
// @route   POST /api/user/login
// @access  Public
// ─────────────────────────────────────────────────────────────
export const loginUser = async (req, res) => {
  try {
    if (!process.env.CRYPTR_SECRET) {
      console.error('loginUser: CRYPTR_SECRET is not set in environment variables.')
      return res.status(500).json({ success: false, msg: 'Server configuration error.' })
    }
    const cryptr = new Cryptr(process.env.CRYPTR_SECRET)
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ success: false, msg: 'Email and password are required.' })
    }

    const user = await UserModel.findOne({ email: email.toLowerCase() })
    if (!user) {
      return res.status(401).json({ success: false, msg: 'Invalid email or password.' })
    }

    if (!user.isVerified) {
      return res.status(401).json({ success: false, msg: 'Account not verified. Please verify your OTP.' })
    }

    const decryptedPassword = cryptr.decrypt(user.password)
    if (decryptedPassword !== password) {
      return res.status(401).json({ success: false, msg: 'Invalid email or password.' })
    }

    const token = generateToken(user._id)
    res.cookie('jwt', token, cookieOptions())

    return res.status(200).json({
      success: true,
      msg: 'Login successful.',
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          mobile: user.mobile,
        },
      },
    })
  } catch (error) {
    console.error('loginUser error:', error)
    return res.status(500).json({ success: false, msg: 'Server error during login.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Admin login (only admin/superAdmin roles allowed)
// @route   POST /api/user/admin-login
// @access  Public
// ─────────────────────────────────────────────────────────────
export const adminLogin = async (req, res) => {
  try {
    if (!process.env.CRYPTR_SECRET) {
      console.error('adminLogin: CRYPTR_SECRET is not set in environment variables.')
      return res.status(500).json({ success: false, msg: 'Server configuration error.' })
    }
    const cryptr = new Cryptr(process.env.CRYPTR_SECRET)
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ success: false, msg: 'Email and password are required.' })
    }

    const user = await UserModel.findOne({ email: email.toLowerCase() })
    if (!user) {
      return res.status(401).json({ success: false, msg: 'Invalid credentials.' })
    }

    if (!['admin', 'superAdmin'].includes(user.role)) {
      return res.status(403).json({ success: false, msg: 'Access denied. Admin only.' })
    }

    const decryptedPassword = cryptr.decrypt(user.password)
    if (decryptedPassword !== password) {
      return res.status(401).json({ success: false, msg: 'Invalid credentials.' })
    }

    const token = generateToken(user._id)
    res.cookie('jwt', token, cookieOptions())

    return res.status(200).json({
      success: true,
      msg: 'Admin login successful.',
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    })
  } catch (error) {
    console.error('adminLogin error:', error)
    return res.status(500).json({ success: false, msg: 'Server error during admin login.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Logout user — clears JWT cookie
// @route   POST /api/user/logout
// @access  Public
// ─────────────────────────────────────────────────────────────
export const logoutUser = async (req, res) => {
  try {
    res.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    })
    return res.status(200).json({ success: true, msg: 'Logged out successfully.' })
  } catch (error) {
    console.error('logoutUser error:', error)
    return res.status(500).json({ success: false, msg: 'Server error during logout.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Get current logged-in user
// @route   GET /api/user/get
// @access  Protected
// ─────────────────────────────────────────────────────────────
export const getMe = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user._id).select('-password -otp -otpExpire')
    if (!user) {
      return res.status(404).json({ success: false, msg: 'User not found.' })
    }
    return res.status(200).json({ success: true, data: user })
  } catch (error) {
    console.error('getMe error:', error)
    return res.status(500).json({ success: false, msg: 'Server error.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Update name and mobile
// @route   PUT /api/user/update-profile
// @access  Protected
// ─────────────────────────────────────────────────────────────
export const updateProfile = async (req, res) => {
  try {
    const { name, mobile } = req.body

    if (!name) {
      return res.status(400).json({ success: false, msg: 'Name is required.' })
    }

    const user = await UserModel.findByIdAndUpdate(
      req.user._id,
      { name, mobile: mobile || '' },
      { new: true, runValidators: true }
    ).select('-password -otp -otpExpire')

    return res.status(200).json({ success: true, msg: 'Profile updated.', data: user })
  } catch (error) {
    console.error('updateProfile error:', error)
    return res.status(500).json({ success: false, msg: 'Server error.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Change password
// @route   PATCH /api/user/change-password
// @access  Protected
// ─────────────────────────────────────────────────────────────
export const changePassword = async (req, res) => {
  try {
    if (!process.env.CRYPTR_SECRET) {
      console.error('changePassword: CRYPTR_SECRET is not set in environment variables.')
      return res.status(500).json({ success: false, msg: 'Server configuration error.' })
    }
    const cryptr = new Cryptr(process.env.CRYPTR_SECRET)
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, msg: 'Current and new passwords are required.' })
    }

    const user = await UserModel.findById(req.user._id)
    const decrypted = cryptr.decrypt(user.password)

    if (decrypted !== currentPassword) {
      return res.status(400).json({ success: false, msg: 'Current password is incorrect.' })
    }

    user.password = cryptr.encrypt(newPassword)
    await user.save()

    return res.status(200).json({ success: true, msg: 'Password changed successfully.' })
  } catch (error) {
    console.error('changePassword error:', error)
    return res.status(500).json({ success: false, msg: 'Server error.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Add a delivery address
// @route   POST /api/user/addaddresses
// @access  Protected
// ─────────────────────────────────────────────────────────────
export const addAddress = async (req, res) => {
  try {
    const { fullName, mobile, pincode, addressLine, city, state } = req.body

    if (!fullName || !mobile || !pincode || !addressLine || !city || !state) {
      return res.status(400).json({ success: false, msg: 'All address fields are required.' })
    }

    const user = await UserModel.findById(req.user._id)
    user.addresses.push({ fullName, mobile, pincode, addressLine, city, state })
    await user.save()

    return res.status(201).json({
      success: true,
      msg: 'Address added.',
      data: user.addresses,
    })
  } catch (error) {
    console.error('addAddress error:', error)
    return res.status(500).json({ success: false, msg: 'Server error.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Delete a delivery address by index
// @route   PUT /api/user/deleteaddress
// @access  Protected
// ─────────────────────────────────────────────────────────────
export const deleteAddress = async (req, res) => {
  try {
    const { index } = req.body

    if (index === undefined || index === null) {
      return res.status(400).json({ success: false, msg: 'Address index is required.' })
    }

    const user = await UserModel.findById(req.user._id)

    if (index < 0 || index >= user.addresses.length) {
      return res.status(400).json({ success: false, msg: 'Invalid address index.' })
    }

    user.addresses.splice(index, 1)
    await user.save()

    return res.status(200).json({
      success: true,
      msg: 'Address deleted.',
      data: user.addresses,
    })
  } catch (error) {
    console.error('deleteAddress error:', error)
    return res.status(500).json({ success: false, msg: 'Server error.' })
  }
}
