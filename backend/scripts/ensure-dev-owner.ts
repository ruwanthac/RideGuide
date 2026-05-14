/**
 * Creates or updates a vehicle-owner account for local/staging debugging.
 * Usage: set DEV_OWNER_PASSWORD (min 8 chars), then from backend/: npm run ensure-dev-owner
 * Optional: DEV_OWNER_EMAIL (default owner@example.com for local dev only), DEV_OWNER_DISPLAY_NAME
 */
import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from '../src/config/db';
import { UserModel } from '../src/models/User';

const email = (process.env.DEV_OWNER_EMAIL ?? 'owner@example.com').toLowerCase().trim();
const password = process.env.DEV_OWNER_PASSWORD;
const displayName = (process.env.DEV_OWNER_DISPLAY_NAME ?? 'Dev owner').trim() || 'Dev owner';

async function main() {
  if (!password || password.length < 8) {
    console.error(
      'Set DEV_OWNER_PASSWORD in the environment (min 8 characters), e.g.\n' +
        '  DEV_OWNER_PASSWORD="your-password" npm run ensure-dev-owner'
    );
    process.exit(1);
  }

  await connectDb();
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await UserModel.findOne({ email });
  if (existing) {
    if (existing.role !== 'owner') {
      console.error(`User ${email} exists with role ${existing.role}; refusing to change password.`);
      process.exit(1);
    }
    existing.passwordHash = passwordHash;
    existing.mustChangePassword = false;
    await existing.save();
    console.log(`Updated password for owner ${email}`);
  } else {
    await UserModel.create({
      email,
      passwordHash,
      displayName,
      role: 'owner',
      providerVerificationStatus: 'none',
    });
    console.log(`Created owner ${email} (${displayName})`);
  }
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
