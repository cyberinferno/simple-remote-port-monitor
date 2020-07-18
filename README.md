# Simple remote port monitor tool

A simple configurable tool to monitor remote ports and notify if connectivity fails. If the application is running in same server as the service, a command can be configured to be executed on connectivity check failure.

**Discord channel** as well as **Email** notifications are currently available.

## Requirement

- NodeJS v8 or above.
- Discord server (If Discord notifications are required)
- SMTP email server (If email notifications are required)

## Installation

- Install latest LTS version NodeJS (Refer https://nodejs.org).
- Clone this repository.
- Run `npm install` command in the project directory to install all dependencies.
- Create the file `development.json` or `production.json` based upon environment to override default config.
- Run `node app.js` command in the project directory to start the monitoring for testing purpose.
- Install PM2 (Refer https://pm2.keymetrics.io/) and run the command `pm2 start app.js` in the project directory to run it as a background service in your server.

### Configurations

| Key                | Description                                                             |
| ------------------ | ----------------------------------------------------------------------- |
| notify_interval    | How often you want to get notified of a service disruption (In seconds) |
| monitor_interval   | How often tool should check connectivity (In seconds)                   |
| connection_timeout | How long to wait before timing out the service connection (In seconds)  |
| discord_webhooks   | Array of Discord webhooks to which notification will be sent            |
| notify_emails      | Array of emails to which notification will be sent                      |
| smtp_transport     | SMTP server details using which tool will send emails                   |
| message_strings    | Holds text that is sent when a service is down                          |

### Example Configuration

This is a full config example with restart command, discord webhook and SMTP configurations included for reference purpose

```
{
  "notify_interval": 900,
  "monitor_interval": 60,
  "connection_timeout": 30,
  "services": [{
    "name": "My local web server",
    "host": "127.0.0.1",
    "port": 80,
    "command": "sudo service apache2 restart"
  }],
  "discord_webhooks": [
    "https://discordapp.com/api/webhooks/{id}/{token}"
  ],
  "notify_emails": [
    "email@example.com"
  ],
  "smtp_transport": {
    "host": "smtp.example.com",
    "port": 587,
    "secure": false,
    "tls": {
      "rejectUnauthorized": false
    },
    "auth": {
      "user": "email@example.com",
      "pass": "password"
    }
  }
}
```
