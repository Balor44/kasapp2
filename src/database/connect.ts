import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error('MONGO_URL environment variable is not set');
    }

    await mongoose.connect(uri);
    console.log('MongoDB connected to:', uri.split('@')[1]);
  } catch (error) {
    console.error('MongoDB failed to connect:', error);
    console.log('Running without database - data will not persist');
  }
};