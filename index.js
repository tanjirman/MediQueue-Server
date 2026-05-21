const express = require("express");
const app = express();
const dotenv = require("dotenv");
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require("mongodb");
const { ObjectId } = require("mongodb");

app.use(cors());
dotenv.config();

const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    const db = client.db("MediQueue");
    const tutorsCollection = db.collection("Tutors");

    app.get("/tutors", async (req, res) => {
      const cursor = tutorsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/tutors/:tutorsId", async (req, res) => {
      const { tutorsId } = req.params;
      const query = { _id: new ObjectId(tutorsId) };
      const result = await tutorsCollection.findOne(query);
      res.send(result);
    });

    app.get("/featured-tutors", async (req, res) => {
      const result = await tutorsCollection.find().limit(6).toArray();

      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
