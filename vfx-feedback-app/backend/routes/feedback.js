const router = require('express').Router();
router.get('/', (req, res) => res.json({ message: 'Feedback routes working' }));
module.exports = router;