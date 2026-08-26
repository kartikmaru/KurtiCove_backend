import mongoose from 'mongoose'

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    addressLine: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
  },
  { _id: true }
)

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true }, // Cryptr encrypted
    mobile: { type: String, default: '', trim: true },
    role: {
      type: String,
      enum: ['user', 'admin', 'superAdmin'],
      default: 'user',
    },
    isVerified: { type: Boolean, default: false },
    otp: { type: Number, default: null },
    otpExpire: { type: Date, default: null },
    addresses: { type: [addressSchema], default: [] },
  },
  { timestamps: true }
)

const UserModel = mongoose.model('User', userSchema)
export default UserModel
