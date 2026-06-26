// =============================================================================
// EECE/CS 3093C Software Engineering — Lab 1
// server.js — code skeleton provided by Phu Phung
// =============================================================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, 'ui')));

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log('Server running on port ' + PORT));

// In-memory store: socketId → username
const userlist = new Map();

io.on('connection', (socket) => {

  // Auto-assign a unique username from the socket ID
  const username = 'User_' + socket.id.slice(-5);
  socket.emit('username', username) //Send the user their assigned username
  userlist.set(socket.id, username);
  console.log('New client connected - socket ID: ' + socket.id)

  //UC-02 (AC-02.1): notify all connected clients that a new user joined
  io.emit('status', username +
    ' joined the chat. Number of connected clients: ' + userlist.size);
  io.emit('userlist', Array.from(userlist.values())); //Send the user the list of online users

  // ---------------------------------------------------------------------------
  // Use-Case-01: Send message
  //
  // AC-01.1: a username is always assigned on connection — every sender
  //          is identified before any message can be sent
  // AC-01.2: empty or non-string messages are ignored — no broadcast is sent
  // AC-01.3: the message is broadcast to ALL connected clients
  // AC-01.4: the broadcast payload includes the sender's username and the text
  // AC-01.5: input is cleared after sending (enforced client-side)
  // ---------------------------------------------------------------------------
  socket.on('message', (data) => {
    // AC-01.2: ignore empty messages
    if (!data || data.trim() === '') return;
    // AC-01.3 + AC-01.4: broadcast to all clients with sender username
    const sender = userlist.get(socket.id);
    console.log(`Debug> "${sender}" sent: ${data}`);
    io.emit('message', sender + ' says: ' + data.trim());
  });

  // ---------------------------------------------------------------------------
  // Use-Case-02: Receive message — disconnect notification
  //
  // AC-02.2: all connected clients are notified when a user leaves
  // ---------------------------------------------------------------------------
  socket.on('disconnect', () => {
    const username = userlist.get(socket.id);
    userlist.delete(socket.id);
    console.log('Client disconnected - socket ID: ' + socket.id);
    io.emit('status', username +
      ' left the chat. Number of connected clients: ' + userlist.size);
    io.emit('userlist', Array.from(userlist.values())); //Send new user list to all users
  });

  // Private messages
  socket.on('private-message', ({ username: username, message: message }) => {
    // AC-01.2: ignore empty messages
    if (!message || message.trim() === '') return;
    if (!username || username.trim() === '') return;
    // AC-01.3 + AC-01.4: broadcast to all clients with sender username
    const sender = userlist.get(socket.id);

    // Find recipient socket ID
    const recipientId = [...userlist.entries()]
      .find(([id, name]) => name === username)?.[0];

    if (!recipientId) {
      console.log(`User "${username}" not found.`);
      return;
    }

    console.log(`Debug> "${sender}" sent to ${username}: ${message}`);

    let data = {
      username: sender,
      message: sender + ' says: ' + message.trim()
    }

    // Send to both the recipient and sender
    io.to(recipientId).emit('private-message', data);
    io.to(socket.id).emit('private-message', data);
  });
});