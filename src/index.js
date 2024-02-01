const register = require('./register');
const Client = require('./client.js');

module.exports = {
  listen,
  register,
};

async function listen(androidId, securityToken, persistentIds, keyHandler, notificationCallback) {
  const client = new Client(androidId, securityToken, persistentIds, keyHandler);
  client.on('ON_NOTIFICATION_RECEIVED', notificationCallback);
  client.connect();
  return client;
}
