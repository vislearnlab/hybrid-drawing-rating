import { MongoClient } from 'mongodb';
import assert from 'assert';
import 'dotenv/config';

const mongoURL: string = process.env.MONGO_URL; 
const databaseName: string = process.env.DATABASE;
const collectionName: string = process.env.COLLECTION; 

const Insert = async (document: object, primaryKey: string, primaryKeyLocation: string): Promise<void> => {
    try {
      const client = await MongoClient.connect(mongoURL);
      const collection = client.db(databaseName).collection(collectionName);
      const query:any = {};
      query[primaryKeyLocation] = primaryKey; 
      
      const result = await collection.updateOne(
          query, // Query to find matching document
          { $set: document }, // Update operation
          { upsert: true } // Insert if not found
      );

      if (result.upsertedCount > 0) {
        console.log('Document inserted successfully:', document);
      }   else if (result.matchedCount > 0) {
          console.log('Document updated successfully:', document);
      }
      assert.strictEqual(true, result.acknowledged);
      client.close();
    } catch (err) {
      console.error('Error connecting to MongoDB or inserting document:', err);
    }
  };
  

export { Insert };
