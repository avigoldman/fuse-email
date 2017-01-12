'use strict';

const Fuse = require('../lib/');
const port = process.env.PORT || 3000;

const fuse = Fuse({
  email_key: YOUR_SPARKPOST_KEY,
  domain: YOUR_DOMAIN,
  name: 'Robot', 
  sending_address: 'robot@sendmailfor.me',
  inbound_address: 'robot@sendmailfor.me',
});

fuse.setupTransport(function() {
  fuse.setupServer(port, function(err, server) {
    fuse.setupEndpoint(server);
  });
});

fuse.on('email_received', function(responder, inboundMessage) {
  responder.send({
    subject: 'I\'m out',
    body: 'I\'m out of the office this week.'
  });
});