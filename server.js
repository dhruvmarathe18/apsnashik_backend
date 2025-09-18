const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://apsnashik18.vercel.app',
    'https://apsnashik18.vercel.app/',
    'https://*.vercel.app'
  ],
  credentials: true
}))
app.use(express.json())

// Configure multer for memory storage (base64 encoding)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit (reduced for base64)
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    
    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb(new Error('Only image files are allowed!'))
    }
  }
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database')
})

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err)
})

// Initialize database tables
async function initializeDatabase() {
  const client = await pool.connect()
  
  try {
    console.log('📊 Initializing database tables...')
    
    // Create events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        description TEXT,
        category VARCHAR(100),
        status VARCHAR(20) DEFAULT 'upcoming',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create gallery_images table
    await client.query(`
      CREATE TABLE IF NOT EXISTS gallery_images (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        src VARCHAR(500) NOT NULL,
        alt VARCHAR(255),
        upload_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create news_articles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS news_articles (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        publish_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(20) DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create admin_users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create contact_messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        subject VARCHAR(255),
        message TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'unread',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Insert sample data
    await client.query(`
      INSERT INTO events (title, date, description, category, status) VALUES
      ('Annual Sports Day', '2024-03-15', 'Annual sports competition for all students', 'Sports', 'upcoming'),
      ('Science Exhibition', '2024-02-20', 'Students showcase their science projects', 'Academic', 'completed'),
      ('Cultural Festival', '2024-04-10', 'Celebration of arts, music, dance, and cultural diversity', 'Cultural', 'upcoming')
      ON CONFLICT DO NOTHING
    `)

    await client.query(`
      INSERT INTO gallery_images (title, category, src, alt) VALUES
      ('Sports Day Celebration', 'School Events', '/images/kids.jpg', 'Students during sports day'),
      ('Classroom Activity', 'Classroom Activities', '/images/teacher-1.jpg', 'Students in classroom'),
      ('School Infrastructure', 'Infrastructure', '/images/infra.jpg', 'School building and facilities'),
      ('Students in Library', 'Classroom Activities', '/images/teacher-2.jpg', 'Students studying in library')
      ON CONFLICT DO NOTHING
    `)

    await client.query(`
      INSERT INTO news_articles (title, content, publish_date, status) VALUES
      ('School Achieves 100% Board Results', 'Our school has achieved excellent results in the recent board examinations with 100% pass rate and outstanding performance by our students.', '2024-01-20', 'published'),
      ('New Computer Lab Inauguration', 'We are excited to announce the inauguration of our new state-of-the-art computer laboratory equipped with latest technology and software.', '2024-01-25', 'published'),
      ('Annual Sports Meet Success', 'The annual sports meet was a grand success with participation from all students and excellent performances in various sports events.', '2024-01-30', 'published')
      ON CONFLICT DO NOTHING
    `)

    // Create default admin user
    const email = 'admin@apsnashik.com'
    const password = 'admin123456'
    const name = 'Admin User'
    
    const existingUser = await client.query('SELECT id FROM admin_users WHERE email = $1', [email])
    
    if (existingUser.rows.length === 0) {
      const saltRounds = 10
      const passwordHash = await bcrypt.hash(password, saltRounds)
      
      await client.query(
        'INSERT INTO admin_users (email, password_hash, name) VALUES ($1, $2, $3)',
        [email, passwordHash, name]
      )
      
      console.log('✅ Default admin user created')
      console.log('📧 Email:', email)
      console.log('🔑 Password:', password)
    }

    console.log('✅ Database initialized successfully!')
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    throw error
  } finally {
    client.release()
  }
}

// Routes
// Events API
app.get('/api/events', async (req, res) => {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT * FROM events ORDER BY date ASC')
    client.release()
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching events:', error)
    res.status(500).json({ error: 'Failed to fetch events' })
  }
})

app.post('/api/events', async (req, res) => {
  try {
    const { title, date, description, category, status } = req.body
    const client = await pool.connect()
    const result = await client.query(
      'INSERT INTO events (title, date, description, category, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, date, description, category, status || 'upcoming']
    )
    client.release()
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Error creating event:', error)
    res.status(500).json({ error: 'Failed to create event' })
  }
})

app.put('/api/events', async (req, res) => {
  try {
    const { id, title, date, description, category, status } = req.body
    const client = await pool.connect()
    const result = await client.query(
      'UPDATE events SET title = $1, date = $2, description = $3, category = $4, status = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
      [title, date, description, category, status, id]
    )
    client.release()
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' })
    }
    
    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating event:', error)
    res.status(500).json({ error: 'Failed to update event' })
  }
})

app.delete('/api/events', async (req, res) => {
  try {
    const { id } = req.query
    const client = await pool.connect()
    const result = await client.query('DELETE FROM events WHERE id = $1 RETURNING *', [id])
    client.release()
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' })
    }
    
    res.json({ message: 'Event deleted successfully' })
  } catch (error) {
    console.error('Error deleting event:', error)
    res.status(500).json({ error: 'Failed to delete event' })
  }
})

// Gallery API
app.get('/api/gallery', async (req, res) => {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT * FROM gallery_images ORDER BY upload_date DESC')
    client.release()
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching gallery images:', error)
    res.status(500).json({ error: 'Failed to fetch gallery images' })
  }
})

app.post('/api/gallery', async (req, res) => {
  try {
    const { title, category, src, alt } = req.body
    const client = await pool.connect()
    const result = await client.query(
      'INSERT INTO gallery_images (title, category, src, alt) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, category, src, alt]
    )
    client.release()
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Error creating gallery image:', error)
    res.status(500).json({ error: 'Failed to create gallery image' })
  }
})

app.put('/api/gallery', async (req, res) => {
  try {
    const { id, title, category, src, alt } = req.body
    const client = await pool.connect()
    const result = await client.query(
      'UPDATE gallery_images SET title = $1, category = $2, src = $3, alt = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [title, category, src, alt, id]
    )
    client.release()
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gallery image not found' })
    }
    
    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating gallery image:', error)
    res.status(500).json({ error: 'Failed to update gallery image' })
  }
})

app.delete('/api/gallery', async (req, res) => {
  try {
    const { id } = req.query
    const client = await pool.connect()
    const result = await client.query('DELETE FROM gallery_images WHERE id = $1 RETURNING *', [id])
    client.release()
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gallery image not found' })
    }
    
    res.json({ message: 'Gallery image deleted successfully' })
  } catch (error) {
    console.error('Error deleting gallery image:', error)
    res.status(500).json({ error: 'Failed to delete gallery image' })
  }
})

// File upload endpoint for gallery images
app.post('/api/upload/gallery', (req, res) => {
  upload.single('image')(req, res, async (err) => {
    try {
      if (err) {
        console.error('Multer error:', err)
        return res.status(400).json({ error: err.message })
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' })
      }

      const { title, category, alt } = req.body
      
      // Convert image to base64
      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
      
      const client = await pool.connect()
      const result = await client.query(
        'INSERT INTO gallery_images (title, category, src, alt) VALUES ($1, $2, $3, $4) RETURNING *',
        [title, category, base64Image, alt]
      )
      client.release()
      
      res.json({
        message: 'Image uploaded successfully',
        image: result.rows[0]
      })
    } catch (error) {
      console.error('Error uploading image:', error)
      res.status(500).json({ error: 'Failed to upload image' })
    }
  })
})

// News API
app.get('/api/news', async (req, res) => {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT * FROM news_articles ORDER BY publish_date DESC')
    client.release()
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching news articles:', error)
    res.status(500).json({ error: 'Failed to fetch news articles' })
  }
})

app.post('/api/news', async (req, res) => {
  try {
    const { title, content, publish_date, status } = req.body
    const client = await pool.connect()
    const result = await client.query(
      'INSERT INTO news_articles (title, content, publish_date, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, content, publish_date, status || 'draft']
    )
    client.release()
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Error creating news article:', error)
    res.status(500).json({ error: 'Failed to create news article' })
  }
})

app.put('/api/news', async (req, res) => {
  try {
    const { id, title, content, publish_date, status } = req.body
    const client = await pool.connect()
    const result = await client.query(
      'UPDATE news_articles SET title = $1, content = $2, publish_date = $3, status = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [title, content, publish_date, status, id]
    )
    client.release()
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'News article not found' })
    }
    
    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating news article:', error)
    res.status(500).json({ error: 'Failed to update news article' })
  }
})

app.delete('/api/news', async (req, res) => {
  try {
    const { id } = req.query
    const client = await pool.connect()
    const result = await client.query('DELETE FROM news_articles WHERE id = $1 RETURNING *', [id])
    client.release()
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'News article not found' })
    }
    
    res.json({ message: 'News article deleted successfully' })
  } catch (error) {
    console.error('Error deleting news article:', error)
    res.status(500).json({ error: 'Failed to delete news article' })
  }
})

// Admin Auth API
app.post('/api/admin/auth', async (req, res) => {
  try {
    const { email, password } = req.body
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }
    
    const client = await pool.connect()
    const result = await client.query('SELECT * FROM admin_users WHERE email = $1', [email])
    client.release()
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    
    const user = result.rows[0]
    const isValidPassword = await bcrypt.compare(password, user.password_hash)
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    )
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    })
  } catch (error) {
    console.error('Error during login:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

// Contact API
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body
    
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' })
    }
    
    const client = await pool.connect()
    const result = await client.query(
      'INSERT INTO contact_messages (name, email, phone, subject, message) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, email, phone, subject, message]
    )
    client.release()
    
    res.status(201).json({
      message: 'Contact message submitted successfully',
      id: result.rows[0].id
    })
  } catch (error) {
    console.error('Error submitting contact message:', error)
    res.status(500).json({ error: 'Failed to submit contact message' })
  }
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Backend server running on port ${PORT}`)
  console.log(`🌐 Health check: http://localhost:${PORT}/health`)
  
  try {
    await initializeDatabase()
  } catch (error) {
    console.error('❌ Failed to initialize database:', error)
  }
})
