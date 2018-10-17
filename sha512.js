
const sha512 = require('js-sha512')

module.exports = {
  hash (fields) {
    let unhashedString = ""
    for (let key in fields) {
      if (key !== 'hash') {
        unhashedString += fields[key]
      }
    }
  
    unhashedString += process.env.INTEGRATION_KEY // integration key
    return sha512(unhashedString).toUpperCase()
  },

  verify(originalFields, foreignFields) {
    return this.hash(originalFields, foreignFields)
  }
}