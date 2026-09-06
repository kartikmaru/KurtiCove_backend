import mongoose from 'mongoose'

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, default: '', trim: true },
    price: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, default: null, min: 0 },
    images: { type: [String], default: [] }, // Cloudinary secure_urls only
    colors: { type: [String], default: [] },
    sizes: { type: [String], default: [] },
    stock: { type: Number, default: 0, min: 0 },
    isFeatured: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },
  },
  { timestamps: true }
)

// Full-text index for search functionality
productSchema.index({ name: 'text', description: 'text' })

// Performance indexes for common query patterns
productSchema.index({ isNewArrival: 1, createdAt: -1 })
productSchema.index({ isBestSeller: 1, createdAt: -1 })
productSchema.index({ isFeatured:   1, createdAt: -1 })
productSchema.index({ category: 1,    createdAt: -1 })
productSchema.index({ createdAt: -1 })

const ProductModel = mongoose.model('Product', productSchema)
export default ProductModel
