'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const opts = {cwd: __dirname};
const pluginRegExp = /(?<=^VERSION=).*$/m;
const packageRegExp = /(?<=^\s*"version"\s*:\s*").*(?=",$)/m;
const version = process.argv[2];

function replaceInFile(file, regexp, replacement) {
  const fullPath = path.join(__dirname, file);
  const contents = fs.readFileSync(fullPath, 'utf-8');

  fs.writeFileSync(fullPath, contents.replace(regexp, replacement));
}

// Clean al the stuff.
childProcess.spawnSync('git', ['clean', '-xdf'], opts);

// Modify files with the version.
replaceInFile('plugin.cfg', pluginRegExp, version);
replaceInFile('package.json', packageRegExp, version);
replaceInFile('package-lock.json', packageRegExp, version);
replaceInFile('bin/service/package.json', packageRegExp, version);
replaceInFile('bin/service/package-lock.json', packageRegExp, version);

// Commit the modifications.
childProcess.spawnSync('git', ['add', '.'], opts);
childProcess.spawnSync('git', ['commit', '-m', 'Version ' + version], opts);

// Generate the zip.
childProcess.spawnSync(
  'zip',

  [
    '-r',
    '-9',
    version + '.zip',
    'bin',
    'config',
    'daemon',
    'icons',
    'uninstall',
    'webfrontend',
    'plugin.cfg',
    'preupgrade.sh',
    'postinstall.sh',
  ],

  opts,
);
