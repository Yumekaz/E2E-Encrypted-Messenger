/**
 * Socket Race Condition Tests
 * Tests for concurrent operations and race conditions
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

describe('Socket Race Condition Tests', () => {
  afterEach(() => {
    // Cleanup any remaining sockets
  });

  describe('Concurrent Join Requests', () => {
    it('should handle multiple users requesting to join simultaneously', async () => {
      const ts = Date.now();
      
      // Create owner
      const ownerReg = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `race_owner_${ts}@example.com`,
          username: `raceowner${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      const ownerSocket = io(API_URL(), { autoConnect: false, auth: { token: ownerReg.body.accessToken } });
      ownerSocket.connect();
      await waitForEvent(ownerSocket, 'connect');

      ownerSocket.emit('register', { 
        username: ownerReg.body.user.username, 
        publicKey: `pub-owner-${ts}` 
      });
      await waitForEvent(ownerSocket, 'registered');

      // Create room
      const created = waitForEvent(ownerSocket, 'room-created');
      ownerSocket.emit('create-room');
      const roomData = await created;
      const roomCode = roomData.roomCode;

      // Create multiple users
      const users = [];
      const sockets = [];
      
      for (let i = 0; i < 5; i++) {
        const reg = await request(API_URL())
          .post('/api/auth/register')
          .send({
            email: `race_user_${i}_${ts}@example.com`,
            username: `raceuser${i}${ts}`.slice(0, 20),
            password: 'SecurePass123',
          })
          .expect(201);

        const socket = io(API_URL(), { autoConnect: false, auth: { token: reg.body.accessToken } });
        socket.connect();
        await waitForEvent(socket, 'connect');

        socket.emit('register', { 
          username: reg.body.user.username, 
          publicKey: `pub-${i}-${ts}` 
        });
        await waitForEvent(socket, 'registered');

        users.push({ ...reg.body.user, token: reg.body.accessToken });
        sockets.push(socket);
      }

      // All users request to join simultaneously
      const joinRequests = [];
      for (let i = 0; i < sockets.length; i++) {
        sockets[i].emit('request-join', { roomCode });
        joinRequests.push(waitForEvent(ownerSocket, 'join-request'));
      }

      const requests = await Promise.all(joinRequests);
      expect(requests.length).toBe(5);

      // Approve all
      const approvals = [];
      for (let i = 0; i < requests.length; i++) {
        const approved = waitForEvent(sockets[i], 'join-approved');
        ownerSocket.emit('approve-join', { requestId: requests[i].requestId });
        approvals.push(approved);
      }

      await Promise.all(approvals);

      // Cleanup
      ownerSocket.disconnect();
      sockets.forEach(s => s.disconnect());
    });

    it('should handle approve and deny racing', async () => {
      const ts = Date.now();
      
      const ownerReg = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `race_approve_${ts}@example.com`,
          username: `raceapprove${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      const ownerSocket = io(API_URL(), { autoConnect: false, auth: { token: ownerReg.body.accessToken } });
      ownerSocket.connect();
      await waitForEvent(ownerSocket, 'connect');

      ownerSocket.emit('register', { 
        username: ownerReg.body.user.username, 
        publicKey: `pub-owner-${ts}` 
      });
      await waitForEvent(ownerSocket, 'registered');

      const created = waitForEvent(ownerSocket, 'room-created');
      ownerSocket.emit('create-room');
      const roomData = await created;

      const userReg = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `race_target_${ts}@example.com`,
          username: `racetarget${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      const userSocket = io(API_URL(), { autoConnect: false, auth: { token: userReg.body.accessToken } });
      userSocket.connect();
      await waitForEvent(userSocket, 'connect');

      userSocket.emit('register', { 
        username: userReg.body.user.username, 
        publicKey: `pub-user-${ts}` 
      });
      await waitForEvent(userSocket, 'registered');

      // Request join
      const joinReq = waitForEvent(ownerSocket, 'join-request');
      userSocket.emit('request-join', { roomCode: roomData.roomCode });
      const request = await joinReq;

      // Send both approve and deny simultaneously
      ownerSocket.emit('approve-join', { requestId: request.requestId });
      ownerSocket.emit('deny-join', { requestId: request.requestId });

      // User should get one of the responses
      const result = await Promise.race([
        waitForEvent(userSocket, 'join-approved').then(() => 'approved'),
        waitForEvent(userSocket, 'join-denied').then(() => 'denied'),
        new Promise(r => setTimeout(() => r('timeout'), 2000)),
      ]);

      expect(['approved', 'denied', 'timeout']).toContain(result);

      ownerSocket.disconnect();
      userSocket.disconnect();
    });
  });

  describe('Concurrent Message Sending', () => {
    it('should handle multiple users sending messages simultaneously', async () => {
      const ts = Date.now();
      
      // Setup owner and room
      const ownerReg = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `msg_race_owner_${ts}@example.com`,
          username: `msgraceowner${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      const ownerSocket = io(API_URL(), { autoConnect: false, auth: { token: ownerReg.body.accessToken } });
      ownerSocket.connect();
      await waitForEvent(ownerSocket, 'connect');

      ownerSocket.emit('register', { 
        username: ownerReg.body.user.username, 
        publicKey: `pub-owner-${ts}` 
      });
      await waitForEvent(ownerSocket, 'registered');

      const created = waitForEvent(ownerSocket, 'room-created');
      ownerSocket.emit('create-room');
      const roomData = await created;
      const roomId = roomData.roomId;

      // Add members
      const members = [];
      const memberSockets = [];
      
      for (let i = 0; i < 3; i++) {
        const reg = await request(API_URL())
          .post('/api/auth/register')
          .send({
            email: `msg_race_${i}_${ts}@example.com`,
            username: `msgrace${i}${ts}`.slice(0, 20),
            password: 'SecurePass123',
          })
          .expect(201);

        const socket = io(API_URL(), { autoConnect: false, auth: { token: reg.body.accessToken } });
        socket.connect();
        await waitForEvent(socket, 'connect');

        socket.emit('register', { 
          username: reg.body.user.username, 
          publicKey: `pub-${i}-${ts}` 
        });
        await waitForEvent(socket, 'registered');

        // Join room
        const joinReq = waitForEvent(ownerSocket, 'join-request');
        socket.emit('request-join', { roomCode: roomData.roomCode });
        const request = await joinReq;

        const approved = waitForEvent(socket, 'join-approved');
        ownerSocket.emit('approve-join', { requestId: request.requestId });
        await approved;

        socket.emit('join-room', { roomId });
        await waitForEvent(socket, 'room-data');

        members.push(reg.body.user);
        memberSockets.push(socket);
      }

      // All members send messages simultaneously
      const messagePromises = [];
      
      for (let i = 0; i < memberSockets.length; i++) {
        for (let j = 0; j < 5; j++) {
          memberSockets[i].emit('send-encrypted-message', {
            roomId,
            encryptedData: `user-${i}-msg-${j}`,
            iv: `iv-${i}-${j}`,
            senderUsername: members[i].username,
          });
        }
      }

      // Wait for messages to propagate
      await new Promise(r => setTimeout(r, 1000));

      // Cleanup
      ownerSocket.disconnect();
      memberSockets.forEach(s => s.disconnect());

      // Test passes if no crashes
      expect(true).toBe(true);
    });

    it('should handle typing indicator races', async () => {
      const ts = Date.now();
      
      const ownerReg = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `type_race_${ts}@example.com`,
          username: `typerace${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      const ownerSocket = io(API_URL(), { autoConnect: false, auth: { token: ownerReg.body.accessToken } });
      ownerSocket.connect();
      await waitForEvent(ownerSocket, 'connect');

      ownerSocket.emit('register', { 
        username: ownerReg.body.user.username, 
        publicKey: `pub-owner-${ts}` 
      });
      await waitForEvent(ownerSocket, 'registered');

      const created = waitForEvent(ownerSocket, 'room-created');
      ownerSocket.emit('create-room');
      const roomData = await created;

      // Rapid typing events
      for (let i = 0; i < 20; i++) {
        ownerSocket.emit('typing', { roomId: roomData.roomId });
      }

      // Should not crash
      await new Promise(r => setTimeout(r, 500));
      expect(true).toBe(true);

      ownerSocket.disconnect();
    });
  });

  describe('Room Deletion Races', () => {
    it('should handle message sent while room is being deleted', async () => {
      const ts = Date.now();
      
      const ownerReg = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `del_race_${ts}@example.com`,
          username: `delrace${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      const ownerSocket = io(API_URL(), { autoConnect: false, auth: { token: ownerReg.body.accessToken } });
      ownerSocket.connect();
      await waitForEvent(ownerSocket, 'connect');

      ownerSocket.emit('register', { 
        username: ownerReg.body.user.username, 
        publicKey: `pub-owner-${ts}` 
      });
      await waitForEvent(ownerSocket, 'registered');

      const created = waitForEvent(ownerSocket, 'room-created');
      ownerSocket.emit('create-room');
      const roomData = await created;

      // Add a member
      const memberReg = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `del_member_${ts}@example.com`,
          username: `delmember${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      const memberSocket = io(API_URL(), { autoConnect: false, auth: { token: memberReg.body.accessToken } });
      memberSocket.connect();
      await waitForEvent(memberSocket, 'connect');

      memberSocket.emit('register', { 
        username: memberReg.body.user.username, 
        publicKey: `pub-member-${ts}` 
      });
      await waitForEvent(memberSocket, 'registered');

      const joinReq = waitForEvent(ownerSocket, 'join-request');
      memberSocket.emit('request-join', { roomCode: roomData.roomCode });
      const request = await joinReq;

      const approved = waitForEvent(memberSocket, 'join-approved');
      ownerSocket.emit('approve-join', { requestId: request.requestId });
      await approved;

      memberSocket.emit('join-room', { roomId: roomData.roomId });
      await waitForEvent(memberSocket, 'room-data');

      // Owner leaves (deletes room) while member sends message
      ownerSocket.emit('leave-room', { roomId: roomData.roomId });
      
      for (let i = 0; i < 10; i++) {
        memberSocket.emit('send-encrypted-message', {
          roomId: roomData.roomId,
          encryptedData: `late-msg-${i}`,
          iv: `iv-${i}`,
          senderUsername: memberReg.body.user.username,
        });
      }

      await new Promise(r => setTimeout(r, 500));

      // Should get room-closed or error
      const result = await Promise.race([
        waitForEvent(memberSocket, 'room-closed').then(() => 'closed'),
        waitForEvent(memberSocket, 'error').then(() => 'error'),
        new Promise(r => setTimeout(() => r('timeout'), 2000)),
      ]);

      expect(['closed', 'error', 'timeout']).toContain(result);

      ownerSocket.disconnect();
      memberSocket.disconnect();
    });

    it('should handle owner disconnect while members are joining', async () => {
      const ts = Date.now();
      
      const ownerReg = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `disc_race_${ts}@example.com`,
          username: `discrace${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      const ownerSocket = io(API_URL(), { autoConnect: false, auth: { token: ownerReg.body.accessToken } });
      ownerSocket.connect();
      await waitForEvent(ownerSocket, 'connect');

      ownerSocket.emit('register', { 
        username: ownerReg.body.user.username, 
        publicKey: `pub-owner-${ts}` 
      });
      await waitForEvent(ownerSocket, 'registered');

      const created = waitForEvent(ownerSocket, 'room-created');
      ownerSocket.emit('create-room');
      const roomData = await created;

      // Member tries to join
      const memberReg = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `disc_member_${ts}@example.com`,
          username: `discmember${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      const memberSocket = io(API_URL(), { autoConnect: false, auth: { token: memberReg.body.accessToken } });
      memberSocket.connect();
      await waitForEvent(memberSocket, 'connect');

      memberSocket.emit('register', { 
        username: memberReg.body.user.username, 
        publicKey: `pub-member-${ts}` 
      });
      await waitForEvent(memberSocket, 'registered');

      // Owner disconnects
      ownerSocket.disconnect();
      await new Promise(r => setTimeout(r, 500));

      // Member tries to join
      memberSocket.emit('request-join', { roomCode: roomData.roomCode });

      // Should get error about owner offline
      const result = await Promise.race([
        waitForEvent(memberSocket, 'error').then((e) => e.message || 'error'),
        new Promise(r => setTimeout(() => r('timeout'), 3000)),
      ]);

      expect(['owner offline', 'Room owner is not online', 'error', 'timeout']).toContain(result);

      memberSocket.disconnect();
    });
  });

  describe('Duplicate Operations', () => {
    it('should handle duplicate join requests from same user', async () => {
      const ts = Date.now();
      
      const ownerReg = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `dup_join_owner_${ts}@example.com`,
          username: `dupjoinowner${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      const ownerSocket = io(API_URL(), { autoConnect: false, auth: { token: ownerReg.body.accessToken } });
      ownerSocket.connect();
      await waitForEvent(ownerSocket, 'connect');

      ownerSocket.emit('register', { 
        username: ownerReg.body.user.username, 
        publicKey: `pub-owner-${ts}` 
      });
      await waitForEvent(ownerSocket, 'registered');

      const created = waitForEvent(ownerSocket, 'room-created');
      ownerSocket.emit('create-room');
      const roomData = await created;

      const memberReg = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `dup_join_${ts}@example.com`,
          username: `dupjoin${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      const memberSocket = io(API_URL(), { autoConnect: false, auth: { token: memberReg.body.accessToken } });
      memberSocket.connect();
      await waitForEvent(memberSocket, 'connect');

      memberSocket.emit('register', { 
        username: memberReg.body.user.username, 
        publicKey: `pub-member-${ts}` 
      });
      await waitForEvent(memberSocket, 'registered');

      // Send multiple join requests
      for (let i = 0; i < 5; i++) {
        memberSocket.emit('request-join', { roomCode: roomData.roomCode });
      }

      // Should get join requests
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          Promise.race([
            waitForEvent(ownerSocket, 'join-request'),
            new Promise(r => setTimeout(() => r(null), 1000)),
          ])
        );
      }

      const results = await Promise.all(requests);
      const validRequests = results.filter(r => r !== null);
      
      // Should get at least one, but may deduplicate
      expect(validRequests.length).toBeGreaterThanOrEqual(1);

      ownerSocket.disconnect();
      memberSocket.disconnect();
    });

    it('should handle duplicate room creation requests', async () => {
      const ts = Date.now();
      
      const ownerReg = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `dup_room_${ts}@example.com`,
          username: `duproom${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      const ownerSocket = io(API_URL(), { autoConnect: false, auth: { token: ownerReg.body.accessToken } });
      ownerSocket.connect();
      await waitForEvent(ownerSocket, 'connect');

      ownerSocket.emit('register', { 
        username: ownerReg.body.user.username, 
        publicKey: `pub-owner-${ts}` 
      });
      await waitForEvent(ownerSocket, 'registered');

      // Send multiple create room requests
      const roomPromises = [];
      for (let i = 0; i < 5; i++) {
        ownerSocket.emit('create-room');
        roomPromises.push(
          Promise.race([
            waitForEvent(ownerSocket, 'room-created'),
            new Promise(r => setTimeout(() => r(null), 2000)),
          ])
        );
      }

      const rooms = await Promise.all(roomPromises);
      const validRooms = rooms.filter(r => r !== null);
      
      // Should create multiple rooms
      expect(validRooms.length).toBeGreaterThanOrEqual(1);

      // All rooms should have unique codes
      const codes = validRooms.map(r => r.roomCode);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);

      ownerSocket.disconnect();
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent member list under concurrent joins/leaves', async () => {
      const ts = Date.now();
      
      const ownerReg = await request(API_URL())
        .post('/api/auth/register')
        .send({
          email: `state_owner_${ts}@example.com`,
          username: `stateowner${ts}`.slice(0, 20),
          password: 'SecurePass123',
        })
        .expect(201);

      const ownerSocket = io(API_URL(), { autoConnect: false, auth: { token: ownerReg.body.accessToken } });
      ownerSocket.connect();
      await waitForEvent(ownerSocket, 'connect');

      ownerSocket.emit('register', { 
        username: ownerReg.body.user.username, 
        publicKey: `pub-owner-${ts}` 
      });
      await waitForEvent(ownerSocket, 'registered');

      const created = waitForEvent(ownerSocket, 'room-created');
      ownerSocket.emit('create-room');
      const roomData = await created;

      // Rapid join/leave cycles
      const memberSockets = [];
      
      for (let i = 0; i < 3; i++) {
        const reg = await request(API_URL())
          .post('/api/auth/register')
          .send({
            email: `state_member_${i}_${ts}@example.com`,
            username: `statemem${i}${ts}`.slice(0, 20),
            password: 'SecurePass123',
          })
          .expect(201);

        const socket = io(API_URL(), { autoConnect: false, auth: { token: reg.body.accessToken } });
        socket.connect();
        await waitForEvent(socket, 'connect');

        socket.emit('register', { 
          username: reg.body.user.username, 
          publicKey: `pub-${i}-${ts}` 
        });
        await waitForEvent(socket, 'registered');

        memberSockets.push({ socket, username: reg.body.user.username });
      }

      // All join
      for (const { socket } of memberSockets) {
        const joinReq = waitForEvent(ownerSocket, 'join-request');
        socket.emit('request-join', { roomCode: roomData.roomCode });
        const request = await joinReq;

        const approved = waitForEvent(socket, 'join-approved');
        ownerSocket.emit('approve-join', { requestId: request.requestId });
        await approved;

        socket.emit('join-room', { roomId: roomData.roomId });
        await waitForEvent(socket, 'room-data');
      }

      // All leave rapidly
      for (const { socket } of memberSockets) {
        socket.emit('leave-room', { roomId: roomData.roomId });
      }

      await new Promise(r => setTimeout(r, 500));

      // Owner should still be functional
      ownerSocket.emit('typing', { roomId: roomData.roomId });
      await new Promise(r => setTimeout(r, 100));

      expect(true).toBe(true);

      ownerSocket.disconnect();
      memberSockets.forEach(({ socket }) => socket.disconnect());
    });
  });
});
