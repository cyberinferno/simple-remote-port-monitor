"use strict";

const net = require("net");
const nodemailer = require("nodemailer");
const Promise = require("bluebird");
const axios = require('axios');
const fs = require('fs');

var config = {};
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
  config = require("./config.json");
  startMonitoring();
} catch (e) {
  console.log(e);
}

function checkConnection(serviceName, host, port, timeout) {
  return new Promise(function (resolve, reject) {
    timeout = config['connection_timeout'] ? config['connection_timeout'] * 1000 : 10000;
    var timer = setTimeout(function () {
      reject("timeout");
      socket.end();
    }, timeout);
    var socket = net.createConnection(port, host, function () {
      clearTimeout(timer);
      resolve({
        name: serviceName,
        host: host,
        port: port
      });
      socket.end();
    });
    socket.on("error", function (err) {
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

function startMonitoring() {
  console.log('Starting monitoring service...');
  if (config['services'] === undefined || config['services'].length === undefined || config['services'].length == 0) {
    console.log('No services have been configured to be monitored!');
  } else {
    checkAndNotifyAllServices();
    setInterval(checkAndNotifyAllServices, config['monitor_interval'] * 1000);
  }
}

function checkAndNotifyAllServices() {
  for (var i = 0; i < config['services'].length; i++) {
    if (config['services'][i].host && config['services'][i].port && config['services'][i].name) {
      console.log('Checking ' + config['services'][i].name + ' connectivity...');
      checkConnection(config['services'][i].name, config['services'][i].host, config['services'][i].port)
        .then(function (data) {
          console.log(data.name + ' connectivity check succeeded!');
          // Reset notification time so that it notifies intermittent service downtime
          if (notificationLog[data.name]) {
            delete notificationLog[data.name];
          }
        })
        .catch(function (data) {
          console.log(data.name + ' connectivity check failed!');
          notifyFailure(data);
        });
    }
  }
}

function notifyFailure(data) {
  let currentTime = process.hrtime();
  // Do not notify if interval has not reached
  if (notificationLog[data.name] && currentTime[0] - notificationLog[data.name] < config['notify_interval']) {
    return;
  }
  notificationLog[data.name] = currentTime[0];
  if (config['discord_webhooks'] !== undefined && config['discord_webhooks'].length !== undefined && config['discord_webhooks'].length !== 0) {
    for (var i = 0; i < config['discord_webhooks'].length; i++) {
      discordNotification(config['discord_webhooks'][i],
        '@here ' + data.name + ' service with host ' + data.host + ' and port ' + data.port + ' has gone down!'
      );
    }
  }
  if (config['notify_emails'] !== undefined && config['notify_emails'].length !== undefined && config['notify_emails'].length !== 0) {
    for (var i = 0; i < config['notify_emails'].length; i++) {
      emailNotification(
        config['notify_emails'][i],
        data.name + ' service has gone down',
        data.name + ' service with host ' + data.host + ' and port ' + data.port + ' has gone down!'
      );
    }
  }
}

function discordNotification(webhookUrl, content) {
  axios.post(webhookUrl, {
    content: content
  }).catch(function (error) {
    console.log(error);
  });
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
