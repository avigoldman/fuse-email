const htmlToText = require('html-to-text');
const parseReply = require('parse-reply');
const helpers = module.exports = {};

helpers.config = {
  htmlToTextOpts: {
    uppercaseHeadings: false
  }
};

helpers.clean = function(input) {
  return htmlToText.fromString(input, htmlToTextOpts).replace(/(\r\n|\n|\r)/gm, "").trim();
};

helpers.getLatest = function(message) {
  return parseReply(message.text);
};