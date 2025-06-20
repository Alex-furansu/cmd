const express = require('express');
const { exec } = require('child_process');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const ADMIN_TOKEN = "my-secret-token"; // Must match token in PHP frontend

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/run', (req, res) => {
    const { command, token } = req.body;

    // Validate token
    const isAdmin = token === ADMIN_TOKEN;

    // Non-admins: restrict commands
    const allowedCommands = ['date', 'uptime', 'whoami', 'ls', 'pwd', 'echo'];
    const baseCommand = command.trim().split(' ')[0];

    if (!isAdmin && !allowedCommands.includes(baseCommand)) {
        return res.status(403).send('Command not allowed');
    }

    // Execute command
    exec(command, (error, stdout, stderr) => {
        if (error) return res.send(stderr);
        res.send(stdout);
    });
});

app.listen(port, () => {
    console.log(`CLI backend running at http://localhost:${port}`);
});
