const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('.')); // Serve index.html from the current directory

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    const command = data.command;

    // Spawn a shell process (use 'cmd' on Windows, 'bash' on Unix-like systems)
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

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});