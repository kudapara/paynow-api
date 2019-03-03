const mongoose = require("../database");
const accountsSchema = new mongoose.Schema({
  emailAddress: String,
  totalContributed: Number,
  currentBalance: { type: Number, default: 0 },
  latestTransaction: {
    reference: String,
    transactionType: String,
    date: Date,
    amount: Number
  }
});

accountsSchema.statics.updateBalance = async function({
  emailAddress,
  transaction,
  increase = 1,
  isSystemBalance = false
}) {
  const account = await this.findOne({ emailAddress });
  console.log("done searching user");
  console.log(account);
  if (account) {
    console.log("found out account exists, update balance");
    // Update their account
    await this.update(
      { emailAddress },
      {
        $inc: {
          totalContributed: isSystemBalance
            ? 0
            : parseFloat(transaction.payload.amount),
          currentBalance: increase * parseFloat(transaction.payload.amount)
        },
        latestTransaction: {
          transactionType: "debit",
          reference: transaction.reference,
          date: Date.now(),
          amount: parseFloat(transaction.payload.amount)
        }
      }
    );
  } else {
    console.log("Found out account doest exist. Creeate account with balance");
    const newAccount = new this({
      emailAddress,
      totalContributed: parseFloat(transaction.payload.amount),
      currentBalance: parseFloat(transaction.payload.amount),
      latestTransaction: {
        transactionType: "debit",
        reference: transaction.reference,
        date: Date.now(),
        amount: parseFloat(transaction.payload.amount)
      }
    });
    await newAccount.save();
  }
};

module.exports = mongoose.model("Account", accountsSchema);
