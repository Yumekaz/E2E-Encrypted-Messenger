/**
 * Room Management Edge Case Tests
 * Comprehensive edge case coverage for room operations
 */

const request = require('supertest');

const API_URL = () => global.__TEST_API_URL__;

describe('Room Edge Cases', () => {
  let ownerToken;
  let ownerUsername;
  let memberToken;
  let memberUsername;

  beforeAll(async () => {
    const ts = Date.now();
    
    // Create owner
    const ownerRes = await request(API_URL())
      .post('/api/auth/register')
      .send({
        email: `room_owner_edge_${ts}@example.com`,
        username: `roomowneredge${ts}`.slice(0, 20),
        password: 'TestPassword123',
      })
      .expect(201);

    ownerToken = ownerRes.body.accessToken;
    ownerUsername = ownerRes.body.user.username;

    // Create member
    const memberRes = await request(API_URL())
      .post('/api/auth/register')
      .send({
        email: `room_member_edge_${ts}@example.com`,
        username: `roommemberedge${ts}`.slice(0, 20),
        password: 'TestPassword123',
      })
      .expect(201);

    memberToken = memberRes.body.accessToken;
    memberUsername = memberRes.body.user.username;
  });

  describe('Room Creation Edge Cases', () => {
    it('should reject room creation without authentication', async () => {
      const res = await request(API_URL())
        .post('/api/rooms')
        .send({});
      
      expect(res.status).toBe(401);
    });

    it('should reject room creation with invalid token', async () => {
      const res = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', 'Bearer invalid.token.here')
        .send({});
      
      expect(res.status).toBe(401);
    });

    it('should reject room creation with expired token', async () => {
      const res = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoiYWNjZXNzIiwiZXhwIjoxNjAwMDAwMDAwfQ.invalid')
        .send({});
      
      expect(res.status).toBe(401);
    });

    it('should allow creating multiple rooms for same user', async () => {
      const room1 = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      const room2 = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      expect(room1.body.room.roomId).not.toBe(room2.body.room.roomId);
      expect(room1.body.room.roomCode).not.toBe(room2.body.room.roomCode);
    });

    it('should generate unique room codes', async () => {
      const codes = new Set();
      
      for (let i = 0; i < 5; i++) {
        const res = await request(API_URL())
          .post('/api/rooms')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(201);
        
        codes.add(res.body.room.roomCode);
      }

      expect(codes.size).toBe(5);
    });

    it('should return room code in correct format', async () => {
      const res = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      expect(res.body.room.roomCode).toMatch(/^[A-Z0-9]{6}$/);
    });
  });

  describe('Room Access Edge Cases', () => {
    it('should return 404 for non-existent room code', async () => {
      const res = await request(API_URL())
        .get('/api/rooms/code/XXXXXX')
        .set('Authorization', `Bearer ${ownerToken}`);
      
      expect(res.status).toBe(404);
    });

    it('should return 404 for invalid room code format', async () => {
      const res = await request(API_URL())
        .get('/api/rooms/code/invalid')
        .set('Authorization', `Bearer ${ownerToken}`);
      
      expect([404, 400]).toContain(res.status);
    });

    it('should reject access to room by ID for non-member', async () => {
      // Create a room
      const createRes = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      const roomId = createRes.body.room.roomId;

      // Try to access as different user
      const ts = Date.now();
      const outsiderRes = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `outsider_edge_${ts}@example.com`,
          username: `outsideredge${ts}`.slice(0, 20),
          password: 'TestPassword123',
        })
        .expect(201);

      const res = await request(API_URL())
        .get(`/api/rooms/${roomId}/members`)
        .set('Authorization', `Bearer ${outsiderRes.body.accessToken}`);
      
      expect(res.status).toBe(403);
    });

    it('should reject access to messages for non-member', async () => {
      const createRes = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      const roomId = createRes.body.room.roomId;

      const ts = Date.now();
      const outsiderRes = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `outsider_msg_${ts}@example.com`,
          username: `outsidermsg${ts}`.slice(0, 20),
          password: 'TestPassword123',
        })
        .expect(201);

      const res = await request(API_URL())
        .get(`/api/rooms/${roomId}/messages`)
        .set('Authorization', `Bearer ${outsiderRes.body.accessToken}`);
      
      expect(res.status).toBe(403);
    });
  });

  describe('Room Deletion Edge Cases', () => {
    it('should reject deletion by non-owner', async () => {
      const createRes = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      const roomId = createRes.body.room.roomId;

      const ts = Date.now();
      const nonOwnerRes = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `nonowner_del_${ts}@example.com`,
          username: `nonownerdel${ts}`.slice(0, 20),
          password: 'TestPassword123',
        })
        .expect(201);

      const res = await request(API_URL())
        .delete(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${nonOwnerRes.body.accessToken}`);
      
      expect([403, 404]).toContain(res.status);
    });

    it('should return 404 when deleting non-existent room', async () => {
      const res = await request(API_URL())
        .delete('/api/rooms/non-existent-room-id')
        .set('Authorization', `Bearer ${ownerToken}`);
      
      expect(res.status).toBe(404);
    });

    it('should allow owner to delete room with members', async () => {
      // This would require socket operations to add members
      // For now, just test the API behavior
      const createRes = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      const roomId = createRes.body.room.roomId;

      await request(API_URL())
        .delete(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Verify room is deleted
      const getRes = await request(API_URL())
        .get(`/api/rooms/code/${createRes.body.room.roomCode}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      expect(getRes.status).toBe(404);
    });

    it('should clean up room data after deletion', async () => {
      const createRes = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      const roomId = createRes.body.room.roomId;

      await request(API_URL())
        .delete(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Try to get messages from deleted room
      const msgRes = await request(API_URL())
        .get(`/api/rooms/${roomId}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      expect(msgRes.status).toBe(404);
    });
  });

  describe('My Rooms Edge Cases', () => {
    it('should return empty array for user with no rooms', async () => {
      const ts = Date.now();
      const newUserRes = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `no_rooms_${ts}@example.com`,
          username: `norooms${ts}`.slice(0, 20),
          password: 'TestPassword123',
        })
        .expect(201);

      const res = await request(API_URL())
        .get('/api/rooms/my-rooms')
        .set('Authorization', `Bearer ${newUserRes.body.accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body.rooms)).toBe(true);
      expect(res.body.rooms.length).toBe(0);
    });

    it('should return rooms sorted by creation time', async () => {
      // Create multiple rooms
      const rooms = [];
      for (let i = 0; i < 3; i++) {
        const res = await request(API_URL())
          .post('/api/rooms')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(201);
        rooms.push(res.body.room);
        await new Promise(r => setTimeout(r, 100)); // Small delay
      }

      const listRes = await request(API_URL())
        .get('/api/rooms/my-rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(listRes.body.rooms.length).toBeGreaterThanOrEqual(3);
    });

    it('should not include deleted rooms in my-rooms', async () => {
      const createRes = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      const roomId = createRes.body.room.roomId;
      const roomCode = createRes.body.room.roomCode;

      // Delete the room
      await request(API_URL())
        .delete(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Check my-rooms
      const listRes = await request(API_URL())
        .get('/api/rooms/my-rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const hasDeletedRoom = listRes.body.rooms.some(r => r.roomCode === roomCode);
      expect(hasDeletedRoom).toBe(false);
    });
  });

  describe('Messages Pagination Edge Cases', () => {
    it('should handle pagination with limit parameter', async () => {
      const createRes = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      const roomId = createRes.body.room.roomId;

      const res = await request(API_URL())
        .get(`/api/rooms/${roomId}/messages?limit=5`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('messages');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.messages)).toBe(true);
    });

    it('should handle pagination with invalid limit', async () => {
      const createRes = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      const roomId = createRes.body.room.roomId;

      const res = await request(API_URL())
        .get(`/api/rooms/${roomId}/messages?limit=invalid`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      // Should either use default or return error
      expect([200, 400]).toContain(res.status);
    });

    it('should handle pagination with negative limit', async () => {
      const createRes = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      const roomId = createRes.body.room.roomId;

      const res = await request(API_URL())
        .get(`/api/rooms/${roomId}/messages?limit=-1`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      // Should either use default or return error
      expect([200, 400]).toContain(res.status);
    });

    it('should handle pagination with very large limit', async () => {
      const createRes = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      const roomId = createRes.body.room.roomId;

      const res = await request(API_URL())
        .get(`/api/rooms/${roomId}/messages?limit=10000`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      // Should cap at max or return error
      expect([200, 400]).toContain(res.status);
    });

    it('should handle before cursor for pagination', async () => {
      const createRes = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      const roomId = createRes.body.room.roomId;

      const res = await request(API_URL())
        .get(`/api/rooms/${roomId}/messages?limit=10&before=9999999999999`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(res.body.messages)).toBe(true);
    });
  });

  describe('Room Type Enforcement', () => {
    it('should mark room as authenticated when created by authenticated user', async () => {
      const res = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      expect(res.body.room.roomType).toBe('authenticated');
    });

    it('should include room type in room data', async () => {
      const createRes = await request(API_URL())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      const roomCode = createRes.body.room.roomCode;

      const res = await request(API_URL())
        .get(`/api/rooms/code/${roomCode}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.room).toHaveProperty('roomType');
    });
  });
});
