const dns = require('dns');

console.log('Testing SRV lookup with custom DNS (8.8.8.8)...');

try {
    dns.setServers(['8.8.8.8']);
    console.log('DNS servers set to:', dns.getServers());

    dns.resolveSrv('_mongodb._tcp.cdd.xarzjp7.mongodb.net', (err, addresses) => {
        if (err) {
            console.error('❌ Lookup Failed:', err.message);
            process.exit(1);
        } else {
            console.log('✅ Lookup Successful!');
            console.log('Addresses:', addresses);
            process.exit(0);
        }
    });
} catch (e) {
    console.error('❌ Error setting servers:', e.message);
}
