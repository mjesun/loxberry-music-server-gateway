'use strict';

module.exports = async function(url, query) {
  setTimeout(() => {
    process.exit(+query.code);
  }, 1000);

  return 'Exiting with code ' + query.code;
};
