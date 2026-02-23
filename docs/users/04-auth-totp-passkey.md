---
title: "Authentication Setup"
category: "platform"
order: 4
description: "Login methods including Magic Link, TOTP, and Passkey"
published: true
---

# Authentication Setup

## Login Methods

Three methods are available: Magic Link, TOTP code, and Passkey.

## Magic Link

1. Enter your email address
2. Receive an email with a login link
3. Click the link to authenticate

Links expire in 15 minutes and are single-use.

## TOTP Code

1. Enter your email address
2. Receive a 6-digit code via email
3. Enter the code to authenticate

## Passkey

1. Register a passkey in account settings (one-time setup)
2. Use biometric authentication (Face ID, Touch ID) or a security key to log in
3. No email needed after setup

Passkeys provide passwordless authentication with strong security.

## Sessions

Sessions last 24 hours. Authentication uses secure httpOnly cookies.

## Logging Out

Log out from the account menu or the account settings page. Logging out invalidates the session.
