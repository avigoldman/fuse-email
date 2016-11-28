'use strict';

require('dotenv').config();

var SparkyBot = require('../lib/bot.js');

var port = process.env.PORT || 3000;

// create the email bot
var sparky = SparkyBot({
  email_key: process.env.SPARKPOST_KEY,
  bot_name: 'Me', 
  sending_address: 'me@sendmailfor.me',
  inbound_address: 'me@sendmailfor.me',
  domain: url
});


sparky.setupServer(port, function(err, server) {
  sparky.setupEndpoint(server);
});

sparky.on('email_received', function(bot, message) {
  bot.reply(message, {
    body: 'I\'m under construction, try again later.'
  });
});