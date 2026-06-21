import './config/env.js';
import { connectMongo } from './config/db.js';
import User from './models/User.js';
import { supabaseAdmin } from './config/supabase.js';

async function run() {
  console.log('Connecting to Postgres...');
  await connectMongo();

  const email = 'vikul93065@gmail.com';
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not configured.');
  }

  // Get all users in Supabase to find by email
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Failed to list Supabase users: ${listError.message}`);
  }

  const supabaseUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  let user = null;
  if (supabaseUser) {
    user = await User.findOne({ supabaseId: supabaseUser.id });
  }

  if (user) {
    console.log(`User found in database: @${user.username} (ID: ${user._id})`);
    user.role = 'admin';
    user.isVerified = true;
    await user.save();
    console.log(`Successfully updated user @${user.username} to ADMIN.`);
    return;
  }

  console.log(`User ${email} not found in database. Checking Supabase Auth...`);
  let supabaseId;
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'VikulAdmin123!';

  if (supabaseUser) {
    supabaseId = supabaseUser.id;
    console.log(`User found in Supabase Auth. ID: ${supabaseId}`);
  } else {
    console.log('User not found in Supabase Auth. Creating user...');
    const { data: { user: newUser }, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: adminPassword,
      email_confirm: true
    });
    if (createError) {
      throw new Error(`Failed to create Supabase user: ${createError.message}`);
    }
    supabaseId = newUser.id;
    console.log(`Successfully created Supabase user. ID: ${supabaseId}`);
  }

  // Now create the User record
  const username = 'vikul_admin';
  console.log(`Creating User record for @${username}...`);
  await User.create({
    email,
    supabaseId,
    username,
    role: 'admin',
    isVerified: true,
    name: 'Vikul Admin',
    age: 30,
    dob: new Date('1996-01-01'),
    gender: 'male',
    isOnline: false
  });

  console.log(`Successfully created ADMIN user.`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${supabaseUser ? '[Existing Password]' : adminPassword}`);
}

run().catch(err => {
  console.error('Error running script:', err);
});
