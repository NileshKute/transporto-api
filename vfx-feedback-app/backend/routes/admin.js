const router = require('express').Router();
router.get('/', (req, res) => res.json({ message: 'Admin routes working' }));
module.exports = router;