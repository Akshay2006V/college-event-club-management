// server/config/db.js
// Owns the single MongoDB connection shared by all routes.
const { MongoClient } = require('mongodb');

let client = null;
let db = null;

async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('<username>')) {
    throw new Error(
      'MONGODB_URI is missing or still a placeholder. Copy .env.example to .env and paste your Atlas connection string.'
    );
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.DB_NAME || 'college_events');
  console.log(`Connected to MongoDB database: ${db.databaseName}`);
  return db;
}

function getDb() {
  if (!db) throw new Error('Database not connected yet. Call connect() first.');
  return db;
}

async function close() {
  if (client) await client.close();
}

module.exports = { connect, getDb, close };
