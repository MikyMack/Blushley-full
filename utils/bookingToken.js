const crypto = require('crypto');

function generateBookingToken() {
  return "BLUSH-" + crypto.randomBytes(4).toString('hex').toUpperCase();
}

module.exports = generateBookingToken;
