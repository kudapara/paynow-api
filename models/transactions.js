const mongoose = require("../database");

const AccountModel = require("./accounts");

const TransactionSchema = new mongoose.Schema({
  reference: String,
  type: String,
  status: String,
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
});

TransactionSchema.methods.getAllTransactionEvents = async function(
  filters = {}
) {
  return this.model("Transaction").find(filters);
};

TransactionSchema.methods.saveTransactionEvent = async function() {
  return this.save();
};

TransactionSchema.methods.updateAccountBalances = async function(
  reference = ""
) {
  const transactionStream = await this.model("Transaction").find({ reference });
  console.log(transactionStream);
  const { authemail: emailAddress } = transactionStream.find(({ status }) => {
    console.log(status);
    return status === "transaction-initiated";
  }).payload.user;
  console.log("Chekcing if there is a success account");
  const shouldUpdateAccountBalance = transactionStream.filter(
    transaction => transaction.status === "transaction-paid"
  );
  if (shouldUpdateAccountBalance.length > 0) {
    console.log("Found out that there is a account to update");
    const transaction = shouldUpdateAccountBalance[0];
    const account = await AccountModel.findOne({ emailAddress });
    console.log("done searching user");
    console.log(account);

    if (account) {
      console.log("found out account exists, update balance");
      // Update their account
      await AccountModel.update(
        { emailAddress },
        {
          $inc: { totalContributed: parseFloat(transaction.payload.amount) },
          latestTransaction: {
            transactionType: "debit",
            reference,
            date: Date.now(),
            amount: parseFloat(transaction.payload.amount)
          }
        }
      );
    } else {
      console.log(
        "Found out account doest exist. Creeate account with balance"
      );
      const newAccount = new AccountModel({
        emailAddress,
        totalContributed: parseFloat(transaction.payload.amount),
        currentBalance: 0,
        latestTransaction: {
          transactionType: "debit",
          reference,
          date: Date.now(),
          amount: parseFloat(transaction.payload.amount)
        }
      });
      await newAccount.save();
    }

    console.log("update my main account");
    // Update my personal account to reflect the total amount that I have recieved
    return await AccountModel.update(
      { emailAddress: "kgparadzayi@gmail.com" },
      {
        $inc: { currentBalance: parseFloat(transaction.payload.amount) },
        latestTransaction: {
          transactionType: "credit",
          reference,
          date: Date.now(),
          amount: parseFloat(transaction.payload.amount)
        }
      }
    );
  }
};

// new methods, prompted by printshops
TransactionSchema.statics.checkIfTransactionIsPaid = async function(reference) {
  const transactionStream = await this.model("Transaction").find({ reference });
  console.log(transactionStream);

  const shouldUpdateAccountBalance = transactionStream.filter(
    transaction => transaction.status === "transaction-paid"
  );

  return shouldUpdateAccountBalance;
};

module.exports = mongoose.model("Transaction", TransactionSchema);

// module.exports = {
//   getAllSuccessfullTransactionEvents () {},
//   getAllCanselledTransactionEvents () {},
//   getTotalAmountPaidByUser () {},
//   aggregateAccountBalance () {}
// }
