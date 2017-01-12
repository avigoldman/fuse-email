'use strict';

const fs = require('fs');
const axios = require('axios');
const template = fs.readFileSync('./templates/giphy-responder.html', { encoding: 'utf8' });

const Fuse = require('../lib/');
const port = process.env.PORT || 3000;

const fuse = Fuse({
  email_key: YOUR_SPARKPOST_KEY,
  domain: YOUR_DOMAIN,
  name: 'Gif me', 
  sending_address: 'gifme@sendmailfor.me',
  inbound_address: 'gifme@sendmailfor.me'
});

fuse.setupTransport(function() {
  fuse.setupServer(port, function(err, server) {
    fuse.setupEndpoint(server);
  });
});

fuse.on('email_received', function(responder, inboundMessage) {
  getGifs(inboundMessage.subject, (err, gifs) => {
    if (err) {
      return;
    }

    responder.reply({
      html: template,
      text: 'HTML is required',
      substitution_data: {
        search: inboundMessage.subject,
        gifs: gifs
      },
    });
  });
});

function getGifs(q, callback) {
  axios.get('http://api.giphy.com/v1/gifs/search', {
    params: {
      api_key: 'dc6zaTOxFJmzC',
      q: q,
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

    callback(null, gifs);
  })
  .catch(err => {
    callback(err);
  });
}