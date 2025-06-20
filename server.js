// server.js
const ssh2 = require('ssh2');
const http = require('http');
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
const PORT = process.env.PORT || 3000;
const SSH_PORT = process.env.SSH_PORT || 2222;

// Auto-detect Railway domain
let RAILWAY_DOMAIN = 'localhost';
const RAILWAY_PUBLIC_DOMAIN = process.env.RAILWAY_PUBLIC_DOMAIN;
const RAILWAY_STATIC_URL = process.env.RAILWAY_STATIC_URL;

if (RAILWAY_PUBLIC_DOMAIN) {
    RAILWAY_DOMAIN = RAILWAY_PUBLIC_DOMAIN;
} else if (RAILWAY_STATIC_URL) {
    RAILWAY_DOMAIN = RAILWAY_STATIC_URL.replace('https://', '').replace('http://', '');
}

console.log(`SSH Server Configuration:`);
console.log(`Username: ${SSH_USERNAME}`);
console.log(`Password: ${SSH_PASSWORD}`);
console.log(`HTTP Port: ${PORT}`);
console.log(`SSH Port: ${SSH_PORT}`);
console.log(`Detected Domain: ${RAILWAY_DOMAIN}`);

// Create HTTP server for Railway health checks
const httpServer = http.createServer((req, res) => {
    // Get the actual domain from the request
    const currentDomain = req.headers.host || RAILWAY_DOMAIN;
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Railway SSH Server</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; background: #1a1a1a; color: #fff; }
                .container { max-width: 700px; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 40px; }
                .info { background: #2a2a2a; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .command { background: #333; padding: 15px; border-radius: 5px; font-family: monospace; margin: 10px 0; overflow-x: auto; }
                .status { color: #4CAF50; font-weight: bold; }
                .copy-btn { background: #4CAF50; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-left: 10px; }
                .copy-btn:hover { background: #45a049; }
                .domain-info { background: #1e3a5f; padding: 15px; border-radius: 5px; margin: 10px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚂 Railway SSH Server</h1>
                    <p class="status">✅ Server is running!</p>
                </div>
                
                <div class="domain-info">
                    <h3>🌐 Auto-Detected Connection Info:</h3>
                    <p><strong>Current Domain:</strong> ${currentDomain}</p>
                    <p><strong>SSH Port:</strong> ${SSH_PORT}</p>
                    <p><strong>Username:</strong> ${SSH_USERNAME}</p>
                </div>
                
                <div class="info">
                    <h3>📱 Connect from Android Termux:</h3>
                    <div class="command" id="termux-cmd">
pkg update && pkg install openssh<br>
ssh -p ${SSH_PORT} ${SSH_USERNAME}@${currentDomain}
                    </div>
                    <button class="copy-btn" onclick="copyToClipboard('termux-cmd')">Copy Commands</button>
                </div>
                
                <div class="info">
                    <h3>💻 Connect from PC/Mac:</h3>
                    <div class="command" id="pc-cmd">
ssh -p ${SSH_PORT} ${SSH_USERNAME}@${currentDomain}
                    </div>
                    <button class="copy-btn" onclick="copyToClipboard('pc-cmd')">Copy Command</button>
                </div>
                
                <div class="info">
                    <h3>🔧 Alternative Connection (if standard fails):</h3>
                    <div class="command" id="alt-cmd">
ssh -o "StrictHostKeyChecking=no" -p ${SSH_PORT} ${SSH_USERNAME}@${currentDomain}
                    </div>
                    <button class="copy-btn" onclick="copyToClipboard('alt-cmd')">Copy Command</button>
                </div>
                
                <div class="info">
                    <h3>📊 Server Status:</h3>
                    <p>SSH Server: <span class="status">Running</span></p>
                    <p>HTTP Server: <span class="status">Running</span></p>
                    <p>Uptime: ${Math.floor(process.uptime() / 60)} minutes</p>
                    <p>Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB</p>
                    <p>Environment: ${process.env.NODE_ENV || 'production'}</p>
                </div>
                
                <div class="info">
                    <h3>🛠️ Available Environment Variables:</h3>
                    <p><strong>SSH_USERNAME:</strong> Change your SSH username</p>
                    <p><strong>SSH_PASSWORD:</strong> Change your SSH password</p>
                    <p><strong>SSH_PORT:</strong> Change SSH port (default: 2222)</p>
                </div>
            </div>
            
            <script>
                function copyToClipboard(elementId) {
                    const element = document.getElementById(elementId);
                    const text = element.innerText || element.textContent;
                    navigator.clipboard.writeText(text).then(() => {
                        alert('Commands copied to clipboard!');
                    }).catch(() => {
                        // Fallback for older browsers
                        const textArea = document.createElement('textarea');
                        textArea.value = text;
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        alert('Commands copied to clipboard!');
                    });
                }
                
                // Auto-refresh every 30 seconds to update uptime
                setTimeout(() => {
                    location.reload();
                }, 30000);
            </script>
        </body>
        </html>
    `);
});

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 HTTP Server listening on port ${PORT}`);
});

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

server.listen(SSH_PORT, '0.0.0.0', () => {
    console.log(`🚂 SSH Server listening on port ${SSH_PORT}`);
    console.log(`🌐 Auto-detected domain: ${RAILWAY_DOMAIN}`);
    console.log(`📱 Termux connection: ssh -p ${SSH_PORT} ${SSH_USERNAME}@${RAILWAY_DOMAIN}`);
    console.log(`💻 Direct connection: ssh -p ${SSH_PORT} ${SSH_USERNAME}@${RAILWAY_DOMAIN}`);
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