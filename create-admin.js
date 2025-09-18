const { Pool } = require('pg')
const bcrypt = require('bcryptjs')
require('dotenv').config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

async function createAdmin() {
  const client = await pool.connect()
  
  try {
    console.log('🔐 Creating admin user...')
    
    // Check if admin already exists
    const existingAdmin = await client.query('SELECT * FROM admin_users WHERE email = $1', ['admin@apsnashik.com'])
    
    if (existingAdmin.rows.length > 0) {
      console.log('✅ Admin user already exists')
      return
    }
    
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123456', 10)
    
    await client.query(
      'INSERT INTO admin_users (name, email, password_hash) VALUES ($1, $2, $3)',
      ['Admin User', 'admin@apsnashik.com', hashedPassword]
    )
    
    console.log('✅ Admin user created successfully!')
    console.log('📧 Email: admin@apsnashik.com')
    console.log('🔑 Password: admin123456')
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

createAdmin()
