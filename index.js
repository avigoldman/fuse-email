'use strict';
const ngrok = require('ngrok');
var Sparky = require('./lib/bot.js');

var port = process.env.PORT || 3000;

ngrok.connect(port, function (err, url) {

  var sparky = Sparky({
    email_key: '056cf4213c89156180708f57e3a38bed59451563',
    auth_token: 'my_secret_key2',
    bot_name: 'robot',
    // address: 'robot@aymlab.com', // sending_address and inbound_address can extend from this
    sending_address: 'robot@aymlab.com',
    inbound_address: 'robot@sendmailfor.me',
    domain: url,
    setup: true
  });

  // Events
  // direct_email - email sent directly to the bot
  // cc_email - email was sent with the bot cc'ed
  // bcc_email - email was send with the bot bcc'ed
  // mention - the bot's name was said in an email
  // direct_mention - the bot's sending/inbound address was said in an email
  // email_received - an email of anytype was send to the bot

  // Bot
  // say - sends a new email
  // reply - sends a response email to the given message
  // startConversation - starts a conversation
  // 

  sparky.on('direct_email', function(bot, message) {
    console.log('direct mail!');
    console.log(message._raw);
  });

  sparky.on('mention', function(bot, message) {
    bot.say({
      'subject': 'Did someone say my name?',
      'body': 'Yes you did!',
    });
  });


  sparky.on('email_received', function(bot, message) {
    bot.say({
      'recipients': [ { 'address': 'avigoldmankid@gmail.com' } ],
      'subject': 'forward email',
      'body': message._raw.content.html,
    });
  });


  sparky.setupServer(port, function(err, server) {

    server.get('/', function(req, res) {
      res.send('server running');
    });

    server.post('/', function(req, res) {
      res.send('post running');
    });

    sparky.setupEndpoint(server, function() {});
  });
});


//   sparky.processMessage({
    //     "content": {
    //       "headers": [],
    //       "html": "<p>Hi there <strong>SparkPostians</strong>.</p>",
    //       "subject": "We come in peace",
    //       "text": "Hi there SparkPostians.",
    //       "to": [
    //         "robot@aymlab.com"
    //       ]
    //     },
    //     "msg_from": "avigoldmankid@gmail.com",
    //     "rcpt_to": "robot@aymlab.com",
    //   });