#!/usr/bin/env node

const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_DIR = path.resolve(__dirname, '..');
const DEPLOY_SCRIPT = path.join(APP_DIR, 'deploy.sh');
const STATUS_FILE = path.join(APP_DIR, 'deploy-status.json');
const LOG_FILE = path.join(APP_DIR, 'deploy.log');
const ENV_FILE = path.join(APP_DIR, '.env');

// Read environment variables from .env
function loadEnv() {
  if (fs.existsSync(ENV_FILE)) {
    const content = fs.readFileSync(ENV_FILE, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const PORT = parseInt(process.env.DEPLOY_WEBHOOK_PORT || '11414', 10);
const SECRET = process.env.DEPLOY_WEBHOOK_SECRET || 'funoon_deploy_default_secret';

function verifySignature(rawBody, signatureHeader) {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
  const signature = signatureHeader.slice(7);
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(rawBody);
  const digest = hmac.digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(digest, 'hex'));
  } catch {
    return false;
  }
}

function verifyToken(req, urlObj) {
  const tokenHeader = req.headers['x-deploy-token'];
  if (tokenHeader && tokenHeader === SECRET) return true;
  const tokenQuery = urlObj.searchParams.get('token');
  if (tokenQuery && tokenQuery === SECRET) return true;
  return false;
}

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // JSON helper
  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data, null, 2));
  };

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Hub-Signature-256, X-GitHub-Event, x-deploy-token'
    });
    return res.end();
  }

  // GET: Status check
  if (req.method === 'GET') {
    if (pathname.includes('/status') || urlObj.searchParams.has('status')) {
      let statusData = { status: 'idle' };
      if (fs.existsSync(STATUS_FILE)) {
        try {
          statusData = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
        } catch {}
      }

      let recentLogs = [];
      if (fs.existsSync(LOG_FILE)) {
        try {
          const lines = fs.readFileSync(LOG_FILE, 'utf-8').split('\n').filter(Boolean);
          recentLogs = lines.slice(-40);
        } catch {}
      }

      return sendJson(200, {
        service: 'funoon-fiesta-deploy-webhook',
        uptimeSeconds: Math.floor(process.uptime()),
        deployment: statusData,
        recentLogs
      });
    }

    return sendJson(200, {
      service: 'funoon-fiesta-deploy-webhook',
      status: 'online',
      instructions: 'Send GitHub push webhooks to this endpoint (POST).'
    });
  }

  // POST: Trigger deployment
  if (req.method === 'POST') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks);
      const signature = req.headers['x-hub-signature-256'];
      const githubEvent = req.headers['x-github-event'] || 'push';

      // 1. Authenticate request
      const isSignatureValid = verifySignature(rawBody, signature);
      const isTokenValid = verifyToken(req, urlObj);

      if (!isSignatureValid && !isTokenValid) {
        console.warn(`[${new Date().toISOString()}] Unauthorized deploy attempt from ${req.socket.remoteAddress}`);
        return sendJson(401, { error: 'Unauthorized: Invalid signature or token' });
      }

      // Handle GitHub ping event
      if (githubEvent === 'ping') {
        console.log(`[${new Date().toISOString()}] Received ping event from GitHub`);
        return sendJson(200, { message: 'Pong! Webhook connected successfully' });
      }

      // Parse payload
      let payload = {};
      try {
        payload = JSON.parse(rawBody.toString('utf-8'));
      } catch {
        payload = {};
      }

      // 2. Branch filtering (only deploy 'main')
      if (payload.ref && payload.ref !== 'refs/heads/main') {
        console.log(`[${new Date().toISOString()}] Ignored push to branch ${payload.ref}`);
        return sendJson(200, {
          message: `Ignored: push was to branch '${payload.ref}', only 'refs/heads/main' triggers deployment`
        });
      }

      const commitSha = payload.after || (payload.head_commit && payload.head_commit.id) || 'manual-trigger';
      const commitMsg = payload.head_commit ? payload.head_commit.message : 'Manual/Webhook Trigger';
      const author = payload.head_commit ? (payload.head_commit.author.name || payload.head_commit.author.username) : 'unknown';

      console.log(`[${new Date().toISOString()}] 🚀 Launching deploy for commit ${commitSha.slice(0, 7)}: "${commitMsg}" by ${author}`);

      // 3. Spawn deploy script detached
      try {
        const child = spawn('/bin/bash', [DEPLOY_SCRIPT], {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();

        return sendJson(200, {
          success: true,
          message: 'Deployment triggered successfully',
          commit: commitSha.slice(0, 7),
          commitMessage: commitMsg,
          author,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Error spawning deploy.sh:`, err);
        return sendJson(500, { error: 'Failed to launch deployment script', details: err.message });
      }
    });
    return;
  }

  // Fallthrough
  sendJson(405, { error: 'Method Not Allowed' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[${new Date().toISOString()}] ✅ Funoon Fiesta Webhook Server listening on http://127.0.0.1:${PORT}`);
});
