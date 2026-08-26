import mongoose from 'mongoose'

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name:  { type: String, required: true },
    price: { type: Number, required: true },
    qty:   { type: Number, required: true, min: 1 },
    image: { type: String, default: '' },
  },
  { _id: false }
)

const addressSchema = new mongoose.Schema(
  {
    fullName:    { type: String, required: true },
    mobile:      { type: String, required: true },
    pincode:     { type: String, required: true },
    addressLine: { type: String, required: true },
    city:        { type: String, required: true },
    state:       { type: String, required: true },
  },
  { _id: false }
)

const orderSchema = new mongoose.Schema(
  {
    user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items:   { type: [orderItemSchema], required: true },
    address: { type: addressSchema, required: true },

    // Subtotal of items (before delivery charge)
    subtotal:       { type: Number, required: true, min: 0, default: 0 },
    // ₹49 when subtotal < ₹300, else 0
    deliveryCharge: { type: Number, required: true, min: 0, default: 0 },
    // Grand total = subtotal + deliveryCharge
    totalAmount:    { type: Number, required: true, min: 0 },

    paymentMethod: {
      type: String,
      enum: ['cod', 'upi', 'phonepe', 'googlepay'],
      default: 'upi',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },

    orderStatus: {
      type: String,
      enum: ['placed', 'confirmed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'placed',
    },
    cancelledAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true }
)

const OrderModel = mongoose.model('Order', orderSchema)
export default OrderModel
