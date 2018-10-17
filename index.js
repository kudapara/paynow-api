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
app.post('/ecocash', (req, res) => {
  // Create instance of Paynow class
  let paynow = new Paynow(4176, "04ab375d-861b-40b9-8ec0-d0b605a0982f");
  // Set return and result urls
  paynow.resultUrl = 'https://paynow.now.com';
  paynow.returnUrl = 'https://paynow.netlify.com';
  
  // Create a new payment
  let payment = paynow.createPayment("Invoice 35", 'kgparadzayi@gmail.com');
  
  // Add items to the payment list passing in the name of the item and it's price
  payment.add("Bananas", 2.5);
  payment.add("Apples", 3.4);

  // Send off the payment to Paynow
  paynow.sendMobile(
    
    // The payment to send to Paynow
    payment, 
 
    // The phone number making payment
    '0777123456',
    
    // The mobile money method to use.
    'onemoney' 
  
  ).then(function(response) {
      if(response.success) {
          // These are the instructions to show the user. 
          // Instruction for how the user can make payment
          let instructions = response.instructions // Get Payment instructions for the selected mobile money method
  
          // Get poll url for the transaction. This is the url used to check the status of the transaction. 
          // You might want to save this, we recommend you do it
          let pollUrl = response.pollUrl; 
  
          console.log(instructions)
  
      } else {
          console.log(response.error)
      }
  }).catch(ex => {
      // Ahhhhhhhhhhhhhhh
      // *freak out*
      console.log('Your application has broken an axle', ex)
  });
})

/**
 * Recieving transaction feedback from paynow
 */
app.post('/', async (req, res) => {
  console.log('recieved transaction from paynow')
  const transactionFromPaynow = req.body
  try {
    const transactionEvent = {
      reference: payment.reference,
      type: 'paynow',
      status: 'transaction-initiated',
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
    // transaction saved, perhaps pass it on for processinf
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

app.post('/pay', async (req, res) => {
  console.log('recieved payment request')
  const { amount, authemail } = req.body
  const fields = {
    id: process.env.ID, // found on the screen with final details on paynow developer
    status: 'message', // The status when initiatin a transaction
    reference: "hitconnect=kgparadzayi@gmail.com", // unique to the transaction - <what-you-paying-for>=<emailAddress>
    amount,
    authemail, // the email of the user
    additionalinfo: 'You are about to pay for your subscriptions',
    returnurl: 'https://paynow.netlify.com', // where the results of the transaction will be posted
    resulturl: 'https://paynow.now.sh', // where the results of the transaction will be posted
    hash: "",
  }

  // create a hash of the fields
  fields.hash = sha512.hash(fields)
  console.log(fields)
  // initiate the payment request
  try {
    console.log('Initiating payment request')
    const response = await axios.post('/initiatetransaction', qs.stringify(fields))
    console.log('Successfully initiated a payment')
    res.status(200).json(qs.parse(response.data))
  } catch (error) {
    console.log('Error encounted when initiating request')
    res.status(500).json(qs.parse(error.data))
  }

})

app.post('/pay/paynow', async (req, res) => {
  // Products = [{price, itemName}]
  // TODO: Validate transactions here
  const { products = [ { itemName: 'mouse', price: 4.0 }], authemail = 'kgparadzayi@gmail.com' }= req.body
  if (products.length === 0) {
    return res.status(400).json({ message: 'You need to have at least one item in cart' })
  }
  console.log('alive and kicking')
  const paynow = new Paynow(4176, "04ab375d-861b-40b9-8ec0-d0b605a0982f");
  // Set return and result urls
  paynow.resultUrl = 'https://paynow.now.com';
  paynow.returnUrl = 'https://paynow.netlify.com';

  // Create a new payment
  const payment = paynow.createPayment(uuidv4())
  console.log('alive after creating uuid')
  // Add items to the payment list passing in the name of the item and it's price
  products.filter(product => payment.add(product.itemName, product.price))
  console.log('alive after filtering')

  try {
    const response = await paynow.send(payment)
    // Check if request was successful
    if (response.success) {
      // Get the link to redirect the user to, then use it as you see fit
      // Save the transaction initiation event in the database
      console.log('the initiation was successfull')
      const transactionEvent = {
        id: payment.reference,
        type: 'paynow',
        status: 'transaction-initiated',
        payload: { products },
        timestamp: Date.now()
      }
      const transaction = new transactions(transactionEvent)
      await transaction.saveTransactionEvent()
      res.json(response)
    }

  } catch (error) {
    console.log('there is the error')
    console.log(error)
    res.status(error.status || 500).json(error)
  }
})

app.post('/pay/mobile', async (req, res) => {
  // Create instance of Paynow class
  const paynow = new Paynow(4176, "04ab375d-861b-40b9-8ec0-d0b605a0982f");
  // Set return and result urls
  paynow.resultUrl = 'https://paynow.now.com';
  paynow.returnUrl = 'https://paynow.netlify.com';
  
  // Create a new payment
  const payment = paynow.createPayment("Invoice 35", 'kgparadzayi@gmail.com');
  
  // Add items to the payment list passing in the name of the item and it's price
  payment.add("Bananas", 2.5);
  payment.add("Apples", 3.4);

  // Send off the payment to Paynow
  try {
    const response = await paynow.sendMobile(payment, '0777123456', 'onemoney')
    if(response.success) {
        // These are the instructions to show the user. 
        // Instruction for how the user can make payment
        let instructions = response.instructions // Get Payment instructions for the selected mobile money method

        // Get poll url for the transaction. This is the url used to check the status of the transaction. 
        // You might want to save this, we recommend you do it
        let pollUrl = response.pollUrl; 

        res.status(200).json({ message: instructions })
    } else {
        console.log(response.error)
    }
    
  } catch (error) {
      console.log('Your application has broken an axle', ex)
  }
})

app.listen(3000, () => console.log('app running on 3000'))

