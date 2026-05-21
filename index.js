const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const app = express();
const dotenv = require("dotenv");
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());
dotenv.config();

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("MediQueue");
    const tutorsCollection = db.collection("Tutors");
    const bookingsCollection = db.collection("bookings");

    // 1. GET TUTORS (Handles both All Tutors AND Specific User filter via query param)
    app.get("/tutors", async (req, res) => {
      try {
        const { email } = req.query;
        let query = {};

        // Matches both your frontend form field payload exactly
        if (email) {
          query = { email: email };
        }

        const result = await tutorsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch tutor data" });
      }
    });

    // 2. GET SINGLE TUTOR BY ID
    app.get("/tutors/:tutorsId", async (req, res) => {
      try {
        const { tutorsId } = req.params;
        const query = { _id: new ObjectId(tutorsId) };
        const result = await tutorsCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Tutor profile not found" });
      }
    });

    // 3. GET FEATURED TUTORS
    app.get("/featured-tutors", async (req, res) => {
      try {
        const result = await tutorsCollection.find().limit(6).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch featured tutors" });
      }
    });

    // 4. POST NEW TUTOR
    app.post("/tutors", async (req, res) => {
      try {
        const tutorData = req.body;
        const result = await tutorsCollection.insertOne(tutorData);
        res.send({
          success: true,
          message: "Tutor added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ success: false, message: "Failed to add tutor" });
      }
    });

    // 5. PATCH UPDATE TUTOR PROFILE
    app.patch("/tutors/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updateData = req.body;

        // Strip the immutable MongoDB system ID before committing updates
        delete updateData._id;

        // Clean values safely back into strict numeric signatures
        if (updateData.price) updateData.price = Number(updateData.price);
        if (updateData.totalSlot)
          updateData.totalSlot = Number(updateData.totalSlot);

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: updateData,
        };

        const result = await tutorsCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "Tutor updated successfully" });
        } else {
          res.send({ success: true, message: "No data changes discovered" });
        }
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({
            success: false,
            message: "Database update transaction failed",
          });
      }
    });

    // 6. DELETE TUTOR PROFILE
    app.delete("/tutors/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const query = { _id: new ObjectId(id) };

        const result = await tutorsCollection.deleteOne(query);

        if (result.deletedCount > 0) {
          res.send({
            success: true,
            message: "Tutor profile deleted successfully",
          });
        } else {
          res
            .status(404)
            .send({ success: false, message: "Tutor profile entry not found" });
        }
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({
            success: false,
            message: "Database deletion execution failed",
          });
      }
    });

    // 7. GET BOOKINGS
    app.get("/bookings", async (req, res) => {
      try {
        const { email } = req.query;
        let query = {};

        if (email) {
          query = { studentEmail: email };
        }

        const result = await bookingsCollection.find(query).toArray();
        res.status(200).send(result);
      } catch (error) {
        console.error("Failed to query bookings:", error);
        res
          .status(500)
          .send({ message: "Internal server error reading bookings data." });
      }
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } catch (error) {
    console.error("Database connection bootstrap error:", error);
  }
}
run().catch(console.dir);

// Root Base Routes
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
