const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files (index.html and index.js)
app.use(express.static('.'));

// WebSocket connection handler
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    const command = data.command;

    // Spawn a shell process (bash for Unix-like systems, cmd for Windows)
    const shell = process.platform === 'win32' ? spawn('cmd', ['/c', command]) : spawn('bash', ['-c', command]);

    // Capture stdout
    shell.stdout.on('data', (data) => {
      ws.send(JSON.stringify({ output: data.toString() }));
    });

    // Capture stderr
    shell.stderr.on('data', (data) => {
      ws.send(JSON.stringify({ output: `Error: ${data.toString()}` }));
    });

    // Handle process exit
    shell.on('close', (code) => {
      ws.send(JSON.stringify({ output: `Command exited with code ${code}` }));
    });
  });
});

// Use Railway's provided PORT environment variable
const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});