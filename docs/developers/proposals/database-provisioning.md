# Proposal: Automatic Database Provisioning for Library Apps

**Created:** 2026-01-23  
**Status:** Proposal  
**Priority:** High (blocks Prisma-mode apps)

## Problem

Deploying Prisma-mode apps requires manual steps:
1. SSH to pg-lxc
2. Manually create database
3. Manually create user and password
4. Manually add DATABASE_URL secret

This is error-prone, slow, and blocks self-service deployment of library apps that need database access.

## Solution

Automate database provisioning as part of app deployment. When a library app is deployed and requires a database, the deployment system provisions the database, creates credentials, stores them securely, and runs schema initialization.

## Design

### LibraryApp Interface Extension

Extend the LibraryApp interface with database configuration:

- required: boolean - whether the app needs a database
- preferredName: string - preferred database name (e.g. app slug)
- schemaManagement: 'prisma' | 'migrations' | 'manual' - how schema is applied
- initCommand: string (optional) - post-provision command (e.g. prisma db push, seed)

### AppDatabase Model

Add Prisma model to track provisioned databases:

- appId
- databaseName
- username
- passwordHash (encrypted)
- createdAt
- status

### Ansible Role: postgres_app_database

New role that:
- Creates database on pg-lxc
- Creates per-app PostgreSQL user with least privilege
- Stores credentials in vault
- Returns DATABASE_URL for deployment

### Integration

Integrate into app_deployer role. Before deploying app:
1. Check if AppDatabase record exists for this app
2. If not: generate password, create DB, create user, store credentials, add DATABASE_URL secret
3. Run schema init (prisma db push, seed)
4. Proceed with app deployment

### Deployment Flow

1. Deployer checks app config for database requirement
2. If required and no AppDatabase exists: call postgres_app_database role
3. Role creates DB, user, stores credentials
4. Deployer adds DATABASE_URL to app secrets
5. Deployer runs schema init (prisma db push, seed)
6. Deployer starts app

### UI

- Database config section in app setup (when adding library app)
- Database status panel in app management (shows provisioned/not provisioned)

### Security

- Use crypto.randomBytes for password generation
- Encrypted storage in Ansible Vault
- Least privilege: per-app PostgreSQL users with grants only to their database
- Audit trail in AppDatabase model

### Benefits

- One-click deploy for Prisma-mode apps
- Standardized provisioning process
- Audit trail of provisioned databases
- Self-service for app developers
