// Npm dependancies
const jwt = require("jsonwebtoken");
const moment = require("moment");
const uuidv4 = require("uuid/v4");

// Models
const transactionsModel = require("../../models/transactions");
const accountsModel = require("../../models/accounts");

// special case responders
const responseFunctions = require("./utils/responseFunctions");

/**
 * For any custom routes specific to the payment responder
 */
exports.routes = require("./routes");

/**
 * Signature function required for all the payment responders.
 * It is invoked after a transaction has been paid.
 * It accepts the transaction object for the transaction-paid event.
 */
exports.onSuccess = async function(transaction) {
  // get the products from the database
  const initialTransaction = await transactionsModel.findOne({
    reference: transaction.reference,
    status: "transaction-initiated"
  });

  // on success of printshop payment determine the type of transaction
  // customer topping up wallet, printshop paying reg fees, customer using up credits

  // how does printshop know how much to get (printjobs have boolean field, paidOut)
  console.log("inside the printshops responder");

  const { payload } = initialTransaction;

  const fn = responseFunctions[payload.transactionType];

  if (fn && typeof fn == "function") {
    await fn(initialTransaction);
  } else {
    console.log(
      "============== We could not process the incoming transactions ========================="
    );
  }
};
