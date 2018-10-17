const mongoose = require('./database')
const TransactionSchema = new mongoose.Schema({
  reference: String,
  type: String,
  payload: Object,
  /*
    reference: String,
    paynowreference: String,
    amount: String,
    status: String,
    pollurl: String,
    hash: String,
  */
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

TransactionSchema.methods.updateAccountBalances = async function (reference = '') {
  const transactionStream = await this.model('Transaction').find({ reference })
  const shouldUpdateAccountBalance = transacrionStream.filter(transaction => transaction.type === 'transaction-success' )
  if (shouldUpdateAccountBalance.length > 0) {
    const account = await this.model('Account').findOne({ emailAddress: transaction.payload.authemail })
    if (account) {
      await this.model('Account').update({ emailAddress: transaction.payload.authemail}, { $inc: { totalContributed: transaction.payload.total } });
    } else {
      await this.model('Account').insert({ emailAddress: transaction.payload.authemail, totalContributed: transaction.payload.total });
    }

    return await this.model('MainAccount').update({ emailAddress: 'kgparadzayi@gmail.com' }, { $inc: { currentBalance: transaction.payload.total, totalContributed: transaction.payload.total } })
  }
}

module.exports = mongoose.model('Transaction', TransactionSchema)

// module.exports = {
//   getAllSuccessfullTransactionEvents () {},
//   getAllCanselledTransactionEvents () {},
//   getTotalAmountPaidByUser () {},
//   aggregateAccountBalance () {}
// }