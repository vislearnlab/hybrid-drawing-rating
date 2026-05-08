import { MongoClient } from 'mongodb';
import assert from 'assert';
import 'dotenv/config';

const mongoURL: string = process.env.MONGO_URL;
const databaseName: string = process.env.DATABASE;
const collectionName: string = process.env.COLLECTION;

const InsertTrial = async (document: any): Promise<void> => {
    try {
      const client = await MongoClient.connect(mongoURL);
      const collection = client.db(databaseName).collection(collectionName);

      const result = await collection.updateOne(
          { trialKey: document.trialKey },
          { $set: document },
          { upsert: true }
      );

      if (result.upsertedCount > 0) {
        console.log('Trial inserted:', document.trialKey);
      } else if (result.matchedCount > 0) {
        console.log('Trial updated:', document.trialKey);
      }
      assert.strictEqual(true, result.acknowledged);
      client.close();
    } catch (err) {
      console.error('Error saving trial:', err);
    }
  };


export { InsertTrial };
