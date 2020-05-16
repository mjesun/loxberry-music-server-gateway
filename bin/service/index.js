'use strict';

const http = require('http');
const path = require('path');
const querystring = require('querystring');

const MusicServer = require('./music-server');

const cfg = require('./cfg');
const restart = require('./handlers/restart');

const headers = {
  'Content-Type': 'text/plain; charset=utf-8',
};

Error.stackTraceLimit = Infinity;

(function() {
  const oldParse = JSON.parse;

  JSON.parse = function(str) {
    try {
      return oldParse.apply(this, arguments);
    } catch (err) {
      const position = +err.message.match(/\d+$/)[0];

      const fragment = (str + '').slice(
        Math.max(0, position - 16),
        Math.min(str.length, position + 17),
      );

      const cleanStr = (str + '').replace(/[\r\n]+\s*/g, '');
      const cleanFragment = (fragment + '').replace(/[\r\n]+\s*/g, '');

      throw new Error(
        `Could not parse JSON <${cleanStr}>: error in position ${position} (around <${cleanFragment}>)`,
      );
    }
  };
})();

http
  .createServer(async (req, res) => {
    try {
      const index = req.url.indexOf('?');
      const url = index === -1 ? req.url : req.url.substr(0, index);
      const query = querystring.parse(req.url.substr(url.length + 1));

      switch (true) {
        case /\/restart(?:\/|$)/.test(url):
          res.writeHead(200, headers);
          res.end(await restart(url, query));
          break;

        default:
          res.writeHead(404, headers);
          res.end();
          break;
      }
    } catch (err) {
      res.writeHead(500, headers);
      res.end(err.stack);
    }
  })
  .listen(7090);

let config = null;

try {
  config = cfg.read(path.join('REPLACELBPCONFIGDIR', 'data.cfg'));
} catch (err) {
  config = {data: {'http-gateway': 'http://localhost:8091'}};
}

const server = new MusicServer({
  port: 7091,
  gateway: config.data['http-gateway'],
});

server.start();
