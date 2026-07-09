/* =============================================================================
 * EECE/CS 3093C Software Engineering
 * client.js — combined public/private chat client
 * =============================================================================
 */

var socket = io(); //connect to the Socket.io Server
export { socket };

socket.on("connect", () => { //connected to the server
    console.log(`Connected to Socket.io server: 
    ${socket.io.opts.hostname}, port: ${socket.io.opts.port}`);
});
socket.emit('message', 'I am an unauthenticated attacker');


// =============================================================================
// UI DOM references
// =============================================================================

var sendBtnElm = document.getElementById('send-button');

if (!sendBtnElm) {
    console.log("Error in getting 'send-button' button");
}
// AC-01.2 (UI): Send button click triggers sendMessage()
sendBtnElm.addEventListener('click', sendMessage);


var chatMessageInput = document.getElementById('message-input');

if (!chatMessageInput) {
    console.log('Error in getting "message-input" input');
}

// AC-01.2 (UI): pressing Enter also triggers sendMessage()
chatMessageInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') sendMessage();
    else if (selectedUser) socket.emit('private-typing', selectedUser);
    else socket.emit('typing');
});

// =============================================================================
// Conversation State
// =============================================================================

var selectedUser = null;

// Stores messages separately
var conversations = {
    public: []
};

// =============================================================================
// Load Selected Conversation
// =============================================================================

function loadConversation() {
    var responses = document.getElementById('responses');
    responses.innerHTML = '';
    var chatKey = selectedUser ? selectedUser : "public";

    if (!conversations[chatKey]) {
        conversations[chatKey] = [];
    }

    conversations[chatKey].forEach(function(message) {
        responses.appendChild(message);
    });

    if (selectedUser) {
        var notification = document.querySelector(`[data-username="${DOMPurify.sanitize(selectedUser)}"]`);
        if (notification) {
            var redDot = notification.querySelector('.red-dot');
            if (redDot) {
                redDot.remove();
            }
        }
    }
}

// =============================================================================
// Use-Case-01: Send Message
// =============================================================================

function sendMessage() {

    var message = chatMessageInput.value.trim();

    if (!message) return;   // AC-02.2: empty messages are ignored

    if (selectedUser) {
        // AC-01.3: when non-empty message is sent
        socket.emit('private-message', {
            username: selectedUser,
            message: message
        });
        loadConversation();
    }
    else {
        socket.emit('message', message); // AC-01.3: when non-empty message is sent
    }

    chatMessageInput.value = ''; // AC-01.5: clear input after sending
    chatMessageInput.focus();
}


// =============================================================================
// Use-Case-02: Receive message 
// =============================================================================

// =============================================================================
// Receive Public Messages
// =============================================================================

socket.on('message', displayMessage);
function displayMessage(data) {
    var d = document.createElement('div');
    // AC-02.2: shows timestamp for each message
    var timestamp = new Date().toLocaleTimeString();
    d.innerHTML = '<i style="color:grey">[' + timestamp + ']</i> ' + DOMPurify.sanitize(data); //AC-02.5: Messages are sanatized
    conversations.public.push(d);
    if (!selectedUser) {
        loadConversation();
    }
}

// =============================================================================
// Receive Private Messages
// =============================================================================

socket.on('private-message', ({ sender, recipient, message }) => {

    // Determine which conversation this belongs to
    let conversation;
    if (sender === myUsername) {
        // I sent the message, so store it under the recipient
        conversation = recipient;
    } else {
        // Someone sent it to me, so store it under the sender
        conversation = sender;
    }

    if (!conversations[conversation]) {
        conversations[conversation] = [];
    }

    var d = document.createElement('div');
    var timestamp = new Date().toLocaleTimeString();
    d.innerHTML = '<i style="color:grey">[' + timestamp + ']</i> ' + DOMPurify.sanitize(message);
    conversations[conversation].push(d);
    if (selectedUser === conversation) {
        loadConversation();
    } else {
        addNotification(conversation);
    }
});

var unreadChats = {};
function addNotification(username) {
    unreadChats[username] = true;
    var notification = document.querySelector(`[data-username="${DOMPurify.sanitize(username)}"]`);
    if (!notification) return;
    var redDot = notification.querySelector('.red-dot');
    if (redDot) return;
    redDot = document.createElement("span");
    redDot.classList.add("red-dot");
    notification.insertAdjacentElement("afterbegin", redDot);
}

// =============================================================================
// System Status
// =============================================================================
// AC-02.1: display system status events (join/leave) in the status area
socket.on('status', function(data) {
    displayMessage(data);
});

// =============================================================================
// Login
// =============================================================================

var myUsername = null;

socket.on("username", ({ success, message }) => {
    if (!success) {
        alert(message);
        return;
    }
    myUsername = message;
    var welcome = document.getElementById('welcome')
    welcome.innerHTML = "Welcome " + DOMPurify.sanitize(myUsername);
    document.getElementById('loginUI').style.display = 'none';
    document.getElementById('chatUI').style.display = '';
});

// =============================================================================
// Use-Case-10: View Online Users
// =============================================================================

//AC-10.1: Online users are displayed in a list, styling will be added separately
var onlineUserList = document.getElementById('online-users-list');
var onlineUserCount = document.getElementById('online-users-count');
socket.on('userlist', function(data) {
    onlineUserList.innerHTML = '';

    // Remove private chat history for users who are no longer online
    Object.keys(conversations).forEach(function (chat) {
        if (chat === "public") return;
        
        if (!data.includes(chat)) {
            delete conversations[chat];
            delete unreadChats[chat];

            // If the user we were chatting with left, return to General Chat
            if (selectedUser === chat) {
                selectedUser = null;
                document.getElementById('conversation-header').textContent = "# General Chat";
                loadConversation();
            }
        }
    });
    
    // General Chat
    var general = document.createElement('li');
    general.id = "general-chat";
    general.textContent = "# General Chat";
    general.addEventListener('click', function() {
        selectedUser = null;
        document.getElementById('conversation-header').textContent =
            "# General Chat";
        loadConversation();
    });
    onlineUserList.appendChild(general);

    for (var i = 0; i < data.length; i++) {
        if (data[i] === myUsername) continue;
        var li = document.createElement('li');
        li.textContent = DOMPurify.sanitize(data[i]);
        li.dataset.username = data[i];
        li.addEventListener('click', function() {
            selectedUser = this.dataset.username;
            if (!conversations[selectedUser]) {
                conversations[selectedUser] = [];
            }
            document.getElementById('conversation-header').textContent = selectedUser;
            loadConversation();
        });
        onlineUserList.appendChild(li);
        if (unreadChats[data[i]]) {
            addNotification(data[i]);
        }
    }
    if (data.length <= 1) {
        onlineUserCount.textContent = data.length + " online user";
    } else {
        onlineUserCount.textContent = data.length + " online users";
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
    socket.emit('username', username)
};

const typingUsers = new Set();
const typingTimeouts = new Map();

socket.on("typing", displayTyping);
socket.on("private-typing", displayTyping);

function displayTyping({ username }) {
    typingUsers.add(username); //Add the user to a typing status

    // Reset this user's timeout
    if (typingTimeouts.has(username)) {
        clearTimeout(typingTimeouts.get(username));
    }

    // Set a new timeout to delete the user from the typing status
    typingTimeouts.set(username, setTimeout(() => {
            typingUsers.delete(username);
            typingTimeouts.delete(username);
            updateTypingDisplay();
    }, 1000));

    updateTypingDisplay();
}

function updateTypingDisplay() {
    const $typing = $("#typing");

    // Remove the typing status element if there is nobody typing
    if (typingUsers.size === 0) {
        $typing.hide().text("");
        return;
    }

    const users = [...typingUsers];
    console.log(users)

    let message;

    if (users.length === 1) {
        message = `${users[0]} is typing...`;
    }
    else {
        message = `${users.join(", ")} are typing...`;
    }

    $typing
        .show()
        .text(DOMPurify.sanitize(message));
}
