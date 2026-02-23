/**
 * Test Authentication Flow
 * 
 * Quick script to test authentication components without browser.
 * Run with: npm run test:auth
 * 
 * NOTE: User, Role, and AuditLog are now managed by the authz service.
 */

import { prisma } from '../src/lib/db';

// Helper to call authz API
async function callAuthz(path: string, options: RequestInit = {}) {
  const authzUrl = process.env.AUTHZ_BASE_URL || 'http://10.96.200.210:8010';
  const adminToken = process.env.AUTHZ_ADMIN_TOKEN;
  
  if (!adminToken) {
    throw new Error('AUTHZ_ADMIN_TOKEN not configured');
  }
  
  const res = await fetch(`${authzUrl}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Authz API error (${res.status}): ${text}`);
  }
  
  return res.json();
}

async function main() {
  console.log('🧪 Testing Authentication Setup\n');

  // Test 1: Check database connection
  console.log('1️⃣  Checking busibox-portal database connection...');
  try {
    await prisma.$connect();
    console.log('✅ busibox-portal database connected\n');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }

  // Test 2: Check authz service connectivity
  console.log('2️⃣  Checking authz service...');
  try {
    const healthRes = await fetch(`${process.env.AUTHZ_BASE_URL || 'http://10.96.200.210:8010'}/health`);
    if (healthRes.ok) {
      console.log('✅ Authz service is healthy\n');
    } else {
      console.log('❌ Authz service health check failed\n');
    }
  } catch (error) {
    console.log('❌ Cannot connect to authz service:', error);
    console.log('   Make sure authz service is running\n');
  }

  // Test 3: Check admin user exists (via authz)
  console.log('3️⃣  Checking admin user (via authz)...');
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@localhost';
  try {
    const users = await callAuthz('/admin/users');
    const adminUser = users.find((u: any) => u.email === adminEmail);

    if (adminUser) {
      console.log(`✅ Admin user exists: ${adminUser.email}`);
      console.log(`   Status: ${adminUser.status}`);
      console.log(`   Roles: ${adminUser.roles?.map((r: any) => r.name).join(', ') || 'none'}`);
      console.log(`   Created: ${adminUser.created_at}\n`);
    } else {
      console.log(`❌ Admin user not found: ${adminEmail}`);
      console.log('   Run seed or create admin via authz\n');
    }
  } catch (error) {
    console.log('⚠️  Cannot fetch users from authz:', error);
    console.log('   Check AUTHZ_ADMIN_TOKEN configuration\n');
  }

  // Test 4: Check roles (via authz)
  console.log('4️⃣  Checking roles (via authz)...');
  try {
    const roles = await callAuthz('/admin/roles');

    if (roles.length > 0) {
      console.log(`✅ Found ${roles.length} role(s):`);
      roles.forEach((role: any) => {
        console.log(`   - ${role.name}${role.is_system ? ' (system)' : ''}`);
      });
      console.log('');
    } else {
      console.log('❌ No roles found.\n');
    }
  } catch (error) {
    console.log('⚠️  Cannot fetch roles from authz:', error);
  }

  // Test 5: Check apps (local db)
  console.log('5️⃣  Checking applications (local db)...');
  const apps = await prisma.app.findMany({
    orderBy: {
      displayOrder: 'asc',
    },
  });

  if (apps.length > 0) {
    console.log(`✅ Found ${apps.length} app(s):`);
    apps.forEach(app => {
      console.log(`   - ${app.name} (${app.type})`);
      console.log(`     ${app.isActive ? '🟢 Active' : '🔴 Inactive'} | URL: ${app.url || 'N/A'}`);
    });
    console.log('');
  } else {
    console.log('❌ No apps found. Run: npm run db:seed\n');
  }

  // Test 6: Check environment variables
  console.log('6️⃣  Checking environment variables...');
  const requiredEnvVars = [
    'DATABASE_URL',
    'APP_URL',  // Or NEXT_PUBLIC_APP_URL for build-time config
    'AUTHZ_BASE_URL',
    'AUTHZ_ADMIN_TOKEN',
    'SSO_JWT_SECRET',
  ];

  const optionalEnvVars = [
    'ADMIN_EMAIL',
    'ALLOWED_EMAIL_DOMAINS',
    'RESEND_API_KEY',
    'EMAIL_FROM',
  ];

  let allRequired = true;
  requiredEnvVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`   ✅ ${varName}: ${varName.includes('SECRET') || varName.includes('KEY') || varName.includes('TOKEN') ? '***' : process.env[varName]}`);
    } else {
      console.log(`   ❌ ${varName}: NOT SET`);
      allRequired = false;
    }
  });

  console.log('\n   Optional:');
  optionalEnvVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`   ✅ ${varName}: ${varName.includes('KEY') ? '***' : process.env[varName]}`);
    } else {
      console.log(`   ⚠️  ${varName}: not set (using defaults)`);
    }
  });
  console.log('');

  if (!allRequired) {
    console.log('❌ Some required environment variables are missing!\n');
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`busibox-portal DB: ✅ Connected`);
  console.log(`Authz Service: Check output above`);
  console.log(`Apps: ${apps.length > 0 ? '✅ Available' : '❌ Missing'}`);
  console.log(`Environment: ${allRequired ? '✅ Complete' : '❌ Incomplete'}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (apps.length > 0 && allRequired) {
    console.log('🎉 System is ready for testing!');
    console.log('\n💡 Next steps:');
    console.log('   1. Start dev server: npm run dev');
    console.log('   2. Visit: http://localhost:3000');
    console.log('   3. Login with: ' + adminEmail);
    console.log('\n📚 See TESTING.md for comprehensive test scenarios\n');
  } else {
    console.log('⚠️  System setup incomplete. Please fix issues above.\n');
  }
}

main()
  .catch((e) => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
