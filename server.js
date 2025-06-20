// server.js
const ssh2 = require('ssh2');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

const Server = ssh2.Server;

// Generate host key if it doesn't exist
const HOST_KEY_PATH = path.join(__dirname, 'host_key');
let hostKey;

if (fs.existsSync(HOST_KEY_PATH)) {
    hostKey = fs.readFileSync(HOST_KEY_PATH);
} else {
    // Generate a new RSA key pair
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: {
            type: 'pkcs1',
            format: 'pem'
        }
    });
    hostKey = privateKey;
    fs.writeFileSync(HOST_KEY_PATH, hostKey);
}

// SSH Server configuration
const SSH_USERNAME = process.env.SSH_USERNAME || 'user';
const SSH_PASSWORD = process.env.SSH_PASSWORD || 'railway123';
const PORT = process.env.PORT || 2222;

console.log(`SSH Server Configuration:`);
console.log(`Username: ${SSH_USERNAME}`);
console.log(`Password: ${SSH_PASSWORD}`);
console.log(`Port: ${PORT}`);

const server = new Server({
    hostKeys: [hostKey]
}, (client) => {
    console.log('Client connected!');

    client.on('authentication', (ctx) => {
        console.log(`Authentication attempt: ${ctx.method} for user ${ctx.username}`);
        
        if (ctx.method === 'password' && 
            ctx.username === SSH_USERNAME && 
            ctx.password === SSH_PASSWORD) {
            console.log('Authentication successful');
            ctx.accept();
        } else {
            console.log('Authentication failed');
            ctx.reject();
        }
    });

    client.on('ready', () => {
        console.log('Client authenticated!');

        client.on('session', (accept, reject) => {
            const session = accept();
            let ptyInfo = null;

            session.on('pty', (accept, reject, info) => {
                console.log('PTY requested');
                ptyInfo = info;
                accept();
            });

            session.on('shell', (accept, reject) => {
                console.log('Shell requested');
                const stream = accept();

                // Create a bash shell process
                const shell = spawn('/bin/bash', [], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: {
                        ...process.env,
                        TERM: ptyInfo ? ptyInfo.term : 'xterm',
                        COLUMNS: ptyInfo ? ptyInfo.cols : 80,
                        LINES: ptyInfo ? ptyInfo.rows : 24
                    }
                });

                // Connect shell stdio to SSH stream
                shell.stdout.on('data', (data) => {
                    stream.write(data);
                });

                shell.stderr.on('data', (data) => {
                    stream.stderr.write(data);
                });

                stream.on('data', (data) => {
                    shell.stdin.write(data);
                });

                // Handle window resize
                stream.on('window-change', (accept, reject, info) => {
                    if (shell.pid) {
                        try {
                            process.kill(shell.pid, 'SIGWINCH');
                        } catch (e) {
                            // Ignore errors
                        }
                    }
                    accept();
                });

                shell.on('close', (code) => {
                    console.log('Shell closed with code:', code);
                    stream.exit(code);
                    stream.end();
                });

                stream.on('close', () => {
                    console.log('Stream closed');
                    shell.kill();
                });

                // Send welcome message
                stream.write('\r\n🚂 Welcome to Railway SSH Server!\r\n');
                stream.write('Type "help" for available commands.\r\n\r\n');
            });

            session.on('exec', (accept, reject, info) => {
                console.log('Exec requested:', info.command);
                const stream = accept();

                // Execute the command
                const cmd = spawn('/bin/bash', ['-c', info.command], {
                    stdio: ['pipe', 'pipe', 'pipe']
                });

                cmd.stdout.on('data', (data) => {
                    stream.write(data);
                });

                cmd.stderr.on('data', (data) => {
                    stream.stderr.write(data);
                });

                cmd.on('close', (code) => {
                    stream.exit(code);
                    stream.end();
                });
            });
        });
    });

    client.on('end', () => {
        console.log('Client disconnected');
    });

    client.on('error', (err) => {
        console.error('Client error:', err);
    });
});

server.on('error', (err) => {
    console.error('Server error:', err);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚂 Railway SSH Server listening on port ${PORT}`);
    console.log(`Connect with: ssh -p ${PORT} ${SSH_USERNAME}@your-railway-domain.railway.app`);
});

// Keep the process alive
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    server.close(() => {
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    server.close(() => {
        process.exit(0);
    });
});