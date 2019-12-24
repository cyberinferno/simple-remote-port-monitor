'use strict';

const axios = require('axios');
const config = require('./config.json');
const net = require('net');
const nodemailer = require('nodemailer');


const MILISECONDS_TO_SECONDS_FACTOR = 1000;
const DEFAULT_TIMEOUT_IN_SECONDS = 10000;

var notificationLog = {};
try {
  console.log(`
  /$$$$$$$                        /$$           /$$      /$$                     /$$   /$$
  | $$__  $$                      | $$          | $$$    /$$$                    |__/  | $$
  | $$  \ $$  /$$$$$$   /$$$$$$  /$$$$$$        | $$$$  /$$$$  /$$$$$$  /$$$$$$$  /$$ /$$$$$$    /$$$$$$   /$$$$$$
  | $$$$$$$/ /$$__  $$ /$$__  $$|_  $$_/        | $$ $$/$$ $$ /$$__  $$| $$__  $$| $$|_  $$_/   /$$__  $$ /$$__  $$
  | $$____/ | $$  \ $$| $$  \__/  | $$          | $$  $$$| $$| $$  \ $$| $$  \ $$| $$  | $$    | $$  \ $$| $$  \__/
  | $$      | $$  | $$| $$        | $$ /$$      | $$\  $ | $$| $$  | $$| $$  | $$| $$  | $$ /$$| $$  | $$| $$
  | $$      |  $$$$$$/| $$        |  $$$$/      | $$ \/  | $$|  $$$$$$/| $$  | $$| $$  |  $$$$/|  $$$$$$/| $$
  |__/       \______/ |__/         \___/        |__/     |__/ \______/ |__/  |__/|__/   \___/   \______/ |__/

                          ~~~~~~~~~~ By cyberinferno  ~~~~~~~~~~
  `);

  startMonitoring();
} catch (e) {
  console.log(e);
}

// TODO: Make sure config is valid

function startMonitoring() {
  console.log('Starting monitoring service...');
  if (!config['services'] || !config['services'].length) {
    console.log('No services have been configured to be monitored!');
  } else {
    checkAndNotifyAllServices();
    setInterval(checkAndNotifyAllServices, config['monitor_interval'] * MILISECONDS_TO_SECONDS_FACTOR);
  }
}

function checkAndNotifyAllServices() {
  config['services'].forEach(service => {
    if (service.host && service.port && service.name) {
      console.log(`Checking ${service.name} connectivity...`);
      checkConnection(service.name, service.host, service.port)
        .then(result => {
          console.log(`${result.name} connectivity check succeeded!`);
          if (notificationLog[result.name]) {
            delete notificationLog[result.name];
          }
        }).catch(result => {
          console.log(`${result.name} connectivity check failed!`);
          notifyFailure(result);
        });
    }
  });
}

function notifyFailure(data) {
  let currentTime = process.hrtime();
  // Do not notify if interval has not reached
  const notification = notificationLog[data.name];
  if (notification && currentTime[0] - notification < config['notify_interval']) {
    return;
  }
  notificationLog[data.name] = currentTime[0];

  const notificationMsg = `@here ${data.name} service with host ${data.host}\
 and port ${data.port} has gone down!`;
  if (config['discord_webhooks'] && config['discord_webhooks'].length) {
    config['discord_webhooks'].forEach(webhook => discordNotification(webhook, notificationMsg));
  }

  if (config['notify_emails'] && config['notify_emails'].length) {
    config['notify_emails'].forEach(email => emailNotification(email, notificationMsg, notificationMsg));
  }
}

async function discordNotification(webhookUrl, content) {
  try {
    await axios.post(webhookUrl, {
      content: content
    });
  } catch (err) {
    console.log(err);
  }
}

function emailNotification(toAddress, subject, body) {
  if (config['smtp_transport'] && config['smtp_transport']['host']) {
    let transporter = nodemailer.createTransport(config['smtp_transport']);
    transporter.sendMail({
      from: config['smtp_transport']['auth']['user'],
      to: toAddress,
      subject: subject,
      text: body
    });
  }
}

function checkConnection(serviceName, host, port) {
  return new Promise((resolve, reject) => {
    const connectionTimeout = config['connection_timeout'];
    const timeout = connectionTimeout ? connectionTimeout * MILISECONDS_TO_SECONDS_FACTOR :
      DEFAULT_TIMEOUT_IN_SECONDS;
    const timer = setTimeout(() => {
      reject('timeout');
      socket.end();
    }, timeout);
    const socket = net.createConnection(port, host, () => {
      clearTimeout(timer);
      resolve({
        name: serviceName,
        host: host,
        port: port
      });
      socket.end();
    });
    socket.on('error', (err) => {
      clearTimeout(timer);
      reject({
        name: serviceName,
        host: host,
        port: port,
        error: err
      });
    });
  });
}
