// server.js
const ssh2 = require('ssh2');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

const Server = ssh2.Server;
const net = require('net');

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
const SSH_PORT = PORT; // Use the same port as HTTP for Railway compatibility

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
console.log(`Port: ${PORT} (HTTP + SSH)`);
console.log(`Detected Domain: ${RAILWAY_DOMAIN}`);

// Create a combined server that handles both HTTP and SSH on the same port
const net = require('net');

// Create the main server
const combinedServer = net.createServer((socket) => {
    socket.once('data', (data) => {
        // Check if it's an HTTP request
        const dataStr = data.toString();
        if (dataStr.startsWith('GET ') || dataStr.startsWith('POST ') || 
            dataStr.startsWith('PUT ') || dataStr.startsWith('DELETE ') ||
            dataStr.startsWith('HEAD ') || dataStr.startsWith('OPTIONS ')) {
            
            // Handle HTTP request
            handleHttpRequest(socket, data);
        } else {
            // Handle SSH connection
            handleSshConnection(socket, data);
        }
    });
});

function handleHttpRequest(socket, initialData) {
    // Get the actual domain from the request
    const dataStr = initialData.toString();
    const hostMatch = dataStr.match(/Host: ([^\r\n]+)/i);
    const currentDomain = hostMatch ? hostMatch[1] : RAILWAY_DOMAIN;
    
    const response = `HTTP/1.1 200 OK\r
Content-Type: text/html\r
Connection: close\r
\r
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
        .warning { color: #ff9800; font-weight: bold; }
        .copy-btn { background: #4CAF50; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-left: 10px; }
        .copy-btn:hover { background: #45a049; }
        .domain-info { background: #1e3a5f; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .important { background: #4a1e1e; padding: 15px; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚂 Railway SSH Server</h1>
            <p class="status">✅ Server is running!</p>
        </div>
        
        <div class="important">
            <h3>⚠️ Important: Same Port Configuration</h3>
            <p class="warning">This server runs SSH and HTTP on the same port (${PORT}) for Railway compatibility.</p>
            <p>Railway only exposes one port per service, so we multiplex HTTP and SSH traffic.</p>
        </div>
        
        <div class="domain-info">
            <h3>🌐 Auto-Detected Connection Info:</h3>
            <p><strong>Current Domain:</strong> ${currentDomain}</p>
            <p><strong>Port:</strong> ${PORT}</p>
            <p><strong>Username:</strong> ${SSH_USERNAME}</p>
        </div>
        
        <div class="info">
            <h3>📱 Connect from Android Termux:</h3>
            <div class="command" id="termux-cmd">
pkg update && pkg install openssh<br>
ssh -p ${PORT} ${SSH_USERNAME}@${currentDomain}
            </div>
            <button class="copy-btn" onclick="copyToClipboard('termux-cmd')">Copy Commands</button>
        </div>
        
        <div class="info">
            <h3>💻 Connect from PC/Mac:</h3>
            <div class="command" id="pc-cmd">
ssh -p ${PORT} ${SSH_USERNAME}@${currentDomain}
            </div>
            <button class="copy-btn" onclick="copyToClipboard('pc-cmd')">Copy Command</button>
        </div>
        
        <div class="info">
            <h3>🔧 Alternative Connection (if standard fails):</h3>
            <div class="command" id="alt-cmd">
ssh -o "StrictHostKeyChecking=no" -p ${PORT} ${SSH_USERNAME}@${currentDomain}
            </div>
            <button class="copy-btn" onclick="copyToClipboard('alt-cmd')">Copy Command</button>
        </div>
        
        <div class="info">
            <h3>📊 Server Status:</h3>
            <p>Combined Server: <span class="status">Running on port ${PORT}</span></p>
            <p>HTTP Handler: <span class="status">Active</span></p>
            <p>SSH Handler: <span class="status">Active</span></p>
            <p>Uptime: ${Math.floor(process.uptime() / 60)} minutes</p>
            <p>Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB</p>
        </div>
        
        <div class="info">
            <h3>🛠️ Environment Variables:</h3>
            <p><strong>SSH_USERNAME:</strong> Change your SSH username</p>
            <p><strong>SSH_PASSWORD:</strong> Change your SSH password</p>
        </div>
    </div>
    
    <script>
        function copyToClipboard(elementId) {
            const element = document.getElementById(elementId);
            const text = element.innerText || element.textContent;
            navigator.clipboard.writeText(text).then(() => {
                alert('Commands copied to clipboard!');
            }).catch(() => {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('Commands copied to clipboard!');
            });
        }
    </script>
</body>
</html>`;
    
    socket.write(response);
    socket.end();
}

function handleSshConnection(socket, initialData) {
    console.log('SSH connection detected');
    
    // Create SSH server instance for this connection
    const sshServer = new Server({
        hostKeys: [hostKey]
    }, (client) => {
        console.log('SSH Client connected!');

        client.on('authentication', (ctx) => {
            console.log(`SSH Authentication attempt: ${ctx.method} for user ${ctx.username}`);
            
            if (ctx.method === 'password' && 
                ctx.username === SSH_USERNAME && 
                ctx.password === SSH_PASSWORD) {
                console.log('SSH Authentication successful');
                ctx.accept();
            } else {
                console.log('SSH Authentication failed');
                ctx.reject();
            }
        });

        client.on('ready', () => {
            console.log('SSH Client authenticated!');

            client.on('session', (accept, reject) => {
                const session = accept();
                let ptyInfo = null;

                session.on('pty', (accept, reject, info) => {
                    console.log('SSH PTY requested');
                    ptyInfo = info;
                    accept();
                });

                session.on('shell', (accept, reject) => {
                    console.log('SSH Shell requested');
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
                        console.log('SSH Shell closed with code:', code);
                        stream.exit(code);
                        stream.end();
                    });

                    stream.on('close', () => {
                        console.log('SSH Stream closed');
                        shell.kill();
                    });

                    // Send welcome message
                    stream.write('\r\n🚂 Welcome to Railway SSH Server!\r\n');
                    stream.write('Running on the same port as HTTP for Railway compatibility.\r\n\r\n');
                });

                session.on('exec', (accept, reject, info) => {
                    console.log('SSH Exec requested:', info.command);
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
            console.log('SSH Client disconnected');
        });

        client.on('error', (err) => {
            console.error('SSH Client error:', err);
        });
    });
    
    // Handle the SSH connection
    sshServer.emit('connection', socket);
    
    // Push the initial data back for SSH processing
    socket.unshift(initialData);
}

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

combinedServer.on('error', (err) => {
    console.error('Server error:', err);
});

combinedServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚂 Combined Server (HTTP + SSH) listening on port ${PORT}`);
    console.log(`🌐 Auto-detected domain: ${RAILWAY_DOMAIN}`);
    console.log(`📱 Termux connection: ssh -p ${PORT} ${SSH_USERNAME}@${RAILWAY_DOMAIN}`);
    console.log(`💻 Direct connection: ssh -p ${PORT} ${SSH_USERNAME}@${RAILWAY_DOMAIN}`);
    console.log(`🌐 Web interface: http://${RAILWAY_DOMAIN}:${PORT}`);
});

// Keep the process alive
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    combinedServer.close(() => {
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    combinedServer.close(() => {
        process.exit(0);
    });
});