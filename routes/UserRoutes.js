import express from 'express'
import {
  registerUser,
  verifyOtp,
  resendOtp,
  loginUser,
  adminLogin,
  logoutUser,
  getMe,
  updateProfile,
  changePassword,
  addAddress,
  deleteAddress,
} from '../controllers/UserController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

// Public routes
router.post('/create', registerUser)
router.post('/verify-otp', verifyOtp)
router.post('/reset-otp', resendOtp)
router.post('/login', loginUser)
router.post('/admin-login', adminLogin)
router.post('/logout', logoutUser)

// Protected routes
router.get('/get', protect, getMe)
router.put('/update-profile', protect, updateProfile)
router.patch('/change-password', protect, changePassword)
router.post('/addaddresses', protect, addAddress)
router.put('/deleteaddress', protect, deleteAddress)

export default router
