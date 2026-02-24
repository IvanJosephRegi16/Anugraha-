// database.js — Schema for Anugraha Kirloskar CRM
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'users.db'));

// 1. Users Table (Admin/Staff)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    fullname       TEXT    NOT NULL,
    email          TEXT    UNIQUE,
    phone          TEXT    UNIQUE,
    password_hash  TEXT    NOT NULL,
    role           TEXT    DEFAULT 'Staff', -- 'Admin' or 'Staff'
    otp            TEXT,
    otp_expires_at INTEGER,
    created_at     INTEGER DEFAULT (strftime('%s','now'))
  )
`);

// 2. Customers Table
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    phone          TEXT    NOT NULL UNIQUE,
    district       TEXT,
    created_at     INTEGER DEFAULT (strftime('%s','now'))
  )
`);

// 3. Calls Table (Interaction History)
db.exec(`
  CREATE TABLE IF NOT EXISTS calls (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id    INTEGER NOT NULL,
    call_date      TEXT    NOT NULL, -- YYYY-MM-DD
    status         TEXT    NOT NULL, -- Lead, Converted, Not Converted
    source         TEXT,             -- WhatsApp, Facebook, etc.
    product        TEXT,
    soil_type      TEXT,
    outcome        TEXT,             -- Interested, Call Later, etc.
    follow_up_date TEXT,             -- YYYY-MM-DD
    notes          TEXT,
    created_by     INTEGER,          -- User ID who added the call
    created_at     INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  )
`);

// 4. Settings Table (For manageable dropdowns)
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    category       TEXT    NOT NULL, -- 'product', 'source', 'district'
    value          TEXT    NOT NULL
  )
`);

// Seed default settings if empty
const settingsRow = db.prepare("SELECT count(*) as count FROM settings").get();
const settingsCount = settingsRow ? settingsRow.count : 0;
if (settingsCount === 0) {
    const insert = db.prepare("INSERT INTO settings (category, value) VALUES (?, ?)");

    // Products
    ['Kirloskar Pump', 'Silent Genset', 'Monoblock', 'Submersible'].forEach(v => insert.run('product', v));
    // Sources
    ['WhatsApp', 'Direct Call', 'Referral', 'Facebook', 'Instagram', 'Website', 'Other'].forEach(v => insert.run('source', v));
    // Districts
    ['District A', 'District B', 'District C'].forEach(v => insert.run('district', v));
}

console.log('✅ CRM Database Initialized (users.db)');

module.exports = db;
