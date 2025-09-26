const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.APP_PORT || 3000;

// PostgreSQL connection using environment variables from Secrets
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 20,
});

// Test database connection
async function testConnection() {
    try {
        const client = await pool.connect();
        console.log('✅ Database connection established successfully');
        console.log(`📊 Database: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
        
        const userCount = await client.query('SELECT COUNT(*) as count FROM users');
        console.log(`👥 Users in database: ${userCount.rows[0].count}`);
        
        client.release();
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
    }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize database
async function initializeDatabase() {
    try {
        console.log('🔄 Initializing database...');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(100) NOT NULL,
                email VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            INSERT INTO users (username, password, email) 
            VALUES 
            ('sadiq', 'password123', 'sadiq@nimc.gov.ng'),
            ('precious', 'nimc2025', 'precious@nimc.gov.ng'),
            ('kenneth', 'nigeria123', 'kenneth@nimc.gov.ng'),
            ('muhammed', 'officer123', 'muhd@nimc.gov.ng')
            ON CONFLICT (username) DO UPDATE SET
                password = EXCLUDED.password,
                email = EXCLUDED.email
        `);
        
        console.log('✅ Database initialized successfully');
        
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    console.log(`🔐 Login attempt: ${username}`);
    
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 AND password = $2',
            [username, password]
        );
        
        if (result.rows.length > 0) {
            const user = result.rows[0];
            console.log(`🎉 Login successful for: ${username}`);
            
            res.json({ 
                success: true, 
                message: 'Welcome to NIMC Official Website! Login successful.',
                user: { username: user.username, email: user.email }
            });
        } else {
            res.status(401).json({ 
                success: false, 
                error: 'Invalid username or password' 
            });
        }
    } catch (error) {
        console.error('💥 Login error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Debug endpoint
app.get('/api/debug/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, password, email FROM users ORDER BY username');
        res.json({
            success: true,
            users: result.rows,
            environment: process.env.ENVIRONMENT || 'development'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
        
        res.json({ 
            status: 'OK', 
            database: 'Connected',
            userCount: parseInt(userCount.rows[0].count),
            environment: process.env.ENVIRONMENT || 'development',
            appName: process.env.APP_NAME || 'NIMC App'
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'Error', 
            database: 'Disconnected',
            error: error.message 
        });
    }
});

// Config endpoint to show environment variables (for debugging)
app.get('/api/config', (req, res) => {
    res.json({
        appPort: process.env.APP_PORT,
        dbHost: process.env.DB_HOST,
        dbName: process.env.DB_NAME,
        dbUser: process.env.DB_USER,
        environment: process.env.ENVIRONMENT,
        appName: process.env.APP_NAME
    });
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database and start server
initializeDatabase().then(() => {
    setTimeout(testConnection, 2000);
    
    app.listen(PORT, () => {
        console.log(`🚀 ${process.env.APP_NAME || 'NIMC App'} running on port ${PORT}`);
        console.log(`🌍 Environment: ${process.env.ENVIRONMENT || 'development'}`);
    });
});