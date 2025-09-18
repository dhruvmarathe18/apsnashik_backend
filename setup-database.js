const { Pool } = require('pg')
const bcrypt = require('bcryptjs')
require('dotenv').config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

async function setupDatabase() {
  const client = await pool.connect()
  
  try {
    console.log('🚀 Setting up database...')
    
    // Create admin user
    console.log('🔐 Creating admin user...')
    const existingAdmin = await client.query('SELECT * FROM admin_users WHERE email = $1', ['admin@apsnashik.com'])
    
    if (existingAdmin.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123456', 10)
      await client.query(
        'INSERT INTO admin_users (name, email, password_hash) VALUES ($1, $2, $3)',
        ['Admin User', 'admin@apsnashik.com', hashedPassword]
      )
      console.log('✅ Admin user created')
    } else {
      console.log('✅ Admin user already exists')
    }
    
    // Add sample gallery images
    console.log('🖼️ Adding sample gallery images...')
    const existingImages = await client.query('SELECT COUNT(*) FROM gallery_images')
    
    if (existingImages.rows[0].count === '0') {
      const sampleImages = [
        {
          title: 'School Building',
          category: 'Infrastructure',
          src: '/images/infra.jpg',
          alt: 'Beautiful school building with modern architecture'
        },
        {
          title: 'Students in Classroom',
          category: 'Classroom Activities',
          src: '/images/teacher-1.jpg',
          alt: 'Students engaged in classroom activities'
        },
        {
          title: 'Sports Day',
          category: 'School Events',
          src: '/images/kids.jpg',
          alt: 'Students participating in sports day activities'
        },
        {
          title: 'School Principal',
          category: 'Teachers',
          src: '/images/principal.jpeg',
          alt: 'School principal in office'
        }
      ]
      
      for (const image of sampleImages) {
        await client.query(
          'INSERT INTO gallery_images (title, category, src, alt) VALUES ($1, $2, $3, $4)',
          [image.title, image.category, image.src, image.alt]
        )
      }
      console.log('✅ Sample gallery images added')
    } else {
      console.log('✅ Gallery images already exist')
    }
    
    // Add sample events
    console.log('📅 Adding sample events...')
    const existingEvents = await client.query('SELECT COUNT(*) FROM events')
    
    if (existingEvents.rows[0].count === '0') {
      const sampleEvents = [
        {
          title: 'Annual Sports Day',
          date: '2024-03-15',
          description: 'Annual sports day with various competitions and activities',
          category: 'Sports',
          status: 'upcoming'
        },
        {
          title: 'Science Exhibition',
          date: '2024-02-20',
          description: 'Students showcase their science projects and experiments',
          category: 'Academic',
          status: 'upcoming'
        },
        {
          title: 'Parent-Teacher Meeting',
          date: '2024-01-25',
          description: 'Regular parent-teacher meeting to discuss student progress',
          category: 'Academic',
          status: 'completed'
        }
      ]
      
      for (const event of sampleEvents) {
        await client.query(
          'INSERT INTO events (title, date, description, category, status) VALUES ($1, $2, $3, $4, $5)',
          [event.title, event.date, event.description, event.category, event.status]
        )
      }
      console.log('✅ Sample events added')
    } else {
      console.log('✅ Events already exist')
    }
    
    // Add sample news
    console.log('📰 Adding sample news articles...')
    const existingNews = await client.query('SELECT COUNT(*) FROM news_articles')
    
    if (existingNews.rows[0].count === '0') {
      const sampleNews = [
        {
          title: 'School Achieves 100% Pass Rate',
          content: 'We are proud to announce that our school has achieved a 100% pass rate in the recent board examinations. This is a testament to the hard work of our students and teachers.',
          status: 'published'
        },
        {
          title: 'New Computer Lab Inaugurated',
          content: 'The new state-of-the-art computer lab has been inaugurated with 50 new computers and modern facilities for students.',
          status: 'published'
        }
      ]
      
      for (const news of sampleNews) {
        await client.query(
          'INSERT INTO news_articles (title, content, status) VALUES ($1, $2, $3)',
          [news.title, news.content, news.status]
        )
      }
      console.log('✅ Sample news articles added')
    } else {
      console.log('✅ News articles already exist')
    }
    
    console.log('🎉 Database setup completed successfully!')
    console.log('📧 Admin Email: admin@apsnashik.com')
    console.log('🔑 Admin Password: admin123456')
    
  } catch (error) {
    console.error('❌ Error setting up database:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

setupDatabase()
