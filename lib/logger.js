module.exports = {
  log: function() {
    console.log.apply(null, arguments);
  },
  warn: function() {
    console.log.apply(null, arguments);
  },
  debug: function() {
    console.log.apply(null, arguments);
  }
};