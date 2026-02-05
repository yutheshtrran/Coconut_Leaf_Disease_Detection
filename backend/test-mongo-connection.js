const mongoose = require('mongoose');
require('dotenv').config();
require('dns').setServers(['8.8.8.8']); // Force Google DNS for SRV workaround

const MONGODB_URI = process.env.MONGODB_URI;

console.log('Testing MongoDB Connection...');
console.log('Connection String:', MONGODB_URI.replace(/:[^:@]+@/, ':****@')); // Hide password

mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000, // 10 second timeout
})
    .then(() => {
        console.log('✅ SUCCESS: MongoDB connected!');
        process.exit(0);
    })
    .catch(async (error) => {
        console.error('❌ FAILED: MongoDB connection error details:');
        console.error('Name:', error.name);
        console.error('Message:', error.message);
        console.error('Code:', error.code);
        console.error('Syscall:', error.syscall);
        console.error('Hostname:', error.hostname);

        if (error.cause) {
            console.error('Cause:', error.cause);
        }

        // DNS Debugging
        try {
            const dns = require('dns');
            const hostname = MONGODB_URI.split('@')[1].split('/')[0];
            console.log(`\n🔍 Attempting DNS lookup for: ${hostname}`);
            dns.lookup(hostname, (err, address, family) => {
                if (err) {
                    console.error('❌ DNS Lookup Failed:', err.message);
                } else {
                    console.log(`✅ DNS Lookup Successful: ${address} (IPv${family})`);
                    console.log('If DNS works but connection fails, it is likely a FIREWALL issue blocking port 27017.');
                }
                process.exit(1);
            });
        } catch (dnsErr) {
            console.error('DNS check failed unexpectedly:', dnsErr);
            process.exit(1);
        }
    });
