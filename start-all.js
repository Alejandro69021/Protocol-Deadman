/**
 * START ALL BOTS (BRIDGE & AI UTY)
 * Includes Health Check Web Server for Cloud Deployment (Render/Koyeb/Railway)
 */
const { spawn } = require('child_process');
const http = require('http');

console.log("[SUPERVISOR] Starting Deadman Bridge & AI Uty Bots...");

// Web Server Ringan untuk Health Check Port di Cloud
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        status: "ONLINE",
        message: "Deadman Bridge & AI Uty Bot are Running 24/7!",
        timestamp: new Date().toISOString()
    }));
});

server.listen(PORT, () => {
    console.log(`[HEALTH-CHECK] HTTP Server listening on port ${PORT}`);
});

function launch(name, script) {
    const p = spawn('node', [script], { stdio: 'inherit', env: process.env });
    p.on('exit', (code) => {
        console.log(`[SUPERVISOR] ${name} exited with code ${code}. Restarting in 3s...`);
        setTimeout(() => launch(name, script), 3000);
    });
    return p;
}

launch("BRIDGE", "telegram-bridge.js");
launch("AI_UTY", "ai-uty-bot.js");
