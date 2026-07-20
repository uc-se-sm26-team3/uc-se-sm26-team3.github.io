// This is the same format as we used in our personal labs. We're using Molly's server at the moment
// This is currently just the code for joining the chat, not making a new account
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

// This needs to change to a new cluster later
const uri = "mongodb+srv://mosermy:Laura2003@personalmessengerdb.zlad8ow.mongodb.net/?appName=PersonalMessengerDB";
const client = new MongoClient(uri);

async function connect (){
  await client.connect();
  console.log('Debug>messengerdb.js: connected to MongoDB server!');
}

let users = client.db('messenger').collection('users');

// Use-Case-03: Join Chat - credential check against MongoDB
const find = async (username, password)=>{
  let user = null;
  console. log(`Debug>messengerdb. js: find user '${username}'`); // password log is removed
  // Data layer independently re-validates type - defense in depth,
  // same NoSQL-injection guard as register(): reject non-string input
  if (typeof username !== 'string' || typeof password !== 'string') return null;
  // AC-03.3: look up by username only - password is never queryable directly, it's hashed
  user = await users.findOne({ username: username });
  if (!user) return null;
  // AC-03.3: compare the plaintext attempt against the stored bcrypt hash
  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) return null;
  return user;
}

// Create Account - insert a new user if username is free
// returns {success: true } or {success: fasle, message}
const create = async (username, password) => {
  console.log(`Debug>messengerdb.js: create user '${username}'`);

  // AC-05.4 - data layer re-validates format
  const usernamePattern = /^\w{3,20}$/;
  const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;
  if (!usernamePattern.test(username) || !passwordPattern.test(password)) {
    return { success: false, message: 'Invalid username or password format' };  //AC-05.8
  };

  //Check if username aleady exists
  const existing = await users.findOne({ username: username });
  if (existing) {
    return { success: false, message: 'Username already exists' };  //AC-05.8
  };

  //AC-05.6 - hash password before storing
  const hashedPassword = await bcrypt.hash(password, 10);
  await users.insertOne({ username: username, password: hashedPassword });
  return { success: true }; //AC-05.7
};


module.exports = { connect, find, create };
