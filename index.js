const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.port || 5000;

// middleware
app.use(cors());
app.use(express.json());

// verify jwt
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  // verify a token symmetric
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5ad6o2n.mongodb.net/?retryWrites=true&w=majority`;

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
    // await client.connect();

    const usersCollection = client.db("craftedShotsDb").collection("users");
    const allDataCollection = client.db("craftedShotsDb").collection("alldata");
    const reviewCollection = client.db("craftedShotsDb").collection("reviews");
    const paymentCollection = client
      .db("craftedShotsDb")
      .collection("payments");
    const selectedClassCollection = client
      .db("craftedShotsDb")
      .collection("selectedclass");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      console.log(req);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "2h",
      });
      res.send({ token });
    });

    // users related apis

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // Admin verify with email
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user.role === "admin" };
      res.send(result);
    });

    // this is for admin role
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // Instructor verify with email
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user.role === "instructor" };
      res.send(result);
    });

    // this is for Instructor role
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Student verify with email
    app.get("/users/student/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = {
        student: user.role != "admin" && user.role != "instructor",
      };
      res.send(result);
    });

    // this is for student role
    app.patch("/users/student/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "student",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // add class by Instructor
    app.post("/alldata", verifyJWT, async (req, res) => {
      const addItem = req.body;
      const result = await allDataCollection.insertOne(req.body);
      res.send(result);
    });

    // get class by email
    app.get("/alldata/:email", async (req, res) => {
      const result = await usersCollection
        .find({ email: req.params.email })
        .toArray();
      res.send(result);
    });

    // update class data by Instructor
    app.patch("/updateclass/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          classTitle: req.body.classTitle,
          courseFee: req.body.courseFee,
        },
      };
      const result = await allDataCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // approve class by admin
    app.patch("/approvedclasses/:id", async (req, res) => {
      const updateStatus = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: updateStatus.status,
        },
      };
      const result = await allDataCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // deny classes by admin
    app.patch("/denyclass/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const { feedback } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "denied",
          feedback: feedback,
        },
      };
      const result = await allDataCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // selected Classes for student
    app.post("/selectedclass", async (req, res) => {
      const selectedClass = req.body;
      const result = await selectedClassCollection.insertOne(selectedClass);
      res.send(result);
    });

    // for dashboard displayed
    app.get("/selectedmyclass", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      const query = { email: email };
      const result = await selectedClassCollection.find(query).toArray();
      res.send(result);
    });

    //  delete Class from Selected class page by student
    app.delete("/selectedmyclass/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassCollection.deleteOne(query);
      res.send(result);
    });

    // all data load
    app.get("/alldata", async (req, res) => {
      const result = await allDataCollection.find().toArray();
      res.send(result);
    });
    // for review
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // 
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { courseFee } = req.body;
      const amount = parseInt(courseFee * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payment related API's Here

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      const updateQuery = { _id: new ObjectId(payment.selectedClassId) };
      const updatedSeat = { $inc: { availableSeats: -1 } };
      const options = { upsert: true };
      const updateResult = await allDataCollection.updateOne(
        updateQuery,
        updatedSeat,
        options
      );

      const deleteQuery = { _id: new ObjectId(payment.classId) };
      const deleteResult = await selectedClassCollection.deleteOne(deleteQuery);

      res.send({ insertResult, deleteResult, updateResult });
    });

    // payment history and the newest payment will be at the top
    app.get("/payments", verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      const query = { email: email };
      const result = await paymentCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });
    // Enrolled Classes
    app.get("/enrolled-classes", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await paymentCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("SERVER IS RUNNING");
});

app.listen(port, () => {
  console.log(`running on port, ${port}`);
});
