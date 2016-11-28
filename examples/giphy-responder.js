'use strict';

require('dotenv').config();

const fs = require('fs');
const axios = require('axios');
const template = fs.readFileSync('./templates/giphy-responder.html', { encoding: 'utf8' });

var EmailBot = require('../lib/bot.js');

var port = process.env.PORT || 3000;

// create the email bot
var sparky = EmailBot({
  email_key: process.env.SPARKPOST_KEY,
  bot_name: 'Gif me', 
  sending_address: 'gifme@sendmailfor.me',
  inbound_address: 'gifme@sendmailfor.me',
  domain: YOUR_DOMAIN
});


sparky.setupServer(port, function(err, server) {
  sparky.setupEndpoint(server);
});

sparky.on('email_received', function(bot, message) {

  getGifs(message.subject, (err, gifs) => {
    if (err) {
      console.log(err);
      return;
    }

    bot.reply(message, {
      html: template,
      text: 'HTML is required',
      substitution_data: {
        search: message.subject,
        gifs: gifs
      },
    });

  })
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
      });
    }

    cb(null, gifs);
  })
  .catch(err => {
    cb(err);
  });
}

