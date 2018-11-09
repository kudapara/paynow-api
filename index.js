require('dotenv').config()
const express = require('express')
const app = express()
const bp = require('body-parser')
const cors = require('cors')
const qs = require('qs')

app.use(bp.json())
app.use(bp.urlencoded({ extended: true }))
app.use(cors())

const axios = require('./axios')
const sha512 = require('./sha512')
const uuidv4 = require('uuid/v4')
const transactions = require('./transactions')

const Paynow = require('paynow')
const log = console.log

const toKebabCasing = (text = '') => text.toLowerCase().split(' ').join('-')
/**
 * Recieving transaction feedback from paynow
 */
app.post('/', async (req, res) => {
  console.log('recieved transaction from paynow')
  const transactionFromPaynow = req.body
  console.log(transactionFromPaynow)
  try {
    const transactionEvent = {
      reference: transactionFromPaynow.reference,
      type: 'paynow',
      status: `transaction-${toKebabCasing(transactionFromPaynow.status)}`,
      payload: req.body,
      timestamp: Date.now()
    }
    console.log(transactionEvent)
    const transaction = new transactions(transactionEvent);
    console.log('attempting to save the tranavctione event')
    await transaction.saveTransactionEvent()
    console.log('success fully saved transaction event')
    console.log('Attempting to update account balances')
    await transaction.updateAccountBalances(transactionFromPaynow.reference)
    console.log('success fully updates balances')
    // transaction saved, perhaps pass it on for processin
    console.log('transaction saved in database')
    res.status(200).end()
  } catch (error) {
    console.log('errorr==========')
    console.log(error)
    res.status(500).end()
  }
})

app.get('/', async (req, res) => {
  try {
    console.log('Getting a list of all transactions')
    const transaction = new transactions();
    const data = await transaction.getAllTransactionEvents()
    console.log('Successfully got a list of transactions')
    res.status(200).json({ data })
  } catch (error) {
    res.status(500).json({ error })
  }
})


async function initiateMobileTransaction (paynow, payment, { products, mobileNumber, mobileMoneyProvider, authemail }) {
  log('send mobile payment to paynow')
  console.log(payment)
  const response = await paynow.sendMobile(
    payment,       // The payment to send to Paynow
    mobileNumber,  // The phone number making payment
    mobileMoneyProvider      // The mobile money method to use.
  )
  //  Ressponse = { status, success, hasRedirect, instructions }
  log('checking if response is success')
  if(response.success) {
    // These are the instructions to show the user. 
    // Instruction for how the user can make payment
    let instructions = response.instructions // Get Payment instructions for the selected mobile money method

    // Get poll url for the transaction. This is the url used to check the status of the transaction. 
    // You might want to save this, we recommend you do it
    let pollUrl = response.pollUrl; 

    console.log(response)
    const transactionEvent = {
      reference: payment.reference,
      type: 'mobile',
      status: 'transaction-initiated',
      payload: { products, transaction: response, user: { mobileNumber, authemail } },
      timestamp: Date.now()
    }
    const transaction = new transactions(transactionEvent)
    log('saving transation to database')
    await transaction.saveTransactionEvent()
    return response
  } else {
    log('encountered an error, response not successful')
    throw response
  }
}

async function initiateWebTransaction (paynow, payment) {
  const response = await paynow.send(payment)
  // Check if request was successful
  if (response.success) {
    // Get the link to redirect the user to, then use it as you see fit
    // Save the transaction initiation event in the database
    console.log('the initiation was successfull')
    const transactionEvent = {
      reference: payment.reference,
      type: 'paynow',
      status: 'transaction-initiated',
      payload: { products, transaction: response, user: { mobileNumber, authemail } },
      timestamp: Date.now()
    }
    const transaction = new transactions(transactionEvent)
    await transaction.saveTransactionEvent()
    return response
  } else {
    throw response
  }
}

app.post('/pay/mobile', async (req, res) => {
  log('reached /pay/mobile')
  const { products = [ { itemName: 'mouse', price: 4.0 } ], authemail, mobileNumber, mobileMoneyProvider }= req.body
  // Check if there are any products in to be bought

  log('checking if there are products')
  if (products.length === 0) {
    log('no products found')
    return res.status(400).json({ message: 'You need to have at least one item in cart' })
  }
  
  log('creating a new paynow instance')
  const paynow = new Paynow(4176, process.env.PAYNOW_INTEGRATION_KEY);
  // Set return and result urls
  paynow.resultUrl = 'https://paynow.now.sh';
  paynow.returnUrl = 'https://paynow.netlify.com';

  log('validating mobile money providers')
  const validMobileMoneyProviders = ['ecocash', 'onemoney']
  const isValidMobileMoneyProvider = validMobileMoneyProviders.filter(p => p === mobileMoneyProvider).length === 1
  if (!isValidMobileMoneyProvider) {
    log('found mobile money providers to be invalid')
    // fail the transaction here and throw an error
    return res.status(400).json({ message: 'Make sure you pay using either ecocash or onemoney' })
  }

  const payment = paynow.createPayment(uuidv4(), authemail)
  // Add items to the payment list passing in the name of the item and it's price
  log('logging the products sent from the user')
  log(products)
  products.filter(product => payment.add(product.itemName, product.price))

  try {
    log('initiating mobile transaction')
    const response = initiateMobileTransaction(paynow, payment, { products, mobileNumber, mobileMoneyProvider, authemail })
    res.json(response)
  } catch (error) {
    log('encounterd an error initiating a transaction')
    console.log(error)
    res.status(error.status || 500).json({ error })
  }
})

app.post('/pay/paynow', async (req, res) => {
  const { products = [ { itemName: 'mouse', price: 4.0 }], authemail = 'kgparadzayi@gmail.com' } = req.body
  // Products = [{price, itemName}]
  // TODO: Validate transactions here

  // Check if there are any products in to be bought
  if (products.length === 0) {
    return res.status(400).json({ message: 'You need to have at least one item in cart' })
  }

  const paynow = new Paynow(4176, process.env.PAYNOW_INTEGRATION_KEY);
  // Set return and result urls
  paynow.resultUrl = 'https://paynow.now.com';
  paynow.returnUrl = 'https://paynow.netlify.com';
  // Create a new payment
  const payment = paynow.createPayment(uuidv4())
  // Add items to the payment list passing in the name of the item and it's price
  products.filter(product => payment.add(product.itemName, product.price))

  try {
    const response = await initiateWebTransaction(payment)
    res.json(response)
  } catch (error) {
    res.status(error.status || 500).json(error)
  }
})


app.listen(3000, () => console.log('app running on 3000'))

