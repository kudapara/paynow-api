const printshopsModel = require("./model");

/**
 * Returns the last batch of tokens that are saved in the database
 */
exports.getTokens = async function(req, res) {
  const { reference = "" } = req.params;
  const tokens = await printshopsModel
    .findOne({ reference })
    // Get the latest one
    .sort({ createdAt: -1 });

  if (!tokens) {
    return res.status(404).json({
      message: "There are no subscriptions registered under your email address"
    });
  }
  res.json(tokens);
};

/**
 * Use the token up for a printjob
 */
exports.burnToken = async function(req, res) {
  const { reference = "", tokenId = "" } = req.params;
  await printshopsModel.update(
    { reference, "tokens.tokenId": tokenId },
    {
      $set: {
        "tokens.$.hasTokenBeenBurned": true
      }
    }
  );

  res.status(200).json({ message: "Successfully burned token" });
};

/**
 * Check if the latest transaction was successfullty paid
 */
exports.pingSubscription = async function(req, res) {
  const { reference = "" } = req.params;
  const response = {};
  const subscription = await printshopsModel.findOne({ reference });

  if (subscription) {
    (response.message = "The subscription was successfull"),
      (response.tokens = subscription.tokens);
    response.status = "paid";
  } else {
    (response.message =
      "We have not yet recieved your payment. Make sure to pay so that you can recieve the tokens"),
      (response.tokens = []);
    response.status = "awaiting-payment";
  }

  res.json(response);
};
