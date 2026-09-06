import express from 'express'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import cors from 'cors'
import cookieParser from 'cookie-parser'

import UserRoutes    from './routes/UserRoutes.js'
import ProductRoutes from './routes/ProductRoutes.js'
import CartRoutes    from './routes/CartRoutes.js'
import OrderRoutes   from './routes/OrderRoutes.js'
import SaleRoutes    from './routes/SaleRoutes.js'
import ReviewRoutes  from './routes/ReviewRoutes.js'
import { getHomeData } from './controllers/productController.js'

dotenv.config()

const app = express()

// ─── Trust Render's (and any) reverse proxy ───────────────────
// Required so req.ip / secure cookies work behind a proxy layer.
app.set('trust proxy', 1)

// ─── Core Middleware ──────────────────────────────────────────
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// ─── CORS ──────────────────────────────────────────────────────
//
// CLIENT_URL is the deployed Vercel origin, e.g. https://kurti-cove.vercel.app
// In local dev set CLIENT_URL=http://localhost:3000 in server/.env
//
// We also always allow localhost:3000 and localhost:3001 for local work
// so you don't need to restart the server when switching between ports.
//
const allowedOrigins = [
  process.env.FRONTEND_URL,
  // Keep localhost allowed in development — harmless in production
  // because browsers never send Origin: http://localhost for real users.
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      callback(new Error(`CORS policy: origin "${origin}" is not allowed`))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  })
)

// ─── Health check (Render pings this to confirm the service is up) ──
app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'Kurti Cove API' })
})

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/user',    UserRoutes)
app.use('/api/product', ProductRoutes)
app.use('/api/cart',    CartRoutes)
app.use('/api/order',   OrderRoutes)
app.use('/api/sale',    SaleRoutes)
app.use('/api/review',  ReviewRoutes)
/* Aggregated homepage endpoint — single call replaces 6 separate calls */
app.get('/api/home', getHomeData)

// ─── Additional health endpoint (Render also accepts /api/health) ─
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'Kurti Cove API' })
})

// ─── Global error handler ─────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled Error:', err.message)
  res.status(err.status || 500).json({
    success: false,
    msg: err.message || 'Internal Server Error',
  })
})

// ─── Connect DB + Start Server ────────────────────────────────
const PORT        = process.env.PORT || 5000
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URL

if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI is not set. Add it to server/.env and restart.')
  process.exit(1)
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('✅  MongoDB connected successfully')
    app.listen(PORT, () => {
      console.log(`🚀  Kurti Cove API listening on port ${PORT}`)
    })
  })
  .catch((err) => {
    console.error('❌  MongoDB connection failed:', err.message)
    process.exit(1)
  })
