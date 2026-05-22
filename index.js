const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const {
  MongoClient,
  ObjectId,
  ServerApiVersion,
} = require("mongodb");

dotenv.config();

const app = express();

const { auth } = require("./auth");

// =========================
// MIDDLEWARE
// =========================

// Replace your current cors() block with this:
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        "http://localhost:3000",
        "https://medi-queue-zeta.vercel.app",
        "https://medi-queue-server-eight.vercel.app",
      ];

      // Allow requests with no origin (Postman, curl, server-to-server)
      if (!origin) return callback(null, true);

      // Allow any Vercel preview URL for your project
      const isVercelPreview = /https:\/\/medi-queue-.*\.vercel\.app$/.test(origin);

      if (allowedOrigins.includes(origin) || isVercelPreview) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Add this BEFORE your routes — handles preflight OPTIONS requests
app.options("/{*path}", cors());

app.use(express.json());

// =========================
// BETTER AUTH ROUTE
// =========================

app.use("/api/auth", (req, res) => {
  return auth.handler(req, res);
});

// =========================
// PORT
// =========================

const port = process.env.PORT || 5000;

// =========================
// MONGODB
// =========================

const client = new MongoClient(
  process.env.MONGODB_URI,
  {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  }
);

function getCollections() {
  const db = client.db("MediQueue");

  return {
    tutorsCollection: db.collection(
      "tutors"
    ),

    bookingsCollection: db.collection(
      "bookings"
    ),
  };
}

// =========================
// VERIFY SESSION
// =========================

const verifySession = async (
  req,
  res,
  next
) => {
  try {
    const session =
      await auth.api.getSession({
        headers: req.headers,
      });

    if (!session) {
      return res.status(401).send({
        success: false,
        message: "Unauthorized Access",
      });
    }

    req.user = session.user;

    next();
  } catch (error) {
    console.log(error);

    res.status(401).send({
      success: false,
      message: "Invalid Session",
    });
  }
};

// =========================
// RUN SERVER
// =========================

async function run() {
  try {
     await client.connect();

    console.log("✅ MongoDB Connected");

    // =========================
    // ROOT
    // =========================

    app.get("/", (req, res) => {
      res.send(
        "MediQueue Server Running"
      );
    });

    // =========================
    // GET ALL TUTORS
    // =========================

    app.get("/tutors", async (req, res) => {
      try {
        const { tutorsCollection } =
          getCollections();

        const {
          search,
          sort,
          email,
        } = req.query;

        let query = {};

        // Search
        if (search) {
          query.name = {
            $regex: search,
            $options: "i",
          };
        }

        // My Tutors
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

        const result =
          await tutorsCollection
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

    // =========================
    // FEATURED TUTORS
    // =========================

    app.get(
      "/featured-tutors",
      async (req, res) => {
        try {
          const {
            tutorsCollection,
          } = getCollections();

          const result =
            await tutorsCollection
              .find({})
              .limit(6)
              .toArray();

          res.send(result);
        } catch (err) {
          console.log(err);

          res.status(500).send({
            success: false,
            message: err.message,
          });
        }
      }
    );

    // =========================
    // GET SINGLE TUTOR
    // =========================

    app.get(
      "/tutors/:id",
      async (req, res) => {
        try {
          const {
            tutorsCollection,
          } = getCollections();

          const id = req.params.id;

          if (!ObjectId.isValid(id)) {
            return res
              .status(400)
              .send({
                success: false,
                message:
                  "Invalid tutor id",
              });
          }

          const result =
            await tutorsCollection.findOne({
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
      }
    );

    // =========================
    // CREATE TUTOR
    // =========================

    app.post(
      "/tutors",
      verifySession,
      async (req, res) => {
        try {
          const {
            tutorsCollection,
          } = getCollections();

          const tutor = req.body;

          const tutorData = {
            ...tutor,
            creatorEmail:
              req.user.email,
            price: Number(
              tutor.price
            ),
            totalSlot: Number(
              tutor.totalSlot
            ),
            booked: 0,
            createdAt: new Date(),
          };

          const result =
            await tutorsCollection.insertOne(
              tutorData
            );

          res.send({
            success: true,
            insertedId:
              result.insertedId,
          });
        } catch (err) {
          console.log(err);

          res.status(500).send({
            success: false,
            message: err.message,
          });
        }
      }
    );

    // =========================
    // UPDATE TUTOR
    // =========================

    app.patch(
      "/tutors/:id",
      verifySession,
      async (req, res) => {
        try {
          const {
            tutorsCollection,
          } = getCollections();

          const id = req.params.id;

          if (!ObjectId.isValid(id)) {
            return res
              .status(400)
              .send({
                success: false,
                message:
                  "Invalid tutor id",
              });
          }

          const updateData =
            req.body;

          delete updateData._id;

          if (updateData.price) {
            updateData.price =
              Number(
                updateData.price
              );
          }

          if (
            updateData.totalSlot
          ) {
            updateData.totalSlot =
              Number(
                updateData.totalSlot
              );
          }

          const result =
            await tutorsCollection.updateOne(
              {
                _id: new ObjectId(
                  id
                ),
              },
              {
                $set: updateData,
              }
            );

          res.send({
            success: true,
            modifiedCount:
              result.modifiedCount,
          });
        } catch (err) {
          console.log(err);

          res.status(500).send({
            success: false,
            message: err.message,
          });
        }
      }
    );

    // =========================
    // DELETE TUTOR
    // =========================

    app.delete(
      "/tutors/:id",
      verifySession,
      async (req, res) => {
        try {
          const {
            tutorsCollection,
            bookingsCollection,
          } = getCollections();

          const id = req.params.id;

          if (!ObjectId.isValid(id)) {
            return res
              .status(400)
              .send({
                success: false,
                message:
                  "Invalid tutor id",
              });
          }

          await bookingsCollection.deleteMany(
            {
              tutorId: id,
            }
          );

          const result =
            await tutorsCollection.deleteOne(
              {
                _id: new ObjectId(
                  id
                ),
              }
            );

          res.send({
            success: true,
            deletedCount:
              result.deletedCount,
          });
        } catch (err) {
          console.log(err);

          res.status(500).send({
            success: false,
            message: err.message,
          });
        }
      }
    );

    // =========================
    // GET BOOKINGS
    // =========================

    app.get(
      "/bookings",
      verifySession,
      async (req, res) => {
        try {
          const {
            bookingsCollection,
          } = getCollections();

          const result =
            await bookingsCollection
              .find({
                studentEmail:
                  req.user.email,
              })
              .toArray();

          res.send(result);
        } catch (err) {
          console.log(err);

          res.status(500).send({
            success: false,
            message: err.message,
          });
        }
      }
    );

    // =========================
    // CREATE BOOKING
    // =========================

    app.post(
      "/bookings",
      verifySession,
      async (req, res) => {
        try {
          const {
            bookingsCollection,
            tutorsCollection,
          } = getCollections();

          const booking =
            req.body;

          const tutor =
            await tutorsCollection.findOne(
              {
                _id: new ObjectId(
                  booking.tutorId
                ),
              }
            );

          if (!tutor) {
            return res
              .status(404)
              .send({
                success: false,
                message:
                  "Tutor not found",
              });
          }

          if (
            Number(
              tutor.totalSlot
            ) <= 0
          ) {
            return res
              .status(400)
              .send({
                success: false,
                message:
                  "No available slots",
              });
          }

          const bookingData = {
            ...booking,
            studentEmail:
              req.user.email,
            bookingStatus:
              "Booked",
            bookingDate:
              new Date(),
          };

          const result =
            await bookingsCollection.insertOne(
              bookingData
            );

          await tutorsCollection.updateOne(
            {
              _id: new ObjectId(
                booking.tutorId
              ),
            },
            {
              $inc: {
                totalSlot: -1,
              },
            }
          );

          res.send({
            success: true,
            insertedId:
              result.insertedId,
          });
        } catch (err) {
          console.log(err);

          res.status(500).send({
            success: false,
            message: err.message,
          });
        }
      }
    );

    // =========================
    // CANCEL BOOKING
    // =========================

    app.patch(
      "/bookings/cancel/:id",
      verifySession,
      async (req, res) => {
        try {
          const {
            bookingsCollection,
          } = getCollections();

          const id = req.params.id;

          if (!ObjectId.isValid(id)) {
            return res
              .status(400)
              .send({
                success: false,
                message:
                  "Invalid booking id",
              });
          }

          const result =
            await bookingsCollection.updateOne(
              {
                _id: new ObjectId(
                  id
                ),
              },
              {
                $set: {
                  bookingStatus:
                    "Cancelled",
                },
              }
            );

          res.send({
            success: true,
            modifiedCount:
              result.modifiedCount,
          });
        } catch (err) {
          console.log(err);

          res.status(500).send({
            success: false,
            message: err.message,
          });
        }
      }
    );
  } catch (err) {
    console.log(err);
  }
}

run().catch(console.dir);

// =========================
// START SERVER
// =========================

if (
  process.env.NODE_ENV !==
  "production"
) {
  app.listen(port, () => {
    console.log(
      `Server running on http://localhost:${port}`
    );
  });
}

module.exports = app;