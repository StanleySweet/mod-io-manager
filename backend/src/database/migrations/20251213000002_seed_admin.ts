import type { Knex } from 'knex';
import crypto from 'crypto';
import argon2 from 'argon2';

export async function up(knex: Knex): Promise<void> {
  // Check if any admin user exists
  const existingAdmin = await knex('users').where({ role: 'admin' }).first();
  
  if (!existingAdmin) {
    // Default admin credentials
    const defaultEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123!@#';
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is required to create default admin account');
    }

    // Hash email
    const emailHash = crypto
      .createHmac('sha256', jwtSecret)
      .update(defaultEmail.toLowerCase())
      .digest('hex');

    // Hash password with Argon2
    const passwordHash = await argon2.hash(defaultPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Insert default admin user (without nickname; column may not exist yet)
    await knex('users').insert({
      email_hash: emailHash,
      password_hash: passwordHash,
      role: 'admin',
    });

    console.log('Default admin account created');
    console.log(`Email: ${defaultEmail}`);
    console.log(`Password: ${defaultPassword}`);
    console.log('⚠️  IMPORTANT: Change the default password after first login!');
  }
}

export async function down(knex: Knex): Promise<void> {
  // Don't automatically delete admin accounts on rollback
  // This is a safety measure
  void knex; // Suppress unused parameter warning
  console.log('Rollback: Admin accounts are not automatically deleted for safety');
}
