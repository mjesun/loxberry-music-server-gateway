'use strict';

const fs = require('fs');

module.exports = {
  read(path) {
    const data = fs.readFileSync(path, 'utf8');
    const sections = Object.create(null);

    data.split(/(?=(?:\n|^)\[.*?\])/g).forEach((part) => {
      const section = Object.create(null);
      const regExp = /^\s*?(.*?)\s*?=\s*?(.*?)\s*?$/gm;
      let match;

      while ((match = regExp.exec(part))) {
        section[match[1]] = match[2];
      }

      sections[part.match(/\[(.*?)\]/)[1].trim()] = section;
    });

    return sections;
  },
};
