const pool = require("./config/database");

async function createTables() {
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

          username VARCHAR(255),
          email VARCHAR(255) NOT NULL UNIQUE,

          email_verified BOOLEAN DEFAULT FALSE,

          password TEXT,

          google_id VARCHAR(255),

          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS codes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

          code VARCHAR(255) NOT NULL,

          email VARCHAR(255) NOT NULL,

          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

          expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes')
      );

      CREATE TABLE IF NOT EXISTS plans (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

          plan_type VARCHAR(20) NOT NULL DEFAULT 'free'
              CHECK (plan_type IN ('free', 'pro', 'premium')),

          urls INTEGER NOT NULL DEFAULT 10,

          qr_codes INTEGER NOT NULL DEFAULT 5,

          expires_at TIMESTAMP NOT NULL
              DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),

          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS qr_codes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

          title VARCHAR(255) NOT NULL,

          original_url TEXT NOT NULL,

          qr_code_link TEXT,

          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS short_urls (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

          index_number BIGINT NOT NULL UNIQUE,

          title VARCHAR(255) NOT NULL,

          original_url TEXT NOT NULL,

          short_url TEXT NOT NULL,

          clicks INTEGER NOT NULL DEFAULT 0,

          is_password_protected BOOLEAN NOT NULL DEFAULT FALSE,

          password TEXT,

          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ All tables created successfully");
    process.exit(0);
}

async function checkConnection() {
    const result = await pool.query("SELECT current_database()");
    console.log(result.rows);
    const result2 = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        `);

    console.log(result2.rows);
}

checkConnection();