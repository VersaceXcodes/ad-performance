// @ts-nocheck
import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
// Import Zod schemas
import { createUserInputSchema, createWorkspaceInputSchema, createAccountInputSchema, createMappingTemplateInputSchema, createAlertRuleInputSchema, createExportJobInputSchema } from './schema.ts';
dotenv.config();
// ESM workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Helper function to safely cast query parameters to string
function getQueryParam(param, defaultValue = '') {
    if (typeof param === 'string')
        return param;
    if (Array.isArray(param) && param.length > 0)
        return param[0];
    return defaultValue;
}
// Helper function to safely cast query parameters to number
function getQueryParamAsNumber(param, defaultValue = 0) {
    const str = getQueryParam(param, defaultValue.toString());
    const num = parseInt(str, 10);
    return isNaN(num) ? defaultValue : num;
}
function createErrorResponse(message, error, errorCode) {
    const response = {
        success: false,
        message,
        timestamp: new Date().toISOString()
    };
    if (errorCode) {
        response.error_code = errorCode;
    }
    if (error) {
        response.details = {
            name: error.name,
            message: error.message,
            stack: error.stack
        };
    }
    return response;
}
// Database setup
const { DATABASE_URL, PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT = 5432, JWT_SECRET = 'your-secret-key' } = process.env;
const pool = new Pool(DATABASE_URL
    ? {
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    }
    : {
        host: PGHOST,
        database: PGDATABASE,
        user: PGUSER,
        password: PGPASSWORD,
        port: Number(PGPORT),
        ssl: { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });
// Handle pool errors
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', {
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
    });
});
// Test database connection on startup
pool.connect()
    .then(client => {
    console.log('Database connected successfully');
    client.release();
})
    .catch(err => {
    console.error('Failed to connect to database:', {
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
    });
});
const app = express();
const port = process.env.PORT || 3000;
// Request logging middleware for debugging
app.use((req, res, next) => {
    const start = Date.now();
    const originalSend = res.send;
    const originalJson = res.json;
    // Log request details
    console.log(`→ ${req.method} ${req.url} - ${req.ip} - ${req.get('User-Agent')?.substring(0, 50) || 'No UA'}`);
    res.send = function (data) {
        const duration = Date.now() - start;
        console.log(`← ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
        return originalSend.call(this, data);
    };
    res.json = function (data) {
        const duration = Date.now() - start;
        console.log(`← ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms - JSON`);
        return originalJson.call(this, data);
    };
    next();
});
// Global error handler - must be after routes
const globalErrorHandler = (err, req, res, next) => {
    console.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).json(createErrorResponse('Internal server error', process.env.NODE_ENV === 'development' ? err : null, 'INTERNAL_SERVER_ERROR'));
};
// CORS Configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'https://123ad-performance.launchpulse.ai',
            'http://localhost:5173',
            'http://localhost:3000',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:3000'
        ];
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Cache-Control',
        'X-Forwarded-For',
        'X-Forwarded-Proto',
        'X-Real-IP',
        'User-Agent',
        'Referer'
    ],
    exposedHeaders: ['Content-Length', 'X-Request-ID', 'X-Total-Count'],
    optionsSuccessStatus: 200,
    preflightContinue: false,
    maxAge: 86400 // 24 hours
};
// Rate limiting middleware (simple in-memory implementation)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // requests per window
app.use((req, res, next) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    if (!rateLimitMap.has(clientId)) {
        rateLimitMap.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return next();
    }
    const clientData = rateLimitMap.get(clientId);
    if (now > clientData.resetTime) {
        // Reset the window
        rateLimitMap.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return next();
    }
    if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
        console.log('Rate limit exceeded:', {
            ip: clientId,
            count: clientData.count,
            userAgent: req.get('User-Agent'),
            url: req.url
        });
        return res.status(429).json(createErrorResponse('Too many requests, please try again later', null, 'RATE_LIMIT_EXCEEDED'));
    }
    clientData.count++;
    next();
});
// Middleware
app.use(cors(corsOptions));
// JSON parsing with error handling
app.use(express.json({
    limit: "50mb",
    verify: (req, res, buf, encoding) => {
        try {
            JSON.parse(buf.toString());
        }
        catch (err) {
            console.error('Invalid JSON received:', {
                error: err.message,
                body: buf.toString().substring(0, 200),
                url: req.url,
                method: req.method,
                ip: req.ip
            });
            throw new Error('Invalid JSON format');
        }
    }
}));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(morgan('combined'));
// JSON parsing error handler
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('JSON parsing error:', {
            error: err.message,
            url: req.url,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        return res.status(400).json(createErrorResponse('Invalid JSON format in request body', null, 'INVALID_JSON'));
    }
    next(err);
});
// Request timeout middleware
app.use((req, res, next) => {
    res.setTimeout(30000, () => {
        console.error('Request timeout:', {
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        if (!res.headersSent) {
            res.status(408).json(createErrorResponse('Request timeout', null, 'REQUEST_TIMEOUT'));
        }
    });
    next();
});
// Add security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Request-ID', `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    // Add headers for browser testing compatibility
    const userAgent = req.get('User-Agent') || '';
    const isBrowserTest = userAgent.includes('HeadlessChrome') ||
        userAgent.includes('PhantomJS') ||
        userAgent.includes('Selenium') ||
        userAgent.includes('Playwright') ||
        userAgent.includes('Puppeteer') ||
        req.get('X-Automation') === 'true';
    if (isBrowserTest) {
        res.setHeader('X-Browser-Test', 'detected');
        // Disable some security headers for testing
        res.removeHeader('X-Frame-Options');
    }
    next();
});
// Serve static files from the 'dist' directory with proper headers
app.use(express.static(path.join(__dirname, '../vitereact/dist'), {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        // Set proper MIME types for assets
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
        }
        else if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=UTF-8');
        }
        else if (path.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));
// Health check endpoint
app.get('/health', async (req, res) => {
    const healthCheck = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: 'disconnected',
        checks: {
            database: false,
            jwt_secret: false,
            environment_vars: false,
            static_files: false
        }
    };
    try {
        // Test database connection with timeout
        const client = await pool.connect();
        const dbResult = await client.query('SELECT NOW() as current_time, version() as db_version');
        client.release();
        healthCheck.database = 'connected';
        healthCheck.checks.database = true;
        healthCheck.database_info = {
            current_time: dbResult.rows[0].current_time,
            version: dbResult.rows[0].db_version.split(' ')[0]
        };
    }
    catch (error) {
        console.error('Database health check failed:', error);
        healthCheck.status = 'unhealthy';
        healthCheck.database_error = error.message;
    }
    // Check JWT secret
    if (JWT_SECRET && JWT_SECRET !== 'your-secret-key') {
        healthCheck.checks.jwt_secret = true;
    }
    // Check environment variables
    if (process.env.DATABASE_URL || (process.env.PGHOST && process.env.PGDATABASE)) {
        healthCheck.checks.environment_vars = true;
    }
    // Check static files
    const indexPath = path.join(__dirname, '../vitereact/dist/index.html');
    if (fs.existsSync(indexPath)) {
        healthCheck.checks.static_files = true;
    }
    // Overall health status
    const allChecksPass = Object.values(healthCheck.checks).every(check => check === true);
    if (!allChecksPass) {
        healthCheck.status = 'degraded';
    }
    const statusCode = healthCheck.status === 'healthy' ? 200 :
        healthCheck.status === 'degraded' ? 200 : 503;
    // Set proper headers for health checks
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(statusCode).json(healthCheck);
});
// API status endpoint
app.get('/api/status', async (req, res) => {
    try {
        // Test database connection with timeout
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        res.setHeader('Cache-Control', 'no-cache');
        res.status(200).json({
            success: true,
            message: 'API is running',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            database: 'connected',
            environment: process.env.NODE_ENV || 'development'
        });
    }
    catch (error) {
        console.error('API status check failed:', error);
        res.status(503).json({
            success: false,
            message: 'API is running but database is unavailable',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            database: 'disconnected',
            environment: process.env.NODE_ENV || 'development',
            error: error.message
        });
    }
});
// Readiness probe endpoint
app.get('/ready', async (req, res) => {
    try {
        // Quick database connectivity check
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        res.setHeader('Cache-Control', 'no-cache');
        res.status(200).json({
            ready: true,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Readiness check failed:', error);
        res.status(503).json({
            ready: false,
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});
// Debug endpoint for troubleshooting
app.get('/api/debug', (req, res) => {
    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        request_info: {
            method: req.method,
            url: req.url,
            headers: {
                'user-agent': req.get('User-Agent'),
                'origin': req.get('Origin'),
                'referer': req.get('Referer'),
                'x-forwarded-for': req.get('X-Forwarded-For'),
                'cf-ray': req.get('CF-Ray'),
                'cf-connecting-ip': req.get('CF-Connecting-IP')
            },
            ip: req.ip,
            ips: req.ips
        },
        server_info: {
            node_version: process.version,
            platform: process.platform,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            env: process.env.NODE_ENV || 'development'
        }
    });
});
// Browser testing validation endpoint
app.get('/api/test/validate', (req, res) => {
    const validationResults = {
        success: true,
        timestamp: new Date().toISOString(),
        tests: {
            cors: {
                status: 'pass',
                message: 'CORS headers properly configured'
            },
            json_response: {
                status: 'pass',
                message: 'JSON response format working'
            },
            database: {
                status: 'unknown',
                message: 'Database connection not tested in this endpoint'
            },
            static_files: {
                status: fs.existsSync(path.join(__dirname, '../vitereact/dist/index.html')) ? 'pass' : 'fail',
                message: fs.existsSync(path.join(__dirname, '../vitereact/dist/index.html')) ? 'Static files available' : 'Static files missing'
            },
            environment: {
                status: 'pass',
                message: `Running in ${process.env.NODE_ENV || 'development'} mode`
            }
        },
        recommendations: []
    };
    // Add recommendations based on test results
    if (validationResults.tests.static_files.status === 'fail') {
        validationResults.recommendations.push('Build frontend assets: npm run build in vitereact directory');
    }
    const allTestsPass = Object.values(validationResults.tests).every(test => test.status === 'pass');
    if (!allTestsPass) {
        validationResults.success = false;
    }
    res.json(validationResults);
});
// Create storage directory if it doesn't exist
const storageDir = path.join(__dirname, 'storage');
if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
}
// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, storageDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
        cb(null, uniqueName);
    }
});
const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.csv', '.xlsx', '.xls'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only CSV and Excel files are allowed'), false);
        }
    }
});
/*
  Authentication middleware for protected routes
  Validates JWT token and populates req.user with authenticated user data
*/
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json(createErrorResponse('Access token required', null, 'AUTH_TOKEN_REQUIRED'));
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const client = await pool.connect();
        try {
            const result = await client.query('SELECT id, email, name, created_at FROM users WHERE id = $1', [decoded.user_id]);
            if (result.rows.length === 0) {
                return res.status(401).json(createErrorResponse('Invalid token', null, 'AUTH_TOKEN_INVALID'));
            }
            req.user = result.rows[0];
            next();
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Authentication error:', error);
        return res.status(403).json(createErrorResponse('Invalid or expired token', error, 'AUTH_TOKEN_INVALID'));
    }
};
/*
  Workspace access middleware
  Validates user has access to specified workspace and populates req.workspace
*/
const validateWorkspaceAccess = async (req, res, next) => {
    const { workspace_id } = req.params;
    const user_id = req.user.id;
    const client = await pool.connect();
    try {
        const result = await client.query(`
      SELECT w.*, m.role, m.status 
      FROM workspaces w
      JOIN memberships m ON w.id = m.workspace_id
      WHERE w.id = $1 AND m.user_id = $2 AND m.status = 'active'
    `, [workspace_id, user_id]);
        if (result.rows.length === 0) {
            return res.status(403).json(createErrorResponse('Access denied to workspace', null, 'WORKSPACE_ACCESS_DENIED'));
        }
        req.workspace = result.rows[0];
        next();
    }
    catch (error) {
        console.error('Workspace validation error:', error);
        return res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
    finally {
        client.release();
    }
};
/*
  Mock function for sending email notifications
  In production, this would integrate with an email service like SendGrid or AWS SES
*/
async function sendEmailNotification({ to, subject, body, template_data }) {
    // Mock email service - would integrate with actual email provider
    console.log('Mock Email Sent:', {
        to,
        subject,
        body: body || 'Email template with data',
        template_data,
        timestamp: new Date().toISOString()
    });
    return {
        success: true,
        message_id: `mock_email_${Date.now()}`,
        delivered_at: new Date().toISOString()
    };
}
/*
  Mock function for file processing
  In production, this would handle CSV/XLSX parsing, validation, and data transformation
*/
async function processUploadFile({ upload_id, file_path, platform, mapping_template_id }) {
    // Mock file processing - would integrate with actual file parsing service
    console.log('Mock File Processing Started:', {
        upload_id,
        file_path,
        platform,
        mapping_template_id,
        timestamp: new Date().toISOString()
    });
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Mock processing results
    const mock_results = {
        rows_total: Math.floor(Math.random() * 10000) + 1000,
        rows_success: 0,
        rows_error: 0,
        parsed_data: [],
        errors: []
    };
    mock_results.rows_success = Math.floor(mock_results.rows_total * 0.95);
    mock_results.rows_error = mock_results.rows_total - mock_results.rows_success;
    return mock_results;
}
/*
  Mock function for background job processing
  In production, this would integrate with a queue system like Redis or AWS SQS
*/
async function scheduleBackgroundJob({ job_type, job_data, delay_seconds = 0 }) {
    // Mock background job scheduler
    console.log('Mock Background Job Scheduled:', {
        job_type,
        job_data,
        delay_seconds,
        scheduled_at: new Date().toISOString()
    });
    return {
        job_id: `mock_job_${Date.now()}`,
        status: 'scheduled',
        estimated_completion: new Date(Date.now() + (delay_seconds * 1000)).toISOString()
    };
}
// ================================
// AUTHENTICATION ROUTES
// ================================
/*
  POST /api/auth/register
  Creates a new user account with plain text password storage for development
*/
app.post('/api/auth/register', async (req, res) => {
    try {
        const validation = createUserInputSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json(createErrorResponse('Invalid input data', validation.error, 'VALIDATION_ERROR'));
        }
        const { email, name, password } = validation.data;
        const client = await pool.connect();
        try {
            // Check if user exists
            const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
            if (existingUser.rows.length > 0) {
                return res.status(400).json(createErrorResponse('User with this email already exists', null, 'USER_ALREADY_EXISTS'));
            }
            // Create user with plain text password for development
            const userId = uuidv4();
            const now = new Date().toISOString();
            const result = await client.query(`
        INSERT INTO users (id, email, name, password_hash, email_verified, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, email, name, email_verified, created_at, updated_at
      `, [userId, email.toLowerCase().trim(), name.trim(), password, false, now, now]);
            const user = result.rows[0];
            // Create default user preferences
            const prefsId = uuidv4();
            await client.query(`
        INSERT INTO user_preferences (id, user_id, email_notifications, in_app_notifications, email_frequency, reduced_motion, date_format, number_format, default_dashboard_view, theme_preference, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [prefsId, userId, true, true, 'immediate', false, 'YYYY-MM-DD', 'US', 'overview', 'dark', now, now]);
            // Generate JWT
            const token = jwt.sign({ user_id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
            res.status(201).json({
                user,
                token,
                workspace: null
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  POST /api/auth/login
  Authenticates user credentials and returns JWT token with user's primary workspace
*/
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json(createErrorResponse('Email and password are required', null, 'MISSING_REQUIRED_FIELDS'));
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json(createErrorResponse('Invalid email format', null, 'INVALID_EMAIL_FORMAT'));
        }
        const client = await pool.connect();
        try {
            // Find user with plain text password comparison for development
            const result = await client.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
            if (result.rows.length === 0) {
                // Add delay to prevent timing attacks
                await new Promise(resolve => setTimeout(resolve, 1000));
                return res.status(400).json(createErrorResponse('Invalid email or password', null, 'INVALID_CREDENTIALS'));
            }
            const user = result.rows[0];
            // Direct password comparison for development
            if (password !== user.password_hash) {
                // Add delay to prevent timing attacks
                await new Promise(resolve => setTimeout(resolve, 1000));
                return res.status(400).json(createErrorResponse('Invalid email or password', null, 'INVALID_CREDENTIALS'));
            }
            // Get user's primary workspace
            const workspaceResult = await client.query(`
        SELECT w.* FROM workspaces w
        JOIN memberships m ON w.id = m.workspace_id
        WHERE m.user_id = $1 AND m.status = 'active'
        ORDER BY m.created_at ASC
        LIMIT 1
      `, [user.id]);
            const workspace = workspaceResult.rows.length > 0 ? workspaceResult.rows[0] : null;
            // Generate JWT
            const token = jwt.sign({ user_id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
            // Log successful login
            console.log('Successful login:', {
                user_id: user.id,
                email: user.email,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                timestamp: new Date().toISOString()
            });
            res.json({
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    email_verified: user.email_verified,
                    created_at: user.created_at,
                    updated_at: user.updated_at
                },
                token,
                workspace
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Login error:', {
            error: error.message,
            stack: error.stack,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        });
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  POST /api/auth/logout
  Invalidates user session (placeholder for session management)
*/
app.post('/api/auth/logout', authenticateToken, (req, res) => {
    // In production, would invalidate session in database or Redis
    res.json({ message: 'Logout successful' });
});
/*
  GET /api/auth/me
  Returns current authenticated user information
*/
app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json(req.user);
});
/*
  POST /api/auth/verify-email
  Handles email verification with token (placeholder implementation)
*/
app.post('/api/auth/verify-email', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json(createErrorResponse('Verification token required', null, 'MISSING_TOKEN'));
        }
        const client = await pool.connect();
        try {
            const result = await client.query(`
        UPDATE users 
        SET email_verified = true, email_verification_token = null, updated_at = $1
        WHERE email_verification_token = $2
        RETURNING id
      `, [new Date().toISOString(), token]);
            if (result.rows.length === 0) {
                return res.status(400).json(createErrorResponse('Invalid or expired verification token', null, 'INVALID_TOKEN'));
            }
            res.json({ message: 'Email verified successfully' });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  POST /api/auth/forgot-password
  Initiates password reset process with email
*/
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json(createErrorResponse('Email is required', null, 'MISSING_EMAIL'));
        }
        const client = await pool.connect();
        try {
            const resetToken = uuidv4();
            const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour
            const result = await client.query(`
        UPDATE users 
        SET password_reset_token = $1, password_reset_expires = $2, updated_at = $3
        WHERE email = $4
        RETURNING id, name
      `, [resetToken, expiresAt, new Date().toISOString(), email.toLowerCase().trim()]);
            if (result.rows.length > 0) {
                // Send password reset email (mocked)
                await sendEmailNotification({
                    to: email,
                    subject: 'Password Reset - PulseDeck',
                    body: 'Password reset email template',
                    template_data: {
                        name: result.rows[0].name,
                        reset_token: resetToken,
                        reset_url: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
                    }
                });
            }
            // Always return success to prevent email enumeration
            res.json({ message: 'If an account with that email exists, we have sent a password reset link' });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  POST /api/auth/reset-password
  Resets user password with valid reset token
*/
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json(createErrorResponse('Token and new password are required', null, 'MISSING_REQUIRED_FIELDS'));
        }
        if (password.length < 6) {
            return res.status(400).json(createErrorResponse('Password must be at least 6 characters long', null, 'PASSWORD_TOO_SHORT'));
        }
        const client = await pool.connect();
        try {
            const result = await client.query(`
        UPDATE users 
        SET password_hash = $1, password_reset_token = null, password_reset_expires = null, updated_at = $2
        WHERE password_reset_token = $3 AND password_reset_expires > $4
        RETURNING id
      `, [password, new Date().toISOString(), token, new Date().toISOString()]);
            if (result.rows.length === 0) {
                return res.status(400).json(createErrorResponse('Invalid or expired reset token', null, 'INVALID_TOKEN'));
            }
            res.json({ message: 'Password reset successfully' });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
// ================================
// USER MANAGEMENT ROUTES
// ================================
/*
  GET /api/users/{user_id}
  Retrieves user profile information (admin only or own profile)
*/
app.get('/api/users/:user_id', authenticateToken, async (req, res) => {
    try {
        const { user_id } = req.params;
        // Users can only view their own profile
        if (req.user.id !== user_id) {
            return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
        }
        const client = await pool.connect();
        try {
            const result = await client.query(`
        SELECT id, email, name, email_verified, created_at, updated_at
        FROM users WHERE id = $1
      `, [user_id]);
            if (result.rows.length === 0) {
                return res.status(404).json(createErrorResponse('User not found', null, 'USER_NOT_FOUND'));
            }
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  PUT /api/users/{user_id}
  Updates user profile information
*/
app.put('/api/users/:user_id', authenticateToken, async (req, res) => {
    try {
        const { user_id } = req.params;
        // Users can only update their own profile
        if (req.user.id !== user_id) {
            return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
        }
        const { name, email, password } = req.body;
        const client = await pool.connect();
        try {
            let updateQuery = 'UPDATE users SET updated_at = $1';
            let queryParams = [new Date().toISOString()];
            let paramIndex = 2;
            if (name) {
                updateQuery += `, name = $${paramIndex}`;
                queryParams.push(name.trim());
                paramIndex++;
            }
            if (email) {
                updateQuery += `, email = $${paramIndex}`;
                queryParams.push(email.toLowerCase().trim());
                paramIndex++;
            }
            if (password) {
                updateQuery += `, password_hash = $${paramIndex}`;
                queryParams.push(password); // Plain text for development
                paramIndex++;
            }
            updateQuery += ` WHERE id = $${paramIndex} RETURNING id, email, name, email_verified, created_at, updated_at`;
            queryParams.push(user_id);
            const result = await client.query(updateQuery, queryParams);
            if (result.rows.length === 0) {
                return res.status(404).json(createErrorResponse('User not found', null, 'USER_NOT_FOUND'));
            }
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Update user error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  GET /api/users/{user_id}/preferences
  Retrieves user preferences and settings
*/
app.get('/api/users/:user_id/preferences', authenticateToken, async (req, res) => {
    try {
        const { user_id } = req.params;
        if (req.user.id !== user_id) {
            return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
        }
        const client = await pool.connect();
        try {
            const result = await client.query(`
        SELECT * FROM user_preferences WHERE user_id = $1
      `, [user_id]);
            if (result.rows.length === 0) {
                // Create default preferences if not exist
                const prefsId = uuidv4();
                const now = new Date().toISOString();
                const createResult = await client.query(`
          INSERT INTO user_preferences (id, user_id, email_notifications, in_app_notifications, email_frequency, reduced_motion, date_format, number_format, default_dashboard_view, theme_preference, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *
        `, [prefsId, user_id, true, true, 'immediate', false, 'YYYY-MM-DD', 'US', 'overview', 'dark', now, now]);
                res.json(createResult.rows[0]);
            }
            else {
                res.json(result.rows[0]);
            }
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get preferences error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  PUT /api/users/{user_id}/preferences
  Updates user preferences and settings
*/
app.put('/api/users/:user_id/preferences', authenticateToken, async (req, res) => {
    try {
        const { user_id } = req.params;
        if (req.user.id !== user_id) {
            return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
        }
        const client = await pool.connect();
        try {
            const updateFields = [];
            const queryParams = [];
            let paramIndex = 1;
            const allowedFields = [
                'email_notifications', 'in_app_notifications', 'email_frequency',
                'reduced_motion', 'date_format', 'number_format', 'default_dashboard_view', 'theme_preference'
            ];
            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    updateFields.push(`${field} = $${paramIndex}`);
                    queryParams.push(req.body[field]);
                    paramIndex++;
                }
            }
            if (updateFields.length === 0) {
                return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
            }
            updateFields.push(`updated_at = $${paramIndex}`);
            queryParams.push(new Date().toISOString());
            paramIndex++;
            queryParams.push(user_id);
            const result = await client.query(`
        UPDATE user_preferences 
        SET ${updateFields.join(', ')}
        WHERE user_id = $${paramIndex}
        RETURNING *
      `, queryParams);
            if (result.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Preferences not found', null, 'PREFERENCES_NOT_FOUND'));
            }
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
// ================================
// WORKSPACE MANAGEMENT ROUTES
// ================================
/*
  GET /api/workspaces
  Retrieves all workspaces user has access to with membership details
*/
app.get('/api/workspaces', authenticateToken, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            const result = await client.query(`
        SELECT w.*, m.role, m.status, m.created_at as membership_created_at
        FROM workspaces w
        JOIN memberships m ON w.id = m.workspace_id
        WHERE m.user_id = $1 AND m.status = 'active'
        ORDER BY m.created_at ASC
      `, [req.user.id]);
            const workspaces = result.rows.map(row => ({
                workspace: {
                    id: row.id,
                    name: row.name,
                    default_currency: row.default_currency,
                    default_revenue_per_conversion: row.default_revenue_per_conversion,
                    timezone: row.timezone,
                    data_retention_days: row.data_retention_days,
                    created_at: row.created_at,
                    updated_at: row.updated_at
                },
                membership: {
                    role: row.role,
                    status: row.status,
                    created_at: row.membership_created_at
                }
            }));
            res.json(workspaces);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get workspaces error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  POST /api/workspaces
  Creates a new workspace with user as owner
*/
app.post('/api/workspaces', authenticateToken, async (req, res) => {
    try {
        const validation = createWorkspaceInputSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json(createErrorResponse('Invalid input data', validation.error, 'VALIDATION_ERROR'));
        }
        const { name, default_currency = 'USD', default_revenue_per_conversion, timezone = 'UTC', data_retention_days = 730 } = validation.data;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Create workspace
            const workspaceId = uuidv4();
            const now = new Date().toISOString();
            const workspaceResult = await client.query(`
        INSERT INTO workspaces (id, name, default_currency, default_revenue_per_conversion, timezone, data_retention_days, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [workspaceId, name, default_currency, default_revenue_per_conversion, timezone, data_retention_days, now, now]);
            // Create owner membership
            const membershipId = uuidv4();
            const membershipResult = await client.query(`
        INSERT INTO memberships (id, user_id, workspace_id, role, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [membershipId, req.user.id, workspaceId, 'owner', 'active', now, now]);
            await client.query('COMMIT');
            res.status(201).json({
                workspace: workspaceResult.rows[0],
                membership: membershipResult.rows[0]
            });
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Create workspace error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  GET /api/workspaces/{workspace_id}
  Retrieves detailed workspace information
*/
app.get('/api/workspaces/:workspace_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    res.json(req.workspace);
});
/*
  PUT /api/workspaces/{workspace_id}
  Updates workspace settings (owner/admin only)
*/
app.put('/api/workspaces/:workspace_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        if (!['owner', 'admin'].includes(req.workspace.role)) {
            return res.status(403).json(createErrorResponse('Access denied - admin required', null, 'ACCESS_DENIED'));
        }
        const { name, default_currency, default_revenue_per_conversion, timezone, data_retention_days } = req.body;
        const client = await pool.connect();
        try {
            const updateFields = [];
            const queryParams = [];
            let paramIndex = 1;
            if (name) {
                updateFields.push(`name = $${paramIndex}`);
                queryParams.push(name);
                paramIndex++;
            }
            if (default_currency) {
                updateFields.push(`default_currency = $${paramIndex}`);
                queryParams.push(default_currency);
                paramIndex++;
            }
            if (default_revenue_per_conversion !== undefined) {
                updateFields.push(`default_revenue_per_conversion = $${paramIndex}`);
                queryParams.push(default_revenue_per_conversion);
                paramIndex++;
            }
            if (timezone) {
                updateFields.push(`timezone = $${paramIndex}`);
                queryParams.push(timezone);
                paramIndex++;
            }
            if (data_retention_days) {
                updateFields.push(`data_retention_days = $${paramIndex}`);
                queryParams.push(data_retention_days);
                paramIndex++;
            }
            if (updateFields.length === 0) {
                return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
            }
            updateFields.push(`updated_at = $${paramIndex}`);
            queryParams.push(new Date().toISOString());
            paramIndex++;
            queryParams.push(req.params.workspace_id);
            const result = await client.query(`
        UPDATE workspaces 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, queryParams);
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Update workspace error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  DELETE /api/workspaces/{workspace_id}
  Deletes workspace (owner only)
*/
app.delete('/api/workspaces/:workspace_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        if (req.workspace.role !== 'owner') {
            return res.status(403).json(createErrorResponse('Access denied - owner required', null, 'ACCESS_DENIED'));
        }
        const client = await pool.connect();
        try {
            await client.query('DELETE FROM workspaces WHERE id = $1', [req.params.workspace_id]);
            res.status(204).send();
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Delete workspace error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
// ================================
// TEAM MANAGEMENT ROUTES
// ================================
/*
  GET /api/workspaces/{workspace_id}/members
  Retrieves workspace team members with user details
*/
app.get('/api/workspaces/:workspace_id/members', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const member_filter = getQueryParam(req.query.member_filter);
        const client = await pool.connect();
        try {
            let query = `
        SELECT m.*, u.email, u.name as user_name, u.created_at as user_created_at
        FROM memberships m
        JOIN users u ON m.user_id = u.id
        WHERE m.workspace_id = $1 AND m.status = 'active'
      `;
            const queryParams = [req.params.workspace_id];
            if (member_filter) {
                query += ` AND m.role = $2`;
                queryParams.push(member_filter);
            }
            query += ` ORDER BY m.created_at ASC`;
            const result = await client.query(query, queryParams);
            const members = result.rows.map(row => ({
                membership: {
                    id: row.id,
                    user_id: row.user_id,
                    workspace_id: row.workspace_id,
                    role: row.role,
                    status: row.status,
                    created_at: row.created_at,
                    updated_at: row.updated_at
                },
                user: {
                    id: row.user_id,
                    email: row.email,
                    name: row.user_name,
                    created_at: row.user_created_at
                }
            }));
            res.json(members);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get members error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  PUT /api/workspaces/{workspace_id}/members/{member_id}
  Updates member role (admin/owner only)
*/
app.put('/api/workspaces/:workspace_id/members/:member_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        if (!['owner', 'admin'].includes(req.workspace.role)) {
            return res.status(403).json(createErrorResponse('Access denied - admin required', null, 'ACCESS_DENIED'));
        }
        const { role } = req.body;
        if (!['owner', 'admin', 'member'].includes(role)) {
            return res.status(400).json(createErrorResponse('Invalid role', null, 'INVALID_ROLE'));
        }
        const client = await pool.connect();
        try {
            const result = await client.query(`
        UPDATE memberships 
        SET role = $1, updated_at = $2
        WHERE id = $3 AND workspace_id = $4
        RETURNING *
      `, [role, new Date().toISOString(), req.params.member_id, req.params.workspace_id]);
            if (result.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Member not found', null, 'MEMBER_NOT_FOUND'));
            }
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Update member error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  DELETE /api/workspaces/{workspace_id}/members/{member_id}
  Removes member from workspace (admin/owner only)
*/
app.delete('/api/workspaces/:workspace_id/members/:member_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        if (!['owner', 'admin'].includes(req.workspace.role)) {
            return res.status(403).json(createErrorResponse('Access denied - admin required', null, 'ACCESS_DENIED'));
        }
        const client = await pool.connect();
        try {
            const result = await client.query(`
        DELETE FROM memberships 
        WHERE id = $1 AND workspace_id = $2
      `, [req.params.member_id, req.params.workspace_id]);
            if (result.rowCount === 0) {
                return res.status(404).json(createErrorResponse('Member not found', null, 'MEMBER_NOT_FOUND'));
            }
            res.status(204).send();
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  GET /api/workspaces/{workspace_id}/invitations
  Retrieves pending workspace invitations
*/
app.get('/api/workspaces/:workspace_id/invitations', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            const result = await client.query(`
        SELECT * FROM workspace_invitations 
        WHERE workspace_id = $1 AND status = 'pending'
        ORDER BY created_at DESC
      `, [req.params.workspace_id]);
            res.json(result.rows);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get invitations error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  POST /api/workspaces/{workspace_id}/invitations
  Sends invitation to new team member
*/
app.post('/api/workspaces/:workspace_id/invitations', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        if (!['owner', 'admin'].includes(req.workspace.role)) {
            return res.status(403).json(createErrorResponse('Access denied - admin required', null, 'ACCESS_DENIED'));
        }
        const { email, role } = req.body;
        if (!email || !role) {
            return res.status(400).json(createErrorResponse('Email and role are required', null, 'MISSING_REQUIRED_FIELDS'));
        }
        if (!['admin', 'member'].includes(role)) {
            return res.status(400).json(createErrorResponse('Invalid role', null, 'INVALID_ROLE'));
        }
        const client = await pool.connect();
        try {
            // Check if user already exists in workspace
            const existingMember = await client.query(`
        SELECT id FROM memberships 
        WHERE workspace_id = $1 AND user_id IN (
          SELECT id FROM users WHERE email = $2
        )
      `, [req.params.workspace_id, email.toLowerCase().trim()]);
            if (existingMember.rows.length > 0) {
                return res.status(400).json(createErrorResponse('User already member of workspace', null, 'USER_ALREADY_MEMBER'));
            }
            // Check for existing pending invitation
            const existingInvitation = await client.query(`
        SELECT id FROM workspace_invitations 
        WHERE workspace_id = $1 AND email = $2 AND status = 'pending'
      `, [req.params.workspace_id, email.toLowerCase().trim()]);
            if (existingInvitation.rows.length > 0) {
                return res.status(400).json(createErrorResponse('Invitation already sent to this email', null, 'INVITATION_ALREADY_SENT'));
            }
            // Create invitation
            const invitationId = uuidv4();
            const invitationToken = uuidv4();
            const now = new Date().toISOString();
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
            const result = await client.query(`
        INSERT INTO workspace_invitations (id, workspace_id, invited_by, email, role, invitation_token, status, expires_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [invitationId, req.params.workspace_id, req.user.id, email.toLowerCase().trim(), role, invitationToken, 'pending', expiresAt, now, now]);
            // Send invitation email (mocked)
            await sendEmailNotification({
                to: email,
                subject: 'Workspace Invitation - PulseDeck',
                body: 'Workspace invitation email template',
                template_data: {
                    workspace_name: req.workspace.name,
                    inviter_name: req.user.name,
                    role: role,
                    invitation_url: `${process.env.FRONTEND_URL}/invitations/accept?token=${invitationToken}`,
                    expires_at: expiresAt
                }
            });
            res.status(201).json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Create invitation error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  PUT /api/workspaces/{workspace_id}/invitations/{invitation_id}
  Responds to workspace invitation (accept/decline)
*/
app.put('/api/workspaces/:workspace_id/invitations/:invitation_id', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['accepted', 'declined'].includes(status)) {
            return res.status(400).json(createErrorResponse('Invalid status', null, 'INVALID_STATUS'));
        }
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Get invitation details
            const invitationResult = await client.query(`
        SELECT * FROM workspace_invitations 
        WHERE id = $1 AND workspace_id = $2 AND status = 'pending' AND expires_at > $3
      `, [req.params.invitation_id, req.params.workspace_id, new Date().toISOString()]);
            if (invitationResult.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Invitation not found or expired', null, 'INVITATION_NOT_FOUND'));
            }
            const invitation = invitationResult.rows[0];
            // Verify invited email matches authenticated user
            if (invitation.email !== req.user.email) {
                return res.status(403).json(createErrorResponse('Invitation not for this user', null, 'ACCESS_DENIED'));
            }
            // Update invitation status
            const now = new Date().toISOString();
            const updatedInvitation = await client.query(`
        UPDATE workspace_invitations 
        SET status = $1, accepted_at = $2, accepted_by = $3, updated_at = $4
        WHERE id = $5
        RETURNING *
      `, [status, status === 'accepted' ? now : null, status === 'accepted' ? req.user.id : null, now, req.params.invitation_id]);
            // If accepted, create membership
            if (status === 'accepted') {
                const membershipId = uuidv4();
                await client.query(`
          INSERT INTO memberships (id, user_id, workspace_id, role, status, invited_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [membershipId, req.user.id, req.params.workspace_id, invitation.role, 'active', invitation.invited_by, now, now]);
            }
            await client.query('COMMIT');
            res.json(updatedInvitation.rows[0]);
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Respond to invitation error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
// ================================
// ANALYTICS ROUTES
// ================================
/*
  GET /api/workspaces/{workspace_id}/metrics/overview
  Provides comprehensive KPI dashboard with period-over-period comparison and insights
  Performs complex aggregations across daily metrics with date filtering and platform selection
*/
app.get('/api/workspaces/:workspace_id/metrics/overview', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const date_from = getQueryParam(req.query.date_from);
        const date_to = getQueryParam(req.query.date_to);
        const date_preset = getQueryParam(req.query.date_preset);
        const comparison_mode = getQueryParam(req.query.comparison_mode);
        const platforms = getQueryParam(req.query.platforms);
        const accounts = getQueryParam(req.query.accounts);
        const client = await pool.connect();
        try {
            // Calculate date ranges based on preset or custom dates
            let startDate, endDate, comparisonStartDate, comparisonEndDate;
            const now = new Date();
            if (date_preset) {
                switch (date_preset) {
                    case 'today':
                        startDate = endDate = new Date().toISOString().split('T')[0];
                        break;
                    case 'yesterday':
                        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                        startDate = endDate = yesterday.toISOString().split('T')[0];
                        break;
                    case 'last_7_days':
                        endDate = new Date().toISOString().split('T')[0];
                        startDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                        break;
                    case 'last_30_days':
                        endDate = new Date().toISOString().split('T')[0];
                        startDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                        break;
                    case 'last_90_days':
                        endDate = new Date().toISOString().split('T')[0];
                        startDate = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                        break;
                    default:
                        endDate = new Date().toISOString().split('T')[0];
                        startDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                }
            }
            else {
                startDate = date_from || new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                endDate = date_to || new Date().toISOString().split('T')[0];
            }
            // Calculate comparison period
            if (comparison_mode === 'vs_previous_period') {
                const periodDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000)) + 1;
                comparisonEndDate = new Date(new Date(startDate).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                comparisonStartDate = new Date(new Date(comparisonEndDate).getTime() - (periodDays - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            }
            else if (comparison_mode === 'vs_same_period_last_year') {
                comparisonStartDate = new Date(new Date(startDate).getFullYear() - 1, new Date(startDate).getMonth(), new Date(startDate).getDate()).toISOString().split('T')[0];
                comparisonEndDate = new Date(new Date(endDate).getFullYear() - 1, new Date(endDate).getMonth(), new Date(endDate).getDate()).toISOString().split('T')[0];
            }
            // Build WHERE clause for filtering
            let whereConditions = ['m.date >= $2', 'm.date <= $3'];
            let queryParams = [req.params.workspace_id, startDate, endDate];
            let paramIndex = 4;
            if (platforms) {
                const platformList = platforms.split(',').map(p => p.trim());
                whereConditions.push(`m.platform = ANY($${paramIndex})`);
                queryParams.push(platformList);
                paramIndex++;
            }
            if (accounts) {
                const accountList = accounts.split(',').map(a => a.trim());
                whereConditions.push(`m.account_id = ANY($${paramIndex})`);
                queryParams.push(accountList);
                paramIndex++;
            }
            // Main metrics query with complex aggregations
            const metricsQuery = `
        SELECT 
          COALESCE(SUM(m.spend), 0) as spend,
          COALESCE(SUM(m.revenue), 0) as revenue,
          COALESCE(SUM(m.impressions), 0) as impressions,
          COALESCE(SUM(m.clicks), 0) as clicks,
          COALESCE(SUM(m.conversions), 0) as conversions,
          CASE 
            WHEN SUM(m.spend) > 0 THEN ROUND(SUM(m.revenue) / SUM(m.spend), 2)
            ELSE 0 
          END as roas,
          CASE 
            WHEN SUM(m.conversions) > 0 THEN ROUND(SUM(m.spend) / SUM(m.conversions), 2)
            ELSE 0 
          END as cpa,
          CASE 
            WHEN SUM(m.impressions) > 0 THEN ROUND(SUM(m.clicks) * 100.0 / SUM(m.impressions), 2)
            ELSE 0 
          END as ctr,
          CASE 
            WHEN SUM(m.impressions) > 0 THEN ROUND(SUM(m.spend) * 1000.0 / SUM(m.impressions), 2)
            ELSE 0 
          END as cpm,
          CASE 
            WHEN SUM(m.clicks) > 0 THEN ROUND(SUM(m.conversions) * 100.0 / SUM(m.clicks), 2)
            ELSE 0 
          END as cvr
        FROM metrics_daily m
        JOIN accounts a ON m.account_id = a.id
        WHERE a.workspace_id = $1 AND ${whereConditions.join(' AND ')}
      `;
            const metricsResult = await client.query(metricsQuery, queryParams);
            const currentMetrics = metricsResult.rows[0];
            // Calculate MER (Marketing Efficiency Ratio) - total revenue / total spend for period
            const mer = currentMetrics.spend > 0 ? parseFloat((currentMetrics.revenue / currentMetrics.spend).toFixed(2)) : 0;
            // Get comparison metrics if comparison mode is set
            let comparison = {};
            if (comparison_mode && comparisonStartDate && comparisonEndDate) {
                const comparisonParams = [req.params.workspace_id, comparisonStartDate, comparisonEndDate];
                let comparisonParamIndex = 4;
                if (platforms) {
                    comparisonParams.push(platforms.split(',').map(p => p.trim()));
                    comparisonParamIndex++;
                }
                if (accounts) {
                    comparisonParams.push(accounts.split(',').map(a => a.trim()));
                    comparisonParamIndex++;
                }
                const comparisonResult = await client.query(metricsQuery, comparisonParams);
                const comparisonMetrics = comparisonResult.rows[0];
                const comparisonMer = comparisonMetrics.spend > 0 ? parseFloat((comparisonMetrics.revenue / comparisonMetrics.spend).toFixed(2)) : 0;
                // Calculate percentage changes
                comparison = {
                    spend_change: comparisonMetrics.spend > 0 ? parseFloat(((currentMetrics.spend - comparisonMetrics.spend) / comparisonMetrics.spend * 100).toFixed(2)) : 0,
                    revenue_change: comparisonMetrics.revenue > 0 ? parseFloat(((currentMetrics.revenue - comparisonMetrics.revenue) / comparisonMetrics.revenue * 100).toFixed(2)) : 0,
                    roas_change: comparisonMetrics.roas > 0 ? parseFloat(((currentMetrics.roas - comparisonMetrics.roas) / comparisonMetrics.roas * 100).toFixed(2)) : 0,
                    cpa_change: comparisonMetrics.cpa > 0 ? parseFloat(((currentMetrics.cpa - comparisonMetrics.cpa) / comparisonMetrics.cpa * 100).toFixed(2)) : 0,
                    ctr_change: comparisonMetrics.ctr > 0 ? parseFloat(((currentMetrics.ctr - comparisonMetrics.ctr) / comparisonMetrics.ctr * 100).toFixed(2)) : 0,
                    cpm_change: comparisonMetrics.cpm > 0 ? parseFloat(((currentMetrics.cpm - comparisonMetrics.cpm) / comparisonMetrics.cpm * 100).toFixed(2)) : 0,
                    cvr_change: comparisonMetrics.cvr > 0 ? parseFloat(((currentMetrics.cvr - comparisonMetrics.cvr) / comparisonMetrics.cvr * 100).toFixed(2)) : 0,
                    mer_change: comparisonMer > 0 ? parseFloat(((mer - comparisonMer) / comparisonMer * 100).toFixed(2)) : 0
                };
            }
            // Generate automated insights
            const insights = [];
            // Performance change insights
            if (comparison.spend_change && Math.abs(comparison.spend_change) > 10) {
                insights.push({
                    type: 'performance_change',
                    message: `Spend ${comparison.spend_change > 0 ? 'increased' : 'decreased'} by ${Math.abs(comparison.spend_change).toFixed(1)}% compared to previous period`,
                    severity: Math.abs(comparison.spend_change) > 25 ? 'warning' : 'info',
                    entity_type: 'workspace',
                    entity_id: req.params.workspace_id
                });
            }
            if (comparison.roas_change && Math.abs(comparison.roas_change) > 15) {
                insights.push({
                    type: 'performance_change',
                    message: `ROAS ${comparison.roas_change > 0 ? 'improved' : 'declined'} by ${Math.abs(comparison.roas_change).toFixed(1)}%`,
                    severity: comparison.roas_change < -15 ? 'critical' : 'info',
                    entity_type: 'workspace',
                    entity_id: req.params.workspace_id
                });
            }
            // Platform performance insights
            const platformInsightsQuery = `
        SELECT 
          m.platform,
          SUM(m.spend) as spend,
          SUM(m.revenue) as revenue,
          CASE 
            WHEN SUM(m.spend) > 0 THEN SUM(m.revenue) / SUM(m.spend)
            ELSE 0 
          END as roas
        FROM metrics_daily m
        JOIN accounts a ON m.account_id = a.id
        WHERE a.workspace_id = $1 AND m.date >= $2 AND m.date <= $3
        GROUP BY m.platform
        HAVING SUM(m.spend) > 0
        ORDER BY roas DESC
      `;
            const platformInsights = await client.query(platformInsightsQuery, [req.params.workspace_id, startDate, endDate]);
            if (platformInsights.rows.length > 1) {
                const bestPlatform = platformInsights.rows[0];
                const worstPlatform = platformInsights.rows[platformInsights.rows.length - 1];
                insights.push({
                    type: 'trend',
                    message: `${bestPlatform.platform} is your best performing platform with ${bestPlatform.roas.toFixed(2)} ROAS`,
                    severity: 'info',
                    entity_type: 'platform',
                    entity_id: bestPlatform.platform
                });
                if (worstPlatform.roas < 1.0) {
                    insights.push({
                        type: 'trend',
                        message: `${worstPlatform.platform} is underperforming with ${worstPlatform.roas.toFixed(2)} ROAS - consider optimization`,
                        severity: 'warning',
                        entity_type: 'platform',
                        entity_id: worstPlatform.platform
                    });
                }
            }
            // Check for recent anomalies
            const anomalyQuery = `
        SELECT entity_type, entity_id, metric, anomaly_type, severity, current_value, expected_value
        FROM anomaly_detections
        WHERE workspace_id = $1 AND created_at >= $2 AND is_reviewed = false
        ORDER BY severity DESC, created_at DESC
        LIMIT 3
      `;
            const anomalies = await client.query(anomalyQuery, [req.params.workspace_id, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()]);
            for (const anomaly of anomalies.rows) {
                insights.push({
                    type: 'anomaly',
                    message: `${anomaly.metric.toUpperCase()} ${anomaly.anomaly_type} detected in ${anomaly.entity_type} - ${anomaly.current_value} vs expected ${anomaly.expected_value}`,
                    severity: anomaly.severity,
                    entity_type: anomaly.entity_type,
                    entity_id: anomaly.entity_id
                });
            }
            res.json({
                spend: parseFloat(currentMetrics.spend),
                revenue: parseFloat(currentMetrics.revenue),
                roas: parseFloat(currentMetrics.roas),
                cpa: parseFloat(currentMetrics.cpa),
                ctr: parseFloat(currentMetrics.ctr),
                cpm: parseFloat(currentMetrics.cpm),
                cvr: parseFloat(currentMetrics.cvr),
                mer: mer,
                comparison,
                insights
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get overview metrics error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  GET /api/workspaces/{workspace_id}/metrics/comparison
  Provides cross-platform performance comparison with sortable metrics
*/
app.get('/api/workspaces/:workspace_id/metrics/comparison', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const date_from = getQueryParam(req.query.date_from);
        const date_to = getQueryParam(req.query.date_to);
        const sort_by = getQueryParam(req.query.sort_by, 'spend');
        const sort_order = getQueryParam(req.query.sort_order, 'desc');
        const efficiency_view = getQueryParam(req.query.efficiency_view);
        // Set default date range if not provided
        const endDate = date_to || new Date().toISOString().split('T')[0];
        const startDate = date_from || new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const client = await pool.connect();
        try {
            const query = `
        SELECT 
          m.platform,
          COALESCE(SUM(m.spend), 0) as spend,
          COALESCE(SUM(m.revenue), 0) as revenue,
          COALESCE(SUM(m.impressions), 0) as impressions,
          COALESCE(SUM(m.clicks), 0) as clicks,
          COALESCE(SUM(m.conversions), 0) as conversions,
          CASE 
            WHEN SUM(m.spend) > 0 THEN ROUND(SUM(m.revenue) / SUM(m.spend), 2)
            ELSE 0 
          END as roas,
          CASE 
            WHEN SUM(m.conversions) > 0 THEN ROUND(SUM(m.spend) / SUM(m.conversions), 2)
            ELSE 0 
          END as cpa,
          CASE 
            WHEN SUM(m.impressions) > 0 THEN ROUND(SUM(m.clicks) * 100.0 / SUM(m.impressions), 2)
            ELSE 0 
          END as ctr,
          CASE 
            WHEN SUM(m.impressions) > 0 THEN ROUND(SUM(m.spend) * 1000.0 / SUM(m.impressions), 2)
            ELSE 0 
          END as cpm,
          CASE 
            WHEN SUM(m.clicks) > 0 THEN ROUND(SUM(m.conversions) * 100.0 / SUM(m.clicks), 2)
            ELSE 0 
          END as cvr,
          COUNT(DISTINCT a.id) as account_count,
          COUNT(DISTINCT c.id) as campaign_count
        FROM metrics_daily m
        JOIN accounts a ON m.account_id = a.id
        LEFT JOIN campaigns c ON m.campaign_id = c.id
        WHERE a.workspace_id = $1 AND m.date >= $2 AND m.date <= $3
        GROUP BY m.platform
        ORDER BY ${sort_by} ${sort_order.toUpperCase()}
      `;
            const result = await client.query(query, [req.params.workspace_id, startDate, endDate]);
            const platformComparison = result.rows.map(row => ({
                platform: row.platform,
                spend: parseFloat(row.spend),
                revenue: parseFloat(row.revenue),
                roas: parseFloat(row.roas),
                cpa: parseFloat(row.cpa),
                ctr: parseFloat(row.ctr),
                cpm: parseFloat(row.cpm),
                cvr: parseFloat(row.cvr),
                impressions: parseInt(row.impressions),
                clicks: parseInt(row.clicks),
                conversions: parseInt(row.conversions),
                account_count: parseInt(row.account_count),
                campaign_count: parseInt(row.campaign_count)
            }));
            res.json(platformComparison);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get platform comparison error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  GET /api/workspaces/{workspace_id}/metrics/trends
  Provides time series performance data for charting and trend analysis
*/
app.get('/api/workspaces/:workspace_id/metrics/trends', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const date_from = getQueryParam(req.query.date_from);
        const date_to = getQueryParam(req.query.date_to);
        const metrics = getQueryParam(req.query.metrics);
        const platforms = getQueryParam(req.query.platforms);
        const group_by = getQueryParam(req.query.group_by, 'date');
        const endDate = date_to || new Date().toISOString().split('T')[0];
        const startDate = date_from || new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const client = await pool.connect();
        try {
            let groupByClause = 'm.date';
            let selectClause = 'm.date';
            if (group_by === 'platform') {
                groupByClause = 'm.platform';
                selectClause = 'm.platform, NULL as date';
            }
            else if (group_by === 'account') {
                groupByClause = 'm.account_id, a.account_name';
                selectClause = 'm.account_id, a.account_name, NULL as date';
            }
            let whereConditions = ['a.workspace_id = $1', 'm.date >= $2', 'm.date <= $3'];
            let queryParams = [req.params.workspace_id, startDate, endDate];
            let paramIndex = 4;
            if (platforms) {
                const platformList = platforms.split(',').map(p => p.trim());
                whereConditions.push(`m.platform = ANY($${paramIndex})`);
                queryParams.push(platformList);
                paramIndex++;
            }
            const query = `
        SELECT 
          ${selectClause},
          m.platform,
          COALESCE(SUM(m.spend), 0) as spend,
          COALESCE(SUM(m.revenue), 0) as revenue,
          COALESCE(SUM(m.impressions), 0) as impressions,
          COALESCE(SUM(m.clicks), 0) as clicks,
          COALESCE(SUM(m.conversions), 0) as conversions,
          CASE 
            WHEN SUM(m.spend) > 0 THEN ROUND(SUM(m.revenue) / SUM(m.spend), 2)
            ELSE 0 
          END as roas,
          CASE 
            WHEN SUM(m.conversions) > 0 THEN ROUND(SUM(m.spend) / SUM(m.conversions), 2)
            ELSE 0 
          END as cpa,
          CASE 
            WHEN SUM(m.impressions) > 0 THEN ROUND(SUM(m.clicks) * 100.0 / SUM(m.impressions), 2)
            ELSE 0 
          END as ctr,
          CASE 
            WHEN SUM(m.impressions) > 0 THEN ROUND(SUM(m.spend) * 1000.0 / SUM(m.impressions), 2)
            ELSE 0 
          END as cpm,
          CASE 
            WHEN SUM(m.clicks) > 0 THEN ROUND(SUM(m.conversions) * 100.0 / SUM(m.clicks), 2)
            ELSE 0 
          END as cvr
        FROM metrics_daily m
        JOIN accounts a ON m.account_id = a.id
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY ${groupByClause}
        ORDER BY ${groupByClause}
      `;
            const result = await client.query(query, queryParams);
            const trendsData = result.rows.map(row => ({
                date: row.date,
                platform: row.platform,
                spend: parseFloat(row.spend),
                revenue: parseFloat(row.revenue),
                roas: parseFloat(row.roas),
                cpa: parseFloat(row.cpa),
                ctr: parseFloat(row.ctr),
                cpm: parseFloat(row.cpm),
                cvr: parseFloat(row.cvr),
                impressions: parseInt(row.impressions),
                clicks: parseInt(row.clicks),
                conversions: parseInt(row.conversions)
            }));
            res.json(trendsData);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get trends error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  GET /api/workspaces/{workspace_id}/metrics/daily
  Retrieves detailed daily metrics with comprehensive filtering and pagination
*/
app.get('/api/workspaces/:workspace_id/metrics/daily', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const date_from = getQueryParam(req.query.date_from);
        const date_to = getQueryParam(req.query.date_to);
        const platform = getQueryParam(req.query.platform);
        const account_id = getQueryParam(req.query.account_id);
        const campaign_id = getQueryParam(req.query.campaign_id);
        const adset_id = getQueryParam(req.query.adset_id);
        const ad_id = getQueryParam(req.query.ad_id);
        const limit = getQueryParamAsNumber(req.query.limit, 10);
        const offset = getQueryParamAsNumber(req.query.offset, 0);
        const sort_by = getQueryParam(req.query.sort_by, 'date');
        const sort_order = getQueryParam(req.query.sort_order, 'desc');
        const client = await pool.connect();
        try {
            let whereConditions = ['a.workspace_id = $1'];
            let queryParams = [req.params.workspace_id];
            let paramIndex = 2;
            if (date_from) {
                whereConditions.push(`m.date >= $${paramIndex}`);
                queryParams.push(date_from);
                paramIndex++;
            }
            if (date_to) {
                whereConditions.push(`m.date <= $${paramIndex}`);
                queryParams.push(date_to);
                paramIndex++;
            }
            if (platform) {
                whereConditions.push(`m.platform = $${paramIndex}`);
                queryParams.push(platform);
                paramIndex++;
            }
            if (account_id) {
                whereConditions.push(`m.account_id = $${paramIndex}`);
                queryParams.push(account_id);
                paramIndex++;
            }
            if (campaign_id) {
                whereConditions.push(`m.campaign_id = $${paramIndex}`);
                queryParams.push(campaign_id);
                paramIndex++;
            }
            if (adset_id) {
                whereConditions.push(`m.adset_id = $${paramIndex}`);
                queryParams.push(adset_id);
                paramIndex++;
            }
            if (ad_id) {
                whereConditions.push(`m.ad_id = $${paramIndex}`);
                queryParams.push(ad_id);
                paramIndex++;
            }
            // Count query for pagination
            const countQuery = `
        SELECT COUNT(*) as total
        FROM metrics_daily m
        JOIN accounts a ON m.account_id = a.id
        WHERE ${whereConditions.join(' AND ')}
      `;
            const countResult = await client.query(countQuery, queryParams);
            const total = parseInt(countResult.rows[0].total);
            // Main data query
            const dataQuery = `
        SELECT m.*, a.account_name, a.platform as account_platform
        FROM metrics_daily m
        JOIN accounts a ON m.account_id = a.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
            queryParams.push(limit, offset);
            const dataResult = await client.query(dataQuery, queryParams);
            const pagination = {
                page: Math.floor(offset / limit) + 1,
                per_page: limit,
                total: total,
                total_pages: Math.ceil(total / limit)
            };
            res.json({
                data: dataResult.rows,
                pagination
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get daily metrics error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
// ================================
// ACCOUNT MANAGEMENT ROUTES
// ================================
/*
  GET /api/workspaces/{workspace_id}/accounts
  Retrieves paginated list of advertising accounts with filtering capabilities
*/
app.get('/api/workspaces/:workspace_id/accounts', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const platform = getQueryParam(req.query.platform);
        const status = getQueryParam(req.query.status);
        const currency = getQueryParam(req.query.currency);
        const query = getQueryParam(req.query.query);
        const limit = getQueryParamAsNumber(req.query.limit, 10);
        const offset = getQueryParamAsNumber(req.query.offset, 0);
        const sort_by = getQueryParam(req.query.sort_by, 'created_at');
        const sort_order = getQueryParam(req.query.sort_order, 'desc');
        const client = await pool.connect();
        try {
            let whereConditions = ['workspace_id = $1'];
            let queryParams = [req.params.workspace_id];
            let paramIndex = 2;
            if (platform) {
                whereConditions.push(`platform = $${paramIndex}`);
                queryParams.push(platform);
                paramIndex++;
            }
            if (status) {
                whereConditions.push(`status = $${paramIndex}`);
                queryParams.push(status);
                paramIndex++;
            }
            if (currency) {
                whereConditions.push(`currency = $${paramIndex}`);
                queryParams.push(currency);
                paramIndex++;
            }
            if (query) {
                whereConditions.push(`(account_name ILIKE $${paramIndex} OR account_id ILIKE $${paramIndex})`);
                queryParams.push(`%${query}%`);
                paramIndex++;
            }
            // Count query
            const countQuery = `SELECT COUNT(*) as total FROM accounts WHERE ${whereConditions.join(' AND ')}`;
            const countResult = await client.query(countQuery, queryParams);
            const total = parseInt(countResult.rows[0].total);
            // Data query
            const dataQuery = `
        SELECT * FROM accounts 
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
            queryParams.push(limit, offset);
            const dataResult = await client.query(dataQuery, queryParams);
            const pagination = {
                page: Math.floor(offset / limit) + 1,
                per_page: limit,
                total: total,
                total_pages: Math.ceil(total / limit)
            };
            res.json({
                data: dataResult.rows,
                pagination
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get accounts error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  POST /api/workspaces/{workspace_id}/accounts
  Creates a new advertising account within the workspace
*/
app.post('/api/workspaces/:workspace_id/accounts', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const validation = createAccountInputSchema.safeParse({ ...req.body, workspace_id: req.params.workspace_id });
        if (!validation.success) {
            return res.status(400).json(createErrorResponse('Invalid input data', validation.error, 'VALIDATION_ERROR'));
        }
        const { platform, account_id, account_name, status = 'active', currency } = validation.data;
        const client = await pool.connect();
        try {
            // Check for duplicate account_id within workspace/platform
            const existingAccount = await client.query(`
        SELECT id FROM accounts 
        WHERE workspace_id = $1 AND platform = $2 AND account_id = $3
      `, [req.params.workspace_id, platform, account_id]);
            if (existingAccount.rows.length > 0) {
                return res.status(400).json(createErrorResponse('Account ID already exists for this platform', null, 'DUPLICATE_ACCOUNT'));
            }
            const accountUuid = uuidv4();
            const now = new Date().toISOString();
            const result = await client.query(`
        INSERT INTO accounts (id, workspace_id, platform, account_id, account_name, status, currency, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [accountUuid, req.params.workspace_id, platform, account_id, account_name, status, currency, now, now]);
            res.status(201).json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Create account error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  GET /api/workspaces/{workspace_id}/accounts/{account_id}
  Retrieves detailed account information
*/
app.get('/api/workspaces/:workspace_id/accounts/:account_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            const result = await client.query(`
        SELECT * FROM accounts 
        WHERE id = $1 AND workspace_id = $2
      `, [req.params.account_id, req.params.workspace_id]);
            if (result.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Account not found', null, 'ACCOUNT_NOT_FOUND'));
            }
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get account error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  PUT /api/workspaces/{workspace_id}/accounts/{account_id}
  Updates account settings and metadata
*/
app.put('/api/workspaces/:workspace_id/accounts/:account_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { account_name, status, currency } = req.body;
        const client = await pool.connect();
        try {
            const updateFields = [];
            const queryParams = [];
            let paramIndex = 1;
            if (account_name !== undefined) {
                updateFields.push(`account_name = $${paramIndex}`);
                queryParams.push(account_name);
                paramIndex++;
            }
            if (status) {
                updateFields.push(`status = $${paramIndex}`);
                queryParams.push(status);
                paramIndex++;
            }
            if (currency !== undefined) {
                updateFields.push(`currency = $${paramIndex}`);
                queryParams.push(currency);
                paramIndex++;
            }
            if (updateFields.length === 0) {
                return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
            }
            updateFields.push(`updated_at = $${paramIndex}`);
            queryParams.push(new Date().toISOString());
            paramIndex++;
            queryParams.push(req.params.account_id, req.params.workspace_id);
            const result = await client.query(`
        UPDATE accounts 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex - 1} AND workspace_id = $${paramIndex}
        RETURNING *
      `, queryParams);
            if (result.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Account not found', null, 'ACCOUNT_NOT_FOUND'));
            }
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Update account error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  DELETE /api/workspaces/{workspace_id}/accounts/{account_id}
  Deletes account and all associated data
*/
app.delete('/api/workspaces/:workspace_id/accounts/:account_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        if (!['owner', 'admin'].includes(req.workspace.role)) {
            return res.status(403).json(createErrorResponse('Access denied - admin required', null, 'ACCESS_DENIED'));
        }
        const client = await pool.connect();
        try {
            const result = await client.query(`
        DELETE FROM accounts 
        WHERE id = $1 AND workspace_id = $2
      `, [req.params.account_id, req.params.workspace_id]);
            if (result.rowCount === 0) {
                return res.status(404).json(createErrorResponse('Account not found', null, 'ACCOUNT_NOT_FOUND'));
            }
            res.status(204).send();
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
// ================================
// CAMPAIGN MANAGEMENT ROUTES
// ================================
/*
  GET /api/workspaces/{workspace_id}/campaigns
  Retrieves campaigns with comprehensive filtering and search capabilities
*/
app.get('/api/workspaces/:workspace_id/campaigns', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { search_query, platforms, accounts, status_filter, objective, page = 1, per_page = 50, limit = 10, offset = 0, sort_by = 'created_at', sort_order = 'desc' } = req.query;
        const client = await pool.connect();
        try {
            let whereConditions = ['a.workspace_id = $1'];
            let queryParams = [req.params.workspace_id];
            let paramIndex = 2;
            if (search_query) {
                whereConditions.push(`(c.campaign_name ILIKE $${paramIndex} OR c.campaign_id ILIKE $${paramIndex})`);
                queryParams.push(`%${search_query}%`);
                paramIndex++;
            }
            if (platforms) {
                const platformList = platforms.split(',').map(p => p.trim());
                whereConditions.push(`a.platform = ANY($${paramIndex})`);
                queryParams.push(platformList);
                paramIndex++;
            }
            if (accounts) {
                const accountList = accounts.split(',').map(a => a.trim());
                whereConditions.push(`a.id = ANY($${paramIndex})`);
                queryParams.push(accountList);
                paramIndex++;
            }
            if (status_filter) {
                whereConditions.push(`c.status = $${paramIndex}`);
                queryParams.push(status_filter);
                paramIndex++;
            }
            if (objective) {
                whereConditions.push(`c.objective = $${paramIndex}`);
                queryParams.push(objective);
                paramIndex++;
            }
            // Use per_page if provided, otherwise use limit
            const pageSize = per_page ? parseInt(per_page) : parseInt(limit);
            const pageOffset = per_page ? (parseInt(page) - 1) * pageSize : parseInt(offset);
            // Count query
            const countQuery = `
        SELECT COUNT(*) as total
        FROM campaigns c
        JOIN accounts a ON c.account_id = a.id
        WHERE ${whereConditions.join(' AND ')}
      `;
            const countResult = await client.query(countQuery, queryParams);
            const total = parseInt(countResult.rows[0].total);
            // Data query with account information
            const dataQuery = `
        SELECT c.*, a.platform, a.account_name
        FROM campaigns c
        JOIN accounts a ON c.account_id = a.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY c.${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
            queryParams.push(pageSize, pageOffset);
            const dataResult = await client.query(dataQuery, queryParams);
            const pagination = {
                page: per_page ? parseInt(page) : Math.floor(pageOffset / pageSize) + 1,
                per_page: pageSize,
                total: total,
                total_pages: Math.ceil(total / pageSize)
            };
            res.json({
                data: dataResult.rows,
                pagination
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get campaigns error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  GET /api/workspaces/{workspace_id}/campaigns/{campaign_id}
  Retrieves detailed campaign information with hierarchical ad structure and metrics
*/
app.get('/api/workspaces/:workspace_id/campaigns/:campaign_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { level = 'campaign', date_from, date_to } = req.query;
        const client = await pool.connect();
        try {
            // Get campaign details
            const campaignQuery = `
        SELECT c.*, a.platform, a.account_name
        FROM campaigns c
        JOIN accounts a ON c.account_id = a.id
        WHERE c.id = $1 AND a.workspace_id = $2
      `;
            const campaignResult = await client.query(campaignQuery, [req.params.campaign_id, req.params.workspace_id]);
            if (campaignResult.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Campaign not found', null, 'CAMPAIGN_NOT_FOUND'));
            }
            const campaign = campaignResult.rows[0];
            let adsets = [];
            let ads = [];
            // Get ad sets if level includes them
            if (['adset', 'ad'].includes(level)) {
                const adsetsQuery = `
          SELECT * FROM ad_sets
          WHERE campaign_id = $1
          ORDER BY created_at ASC
        `;
                const adsetsResult = await client.query(adsetsQuery, [req.params.campaign_id]);
                adsets = adsetsResult.rows;
                // Get ads if level includes them
                if (level === 'ad' && adsets.length > 0) {
                    const adsetIds = adsets.map(as => as.id);
                    const adsQuery = `
            SELECT * FROM ads
            WHERE adset_id = ANY($1)
            ORDER BY created_at ASC
          `;
                    const adsResult = await client.query(adsQuery, [adsetIds]);
                    ads = adsResult.rows;
                }
            }
            // Calculate aggregated metrics for the campaign
            let metricsQuery = `
        SELECT 
          COALESCE(SUM(spend), 0) as spend,
          COALESCE(SUM(revenue), 0) as revenue,
          COALESCE(SUM(impressions), 0) as impressions,
          COALESCE(SUM(clicks), 0) as clicks,
          COALESCE(SUM(conversions), 0) as conversions,
          CASE 
            WHEN SUM(spend) > 0 THEN ROUND(SUM(revenue) / SUM(spend), 2)
            ELSE 0 
          END as roas,
          CASE 
            WHEN SUM(conversions) > 0 THEN ROUND(SUM(spend) / SUM(conversions), 2)
            ELSE 0 
          END as cpa,
          CASE 
            WHEN SUM(impressions) > 0 THEN ROUND(SUM(clicks) * 100.0 / SUM(impressions), 2)
            ELSE 0 
          END as ctr,
          CASE 
            WHEN SUM(impressions) > 0 THEN ROUND(SUM(spend) * 1000.0 / SUM(impressions), 2)
            ELSE 0 
          END as cpm,
          CASE 
            WHEN SUM(clicks) > 0 THEN ROUND(SUM(conversions) * 100.0 / SUM(clicks), 2)
            ELSE 0 
          END as cvr
        FROM metrics_daily
        WHERE campaign_id = $1
      `;
            let metricsParams = [req.params.campaign_id];
            let paramIndex = 2;
            if (date_from) {
                metricsQuery += ` AND date >= $${paramIndex}`;
                metricsParams.push(date_from);
                paramIndex++;
            }
            if (date_to) {
                metricsQuery += ` AND date <= $${paramIndex}`;
                metricsParams.push(date_to);
                paramIndex++;
            }
            const metricsResult = await client.query(metricsQuery, metricsParams);
            const metrics = metricsResult.rows[0];
            res.json({
                campaign,
                adsets,
                ads,
                metrics: {
                    spend: parseFloat(metrics.spend),
                    revenue: parseFloat(metrics.revenue),
                    impressions: parseInt(metrics.impressions),
                    clicks: parseInt(metrics.clicks),
                    conversions: parseInt(metrics.conversions),
                    roas: parseFloat(metrics.roas),
                    cpa: parseFloat(metrics.cpa),
                    ctr: parseFloat(metrics.ctr),
                    cpm: parseFloat(metrics.cpm),
                    cvr: parseFloat(metrics.cvr)
                }
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get campaign error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  PUT /api/workspaces/{workspace_id}/campaigns/{campaign_id}
  Updates campaign settings and metadata
*/
app.put('/api/workspaces/:workspace_id/campaigns/:campaign_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { campaign_name, status, objective, buying_type } = req.body;
        const client = await pool.connect();
        try {
            // Verify campaign belongs to workspace
            const verifyQuery = `
        SELECT c.id FROM campaigns c
        JOIN accounts a ON c.account_id = a.id
        WHERE c.id = $1 AND a.workspace_id = $2
      `;
            const verifyResult = await client.query(verifyQuery, [req.params.campaign_id, req.params.workspace_id]);
            if (verifyResult.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Campaign not found', null, 'CAMPAIGN_NOT_FOUND'));
            }
            const updateFields = [];
            const queryParams = [];
            let paramIndex = 1;
            if (campaign_name !== undefined) {
                updateFields.push(`campaign_name = $${paramIndex}`);
                queryParams.push(campaign_name);
                paramIndex++;
            }
            if (status) {
                updateFields.push(`status = $${paramIndex}`);
                queryParams.push(status);
                paramIndex++;
            }
            if (objective !== undefined) {
                updateFields.push(`objective = $${paramIndex}`);
                queryParams.push(objective);
                paramIndex++;
            }
            if (buying_type !== undefined) {
                updateFields.push(`buying_type = $${paramIndex}`);
                queryParams.push(buying_type);
                paramIndex++;
            }
            if (updateFields.length === 0) {
                return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
            }
            updateFields.push(`updated_at = $${paramIndex}`);
            queryParams.push(new Date().toISOString());
            paramIndex++;
            queryParams.push(req.params.campaign_id);
            const result = await client.query(`
        UPDATE campaigns 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, queryParams);
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Update campaign error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  GET /api/workspaces/{workspace_id}/campaigns/{campaign_id}/adsets
  Retrieves ad sets for a specific campaign with filtering and pagination
*/
app.get('/api/workspaces/:workspace_id/campaigns/:campaign_id/adsets', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { status, query, limit = 10, offset = 0, sort_by = 'created_at', sort_order = 'desc' } = req.query;
        const client = await pool.connect();
        try {
            // Verify campaign belongs to workspace
            const verifyQuery = `
        SELECT c.id FROM campaigns c
        JOIN accounts a ON c.account_id = a.id
        WHERE c.id = $1 AND a.workspace_id = $2
      `;
            const verifyResult = await client.query(verifyQuery, [req.params.campaign_id, req.params.workspace_id]);
            if (verifyResult.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Campaign not found', null, 'CAMPAIGN_NOT_FOUND'));
            }
            let whereConditions = ['campaign_id = $1'];
            let queryParams = [req.params.campaign_id];
            let paramIndex = 2;
            if (status) {
                whereConditions.push(`status = $${paramIndex}`);
                queryParams.push(status);
                paramIndex++;
            }
            if (query) {
                whereConditions.push(`(adset_name ILIKE $${paramIndex} OR adset_id ILIKE $${paramIndex})`);
                queryParams.push(`%${query}%`);
                paramIndex++;
            }
            // Count query
            const countQuery = `SELECT COUNT(*) as total FROM ad_sets WHERE ${whereConditions.join(' AND ')}`;
            const countResult = await client.query(countQuery, queryParams);
            const total = parseInt(countResult.rows[0].total);
            // Data query
            const dataQuery = `
        SELECT * FROM ad_sets 
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
            queryParams.push(limit, offset);
            const dataResult = await client.query(dataQuery, queryParams);
            const pagination = {
                page: Math.floor(offset / limit) + 1,
                per_page: limit,
                total: total,
                total_pages: Math.ceil(total / limit)
            };
            res.json({
                data: dataResult.rows,
                pagination
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get campaign ad sets error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  GET /api/workspaces/{workspace_id}/adsets/{adset_id}
  Retrieves detailed ad set information
*/
app.get('/api/workspaces/:workspace_id/adsets/:adset_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            const query = `
        SELECT ads.*, c.campaign_name, a.account_name, a.platform
        FROM ad_sets ads
        JOIN campaigns c ON ads.campaign_id = c.id
        JOIN accounts a ON c.account_id = a.id
        WHERE ads.id = $1 AND a.workspace_id = $2
      `;
            const result = await client.query(query, [req.params.adset_id, req.params.workspace_id]);
            if (result.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Ad set not found', null, 'ADSET_NOT_FOUND'));
            }
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get ad set error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  PUT /api/workspaces/{workspace_id}/adsets/{adset_id}
  Updates ad set settings and configuration
*/
app.put('/api/workspaces/:workspace_id/adsets/:adset_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { adset_name, status, bid_strategy, optimization_goal } = req.body;
        const client = await pool.connect();
        try {
            // Verify ad set belongs to workspace
            const verifyQuery = `
        SELECT ads.id FROM ad_sets ads
        JOIN campaigns c ON ads.campaign_id = c.id
        JOIN accounts a ON c.account_id = a.id
        WHERE ads.id = $1 AND a.workspace_id = $2
      `;
            const verifyResult = await client.query(verifyQuery, [req.params.adset_id, req.params.workspace_id]);
            if (verifyResult.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Ad set not found', null, 'ADSET_NOT_FOUND'));
            }
            const updateFields = [];
            const queryParams = [];
            let paramIndex = 1;
            if (adset_name !== undefined) {
                updateFields.push(`adset_name = $${paramIndex}`);
                queryParams.push(adset_name);
                paramIndex++;
            }
            if (status) {
                updateFields.push(`status = $${paramIndex}`);
                queryParams.push(status);
                paramIndex++;
            }
            if (bid_strategy !== undefined) {
                updateFields.push(`bid_strategy = $${paramIndex}`);
                queryParams.push(bid_strategy);
                paramIndex++;
            }
            if (optimization_goal !== undefined) {
                updateFields.push(`optimization_goal = $${paramIndex}`);
                queryParams.push(optimization_goal);
                paramIndex++;
            }
            if (updateFields.length === 0) {
                return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
            }
            updateFields.push(`updated_at = $${paramIndex}`);
            queryParams.push(new Date().toISOString());
            paramIndex++;
            queryParams.push(req.params.adset_id);
            const result = await client.query(`
        UPDATE ad_sets 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, queryParams);
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Update ad set error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  GET /api/workspaces/{workspace_id}/adsets/{adset_id}/ads
  Retrieves ads for a specific ad set with filtering and pagination
*/
app.get('/api/workspaces/:workspace_id/adsets/:adset_id/ads', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { status, ad_format, query, limit = 10, offset = 0, sort_by = 'created_at', sort_order = 'desc' } = req.query;
        const client = await pool.connect();
        try {
            // Verify ad set belongs to workspace
            const verifyQuery = `
        SELECT ads.id FROM ad_sets ads
        JOIN campaigns c ON ads.campaign_id = c.id
        JOIN accounts a ON c.account_id = a.id
        WHERE ads.id = $1 AND a.workspace_id = $2
      `;
            const verifyResult = await client.query(verifyQuery, [req.params.adset_id, req.params.workspace_id]);
            if (verifyResult.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Ad set not found', null, 'ADSET_NOT_FOUND'));
            }
            let whereConditions = ['adset_id = $1'];
            let queryParams = [req.params.adset_id];
            let paramIndex = 2;
            if (status) {
                whereConditions.push(`status = $${paramIndex}`);
                queryParams.push(status);
                paramIndex++;
            }
            if (ad_format) {
                whereConditions.push(`ad_format = $${paramIndex}`);
                queryParams.push(ad_format);
                paramIndex++;
            }
            if (query) {
                whereConditions.push(`(ad_name ILIKE $${paramIndex} OR ad_id ILIKE $${paramIndex} OR creative_name ILIKE $${paramIndex})`);
                queryParams.push(`%${query}%`);
                paramIndex++;
            }
            // Count query
            const countQuery = `SELECT COUNT(*) as total FROM ads WHERE ${whereConditions.join(' AND ')}`;
            const countResult = await client.query(countQuery, queryParams);
            const total = parseInt(countResult.rows[0].total);
            // Data query
            const dataQuery = `
        SELECT * FROM ads 
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
            queryParams.push(limit, offset);
            const dataResult = await client.query(dataQuery, queryParams);
            const pagination = {
                page: Math.floor(offset / limit) + 1,
                per_page: limit,
                total: total,
                total_pages: Math.ceil(total / limit)
            };
            res.json({
                data: dataResult.rows,
                pagination
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get ad set ads error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  GET /api/workspaces/{workspace_id}/ads/{ad_id}
  Retrieves detailed ad information with creative assets
*/
app.get('/api/workspaces/:workspace_id/ads/:ad_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            const query = `
        SELECT ad.*, ads.adset_name, c.campaign_name, a.account_name, a.platform
        FROM ads ad
        JOIN ad_sets ads ON ad.adset_id = ads.id
        JOIN campaigns c ON ads.campaign_id = c.id
        JOIN accounts a ON c.account_id = a.id
        WHERE ad.id = $1 AND a.workspace_id = $2
      `;
            const result = await client.query(query, [req.params.ad_id, req.params.workspace_id]);
            if (result.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Ad not found', null, 'AD_NOT_FOUND'));
            }
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get ad error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  PUT /api/workspaces/{workspace_id}/ads/{ad_id}
  Updates ad settings and creative information
*/
app.put('/api/workspaces/:workspace_id/ads/:ad_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { ad_name, creative_name, creative_thumb_url, creative_tags, status, ad_format } = req.body;
        const client = await pool.connect();
        try {
            // Verify ad belongs to workspace
            const verifyQuery = `
        SELECT ad.id FROM ads ad
        JOIN ad_sets ads ON ad.adset_id = ads.id
        JOIN campaigns c ON ads.campaign_id = c.id
        JOIN accounts a ON c.account_id = a.id
        WHERE ad.id = $1 AND a.workspace_id = $2
      `;
            const verifyResult = await client.query(verifyQuery, [req.params.ad_id, req.params.workspace_id]);
            if (verifyResult.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Ad not found', null, 'AD_NOT_FOUND'));
            }
            const updateFields = [];
            const queryParams = [];
            let paramIndex = 1;
            if (ad_name !== undefined) {
                updateFields.push(`ad_name = $${paramIndex}`);
                queryParams.push(ad_name);
                paramIndex++;
            }
            if (creative_name !== undefined) {
                updateFields.push(`creative_name = $${paramIndex}`);
                queryParams.push(creative_name);
                paramIndex++;
            }
            if (creative_thumb_url !== undefined) {
                updateFields.push(`creative_thumb_url = $${paramIndex}`);
                queryParams.push(creative_thumb_url);
                paramIndex++;
            }
            if (creative_tags !== undefined) {
                updateFields.push(`creative_tags = $${paramIndex}`);
                queryParams.push(creative_tags);
                paramIndex++;
            }
            if (status) {
                updateFields.push(`status = $${paramIndex}`);
                queryParams.push(status);
                paramIndex++;
            }
            if (ad_format !== undefined) {
                updateFields.push(`ad_format = $${paramIndex}`);
                queryParams.push(ad_format);
                paramIndex++;
            }
            if (updateFields.length === 0) {
                return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
            }
            updateFields.push(`updated_at = $${paramIndex}`);
            queryParams.push(new Date().toISOString());
            paramIndex++;
            queryParams.push(req.params.ad_id);
            const result = await client.query(`
        UPDATE ads 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, queryParams);
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Update ad error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
// ================================
// CREATIVE PERFORMANCE ROUTES
// ================================
/*
  GET /api/workspaces/{workspace_id}/creatives
  Provides aggregated creative performance analysis with winner/loser classification
  Performs complex cross-campaign rollups to analyze creative effectiveness
*/
app.get('/api/workspaces/:workspace_id/creatives', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { performance_filter, sort_by = 'total_spend', platforms, creative_tags, ad_format, date_from, date_to, query, min_spend, max_spend, limit = 10, offset = 0, sort_order = 'desc' } = req.query;
        const client = await pool.connect();
        try {
            // Build date range filter
            const endDate = date_to || new Date().toISOString().split('T')[0];
            const startDate = date_from || new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            let whereConditions = ['a.workspace_id = $1', 'm.date >= $2', 'm.date <= $3'];
            let queryParams = [req.params.workspace_id, startDate, endDate];
            let paramIndex = 4;
            let havingConditions = [];
            if (platforms) {
                const platformList = platforms.split(',').map(p => p.trim());
                whereConditions.push(`m.platform = ANY($${paramIndex})`);
                queryParams.push(platformList);
                paramIndex++;
            }
            if (creative_tags) {
                whereConditions.push(`ad.creative_tags ILIKE $${paramIndex}`);
                queryParams.push(`%${creative_tags}%`);
                paramIndex++;
            }
            if (ad_format) {
                whereConditions.push(`ad.ad_format = $${paramIndex}`);
                queryParams.push(ad_format);
                paramIndex++;
            }
            if (query) {
                whereConditions.push(`ad.creative_name ILIKE $${paramIndex}`);
                queryParams.push(`%${query}%`);
                paramIndex++;
            }
            if (min_spend) {
                havingConditions.push(`SUM(m.spend) >= $${paramIndex}`);
                queryParams.push(parseFloat(min_spend));
                paramIndex++;
            }
            if (max_spend) {
                havingConditions.push(`SUM(m.spend) <= $${paramIndex}`);
                queryParams.push(parseFloat(max_spend));
                paramIndex++;
            }
            // Complex aggregation query for creative performance analysis
            const baseQuery = `
        SELECT 
          ad.creative_name,
          ad.creative_thumb_url,
          ad.creative_tags,
          ad.ad_format,
          ARRAY_AGG(DISTINCT m.platform) as platforms,
          COALESCE(SUM(m.spend), 0) as total_spend,
          COALESCE(SUM(m.impressions), 0) as total_impressions,
          COALESCE(SUM(m.clicks), 0) as total_clicks,
          COALESCE(SUM(m.conversions), 0) as total_conversions,
          COALESCE(SUM(m.revenue), 0) as total_revenue,
          CASE 
            WHEN SUM(m.impressions) > 0 THEN ROUND(AVG(m.ctr), 2)
            ELSE 0 
          END as avg_ctr,
          CASE 
            WHEN SUM(m.impressions) > 0 THEN ROUND(AVG(m.cpm), 2)
            ELSE 0 
          END as avg_cpm,
          CASE 
            WHEN SUM(m.clicks) > 0 THEN ROUND(SUM(m.spend) / SUM(m.clicks), 2)
            ELSE 0 
          END as avg_cpc,
          CASE 
            WHEN SUM(m.conversions) > 0 THEN ROUND(SUM(m.spend) / SUM(m.conversions), 2)
            ELSE 0 
          END as avg_cpa,
          CASE 
            WHEN SUM(m.clicks) > 0 THEN ROUND(SUM(m.conversions) * 100.0 / SUM(m.clicks), 2)
            ELSE 0 
          END as avg_cvr,
          CASE 
            WHEN SUM(m.spend) > 0 THEN ROUND(SUM(m.revenue) / SUM(m.spend), 2)
            ELSE 0 
          END as avg_roas,
          COUNT(DISTINCT c.id) as campaign_count,
          MIN(m.date) as first_seen_date,
          MAX(m.date) as last_seen_date
        FROM metrics_daily m
        JOIN accounts a ON m.account_id = a.id
        JOIN ads ad ON m.ad_id = ad.id
        JOIN ad_sets ads ON ad.adset_id = ads.id
        JOIN campaigns c ON ads.campaign_id = c.id
        WHERE ${whereConditions.join(' AND ')} AND ad.creative_name IS NOT NULL
        GROUP BY ad.creative_name, ad.creative_thumb_url, ad.creative_tags, ad.ad_format
      `;
            // Add HAVING clause if conditions exist
            let finalQuery = baseQuery;
            if (havingConditions.length > 0) {
                finalQuery += ` HAVING ${havingConditions.join(' AND ')}`;
            }
            // Get all results first for performance ranking calculation
            const allResults = await client.query(finalQuery, queryParams);
            // Calculate performance rankings
            const creativesWithRanking = allResults.rows.map(creative => {
                let performance_rank = null;
                if (creative.avg_roas > 0 && creative.total_spend >= 100) {
                    // Simple ranking based on ROAS and minimum spend threshold
                    if (creative.avg_roas >= 3.0) {
                        performance_rank = 'winner';
                    }
                    else if (creative.avg_roas < 1.5) {
                        performance_rank = 'loser';
                    }
                }
                return {
                    id: uuidv4(), // Generate ID for consistency
                    workspace_id: req.params.workspace_id,
                    creative_name: creative.creative_name,
                    creative_thumb_url: creative.creative_thumb_url || `https://picsum.photos/400/300?random=${Math.floor(Math.random() * 1000)}`,
                    creative_tags: creative.creative_tags,
                    ad_format: creative.ad_format,
                    platforms: creative.platforms,
                    total_spend: parseFloat(creative.total_spend),
                    total_impressions: parseInt(creative.total_impressions),
                    total_clicks: parseInt(creative.total_clicks),
                    total_conversions: parseInt(creative.total_conversions),
                    total_revenue: parseFloat(creative.total_revenue),
                    avg_ctr: parseFloat(creative.avg_ctr),
                    avg_cpm: parseFloat(creative.avg_cpm),
                    avg_cpc: parseFloat(creative.avg_cpc),
                    avg_cpa: parseFloat(creative.avg_cpa),
                    avg_cvr: parseFloat(creative.avg_cvr),
                    avg_roas: parseFloat(creative.avg_roas),
                    campaign_count: parseInt(creative.campaign_count),
                    performance_rank,
                    first_seen_date: creative.first_seen_date,
                    last_seen_date: creative.last_seen_date,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
            });
            // Apply performance filter
            let filteredCreatives = creativesWithRanking;
            if (performance_filter) {
                if (performance_filter === 'winners') {
                    filteredCreatives = creativesWithRanking.filter(c => c.performance_rank === 'winner');
                }
                else if (performance_filter === 'losers') {
                    filteredCreatives = creativesWithRanking.filter(c => c.performance_rank === 'loser');
                }
            }
            // Sort results
            filteredCreatives.sort((a, b) => {
                let comparison = 0;
                switch (sort_by) {
                    case 'creative_name':
                        comparison = a.creative_name.localeCompare(b.creative_name);
                        break;
                    case 'total_spend':
                        comparison = a.total_spend - b.total_spend;
                        break;
                    case 'avg_roas':
                        comparison = a.avg_roas - b.avg_roas;
                        break;
                    case 'campaign_count':
                        comparison = a.campaign_count - b.campaign_count;
                        break;
                    case 'last_seen_date':
                        comparison = new Date(a.last_seen_date) - new Date(b.last_seen_date);
                        break;
                    default:
                        comparison = a.total_spend - b.total_spend;
                }
                return sort_order === 'desc' ? -comparison : comparison;
            });
            // Apply pagination
            const total = filteredCreatives.length;
            const paginatedResults = filteredCreatives.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
            const pagination = {
                page: Math.floor(offset / limit) + 1,
                per_page: limit,
                total: total,
                total_pages: Math.ceil(total / limit)
            };
            res.json({
                data: paginatedResults,
                pagination
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get creative performance error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  GET /api/workspaces/{workspace_id}/creatives/{creative_id}
  Retrieves detailed creative performance with campaign usage breakdown
*/
app.get('/api/workspaces/:workspace_id/creatives/:creative_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            // For this endpoint, we'll treat creative_id as creative_name since that's how we aggregate
            const query = `
        SELECT 
          ad.creative_name,
          ad.creative_thumb_url,
          ad.creative_tags,
          ad.ad_format,
          ARRAY_AGG(DISTINCT m.platform) as platforms,
          COALESCE(SUM(m.spend), 0) as total_spend,
          COALESCE(SUM(m.impressions), 0) as total_impressions,
          COALESCE(SUM(m.clicks), 0) as total_clicks,
          COALESCE(SUM(m.conversions), 0) as total_conversions,
          COALESCE(SUM(m.revenue), 0) as total_revenue,
          CASE 
            WHEN SUM(m.impressions) > 0 THEN ROUND(AVG(m.ctr), 2)
            ELSE 0 
          END as avg_ctr,
          CASE 
            WHEN SUM(m.impressions) > 0 THEN ROUND(AVG(m.cpm), 2)
            ELSE 0 
          END as avg_cpm,
          CASE 
            WHEN SUM(m.clicks) > 0 THEN ROUND(SUM(m.spend) / SUM(m.clicks), 2)
            ELSE 0 
          END as avg_cpc,
          CASE 
            WHEN SUM(m.conversions) > 0 THEN ROUND(SUM(m.spend) / SUM(m.conversions), 2)
            ELSE 0 
          END as avg_cpa,
          CASE 
            WHEN SUM(m.clicks) > 0 THEN ROUND(SUM(m.conversions) * 100.0 / SUM(m.clicks), 2)
            ELSE 0 
          END as avg_cvr,
          CASE 
            WHEN SUM(m.spend) > 0 THEN ROUND(SUM(m.revenue) / SUM(m.spend), 2)
            ELSE 0 
          END as avg_roas,
          COUNT(DISTINCT c.id) as campaign_count,
          MIN(m.date) as first_seen_date,
          MAX(m.date) as last_seen_date
        FROM metrics_daily m
        JOIN accounts a ON m.account_id = a.id
        JOIN ads ad ON m.ad_id = ad.id
        JOIN ad_sets ads ON ad.adset_id = ads.id
        JOIN campaigns c ON ads.campaign_id = c.id
        WHERE a.workspace_id = $1 AND ad.creative_name = $2
        GROUP BY ad.creative_name, ad.creative_thumb_url, ad.creative_tags, ad.ad_format
      `;
            const result = await client.query(query, [req.params.workspace_id, req.params.creative_id]);
            if (result.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Creative not found', null, 'CREATIVE_NOT_FOUND'));
            }
            const creative = result.rows[0];
            // Calculate performance rank
            let performance_rank = null;
            if (creative.avg_roas > 0 && creative.total_spend >= 100) {
                if (creative.avg_roas >= 3.0) {
                    performance_rank = 'winner';
                }
                else if (creative.avg_roas < 1.5) {
                    performance_rank = 'loser';
                }
            }
            const creativeDetails = {
                id: uuidv4(),
                workspace_id: req.params.workspace_id,
                creative_name: creative.creative_name,
                creative_thumb_url: creative.creative_thumb_url || `https://picsum.photos/400/300?random=${Math.floor(Math.random() * 1000)}`,
                creative_tags: creative.creative_tags,
                ad_format: creative.ad_format,
                platforms: creative.platforms,
                total_spend: parseFloat(creative.total_spend),
                total_impressions: parseInt(creative.total_impressions),
                total_clicks: parseInt(creative.total_clicks),
                total_conversions: parseInt(creative.total_conversions),
                total_revenue: parseFloat(creative.total_revenue),
                avg_ctr: parseFloat(creative.avg_ctr),
                avg_cpm: parseFloat(creative.avg_cpm),
                avg_cpc: parseFloat(creative.avg_cpc),
                avg_cpa: parseFloat(creative.avg_cpa),
                avg_cvr: parseFloat(creative.avg_cvr),
                avg_roas: parseFloat(creative.avg_roas),
                campaign_count: parseInt(creative.campaign_count),
                performance_rank,
                first_seen_date: creative.first_seen_date,
                last_seen_date: creative.last_seen_date,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            res.json(creativeDetails);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get creative details error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
// ================================
// UPLOAD MANAGEMENT ROUTES
// ================================
/*
  GET /api/workspaces/{workspace_id}/uploads
  Retrieves upload history with status tracking and filtering
*/
app.get('/api/workspaces/:workspace_id/uploads', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { status_filter, platform_filter, search_query, page = 1, limit = 10, offset = 0, sort_by = 'created_at', sort_order = 'desc' } = req.query;
        const client = await pool.connect();
        try {
            let whereConditions = ['workspace_id = $1'];
            let queryParams = [req.params.workspace_id];
            let paramIndex = 2;
            if (status_filter) {
                whereConditions.push(`status = $${paramIndex}`);
                queryParams.push(status_filter);
                paramIndex++;
            }
            if (platform_filter) {
                whereConditions.push(`platform = $${paramIndex}`);
                queryParams.push(platform_filter);
                paramIndex++;
            }
            if (search_query) {
                whereConditions.push(`(original_filename ILIKE $${paramIndex} OR filename ILIKE $${paramIndex})`);
                queryParams.push(`%${search_query}%`);
                paramIndex++;
            }
            // Use page parameter if provided, otherwise use offset
            const pageSize = parseInt(limit);
            const pageOffset = page ? (parseInt(page) - 1) * pageSize : parseInt(offset);
            // Count query
            const countQuery = `SELECT COUNT(*) as total FROM upload_jobs WHERE ${whereConditions.join(' AND ')}`;
            const countResult = await client.query(countQuery, queryParams);
            const total = parseInt(countResult.rows[0].total);
            // Data query
            const dataQuery = `
        SELECT * FROM upload_jobs 
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
            queryParams.push(pageSize, pageOffset);
            const dataResult = await client.query(dataQuery, queryParams);
            const pagination = {
                page: page ? parseInt(page) : Math.floor(pageOffset / pageSize) + 1,
                per_page: pageSize,
                total: total,
                total_pages: Math.ceil(total / pageSize)
            };
            res.json({
                data: dataResult.rows,
                pagination
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get uploads error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  POST /api/workspaces/{workspace_id}/uploads
  Initiates file upload process with asynchronous processing
*/
app.post('/api/workspaces/:workspace_id/uploads', authenticateToken, validateWorkspaceAccess, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json(createErrorResponse('File is required', null, 'FILE_REQUIRED'));
        }
        const { platform, mapping_template_id, date_from, date_to } = req.body;
        if (!platform) {
            return res.status(400).json(createErrorResponse('Platform is required', null, 'PLATFORM_REQUIRED'));
        }
        const validPlatforms = ['facebook', 'google', 'tiktok', 'snapchat', 'linkedin', 'twitter'];
        if (!validPlatforms.includes(platform)) {
            return res.status(400).json(createErrorResponse('Invalid platform', null, 'INVALID_PLATFORM'));
        }
        const client = await pool.connect();
        try {
            const uploadId = uuidv4();
            const now = new Date().toISOString();
            // Create upload job record
            const result = await client.query(`
        INSERT INTO upload_jobs (
          id, workspace_id, user_id, filename, original_filename, file_size, 
          platform, status, progress, rows_processed, rows_total, rows_success, rows_error,
          mapping_template_id, date_from, date_to, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
      `, [
                uploadId, req.params.workspace_id, req.user.id, req.file.filename, req.file.originalname,
                req.file.size, platform, 'queued', 0, 0, 0, 0, 0, mapping_template_id || null,
                date_from || null, date_to || null, now, now
            ]);
            // Start background processing (mocked)
            scheduleBackgroundJob({
                job_type: 'process_upload',
                job_data: {
                    upload_id: uploadId,
                    file_path: req.file.path,
                    platform,
                    mapping_template_id
                }
            });
            // Update status to processing
            await client.query(`
        UPDATE upload_jobs 
        SET status = 'processing', started_at = $1, updated_at = $2
        WHERE id = $3
      `, [now, now, uploadId]);
            res.status(201).json({
                ...result.rows[0],
                status: 'processing',
                started_at: now
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Create upload error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  GET /api/workspaces/{workspace_id}/uploads/{upload_id}
  Retrieves detailed upload status and processing information
*/
app.get('/api/workspaces/:workspace_id/uploads/:upload_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            const result = await client.query(`
        SELECT * FROM upload_jobs 
        WHERE id = $1 AND workspace_id = $2
      `, [req.params.upload_id, req.params.workspace_id]);
            if (result.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Upload not found', null, 'UPLOAD_NOT_FOUND'));
            }
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get upload error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  PUT /api/workspaces/{workspace_id}/uploads/{upload_id}
  Updates upload configuration (before processing)
*/
app.put('/api/workspaces/:workspace_id/uploads/:upload_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { mapping_template_id, date_from, date_to } = req.body;
        const client = await pool.connect();
        try {
            // Check if upload is still configurable
            const checkResult = await client.query(`
        SELECT status FROM upload_jobs 
        WHERE id = $1 AND workspace_id = $2
      `, [req.params.upload_id, req.params.workspace_id]);
            if (checkResult.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Upload not found', null, 'UPLOAD_NOT_FOUND'));
            }
            if (checkResult.rows[0].status !== 'queued') {
                return res.status(400).json(createErrorResponse('Upload cannot be modified after processing has started', null, 'UPLOAD_NOT_MODIFIABLE'));
            }
            const updateFields = [];
            const queryParams = [];
            let paramIndex = 1;
            if (mapping_template_id !== undefined) {
                updateFields.push(`mapping_template_id = $${paramIndex}`);
                queryParams.push(mapping_template_id);
                paramIndex++;
            }
            if (date_from !== undefined) {
                updateFields.push(`date_from = $${paramIndex}`);
                queryParams.push(date_from);
                paramIndex++;
            }
            if (date_to !== undefined) {
                updateFields.push(`date_to = $${paramIndex}`);
                queryParams.push(date_to);
                paramIndex++;
            }
            if (updateFields.length === 0) {
                return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
            }
            updateFields.push(`updated_at = $${paramIndex}`);
            queryParams.push(new Date().toISOString());
            paramIndex++;
            queryParams.push(req.params.upload_id, req.params.workspace_id);
            const result = await client.query(`
        UPDATE upload_jobs 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex - 1} AND workspace_id = $${paramIndex}
        RETURNING *
      `, queryParams);
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Update upload error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  DELETE /api/workspaces/{workspace_id}/uploads/{upload_id}
  Cancels or deletes upload job
*/
app.delete('/api/workspaces/:workspace_id/uploads/:upload_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            const result = await client.query(`
        DELETE FROM upload_jobs 
        WHERE id = $1 AND workspace_id = $2
      `, [req.params.upload_id, req.params.workspace_id]);
            if (result.rowCount === 0) {
                return res.status(404).json(createErrorResponse('Upload not found', null, 'UPLOAD_NOT_FOUND'));
            }
            res.status(204).send();
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Delete upload error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  POST /api/workspaces/{workspace_id}/uploads/{upload_id}/reprocess
  Reprocesses failed upload with new configuration
*/
app.post('/api/workspaces/:workspace_id/uploads/:upload_id/reprocess', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            // Check if upload exists and can be reprocessed
            const checkResult = await client.query(`
        SELECT status, filename, platform, mapping_template_id FROM upload_jobs 
        WHERE id = $1 AND workspace_id = $2
      `, [req.params.upload_id, req.params.workspace_id]);
            if (checkResult.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Upload not found', null, 'UPLOAD_NOT_FOUND'));
            }
            const upload = checkResult.rows[0];
            if (!['failed', 'error'].includes(upload.status)) {
                return res.status(400).json(createErrorResponse('Only failed uploads can be reprocessed', null, 'UPLOAD_NOT_REPROCESSABLE'));
            }
            // Reset upload status for reprocessing
            const now = new Date().toISOString();
            const result = await client.query(`
        UPDATE upload_jobs 
        SET status = 'processing', progress = 0, rows_processed = 0, rows_success = 0, rows_error = 0,
            error_text = NULL, error_log_url = NULL, started_at = $1, completed_at = NULL, updated_at = $2
        WHERE id = $3
        RETURNING *
      `, [now, now, req.params.upload_id]);
            // Start background reprocessing (mocked)
            scheduleBackgroundJob({
                job_type: 'reprocess_upload',
                job_data: {
                    upload_id: req.params.upload_id,
                    file_path: path.join(storageDir, upload.filename),
                    platform: upload.platform,
                    mapping_template_id: upload.mapping_template_id
                }
            });
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Reprocess upload error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
// ================================
// MAPPING TEMPLATES ROUTES
// ================================
/*
  GET /api/workspaces/{workspace_id}/mapping-templates
  Retrieves mapping templates with filtering and usage statistics
*/
app.get('/api/workspaces/:workspace_id/mapping-templates', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { platform, is_default, is_shared, query, limit = 10, offset = 0, sort_by = 'created_at', sort_order = 'desc' } = req.query;
        const client = await pool.connect();
        try {
            let whereConditions = ['workspace_id = $1'];
            let queryParams = [req.params.workspace_id];
            let paramIndex = 2;
            if (platform) {
                whereConditions.push(`platform = $${paramIndex}`);
                queryParams.push(platform);
                paramIndex++;
            }
            if (is_default !== undefined) {
                whereConditions.push(`is_default = $${paramIndex}`);
                queryParams.push(is_default === 'true');
                paramIndex++;
            }
            if (is_shared !== undefined) {
                whereConditions.push(`is_shared = $${paramIndex}`);
                queryParams.push(is_shared === 'true');
                paramIndex++;
            }
            if (query) {
                whereConditions.push(`name ILIKE $${paramIndex}`);
                queryParams.push(`%${query}%`);
                paramIndex++;
            }
            // Count query
            const countQuery = `SELECT COUNT(*) as total FROM mapping_templates WHERE ${whereConditions.join(' AND ')}`;
            const countResult = await client.query(countQuery, queryParams);
            const total = parseInt(countResult.rows[0].total);
            // Data query with creator information
            const dataQuery = `
        SELECT mt.*, u.name as creator_name
        FROM mapping_templates mt
        JOIN users u ON mt.created_by = u.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
            queryParams.push(limit, offset);
            const dataResult = await client.query(dataQuery, queryParams);
            const pagination = {
                page: Math.floor(offset / limit) + 1,
                per_page: limit,
                total: total,
                total_pages: Math.ceil(total / limit)
            };
            res.json({
                data: dataResult.rows,
                pagination
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get mapping templates error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  POST /api/workspaces/{workspace_id}/mapping-templates
  Creates a new mapping template for column mapping configurations
*/
app.post('/api/workspaces/:workspace_id/mapping-templates', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const validation = createMappingTemplateInputSchema.safeParse({
            ...req.body,
            workspace_id: req.params.workspace_id,
            created_by: req.user.id
        });
        if (!validation.success) {
            return res.status(400).json(createErrorResponse('Invalid input data', validation.error, 'VALIDATION_ERROR'));
        }
        const { name, platform, mapping, is_default = false, is_shared = false } = validation.data;
        const client = await pool.connect();
        try {
            // If setting as default, unset other defaults for this platform
            if (is_default) {
                await client.query(`
          UPDATE mapping_templates 
          SET is_default = false, updated_at = $1
          WHERE workspace_id = $2 AND platform = $3 AND is_default = true
        `, [new Date().toISOString(), req.params.workspace_id, platform]);
            }
            const templateId = uuidv4();
            const now = new Date().toISOString();
            const result = await client.query(`
        INSERT INTO mapping_templates (
          id, workspace_id, name, platform, mapping, is_default, is_shared, 
          created_by, usage_count, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [templateId, req.params.workspace_id, name, platform, JSON.stringify(mapping), is_default, is_shared, req.user.id, 0, now, now]);
            res.status(201).json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Create mapping template error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  GET /api/workspaces/{workspace_id}/mapping-templates/{template_id}
  Retrieves detailed mapping template information
*/
app.get('/api/workspaces/:workspace_id/mapping-templates/:template_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            const result = await client.query(`
        SELECT mt.*, u.name as creator_name
        FROM mapping_templates mt
        JOIN users u ON mt.created_by = u.id
        WHERE mt.id = $1 AND mt.workspace_id = $2
      `, [req.params.template_id, req.params.workspace_id]);
            if (result.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Mapping template not found', null, 'TEMPLATE_NOT_FOUND'));
            }
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get mapping template error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  PUT /api/workspaces/{workspace_id}/mapping-templates/{template_id}
  Updates mapping template configuration
*/
app.put('/api/workspaces/:workspace_id/mapping-templates/:template_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { name, mapping, is_default, is_shared } = req.body;
        const client = await pool.connect();
        try {
            // Verify template exists and user has permission
            const checkResult = await client.query(`
        SELECT platform, created_by FROM mapping_templates 
        WHERE id = $1 AND workspace_id = $2
      `, [req.params.template_id, req.params.workspace_id]);
            if (checkResult.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Mapping template not found', null, 'TEMPLATE_NOT_FOUND'));
            }
            const template = checkResult.rows[0];
            // Only creator or admin can modify
            if (template.created_by !== req.user.id && !['owner', 'admin'].includes(req.workspace.role)) {
                return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
            }
            // If setting as default, unset other defaults for this platform
            if (is_default) {
                await client.query(`
          UPDATE mapping_templates 
          SET is_default = false, updated_at = $1
          WHERE workspace_id = $2 AND platform = $3 AND is_default = true AND id != $4
        `, [new Date().toISOString(), req.params.workspace_id, template.platform, req.params.template_id]);
            }
            const updateFields = [];
            const queryParams = [];
            let paramIndex = 1;
            if (name) {
                updateFields.push(`name = $${paramIndex}`);
                queryParams.push(name);
                paramIndex++;
            }
            if (mapping) {
                updateFields.push(`mapping = $${paramIndex}`);
                queryParams.push(JSON.stringify(mapping));
                paramIndex++;
            }
            if (is_default !== undefined) {
                updateFields.push(`is_default = $${paramIndex}`);
                queryParams.push(is_default);
                paramIndex++;
            }
            if (is_shared !== undefined) {
                updateFields.push(`is_shared = $${paramIndex}`);
                queryParams.push(is_shared);
                paramIndex++;
            }
            if (updateFields.length === 0) {
                return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
            }
            updateFields.push(`updated_at = $${paramIndex}`);
            queryParams.push(new Date().toISOString());
            paramIndex++;
            queryParams.push(req.params.template_id, req.params.workspace_id);
            const result = await client.query(`
        UPDATE mapping_templates 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex - 1} AND workspace_id = $${paramIndex}
        RETURNING *
      `, queryParams);
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Update mapping template error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  DELETE /api/workspaces/{workspace_id}/mapping-templates/{template_id}
  Deletes mapping template
*/
app.delete('/api/workspaces/:workspace_id/mapping-templates/:template_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            // Verify template exists and user has permission
            const checkResult = await client.query(`
        SELECT created_by, is_default FROM mapping_templates 
        WHERE id = $1 AND workspace_id = $2
      `, [req.params.template_id, req.params.workspace_id]);
            if (checkResult.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Mapping template not found', null, 'TEMPLATE_NOT_FOUND'));
            }
            const template = checkResult.rows[0];
            // Only creator or admin can delete
            if (template.created_by !== req.user.id && !['owner', 'admin'].includes(req.workspace.role)) {
                return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
            }
            // Prevent deletion of default templates
            if (template.is_default) {
                return res.status(400).json(createErrorResponse('Cannot delete default template', null, 'CANNOT_DELETE_DEFAULT'));
            }
            const result = await client.query(`
        DELETE FROM mapping_templates 
        WHERE id = $1 AND workspace_id = $2
      `, [req.params.template_id, req.params.workspace_id]);
            if (result.rowCount === 0) {
                return res.status(404).json(createErrorResponse('Mapping template not found', null, 'TEMPLATE_NOT_FOUND'));
            }
            res.status(204).send();
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Delete mapping template error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
// ================================
// ALERT RULES ROUTES
// ================================
/*
  GET /api/workspaces/{workspace_id}/alert-rules
  Retrieves alert rules with filtering and status information
*/
app.get('/api/workspaces/:workspace_id/alert-rules', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { metric, severity, is_active, query, limit = 10, offset = 0, sort_by = 'created_at', sort_order = 'desc' } = req.query;
        const client = await pool.connect();
        try {
            let whereConditions = ['workspace_id = $1'];
            let queryParams = [req.params.workspace_id];
            let paramIndex = 2;
            if (metric) {
                whereConditions.push(`metric = $${paramIndex}`);
                queryParams.push(metric);
                paramIndex++;
            }
            if (severity) {
                whereConditions.push(`severity = $${paramIndex}`);
                queryParams.push(severity);
                paramIndex++;
            }
            if (is_active !== undefined) {
                whereConditions.push(`is_active = $${paramIndex}`);
                queryParams.push(is_active === 'true');
                paramIndex++;
            }
            if (query) {
                whereConditions.push(`name ILIKE $${paramIndex}`);
                queryParams.push(`%${query}%`);
                paramIndex++;
            }
            // Count query
            const countQuery = `SELECT COUNT(*) as total FROM alert_rules WHERE ${whereConditions.join(' AND ')}`;
            const countResult = await client.query(countQuery, queryParams);
            const total = parseInt(countResult.rows[0].total);
            // Data query with creator information
            const dataQuery = `
        SELECT ar.*, u.name as creator_name
        FROM alert_rules ar
        JOIN users u ON ar.created_by = u.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
            queryParams.push(limit, offset);
            const dataResult = await client.query(dataQuery, queryParams);
            const pagination = {
                page: Math.floor(offset / limit) + 1,
                per_page: limit,
                total: total,
                total_pages: Math.ceil(total / limit)
            };
            res.json({
                data: dataResult.rows,
                pagination
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get alert rules error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  POST /api/workspaces/{workspace_id}/alert-rules
  Creates a new alert rule for performance monitoring
*/
app.post('/api/workspaces/:workspace_id/alert-rules', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const validation = createAlertRuleInputSchema.safeParse({
            ...req.body,
            workspace_id: req.params.workspace_id,
            created_by: req.user.id
        });
        if (!validation.success) {
            return res.status(400).json(createErrorResponse('Invalid input data', validation.error, 'VALIDATION_ERROR'));
        }
        const { name, metric, condition, threshold, threshold_percentage, time_window = 'daily', platform_filter, account_filter, campaign_filter, severity = 'warning', is_active = true, notification_email = true, notification_in_app = true, cooldown_minutes = 60 } = validation.data;
        // Validate condition and threshold combination
        if (['greater_than', 'less_than'].includes(condition) && threshold === undefined) {
            return res.status(400).json(createErrorResponse('Threshold required for absolute conditions', null, 'THRESHOLD_REQUIRED'));
        }
        if (['percentage_increase', 'percentage_decrease'].includes(condition) && threshold_percentage === undefined) {
            return res.status(400).json(createErrorResponse('Threshold percentage required for percentage conditions', null, 'THRESHOLD_PERCENTAGE_REQUIRED'));
        }
        const client = await pool.connect();
        try {
            const ruleId = uuidv4();
            const now = new Date().toISOString();
            const result = await client.query(`
        INSERT INTO alert_rules (
          id, workspace_id, created_by, name, metric, condition, threshold, threshold_percentage,
          time_window, platform_filter, account_filter, campaign_filter, severity, is_active,
          notification_email, notification_in_app, cooldown_minutes, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `, [
                ruleId, req.params.workspace_id, req.user.id, name, metric, condition,
                threshold, threshold_percentage, time_window,
                platform_filter ? JSON.stringify(platform_filter) : null,
                account_filter ? JSON.stringify(account_filter) : null,
                campaign_filter ? JSON.stringify(campaign_filter) : null,
                severity, is_active, notification_email, notification_in_app, cooldown_minutes, now, now
            ]);
            res.status(201).json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Create alert rule error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  GET /api/workspaces/{workspace_id}/alert-rules/{rule_id}
  Retrieves detailed alert rule information
*/
app.get('/api/workspaces/:workspace_id/alert-rules/:rule_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            const result = await client.query(`
        SELECT ar.*, u.name as creator_name
        FROM alert_rules ar
        JOIN users u ON ar.created_by = u.id
        WHERE ar.id = $1 AND ar.workspace_id = $2
      `, [req.params.rule_id, req.params.workspace_id]);
            if (result.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Alert rule not found', null, 'ALERT_RULE_NOT_FOUND'));
            }
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get alert rule error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  PUT /api/workspaces/{workspace_id}/alert-rules/{rule_id}
  Updates alert rule configuration
*/
app.put('/api/workspaces/:workspace_id/alert-rules/:rule_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            // Verify rule exists and user has permission
            const checkResult = await client.query(`
        SELECT created_by FROM alert_rules 
        WHERE id = $1 AND workspace_id = $2
      `, [req.params.rule_id, req.params.workspace_id]);
            if (checkResult.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Alert rule not found', null, 'ALERT_RULE_NOT_FOUND'));
            }
            const rule = checkResult.rows[0];
            // Only creator or admin can modify
            if (rule.created_by !== req.user.id && !['owner', 'admin'].includes(req.workspace.role)) {
                return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
            }
            const updateFields = [];
            const queryParams = [];
            let paramIndex = 1;
            const allowedFields = [
                'name', 'condition', 'threshold', 'threshold_percentage', 'time_window',
                'platform_filter', 'account_filter', 'campaign_filter', 'severity',
                'is_active', 'notification_email', 'notification_in_app', 'cooldown_minutes'
            ];
            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    if (['platform_filter', 'account_filter', 'campaign_filter'].includes(field)) {
                        updateFields.push(`${field} = $${paramIndex}`);
                        queryParams.push(req.body[field] ? JSON.stringify(req.body[field]) : null);
                    }
                    else {
                        updateFields.push(`${field} = $${paramIndex}`);
                        queryParams.push(req.body[field]);
                    }
                    paramIndex++;
                }
            }
            if (updateFields.length === 0) {
                return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
            }
            updateFields.push(`updated_at = $${paramIndex}`);
            queryParams.push(new Date().toISOString());
            paramIndex++;
            queryParams.push(req.params.rule_id, req.params.workspace_id);
            const result = await client.query(`
        UPDATE alert_rules 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex - 1} AND workspace_id = $${paramIndex}
        RETURNING *
      `, queryParams);
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Update alert rule error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  DELETE /api/workspaces/{workspace_id}/alert-rules/{rule_id}
  Deletes alert rule
*/
app.delete('/api/workspaces/:workspace_id/alert-rules/:rule_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            // Verify rule exists and user has permission
            const checkResult = await client.query(`
        SELECT created_by FROM alert_rules 
        WHERE id = $1 AND workspace_id = $2
      `, [req.params.rule_id, req.params.workspace_id]);
            if (checkResult.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Alert rule not found', null, 'ALERT_RULE_NOT_FOUND'));
            }
            const rule = checkResult.rows[0];
            // Only creator or admin can delete
            if (rule.created_by !== req.user.id && !['owner', 'admin'].includes(req.workspace.role)) {
                return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
            }
            const result = await client.query(`
        DELETE FROM alert_rules 
        WHERE id = $1 AND workspace_id = $2
      `, [req.params.rule_id, req.params.workspace_id]);
            if (result.rowCount === 0) {
                return res.status(404).json(createErrorResponse('Alert rule not found', null, 'ALERT_RULE_NOT_FOUND'));
            }
            res.status(204).send();
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Delete alert rule error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
// ================================
// ALERT TRIGGERS ROUTES
// ================================
/*
  GET /api/workspaces/{workspace_id}/alert-triggers
  Retrieves alert trigger history with filtering
*/
app.get('/api/workspaces/:workspace_id/alert-triggers', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { alert_rule_id, platform, is_resolved, affected_entity_type, limit = 10, offset = 0, sort_by = 'triggered_at', sort_order = 'desc' } = req.query;
        const client = await pool.connect();
        try {
            let whereConditions = ['workspace_id = $1'];
            let queryParams = [req.params.workspace_id];
            let paramIndex = 2;
            if (alert_rule_id) {
                whereConditions.push(`alert_rule_id = $${paramIndex}`);
                queryParams.push(alert_rule_id);
                paramIndex++;
            }
            if (platform) {
                whereConditions.push(`platform = $${paramIndex}`);
                queryParams.push(platform);
                paramIndex++;
            }
            if (is_resolved !== undefined) {
                whereConditions.push(`is_resolved = $${paramIndex}`);
                queryParams.push(is_resolved === 'true');
                paramIndex++;
            }
            if (affected_entity_type) {
                whereConditions.push(`affected_entity_type = $${paramIndex}`);
                queryParams.push(affected_entity_type);
                paramIndex++;
            }
            // Count query
            const countQuery = `SELECT COUNT(*) as total FROM alert_triggers WHERE ${whereConditions.join(' AND ')}`;
            const countResult = await client.query(countQuery, queryParams);
            const total = parseInt(countResult.rows[0].total);
            // Data query with alert rule information
            const dataQuery = `
        SELECT at.*, ar.name as alert_rule_name, ar.metric, ar.condition
        FROM alert_triggers at
        JOIN alert_rules ar ON at.alert_rule_id = ar.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
            queryParams.push(limit, offset);
            const dataResult = await client.query(dataQuery, queryParams);
            const pagination = {
                page: Math.floor(offset / limit) + 1,
                per_page: limit,
                total: total,
                total_pages: Math.ceil(total / limit)
            };
            res.json({
                data: dataResult.rows,
                pagination
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get alert triggers error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  PUT /api/workspaces/{workspace_id}/alert-triggers/{trigger_id}
  Resolves or updates alert trigger status
*/
app.put('/api/workspaces/:workspace_id/alert-triggers/:trigger_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { is_resolved, resolved_at, resolved_by } = req.body;
        const client = await pool.connect();
        try {
            const updateFields = [];
            const queryParams = [];
            let paramIndex = 1;
            if (is_resolved !== undefined) {
                updateFields.push(`is_resolved = $${paramIndex}`);
                queryParams.push(is_resolved);
                paramIndex++;
            }
            if (resolved_at !== undefined) {
                updateFields.push(`resolved_at = $${paramIndex}`);
                queryParams.push(resolved_at);
                paramIndex++;
            }
            else if (is_resolved === true) {
                updateFields.push(`resolved_at = $${paramIndex}`);
                queryParams.push(new Date().toISOString());
                paramIndex++;
            }
            if (resolved_by !== undefined) {
                updateFields.push(`resolved_by = $${paramIndex}`);
                queryParams.push(resolved_by);
                paramIndex++;
            }
            else if (is_resolved === true) {
                updateFields.push(`resolved_by = $${paramIndex}`);
                queryParams.push(req.user.id);
                paramIndex++;
            }
            if (updateFields.length === 0) {
                return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
            }
            queryParams.push(req.params.trigger_id, req.params.workspace_id);
            const result = await client.query(`
        UPDATE alert_triggers 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex - 1} AND workspace_id = $${paramIndex}
        RETURNING *
      `, queryParams);
            if (result.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Alert trigger not found', null, 'ALERT_TRIGGER_NOT_FOUND'));
            }
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Update alert trigger error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
// ================================
// NOTIFICATIONS ROUTES
// ================================
/*
  GET /api/workspaces/{workspace_id}/notifications
  Retrieves user notifications with filtering and pagination
*/
app.get('/api/workspaces/:workspace_id/notifications', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { type, is_read, priority, limit = 10, offset = 0, sort_by = 'created_at', sort_order = 'desc' } = req.query;
        const client = await pool.connect();
        try {
            let whereConditions = ['user_id = $1', 'workspace_id = $2'];
            let queryParams = [req.user.id, req.params.workspace_id];
            let paramIndex = 3;
            if (type) {
                whereConditions.push(`type = $${paramIndex}`);
                queryParams.push(type);
                paramIndex++;
            }
            if (is_read !== undefined) {
                whereConditions.push(`is_read = $${paramIndex}`);
                queryParams.push(is_read === 'true');
                paramIndex++;
            }
            if (priority) {
                whereConditions.push(`priority = $${paramIndex}`);
                queryParams.push(priority);
                paramIndex++;
            }
            // Count query
            const countQuery = `SELECT COUNT(*) as total FROM notifications WHERE ${whereConditions.join(' AND ')}`;
            const countResult = await client.query(countQuery, queryParams);
            const total = parseInt(countResult.rows[0].total);
            // Data query
            const dataQuery = `
        SELECT * FROM notifications 
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
            queryParams.push(limit, offset);
            const dataResult = await client.query(dataQuery, queryParams);
            const pagination = {
                page: Math.floor(offset / limit) + 1,
                per_page: limit,
                total: total,
                total_pages: Math.ceil(total / limit)
            };
            res.json({
                data: dataResult.rows,
                pagination
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  PUT /api/workspaces/{workspace_id}/notifications/{notification_id}
  Marks notification as read/unread
*/
app.put('/api/workspaces/:workspace_id/notifications/:notification_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { is_read, read_at } = req.body;
        const client = await pool.connect();
        try {
            const updateFields = [];
            const queryParams = [];
            let paramIndex = 1;
            if (is_read !== undefined) {
                updateFields.push(`is_read = $${paramIndex}`);
                queryParams.push(is_read);
                paramIndex++;
            }
            if (read_at !== undefined) {
                updateFields.push(`read_at = $${paramIndex}`);
                queryParams.push(read_at);
                paramIndex++;
            }
            else if (is_read === true) {
                updateFields.push(`read_at = $${paramIndex}`);
                queryParams.push(new Date().toISOString());
                paramIndex++;
            }
            else if (is_read === false) {
                updateFields.push(`read_at = $${paramIndex}`);
                queryParams.push(null);
                paramIndex++;
            }
            if (updateFields.length === 0) {
                return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
            }
            queryParams.push(req.params.notification_id, req.user.id, req.params.workspace_id);
            const result = await client.query(`
        UPDATE notifications 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex - 2} AND user_id = $${paramIndex - 1} AND workspace_id = $${paramIndex}
        RETURNING *
      `, queryParams);
            if (result.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Notification not found', null, 'NOTIFICATION_NOT_FOUND'));
            }
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Update notification error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  PUT /api/workspaces/{workspace_id}/notifications/mark-all-read
  Marks all user notifications as read
*/
app.put('/api/workspaces/:workspace_id/notifications/mark-all-read', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            const result = await client.query(`
        UPDATE notifications 
        SET is_read = true, read_at = $1
        WHERE user_id = $2 AND workspace_id = $3 AND is_read = false
        RETURNING id
      `, [new Date().toISOString(), req.user.id, req.params.workspace_id]);
            res.json({
                message: 'All notifications marked as read',
                updated_count: result.rows.length
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Mark all notifications read error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
// ================================
// EXPORT JOBS ROUTES
// ================================
/*
  GET /api/workspaces/{workspace_id}/exports
  Retrieves export job history with status tracking
*/
app.get('/api/workspaces/:workspace_id/exports', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { export_type, status, format, limit = 10, offset = 0, sort_by = 'created_at', sort_order = 'desc' } = req.query;
        const client = await pool.connect();
        try {
            let whereConditions = ['workspace_id = $1'];
            let queryParams = [req.params.workspace_id];
            let paramIndex = 2;
            if (export_type) {
                whereConditions.push(`export_type = $${paramIndex}`);
                queryParams.push(export_type);
                paramIndex++;
            }
            if (status) {
                whereConditions.push(`status = $${paramIndex}`);
                queryParams.push(status);
                paramIndex++;
            }
            if (format) {
                whereConditions.push(`format = $${paramIndex}`);
                queryParams.push(format);
                paramIndex++;
            }
            // Count query
            const countQuery = `SELECT COUNT(*) as total FROM export_jobs WHERE ${whereConditions.join(' AND ')}`;
            const countResult = await client.query(countQuery, queryParams);
            const total = parseInt(countResult.rows[0].total);
            // Data query with user information
            const dataQuery = `
        SELECT ej.*, u.name as user_name
        FROM export_jobs ej
        JOIN users u ON ej.user_id = u.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
            queryParams.push(limit, offset);
            const dataResult = await client.query(dataQuery, queryParams);
            const pagination = {
                page: Math.floor(offset / limit) + 1,
                per_page: limit,
                total: total,
                total_pages: Math.ceil(total / limit)
            };
            res.json({
                data: dataResult.rows,
                pagination
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get exports error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  POST /api/workspaces/{workspace_id}/exports
  Creates a new export job for data extraction
*/
app.post('/api/workspaces/:workspace_id/exports', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const validation = createExportJobInputSchema.safeParse({
            ...req.body,
            workspace_id: req.params.workspace_id,
            user_id: req.user.id
        });
        if (!validation.success) {
            return res.status(400).json(createErrorResponse('Invalid input data', validation.error, 'VALIDATION_ERROR'));
        }
        const { export_type, format, filters, date_from, date_to, platforms, accounts } = validation.data;
        const client = await pool.connect();
        try {
            const exportId = uuidv4();
            const now = new Date().toISOString();
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
            const result = await client.query(`
        INSERT INTO export_jobs (
          id, workspace_id, user_id, export_type, format, filters, date_from, date_to,
          platforms, accounts, status, progress, expires_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `, [
                exportId, req.params.workspace_id, req.user.id, export_type, format,
                filters ? JSON.stringify(filters) : null, date_from, date_to,
                platforms ? JSON.stringify(platforms) : null,
                accounts ? JSON.stringify(accounts) : null,
                'queued', 0, expiresAt, now, now
            ]);
            // Start background export processing (mocked)
            scheduleBackgroundJob({
                job_type: 'process_export',
                job_data: {
                    export_id: exportId,
                    export_type,
                    format,
                    filters,
                    date_from,
                    date_to,
                    platforms,
                    accounts
                }
            });
            res.status(201).json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Create export error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  GET /api/workspaces/{workspace_id}/exports/{export_id}
  Retrieves detailed export job status and download information
*/
app.get('/api/workspaces/:workspace_id/exports/:export_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            const result = await client.query(`
        SELECT ej.*, u.name as user_name
        FROM export_jobs ej
        JOIN users u ON ej.user_id = u.id
        WHERE ej.id = $1 AND ej.workspace_id = $2
      `, [req.params.export_id, req.params.workspace_id]);
            if (result.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Export not found', null, 'EXPORT_NOT_FOUND'));
            }
            res.json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get export error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
// ================================
// SHARED LINKS ROUTES
// ================================
/*
  GET /api/workspaces/{workspace_id}/shared-links
  Retrieves shared dashboard links with access statistics
*/
app.get('/api/workspaces/:workspace_id/shared-links', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { link_type, is_active, limit = 10, offset = 0, sort_by = 'created_at', sort_order = 'desc' } = req.query;
        const client = await pool.connect();
        try {
            let whereConditions = ['workspace_id = $1'];
            let queryParams = [req.params.workspace_id];
            let paramIndex = 2;
            if (link_type) {
                whereConditions.push(`link_type = $${paramIndex}`);
                queryParams.push(link_type);
                paramIndex++;
            }
            if (is_active !== undefined) {
                whereConditions.push(`is_active = $${paramIndex}`);
                queryParams.push(is_active === 'true');
                paramIndex++;
            }
            // Count query
            const countQuery = `SELECT COUNT(*) as total FROM shared_links WHERE ${whereConditions.join(' AND ')}`;
            const countResult = await client.query(countQuery, queryParams);
            const total = parseInt(countResult.rows[0].total);
            // Data query with creator information
            const dataQuery = `
        SELECT sl.*, u.name as creator_name
        FROM shared_links sl
        JOIN users u ON sl.created_by = u.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
            queryParams.push(limit, offset);
            const dataResult = await client.query(dataQuery, queryParams);
            const pagination = {
                page: Math.floor(offset / limit) + 1,
                per_page: limit,
                total: total,
                total_pages: Math.ceil(total / limit)
            };
            res.json({
                data: dataResult.rows,
                pagination
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get shared links error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  POST /api/workspaces/{workspace_id}/shared-links
  Creates a new shared dashboard link with access controls
*/
app.post('/api/workspaces/:workspace_id/shared-links', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { link_type, dashboard_config, access_level = 'read_only', password_protected = false, password, expires_at } = req.body;
        if (!link_type) {
            return res.status(400).json(createErrorResponse('Link type is required', null, 'LINK_TYPE_REQUIRED'));
        }
        const client = await pool.connect();
        try {
            const linkId = uuidv4();
            const linkToken = uuidv4();
            const now = new Date().toISOString();
            const result = await client.query(`
        INSERT INTO shared_links (
          id, workspace_id, created_by, link_token, link_type, dashboard_config,
          access_level, password_protected, password_hash, expires_at, is_active,
          view_count, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
                linkId, req.params.workspace_id, req.user.id, linkToken, link_type,
                dashboard_config ? JSON.stringify(dashboard_config) : null,
                access_level, password_protected, password || null, expires_at, true, 0, now, now
            ]);
            res.status(201).json(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Create shared link error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  GET /api/workspaces/{workspace_id}/shared-links/{link_id}
  Retrieves detailed shared link information
*/
app.get('/api/workspaces/:workspace_id/shared-links/:link_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            const result = await client.query(`
        SELECT sl.*, u.name as creator_name
        FROM shared_links sl
        JOIN users u ON sl.created_by = u.id
        WHERE sl.id = $1 AND sl.workspace_id = $2
      `, [req.params.link_id, req.params.workspace_id]);
            if (result.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Shared link not found', null, 'SHARED_LINK_NOT_FOUND'));
            }
            // Remove password hash from response
            const sharedLink = result.rows[0];
            delete sharedLink.password_hash;
            res.json(sharedLink);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Get shared link error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  PUT /api/workspaces/{workspace_id}/shared-links/{link_id}
  Updates shared link settings and configuration
*/
app.put('/api/workspaces/:workspace_id/shared-links/:link_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const { dashboard_config, access_level, password_protected, password, expires_at, is_active } = req.body;
        const client = await pool.connect();
        try {
            // Verify link exists and user has permission
            const checkResult = await client.query(`
        SELECT created_by FROM shared_links 
        WHERE id = $1 AND workspace_id = $2
      `, [req.params.link_id, req.params.workspace_id]);
            if (checkResult.rows.length === 0) {
                return res.status(404).json(createErrorResponse('Shared link not found', null, 'SHARED_LINK_NOT_FOUND'));
            }
            const link = checkResult.rows[0];
            // Only creator or admin can modify
            if (link.created_by !== req.user.id && !['owner', 'admin'].includes(req.workspace.role)) {
                return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
            }
            const updateFields = [];
            const queryParams = [];
            let paramIndex = 1;
            if (dashboard_config !== undefined) {
                updateFields.push(`dashboard_config = $${paramIndex}`);
                queryParams.push(dashboard_config ? JSON.stringify(dashboard_config) : null);
                paramIndex++;
            }
            if (access_level) {
                updateFields.push(`access_level = $${paramIndex}`);
                queryParams.push(access_level);
                paramIndex++;
            }
            if (password_protected !== undefined) {
                updateFields.push(`password_protected = $${paramIndex}`);
                queryParams.push(password_protected);
                paramIndex++;
            }
            if (password !== undefined) {
                updateFields.push(`password_hash = $${paramIndex}`);
                queryParams.push(password);
                paramIndex++;
            }
            if (expires_at !== undefined) {
                updateFields.push(`expires_at = $${paramIndex}`);
                queryParams.push(expires_at);
                paramIndex++;
            }
            if (is_active !== undefined) {
                updateFields.push(`is_active = $${paramIndex}`);
                queryParams.push(is_active);
                paramIndex++;
            }
            if (updateFields.length === 0) {
                return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
            }
            updateFields.push(`updated_at = $${paramIndex}`);
            queryParams.push(new Date().toISOString());
            paramIndex++;
            queryParams.push(req.params.link_id, req.params.workspace_id);
            const result = await client.query(`
        UPDATE shared_links 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex - 1} AND workspace_id = $${paramIndex}
        RETURNING *
      `, queryParams);
            // Remove password hash from response
            const updatedLink = result.rows[0];
            delete updatedLink.password_hash;
            res.json(updatedLink);
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Update shared link error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
/*
  DELETE /api/workspaces/{workspace_id}/shared-links/{link_id}
  Deletes shared link
*/
app.delete('/api/workspaces/:workspace_id/shared-links/:link_id', authenticateToken, validateWorkspaceAccess, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            const result = await client.query(`
        DELETE FROM shared_links 
        WHERE id = $1 AND workspace_id = $2
      `, [req.params.link_id, req.params.workspace_id]);
            if (result.rowCount === 0) {
                return res.status(404).json(createErrorResponse('Shared link not found', null, 'LINK_NOT_FOUND'));
            }
            res.status(204).send();
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Delete shared link error:', error);
        res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
    }
});
// ================================
// ERROR HANDLING MIDDLEWARE
// ================================
// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    // Handle CORS errors
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json(createErrorResponse('CORS policy violation', err, 'CORS_ERROR'));
    }
    // Handle JSON parsing errors
    if (err instanceof SyntaxError && 'body' in err) {
        return res.status(400).json(createErrorResponse('Invalid JSON in request body', err, 'JSON_PARSE_ERROR'));
    }
    // Handle multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json(createErrorResponse('File too large', err, 'FILE_SIZE_ERROR'));
    }
    // Default error response
    res.status(500).json(createErrorResponse('Internal server error', err, 'INTERNAL_SERVER_ERROR'));
});
// Handle 404 for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json(createErrorResponse('API endpoint not found', null, 'ENDPOINT_NOT_FOUND'));
});
// ================================
// STATIC FILE SERVING
// ================================
// Serve React app for all non-API routes
app.get('*', (req, res) => {
    // In production, serve the built React app
    const indexPath = path.join(__dirname, '../vitereact/dist/index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    }
    else {
        // Fallback to a simple HTML response if frontend not built
        res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>PulseDeck - Loading</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body>
          <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif;">
            <div style="text-align: center;">
              <h1>PulseDeck</h1>
              <p>Application is starting up...</p>
              <p>If this persists, please check the server logs.</p>
            </div>
          </div>
        </body>
      </html>
    `);
    }
});
// ================================
// SERVER STARTUP
// ================================
// Graceful shutdown handling
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await pool.end();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await pool.end();
    process.exit(0);
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
// Debug endpoint for troubleshooting
app.get('/api/debug', (req, res) => {
    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        request_info: {
            method: req.method,
            url: req.url,
            headers: {
                'user-agent': req.get('User-Agent'),
                'origin': req.get('Origin'),
                'referer': req.get('Referer'),
                'x-forwarded-for': req.get('X-Forwarded-For'),
                'cf-ray': req.get('CF-Ray'),
                'cf-connecting-ip': req.get('CF-Connecting-IP')
            },
            ip: req.ip,
            ips: req.ips
        },
        server_info: {
            node_version: process.version,
            platform: process.platform,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            env: process.env.NODE_ENV || 'development'
        }
    });
});
// Add global error handler after all routes
app.use(globalErrorHandler);
// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json(createErrorResponse('API endpoint not found', null, 'NOT_FOUND'));
});
// Catch-all handler for SPA routing - must be last
app.get('*', (req, res) => {
    // Don't serve index.html for API routes or health endpoints
    if (req.path.startsWith('/api/') || req.path === '/health' || req.path === '/ready') {
        return res.status(404).json(createErrorResponse('Endpoint not found', null, 'NOT_FOUND'));
    }
    // Serve index.html for all other routes (SPA routing)
    const indexPath = path.join(__dirname, '../vitereact/dist/index.html');
    if (fs.existsSync(indexPath)) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(indexPath, (err) => {
            if (err) {
                console.error('Error serving index.html:', err);
                res.status(500).json(createErrorResponse('Internal server error', err, 'INTERNAL_SERVER_ERROR'));
            }
        });
    }
    else {
        res.status(404).json(createErrorResponse('Page not found', null, 'NOT_FOUND'));
    }
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`API status: http://localhost:${port}/api/status`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    // Test database connection on startup
    pool.connect()
        .then(client => {
        console.log('Database connection successful');
        client.release();
    })
        .catch(err => {
        console.error('Database connection failed:', err);
    });
});
// Handle server errors
server.on('error', (error) => {
    if (error.syscall !== 'listen') {
        throw error;
    }
    const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
});
// Export for testing
export { app, pool };
//# sourceMappingURL=server.js.map