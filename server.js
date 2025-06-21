const express = require('express');
const { exec, spawn } = require('child_process');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const port = process.env.PORT || 3000;

const ADMIN_TOKEN = "my-secret-token";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store active sessions and their states
const sessions = new Map();

// Virtual file system structure
const virtualFS = {
    '/': {
        type: 'directory',
        children: {
            'home': {
                type: 'directory',
                children: {
                    'root': {
                        type: 'directory',
                        children: {
                            'documents': { type: 'directory', children: {} },
                            'downloads': { type: 'directory', children: {} },
                            'projects': {
                                type: 'directory',
                                children: {
                                    'webapp': {
                                        type: 'directory',
                                        children: {
                                            'package.json': { type: 'file', content: '{\n  "name": "webapp",\n  "version": "1.0.0"\n}' },
                                            'server.js': { type: 'file', content: 'const express = require("express");\n// Main server file' },
                                            'README.md': { type: 'file', content: '# Web Application\n\nA sample web application.' }
                                        }
                                    }
                                }
                            },
                            '.bashrc': { type: 'file', content: '# ~/.bashrc\nexport PATH=$PATH:/usr/local/bin' },
                            '.profile': { type: 'file', content: '# ~/.profile\n# User profile settings' },
                            'welcome.txt': { type: 'file', content: 'Welcome to Railway VPS!\nYour virtual server is ready.' }
                        }
                    }
                }
            },
            'etc': {
                type: 'directory',
                children: {
                    'passwd': { type: 'file', content: 'root:x:0:0:root:/root:/bin/bash\n' },
                    'hosts': { type: 'file', content: '127.0.0.1\tlocalhost\n::1\tlocalhost\n' }
                }
            },
            'var': {
                type: 'directory',
                children: {
                    'log': { type: 'directory', children: {} },
                    'www': { type: 'directory', children: {} }
                }
            },
            'usr': {
                type: 'directory',
                children: {
                    'bin': { type: 'directory', children: {} },
                    'local': { type: 'directory', children: {} }
                }
            }
        }
    }
};

// Get session or create new one
function getSession(sessionId) {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
            cwd: '/home/root',
            env: { ...process.env, USER: 'root', HOME: '/home/root' },
            activeProcesses: new Map(),
            history: []
        });
    }
    return sessions.get(sessionId);
}

// Navigate virtual file system
function navigatePath(currentPath, targetPath) {
    if (targetPath.startsWith('/')) {
        // Absolute path
        currentPath = targetPath;
    } else {
        // Relative path
        if (targetPath === '..') {
            const parts = currentPath.split('/').filter(p => p);
            parts.pop();
            currentPath = '/' + parts.join('/');
        } else if (targetPath !== '.') {
            currentPath = path.posix.join(currentPath, targetPath);
        }
    }
    
    if (currentPath === '') currentPath = '/';
    return currentPath.replace(/\/+/g, '/');
}

// Get virtual directory contents
function getDirectoryContents(dirPath) {
    const parts = dirPath === '/' ? [] : dirPath.split('/').filter(p => p);
    let current = virtualFS['/'];
    
    for (const part of parts) {
        if (current.children && current.children[part]) {
            current = current.children[part];
        } else {
            return null;
        }
    }
    
    if (current.type !== 'directory') return null;
    return current.children || {};
}

// Format ls output with colors
function formatLsOutput(contents, showDetails = false) {
    const entries = Object.entries(contents);
    if (entries.length === 0) return '';
    
    if (!showDetails) {
        return entries.map(([name, item]) => {
            if (item.type === 'directory') {
                return `\x1b[34m${name}\x1b[0m`; // Blue for directories
            } else if (name.includes('.js') || name.includes('.py') || name.includes('.sh')) {
                return `\x1b[32m${name}\x1b[0m`; // Green for executables
            } else if (name.includes('.txt') || name.includes('.md')) {
                return `\x1b[37m${name}\x1b[0m`; // White for text files
            } else if (name.startsWith('.')) {
                return `\x1b[90m${name}\x1b[0m`; // Gray for hidden files
            } else {
                return `\x1b[37m${name}\x1b[0m`; // White for regular files
            }
        }).join('  ');
    } else {
        // Detailed listing (ls -l)
        return entries.map(([name, item]) => {
            const type = item.type === 'directory' ? 'd' : '-';
            const permissions = item.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--';
            const size = item.type === 'directory' ? '4096' : (item.content ? item.content.length.toString() : '0');
            const date = new Date().toLocaleDateString('en-US', { 
                month: 'short', 
                day: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            let coloredName = name;
            if (item.type === 'directory') {
                coloredName = `\x1b[34m${name}\x1b[0m`;
            } else if (name.includes('.js') || name.includes('.py') || name.includes('.sh')) {
                coloredName = `\x1b[32m${name}\x1b[0m`;
            } else if (name.startsWith('.')) {
                coloredName = `\x1b[90m${name}\x1b[0m`;
            }
            
            return `${type}${permissions}  1 root root ${size.padStart(8)} ${date} ${coloredName}`;
        }).join('\n');
    }
}

// Handle built-in commands
function handleBuiltinCommand(command, args, session) {
    const cmd = command.toLowerCase();
    
    switch (cmd) {
        case 'pwd':
            return session.cwd;
            
        case 'cd':
            const targetDir = args[0] || '/home/root';
            const newPath = navigatePath(session.cwd, targetDir);
            const dirContents = getDirectoryContents(newPath);
            
            if (dirContents === null) {
                return `cd: ${targetDir}: No such file or directory`;
            }
            
            session.cwd = newPath;
            return '';
            
        case 'ls':
            const showAll = args.includes('-a') || args.includes('-la') || args.includes('-al');
            const showDetails = args.includes('-l') || args.includes('-la') || args.includes('-al');
            const targetPath = args.find(arg => !arg.startsWith('-')) || session.cwd;
            const fullPath = navigatePath(session.cwd, targetPath);
            const contents = getDirectoryContents(fullPath);
            
            if (contents === null) {
                return `ls: cannot access '${targetPath}': No such file or directory`;
            }
            
            let filteredContents = contents;
            if (!showAll) {
                filteredContents = Object.fromEntries(
                    Object.entries(contents).filter(([name]) => !name.startsWith('.'))
                );
            }
            
            return formatLsOutput(filteredContents, showDetails);
            
        case 'cat':
            if (!args[0]) return 'cat: missing file operand';
            const filePath = navigatePath(session.cwd, args[0]);
            const parts = filePath === '/' ? [] : filePath.split('/').filter(p => p);
            let current = virtualFS['/'];
            
            for (const part of parts) {
                if (current.children && current.children[part]) {
                    current = current.children[part];
                } else {
                    return `cat: ${args[0]}: No such file or directory`;
                }
            }
            
            if (current.type !== 'file') {
                return `cat: ${args[0]}: Is a directory`;
            }
            
            return current.content || '';
            
        case 'whoami':
            return 'root';
            
        case 'hostname':
            return 'railway-vps';
            
        case 'uname':
            if (args.includes('-a')) {
                return 'Linux railway-vps 5.15.0-railway #1 SMP x86_64 GNU/Linux';
            }
            return 'Linux';
            
        case 'date':
            return new Date().toString();
            
        case 'uptime':
            const uptimeMs = process.uptime() * 1000;
            const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
            const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
            return `up ${hours}h ${minutes}m, 1 user, load average: 0.05, 0.10, 0.08`;
            
        case 'ps':
            return 'PID TTY          TIME CMD\n1234 pts/0    00:00:01 bash\n5678 pts/0    00:00:00 node\n9012 pts/0    00:00:00 ps';
            
        case 'df':
            return 'Filesystem     1K-blocks    Used Available Use% Mounted on\n/dev/sda1       10485760 3145728   7340032  30% /\ntmpfs            1048576       0   1048576   0% /tmp';
            
        case 'free':
            if (args.includes('-h')) {
                return '              total        used        free      shared  buff/cache   available\nMem:          2.0Gi       512Mi       1.2Gi        64Mi       256Mi       1.4Gi\nSwap:         1.0Gi         0Gi       1.0Gi';
            }
            return '              total        used        free      shared  buff/cache   available\nMem:        2097152      524288     1310720       65536      262144     1441792\nSwap:       1048576           0     1048576';
            
        case 'echo':
            return args.join(' ');
            
        default:
            return null; // Not a builtin command
    }
}

app.post('/run', (req, res) => {
    const { command, token, sessionId = 'default' } = req.body;
    const session = getSession(sessionId);
    
    if (!command || !command.trim()) {
        return res.send('');
    }
    
    // Validate token
    const isAdmin = token === ADMIN_TOKEN;
    
    // Parse command
    const args = command.trim().split(' ');
    const baseCommand = args[0];
    const commandArgs = args.slice(1);
    
    // Add to history
    session.history.push(command);
    
    // Try builtin commands first
    const builtinResult = handleBuiltinCommand(baseCommand, commandArgs, session);
    if (builtinResult !== null) {
        return res.send(builtinResult);
    }
    
    // Non-admins: restrict system commands
    const allowedCommands = ['date', 'uptime', 'whoami', 'ls', 'pwd', 'echo', 'cat', 'ps', 'df', 'free', 'uname', 'hostname'];
    
    if (!isAdmin && !allowedCommands.includes(baseCommand)) {
        return res.status(403).send(`${baseCommand}: command not found`);
    }
    
    // Handle special interactive commands
    if (baseCommand === 'nano' || baseCommand === 'vim' || baseCommand === 'vi') {
        const filename = commandArgs[0] || 'untitled.txt';
        return res.json({
            type: 'editor',
            editor: baseCommand,
            filename: filename,
            content: getFileContent(session.cwd, filename) || '',
            message: `Opening ${filename} in ${baseCommand}...`
        });
    }
    
    if (baseCommand === 'top' || baseCommand === 'htop') {
        return res.json({
            type: 'monitor',
            tool: baseCommand,
            message: `Starting ${baseCommand}...`
        });
    }
    
    // Execute real system command with current working directory context
    const options = {
        cwd: process.cwd(),
        env: { ...process.env, PWD: session.cwd }
    };
    
    exec(command, options, (error, stdout, stderr) => {
        if (error) {
            return res.send(stderr || `${baseCommand}: command not found`);
        }
        res.send(stdout);
    });
});

// Helper function to get file content from virtual FS
function getFileContent(currentPath, filename) {
    const filePath = navigatePath(currentPath, filename);
    const parts = filePath === '/' ? [] : filePath.split('/').filter(p => p);
    let current = virtualFS['/'];
    
    for (const part of parts) {
        if (current.children && current.children[part]) {
            current = current.children[part];
        } else {
            return null;
        }
    }
    
    return current.type === 'file' ? current.content : null;
}

app.listen(port, () => {
    console.log(`Enhanced CLI backend running at http://localhost:${port}`);
});