/**
 * Simple port monitor and restart tool
 */

const axios = require('axios');
const config = require('config');
const net = require('net');
const nodemailer = require('nodemailer');
const { exec } = require('child_process');

const MILLISECONDS_TO_SECONDS_FACTOR = 1000;
const DEFAULT_TIMEOUT_IN_SECONDS = 10;

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

// Start monitoring process
function startMonitoring() {
  console.log('Starting monitoring service...');
  if (!config['services'] || !config['services'].length) {
    console.log('No services have been configured to be monitored!');
  } else {
    checkAndNotifyAllServices();
    setInterval(checkAndNotifyAllServices, config['monitor_interval'] * MILLISECONDS_TO_SECONDS_FACTOR);
  }
}

// Function thats called at given interval which checks services and notifies if down
function checkAndNotifyAllServices() {
  config['services'].forEach(service => {
    if (service.host && service.port && service.name) {
      console.log(`Checking ${service.name} connectivity...`);
      checkConnection(service)
        .then(result => {
          console.log(`${result.name} connectivity check succeeded!`);
          if (notificationLog[result.name]) {
            delete notificationLog[result.name];
          }
        }).catch(result => {
          console.log(`${result.name} connectivity check failed!`);
          if (result.command) {
            executeCommand(result.command);
          }
          notifyFailure(result);
        });
    }
  });
}

// Notify failure
function notifyFailure({name, host, port, command}) {
  let currentTime = process.hrtime();
  // Do not notify if interval has not reached
  const notification = notificationLog[name];
  if (notification && currentTime[0] - notification < config['notify_interval']) {
    return;
  }

  // Set current time as last notification time
  notificationLog[name] = currentTime[0];

  // Generate failure message
  let notificationMsg;
  if (command) {
    notificationMsg = renderTemplate(config['message_strings']['failure_with_command'], {name, host, port, command});
  } else {
    notificationMsg = renderTemplate(config['message_strings']['failure'], {name, host, port});
  }

  // Discord notification
  if (config['discord_webhooks'] && config['discord_webhooks'].length) {
    config['discord_webhooks'].forEach(webhook => discordNotification(webhook, notificationMsg));
  }

  // Email notification
  if (config['notify_emails'] && config['notify_emails'].length) {
    config['notify_emails'].forEach(email => emailNotification(email, notificationMsg, notificationMsg));
  }
}

// Discord webhook notification
function discordNotification(webhookUrl, content) {
  try {
    axios.post(webhookUrl, {
      content: content,
    });
  } catch (err) {
    console.log(err);
  }
}

// SMTP email notification
function emailNotification(toAddress, subject, body) {
  if (config['smtp_transport'] && config['smtp_transport']['host']) {
    let transporter = nodemailer.createTransport(config['smtp_transport']);
    transporter.sendMail({
      from: config['smtp_transport']['auth']['user'],
      to: toAddress,
      subject: subject,
      text: body,
    });
  }
}

// Checks whether the service port is open by trying to connect to it
function checkConnection({name, host, port, command}) {
  return new Promise((resolve, reject) => {
    const connectionTimeout = config['connection_timeout'];
    const timeout = connectionTimeout ? connectionTimeout * MILLISECONDS_TO_SECONDS_FACTOR :
      DEFAULT_TIMEOUT_IN_SECONDS;
    const timer = setTimeout(() => {
      reject('timeout');
      socket.end();
    }, timeout);
    const socket = net.createConnection(port, host, () => {
      clearTimeout(timer);
      resolve({
        name,
        host,
        port,
      });
      socket.end();
    });
    socket.on('error', (error) => {
      clearTimeout(timer);
      reject({
        name,
        host,
        port,
        error,
        command,
      });
    });
  });
}

// Executes failure command
function executeCommand(command) {
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.log(`${command} error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.log(`${command} stderr: ${stderr}`);
      return;
    }
    console.log(`${command} stdout: ${stdout}`);
  });
}

// Ref: https://stackoverflow.com/questions/29182244/convert-a-string-to-a-template-string
function Prop(obj, is, value) {
  if (typeof is === 'string')
    is = is.split('.');
  if (is.length === 1 && value !== undefined)
    // eslint-disable-next-line no-return-assign
    return obj[is[0]] = value;
  else if (is.length === 0)
    return obj;
  else {
    var prop = is.shift();
    // Forge a path of nested objects if there is a value to set
    if (value !== undefined && obj[prop] === undefined) obj[prop] = {};
    return Prop(obj[prop], is, value);
  }
}

// Ref: https://stackoverflow.com/questions/29182244/convert-a-string-to-a-template-string
function renderTemplate(str, obj) {
  return str.replace(/\$\{(.+?)\}/g, (match, p1) => {
    return Prop(obj, p1);
  });
}
