import http from 'node:http';
import './config/env.js';
import { Server } from 'socket.io';
import app from './app.js';
import { socketCorsOptions } from './config/cors.js';
import { connectMongo } from './config/db.js';
import { connectRedis } from './config/redis.js';
import { registerSockets } from './sockets/index.js';

const port = process.env.PORT || 8080;
const server = http.createServer(app);
const io = new Server(server, {
  cors: socketCorsOptions
});

app.set('io', io);
registerSockets(io);

async function seedAdminUser() {
  const email = 'vikul93065@gmail.com';
  try {
    const User = (await import('./models/User.js')).default;
    const { supabaseAdmin } = await import('./config/supabase.js');

    let user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      if (user.role !== 'admin') {
        user.role = 'admin';
        user.isVerified = true;
        await user.save();
        console.log(`[Seed] Updated user @${user.username} to ADMIN.`);
      }
      return;
    }

    console.log(`[Seed] User ${email} not found in MongoDB. Checking Supabase Auth...`);
    if (!supabaseAdmin) {
      console.warn('[Seed] Supabase admin client not initialized. Cannot seed admin.');
      return;
    }

    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error(`[Seed] Failed to list Supabase users: ${listError.message}`);
      return;
    }

    let supabaseUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    let supabaseId;
    const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'VikulAdmin123!';

    if (supabaseUser) {
      supabaseId = supabaseUser.id;
      console.log(`[Seed] User found in Supabase Auth. ID: ${supabaseId}. Updating password to ensure seed access...`);
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(supabaseId, {
        password: adminPassword
      });
      if (updateError) {
        console.error(`[Seed] Failed to update Supabase user password: ${updateError.message}`);
      } else {
        console.log(`[Seed] Successfully updated Supabase user password.`);
      }
    } else {
      console.log(`[Seed] User not found in Supabase. Creating in Supabase Auth...`);
      const { data: { user: newUser }, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: adminPassword,
        email_confirm: true
      });
      if (createError) {
        console.error(`[Seed] Failed to create Supabase user: ${createError.message}`);
        return;
      }
      supabaseId = newUser.id;
      console.log(`[Seed] Created Supabase user: ${supabaseId}`);
    }

    const username = 'vikul_admin';
    const newMongoUser = new User({
      email,
      supabaseId,
      username,
      role: 'admin',
      isVerified: true,
      name: 'Vikul Admin',
      age: 30,
      dob: new Date('1996-01-01'),
      gender: 'male'
    });
    await newMongoUser.save();
    console.log(`[Seed] Created MongoDB ADMIN user for ${email}`);
  } catch (err) {
    console.error('[Seed] Admin seeding failed:', err.message);
  }
}

async function boot() {
  console.log('Starting Blippr API');
  const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI || process.env.MONGODB_URL;
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI || process.env.REDIS_URL_PRIVATE;
  console.log(`Environment check: MongoDB=${mongoUri ? 'set' : 'missing'}, REDIS=${redisUrl ? 'set' : 'missing'}`);

  // Start HTTP server immediately to satisfy Railway healthcheck at /health
  server.listen(port, '0.0.0.0', () => {
    console.log(`Blippr API listening on production port ${port}`);
  });

  // Connect to databases and initialize services in the background
  try {
    await connectMongo();
    await connectRedis();
    await seedAdminUser();
  } catch (error) {
    console.error('Database/Service initialization error during boot:', error.message);
    // Do not call process.exit(1); let the server remain online for healthchecks,
    // and let driver retry logic/redeployments resolve connection state.
  }
}

boot().catch((error) => {
  console.error('Failed to start Blippr', error);
  process.exit(1);
});

