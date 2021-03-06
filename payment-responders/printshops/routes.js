const router = require("express").Router();

const complockConroller = require("./controller");
const { catchErrors } = require("../../handlers");

router.get("/tokens/:reference", catchErrors(complockConroller.getTokens));
router.put(
  "/tokens/:reference/:tokenId",
  catchErrors(complockConroller.burnToken)
);
// router.get('/ping-subscription/:reference', catchErrors(complockConroller.pingSubscription));

module.exports = router;
