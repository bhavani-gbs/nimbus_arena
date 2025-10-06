 import pg from 'pg';
 import bcrypt from 'bcrypt';
const pool = new pg.Pool({
 host: process.env.DB_HOST || 'localhost',
 port: process.env.DB_PORT || 5432,
 database: process.env.DB_NAME || 'nimbus_arena',
 user: process.env.DB_USER || 'postgres',
 password: process.env.DB_PASSWORD || 'postgres'
 });
 export async function initDB() {
 try {
 // Create tables if they don't exist
 await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
 `);
 await pool.query(`
            CREATE TABLE IF NOT EXISTS scores (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                score INTEGER NOT NULL,
                match_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
 `);
 console.log('Database initialized');
 } catch (error) {
 console.error('Database initialization error:', error);
 }
 }
 export async function createUser(username, password) {
 const hashedPassword = await bcrypt.hash(password, 10);
 const result = await pool.query(
 'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
 [username, hashedPassword]
 );
 return result.rows[0].id;
 }
 export async function verifyUser(username, password) {
 const result = await pool.query(
 'SELECT id, password_hash FROM users WHERE username = $1',
'SELECT id, password_hash FROM users WHERE username = $1',
 [username]
 );
 if (result.rows.length === 0) {
 throw new Error('User not found');
 }
 const user = result.rows[0];
 const valid = await bcrypt.compare(password, user.password_hash);
 if (!valid) {
 throw new Error('Invalid password');
 }
 return { id: user.id };
 }
 export async function saveScore(userId, score) {
 await pool.query(
 'INSERT INTO scores (user_id, score) VALUES ($1, $2)',
 [userId, score]
 );
 }