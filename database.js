const mongoose = require("mongoose");
mongoose.connect(process.env.PAYNOW_MONGO_URI);
module.exports = mongoose;
