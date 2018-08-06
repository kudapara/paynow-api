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
const hash = require('./hash')
const transactions = require('./transactions')

app.post('/', (req, res) => {
  console.log('recieved transaction')
  const transaction = new transactions(req.body);
  transaction.saveTransactionEvent()
    .then(data => {
      // transaction saved, perhaps pass it on for processinf
      console.log('transaction saved')
      res.status(200).end()
    })
    .catch(error => {
      // transaction failed to save, find how to deal with this situation
      console.log('errorr==========')
      console.log(error)
      res.status(500).end()
    })
})

app.get('/', async (req, res) => {
  try {
    const transaction = new transactions();
    const data = await transaction.getAllTransactionEvents()
    res.status(200).json({ data })
  } catch (error) {
    res.status(500).json({ error })
  }
})

// Be sure to delete this line
app.get('/env', (req, res) => res.json(process.env))

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
    returnurl: 'http://localhost:8080', // where the results of the transaction will be posted
    resulturl: 'https://paynow.now.sh', // where the results of the transaction will be posted
    hash: "",
  }

  // create a hash of the fields
  fields.hash = hash(fields)
  console.log(fields)
  // initiate the payment request
  try {
    const response = await axios.post('/initiatetransaction', qs.stringify(fields))
    res.status(200).json(qs.parse(response.data))
  } catch (error) {
    res.status(500).json(qs.parse(error.data))
  }

})

app.listen(3000, () => console.log('app running on 3000'))

