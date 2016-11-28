'use strict';

require('dotenv').config();

const ngrok = require('ngrok');

var SparkyBot = require('../lib/bot.js');

var port = process.env.PORT || 3000;

ngrok.connect(port, function (err, url) {
  // create the email bot
  var sparky = SparkyBot({
    email_key: process.env.SPARKPOST_KEY,
    bot_name: 'Robot', 
    sending_address: 'robot@sendmailfor.me',
    inbound_address: 'robot@sendmailfor.me',
    domain: url
  });


  sparky.setupServer(port, function(err, server) {
    sparky.setupEndpoint(server);
  });

  sparky.hears(['hello', 'hi', 'howdy', 'hey'], 'email_received', function(bot, message) {

    bot.startPrivateConversation('Tell me about yourself.', function(convo) {
      convo.ask({
        body: 'What\'s your name?',
      }, function(convo, response) {
        convo.ask({
          body: 'Nice to meet you, {{ name }}. <br>How old are you?',
          substitution_data: {
            name: sparky.clean(sparky.getLatest(response))
          }
        }, function(convo, response) {
          let body = 'Congratulations, you can vote!';
          let age = parseInt(sparky.clean(sparky.getLatest(response)));

          if (age < 18)
            body = 'Looks like you can\'t vote yet. Only {{years_till_18}} to go!';
          convo.say({
            body: body,
            substitution_data: {
              years_till_18: 18 - age
            }
          });
        });
      });
    });
  });
});

var getGifs = function (subject, cb) {
  
  axios.get('http://api.giphy.com/v1/gifs/search', {
    params: {
      api_key: 'dc6zaTOxFJmzC',
      q: subject,
      rating: 'pg',
      limit: 5
    }
  })
  .then((response) => {
    let data = response.data.data;
    let gifs = [];
    for (let i = 0; i < data.length; i++) {
      gifs.push({
        src: data[i].images.fixed_height_small.url,
        url: data[i].url
      })
    }

    cb(null, gifs);
  })
  .catch(err => {
    cb(err);
  });
}

