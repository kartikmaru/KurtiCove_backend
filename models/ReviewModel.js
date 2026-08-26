import mongoose from 'mongoose'

/**
 * Review schema — one review per customer per product.
 * Uses MongoDB + Mongoose (same as rest of the project).
 * "Migration" = schema definition; Mongoose auto-creates the collection.
 */
const reviewSchema = new mongoose.Schema(
  {
    productId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Product',
      required: true,
      index:    true,
    },
    customerName: {
      type:     String,
      required: true,
      trim:     true,
    },
    location: {
      type:    String,
      default: '',
      trim:    true,
    },
    rating: {
      type:     Number,
      required: true,
      min:      1,
      max:      5,
    },
    title: {
      type:    String,
      default: '',
      trim:    true,
    },
    comment: {
      type:     String,
      required: true,
      trim:     true,
    },
    imageUrl: {
      type:    String,
      default: null,
    },
    verifiedBuyer: {
      type:    Boolean,
      default: false,
    },
    helpfulCount: {
      type:    Number,
      default: 0,
      min:     0,
    },
  },
  { timestamps: true }
)

const ReviewModel = mongoose.model('Review', reviewSchema)
export default ReviewModel
