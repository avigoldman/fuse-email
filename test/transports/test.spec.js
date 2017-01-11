'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require("sinon");
const loggerSpy = sinon.spy();
const logger = { debug: loggerSpy, verbose: loggerSpy };
const fs = require('fs');
const transports = [];
const _ = require('lodash');
chai.use(require('sinon-chai'));

fs.readdir(__dirname+'/../../lib/transports/', (err, files) => {
  files.forEach(file => {
    if (file.indexOf('transport.js') === -1) {
      transports.push(file);
    }
  });
});


describe('Transports', function() {
  
});