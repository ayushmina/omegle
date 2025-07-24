const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        if (process.env.MONGODB_URI) {
            await mongoose.connect(process.env.MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('MongoDB connected successfully');
        } else {
            console.log('No MongoDB URI provided. Running without database.');
        }
    } catch (err) {
        console.error('DB connection failed:', err);
        console.log('Continuing without database...');
    }
};

module.exports = connectDB;

