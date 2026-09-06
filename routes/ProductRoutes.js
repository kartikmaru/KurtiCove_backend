import express from 'express'
import {
  getProducts,
  getProductById,
  getCategories,
  getSimilarProducts,
  getHomeData,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImages,
} from '../controllers/ProductController.js'
import { protect, authorize } from '../middleware/auth.js'
import { upload } from '../utils/multer.js'

const router = express.Router()

// Public routes — static paths MUST come before /:id
router.get('/', getProducts)
router.get('/categories', getCategories)
router.get('/similar', getSimilarProducts)
router.get('/:id', getProductById)

// Admin routes
router.post('/', protect, authorize('admin', 'superAdmin'), createProduct)
router.put('/:id', protect, authorize('admin', 'superAdmin'), updateProduct)
router.delete('/:id', protect, authorize('admin', 'superAdmin'), deleteProduct)
router.post(
  '/:id/images',
  protect,
  authorize('admin', 'superAdmin'),
  upload.array('images', 10),
  uploadProductImages
)

export default router
