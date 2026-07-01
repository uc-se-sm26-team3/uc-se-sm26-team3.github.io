/* =============================================================================
 * EECE/CS 3093C Software Engineering
 * client.js — code skeleton provided by Dr. Phu Phung
 * ===============================================================================
 */
var socket = io(); //connect to the Socket.io Server
export {socket};

socket.on("connect", () => { //connected to the server
  console.log(`Connected to Socket.io server: 
    ${socket.io.opts.hostname}, port: ${socket.io.opts.port}`);
});

/**
 * code blocks below have been implemented in Lecture 8
 */
// UI DOM references
var sendBtnElm = document.getElementById('send-button');
if(!sendBtnElm) {
    console.log("Error in getting 'send-button' button");
}
// AC-01.2 (UI): Send button click triggers sendMessage()
sendBtnElm.addEventListener('click', sendMessage);

var chatMessageInput = document.getElementById('chat-message');
if(!chatMessageInput) {
    console.log('Error in getting "chat-message" input');
}
// AC-01.2 (UI): pressing Enter also triggers sendMessage()
chatMessageInput.addEventListener('keypress', function(e) {
  if (e.key === 'Enter') sendMessage();
});

// =============================================================================
// Use-Case-01: Send Message
// =============================================================================

function sendMessage() {
    var message = chatMessageInput.value.trim();
    if (!message) return;   // AC-02.2: empty messages are ignored
    console.log(`Debug>Chat message: ${message}`); //for UI testing only
    socket.emit('message', message) // AC-01.3: when non-empty message is sent
    chatMessageInput.value = ''; // AC-01.5: clear input after sending
    chatMessageInput.focus();
}

// =============================================================================
// Use-Case-02: Receive message 
// =============================================================================

socket.on('message', displayMessage);
function displayMessage(data) {
    var d = document.createElement('div');
    // AC-02.2: shows timestamp for each message
    var timestamp = new Date().toLocaleTimeString();
    d.innerHTML = '[' + timestamp + '] ' + DOMPurify.sanitize(data); //AC-02.5: Messages are sanatized
    document.getElementById('responses').appendChild(d);
}

// AC-02.1: display system status events (join/leave) in the status area
socket.on('status', function(data) {
    var statusElm = document.getElementById('status');
    // AC-02.2: shows timestamp for each message
    var timestamp = new Date().toLocaleTimeString();
    statusElm.innerHTML = statusElm.innerHTML +
    '<br>[' + timestamp + '] ' + DOMPurify.sanitize(data);
    // AC-02.3 (UI): auto-scroll to the latest message
    statusElm.scrollTop = statusElm.scrollHeight;
});

// =============================================================================
// Use-Case-10: View Online Users
// =============================================================================
var myUsername = null;

socket.on("username", (username)=> {
    myUsername = username
    var welcome = document.getElementById('welcome')
    welcome.innerHTML = "Welcome " + DOMPurify.sanitize(myUsername);
})
//AC-10.1: Online users are displayed in a list, styling will be added separately
var onlineUserList = document.getElementById('online-users-list');
socket.on('userlist', function(data) {
    onlineUserList.innerHTML = '';
    for (var i = 0; i < data.length; i++) {
        if (data[i] === myUsername) continue;
        var li = document.createElement('li');
        li.innerHTML = DOMPurify.sanitize(data[i]); //AC-10.3: Usernames are sanatized
        onlineUserList.appendChild(li);
    }
});
// =============================================================================
// Use-Case-4: Login and create account
// =============================================================================
document.getElementById('joinBtn').addEventListener('click', joinChat);
function joinChat() {
    const username = document.getElementById('username').value;
    const pattern = /^\w{3,20}$/;
    if (!username || !pattern.test(username)) {
        alert("Username cannot be empty and must be between 3-20 characters long!");
        return;
    }
    document.getElementById('loginUI').style.display = 'none';
    document.getElementById('chatUI').style.display = '';
};