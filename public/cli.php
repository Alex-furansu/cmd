<?php
session_start();
if (!isset($_SESSION['admin'])) {
    header("Location: index.php");
    exit();
}
?>

<!DOCTYPE html>
<html>
<head>
  <title>Admin Web CLI</title>
  <style>
    body {
      background-color: black;
      color: lime;
      font-family: monospace;
      padding: 20px;
    }
    input {
      width: 100%;
      padding: 10px;
      background-color: black;
      color: lime;
      border: none;
      outline: none;
      font-family: monospace;
    }
    #output {
      white-space: pre-wrap;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <h2>Admin Web CLI</h2>
  <div id="output"></div>
  <form id="cli-form">
    <input id="command" type="text" placeholder="Type a command..." autocomplete="off" autofocus />
  </form>

  <script>
    const CLI_API = "https://your-node-backend-url/"; // <-- Replace with Railway or local URL
    const ADMIN_TOKEN = "my-secret-token"; // Must match server.js

    const form = document.getElementById('cli-form');
    const input = document.getElementById('command');
    const output = document.getElementById('output');

    form.onsubmit = async (e) => {
      e.preventDefault();
      const cmd = input.value;
      if (!cmd) return;

      output.innerHTML += `> ${cmd}\n`;
      input.value = '';

      try {
        const res = await fetch(CLI_API + "run", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cmd, token: ADMIN_TOKEN })
        });
        const text = await res.text();
        output.innerHTML += `${text}\n`;
        window.scrollTo(0, document.body.scrollHeight);
      } catch (err) {
        output.innerHTML += `Error: ${err.message}\n`;
      }
    };
  </script>
</body>
</html>
