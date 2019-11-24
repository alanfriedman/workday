const crypto = require('crypto')

function getUUID() {
  return new Promise(resolve => {
    crypto.randomBytes(16, function(err, buffer) {
      const token = buffer.toString('hex');
      resolve(token)
    });
  });
}

module.exports.getUUID = getUUID;