import request from 'supertest';
import { app, pool } from './server';
import jwt from 'jsonwebtoken';

// Test data constants
const TEST_USER = {
  email: 'test@example.com',
  name: 'Test User',
  password: 'password123'
};

const TEST_WORKSPACE = {
  name: 'Test Workspace',
  default_currency: 'USD',
  timezone: 'UTC',
  data_retention_days: 730
};

// Helper functions
const createTestUser = async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send(TEST_USER);
  return response.body;
};

const loginTestUser = async (email = TEST_USER.email, password = TEST_USER.password) => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return response.body;
};

const createTestWorkspace = async (token: string) => {
  const response = await request(app)
    .post('/api/workspaces')
    .set('Authorization', `Bearer ${token}`)
    .send(TEST_WORKSPACE);
  return response.body;
};

// Database setup and teardown
beforeAll(async () => {
  // Ensure test database is clean
  await pool.query('BEGIN');
});

afterAll(async () => {
  await pool.query('ROLLBACK');
  await pool.end();
});

beforeEach(async () => {
  // Create savepoint for each test
  await pool.query('SAVEPOINT test_savepoint');
});

afterEach(async () => {
  // Rollback to savepoint after each test
  await pool.query('ROLLBACK TO test_savepoint');
});

describe('Authentication Endpoints', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(TEST_USER)
        .expect(201);

      expect(response.body.user).toMatchObject({
        email: TEST_USER.email,
        name: TEST_USER.name,
        email_verified: false
      });
      expect(response.body.token).toBeDefined();
      expect(response.body.user.password_hash).toBeUndefined();
    });

    it('should reject registration with invalid email', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          ...TEST_USER,
          email: 'invalid-email'
        })
        .expect(400);
    });

    it('should reject registration with missing fields', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: TEST_USER.email
        })
        .expect(400);
    });

    it('should reject duplicate email registration', async () => {
      await createTestUser();
      
      await request(app)
        .post('/api/auth/register')
        .send(TEST_USER)
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await createTestUser();
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password
        })
        .expect(200);

      expect(response.body.user.email).toBe(TEST_USER.email);
      expect(response.body.token).toBeDefined();
    });

    it('should reject login with invalid password', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_USER.email,
          password: 'wrongpassword'
        })
        .expect(401);
    });

    it('should reject login with non-existent email', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: TEST_USER.password
        })
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const { token, user } = await loginTestUser();

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.email).toBe(user.email);
    });

    it('should reject request without token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      const { token } = await loginTestUser();

      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});

describe('Workspace Management', () => {
  let userToken: string;

  beforeEach(async () => {
    const authResponse = await loginTestUser();
    userToken = authResponse.token;
  });

  describe('POST /api/workspaces', () => {
    it('should create workspace successfully', async () => {
      const response = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${userToken}`)
        .send(TEST_WORKSPACE)
        .expect(201);

      expect(response.body.workspace).toMatchObject(TEST_WORKSPACE);
      expect(response.body.membership.role).toBe('owner');
    });

    it('should reject workspace creation without auth', async () => {
      await request(app)
        .post('/api/workspaces')
        .send(TEST_WORKSPACE)
        .expect(401);
    });

    it('should validate workspace name requirement', async () => {
      await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ...TEST_WORKSPACE,
          name: ''
        })
        .expect(400);
    });
  });

  describe('GET /api/workspaces', () => {
    beforeEach(async () => {
      await createTestWorkspace(userToken);
    });

    it('should return user workspaces', async () => {
      const response = await request(app)
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].workspace.name).toBe(TEST_WORKSPACE.name);
    });
  });

  describe('PUT /api/workspaces/:workspace_id', () => {
    let workspaceId: string;

    beforeEach(async () => {
      const workspace = await createTestWorkspace(userToken);
      workspaceId = workspace.workspace.id;
    });

    it('should update workspace settings', async () => {
      const updates = { name: 'Updated Workspace' };

      const response = await request(app)
        .put(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.name).toBe(updates.name);
    });

    it('should reject unauthorized workspace updates', async () => {
      const otherUser = await createTestUser();
      const otherUserAuth = await loginTestUser(otherUser.user.email, 'password123');

      await request(app)
        .put(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${otherUserAuth.token}`)
        .send({ name: 'Unauthorized Update' })
        .expect(403);
    });
  });
});

describe('Team Management', () => {
  let ownerToken: string;
  let workspaceId: string;

  beforeEach(async () => {
    const ownerAuth = await loginTestUser();
    ownerToken = ownerAuth.token;
    const workspace = await createTestWorkspace(ownerToken);
    workspaceId = workspace.workspace.id;
  });

  describe('POST /api/workspaces/:workspace_id/invitations', () => {
    it('should send invitation successfully', async () => {
      const invitation = {
        email: 'member@example.com',
        role: 'member'
      };

      const response = await request(app)
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(invitation)
        .expect(201);

      expect(response.body.email).toBe(invitation.email);
      expect(response.body.role).toBe(invitation.role);
      expect(response.body.status).toBe('pending');
    });

    it('should reject invitation from non-admin', async () => {
      // Create member user
      const memberUser = await createTestUser();
      const memberAuth = await loginTestUser(memberUser.user.email, 'password123');

      await request(app)
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .set('Authorization', `Bearer ${memberAuth.token}`)
        .send({
          email: 'newmember@example.com',
          role: 'member'
        })
        .expect(403);
    });
  });

  describe('GET /api/workspaces/:workspace_id/members', () => {
    it('should return workspace members', async () => {
      const response = await request(app)
        .get(`/api/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1); // Owner only
      expect(response.body[0].membership.role).toBe('owner');
    });
  });
});

describe('Account Management', () => {
  let userToken: string;
  let workspaceId: string;

  beforeEach(async () => {
    const authResponse = await loginTestUser();
    userToken = authResponse.token;
    const workspace = await createTestWorkspace(userToken);
    workspaceId = workspace.workspace.id;
  });

  describe('POST /api/workspaces/:workspace_id/accounts', () => {
    it('should create account successfully', async () => {
      const account = {
        platform: 'facebook',
        account_id: 'fb_123456',
        account_name: 'Test Facebook Account',
        currency: 'USD'
      };

      const response = await request(app)
        .post(`/api/workspaces/${workspaceId}/accounts`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(account)
        .expect(201);

      expect(response.body).toMatchObject(account);
    });

    it('should validate platform enum', async () => {
      await request(app)
        .post(`/api/workspaces/${workspaceId}/accounts`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          platform: 'invalid',
          account_id: 'test_123'
        })
        .expect(400);
    });
  });

  describe('GET /api/workspaces/:workspace_id/accounts', () => {
    beforeEach(async () => {
      // Create test accounts
      await request(app)
        .post(`/api/workspaces/${workspaceId}/accounts`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          platform: 'facebook',
          account_id: 'fb_123',
          account_name: 'Facebook Account'
        });

      await request(app)
        .post(`/api/workspaces/${workspaceId}/accounts`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          platform: 'google',
          account_id: 'ga_456',
          account_name: 'Google Account'
        });
    });

    it('should return all accounts', async () => {
      const response = await request(app)
        .get(`/api/workspaces/${workspaceId}/accounts`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(2);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter accounts by platform', async () => {
      const response = await request(app)
        .get(`/api/workspaces/${workspaceId}/accounts?platform=facebook`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].platform).toBe('facebook');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/workspaces/${workspaceId}/accounts?limit=1&offset=0`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.pagination.total).toBe(2);
    });
  });
});

describe('Analytics Endpoints', () => {
  let userToken: string;
  let workspaceId: string;
  let accountId: string;

  beforeEach(async () => {
    const authResponse = await loginTestUser();
    userToken = authResponse.token;
    const workspace = await createTestWorkspace(userToken);
    workspaceId = workspace.workspace.id;

    // Create test account
    const account = await request(app)
      .post(`/api/workspaces/${workspaceId}/accounts`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        platform: 'facebook',
        account_id: 'fb_test',
        account_name: 'Test Account'
      });
    accountId = account.body.id;

    // Insert test metrics data
    await pool.query(`
      INSERT INTO metrics_daily (
        id, date, platform, account_id, spend, impressions, clicks, conversions, revenue,
        created_at, updated_at
      ) VALUES 
      ('metric_test_1', '2024-01-15', 'facebook', $1, 100.50, 10000, 500, 25, 637.50, NOW(), NOW()),
      ('metric_test_2', '2024-01-16', 'facebook', $1, 150.75, 12000, 600, 30, 765.00, NOW(), NOW())
    `, [accountId]);
  });

  describe('GET /api/workspaces/:workspace_id/metrics/overview', () => {
    it('should return overview metrics', async () => {
      const response = await request(app)
        .get(`/api/workspaces/${workspaceId}/metrics/overview`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        spend: expect.any(Number),
        revenue: expect.any(Number),
        roas: expect.any(Number),
        cpa: expect.any(Number),
        ctr: expect.any(Number),
        cpm: expect.any(Number),
        cvr: expect.any(Number),
        mer: expect.any(Number),
        comparison: expect.any(Object),
        insights: expect.any(Array)
      });
    });

    it('should filter by date range', async () => {
      const response = await request(app)
        .get(`/api/workspaces/${workspaceId}/metrics/overview?date_from=2024-01-15&date_to=2024-01-15`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.spend).toBe(100.50);
    });

    it('should support comparison modes', async () => {
      const response = await request(app)
        .get(`/api/workspaces/${workspaceId}/metrics/overview?comparison_mode=vs_previous_period`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.comparison).toBeDefined();
    });
  });

  describe('GET /api/workspaces/:workspace_id/metrics/comparison', () => {
    it('should return platform comparison', async () => {
      const response = await request(app)
        .get(`/api/workspaces/${workspaceId}/metrics/comparison`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toMatchObject({
          platform: expect.any(String),
          spend: expect.any(Number),
          revenue: expect.any(Number),
          roas: expect.any(Number)
        });
      }
    });
  });

  describe('GET /api/workspaces/:workspace_id/metrics/daily', () => {
    it('should return daily metrics with pagination', async () => {
      const response = await request(app)
        .get(`/api/workspaces/${workspaceId}/metrics/daily`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter by platform', async () => {
      const response = await request(app)
        .get(`/api/workspaces/${workspaceId}/metrics/daily?platform=facebook`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      response.body.data.forEach((metric: any) => {
        expect(metric.platform).toBe('facebook');
      });
    });
  });
});

describe('Upload Management', () => {
  let userToken: string;
  let workspaceId: string;

  beforeEach(async () => {
    const authResponse = await loginTestUser();
    userToken = authResponse.token;
    const workspace = await createTestWorkspace(userToken);
    workspaceId = workspace.workspace.id;
  });

  describe('POST /api/workspaces/:workspace_id/uploads', () => {
    it('should create upload job successfully', async () => {
      const csvData = 'date,spend,impressions,clicks\n2024-01-15,100.50,10000,500';
      
      const response = await request(app)
        .post(`/api/workspaces/${workspaceId}/uploads`)
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', Buffer.from(csvData), 'test.csv')
        .field('platform', 'facebook')
        .expect(201);

      expect(response.body).toMatchObject({
        platform: 'facebook',
        status: 'queued',
        progress: 0
      });
    });

    it('should reject upload without file', async () => {
      await request(app)
        .post(`/api/workspaces/${workspaceId}/uploads`)
        .set('Authorization', `Bearer ${userToken}`)
        .field('platform', 'facebook')
        .expect(400);
    });

    it('should validate platform requirement', async () => {
      const csvData = 'date,spend\n2024-01-15,100';
      
      await request(app)
        .post(`/api/workspaces/${workspaceId}/uploads`)
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', Buffer.from(csvData), 'test.csv')
        .expect(400);
    });
  });

  describe('GET /api/workspaces/:workspace_id/uploads', () => {
    it('should return upload history', async () => {
      const response = await request(app)
        .get(`/api/workspaces/${workspaceId}/uploads`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get(`/api/workspaces/${workspaceId}/uploads?status_filter=completed`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      response.body.data.forEach((upload: any) => {
        expect(['completed'].includes(upload.status)).toBe(true);
      });
    });
  });
});

describe('Alert Rules', () => {
  let userToken: string;
  let workspaceId: string;

  beforeEach(async () => {
    const authResponse = await loginTestUser();
    userToken = authResponse.token;
    const workspace = await createTestWorkspace(userToken);
    workspaceId = workspace.workspace.id;
  });

  describe('POST /api/workspaces/:workspace_id/alert-rules', () => {
    it('should create alert rule successfully', async () => {
      const alertRule = {
        name: 'High CPA Alert',
        metric: 'cpa',
        condition: 'greater_than',
        threshold: 15.0,
        severity: 'warning'
      };

      const response = await request(app)
        .post(`/api/workspaces/${workspaceId}/alert-rules`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(alertRule)
        .expect(201);

      expect(response.body).toMatchObject(alertRule);
      expect(response.body.is_active).toBe(true);
    });

    it('should validate required fields', async () => {
      await request(app)
        .post(`/api/workspaces/${workspaceId}/alert-rules`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Incomplete Rule'
        })
        .expect(400);
    });

    it('should validate metric enum', async () => {
      await request(app)
        .post(`/api/workspaces/${workspaceId}/alert-rules`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Invalid Metric Rule',
          metric: 'invalid_metric',
          condition: 'greater_than',
          threshold: 10
        })
        .expect(400);
    });
  });

  describe('GET /api/workspaces/:workspace_id/alert-rules', () => {
    beforeEach(async () => {
      await request(app)
        .post(`/api/workspaces/${workspaceId}/alert-rules`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Test Alert',
          metric: 'roas',
          condition: 'less_than',
          threshold: 2.0,
          severity: 'critical'
        });
    });

    it('should return alert rules', async () => {
      const response = await request(app)
        .get(`/api/workspaces/${workspaceId}/alert-rules`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe('Test Alert');
    });

    it('should filter by metric', async () => {
      const response = await request(app)
        .get(`/api/workspaces/${workspaceId}/alert-rules?metric=roas`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      response.body.data.forEach((rule: any) => {
        expect(rule.metric).toBe('roas');
      });
    });
  });
});

describe('Notifications', () => {
  let userToken: string;
  let workspaceId: string;
  let userId: string;

  beforeEach(async () => {
    const authResponse = await loginTestUser();
    userToken = authResponse.token;
    userId = authResponse.user.id;
    const workspace = await createTestWorkspace(userToken);
    workspaceId = workspace.workspace.id;

    // Create test notification
    await pool.query(`
      INSERT INTO notifications (
        id, user_id, workspace_id, type, title, message, is_read, priority, created_at
      ) VALUES 
      ('notif_test_1', $1, $2, 'alert', 'Test Alert', 'Test message', false, 'high', NOW())
    `, [userId, workspaceId]);
  });

  describe('GET /api/workspaces/:workspace_id/notifications', () => {
    it('should return user notifications', async () => {
      const response = await request(app)
        .get(`/api/workspaces/${workspaceId}/notifications`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].title).toBe('Test Alert');
    });

    it('should filter by read status', async () => {
      const response = await request(app)
        .get(`/api/workspaces/${workspaceId}/notifications?is_read=false`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      response.body.data.forEach((notification: any) => {
        expect(notification.is_read).toBe(false);
      });
    });
  });

  describe('PUT /api/workspaces/:workspace_id/notifications/:notification_id', () => {
    it('should mark notification as read', async () => {
      const response = await request(app)
        .put(`/api/workspaces/${workspaceId}/notifications/notif_test_1`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .expect(200);

      expect(response.body.is_read).toBe(true);
    });
  });
});

describe('Creative Performance', () => {
  let userToken: string;
  let workspaceId: string;

  beforeEach(async () => {
    const authResponse = await loginTestUser();
    userToken = authResponse.token;
    const workspace = await createTestWorkspace(userToken);
    workspaceId = workspace.workspace.id;

    // Insert test creative performance data
    await pool.query(`
      INSERT INTO creative_performance (
        id, workspace_id, creative_name, platforms, total_spend, total_impressions,
        total_clicks, total_conversions, total_revenue, campaign_count,
        first_seen_date, last_seen_date, created_at, updated_at
      ) VALUES 
      ('creative_test_1', $1, 'Test Creative', '["facebook"]', 500.0, 50000, 2500, 125, 3125.0, 2, '2024-01-01', '2024-01-15', NOW(), NOW())
    `, [workspaceId]);
  });

  describe('GET /api/workspaces/:workspace_id/creatives', () => {
    it('should return creative performance data', async () => {
      const response = await request(app)
        .get(`/api/workspaces/${workspaceId}/creatives`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].creative_name).toBe('Test Creative');
    });

    it('should sort by total spend', async () => {
      const response = await request(app)
        .get(`/api/workspaces/${workspaceId}/creatives?sort_by=total_spend&sort_order=desc`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data[0].total_spend).toBe(500.0);
    });
  });
});

describe('Export Jobs', () => {
  let userToken: string;
  let workspaceId: string;

  beforeEach(async () => {
    const authResponse = await loginTestUser();
    userToken = authResponse.token;
    const workspace = await createTestWorkspace(userToken);
    workspaceId = workspace.workspace.id;
  });

  describe('POST /api/workspaces/:workspace_id/exports', () => {
    it('should create export job successfully', async () => {
      const exportJob = {
        export_type: 'metrics',
        format: 'csv',
        date_from: '2024-01-01',
        date_to: '2024-01-31'
      };

      const response = await request(app)
        .post(`/api/workspaces/${workspaceId}/exports`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(exportJob)
        .expect(201);

      expect(response.body).toMatchObject(exportJob);
      expect(response.body.status).toBe('queued');
    });

    it('should validate export type', async () => {
      await request(app)
        .post(`/api/workspaces/${workspaceId}/exports`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          export_type: 'invalid',
          format: 'csv'
        })
        .expect(400);
    });
  });
});

describe('Shared Links', () => {
  let userToken: string;
  let workspaceId: string;

  beforeEach(async () => {
    const authResponse = await loginTestUser();
    userToken = authResponse.token;
    const workspace = await createTestWorkspace(userToken);
    workspaceId = workspace.workspace.id;
  });

  describe('POST /api/workspaces/:workspace_id/shared-links', () => {
    it('should create shared link successfully', async () => {
      const sharedLink = {
        link_type: 'dashboard',
        access_level: 'read_only',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post(`/api/workspaces/${workspaceId}/shared-links`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(sharedLink)
        .expect(201);

      expect(response.body).toMatchObject(sharedLink);
      expect(response.body.link_token).toBeDefined();
    });
  });
});

describe('Error Handling', () => {
  let userToken: string;

  beforeEach(async () => {
    const authResponse = await loginTestUser();
    userToken = authResponse.token;
  });

  it('should handle non-existent workspace access', async () => {
    await request(app)
      .get('/api/workspaces/non-existent-id/accounts')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(404);
  });

  it('should handle malformed JSON', async () => {
    await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Content-Type', 'application/json')
      .send('{"invalid": json}')
      .expect(400);
  });

  it('should handle rate limiting', async () => {
    // Simulate rapid requests
    const promises = Array(10).fill(null).map(() =>
      request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
    );

    const responses = await Promise.all(promises);
    // At least some should succeed
    expect(responses.some(r => r.status === 200)).toBe(true);
  });
});

describe('Database Constraints', () => {
  let userToken: string;
  let workspaceId: string;

  beforeEach(async () => {
    const authResponse = await loginTestUser();
    userToken = authResponse.token;
    const workspace = await createTestWorkspace(userToken);
    workspaceId = workspace.workspace.id;
  });

  it('should enforce foreign key constraints', async () => {
    // Try to create campaign with non-existent account
    await expect(
      pool.query(`
        INSERT INTO campaigns (id, account_id, campaign_id, campaign_name, created_at, updated_at)
        VALUES ('test_campaign', 'non_existent_account', 'camp_123', 'Test', NOW(), NOW())
      `)
    ).rejects.toThrow();
  });

  it('should handle unique constraint violations', async () => {
    // Create an account
    await request(app)
      .post(`/api/workspaces/${workspaceId}/accounts`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        platform: 'facebook',
        account_id: 'fb_unique',
        account_name: 'Unique Account'
      });

    // Try to create duplicate
    await request(app)
      .post(`/api/workspaces/${workspaceId}/accounts`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        platform: 'facebook',
        account_id: 'fb_unique',
        account_name: 'Duplicate Account'
      })
      .expect(400);
  });
});

describe('Performance Tests', () => {
  let userToken: string;
  let workspaceId: string;

  beforeEach(async () => {
    const authResponse = await loginTestUser();
    userToken = authResponse.token;
    const workspace = await createTestWorkspace(userToken);
    workspaceId = workspace.workspace.id;
  });

  it('should handle large dataset queries efficiently', async () => {
    const startTime = Date.now();
    
    await request(app)
      .get(`/api/workspaces/${workspaceId}/metrics/daily?limit=1000`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    const endTime = Date.now();
    expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it('should handle pagination correctly with large offsets', async () => {
    const response = await request(app)
      .get(`/api/workspaces/${workspaceId}/accounts?limit=10&offset=100`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body.pagination.page).toBeDefined();
    expect(response.body.data.length).toBeLessThanOrEqual(10);
  });
});