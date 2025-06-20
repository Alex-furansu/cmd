<?php
session_start();

$valid_user = "admin";
$valid_pass = "12345"; // Change this!

if ($_POST['username'] === $valid_user && $_POST['password'] === $valid_pass) {
    $_SESSION['admin'] = true;
    header("Location: cli.html");
} else {
    echo "Invalid credentials.";
}
?>
