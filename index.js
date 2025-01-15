require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const cartsCollection = client.db("pharma-care").collection("carts");
    const ordersCollection = client.db("pharma-care").collection("orders");
    const categoriesCollection = client
      .db("pharma-care")
      .collection("categories");
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

    // get medicine from cart for per user
    app.get("/carts/:email", async (req, res) => {
      const result = await cartsCollection
        .find({ "customer.email": req.params.email })
        .toArray();
      res.send(result);
    });

    // save medicine to the cart
    app.post("/carts", async (req, res) => {
      const medicine = req.body;
      const isExist = await cartsCollection.findOne({
        email: medicine.email,
        medicineId: medicine.medicineId,
      });
      if (isExist) {
        const cartItem = await cartsCollection.updateOne(
          {
            email: medicine.email,
            medicineId: medicine.medicineId,
          },
          {
            $inc: {
              quantity: 1,
            },
          }
        );
        return res.send(cartItem);
      }
      const result = await cartsCollection.insertOne(medicine);
      res.send(result);
    });

    // handle increment & decrement cart item
    app.patch("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const decrement = req.query.decrement;
      if (decrement) {
        const result = await cartsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $inc: {
              quantity: -1,
            },
          }
        );
        return res.send(result);
      }
      const result = await cartsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $inc: {
            quantity: 1,
          },
        }
      );
      res.send(result);
    });

    // clear the cart
    app.delete("/carts/clear/:email", async (req, res) => {
      const result = await cartsCollection.deleteMany({
        "customer.email": req.params.email,
      });
      res.send(result);
    });

    // get invoice by payment id
    app.get("/invoice/:invoiceId", async (req, res) => {
      // aggregate to join the medicine details from medicines to the ordered items with medicineId
      const result = await ordersCollection
        .aggregate([
          {
            $match: {
              transactionId: req.params.invoiceId,
            },
          },
          {
            $unwind: "$medicines",
          },
          {
            $set: {
              "medicines.medicineId": {
                $toObjectId: "$medicines.medicineId",
              },
            },
          },
          {
            $lookup: {
              from: "medicines",
              localField: "medicines.medicineId",
              foreignField: "_id",
              as: "medicineDetails",
            },
          },
          {
            $unwind: "$medicineDetails",
          },
          {
            $addFields: {
              "medicines.totalPrice": {
                $multiply: ["$medicineDetails.price", "$medicines.quantity"],
              },
            },
          },
          {
            $group: {
              _id: "$_id",
              transactionId: { $first: "$transactionId" },
              ordered_items: {
                $push: {
                  itemId: "$medicines.medicineId",
                  quantity: "$medicines.quantity",
                  name: "$medicineDetails.name",
                  unitPrice: "$medicineDetails.price",
                  totalPrice: "$medicines.totalPrice",
                },
              },
              totalOrderPrice: {
                $sum: {
                  $multiply: ["$medicineDetails.price", "$medicines.quantity"],
                },
              },
            },
          },
        ])
        .toArray();
      res.send(result[0] || []);
    });

    // save order to collection after successfull payment
    app.post("/orders", async (req, res) => {
      const medicine = req.body;
      medicine.status = "requested";
      const result = await ordersCollection.insertOne(medicine);
      res.send(result);
    });

    // payments related apis

    // create payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { email } = req.body;
      const carts = await cartsCollection
        .find({ "customer.email": email })
        .toArray();
      const totalPrice =
        carts.reduce((acc, cur) => acc + cur.price * cur.quantity, 0) * 100;
      console.log(email, carts);
      if (!totalPrice) return;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalPrice,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });
      res.send(paymentIntent);
    });

    // dashboard related apis

    // admin apis

    // admin stats
    app.get("/admin-stats", async (req, res) => {
      // generating individual and total sales
      const totalSales = await ordersCollection
        .aggregate([
          {
            $unwind: "$medicines",
          },
          {
            $set: {
              "medicines.medicineId": {
                $toObjectId: "$medicines.medicineId",
              },
            },
          },
          {
            $lookup: {
              from: "medicines",
              localField: "medicines.medicineId",
              foreignField: "_id",
              as: "medicineItems",
            },
          },
          {
            $unwind: "$medicineItems",
          },
          {
            $group: {
              _id: "$medicineItems.category",
              totalSales: {
                $sum: {
                  $multiply: ["$medicines.quantity", "$medicineItems.price"],
                },
              },
            },
          },
          {
            $group: {
              _id: 0,
              items: {
                $push: {
                  category: "$_id",
                  totalSales: "$totalSales",
                },
              },
              totalSales: {
                $sum: "$totalSales",
              },
            },
          },
        ])
        .toArray();

      // generating paid individual and total sales
      const paidTotal = await ordersCollection
        .aggregate([
          {
            $match: {
              status: "paid",
            },
          },
          {
            $unwind: "$medicines",
          },
          {
            $set: {
              "medicines.medicineId": {
                $toObjectId: "$medicines.medicineId",
              },
            },
          },
          {
            $lookup: {
              from: "medicines",
              localField: "medicines.medicineId",
              foreignField: "_id",
              as: "medicineItems",
            },
          },
          {
            $unwind: "$medicineItems",
          },
          {
            $group: {
              _id: "$medicineItems.category",
              totalSales: {
                $sum: {
                  $multiply: ["$medicines.quantity", "$medicineItems.price"],
                },
              },
            },
          },
          {
            $group: {
              _id: 0,
              items: {
                $push: {
                  category: "$_id",
                  totalSales: "$totalSales",
                },
              },
              totalRevenue: { $sum: "$totalSales" },
            },
          },
        ])
        .toArray();

      // generating unpaid individual and total sales
      const unpaidTotal = await ordersCollection
        .aggregate([
          {
            $match: {
              status: "requested",
            },
          },
          {
            $unwind: "$medicines",
          },
          {
            $set: {
              "medicines.medicineId": { $toObjectId: "$medicines.medicineId" },
            },
          },
          {
            $lookup: {
              from: "medicines",
              localField: "medicines.medicineId",
              foreignField: "_id",
              as: "medicineItems",
            },
          },
          {
            $unwind: "$medicineItems",
          },
          {
            $group: {
              _id: "$medicineItems.category",
              totalSales: {
                $sum: {
                  $multiply: ["$medicineItems.price", "$medicines.quantity"],
                },
              },
            },
          },
          {
            $group: {
              _id: 0,
              items: {
                $push: {
                  category: "$_id",
                  totalSales: "$totalSales",
                },
              },
              totalRevenue: {
                $sum: "$totalSales",
              },
            },
          },
        ])
        .toArray();
      res.send({ totalSales, paidTotal, unpaidTotal });
    });

    // get all users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // get all categories lists
    app.get("/categories", async (req, res) => {
      const result = await categoriesCollection.find().toArray();
      res.send(result);
    });

    // get all payments
    app.get("/payments", async (req, res) => {
      const result = await ordersCollection
        .aggregate([
          {
            $addFields: {
              priority: {
                $cond: {
                  if: { $eq: ["$status", "requested"] },
                  then: 1,
                  else: 2,
                },
              },
            },
          },
          {
            $sort: { priority: 1 },
          },
          {
            $project: {
              priority: 0,
            },
          },
        ])
        .toArray();
      res.send(result);
    });

    // get custom sales report
    app.get("/sales-report", async (req, res) => {
      const result = await ordersCollection
        .aggregate([
          {
            $unwind: "$medicines",
          },
          {
            $set: {
              "medicines.medicineId": {
                $toObjectId: "$medicines.medicineId",
              },
            },
          },
          {
            $lookup: {
              from: "medicines",
              localField: "medicines.medicineId",
              foreignField: "_id",
              as: "medicineItems",
            },
          },
          {
            $unwind: "$medicineItems",
          },
          {
            $addFields: {
              IndividualTotal: {
                $sum: {
                  $multiply: ["$medicineItems.price", "$medicines.quantity"],
                },
              },
              perUnitPrice: "$medicineItems.price",
            },
          },
          {
            $project: {
              _id: 1,
              medicineItems: 0,
              totalPrice: 0,
            },
          },
        ])
        .toArray();
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
