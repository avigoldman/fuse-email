'use strict';

const htmlToText = require('html-to-text');
const parseReply = require('parse-reply');
const utils = module.exports = {};

utils.config = {
  htmlToTextOpts: {
    uppercaseHeadings: false
  }
};

utils.clean = function(input) {
  return htmlToText.fromString(input, utils.config.htmlToTextOpts).replace(/(\r\n|\n|\r)/gm, " ").trim();
};

utils.getLatest = function(inboundMessage) {
  return parseReply(inboundMessage.text);
};