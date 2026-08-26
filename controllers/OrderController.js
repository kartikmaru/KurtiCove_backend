import OrderModel from '../models/OrderModel.js'
import CartModel from '../models/CartModel.js'

// ─────────────────────────────────────────────────────────────
// @desc    Place a new order (UPI / PhonePe / GooglePay / COD)
// @route   POST /api/order/place
// @access  Protected
// ─────────────────────────────────────────────────────────────
export const placeOrder = async (req, res) => {
  try {
    const {
      address,
      paymentMethod = 'upi',
      paymentStatus = 'pending',
    } = req.body
    const userId = req.user._id

    // Validate address
    if (!address || !address.fullName || !address.mobile || !address.pincode || !address.addressLine || !address.city || !address.state) {
      return res.status(400).json({ success: false, msg: 'Complete delivery address is required.' })
    }

    // Validate payment method
    const validMethods = ['cod', 'upi', 'phonepe', 'googlepay']
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({ success: false, msg: 'Invalid payment method.' })
    }

    // Fetch cart from DB — never trust frontend totals
    const cart = await CartModel.findOne({ userId }).populate('items.productId', 'name price discountPrice images stock')

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, msg: 'Cart is empty.' })
    }

    // Build order items and calculate subtotal from DB prices (discounted selling price)
    let subtotal = 0
    const orderItems = cart.items.map((item) => {
      const product        = item.productId
      const effectivePrice = product.discountPrice || product.price
      subtotal += effectivePrice * item.qty
      return {
        productId: product._id,
        name:  product.name,
        price: effectivePrice,
        qty:   item.qty,
        image: product.images?.length > 0 ? product.images[0] : '',
      }
    })

    // Delivery charge: ₹49 when subtotal < ₹300, FREE at/above ₹300
    const deliveryCharge = subtotal < 300 ? 49 : 0
    const totalAmount    = subtotal + deliveryCharge

    const order = await OrderModel.create({
      user: userId,
      items: orderItems,
      address,
      subtotal,
      deliveryCharge,
      totalAmount,
      paymentMethod,
      paymentStatus,
      orderStatus: 'placed',
    })

    // Clear cart after successful order
    await CartModel.findOneAndUpdate({ userId }, { items: [] })

    return res.status(201).json({ success: true, msg: 'Order placed successfully.', data: order })
  } catch (error) {
    console.error('placeOrder error:', error)
    return res.status(500).json({ success: false, msg: 'Server error placing order.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Get all orders for logged-in user
// @route   GET /api/order/my-orders
// @access  Protected
// ─────────────────────────────────────────────────────────────
export const getMyOrders = async (req, res) => {
  try {
    const orders = await OrderModel.find({ user: req.user._id }).sort({ createdAt: -1 })

    return res.status(200).json({ success: true, data: orders })
  } catch (error) {
    console.error('getMyOrders error:', error)
    return res.status(500).json({ success: false, msg: 'Server error fetching orders.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Get order stats for user (count + total spent)
// @route   GET /api/order/stats
// @access  Protected
// ─────────────────────────────────────────────────────────────
export const getOrderStats = async (req, res) => {
  try {
    const orders = await OrderModel.find({ user: req.user._id })

    const totalOrders = orders.length
    const totalSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0)

    return res.status(200).json({ success: true, data: { totalOrders, totalSpent } })
  } catch (error) {
    console.error('getOrderStats error:', error)
    return res.status(500).json({ success: false, msg: 'Server error fetching stats.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Get single order by ID (user must own it)
// @route   GET /api/order/:id
// @access  Protected
// ─────────────────────────────────────────────────────────────
export const getOrderById = async (req, res) => {
  try {
    const order = await OrderModel.findById(req.params.id)

    if (!order) {
      return res.status(404).json({ success: false, msg: 'Order not found.' })
    }

    // Verify ownership unless admin
    if (order.user.toString() !== req.user._id.toString() && !['admin', 'superAdmin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, msg: 'Access denied.' })
    }

    return res.status(200).json({ success: true, data: order })
  } catch (error) {
    console.error('getOrderById error:', error)
    return res.status(500).json({ success: false, msg: 'Server error.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Cancel an order (user, only if status === 'placed')
// @route   PATCH /api/order/cancel/:id
// @access  Protected
// ─────────────────────────────────────────────────────────────
export const cancelOrder = async (req, res) => {
  try {
    const order = await OrderModel.findById(req.params.id)

    if (!order) {
      return res.status(404).json({ success: false, msg: 'Order not found.' })
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, msg: 'Access denied.' })
    }

    if (order.orderStatus !== 'placed') {
      return res.status(400).json({ success: false, msg: 'Order can only be cancelled when status is "placed".' })
    }

    order.orderStatus = 'cancelled'
    order.cancelledAt = new Date()
    await order.save()

    return res.status(200).json({ success: true, msg: 'Order cancelled.', data: order })
  } catch (error) {
    console.error('cancelOrder error:', error)
    return res.status(500).json({ success: false, msg: 'Server error cancelling order.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Admin — update order status
// @route   PATCH /api/order/admin/status/:id
// @access  Admin
// ─────────────────────────────────────────────────────────────
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus } = req.body

    const validStatuses = ['placed', 'confirmed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled']
    if (!orderStatus || !validStatuses.includes(orderStatus)) {
      return res.status(400).json({ success: false, msg: 'Invalid order status.' })
    }

    const order = await OrderModel.findById(req.params.id)
    if (!order) {
      return res.status(404).json({ success: false, msg: 'Order not found.' })
    }

    order.orderStatus = orderStatus
    if (orderStatus === 'delivered') order.deliveredAt = new Date()
    if (orderStatus === 'cancelled') order.cancelledAt = new Date()

    await order.save()

    return res.status(200).json({ success: true, msg: 'Order status updated.', data: order })
  } catch (error) {
    console.error('updateOrderStatus error:', error)
    return res.status(500).json({ success: false, msg: 'Server error updating order status.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Admin — get all orders with pagination
// @route   GET /api/order/admin/all
// @access  Admin
// ─────────────────────────────────────────────────────────────
export const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const query = {}
    // Search by order ID if the search string looks like a valid ObjectId
    if (search && /^[a-f\d]{24}$/i.test(search)) {
      query._id = search
    }

    const total = await OrderModel.countDocuments(query)
    const orders = await OrderModel.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (error) {
    console.error('getAllOrders error:', error)
    return res.status(500).json({ success: false, msg: 'Server error fetching orders.' })
  }
}
