const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

const complockSchema = new mongoose.Schema({
  reference: String,
  emailAddress: String,
  tokens: [],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Complock', complockSchema)