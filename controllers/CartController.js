import CartModel from '../models/CartModel.js'
import ProductModel from '../models/ProductModel.js'

// ─────────────────────────────────────────────────────────────
// @desc    Sync local cart with DB cart on login
// @route   POST /api/cart/sync
// @access  Protected
// ─────────────────────────────────────────────────────────────
export const syncCart = async (req, res) => {
  try {
    const userId = req.user._id
    const { localCart } = req.body

    let localItems = []
    if (localCart) {
      try {
        const parsed = JSON.parse(localCart)
        localItems = parsed.items || []
      } catch {
        localItems = []
      }
    }

    let cart = await CartModel.findOne({ userId })

    if (!cart) {
      cart = new CartModel({ userId, items: [] })
    }

    // Merge local items into DB cart
    if (localItems.length > 0) {
      for (const localItem of localItems) {
        if (!localItem.productId) continue
        const existing = cart.items.find(
          (i) => i.productId.toString() === localItem.productId.toString()
        )
        if (existing) {
          existing.qty = (existing.qty || 1) + (localItem.qty || 1)
        } else {
          cart.items.push({ productId: localItem.productId, qty: localItem.qty || 1 })
        }
      }
      await cart.save()
    }

    // Populate product details for response
    const populated = await CartModel.findOne({ userId }).populate('items.productId', 'name price discountPrice images stock')

    return res.status(200).json({ success: true, data: populated })
  } catch (error) {
    console.error('syncCart error:', error)
    return res.status(500).json({ success: false, msg: 'Server error syncing cart.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Add or update item in cart
// @route   POST /api/cart/add_to_cart
// @access  Protected
// ─────────────────────────────────────────────────────────────
export const addToCart = async (req, res) => {
  try {
    const { productId, qty = 1 } = req.body
    const userId = req.user._id

    if (!productId) {
      return res.status(400).json({ success: false, msg: 'Product ID is required.' })
    }

    const product = await ProductModel.findById(productId)
    if (!product) {
      return res.status(404).json({ success: false, msg: 'Product not found.' })
    }

    let cart = await CartModel.findOne({ userId })
    if (!cart) {
      cart = new CartModel({ userId, items: [] })
    }

    const existingItem = cart.items.find((i) => i.productId.toString() === productId.toString())

    if (existingItem) {
      existingItem.qty += Number(qty)
    } else {
      cart.items.push({ productId, qty: Number(qty) })
    }

    await cart.save()
    const populated = await CartModel.findOne({ userId }).populate('items.productId', 'name price discountPrice images stock')

    return res.status(200).json({ success: true, msg: 'Item added to cart.', data: populated })
  } catch (error) {
    console.error('addToCart error:', error)
    return res.status(500).json({ success: false, msg: 'Server error adding to cart.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Remove item from cart
// @route   DELETE /api/cart/remove
// @access  Protected
// ─────────────────────────────────────────────────────────────
export const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.body
    const userId = req.user._id

    if (!productId) {
      return res.status(400).json({ success: false, msg: 'Product ID is required.' })
    }

    const cart = await CartModel.findOne({ userId })
    if (!cart) {
      return res.status(404).json({ success: false, msg: 'Cart not found.' })
    }

    cart.items = cart.items.filter((i) => i.productId.toString() !== productId.toString())
    await cart.save()

    const populated = await CartModel.findOne({ userId }).populate('items.productId', 'name price discountPrice images stock')

    return res.status(200).json({ success: true, msg: 'Item removed.', data: populated })
  } catch (error) {
    console.error('removeFromCart error:', error)
    return res.status(500).json({ success: false, msg: 'Server error removing from cart.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Update item quantity
// @route   PUT /api/cart/update
// @access  Protected
// ─────────────────────────────────────────────────────────────
export const updateCartItem = async (req, res) => {
  try {
    const { productId, qty } = req.body
    const userId = req.user._id

    if (!productId || qty === undefined) {
      return res.status(400).json({ success: false, msg: 'Product ID and qty are required.' })
    }

    const cart = await CartModel.findOne({ userId })
    if (!cart) {
      return res.status(404).json({ success: false, msg: 'Cart not found.' })
    }

    const item = cart.items.find((i) => i.productId.toString() === productId.toString())
    if (!item) {
      return res.status(404).json({ success: false, msg: 'Item not in cart.' })
    }

    if (Number(qty) <= 0) {
      cart.items = cart.items.filter((i) => i.productId.toString() !== productId.toString())
    } else {
      item.qty = Number(qty)
    }

    await cart.save()
    const populated = await CartModel.findOne({ userId }).populate('items.productId', 'name price discountPrice images stock')

    return res.status(200).json({ success: true, msg: 'Cart updated.', data: populated })
  } catch (error) {
    console.error('updateCartItem error:', error)
    return res.status(500).json({ success: false, msg: 'Server error updating cart.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Clear entire cart
// @route   DELETE /api/cart/clear
// @access  Protected
// ─────────────────────────────────────────────────────────────
export const clearCart = async (req, res) => {
  try {
    const userId = req.user._id

    await CartModel.findOneAndUpdate({ userId }, { items: [] })

    return res.status(200).json({ success: true, msg: 'Cart cleared.' })
  } catch (error) {
    console.error('clearCart error:', error)
    return res.status(500).json({ success: false, msg: 'Server error clearing cart.' })
  }
}
