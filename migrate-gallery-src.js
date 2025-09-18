const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrateGallerySrcColumn() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting migration of gallery_images.src column...');
    
    // Check current column type
    const columnInfo = await client.query(`
      SELECT data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'gallery_images' AND column_name = 'src'
    `);
    
    if (columnInfo.rows.length === 0) {
      console.log('❌ gallery_images table or src column not found');
      return;
    }
    
    const currentType = columnInfo.rows[0].data_type;
    const maxLength = columnInfo.rows[0].character_maximum_length;
    
    console.log(`📊 Current column type: ${currentType}${maxLength ? `(${maxLength})` : ''}`);
    
    if (currentType === 'character varying' && maxLength === 500) {
      console.log('🔄 Migrating VARCHAR(500) to TEXT...');
      await client.query('ALTER TABLE gallery_images ALTER COLUMN src TYPE TEXT');
      console.log('✅ Migration completed successfully!');
    } else if (currentType === 'text') {
      console.log('✅ Column is already TEXT type - no migration needed');
    } else {
      console.log(`ℹ️ Column type is ${currentType} - migration may not be needed`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateGallerySrcColumn();
