import mongoose from 'mongoose'

const saleProductSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    salePrice: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
)

const saleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    products: {
      type: [saleProductSchema],
      default: [],
    },
  },
  { timestamps: true }
)

const SaleModel = mongoose.model('Sale', saleSchema)
export default SaleModel
