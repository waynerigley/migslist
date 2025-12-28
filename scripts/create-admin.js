#!/usr/bin/env node
// Create the first super admin user
// Usage: node scripts/create-admin.js

require('dotenv').config();

const readline = require('readline');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function createAdmin() {
  try {
    console.log('\n=== Create Super Admin ===\n');

    const email = await question('Email: ');
    const password = await question('Password (min 8 chars): ');
    const firstName = await question('First Name (optional): ');
    const lastName = await question('Last Name (optional): ');

    if (!email || !password) {
      console.error('Email and password are required');
      process.exit(1);
    }

    if (password.length < 8) {
      console.error('Password must be at least 8 characters');
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, 'super_admin')`,
      [email.toLowerCase(), passwordHash, firstName || null, lastName || null]
    );

    console.log('\nSuper admin created successfully!');
    console.log(`Email: ${email}`);
    console.log('\nYou can now log in at http://localhost:3000');

  } catch (err) {
    if (err.code === '23505') {
      console.error('Error: Email already exists');
    } else {
      console.error('Error:', err.message);
    }
    process.exit(1);
  } finally {
    rl.close();
    await pool.end();
  }
}

createAdmin();
