import express from 'express'
import { syncCart, addToCart, removeFromCart, updateCartItem, clearCart } from '../controllers/CartController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

router.post('/sync', protect, syncCart)
router.post('/add_to_cart', protect, addToCart)
router.delete('/remove', protect, removeFromCart)
router.put('/update', protect, updateCartItem)
router.delete('/clear', protect, clearCart)

export default router
