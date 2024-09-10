const register = require('./register');
const Client = require('./client.js');
const AndroidFCM = require('./android/fcm.js');

module.exports = {
  listen,
  register,
  AndroidFCM,
  Client,
};

async function listen(androidId, securityToken, persistentIds, notificationCallback) {
  const client = new Client(androidId, securityToken, persistentIds);
  client.on('ON_NOTIFICATION_RECEIVED', notificationCallback);
  client.connect();
  return client;
}
