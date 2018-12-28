const router = require('express').Router();

router.get('/tokens/:reference', catchErrors(complockConroller.getTokens));
router.get('/ping-subscription/:reference', catchErrors(complockConroller.pingSubscription));

module.exports = router