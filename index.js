'use strict';
const ngrok = require('ngrok');
var SparkyBot = require('./lib/bot.js');

var port = process.env.PORT || 3000;

ngrok.connect(port, function (err, url) {
  // create the email bot
  var sparky = SparkyBot({
    email_key: '056cf4213c89156180708f57e3a38bed59451563',
    auth_token: 'my_secret_key',
    bot_name: 'sparky',
    // address: 'robot@aymlab.com', // sending_address and inbound_address can extend from this
    sending_address: 'robot@sendmailfor.me',
    inbound_address: 'robot@sendmailfor.me',
    domain: url,
    restrict_inbound: false,
    setup: true,
  });

  // sparky.hears('hello', 'email_received', function(bot, message) {
  //   bot.reply(message, {
  //     'body': 'Hello back to you'+JSON.stringify(message.matches, null, 2)
  //   });
  // });

  sparky.on('email_received', function(bot, message) {

    bot.startConversation('Tell me about yourself!', function(convo) {

      convo.ask({
        body: 'What\'s your name?'
      }, function(convo, response) {
        console.log(JSON.stringify(response, null, 2));
        convo.say({
          body: 'Hi ' + sparky.clean(response.text)
        });

        convo.end();
      });

    }); 

  });


  // start the server
  sparky.setupServer(port, function(err, server) {
    sparky.setupEndpoint(server, function() {
      // sparky.processMessage({
      //   "content": {
      //     "headers": [],
      //     "html": "<p>Hello there <strong>SparkPostians</strong>.</p>",
      //     "subject": "We come in peace",
      //     "text": "Hi there SparkPostians.",
      //     "to": [
      //       "robot@sendmailfor.me"
      //     ]
      //   },
      //   "msg_from": "avrahamymgoldman@gmail.com",
      //   "rcpt_to": "robot@sendmailfor.me",
      // });
    });
  });
});
