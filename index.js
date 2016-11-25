'use strict';
const ngrok = require('ngrok');
var Sparky = require('./lib/bot.js');

var port = process.env.PORT || 3000;

ngrok.connect(port, function (err, url) {

  var sparky = Sparky({
    email_key: '056cf4213c89156180708f57e3a38bed59451563',
    auth_token: 'my_secret_key',
    bot_name: 'sparky',
    // address: 'robot@aymlab.com', // sending_address and inbound_address can extend from this
    sending_address: 'robot@sendmailfor.me',
    inbound_address: 'robot@sendmailfor.me',
    domain: url,
    restrict_inbound: false,
    setup: true
  });

  sparky.on('email_received', function(bot, message) {
    bot.reply(message, {
      'body': 'Hello back to you'
    });
  });


  sparky.setupServer(port, function(err, server) {
    sparky.setupEndpoint(server, function() {
      // sparky.processMessage({
      //   "content": {
      //     "headers": [],
      //     "html": "<p>Hi there <strong>SparkPostians</strong>.</p>",
      //     "subject": "We come in peace",
      //     "text": "Hi there SparkPostians.",
      //     "to": [
      //       "robot@sendmailfor.me"
      //     ],
      //     "cc": [
      //       "jhacks.umd@gmail.com"
      //     ]
      //   },
      //   "msg_from": "avigoldmankid@gmail.com",
      //   "rcpt_to": "robot@sendmailfor.me",
      // });
    });
  });
});
