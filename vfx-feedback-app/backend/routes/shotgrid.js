const router = require('express').Router();
router.get('/', (req, res) => res.json({ message: 'ShotGrid routes working' }));
module.exports = router;