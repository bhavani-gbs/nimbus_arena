 CREATE DATABASE IF NOT EXISTS nimbus_arena;
 USE nimbus_arena;
 CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 );
 CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    score INTEGER NOT NULL,
    match_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 );
 CREATE INDEX idx_scores_user ON scores(user_id);
 CREATE INDEX idx_scores_date ON scores(match_date);