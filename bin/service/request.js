'use strict';

const https = require('https');
const querystring = require('querystring');

const HEADER_FORM = {
  'Content-Type': 'application/x-www-form-urlencoded',
};

const HEADER_JSON = {
  'Content-Type': 'application/json',
};

module.exports = async function(method, url, headers = {}, data = '') {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers,
    };

    const req = https.request(url, options, (res) => {
      const chunks = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });

    switch (headers['Content-Type']) {
      case HEADER_FORM['Content-Type']:
        req.end(querystring.stringify(data || ''));
        break;

      case HEADER_JSON['Content-Type']:
        req.end(JSON.stringify(data || null));
        break;

      default:
        req.end();
        break;
    }
  });
};
