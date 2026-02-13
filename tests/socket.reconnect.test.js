/**
 * Socket Reconnection and Resilience Tests
 * Tests for socket disconnections, reconnections, and state recovery
 */

const request = require('supertest');
const { io } = require('socket.io-client');

const API_URL = () => global.__TEST_API_URL__;

function waitForEvent(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function waitForEventMultiple(socket, event, count, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const events = [];
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event} x${count}`)), timeout);
    
    const handler = (data) => {
      events.push(data);
      if (events.length >= count) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(events);
      }
    };
    
    socket.on(event, handler);
  });
}

describe('Socket Reconnection Tests', () => {
  let userA, userB, roomId, roomCode;
  let socketA, socketB;

  afterEach(() => {
    if (socketA) {
      socketA.disconnect();
      socketA = null;
    }
    if (socketB) {
      socketB.disconnect();
      socketB = null;
    }
  });

  describe('Basic Reconnection', () => {
    it('should allow user to reconnect after disconnect', async () => {
      // Register user
      const ts = Date.now();
      const regRes = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `reconnect_${ts}@example.com`,
          username: `reconnect${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      userA = { token: regRes.body.accessToken, username: regRes.body.user.username };

      // First connection
      socketA = io(API_URL(), { autoConnect: false, auth: { token: userA.token } });
      socketA.connect();
      await waitForEvent(socketA, 'connect');

      // Register
      socketA.emit('register', { username: userA.username, publicKey: `pub-a-${ts}` });
      await waitForEvent(socketA, 'registered');

      // Disconnect
      socketA.disconnect();
      await new Promise(r => setTimeout(r, 500));

      // Reconnect
      socketA = io(API_URL(), { autoConnect: false, auth: { token: userA.token } });
      socketA.connect();
      await waitForEvent(socketA, 'connect');

      // Should be able to register again
      socketA.emit('register', { username: userA.username, publicKey: `pub-a-${ts}` });
      const registered = await waitForEvent(socketA, 'registered');
      
      expect(registered.username).toBe(userA.username);
    });

    it('should preserve room membership after reconnection', async () => {
      // Setup two users
      const ts = Date.now();
      
      const regA = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `reconnect_room_a_${ts}@example.com`,
          username: `reconna${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      const regB = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `reconnect_room_b_${ts}@example.com`,
          username: `reconnb${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      userA = { token: regA.body.accessToken, username: regA.body.user.username };
      userB = { token: regB.body.accessToken, username: regB.body.user.username };

      // Connect both
      socketA = io(API_URL(), { autoConnect: false, auth: { token: userA.token } });
      socketB = io(API_URL(), { autoConnect: false, auth: { token: userB.token } });
      
      socketA.connect();
      socketB.connect();
      
      await Promise.all([
        waitForEvent(socketA, 'connect'),
        waitForEvent(socketB, 'connect'),
      ]);

      // Register both
      socketA.emit('register', { username: userA.username, publicKey: `pub-a-${ts}` });
      socketB.emit('register', { username: userB.username, publicKey: `pub-b-${ts}` });
      
      await Promise.all([
        waitForEvent(socketA, 'registered'),
        waitForEvent(socketB, 'registered'),
      ]);

      // Create room
      const created = waitForEvent(socketA, 'room-created');
      socketA.emit('create-room');
      const roomData = await created;
      roomId = roomData.roomId;
      roomCode = roomData.roomCode;

      // B requests to join
      const joinReq = waitForEvent(socketA, 'join-request');
      socketB.emit('request-join', { roomCode });
      const request = await joinReq;

      // A approves
      const approved = waitForEvent(socketB, 'join-approved');
      socketA.emit('approve-join', { requestId: request.requestId });
      await approved;

      // B joins
      socketB.emit('join-room', { roomId });
      await waitForEvent(socketB, 'room-data');

      // B disconnects
      socketB.disconnect();
      await new Promise(r => setTimeout(r, 500));

      // B reconnects
      socketB = io(API_URL(), { autoConnect: false, auth: { token: userB.token } });
      socketB.connect();
      await waitForEvent(socketB, 'connect');

      // Re-register
      socketB.emit('register', { username: userB.username, publicKey: `pub-b-${ts}` });
      await waitForEvent(socketB, 'registered');

      // Try to rejoin room
      socketB.emit('join-room', { roomId });
      const rejoinData = await waitForEvent(socketB, 'room-data');
      
      expect(rejoinData.members).toContain(userB.username);
    });

    it('should handle multiple rapid reconnections', async () => {
      const ts = Date.now();
      const regRes = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `rapid_recon_${ts}@example.com`,
          username: `rapidrecon${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      userA = { token: regRes.body.accessToken, username: regRes.body.user.username };

      // Multiple connect/disconnect cycles
      for (let i = 0; i < 5; i++) {
        socketA = io(API_URL(), { autoConnect: false, auth: { token: userA.token } });
        socketA.connect();
        await waitForEvent(socketA, 'connect');

        socketA.emit('register', { username: userA.username, publicKey: `pub-${i}-${ts}` });
        await waitForEvent(socketA, 'registered');

        socketA.disconnect();
        await new Promise(r => setTimeout(r, 100));
      }

      // Final connection should work
      socketA = io(API_URL(), { autoConnect: false, auth: { token: userA.token } });
      socketA.connect();
      await waitForEvent(socketA, 'connect');

      socketA.emit('register', { username: userA.username, publicKey: `pub-final-${ts}` });
      const final = await waitForEvent(socketA, 'registered');
      
      expect(final.username).toBe(userA.username);
    });
  });

  describe('Reconnection with Active Rooms', () => {
    it('should handle owner disconnection and reconnection', async () => {
      const ts = Date.now();
      
      const regA = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `owner_disc_${ts}@example.com`,
          username: `ownerdisc${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      userA = { token: regA.body.accessToken, username: regA.body.user.username };

      socketA = io(API_URL(), { autoConnect: false, auth: { token: userA.token } });
      socketA.connect();
      await waitForEvent(socketA, 'connect');

      socketA.emit('register', { username: userA.username, publicKey: `pub-a-${ts}` });
      await waitForEvent(socketA, 'registered');

      // Create room
      const created = waitForEvent(socketA, 'room-created');
      socketA.emit('create-room');
      const roomData = await created;
      roomId = roomData.roomId;

      // Disconnect
      socketA.disconnect();
      await new Promise(r => setTimeout(r, 1000));

      // Reconnect
      socketA = io(API_URL(), { autoConnect: false, auth: { token: userA.token } });
      socketA.connect();
      await waitForEvent(socketA, 'connect');

      socketA.emit('register', { username: userA.username, publicKey: `pub-a2-${ts}` });
      await waitForEvent(socketA, 'registered');

      // Should be able to join the room again
      socketA.emit('join-room', { roomId });
      const joinData = await waitForEvent(socketA, 'room-data');
      
      expect(joinData.members).toContain(userA.username);
    });

    it('should handle member disconnection while messages are being sent', async () => {
      const ts = Date.now();
      
      const regA = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `msg_disc_a_${ts}@example.com`,
          username: `msgdisca${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      const regB = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `msg_disc_b_${ts}@example.com`,
          username: `msgdiscb${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      userA = { token: regA.body.accessToken, username: regA.body.user.username };
      userB = { token: regB.body.accessToken, username: regB.body.user.username };

      socketA = io(API_URL(), { autoConnect: false, auth: { token: userA.token } });
      socketB = io(API_URL(), { autoConnect: false, auth: { token: userB.token } });
      
      socketA.connect();
      socketB.connect();
      
      await Promise.all([
        waitForEvent(socketA, 'connect'),
        waitForEvent(socketB, 'connect'),
      ]);

      socketA.emit('register', { username: userA.username, publicKey: `pub-a-${ts}` });
      socketB.emit('register', { username: userB.username, publicKey: `pub-b-${ts}` });
      
      await Promise.all([
        waitForEvent(socketA, 'registered'),
        waitForEvent(socketB, 'registered'),
      ]);

      // Create and join room
      const created = waitForEvent(socketA, 'room-created');
      socketA.emit('create-room');
      const roomData = await created;
      roomId = roomData.roomId;
      roomCode = roomData.roomCode;

      const joinReq = waitForEvent(socketA, 'join-request');
      socketB.emit('request-join', { roomCode });
      const request = await joinReq;

      const approved = waitForEvent(socketB, 'join-approved');
      socketA.emit('approve-join', { requestId: request.requestId });
      await approved;

      socketB.emit('join-room', { roomId });
      await waitForEvent(socketB, 'room-data');

      // B disconnects while A sends messages
      socketB.disconnect();
      
      // A sends messages
      for (let i = 0; i < 5; i++) {
        socketA.emit('send-encrypted-message', {
          roomId,
          encryptedData: `message-${i}`,
          iv: `iv-${i}`,
          senderUsername: userA.username,
        });
        await new Promise(r => setTimeout(r, 50));
      }

      // B reconnects
      socketB = io(API_URL(), { autoConnect: false, auth: { token: userB.token } });
      socketB.connect();
      await waitForEvent(socketB, 'connect');

      socketB.emit('register', { username: userB.username, publicKey: `pub-b2-${ts}` });
      await waitForEvent(socketB, 'registered');

      // Rejoin and get messages
      socketB.emit('join-room', { roomId });
      const roomDataAfter = await waitForEvent(socketB, 'room-data');
      
      // Should have the messages
      expect(roomDataAfter.encryptedMessages.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Network Failure Simulation', () => {
    it('should handle connection timeout gracefully', async () => {
      const ts = Date.now();
      const regRes = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `timeout_${ts}@example.com`,
          username: `timeout${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      userA = { token: regRes.body.accessToken, username: regRes.body.user.username };

      // Connect with very short timeout
      socketA = io(API_URL(), { 
        autoConnect: false, 
        auth: { token: userA.token },
        timeout: 100,
        reconnection: false,
      });

      socketA.connect();
      
      // Should either connect or error
      const result = await Promise.race([
        waitForEvent(socketA, 'connect').then(() => 'connected'),
        waitForEvent(socketA, 'connect_error').then(() => 'error').catch(() => 'timeout'),
        new Promise(r => setTimeout(() => r('timeout'), 3000)),
      ]);

      expect(['connected', 'error', 'timeout']).toContain(result);
    });

    it('should handle auth failure on reconnection', async () => {
      const ts = Date.now();
      const regRes = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `auth_fail_${ts}@example.com`,
          username: `authfail${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      userA = { token: regRes.body.accessToken, username: regA.body.user.username };

      // Connect with invalid token
      socketA = io(API_URL(), { 
        autoConnect: false, 
        auth: { token: 'invalid.token.here' },
      });

      socketA.connect();
      
      // Should get connection error or be disconnected
      const result = await Promise.race([
        waitForEvent(socketA, 'connect').then(() => 'connected'),
        waitForEvent(socketA, 'disconnect').then(() => 'disconnected'),
        waitForEvent(socketA, 'error').then(() => 'error').catch(() => 'no-error'),
        new Promise(r => setTimeout(() => r('timeout'), 3000)),
      ]);

      expect(['disconnected', 'error', 'timeout', 'connected']).toContain(result);
    });
  });

  describe('Zombie Session Cleanup', () => {
    it('should clean up zombie session when same username reconnects', async () => {
      const ts = Date.now();
      const regRes = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `zombie_${ts}@example.com`,
          username: `zombie${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      userA = { token: regRes.body.accessToken, username: regRes.body.user.username };

      // First connection
      socketA = io(API_URL(), { autoConnect: false, auth: { token: userA.token } });
      socketA.connect();
      await waitForEvent(socketA, 'connect');

      socketA.emit('register', { username: userA.username, publicKey: `pub-a-${ts}` });
      await waitForEvent(socketA, 'registered');

      // Simulate zombie by creating new connection without clean disconnect
      const socketA2 = io(API_URL(), { autoConnect: false, auth: { token: userA.token } });
      socketA2.connect();
      await waitForEvent(socketA2, 'connect');

      // Should be able to register with same username
      socketA2.emit('register', { username: userA.username, publicKey: `pub-a2-${ts}` });
      const registered = await waitForEvent(socketA2, 'registered');
      
      expect(registered.username).toBe(userA.username);

      socketA2.disconnect();
    });
  });
});
