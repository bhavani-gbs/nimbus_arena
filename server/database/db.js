import pg from 'pg';

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'nimbus_arena',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

export async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,  -- Changed from password to password_hash
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS scores (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        score INTEGER NOT NULL,
        match_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database tables created/verified');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

export async function createUser(username, password) {
  try {
    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',  
      [username, password]  // Store plain text password
    );
    return result.rows[0].id;
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      throw new Error('Username already exists');
    }
    console.error('Create user error:', error);
    throw error;
  }
}

export async function verifyUser(username, password) {
  try {
    const result = await pool.query(
      'SELECT id, password_hash FROM users WHERE username = $1', 
      [username]
    );
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const user = result.rows[0];
    const valid = user.password_hash === password;  // Compare with password_hash
    if (!valid) {
      throw new Error('Invalid password');
    }
    return { id: user.id };
  } catch (error) {
    console.error('Verify user error:', error);
    throw error;
  }
}