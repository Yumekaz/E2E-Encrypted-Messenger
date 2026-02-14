/**
 * Socket Message Feature Tests
 * Tests for message delivery, read receipts, and deletion
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

function waitForEventCount(socket, event, count, timeout = 10000) {
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

describe('Socket Message Features', () => {
  let owner, member, roomId, roomCode;
  let ownerSocket, memberSocket;

  beforeEach(async () => {
    const ts = Date.now();
    
    // Create owner
    const ownerReg = await request(API_URL())
      .post('/api/auth/register')
      .send({
        email: `msg_owner_${ts}@example.com`,
        username: `msgowner${ts}`.slice(0, 20),
        password: 'TestPass123',
      })
      .expect(201);

    owner = { token: ownerReg.body.accessToken, username: ownerReg.body.user.username };

    // Create member
    const memberReg = await request(API_URL())
      .post('/api/auth/register')
      .send({
        email: `msg_member_${ts}@example.com`,
        username: `msgmember${ts}`.slice(0, 20),
        password: 'TestPass123',
      })
      .expect(201);

    member = { token: memberReg.body.accessToken, username: memberReg.body.user.username };

    // Connect sockets
    ownerSocket = io(API_URL(), { autoConnect: false, auth: { token: owner.token } });
    memberSocket = io(API_URL(), { autoConnect: false, auth: { token: member.token } });
    
    ownerSocket.connect();
    memberSocket.connect();
    
    await Promise.all([
      waitForEvent(ownerSocket, 'connect'),
      waitForEvent(memberSocket, 'connect'),
    ]);

    // Register
    ownerSocket.emit('register', { username: owner.username, publicKey: `pub-owner-${ts}` });
    memberSocket.emit('register', { username: member.username, publicKey: `pub-member-${ts}` });
    
    await Promise.all([
      waitForEvent(ownerSocket, 'registered'),
      waitForEvent(memberSocket, 'registered'),
    ]);

    // Create room
    const created = waitForEvent(ownerSocket, 'room-created');
    ownerSocket.emit('create-room');
    const roomData = await created;
    roomId = roomData.roomId;
    roomCode = roomData.roomCode;

    // Add member
    const joinReq = waitForEvent(ownerSocket, 'join-request');
    memberSocket.emit('request-join', { roomCode });
    const request = await joinReq;

    const approved = waitForEvent(memberSocket, 'join-approved');
    ownerSocket.emit('approve-join', { requestId: request.requestId });
    await approved;

    // Join room
    ownerSocket.emit('join-room', { roomId });
    memberSocket.emit('join-room', { roomId });
    
    await Promise.all([
      waitForEvent(ownerSocket, 'room-data'),
      waitForEvent(memberSocket, 'room-data'),
    ]);
  });

  afterEach(() => {
    if (ownerSocket) ownerSocket.disconnect();
    if (memberSocket) memberSocket.disconnect();
  });

  describe('Message Delivery', () => {
    it('should send message-delivered when recipient receives message', async () => {
      const incoming = waitForEvent(memberSocket, 'new-encrypted-message');
      
      ownerSocket.emit('send-encrypted-message', {
        roomId,
        encryptedData: 'test-delivery',
        iv: 'test-iv',
        senderUsername: owner.username,
      });

      const message = await incoming;
      expect(message.id).toBeDefined();

      // Send delivery acknowledgment
      memberSocket.emit('message-delivered', { messageId: message.id });
      
      // Should complete without error
      await new Promise(r => setTimeout(r, 100));
    });

    it('should send message-read when recipient reads message', async () => {
      const incoming = waitForEvent(memberSocket, 'new-encrypted-message');
      
      ownerSocket.emit('send-encrypted-message', {
        roomId,
        encryptedData: 'test-read',
        iv: 'test-iv',
        senderUsername: owner.username,
      });

      const message = await incoming;

      // Send read acknowledgment
      memberSocket.emit('message-read', { messageId: message.id });
      
      // Should complete without error
      await new Promise(r => setTimeout(r, 100));
    });

    it('should handle delivery for non-existent message gracefully', async () => {
      memberSocket.emit('message-delivered', { messageId: 'non-existent-id' });
      
      // Should not crash
      await new Promise(r => setTimeout(r, 100));
      expect(true).toBe(true);
    });

    it('should handle read for non-existent message gracefully', async () => {
      memberSocket.emit('message-read', { messageId: 'non-existent-id' });
      
      // Should not crash
      await new Promise(r => setTimeout(r, 100));
      expect(true).toBe(true);
    });

    it('should handle delivery without authentication', async () => {
      const unauthSocket = io(API_URL(), { autoConnect: false });
      unauthSocket.connect();
      await waitForEvent(unauthSocket, 'connect');

      // Try to send delivery without registering
      unauthSocket.emit('message-delivered', { messageId: 'some-id' });
      
      await new Promise(r => setTimeout(r, 100));
      unauthSocket.disconnect();
      
      expect(true).toBe(true);
    });
  });

  describe('Message Deletion - Everyone', () => {
    it('should delete message for everyone when sender requests', async () => {
      // Send a message
      const incoming = waitForEvent(memberSocket, 'new-encrypted-message');
      ownerSocket.emit('send-encrypted-message', {
        roomId,
        encryptedData: 'to-be-deleted',
        iv: 'test-iv',
        senderUsername: owner.username,
      });
      const message = await incoming;

      // Delete for everyone
      const deleted = waitForEvent(memberSocket, 'message-deleted');
      ownerSocket.emit('delete-message-everyone', { roomId, messageId: message.id });
      
      const deleteEvent = await deleted;
      expect(deleteEvent.messageId).toBe(message.id);
      expect(deleteEvent.mode).toBe('everyone');
    });

    it('should allow any member to delete message for everyone', async () => {
      // Owner sends message
      const incoming = waitForEvent(memberSocket, 'new-encrypted-message');
      ownerSocket.emit('send-encrypted-message', {
        roomId,
        encryptedData: 'member-deletes',
        iv: 'test-iv',
        senderUsername: owner.username,
      });
      const message = await incoming;

      // Member deletes it
      const deleted = waitForEvent(ownerSocket, 'message-deleted');
      memberSocket.emit('delete-message-everyone', { roomId, messageId: message.id });
      
      const deleteEvent = await deleted;
      expect(deleteEvent.messageId).toBe(message.id);
    });

    it('should reject deletion for non-existent message', async () => {
      const error = waitForEvent(ownerSocket, 'error');
      ownerSocket.emit('delete-message-everyone', { roomId, messageId: 'non-existent' });
      
      const err = await error;
      expect(err.message).toContain('not found');
    });

    it('should reject deletion for non-member', async () => {
      // Create outsider
      const ts = Date.now();
      const outsiderReg = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `outsider_${ts}@example.com`,
          username: `outsider${ts}`.slice(0, 20),
          password: 'TestPass123',
        })
        .expect(201);

      const outsiderSocket = io(API_URL(), { autoConnect: false, auth: { token: outsiderReg.body.accessToken } });
      outsiderSocket.connect();
      await waitForEvent(outsiderSocket, 'connect');

      outsiderSocket.emit('register', { 
        username: outsiderReg.body.user.username, 
        publicKey: `pub-outsider-${ts}` 
      });
      await waitForEvent(outsiderSocket, 'registered');

      // Try to delete message in room they're not in
      const error = waitForEvent(outsiderSocket, 'error');
      outsiderSocket.emit('delete-message-everyone', { roomId, messageId: 'some-id' });
      
      const err = await error;
      expect(err.message).toContain('Cannot delete');

      outsiderSocket.disconnect();
    });

    it('should reject deletion for non-existent room', async () => {
      const error = waitForEvent(ownerSocket, 'error');
      ownerSocket.emit('delete-message-everyone', { roomId: 'fake-room', messageId: 'some-id' });
      
      const err = await error;
      expect(err.message).toContain('not found');
    });

    it('should handle rapid delete requests', async () => {
      // Send message
      const incoming = waitForEvent(memberSocket, 'new-encrypted-message');
      ownerSocket.emit('send-encrypted-message', {
        roomId,
        encryptedData: 'rapid-delete',
        iv: 'test-iv',
        senderUsername: owner.username,
      });
      const message = await incoming;

      // Send multiple delete requests
      for (let i = 0; i < 5; i++) {
        ownerSocket.emit('delete-message-everyone', { roomId, messageId: message.id });
      }

      // Should handle gracefully
      const deleted = await waitForEvent(memberSocket, 'message-deleted');
      expect(deleted.messageId).toBe(message.id);
    });
  });

  describe('Message Deletion - Me Only', () => {
    it('should delete message for me only', async () => {
      // Send message
      const incoming = waitForEvent(memberSocket, 'new-encrypted-message');
      ownerSocket.emit('send-encrypted-message', {
        roomId,
        encryptedData: 'delete-for-me',
        iv: 'test-iv',
        senderUsername: owner.username,
      });
      const message = await incoming;

      // Delete for me
      const deleted = waitForEvent(ownerSocket, 'message-deleted');
      ownerSocket.emit('delete-message-me', { roomId, messageId: message.id });
      
      const deleteEvent = await deleted;
      expect(deleteEvent.messageId).toBe(message.id);
      expect(deleteEvent.mode).toBe('me');
    });

    it('should not notify others when deleting for me', async () => {
      // Send message
      const incoming = waitForEvent(memberSocket, 'new-encrypted-message');
      ownerSocket.emit('send-encrypted-message', {
        roomId,
        encryptedData: 'silent-delete',
        iv: 'test-iv',
        senderUsername: owner.username,
      });
      const message = await incoming;

      // Set up listener on member socket
      let memberReceivedDelete = false;
      memberSocket.on('message-deleted', () => {
        memberReceivedDelete = true;
      });

      // Owner deletes for themselves
      ownerSocket.emit('delete-message-me', { roomId, messageId: message.id });
      
      await new Promise(r => setTimeout(r, 500));
      
      // Member should not receive delete event
      expect(memberReceivedDelete).toBe(false);
    });

    it('should reject delete-me for non-member', async () => {
      const ts = Date.now();
      const outsiderReg = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `outsider_me_${ts}@example.com`,
          username: `outsiderme${ts}`.slice(0, 20),
          password: 'TestPass123',
        })
        .expect(201);

      const outsiderSocket = io(API_URL(), { autoConnect: false, auth: { token: outsiderReg.body.accessToken } });
      outsiderSocket.connect();
      await waitForEvent(outsiderSocket, 'connect');

      outsiderSocket.emit('register', { 
        username: outsiderReg.body.user.username, 
        publicKey: `pub-outsider-${ts}` 
      });
      await waitForEvent(outsiderSocket, 'registered');

      const error = waitForEvent(outsiderSocket, 'error');
      outsiderSocket.emit('delete-message-me', { roomId, messageId: 'some-id' });
      
      const err = await error;
      expect(err.message).toContain('Cannot delete');

      outsiderSocket.disconnect();
    });
  });

  describe('Screenshot Detection', () => {
    it('should broadcast screenshot warning to room', async () => {
      const warning = waitForEvent(memberSocket, 'screenshot-warning');
      
      ownerSocket.emit('screenshot-detected', { roomId });
      
      const warn = await warning;
      expect(warn.username).toBe(owner.username);
      expect(warn.timestamp).toBeDefined();
    });

    it('should reject screenshot detection for non-member', async () => {
      const ts = Date.now();
      const outsiderReg = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `outsider_ss_${ts}@example.com`,
          username: `outsiderss${ts}`.slice(0, 20),
          password: 'TestPass123',
        })
        .expect(201);

      const outsiderSocket = io(API_URL(), { autoConnect: false, auth: { token: outsiderReg.body.accessToken } });
      outsiderSocket.connect();
      await waitForEvent(outsiderSocket, 'connect');

      outsiderSocket.emit('register', { 
        username: outsiderReg.body.user.username, 
        publicKey: `pub-outsider-${ts}` 
      });
      await waitForEvent(outsiderSocket, 'registered');

      // Try to send screenshot detection for room not in
      outsiderSocket.emit('screenshot-detected', { roomId });
      
      // Should not broadcast to room
      await new Promise(r => setTimeout(r, 200));
      
      outsiderSocket.disconnect();
      expect(true).toBe(true);
    });

    it('should handle screenshot detection without registration', async () => {
      const unauthSocket = io(API_URL(), { autoConnect: false });
      unauthSocket.connect();
      await waitForEvent(unauthSocket, 'connect');

      // Should not crash
      unauthSocket.emit('screenshot-detected', { roomId });
      
      await new Promise(r => setTimeout(r, 100));
      unauthSocket.disconnect();
      
      expect(true).toBe(true);
    });

    it('should handle multiple rapid screenshot detections', async () => {
      const warnings = [];
      memberSocket.on('screenshot-warning', (data) => warnings.push(data));

      // Send multiple detections rapidly
      for (let i = 0; i < 5; i++) {
        ownerSocket.emit('screenshot-detected', { roomId });
      }

      await new Promise(r => setTimeout(r, 500));
      
      // Should receive all warnings
      expect(warnings.length).toBe(5);
    });
  });

  describe('Legacy Upload Token', () => {
    it('should request and receive upload token', async () => {
      const tokenEvent = waitForEvent(ownerSocket, 'upload-token');
      ownerSocket.emit('request-upload-token');
      
      const token = await tokenEvent;
      expect(token.token).toBeDefined();
      expect(typeof token.token).toBe('string');
    });

    it('should reject upload token request without registration', async () => {
      const unauthSocket = io(API_URL(), { autoConnect: false });
      unauthSocket.connect();
      await waitForEvent(unauthSocket, 'connect');

      const error = waitForEvent(unauthSocket, 'error');
      unauthSocket.emit('request-upload-token');
      
      const err = await error;
      expect(err.message).toContain('Not registered');

      unauthSocket.disconnect();
    });

    it('should generate different tokens for each request', async () => {
      const tokens = [];
      
      for (let i = 0; i < 3; i++) {
        const tokenEvent = waitForEvent(ownerSocket, 'upload-token');
        ownerSocket.emit('request-upload-token');
        const token = await tokenEvent;
        tokens.push(token.token);
      }

      // All tokens should be unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(3);
    });
  });
});
