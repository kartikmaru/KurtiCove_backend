import express                from 'express'
import {
  getReviewsByProduct,
  createReview,
  getAllReviews,
  updateReview,
  deleteReview,
  markHelpful,
} from '../controllers/ReviewController.js'
import { protect, authorize } from '../middleware/auth.js'
import { upload }             from '../utils/multer.js'

const router = express.Router()

// Public
router.get('/',            getReviewsByProduct)               // ?productId=xxx
router.post('/:id/helpful', markHelpful)

// Admin
router.get('/all',        protect, authorize('admin','superAdmin'), getAllReviews)
router.post('/',          protect, authorize('admin','superAdmin'), upload.single('image'), createReview)
router.patch('/:id',      protect, authorize('admin','superAdmin'), upload.single('image'), updateReview)
router.delete('/:id',     protect, authorize('admin','superAdmin'), deleteReview)

export default router
