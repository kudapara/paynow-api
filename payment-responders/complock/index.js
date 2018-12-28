// Npm dependancies
const jwt = require('jsonwebtoken')
const moment = require('moment')
const router = require('express').Router();

// Models
const transactionsModel = require('../../transactions')
const complockModel = require('./model')

// Controller
const complockConroller = require('./controller');
const { catchErrors } = require('../../handlers')

/**
 * For any custom routes specific to the payment responder
 */
router.get('/tokens/:emailAddress', catchErrors(complockConroller.getTokens));
router.get('/ping-subscription/:reference', catchErrors(complockConroller.pingSubscription));
exports.routes = router;

/**
 * Signature function required for all the payment responders.
 * It is invoked after a transaction has been paid.
 * It accepts the transaction object for the transaction-paid event.
 */
exports.onSuccess = async function(transaction) {
 
  // get the products from the database
  const initialTransaction = await transactionsModel.findOne({
    reference: transaction.reference,
    status: 'transaction-initiated'
  })

  // do some processing (create tokens),
  const computers = initialTransaction.payload.products
  const token_expiry_time = moment().add(30, 'd')

  const tokens = computers.map(computer => {
    const computer_name = computer.itemName
    const activation_token = jwt.sign({
      computer_name,
      exp: token_expiry_time.unix()
    }, 'super-secret')

    return {
      computer_name,
      activation_token,
      is_paid_for: true,
      token_expiry_time,
      token_paid_time: moment()
    }
  })

  // save results to database
  const savedTokens = await complockModel({
    reference: transaction.reference,
    emailAddress: initialTransaction.payload.user.authemail,
    tokens
  }).save()

};
