const complockModel = require("./model");

/**
 * Returns the last batch of tokens that are saved in the database
 */
exports.getTokens = async function (req, res) {
  const { emailAddress = '' } = req.params;
  const tokens = await complockModel
    .findOne({ emailAddress })
    // Get the latest one
    .sort({ createdAt: -1 });

  if (!tokens) {
    return res.status(404).json({ message: 'There are no subscriptions registered under your email address' })
  }
  res.json(tokens);
};

/**
 * Check if the latest transaction was successfullty paid
 */
exports.pingSubscription = async function (req, res) {
  const { reference = ''} = req.params;
  const response = {}
  const subscription = await complockModel.findOne({ reference })

  if (subscription) {
    response.message = 'The subscription was successfull',
    response.tokens = subscription.tokens
    response.status = 'paid'
  } else {
    response.message = 'We have not yet recieved your payment. Make sure to pay so that you can recieve the tokens',
    response.tokens = []
    response.status = 'awaiting-payment'
  }

  res.json(response)
}