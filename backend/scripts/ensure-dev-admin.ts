/**
 * Creates or resets an admin account for local/staging use (the admin dashboard login).
 * Usage: set DEV_ADMIN_PASSWORD (min 8 chars), then from backend/: npm run ensure-dev-admin
 * Optional: DEV_ADMIN_EMAIL (default admin@rideguide.test), DEV_ADMIN_DISPLAY_NAME
 */
import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from '../src/config/db';
import { UserModel } from '../src/models/User';

const email = (process.env.DEV_ADMIN_EMAIL ?? 'admin@rideguide.test').toLowerCase().trim();
const password = process.env.DEV_ADMIN_PASSWORD;
const displayName = (process.env.DEV_ADMIN_DISPLAY_NAME ?? 'RideGuide Admin').trim() || 'RideGuide Admin';

async function main() {
  if (!password || password.length < 8) {
    console.error(
      'Set DEV_ADMIN_PASSWORD in the environment (min 8 characters), e.g.\n' +
        '  DEV_ADMIN_PASSWORD="your-password" npm run ensure-dev-admin'
    );
    process.exit(1);
  }

  await connectDb();
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await UserModel.findOne({ email });
  if (existing) {
    if (existing.role !== 'admin') {
      console.error(`User ${email} exists with role ${existing.role}; refusing to turn it into an admin.`);
      process.exit(1);
    }
    existing.passwordHash = passwordHash;
    existing.mustChangePassword = false;
    existing.status = 'active';
    await existing.save();
    console.log(`Reset password for admin ${email}`);
  } else {
    await UserModel.create({
      email,
      passwordHash,
      displayName,
      role: 'admin',
      providerVerificationStatus: 'none',
      status: 'active',
    });
    console.log(`Created admin ${email} (${displayName})`);
  }
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
