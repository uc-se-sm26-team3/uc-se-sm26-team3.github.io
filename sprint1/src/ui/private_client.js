import {socket} from "./client.js";

// UI DOM references
var privateButton = document.getElementById('send-private-button');
var privateMessageInput = document.getElementById('private-message');
var privateUsernameInput = document.getElementById('private-username');

// Reference Validation
if (!privateButton) {
    console.log("Error in getting 'send-private-button' button");
}
if (!privateMessageInput) {
    console.log('Error in getting "private-message" input');
}
if (!privateUsernameInput) {
    console.log('Error in getting "private-username" input');
}

// AC-01.2 (UI): Send button click triggers sendMessage()
privateButton.addEventListener('click', sendPrivateMessage);

privateUsernameInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') privateMessageInput.focus();
});

// AC-01.2 (UI): pressing Enter also triggers sendMessage()
privateMessageInput.addEventListener('keypress', function (e) {
    var username = privateUsernameInput.value.trim();
    if (username) socket.emit('private-typing', username);
    if (e.key === 'Enter') sendPrivateMessage();
});

function sendPrivateMessage() {
    var message = privateMessageInput.value.trim();
    var username = privateUsernameInput.value.trim();
    if (!message) return;   // AC-02.2: empty messages are ignored
    if (!username) return;
    console.log(`Debug>Private message to ${username}: ${message}`); //for UI testing only
    socket.emit('private-message', { username: username, message: message }) // AC-01.3: when non-empty message is sent
    privateMessageInput.value = ''; // AC-01.5: clear input after sending
    privateMessageInput.focus();
}

// Display the user ID in the console
socket.on("connect", () => {
    console.log("Connected!");
    console.log(socket.connected);
    console.log(socket.id);
});

// Display private messages. They are red with italics.
socket.on('private-message', displayPrivateMessage);
function displayPrivateMessage({ username: username, message: message }) {
    var d = document.createElement('div');
    // AC-02.2: shows timestamp for each message
    var timestamp = new Date().toLocaleTimeString();
    d.innerHTML = '[' + timestamp + '] <i style="color:red">(PRIVATE)</i> ' + DOMPurify.sanitize(message);
    document.getElementById('responses').appendChild(d);
}

const typingUsers = new Set();
const typingTimeouts = new Map();

socket.on("private-typing", displayPrivateTyping);

function displayPrivateTyping({username}) {
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
    const $typing = $("#private-typing");

    // Remove the typing status element if there is nobody typing
    if (typingUsers.size === 0) {
        $typing.hide().text("");
        return;
    }

    const users = [...typingUsers];
    console.log(users)

    let message;

    switch (users.length) {
        case 1:
            message = `${users[0]} is typing a private message...`;
            break;
        case 2:
            message = `${users[0]} and ${users[1]} are typing private messages...`;
            break;
        case 3:
            message = `${users[0]}, ${users[1]}, and ${users[2]} are typing private messages...`;
            break;
        default:
            message = `${users[0]}, ${users[1]}, and ${users.length - 2} others are typing private messages...`;
    }

    $typing
        .show()
        .text(DOMPurify.sanitize(message));
}