const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");

dotenv.config();

const app = express();

app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://medi-queue-zeta.vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true, 
  allowedHeaders: ["Content-Type", "Authorization"]
}));


app.use(express.json());

const port = process.env.PORT || 5000;

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

function getCollections() {
  const db = client.db("MediQueue");

  return {
    tutorsCollection: db.collection("tutors"),
    bookingsCollection: db.collection("bookings"),
  };
}

async function run() {
  try {
    // await client.connect();

    console.log("✅ MongoDB Connected");

    // GET ALL TUTORS

    app.get("/tutors", async (req, res) => {
      try {
        const { tutorsCollection } = getCollections();

        const { search, sort, email } = req.query;

        let query = {};

        // Search
        if (search) {
          query.name = {
            $regex: search,
            $options: "i",
          };
        }

        // My tutors filter
        if (email) {
          query.creatorEmail = email;
        }

        // Sorting
        let sortOption = {};

        if (sort === "low-to-high") {
          sortOption.price = 1;
        }

        if (sort === "high-to-low") {
          sortOption.price = -1;
        }

        const result = await tutorsCollection
          .find(query)
          .sort(sortOption)
          .toArray();

        res.send(result);
      } catch (err) {
        console.log(err);
        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    app.get("/featured-tutors", async (req, res) => {
      try {
        const { tutorsCollection } = getCollections();

        const result = await tutorsCollection.find({}).limit(6).toArray();

        res.status(200).send(result);
      } catch (err) {
        console.error("Error in /featured-tutors route:", err);
        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    // GET SINGLE TUTOR

    app.get("/tutors/:id", async (req, res) => {
      try {
        const { tutorsCollection } = getCollections();

        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid tutor id",
          });
        }

        const result = await tutorsCollection.findOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (err) {
        console.log(err);

        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    // CREATE TUTOR

    app.post("/tutors", async (req, res) => {
      try {
        const { tutorsCollection } = getCollections();

        const tutor = req.body;

        const tutorData = {
          ...tutor,
          price: Number(tutor.price),
          totalSlot: Number(tutor.totalSlot),
          booked: 0,
          createdAt: new Date(),
        };

        const result = await tutorsCollection.insertOne(tutorData);

        res.send({
          success: true,
          insertedId: result.insertedId,
        });
      } catch (err) {
        console.log(err);

        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    // UPDATE TUTOR

    app.patch("/tutors/:id", async (req, res) => {
      try {
        const { tutorsCollection } = getCollections();

        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid tutor id",
          });
        }

        const updateData = req.body;

        delete updateData._id;

        if (updateData.price) {
          updateData.price = Number(updateData.price);
        }

        if (updateData.totalSlot) {
          updateData.totalSlot = Number(updateData.totalSlot);
        }

        const result = await tutorsCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: updateData,
          },
        );

        res.send({
          success: true,
          modifiedCount: result.modifiedCount,
        });
      } catch (err) {
        console.log(err);

        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    // DELETE TUTOR

    app.delete("/tutors/:id", async (req, res) => {
      try {
        const { tutorsCollection, bookingsCollection } = getCollections();

        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid tutor id",
          });
        }

        // delete bookings linked to tutor
        await bookingsCollection.deleteMany({
          tutorId: id,
        });

        // delete tutor
        const result = await tutorsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send({
          success: true,
          deletedCount: result.deletedCount,
        });
      } catch (err) {
        console.log(err);

        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    // GET BOOKINGS (FIXED VERSION)

    app.get("/bookings", async (req, res) => {
      try {
        
        const { bookingsCollection } = getCollections();

        const queryEmail = req.query.email;

        let query = {};
        if (queryEmail) {
          
          query = { studentEmail: queryEmail.trim() };
        }

        const results = await bookingsCollection.find(query).toArray();
        res.status(200).json(results);
      } catch (err) {
        console.error("Backend Error inside GET /bookings:", err);
        res.status(500).json({ success: false, message: err.message });
      }
    });

    // CREATE BOOKING

    app.post("/bookings", async (req, res) => {
      try {
        const { bookingsCollection, tutorsCollection } = getCollections();

        const booking = req.body;

        const tutor = await tutorsCollection.findOne({
          _id: new ObjectId(booking.tutorId),
        });

        // Tutor not found
        if (!tutor) {
          return res.status(404).send({
            success: false,
            message: "Tutor not found",
          });
        }

        // Slot check
        if (Number(tutor.totalSlot) <= 0) {
          return res.status(400).send({
            success: false,
            message:
              "This session is fully booked. You can’t join at the moment.",
          });
        }

        // Date restriction
        const sessionDate = new Date(tutor.sessionDate || tutor.startDate);

        const now = new Date();

        if (now < sessionDate) {
          return res.status(400).send({
            success: false,
            message: "Booking is not available yet for this tutor",
          });
        }

        // Booking data
        const bookingData = {
          ...booking,
          bookingStatus: "Booked",
          bookingDate: new Date(),
        };

        // Insert booking
        const result = await bookingsCollection.insertOne(bookingData);

        // decrease slot
        await tutorsCollection.updateOne(
          {
            _id: new ObjectId(booking.tutorId),
          },
          {
            $inc: {
              totalSlot: -1,
            },
          },
        );

        res.send({
          success: true,
          insertedId: result.insertedId,
        });
      } catch (err) {
        console.log(err);

        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    // CANCEL BOOKING

    app.patch("/bookings/cancel/:id", async (req, res) => {
      try {
        const { bookingsCollection } = getCollections();

        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid booking id",
          });
        }

        const result = await bookingsCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              bookingStatus: "Cancelled",
            },
          },
        );

        res.send({
          success: true,
          modifiedCount: result.modifiedCount,
        });
      } catch (err) {
        console.log(err);

        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    // ROOT

    app.get("/", (req, res) => {
      res.send("MediQueue Server Running");
    });
  } catch (err) {
    console.log(err);
  }
}

run().catch(console.dir);

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

module.exports = app;