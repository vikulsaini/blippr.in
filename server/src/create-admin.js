import './config/env.js';
import mongoose from 'mongoose';
import { connectMongo } from './config/db.js';
import User from './models/User.js';
import { supabaseAdmin } from './config/supabase.js';

async function run() {
  console.log('Connecting to MongoDB...');
  await connectMongo();

  const email = 'vikul93065@gmail.com';
  let user = await User.findOne({ email: email.toLowerCase() });

  if (user) {
    console.log(`User found in MongoDB: @${user.username} (ID: ${user._id})`);
    user.role = 'admin';
    user.isVerified = true;
    await user.save();
    console.log(`Successfully updated user @${user.username} to ADMIN.`);
    mongoose.disconnect();
    return;
  }

  console.log(`User ${email} not found in MongoDB. Checking Supabase Auth...`);
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not configured.');
  }

  // Get all users in Supabase to find by email
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Failed to list Supabase users: ${listError.message}`);
  }

  let supabaseUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
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

  // Now create the MongoDB User record
  const username = 'vikul_admin';
  console.log(`Creating MongoDB User record for @${username}...`);
  const newMongoUser = new User({
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

  await newMongoUser.save();
  console.log(`Successfully created MongoDB ADMIN user.`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${supabaseUser ? '[Existing Password]' : adminPassword}`);

  mongoose.disconnect();
}

run().catch(err => {
  console.error('Error running script:', err);
  mongoose.disconnect();
});
