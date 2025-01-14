require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 5000;
const cors = require("cors");
const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("server is running");
});

// mongo url
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sdg7y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const run = async () => {
  try {
    await client.connect();
    console.log("server connected successfully to mongodb");
    const usersCollection = client.db("pharma-care").collection("users");
    const medicinesCollection = client
      .db("pharma-care")
      .collection("medicines");
    // create user and save
    app.post("/user", async (req, res) => {
      const { user } = req.body;
      const isExist = await usersCollection.findOne({ email: user.email });
      console.log(isExist);
      if (isExist) return res.status(409).send("user already exist");
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // get all medicine data
    app.get("/medicines", async (req, res) => {
      const result = await medicinesCollection.find().toArray();
      res.send(result);
    });
  } catch (err) {
    console.log(err);
  }
};
run();

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
