#!/usr/bin/env node
/**
 * Upload PDF to OBS using Node.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const OBS_HOST = 'obs.dimond.top';
const filename = 'resume_optimization_guide.pdf';
const filePath = '/home/agent/.claude/workspace/project/uploads/resume_optimization_guide.pdf';

async function uploadFile() {
  return new Promise((resolve, reject) => {
    const fileContent = fs.readFileSync(filePath);
    const options = {
      hostname: OBS_HOST,
      port: 80,
      path: '/' + filename,
      method: 'PUT',
      headers: {
        'Content-Length': fileContent.length,
        'Content-Type': 'application/pdf'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log('Upload successful!');
          console.log(`URL: http://${OBS_HOST}/${filename}`);
          resolve();
        } else {
          console.log(`Response: ${data}`);
          reject(new Error(`Upload failed with status ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error('Error:', err.message);
      reject(err);
    });

    req.write(fileContent);
    req.end();
  });
}

uploadFile().catch(console.error);