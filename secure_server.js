const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Configuration
const PORT = 8080;
const HOST = '0.0.0.0';
const PFX_FILE = 'cert.pfx';
const PASS = 'password';

console.log(`🔒 Starting Secure Server on https://${HOST}:${PORT}...`);

if (!fs.existsSync(PFX_FILE)) {
    console.error(`❌ Error: Certificate file '${PFX_FILE}' not found!`);
    process.exit(1);
}

const options = {
    pfx: fs.readFileSync(PFX_FILE),
    passphrase: PASS
};

// MIME Types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.wav': 'audio/wav',
    '.ico': 'image/x-icon',
    '.manifest': 'application/manifest+json',
    '.webmanifest': 'application/manifest+json'
};

https.createServer(options, (req, res) => {
    console.log(`${req.method} ${req.url}`);

    // Parse URL
    const parsedUrl = url.parse(req.url);
    let sanitizePath = path.normalize(parsedUrl.pathname).replace(/^(\.\.[\/\\])+/, '');
    let pathname = path.join(__dirname, sanitizePath);

    fs.exists(pathname, (exist) => {
        if (!exist) {
            res.statusCode = 404;
            res.end(`File ${pathname} not found!`);
            return;
        }

        if (fs.statSync(pathname).isDirectory()) {
            pathname += '/index.html';
        }

        fs.readFile(pathname, (err, data) => {
            if (err) {
                res.statusCode = 500;
                res.end(`Error getting the file: ${err}.`);
            } else {
                const ext = path.parse(pathname).ext;
                let contentType = mimeTypes[ext] || 'text/plain';

                // Special case for manifest.json
                if (pathname.endsWith('manifest.json')) {
                    contentType = 'application/manifest+json';
                }

                res.setHeader('Content-type', contentType);
                res.end(data);
            }
        });
    });
}).listen(PORT, HOST, () => {
    console.log(`✅ Secure Server Running! Access at: https://192.168.0.97:${PORT}`);
    console.log(`⚠️  Note: You must accept the 'Not Secure' warning in the browser.`);
});
