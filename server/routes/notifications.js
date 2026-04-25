const express = require('express');
const router = express.Router();

// Mock notification endpoint
router.post('/remind', (req, res) => {
  const { userId, type } = req.body;
  console.log(`Sending ${type} reminder to user ${userId}`);
  res.json({ success: true, message: `Reminder of type ${type} sent.` });
});

module.exports = router;
