'use strict';

const ngrok = require('ngrok');
const Fuse = require('../lib/');
const port = process.env.PORT || 3000;

ngrok.connect(port, function(err, url) {
  const fuse = Fuse({
    email_key: YOUR_SPARKPOST_KEY,
    domain: url,
    name: 'Robot', 
    sending_address: 'robot@sendmailfor.me',
    inbound_address: 'robot@sendmailfor.me'
  });

  fuse.setupTransport(function() {
    fuse.setupServer(port, function(err, server) {
      fuse.setupEndpoint(server);
    });
  });

  fuse.on('email_received', function(responder, inboundMessage) {
    responder.reply({
      body: 'Hey! I got your email from an ngrok tunnel.'
    });
  });
});