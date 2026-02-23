---
title: "Deployment Guide"
category: "administrator"
order: 2
description: "Deployment procedures for busibox-frontend applications"
published: true
---

# Deployment Guide

## Ansible Deployment

Deploy from the busibox admin workstation using make commands:

```bash
make install SERVICE=busibox-portal
make install SERVICE=busibox-agents
# Other apps: busibox-admin, busibox-chat, busibox-appbuilder, busibox-media, busibox-documents
```

## Deployment Process

1. Ansible pulls code from GitHub
2. Runs `npm install` (or `pnpm install` in monorepo)
3. Runs `npm run build` (or equivalent)
4. Restarts the application via PM2

## Viewing Logs

SSH to the apps-lxc container, then:

```bash
pm2 logs <app-name>
```

For systemd-managed apps:

```bash
journalctl -u <app-name> -f
```

## GitHub Deployment System

The admin app provides a GitHub-based deployment system:

1. Connect GitHub via OAuth in the admin UI
2. Configure repository, path, port, and health endpoint
3. Sync releases from GitHub
4. Deploy to production or staging

## Staging Environments

Staging deployments use the `/apppath-stage/` route and run on a separate port from production. This allows testing changes before promoting to production.

## Secrets Management

Encrypted environment variables are managed per app in the admin UI. Secrets are stored encrypted and injected at runtime.

## Rollback

One-click rollback is available from the deployment history in the admin UI. Select a previous deployment and restore.

## Monitoring

- Health checks: Configure health endpoints in the deployment configuration
- PM2 status: Use `pm2 status` to view process state and resource usage

## Migrating from Deploywatch

If migrating from the legacy deploywatch system, disable the systemctl timer that triggered deploywatch:

```bash
sudo systemctl disable deploywatch.timer
sudo systemctl stop deploywatch.timer
```
