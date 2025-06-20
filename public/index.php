<?php
session_start();
if (isset($_SESSION['admin'])) {
    header("Location: cli.html");
    exit();
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>Admin Login</title>
</head>
<body>
    <form action="auth.php" method="post">
        <h2>Admin Login</h2>
        <label>Username:</label>
        <input type="text" name="username"><br><br>
        <label>Password:</label>
        <input type="password" name="password"><br><br>
        <input type="submit" value="Login">
    </form>
</body>
</html>
