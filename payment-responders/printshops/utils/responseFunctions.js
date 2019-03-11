const transactionsModel = require("../../../models/transactions");
const accountsModel = require("../../../models/accounts");

const responseFunctions = {
  // 1. customer topping up wallet - increment customer balance only
  customerToppingWallet: async transaction => {
    const hasCustomerPaid = await transactionsModel.checkIfTransactionIsPaid(
      transaction.reference
    );

    if (hasCustomerPaid.length > 0) {
      await accountsModel.updateBalance({
        emailAddress: transaction.payload.user.authemail,
        transaction: hasCustomerPaid[0],
        increase: 1
      });
    } else {
      // no man there isn't any money put into the system
    }
  },

  customerPayingPrintShop: async transaction => {
    // 3. customer using credits - decrement balance,
    // incremend their totalContributed, increment my balance

    // reduce the customer's balance
    const updateCustomerBalance = accountsModel.updateBalance({
      emailAddress: transaction.payload.user.authemail,
      transaction: transaction,
      increase: -1
    });

    // then increase the printshop's balance
    const updateSystemBalance = accountsModel.updateBalance({
      emailAddress: transaction.payload.printShopEmail,
      transaction: transaction,
      increase: 1,
      isSystemBalance: true
    });

    const updateBalances = [updateCustomerBalance, updateSystemBalance];

    await Promise.all(updateBalances);
  },

  printShopPayingUs: async transaction => {
    // 2. printshop paying reg fees - increment their totalContributed and my balance
    const hasCustomerPaid = await transactionsModel.checkIfTransactionIsPaid(
      transaction.reference
    );

    if (hasCustomerPaid.length > 0) {
      const updateCustomerContribution = accountsModel.update(
        { emailAddress: transaction.payload.user.authemail },
        {
          $inc: { totalContributed: parseFloat(transaction.payload.amount) }
        }
      );

      const updateSystemBalance = accountsModel.updateBalance({
        emailAddress: "kgparadzayi@gmail.com",
        payload: transaction.payload,
        system: true
      });

      const updateSystemBalanceAndCustomerContribution = [
        updateCustomerContribution,
        updateSystemBalance
      ];

      await Promise.all(updateSystemBalanceAndCustomerContribution);
    } else {
      // no man there isn't any money put into the system
    }
  },

  usPayingPrintShop: async transaction => {
    const updateSystemContribution = accountsModel.update(
      { emailAddress: transaction.payload.user.authemail },
      {
        $inc: { totalContributed: parseFloat(transaction.payload.amount) }
      }
    );

    const updateCustomerBalance = accountsModel.updateBalance({
      emailAddress: "kgparadzayi@gmail.com",
      payload: transaction.payload,
      system: true
    });

    const updateCustomerBalanceAndSystemContribution = [
      updateSystemContribution,
      updateCustomerBalance
    ];

    await Promise.all(updateCustomerBalanceAndSystemContribution);
  }
};

module.exports = responseFunctions;
