import mongoose from 'mongoose';

const RAILWAY_MONGO = 'mongodb://mongo:AqpFCSsGPODuohggQRGHjFiTwkJPnqRx@mongodb.railway.internal:27017/kasapp2?authSource=admin';

export const connectDB = async (): Promise<void> => {
  try {
    const uri = process.env.MONGO_URL || RAILWAY_MONGO;
    await mongoose.connect(uri);
    console.log('MongoDB connected to:', uri.split('@')[1]);
  } catch (error) {
    console.error('MongoDB failed to connect:', error);
    console.log('Running without database - data will not persist');
  }
};