const mongoose = require('./database')
const TransactionSchema = new mongoose.Schema({
  reference: String,
  paynowreference: String,
  amount: String,
  status: String,
  pollurl: String,
  hash: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
})

TransactionSchema.methods.getAllTransactionEvents = async function (filters = {}) {
  return this.model('Transaction').find(filters);
}

TransactionSchema.methods.saveTransactionEvent = async function () {
  return this.save()
}

module.exports = mongoose.model('Transaction', TransactionSchema)

// module.exports = {
//   getAllSuccessfullTransactionEvents () {},
//   getAllCanselledTransactionEvents () {},
//   getTotalAmountPaidByUser () {},
//   aggregateAccountBalance () {}
// }