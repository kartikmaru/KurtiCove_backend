import ProductModel from '../models/ProductModel.js'
import { uploadToCloudinary } from '../utils/uploadToCloudinary.js'

// ─────────────────────────────────────────────────────────────
// @desc    Get all products with filters, search, sort
// @route   GET /api/product
// @access  Public
// ─────────────────────────────────────────────────────────────
export const getProducts = async (req, res) => {
  try {
    const {
      isFeatured, isNewArrival, isBestSeller,
      category, search, sort, size,
      page = 1, limit = 20,
      minDiscount, minPrice, maxPrice,
    } = req.query

    const query = {}

    // Boolean filters
    if (isFeatured === 'true') query.isFeatured = true
    if (isNewArrival === 'true') query.isNewArrival = true
    if (isBestSeller === 'true') query.isBestSeller = true

    // Category filter (case-insensitive)
    if (category && category.trim()) {
      query.category = { $regex: new RegExp(`^${category.trim()}$`, 'i') }
    }

    // Partial substring search — case-insensitive regex on name and description.
    // Normalise hyphens/underscores to spaces so "ruby-charm" matches "ruby charm".
    if (search && search.trim()) {
      const normalised = search.trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ')
      const escaped    = normalised.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      query.$or = [
        { name:        { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
      ]
    }

    // Size filter
    if (size) {
      query.sizes = { $in: [size] }
    }

    // minDiscount filter — only products where discountPrice exists AND
    // ((price - discountPrice) / price * 100) >= minDiscount
    // We express this as: discountPrice <= price * (1 - minDiscount/100)
    // using a $where or $expr aggregation expression
    if (minDiscount) {
      const pct = Number(minDiscount)
      if (!isNaN(pct) && pct > 0 && pct <= 100) {
        // discountPrice must exist and be > 0
        query.discountPrice = { $exists: true, $ne: null, $gt: 0 }
        // ((price - discountPrice) / price) * 100 >= pct
        // => price - discountPrice >= price * pct / 100
        // => discountPrice <= price * (1 - pct/100)
        // MongoDB $expr lets us compare two fields
        query.$expr = {
          $gte: [
            {
              $multiply: [
                { $divide: [{ $subtract: ['$price', '$discountPrice'] }, '$price'] },
                100,
              ],
            },
            pct,
          ],
        }
      }
    }

    // Price range filter — filter by selling price (discountPrice if set, else price)
    // We use $expr to compare against the effective price field
    if (minPrice || maxPrice) {
      const min = minPrice ? Number(minPrice) : null
      const max = maxPrice ? Number(maxPrice) : null
      // Effective price = discountPrice if it exists and > 0, else price
      const effectivePrice = {
        $cond: [
          { $and: [{ $gt: ['$discountPrice', 0] }, { $ne: ['$discountPrice', null] }] },
          '$discountPrice',
          '$price',
        ],
      }
      const conditions = []
      if (min !== null && !isNaN(min)) conditions.push({ $gte: [effectivePrice, min] })
      if (max !== null && !isNaN(max) && max > 0) conditions.push({ $lte: [effectivePrice, max] })
      if (conditions.length > 0) {
        // Merge with existing $expr if present (from minDiscount)
        if (query.$expr) {
          query.$expr = { $and: [query.$expr, ...conditions] }
        } else {
          query.$expr = conditions.length === 1 ? conditions[0] : { $and: conditions }
        }
      }
    }

    // Sort options
    // For price sorting we sort by the effective selling price (discountPrice if set, else price)
    // so customers see results in the order they actually pay.
    // Default (newest first) uses a simple find+sort; price sorts use aggregation with $addFields.
    const skip  = (Number(page) - 1) * Number(limit)
    const total = await ProductModel.countDocuments(query)

    let products
    if (sort === 'asc' || sort === 'desc') {
      // Aggregation: add a computed sellingPrice field, sort on it, then project it away
      const pipeline = [
        { $match: query },
        {
          $addFields: {
            sellingPrice: {
              $cond: [
                { $and: [{ $gt: ['$discountPrice', 0] }, { $ne: ['$discountPrice', null] }] },
                '$discountPrice',
                '$price',
              ],
            },
          },
        },
        { $sort: { sellingPrice: sort === 'asc' ? 1 : -1 } },
        { $skip: skip },
        { $limit: Number(limit) },
        { $project: { sellingPrice: 0 } }, // remove the computed field before returning
      ]
      products = await ProductModel.aggregate(pipeline)
    } else {
      // Default: newest first — simple find
      products = await ProductModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit))
    }

    return res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (error) {
    console.error('getProducts error:', error)
    return res.status(500).json({ success: false, msg: 'Server error fetching products.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Get single product by ID
// @route   GET /api/product/:id
// @access  Public
// ─────────────────────────────────────────────────────────────
export const getProductById = async (req, res) => {
  try {
    const product = await ProductModel.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ success: false, msg: 'Product not found.' })
    }
    return res.status(200).json({ success: true, data: product })
  } catch (error) {
    console.error('getProductById error:', error)
    return res.status(500).json({ success: false, msg: 'Server error.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Create a new product (text fields only)
// @route   POST /api/product
// @access  Admin
// ─────────────────────────────────────────────────────────────
export const createProduct = async (req, res) => {
  try {
    const { name, description, category, price, discountPrice, stock, colors, sizes, isFeatured, isNewArrival, isBestSeller } =
      req.body

    if (!name || !description || price === undefined) {
      return res.status(400).json({ success: false, msg: 'Name, description and price are required.' })
    }

    // Parse arrays — they may come as JSON strings from form data
    const parsedColors = typeof colors === 'string' ? JSON.parse(colors || '[]') : colors || []
    const parsedSizes = typeof sizes === 'string' ? JSON.parse(sizes || '[]') : sizes || []

    const product = await ProductModel.create({
      name,
      description,
      category: (category || '').trim(),
      price: Number(price),
      discountPrice: discountPrice ? Number(discountPrice) : null,
      stock: stock ? Number(stock) : 0,
      colors: parsedColors,
      sizes: parsedSizes,
      isFeatured: isFeatured === true || isFeatured === 'true',
      isNewArrival: isNewArrival === true || isNewArrival === 'true',
      isBestSeller: isBestSeller === true || isBestSeller === 'true',
      images: [],
    })

    return res.status(201).json({ success: true, msg: 'Product created.', data: product })
  } catch (error) {
    console.error('createProduct error:', error)
    return res.status(500).json({ success: false, msg: 'Server error creating product.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Update product
// @route   PUT /api/product/:id
// @access  Admin
// ─────────────────────────────────────────────────────────────
export const updateProduct = async (req, res) => {
  try {
    const { name, description, category, price, discountPrice, stock, colors, sizes, isFeatured, isNewArrival, isBestSeller } =
      req.body

    const parsedColors = typeof colors === 'string' ? JSON.parse(colors || '[]') : colors
    const parsedSizes = typeof sizes === 'string' ? JSON.parse(sizes || '[]') : sizes

    const updateData = {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(category !== undefined && { category: (category || '').trim() }),
      ...(price !== undefined && { price: Number(price) }),
      ...(discountPrice !== undefined && { discountPrice: discountPrice ? Number(discountPrice) : null }),
      ...(stock !== undefined && { stock: Number(stock) }),
      ...(parsedColors !== undefined && { colors: parsedColors }),
      ...(parsedSizes !== undefined && { sizes: parsedSizes }),
      ...(isFeatured !== undefined && { isFeatured: isFeatured === true || isFeatured === 'true' }),
      ...(isNewArrival !== undefined && { isNewArrival: isNewArrival === true || isNewArrival === 'true' }),
      ...(isBestSeller !== undefined && { isBestSeller: isBestSeller === true || isBestSeller === 'true' }),
    }

    const product = await ProductModel.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })

    if (!product) {
      return res.status(404).json({ success: false, msg: 'Product not found.' })
    }

    return res.status(200).json({ success: true, msg: 'Product updated.', data: product })
  } catch (error) {
    console.error('updateProduct error:', error)
    return res.status(500).json({ success: false, msg: 'Server error updating product.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Delete product
// @route   DELETE /api/product/:id
// @access  Admin
// ─────────────────────────────────────────────────────────────
export const deleteProduct = async (req, res) => {
  try {
    const product = await ProductModel.findByIdAndDelete(req.params.id)
    if (!product) {
      return res.status(404).json({ success: false, msg: 'Product not found.' })
    }
    return res.status(200).json({ success: true, msg: 'Product deleted.' })
  } catch (error) {
    console.error('deleteProduct error:', error)
    return res.status(500).json({ success: false, msg: 'Server error deleting product.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Get all distinct categories with product counts
// @route   GET /api/product/categories
// @access  Public
// ─────────────────────────────────────────────────────────────
export const getCategories = async (req, res) => {
  try {
    const result = await ProductModel.aggregate([
      { $match: { category: { $exists: true, $ne: '' } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $project: { _id: 0, name: '$_id', count: 1 } },
    ])
    return res.status(200).json({ success: true, data: result })
  } catch (error) {
    console.error('getCategories error:', error)
    return res.status(500).json({ success: false, msg: 'Server error fetching categories.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Get similar products (by shared boolean flags)
// @route   GET /api/product/similar?productId=
// @access  Public
// ─────────────────────────────────────────────────────────────
export const getSimilarProducts = async (req, res) => {
  try {
    const { productId } = req.query
    if (!productId) {
      return res.status(400).json({ success: false, msg: 'productId is required.' })
    }

    // Find the source product to read its flags
    const source = await ProductModel.findById(productId).lean()
    if (!source) {
      return res.status(404).json({ success: false, msg: 'Product not found.' })
    }

    // Build an OR query matching at least one of the same boolean flags
    const orClauses = []
    if (source.isFeatured)   orClauses.push({ isFeatured:   true })
    if (source.isNewArrival) orClauses.push({ isNewArrival: true })
    if (source.isBestSeller) orClauses.push({ isBestSeller: true })

    // If the product has no flags set, return any 4 other products
    const query = orClauses.length > 0
      ? { _id: { $ne: source._id }, $or: orClauses }
      : { _id: { $ne: source._id } }

    const similar = await ProductModel.find(query).limit(4).lean()

    return res.status(200).json({ success: true, data: similar })
  } catch (error) {
    console.error('getSimilarProducts error:', error)
    return res.status(500).json({ success: false, msg: 'Server error fetching similar products.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Upload product images to Cloudinary
// @route   POST /api/product/:id/images
// @access  Admin
// ─────────────────────────────────────────────────────────────
export const uploadProductImages = async (req, res) => {
  try {
    // 1. Validate product exists
    const product = await ProductModel.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ success: false, msg: 'Product not found.' })
    }

    // 2. Validate files were received by multer
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, msg: 'No image files provided.' })
    }

    // 3. Upload all buffers to Cloudinary concurrently
    const uploadPromises = req.files.map((file) =>
      uploadToCloudinary(file.buffer, file.mimetype)
    )
    const secureUrls = await Promise.all(uploadPromises)

    // 4. Append returned secure_urls to product.images and save
    product.images.push(...secureUrls)
    await product.save()

    return res.status(200).json({
      success: true,
      msg: `${secureUrls.length} image(s) uploaded successfully.`,
      data: product,
    })
  } catch (error) {
    console.error('uploadProductImages error:', error)

    // Cloudinary credential errors return a specific message
    if (error.message && error.message.includes('Cloudinary credentials')) {
      return res.status(500).json({
        success: false,
        msg: 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in server/.env',
      })
    }

    return res.status(500).json({ success: false, msg: 'Server error uploading images.' })
  }
}
