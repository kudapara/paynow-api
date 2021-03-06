require("dotenv").config();
const express = require("express");
const app = express();
const bp = require("body-parser");
const logger = require("morgan");
const cors = require("cors");
const qs = require("qs");

app.use(bp.json());
app.use(bp.urlencoded({ extended: true }));
app.use(cors());
app.use(logger("dev"));

const axios = require("./axios");
const sha512 = require("./sha512");
const uuidv4 = require("uuid/v4");
const errorHandlers = require("./handlers");
const transactions = require("./models/transactions");
const accounts = require("./models/accounts");
const paymentResponders = require("./payment-responders");

const Paynow = require("paynow");
const log = console.log;

// Util functions
const toKebabCasing = (text = "") =>
  text
    .toLowerCase()
    .split(" ")
    .join("-");

/**
 * Register the routes of payment responders
 */
Object.keys(paymentResponders).forEach(responder =>
  app.use(`/${responder}`, paymentResponders[responder].routes)
);

/**
 * Recieving transaction feedback from paynow
 */
app.post("/", async (req, res) => {
  console.log("recieved transaction from paynow");
  const transactionFromPaynow = req.body;
  console.log(transactionFromPaynow);

  try {
    // create a user for paynow responses
    const user = req.body.paynowreference
      ? {
          user: { authemail: req.query.authemail }
        }
      : {};

    const transactionEvent = {
      reference: transactionFromPaynow.reference,
      type: req.query.paymentMethod || "paynow",
      status: `transaction-${toKebabCasing(transactionFromPaynow.status)}`,
      payload: {
        ...transactionFromPaynow,
        ...user
      },
      timestamp: Date.now()
    };
    console.log(transactionEvent);

    const transaction = new transactions(transactionEvent);

    console.log("attempting to save the tranavctione event");
    await transaction.saveTransactionEvent();
    console.log("success fully saved transaction event");

    // transaction saved, perhaps pass it on for processin
    console.log(req.query);
    console.log(paymentResponders[req.query.paymentResponder]);
    if (
      req.query.paymentResponder &&
      paymentResponders[req.query.paymentResponder] &&
      typeof paymentResponders[req.query.paymentResponder].onSuccess ==
        "function"
    ) {
      const response = await paymentResponders[
        req.query.paymentResponder
      ].onSuccess(transactionEvent, req.query.transactionType);
      return res.end("Thanks Paynow 👍");
    }
    console.log("transaction saved in database");
    res.status(200).end();
  } catch (error) {
    console.log("errorr==========");
    console.log(error);
    res.status(500).end("Oops an error occured on my end 😢");
  }
});

app.get("/", async (req, res) => {
  try {
    console.log("Getting a list of all transactions");
    const transaction = new transactions();
    const data = await transaction.getAllTransactionEvents();
    console.log("Successfully got a list of transactions");
    res.status(200).json({ data });
  } catch (error) {
    res.status(500).json({ error });
  }
});

async function initiateMobileTransaction(
  paynow,
  payment,
  { products, mobileNumber, mobileMoneyProvider, authemail, meta }
) {
  log("send mobile payment to paynow");
  console.log(payment);
  const response = await paynow.sendMobile(
    payment, // The payment to send to Paynow
    mobileNumber, // The phone number making payment
    mobileMoneyProvider // The mobile money method to use.
  );
  //  Ressponse = { status, success, hasRedirect, instructions }
  log("checking if response is success");
  if (response.success) {
    // These are the instructions to show the user.
    // Instruction for how the user can make payment
    let instructions = response.instructions; // Get Payment instructions for the selected mobile money method

    // Get poll url for the transaction. This is the url used to check the status of the transaction.
    // You might want to save this, we recommend you do it
    let pollUrl = response.pollUrl;

    console.log(response);
    const transactionEvent = {
      reference: payment.reference,
      type: "mobile",
      status: "transaction-initiated",
      payload: {
        products,
        transaction: response,
        user: { mobileNumber, authemail },
        amount: products.reduce((total, current) => {
          return total + current.price;
        }, 0),
        ...meta
      },
      timestamp: Date.now()
    };
    const transaction = new transactions(transactionEvent);
    log("saving transation to database");
    await transaction.saveTransactionEvent();
    return response;
  } else {
    log("encountered an error, response not successful");
    throw response;
  }
}

async function initiateWebTransaction(paynow, payment) {
  const response = await paynow.send(payment);
  // Check if request was successful
  if (response.success) {
    // Get the link to redirect the user to, then use it as you see fit
    // Save the transaction initiation event in the database
    console.log("the initiation was successfull");
    const transactionEvent = {
      reference: payment.reference,
      type: "paynow",
      status: "transaction-initiated",
      payload: {
        products,
        transaction: response,
        user: { mobileNumber, authemail }
      },
      timestamp: Date.now()
    };
    const transaction = new transactions(transactionEvent);
    await transaction.saveTransactionEvent();
    return response;
  } else {
    throw response;
  }
}

app.post("/pay/mobile", async (req, res) => {
  log("reached /pay/mobile");
  const {
    products = [{ itemName: "mouse", price: 4.0 }],
    authemail,
    meta = {},
    mobileNumber,
    mobileMoneyProvider,
    reference
  } = req.body;
  // Check if there are any products in to be bought
  log("checking if there are products");
  if (products.length === 0) {
    log("no products found");
    return res
      .status(400)
      .json({ message: "You need to have at least one item in cart" });
  }

  log("creating a new paynow instance");
  const paynow = new Paynow(4176, process.env.PAYNOW_INTEGRATION_KEY);
  // Set return and result urls
  paynow.resultUrl = `https://paynow.now.sh?paymentResponder=${
    req.query.paymentResponder
  }&authemail=${authemail}&paymentMethod=${mobileMoneyProvider}`;
  paynow.returnUrl = "https://paynow.netlify.com";

  log("validating mobile money providers");
  const validMobileMoneyProviders = ["ecocash", "onemoney"];
  const isValidMobileMoneyProvider =
    validMobileMoneyProviders.filter(p => p === mobileMoneyProvider).length ===
    1;
  if (!isValidMobileMoneyProvider) {
    log("found mobile money providers to be invalid");
    // fail the transaction here and throw an error
    return res
      .status(400)
      .json({ message: "Make sure you pay using either ecocash or onemoney" });
  }

  const payment = paynow.createPayment(reference || uuidv4(), authemail);
  // Add items to the payment list passing in the name of the item and it's price
  log("logging the products sent from the user");
  log(products);
  products.filter(product => payment.add(product.itemName, product.price));

  try {
    log("initiating mobile transaction");
    const response = await initiateMobileTransaction(paynow, payment, {
      products,
      mobileNumber,
      mobileMoneyProvider,
      authemail,
      meta
    });
    console.log("response from initiateMobileTransaction");
    console.log(response);
    res.json(response);
  } catch (error) {
    log("encounterd an error initiating a transaction");
    console.log(error);
    res.status(500).json({ error });
  }
});

app.post("/pay/paynow", async (req, res) => {
  const {
    products = [{ itemName: "mouse", price: 4.0 }],
    authemail = "kgparadzayi@gmail.com"
  } = req.body;
  // Products = [{price, itemName}]
  // TODO: Validate transactions here
  // Check if there are any products in to be bought
  if (products.length === 0) {
    return res
      .status(400)
      .json({ message: "You need to have at least one item in cart" });
  }

  const paynow = new Paynow(4176, process.env.PAYNOW_INTEGRATION_KEY);
  // Set return and result urls
  paynow.resultUrl = "https://paynow.now.com";
  paynow.returnUrl = "https://paynow.netlify.com";
  // Create a new payment
  const payment = paynow.createPayment(uuidv4());
  // Add items to the payment list passing in the name of the item and it's price
  products.filter(product => payment.add(product.itemName, product.price));

  try {
    const response = await initiateWebTransaction(payment);
    res.json(response);
  } catch (error) {
    if (error.error === "Insufficient balance") {
      error.statusCode = 422;
    }

    res.status(error.statusCode || 500).json(error);
  }
});

app.get("/accounts/:emailAddress", async (req, res) => {
  try {
    const emailAddress = req.params.emailAddress || "";
    const account = await accounts.findOne({ emailAddress });
    res.json(account);
  } catch (error) {
    res
      .status(500)
      .json({ message: "there was an error getting the account information" });
  }
});

app.get("/accounts/:emailAddress/transactions", async (req, res) => {
  try {
    const emailAddress = req.params.emailAddress || "";
    const txs = await transactions.find({
      "payload.user.authemail": emailAddress
    });
    res.json({ transactions: txs });
  } catch (error) {
    res
      .status(500)
      .json({ message: "there was an error getting the account information" });
  }
});

// If that above routes didnt work, we 404 them and forward to error handler
app.use(errorHandlers.notFound);

// One of our error handlers will see if these errors are just validation errors
app.use(errorHandlers.flashValidationErrors);

// Otherwise this was a really bad error we didn't expect! Shoot eh
if (app.get("env") === "development") {
  /* Development Error Handler - Prints stack trace */
  app.use(errorHandlers.developmentErrors);
}

// production error handler
app.use(errorHandlers.productionErrors);

const { PORT } = process.env;
app.listen(PORT, () => console.log("app running on ", PORT));
