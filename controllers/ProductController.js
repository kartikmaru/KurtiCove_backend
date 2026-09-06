import ProductModel from '../models/ProductModel.js'
import { uploadToCloudinary } from '../utils/uploadToCloudinary.js'
import { getCache, setCache, clearCacheByPrefix } from '../utils/cache.js'

/* ─── Shared field projection for card / list views ─────────────
   Cards never need the full HTML description — only the display
   fields required by ProductCard.jsx.
   The PDP (getProductById) still returns every field.
────────────────────────────────────────────────────────────────*/
const CARD_SELECT = '_id name category price discountPrice images stock isNewArrival isBestSeller isFeatured createdAt'

/* ─── Cache-Control helper ───────────────────────────────────── */
function setCacheControlPublic(res, maxAge = 60, swr = 300) {
  res.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${swr}`)
}

/* ─── Invalidate all product-related cache on writes ────────── */
function invalidateProductCache() {
  clearCacheByPrefix('product:')
  clearCacheByPrefix('home:')
  clearCacheByPrefix('categories')
}

// ─────────────────────────────────────────────────────────────
// @desc    Aggregated homepage data — ONE request for all sections
// @route   GET /api/home
// @access  Public
// ─────────────────────────────────────────────────────────────
export const getHomeData = async (req, res) => {
  const cacheKey = 'home:all'
  const cached   = getCache(cacheKey)
  if (cached) {
    setCacheControlPublic(res)
    return res.status(200).json({ success: true, cached: true, data: cached })
  }

  try {
    /* Run all six queries concurrently */
    const [newArrivals, bestSellers, combos, deals60, categories] = await Promise.all([

      /* New Arrivals — 8 newest */
      ProductModel.find({ isNewArrival: true })
        .sort({ createdAt: -1 })
        .limit(8)
        .select(CARD_SELECT)
        .lean(),

      /* Best Sellers — 8 newest */
      ProductModel.find({ isBestSeller: true })
        .sort({ createdAt: -1 })
        .limit(8)
        .select(CARD_SELECT)
        .lean(),

      /* Combos — category "combo", case-insensitive */
      ProductModel.find({ category: { $regex: /^combo$/i } })
        .sort({ createdAt: -1 })
        .limit(8)
        .select(CARD_SELECT)
        .lean(),

      /* Deals ≥60% off — up to 4, sorted highest discount first */
      ProductModel.aggregate([
        {
          $match: {
            discountPrice: { $exists: true, $ne: null, $gt: 0 },
          },
        },
        {
          $addFields: {
            discountPct: {
              $multiply: [
                { $divide: [{ $subtract: ['$price', '$discountPrice'] }, '$price'] },
                100,
              ],
            },
          },
        },
        { $match: { discountPct: { $gte: 60 } } },
        { $sort: { discountPct: -1 } },
        { $limit: 4 },
        {
          $project: {
            name: 1, category: 1, price: 1, discountPrice: 1,
            images: 1, stock: 1, isNewArrival: 1, isBestSeller: 1,
            isFeatured: 1, createdAt: 1, discountPct: 1,
          },
        },
      ]),

      /* Categories with counts */
      ProductModel.aggregate([
        { $match: { category: { $exists: true, $ne: '' } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $project: { _id: 0, name: '$_id', count: 1 } },
      ]),
    ])

    const result = { newArrivals, bestSellers, combos, deals60, categories }

    setCache(cacheKey, result, 90)
    setCacheControlPublic(res)
    return res.status(200).json({ success: true, cached: false, data: result })
  } catch (error) {
    console.error('getHomeData error:', error)
    return res.status(500).json({ success: false, msg: 'Server error fetching home data.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Get all products with filters, search, sort, pagination
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

    /* Build a stable cache key from sorted query params */
    const cacheKey = 'product:list:' + new URLSearchParams(
      Object.entries(req.query).sort()
    ).toString()

    const cached = getCache(cacheKey)
    if (cached) {
      setCacheControlPublic(res)
      return res.status(200).json({ success: true, cached: true, ...cached })
    }

    const query = {}

    if (isFeatured   === 'true') query.isFeatured   = true
    if (isNewArrival === 'true') query.isNewArrival = true
    if (isBestSeller === 'true') query.isBestSeller = true

    if (category && category.trim()) {
      query.category = { $regex: new RegExp(`^${category.trim()}$`, 'i') }
    }

    if (search && search.trim()) {
      const normalised = search.trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ')
      const escaped    = normalised.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      query.$or = [
        { name:        { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
      ]
    }

    if (size) query.sizes = { $in: [size] }

    if (minDiscount) {
      const pct = Number(minDiscount)
      if (!isNaN(pct) && pct > 0 && pct <= 100) {
        query.discountPrice = { $exists: true, $ne: null, $gt: 0 }
        query.$expr = {
          $gte: [
            { $multiply: [{ $divide: [{ $subtract: ['$price', '$discountPrice'] }, '$price'] }, 100] },
            pct,
          ],
        }
      }
    }

    if (minPrice || maxPrice) {
      const min = minPrice ? Number(minPrice) : null
      const max = maxPrice ? Number(maxPrice) : null
      const effectivePrice = {
        $cond: [
          { $and: [{ $gt: ['$discountPrice', 0] }, { $ne: ['$discountPrice', null] }] },
          '$discountPrice', '$price',
        ],
      }
      const conditions = []
      if (min !== null && !isNaN(min)) conditions.push({ $gte: [effectivePrice, min] })
      if (max !== null && !isNaN(max) && max > 0) conditions.push({ $lte: [effectivePrice, max] })
      if (conditions.length > 0) {
        query.$expr = query.$expr
          ? { $and: [query.$expr, ...conditions] }
          : (conditions.length === 1 ? conditions[0] : { $and: conditions })
      }
    }

    const skip  = (Number(page) - 1) * Number(limit)
    const total = await ProductModel.countDocuments(query)

    let products
    if (sort === 'asc' || sort === 'desc') {
      const pipeline = [
        { $match: query },
        {
          $addFields: {
            sellingPrice: {
              $cond: [
                { $and: [{ $gt: ['$discountPrice', 0] }, { $ne: ['$discountPrice', null] }] },
                '$discountPrice', '$price',
              ],
            },
          },
        },
        { $sort: { sellingPrice: sort === 'asc' ? 1 : -1 } },
        { $skip: skip },
        { $limit: Number(limit) },
        {
          $project: {
            sellingPrice: 0,   // drop computed field
            description:  0,   // cards don't need HTML description
          },
        },
      ]
      products = await ProductModel.aggregate(pipeline)
    } else {
      products = await ProductModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select(CARD_SELECT)
        .lean()
    }

    const payload = {
      data: products,
      pagination: {
        total,
        page:  Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    }

    /* Cache for 60s — cleared on any product write */
    setCache(cacheKey, payload, 60)
    setCacheControlPublic(res, 60, 300)
    return res.status(200).json({ success: true, cached: false, ...payload })
  } catch (error) {
    console.error('getProducts error:', error)
    return res.status(500).json({ success: false, msg: 'Server error fetching products.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Get single product by ID (full fields — used by PDP)
// @route   GET /api/product/:id
// @access  Public
// ─────────────────────────────────────────────────────────────
export const getProductById = async (req, res) => {
  try {
    const cacheKey = `product:id:${req.params.id}`
    const cached   = getCache(cacheKey)
    if (cached) {
      setCacheControlPublic(res, 120, 600)
      return res.status(200).json({ success: true, data: cached })
    }

    /* PDP needs all fields including description */
    const product = await ProductModel.findById(req.params.id).lean()
    if (!product) {
      return res.status(404).json({ success: false, msg: 'Product not found.' })
    }

    setCache(cacheKey, product, 120)
    setCacheControlPublic(res, 120, 600)
    return res.status(200).json({ success: true, data: product })
  } catch (error) {
    console.error('getProductById error:', error)
    return res.status(500).json({ success: false, msg: 'Server error.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Create a new product
// @route   POST /api/product
// @access  Admin
// ─────────────────────────────────────────────────────────────
export const createProduct = async (req, res) => {
  try {
    const { name, description, category, price, discountPrice, stock, colors, sizes, isFeatured, isNewArrival, isBestSeller } = req.body

    if (!name || !description || price === undefined) {
      return res.status(400).json({ success: false, msg: 'Name, description and price are required.' })
    }

    const parsedColors = typeof colors === 'string' ? JSON.parse(colors || '[]') : colors || []
    const parsedSizes  = typeof sizes  === 'string' ? JSON.parse(sizes  || '[]') : sizes  || []

    const product = await ProductModel.create({
      name, description,
      category: (category || '').trim(),
      price: Number(price),
      discountPrice: discountPrice ? Number(discountPrice) : null,
      stock: stock ? Number(stock) : 0,
      colors: parsedColors, sizes: parsedSizes,
      isFeatured:   isFeatured   === true || isFeatured   === 'true',
      isNewArrival: isNewArrival === true || isNewArrival === 'true',
      isBestSeller: isBestSeller === true || isBestSeller === 'true',
      images: [],
    })

    invalidateProductCache()
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
    const { name, description, category, price, discountPrice, stock, colors, sizes, isFeatured, isNewArrival, isBestSeller } = req.body

    const parsedColors = typeof colors === 'string' ? JSON.parse(colors || '[]') : colors
    const parsedSizes  = typeof sizes  === 'string' ? JSON.parse(sizes  || '[]') : sizes

    const updateData = {
      ...(name         !== undefined && { name }),
      ...(description  !== undefined && { description }),
      ...(category     !== undefined && { category: (category || '').trim() }),
      ...(price        !== undefined && { price: Number(price) }),
      ...(discountPrice !== undefined && { discountPrice: discountPrice ? Number(discountPrice) : null }),
      ...(stock        !== undefined && { stock: Number(stock) }),
      ...(parsedColors !== undefined && { colors: parsedColors }),
      ...(parsedSizes  !== undefined && { sizes:  parsedSizes }),
      ...(isFeatured   !== undefined && { isFeatured:   isFeatured   === true || isFeatured   === 'true' }),
      ...(isNewArrival !== undefined && { isNewArrival: isNewArrival === true || isNewArrival === 'true' }),
      ...(isBestSeller !== undefined && { isBestSeller: isBestSeller === true || isBestSeller === 'true' }),
    }

    const product = await ProductModel.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
    if (!product) return res.status(404).json({ success: false, msg: 'Product not found.' })

    invalidateProductCache()
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
    if (!product) return res.status(404).json({ success: false, msg: 'Product not found.' })
    invalidateProductCache()
    return res.status(200).json({ success: true, msg: 'Product deleted.' })
  } catch (error) {
    console.error('deleteProduct error:', error)
    return res.status(500).json({ success: false, msg: 'Server error deleting product.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Get distinct categories with product counts
// @route   GET /api/product/categories
// @access  Public
// ─────────────────────────────────────────────────────────────
export const getCategories = async (req, res) => {
  try {
    const cacheKey = 'categories:all'
    const cached   = getCache(cacheKey)
    if (cached) {
      setCacheControlPublic(res, 120, 600)
      return res.status(200).json({ success: true, data: cached })
    }

    const result = await ProductModel.aggregate([
      { $match: { category: { $exists: true, $ne: '' } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $project: { _id: 0, name: '$_id', count: 1 } },
    ])

    setCache(cacheKey, result, 120)
    setCacheControlPublic(res, 120, 600)
    return res.status(200).json({ success: true, data: result })
  } catch (error) {
    console.error('getCategories error:', error)
    return res.status(500).json({ success: false, msg: 'Server error fetching categories.' })
  }
}

// ─────────────────────────────────────────────────────────────
// @desc    Get similar products
// @route   GET /api/product/similar?productId=
// @access  Public
// ─────────────────────────────────────────────────────────────
export const getSimilarProducts = async (req, res) => {
  try {
    const { productId } = req.query
    if (!productId) return res.status(400).json({ success: false, msg: 'productId is required.' })

    const cacheKey = `product:similar:${productId}`
    const cached   = getCache(cacheKey)
    if (cached) {
      setCacheControlPublic(res, 120, 600)
      return res.status(200).json({ success: true, data: cached })
    }

    const source = await ProductModel.findById(productId).select('_id isFeatured isNewArrival isBestSeller category').lean()
    if (!source) return res.status(404).json({ success: false, msg: 'Product not found.' })

    const orClauses = []
    if (source.isFeatured)   orClauses.push({ isFeatured:   true })
    if (source.isNewArrival) orClauses.push({ isNewArrival: true })
    if (source.isBestSeller) orClauses.push({ isBestSeller: true })
    if (source.category)     orClauses.push({ category: source.category })

    const query = orClauses.length > 0
      ? { _id: { $ne: source._id }, $or: orClauses }
      : { _id: { $ne: source._id } }

    const similar = await ProductModel
      .find(query)
      .limit(8)
      .select(CARD_SELECT)
      .lean()

    setCache(cacheKey, similar, 120)
    setCacheControlPublic(res, 120, 600)
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
    const product = await ProductModel.findById(req.params.id)
    if (!product) return res.status(404).json({ success: false, msg: 'Product not found.' })

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, msg: 'No image files provided.' })
    }

    const uploadPromises = req.files.map(f => uploadToCloudinary(f.buffer, f.mimetype))
    const secureUrls     = await Promise.all(uploadPromises)

    product.images.push(...secureUrls)
    await product.save()

    invalidateProductCache()
    return res.status(200).json({
      success: true,
      msg: `${secureUrls.length} image(s) uploaded successfully.`,
      data: product,
    })
  } catch (error) {
    console.error('uploadProductImages error:', error)
    if (error.message && error.message.includes('Cloudinary credentials')) {
      return res.status(500).json({ success: false, msg: 'Cloudinary is not configured.' })
    }
    return res.status(500).json({ success: false, msg: 'Server error uploading images.' })
  }
}
