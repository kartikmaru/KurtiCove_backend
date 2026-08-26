import express from 'express'
import {
  createSale,
  getActiveSale,
  getAllSales,
  updateSale,
  deleteSale,
  toggleSaleStatus,
} from '../controllers/SaleController.js'
import { protect, authorize } from '../middleware/auth.js'

const router = express.Router()

// Public
router.get('/active', getActiveSale)

// Admin only
router.get('/all',          protect, authorize('admin', 'superAdmin'), getAllSales)
router.post('/create',      protect, authorize('admin', 'superAdmin'), createSale)
router.put('/update/:id',   protect, authorize('admin', 'superAdmin'), updateSale)
router.delete('/delete/:id',protect, authorize('admin', 'superAdmin'), deleteSale)
router.patch('/toggle/:id', protect, authorize('admin', 'superAdmin'), toggleSaleStatus)

export default router
