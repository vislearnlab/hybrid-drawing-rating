import { MongoClient } from 'mongodb';
import assert from 'assert';
import 'dotenv/config';

const mongoURL: string = process.env.MONGO_URL; 
const databaseName: string = process.env.DATABASE;
const collectionName: string = process.env.COLLECTION; 

const Extract = async (key?: string, keyLocation?: string): Promise<any> => {
  try {
    const client = await MongoClient.connect(mongoURL);
    const collection = client.db(databaseName).collection(collectionName);
    // create query to find documents where keyLocation field equals key (if both parameters are provided)
    const query: any = {};
    let filterExtraction = key !== undefined && keyLocation !== undefined
    // Only apply filter if both key and keyLocation are provided
    if (key !== undefined && keyLocation !== undefined) {
      query[keyLocation] = key;
    }
    // extract all documents from collection that match the query (or all documents if no filter)
    const docs = await collection.find(query).toArray();
    // check if any documents were found
    if (docs.length === 0) {
      if (filterExtraction) {
        console.log(`No documents found with ${keyLocation} = ${key}`);
      } else {
        console.log('No documents found in the collection');
      }
    } else {
      // server side console log showing number of matching documents
      if (filterExtraction) {
        console.log(`Found ${docs.length} document(s) with ${keyLocation} = ${key}`);
      } else {
        console.log(`Found ${docs.length} document(s) in the collection`);
    } 
  }
    client.close();
    return docs;
  } catch (err) {
    console.error('Error connecting to MongoDB or fetching documents:', err);
    throw err; // rethrow to allow caller to handle the error
  }
};

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
  

export { Extract, Insert };
