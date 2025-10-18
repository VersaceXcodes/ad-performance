import dotenv from "dotenv";
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
const { Pool } = pg;

dotenv.config();

const { DATABASE_URL, PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT = 5432 } = process.env;

const pool = new Pool(
  DATABASE_URL
    ? { 
        connectionString: DATABASE_URL, 
        ssl: { rejectUnauthorized: false } 
      }
    : {
        host: PGHOST,
        database: PGDATABASE,
        user: PGUSER,
        password: PGPASSWORD,
        port: Number(PGPORT),
        ssl: { rejectUnauthorized: false },
      }
);

async function seedDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Seeding database with test data...');
    
    // Check if test user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      ['versacecodes@gmail.com']
    );
    
    let userId;
    const now = new Date().toISOString();
    
    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      console.log('Test user already exists, updating password...');
      
      // Update the password
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3',
        ['Airplanes@99', now, userId]
      );
    } else {
      userId = uuidv4();
      console.log('Creating test user...');
      
      // Create test user with plain text password for development
      await client.query(`
        INSERT INTO users (id, email, name, password_hash, email_verified, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [userId, 'versacecodes@gmail.com', 'Guest User', 'Airplanes@99', true, now, now]);
      
      // Create default user preferences
      const prefsId = uuidv4();
      await client.query(`
        INSERT INTO user_preferences (id, user_id, email_notifications, in_app_notifications, email_frequency, reduced_motion, date_format, number_format, default_dashboard_view, theme_preference, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [prefsId, userId, true, true, 'immediate', false, 'YYYY-MM-DD', 'US', 'overview', 'dark', now, now]);
    }
    
    // Check if workspace exists
    const existingWorkspace = await client.query(
      'SELECT id FROM workspaces WHERE id = $1',
      ['workspace_001']
    );
    
    let workspaceId;
    
    if (existingWorkspace.rows.length > 0) {
      workspaceId = existingWorkspace.rows[0].id;
      console.log('Test workspace already exists');
    } else {
      workspaceId = 'workspace_001';
      console.log('Creating test workspace...');
      
      // Create test workspace
      await client.query(`
        INSERT INTO workspaces (id, name, owner_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [workspaceId, 'Test Workspace', userId, now, now]);
    }
    
    // Check if membership exists
    const existingMembership = await client.query(
      'SELECT id FROM memberships WHERE user_id = $1 AND workspace_id = $2',
      [userId, workspaceId]
    );
    
    if (existingMembership.rows.length === 0) {
      console.log('Creating workspace membership...');
      
      // Create workspace membership
      const membershipId = uuidv4();
      await client.query(`
        INSERT INTO memberships (id, workspace_id, user_id, role, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [membershipId, workspaceId, userId, 'owner', 'active', now, now]);
    } else {
      console.log('Workspace membership already exists');
    }
    
    await client.query('COMMIT');
    console.log('Database seeded successfully!');
    console.log('\nTest credentials:');
    console.log('Email: versacecodes@gmail.com');
    console.log('Password: Airplanes@99');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
