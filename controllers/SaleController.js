import SaleModel from '../models/SaleModel.js'

const PRODUCT_POPULATE = 'name images price discountPrice isBestSeller isNewArrival'

/**
 * @desc   Create a new festival sale
 * @route  POST /api/sale/create
 * @access Admin
 */
export const createSale = async (req, res) => {
  try {
    const { title, subtitle, startTime, endTime, isActive, products } = req.body

    if (!title || !startTime || !endTime || !products || !products.length) {
      return res.status(400).json({
        success: false,
        msg: 'title, startTime, endTime, and at least one product are required.',
      })
    }

    if (new Date(endTime) <= new Date(startTime)) {
      return res.status(400).json({
        success: false,
        msg: 'endTime must be after startTime.',
      })
    }

    // If setting this sale active, deactivate all others first
    if (isActive) {
      await SaleModel.updateMany({}, { isActive: false })
    }

    const sale = await SaleModel.create({
      title,
      subtitle: subtitle || '',
      startTime,
      endTime,
      isActive: isActive || false,
      products,
    })

    return res.status(201).json({ success: true, msg: 'Sale created.', data: sale })
  } catch (error) {
    console.error('createSale error:', error)
    return res.status(500).json({ success: false, msg: `Server error: ${error.message}` })
  }
}

/**
 * @desc   Get the currently active sale (public)
 * @route  GET /api/sale/active
 * @access Public
 */
export const getActiveSale = async (req, res) => {
  try {
    const now  = new Date()
    const sale = await SaleModel.findOne({
      isActive: true,
      endTime:  { $gt: now },
    }).populate('products.productId', PRODUCT_POPULATE)

    if (!sale) {
      return res.status(200).json({
        success: true,
        data:    null,
        msg:     'No active sale.',
      })
    }

    const secondsRemaining = Math.max(
      0,
      Math.floor((sale.endTime.getTime() - Date.now()) / 1000)
    )

    return res.status(200).json({
      success: true,
      data: { ...sale.toObject(), secondsRemaining },
    })
  } catch (error) {
    console.error('getActiveSale error:', error)
    return res.status(500).json({ success: false, msg: `Server error: ${error.message}` })
  }
}

/**
 * @desc   Get all sales (admin)
 * @route  GET /api/sale/all
 * @access Admin
 */
export const getAllSales = async (req, res) => {
  try {
    const sales = await SaleModel.find()
      .sort({ createdAt: -1 })
      .populate('products.productId', 'name images price')

    return res.status(200).json({ success: true, data: sales })
  } catch (error) {
    console.error('getAllSales error:', error)
    return res.status(500).json({ success: false, msg: `Server error: ${error.message}` })
  }
}

/**
 * @desc   Update a sale
 * @route  PUT /api/sale/update/:id
 * @access Admin
 */
export const updateSale = async (req, res) => {
  try {
    const { startTime, endTime } = req.body

    if (startTime && endTime && new Date(endTime) <= new Date(startTime)) {
      return res.status(400).json({
        success: false,
        msg: 'endTime must be after startTime.',
      })
    }

    // If setting active, deactivate others first
    if (req.body.isActive) {
      await SaleModel.updateMany({ _id: { $ne: req.params.id } }, { isActive: false })
    }

    const sale = await SaleModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )

    if (!sale) {
      return res.status(404).json({ success: false, msg: 'Sale not found.' })
    }

    return res.status(200).json({ success: true, msg: 'Sale updated.', data: sale })
  } catch (error) {
    console.error('updateSale error:', error)
    return res.status(500).json({ success: false, msg: `Server error: ${error.message}` })
  }
}

/**
 * @desc   Delete a sale
 * @route  DELETE /api/sale/delete/:id
 * @access Admin
 */
export const deleteSale = async (req, res) => {
  try {
    const sale = await SaleModel.findByIdAndDelete(req.params.id)
    if (!sale) {
      return res.status(404).json({ success: false, msg: 'Sale not found.' })
    }
    return res.status(200).json({ success: true, msg: 'Sale deleted.' })
  } catch (error) {
    console.error('deleteSale error:', error)
    return res.status(500).json({ success: false, msg: `Server error: ${error.message}` })
  }
}

/**
 * @desc   Toggle a sale's isActive status (only one active at a time)
 * @route  PATCH /api/sale/toggle/:id
 * @access Admin
 */
export const toggleSaleStatus = async (req, res) => {
  try {
    const sale = await SaleModel.findById(req.params.id)
    if (!sale) {
      return res.status(404).json({ success: false, msg: 'Sale not found.' })
    }

    const newStatus = !sale.isActive

    // If activating, deactivate all others first
    if (newStatus) {
      await SaleModel.updateMany({ _id: { $ne: sale._id } }, { isActive: false })
    }

    sale.isActive = newStatus
    await sale.save()

    return res.status(200).json({
      success: true,
      msg:  `Sale ${newStatus ? 'activated' : 'deactivated'}.`,
      data: sale,
    })
  } catch (error) {
    console.error('toggleSaleStatus error:', error)
    return res.status(500).json({ success: false, msg: `Server error: ${error.message}` })
  }
}
