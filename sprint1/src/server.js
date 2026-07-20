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
const messengerdb = require('./messengerdb');

// AC-02.6 (Security): CSP header — browser-level defense-in-depth
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; \
    script-src 'self' https://cdnjs.cloudflare.com https://code.jquery.com; \
    style-src 'self' 'unsafe-inline'; \
    connect-src 'self' https://cdnjs.cloudflare.com"
  );
  next();
});
app.use(express.static(path.join(__dirname, 'ui')));

const PORT = process.env.PORT || 8080;

(async () => {
  try {
    await messengerdb.connect();
    server.listen(PORT, () => console.log('Server running on port ' + PORT));
  } catch (err) {
    console.log('Error>server.js: failed to start — database connection error', err);
    process.exit(1); // fail fast — don't run a server that can't authenticate anyone
  }
})();

// In-memory store: socketId → username
const userlist = new Map();

// =============================================================
// Use-Case-04: Authorize User
// returns true if this connection was authenticated by Use-Case-03
// =============================================================
function authorizeUser(socket) {
  if (!socket || !socket.authenticated) 
    console.log('Connection has not been authenticated');
  return socket.authenticated === true;  
}
// =============================================================
// Helper: send an event only to authenticated connections
// Used by Use-Case-01 (Send Message) and Use-Case-03 (Join Chat)
// =============================================================
function sendToAuthenticatedClients(event, data) {
  userlist.forEach((_, sid) => {
    const s = io.sockets.sockets.get(sid);
    if (s && authorizeUser(s)) s.emit(event, data);
  });
}

io.on('connection', (socket) => {
  // AC-04 result: authentication state per connection
  socket.authenticated = false;   // AC-04
  console.log('New client connected - socket ID: ' + socket.id )


  // ===========================================================================
  // Use-Case-03: Join Chat
  // ===========================================================================
  socket.on('join', async function({ username, password}) {
    // AC-03.2: server0side structural validation
    if (!username || typeof username !== 'string' || 
        !password || typeof password !== 'string' ||
        username.trim().length === 0 || password.length === 0 ) {
      socket.emit('join-error', 'Invalid Request.');  // AC-03.4
      return;
    }
    username = username.trim();
    console.log(`Debug>UC-03: Joing Chat, server received username '${username}'`);
 
    const user = await messengerdb.find(username,password);
    console.log(username)
    if (!user) {
      // AC-03.3: generic message -doesn't say which field failed
      socket.emit('join-error', 'Invalid username or password'); // AC-03.4
      console.log(`Debug>UC-03: Join Chat - Invalid username '${username}'`);
      return;
    }
    socket.authenticated = true;
    userlist.set(socket.id, username);
    socket.emit('join-success', username);

    // UC-02 (AC-02.1): Notify all connected clients that a new user joined
    io.emit('status', username + ' joined the chat. Number of connected clients: ' + userlist.size);
    io.emit('user-list', Array.from(userlist.values()));
    io.to("logged-in").emit('status','<i style="color:grey">'+ username +
      ' joined the chat.</i> ');
    io.to("logged-in").emit('userlist', Array.from(userlist.values())); //Send the user the list of online users
  });

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
    const sender = userlist.get(socket.id);
    if (!sender) return; // User hasn't logged in yet

    // AC-01.2: ignore empty messages
    if (!data || data.trim() === '') return;
    // AC-01.3 + AC-01.4: broadcast to all clients with sender username -> public chat
    console.log(`Debug> "${sender}" sent: ${data}`);
    for (const [id, username] of userlist.entries()) {
        if (username === sender) {
            io.to(id).emit(
                "message",
                `<i style="color:green">You said:</i> ${data.trim()}`
            );
        } else {
            io.to(id).emit(
                "message",
                `<i style="color:blue">${sender} said:</i> ${data.trim()}`
            );
        }
    }
  });

  // ---------------------------------------------------------------------------
  // Use-Case-02: Receive message — disconnect notification
  //
  // AC-02.2: all connected clients are notified when a user leaves
  // ---------------------------------------------------------------------------
  socket.on('disconnect', () => {
    const username = userlist.get(socket.id);
    if (!username) return;
    userlist.delete(socket.id);
    console.log('Client disconnected - socket ID: ' + socket.id);
    io.to("logged-in").emit('status', '<i style="color:grey">' + username +
      ' left the chat.</i>');
    io.to("logged-in").emit('userlist', Array.from(userlist.values())); //Send new user list to all users
    socket.leave("logged-in");
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

    // This is the private chat
    let dataSender = {
      sender: sender,
      recipient: username,
      message: '<i style="color:green"> You said: </i>' + message.trim()
    }
    let dataRecipient = {
      sender: sender,
      recipient: username,
      message: '<i style="color:blue">'+ sender + ' says: </i>' + message.trim()
    }

    // Send to both the recipient and sender
    io.to(recipientId).emit('private-message', dataRecipient);
    io.to(socket.id).emit('private-message', dataSender);
  });

  // Use-Case-12: Create Account
  socket.on('create', async function({ username, password }) {
    if (!username || typeof username !== 'string' ||
        !password || typeof password !== 'string' ||
        username.trim().length === 0 || password. length === 0) { // AC-12.3
    socket.emit('create-error', 'Invalid request. '); // AC-12.8
    return;
    }
    username = username.trim();

    // server independently re-validates format - client can be bypassed
    const usernamePattern = /^\w{3,20}$/;
    const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;
    if (!usernamePattern. test(username) ) {
      socket. emit('create-error', 'Username must be 3-20 characters (letters, numbers, underscore).');
      return; // AC-12.8
    }
    if (!passwordPattern. test(password) ) {
      socket.emit('create-error', 'Password must be at least 6 characters with letters and numbers.');
      return; // AC-12.8
    }
  let result;
  try {
    result = await messengerdb.create(username, password);
  } catch (err) {
    socket.emit('create-error', 'Server error. Please try again.'); // AC-12.8
    return;
  }
  if (!result.success) {
    socket.emit('create-error', result.message); // AC-12.8
    return;
  }
  socket.emit('create-success', username); // AC-12.7: send the 'create-success' event to the client
  });
  socket.on('typing', () => {
    const sender = userlist.get(socket.id);
    data = {
      username: sender
    };
    socket.broadcast.emit('typing', data);
  });
});