import ReviewModel    from '../models/ReviewModel.js'
import { uploadToCloudinary } from '../utils/uploadToCloudinary.js'

// ─────────────────────────────────────────────────────────────
// @desc    Get all reviews for a product
// @route   GET /api/review?productId=xxx
// @access  Public
// ─────────────────────────────────────────────────────────────
export const getReviewsByProduct = async (req, res) => {
  try {
    const { productId } = req.query
    if (!productId) {
      return res.status(400).json({ success: false, msg: 'productId query param is required.' })
    }
    const reviews = await ReviewModel.find({ productId }).sort({ createdAt: -1 })
    return res.status(200).json({ success: true, data: reviews })
  } catch (error) {
    console.error('getReviewsByProduct error:', error)
    return res.status(500).json({ success: false, msg: error.message })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Create a review (admin, with optional image upload)
// @route   POST /api/review
// @access  Admin
// ─────────────────────────────────────────────────────────────
export const createReview = async (req, res) => {
  try {
    const { productId, customerName, location, rating, title, comment, verifiedBuyer } = req.body

    if (!productId || !customerName || !rating || !comment) {
      return res.status(400).json({
        success: false,
        msg: 'productId, customerName, rating, and comment are required.',
      })
    }

    // Upload review image to Cloudinary if provided (same mechanism as product images)
    let imageUrl = null
    if (req.file) {
      imageUrl = await uploadToCloudinary(req.file.buffer, req.file.mimetype)
    }

    const review = await ReviewModel.create({
      productId,
      customerName: customerName.trim(),
      location:     location?.trim() || '',
      rating:       Number(rating),
      title:        title?.trim() || '',
      comment:      comment.trim(),
      imageUrl,
      verifiedBuyer: verifiedBuyer === true || verifiedBuyer === 'true',
    })

    return res.status(201).json({ success: true, msg: 'Review created.', data: review })
  } catch (error) {
    console.error('createReview error:', error)
    return res.status(500).json({ success: false, msg: error.message })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Get all reviews (admin list)
// @route   GET /api/review/all
// @access  Admin
// ─────────────────────────────────────────────────────────────
export const getAllReviews = async (req, res) => {
  try {
    const reviews = await ReviewModel.find()
      .sort({ createdAt: -1 })
      .populate('productId', 'name images')
    return res.status(200).json({ success: true, data: reviews })
  } catch (error) {
    console.error('getAllReviews error:', error)
    return res.status(500).json({ success: false, msg: error.message })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Update a review
// @route   PATCH /api/review/:id
// @access  Admin
// ─────────────────────────────────────────────────────────────
export const updateReview = async (req, res) => {
  try {
    // Upload new image if provided
    let extra = {}
    if (req.file) {
      extra.imageUrl = await uploadToCloudinary(req.file.buffer, req.file.mimetype)
    }

    const review = await ReviewModel.findByIdAndUpdate(
      req.params.id,
      { ...req.body, ...extra },
      { new: true, runValidators: true }
    )

    if (!review) return res.status(404).json({ success: false, msg: 'Review not found.' })
    return res.status(200).json({ success: true, msg: 'Review updated.', data: review })
  } catch (error) {
    console.error('updateReview error:', error)
    return res.status(500).json({ success: false, msg: error.message })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Delete a review
// @route   DELETE /api/review/:id
// @access  Admin
// ─────────────────────────────────────────────────────────────
export const deleteReview = async (req, res) => {
  try {
    const review = await ReviewModel.findByIdAndDelete(req.params.id)
    if (!review) return res.status(404).json({ success: false, msg: 'Review not found.' })
    return res.status(200).json({ success: true, msg: 'Review deleted.' })
  } catch (error) {
    console.error('deleteReview error:', error)
    return res.status(500).json({ success: false, msg: error.message })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Increment helpful count
// @route   POST /api/review/:id/helpful
// @access  Public
// ─────────────────────────────────────────────────────────────
export const markHelpful = async (req, res) => {
  try {
    const review = await ReviewModel.findByIdAndUpdate(
      req.params.id,
      { $inc: { helpfulCount: 1 } },
      { new: true }
    )
    if (!review) return res.status(404).json({ success: false, msg: 'Review not found.' })
    return res.status(200).json({ success: true, data: { helpfulCount: review.helpfulCount } })
  } catch (error) {
    console.error('markHelpful error:', error)
    return res.status(500).json({ success: false, msg: error.message })
  }
}
