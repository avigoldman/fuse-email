'use strict';

const chai = require('chai');
const expect = chai.expect;
const utils = require('../lib/utils');

let testMessage = {text: `The latest message

On Sun, Jan 8, 2017 at 2:09 PM Company <test@sendmailfor.me> wrote:

> The first message
>`};

describe('utils', function() {
  it('should clean up a multi-line html block', function() {
    let html = `<h1>My title</h1>
    <ul>
    <li>List item 1</li>
    <li>List item 2</li>
    <li>List item 3</li>
    </ul>`;

    expect(utils.clean(html)).to.equal('My title  * List item 1  * List item 2  * List item 3');
  });

  it('should get the latest message from an email thread', function() {
    expect(utils.getLatest(testMessage)).to.equal('The latest message\n\n');
  });

  it('should get the cleaned latest message', function() {
    expect(utils.clean(utils.getLatest(testMessage))).to.equal('The latest message');
  });
});