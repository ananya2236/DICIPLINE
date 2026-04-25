const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const notificationRoutes = require('./routes/notifications');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/notifications', notificationRoutes);

// Basic health check
app.get('/', (req, res) => {
  res.send('Tracker API is running');
});

try {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
} catch (error) {
  console.error("Failed to start server:", error);
}
