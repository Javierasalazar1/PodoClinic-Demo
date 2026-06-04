import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index';

describe('Health Check API', () => {
  it('should return status ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
  });
});
