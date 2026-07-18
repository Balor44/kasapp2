import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  console.log('ALL ENV KEYS:', Object.keys(process.env).join(', '));
  try {
    const uri = process.env.MONGO_URL;
    if (!uri) {
      console.log('No database URI found - running without database');
      return;
    }
    await mongoose.connect(uri + '/kasapp2');
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB failed to connect:', error);
    console.log('Running without database - data will not persist');
  }
};