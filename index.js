'use strict';
const ngrok = require('ngrok');
const fs = require('fs');
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
        convo.say({
          body: 'Hi ' + sparky.clean(sparky.getLatest(response))
        });

        convo.end();
      });

    }); 

  });


  // start the server
  sparky.setupServer(port, function(err, server) {
    sparky.setupEndpoint(server, function() {
      // var data = JSON.parse(fs.readFileSync('./test.json', {
      //   encoding: 'utf8'
      // }))._raw;
      // console.log(Object.keys(data));
      // console.log(sparky.convos.length);
      // sparky.processMessage(data);
    });
  });
});
