import { randomBytes } from 'crypto';

function generateSecret(length = 64) {
  return randomBytes(length).toString('hex');
}

console.log('\n🔒 Secure Authorization Secrets Generator 🔒\n');
console.log('Copy the following securely generated secrets into your production environment or .env file:\n');

console.log('JWT_SECRET=' + generateSecret(64));
console.log('SESSION_SECRET=' + generateSecret(64));
console.log('SYSTEM_SECRET=' + generateSecret(32)); // For cron job authentication

console.log('\n⚠️  Make sure to never share these secrets or commit them to version control!');
console.log('If you are deploying to Render, set these inside the Environment Variables section.');
