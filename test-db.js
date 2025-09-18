const { Pool } = require('pg')

const connectionString = 'postgresql://dhruvmarathe:jlQCZ56SYA9zZYCO461UYSh6LP8RYn4p@dpg-d360iu7fte5s739b7abg-a.oregon-postgres.render.com/apsnashik_db'

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
})

async function testConnection() {
  const client = await pool.connect()
  
  try {
    console.log('🔌 Testing database connection...')
    
    // Test basic connection
    const result = await client.query('SELECT NOW() as current_time')
    console.log('✅ Database connection successful!')
    console.log('⏰ Current time:', result.rows[0].current_time)
    
    // Check if tables exist
    console.log('\n📊 Checking database tables...')
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)
    
    console.log('📋 Available tables:')
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`)
    })
    
    // Check admin users
    console.log('\n👤 Checking admin users...')
    const adminResult = await client.query('SELECT id, name, email FROM admin_users')
    if (adminResult.rows.length > 0) {
      console.log('✅ Admin users found:')
      adminResult.rows.forEach(user => {
        console.log(`  - ${user.name} (${user.email})`)
      })
    } else {
      console.log('❌ No admin users found')
    }
    
    // Check gallery images
    console.log('\n🖼️ Checking gallery images...')
    const galleryResult = await client.query('SELECT COUNT(*) as count FROM gallery_images')
    console.log(`📸 Gallery images: ${galleryResult.rows[0].count}`)
    
    // Check events
    console.log('\n📅 Checking events...')
    const eventsResult = await client.query('SELECT COUNT(*) as count FROM events')
    console.log(`🎉 Events: ${eventsResult.rows[0].count}`)
    
    // Check news
    console.log('\n📰 Checking news articles...')
    const newsResult = await client.query('SELECT COUNT(*) as count FROM news_articles')
    console.log(`📄 News articles: ${newsResult.rows[0].count}`)
    
    console.log('\n🎉 Database check completed successfully!')
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message)
    console.error('Full error:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

testConnection()
