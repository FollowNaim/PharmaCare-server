require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
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

const verifyToken = (req, res, next) => {
  const token = req.headers?.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).send("unauthorized access");
  }
  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send("unauthorized access");
    }
    req.decoded = decoded;
    next();
  });
};

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
    const bannersCollection = client.db("pharma-care").collection("banners");

    // verify users admin role
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await usersCollection.findOne({ email });
      console.log(user);
      if (user.role === "admin") {
        next();
      } else {
        res.status(401).send("unauthorized access");
      }
    };
    // verify users seller role
    const verifySeller = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await usersCollection.findOne({ email });
      if (user.role === "seller") {
        next();
      } else {
        res.status(401).send("unauthorized access");
      }
    };

    // verify user's user role
    const verifyUser = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await usersCollection.findOne({ email });
      if (user.role === "user") {
        next();
      } else {
        res.status(401).send("unauthorized access");
      }
    };

    // get user role
    app.get("/user-role/:email", verifyToken, async (req, res) => {
      const email = req.decoded.email;
      if (email !== req.params.email)
        return res.status(401).send("unauthorized access");
      const user = await usersCollection.findOne({ email });
      res.send({ role: user.role });
    });

    // get all banners infos
    app.get("/banners", async (req, res) => {
      const result = await bannersCollection
        .aggregate([
          {
            $addFields: {
              priority: {
                $cond: {
                  if: ["$status", "added"],
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

    // create user and save
    app.post("/user", async (req, res) => {
      const { user } = req.body;
      const isExist = await usersCollection.findOne({ email: user.email });

      if (isExist) return res.status(409).send("user already exist");
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // generate jwt
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = await jwt.sign(user, process.env.JWT_SECRET_KEY, {
        expiresIn: "5d",
      });
      res.send(token);
    });

    // get all medicines count
    app.get("/medicines-count", async (req, res) => {
      const result = await medicinesCollection.estimatedDocumentCount();
      res.send({ count: result });
    });

    // get all medicine data
    app.get("/medicines", async (req, res) => {
      const desc = req.query.desc;
      const search = req.query.search;
      const query = {};
      const sortQuery = {};
      if (desc == "true") {
        sortQuery.price = -1;
      }
      if (search) {
        query.name = { $regex: search, $options: "i" };
      }
      const page = parseInt(req.query.page) || 0;
      const size = parseInt(req.query.size) || 10;
      const result = await medicinesCollection
        .find(query)
        .limit(size)
        .skip(page * size)
        .sort(sortQuery)
        .toArray();
      res.send(result);
    });

    // get medicine from cart for per user
    app.get("/carts/:email", verifyToken, async (req, res) => {
      const result = await cartsCollection
        .find({ "customer.email": req.params.email })
        .toArray();
      res.send(result);
    });

    // save medicine to the cart
    app.post("/carts", verifyToken, async (req, res) => {
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
    app.patch("/carts/:id", verifyToken, async (req, res) => {
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
    app.delete("/carts/clear/:email", verifyToken, async (req, res) => {
      const result = await cartsCollection.deleteMany({
        "customer.email": req.params.email,
      });
      res.send(result);
    });

    // get invoice by payment id
    app.get("/invoice/:invoiceId", verifyToken, async (req, res) => {
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
      console.log(result);
      res.send(result[0] || []);
    });

    // save order to collection after successfull payment
    app.post("/orders", verifyToken, async (req, res) => {
      const medicine = req.body;
      medicine.status = "requested";
      medicine.orderDate = new Date();
      const result = await ordersCollection.insertOne(medicine);
      res.send(result);
    });

    // payments related apis

    // create payment intent
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { email } = req.body;
      const carts = await cartsCollection
        .find({ "customer.email": email })
        .toArray();
      const totalPrice =
        carts.reduce((acc, cur) => acc + cur.price * cur.quantity, 0) * 100;

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
    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
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
              status: { $first: "$status" },
            },
          },
          {
            $group: {
              _id: 0,
              items: {
                $push: {
                  category: "$_id",
                  totalSales: "$totalSales",
                  status: "$status",
                },
              },
              totalRevenue: {
                $sum: "$totalSales",
              },
            },
          },
        ])
        .toArray();

      // generating rejected individual and total sales
      const rejectedTotal = await ordersCollection
        .aggregate([
          {
            $match: {
              status: "rejected",
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
              status: { $first: "$status" },
            },
          },
          {
            $group: {
              _id: 0,
              items: {
                $push: {
                  category: "$_id",
                  totalSales: "$totalSales",
                  status: "$status",
                },
              },
              totalRevenue: {
                $sum: "$totalSales",
              },
            },
          },
        ])
        .toArray();

      const rejectedUnpaid = await ordersCollection
        .aggregate([
          {
            $match: {
              status: { $in: ["rejected", "requested"] },
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
            $group: {
              _id: "$status",
              products: {
                $sum: 1,
              },
              totalPrice: {
                $sum: {
                  $multiply: ["$medicineDetails.price", "$medicines.quantity"],
                },
              },
            },
          },
        ])
        .toArray();

      res.send({
        totalSales,
        paidTotal,
        unpaidTotal,
        rejectedTotal,
        rejectedUnpaid,
      });
    });

    // get all users
    app.get("/users/:email", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection
        .find({ email: { $ne: req.params.email } })
        .toArray();
      res.send(result);
    });

    // update user role
    app.patch(
      "/users/:id/:role",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const result = await usersCollection.updateOne(
          {
            _id: new ObjectId(req.params.id),
          },
          { $set: { role: req.params.role } }
        );
        res.send(result);
      }
    );

    // get all categories lists
    app.get("/categories", verifyToken, async (req, res) => {
      const id = req.query.id;
      const query = {};
      if (id) {
        query._id = new ObjectId(id);
      }
      const result = await categoriesCollection.find(query).toArray();
      res.send(result);
    });

    // save new category to db
    app.post("/categories", verifyToken, verifyAdmin, async (req, res) => {
      const result = await categoriesCollection.insertOne(req.body);
      res.send(result);
    });

    // update a category
    app.put("/categories/:id", verifyToken, verifyAdmin, async (req, res) => {
      const data = req.body;
      const result = await categoriesCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        {
          $set: {
            name: data.name,
            image: data.image,
            description: data.description,
          },
        }
      );
      res.send(result);
    });

    // delete category from db
    app.delete(
      "/categories/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const result = await categoriesCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });
        res.send(result);
      }
    );
    // get all payments
    app.get("/payments", verifyToken, verifyAdmin, async (req, res) => {
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

    // update payment status
    app.patch("/payments/:id", verifyToken, verifyAdmin, async (req, res) => {
      const { status } = req.body;
      const result = await ordersCollection.updateOne(
        {
          _id: new ObjectId(req.params.id),
        },
        {
          $set: {
            status: status,
          },
        }
      );
      res.send(result);
    });

    // update banner status
    app.patch("/banners/:id", verifyToken, verifyAdmin, async (req, res) => {
      const { status } = req.body;
      const result = await bannersCollection.updateOne(
        {
          _id: new ObjectId(req.params.id),
        },
        {
          $set: {
            status: status,
          },
        }
      );
      res.send(result);
    });

    // get custom sales report
    app.get("/sales-report", verifyToken, verifyAdmin, async (req, res) => {
      const toDate =
        req.query.toDate === "null" || !req.query.toDate
          ? null
          : new Date(req.query.toDate);
      const fromDate =
        req.query.fromDate === "null" || !req.query.fromDate
          ? null
          : new Date(req.query.fromDate);
      if (fromDate) {
        fromDate.setUTCHours(0, 0, 0, 0);
      }
      if (toDate) {
        toDate.setUTCHours(23, 59, 59, 999);
      }

      let matchStage = {
        $match: {},
      };

      if (fromDate && !toDate) {
        matchStage.$match.orderDate = { $gte: fromDate };
      } else if (!fromDate && toDate) {
        matchStage.$match.orderDate = { $lte: toDate };
      } else if (fromDate && toDate) {
        matchStage.$match.orderDate = { $gte: fromDate, $lte: toDate };
      }

      const result = await ordersCollection
        .aggregate([
          matchStage,
          {
            $sort: { orderDate: -1 },
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
              "medicines.consumer.name": "$name",
              "medicines.consumer.email": "$email",
              "medicines.transactionId": "$transactionId",
              "medicines.medicineName": "$medicineDetails.name",
              "medicines.orderDate": "$orderDate",
              "medicines.IndividualTotal": {
                $sum: {
                  $multiply: ["$medicineDetails.price", "$medicines.quantity"],
                },
              },
              "medicines.perUnitPrice": "$medicineDetails.price",
            },
          },
          {
            $group: {
              _id: null,
              medicines: { $push: "$medicines" },
              totalPrice: { $sum: "$medicines.IndividualTotal" },
            },
          },
          {
            $project: {
              _id: 1,
              medicines: 1,
              totalPrice: 1,
              name: 1,
            },
          },
        ])
        .toArray();
      res.send(result);
    });

    // seller apis

    // sellar stats
    app.get(
      "/seller/stats/:email",
      verifyToken,
      verifySeller,
      async (req, res) => {
        // generating individual and total sales
        const totalSales = await ordersCollection
          .aggregate([
            {
              $match: {
                "medicines.seller.email": req.params.email,
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
                "medicines.seller.email": req.params.email,
              },
            },
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
                "medicines.seller.email": req.params.email,
              },
            },
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
      }
    );

    // sellers medicines
    app.get(
      "seller/medicines/:email",
      verifyToken,
      verifySeller,
      async (req, res) => {
        const email = req.params.email;
        const result = await medicinesCollection
          .find({ "seller.email": email })
          .toArray();
        res.send(result);
      }
    );

    // seller payments history with custom field with aggregate
    app.get(
      "/seller/payments/:email",
      verifyToken,
      verifySeller,
      async (req, res) => {
        const result = await ordersCollection
          .aggregate([
            {
              $match: {
                "medicines.seller.email": req.params.email,
              },
            },
            {
              $unwind: "$medicines",
            },
            {
              $addFields: {
                medicineId: {
                  $toObjectId: "$medicines.medicineId",
                },
              },
            },
            {
              $lookup: {
                from: "medicines",
                localField: "medicineId",
                foreignField: "_id",
                as: "medicineDetails",
              },
            },
            {
              $unwind: "$medicineDetails",
            },
            {
              $addFields: {
                "medicines.transactionId": "$transactionId",
                "medicines.consumer.name": "$name",
                "medicines.consumer.email": "$email",
                "medicines.status": "$status",
                "medicines.unitPrice": "$medicineDetails.price",
                "medicines.individualTotal": {
                  $sum: {
                    $multiply: [
                      "$medicines.quantity",
                      "$medicineDetails.price",
                    ],
                  },
                },
              },
            },
            {
              $group: {
                _id: "$medicines.seller.email",
                orders: {
                  $push: {
                    medicine: "$medicines",
                  },
                },
              },
            },
            {
              $project: {
                email: "$_id",
                orders: 1,
                _id: 0,
              },
            },
          ])
          .toArray();
        res.send(result);
      }
    );

    // add medicine to the db
    app.post("/medicines", verifyToken, verifySeller, async (req, res) => {
      const medicine = req.body;
      const result = await medicinesCollection.insertOne(medicine);
      res.send(result);
    });

    // sellers advertisements
    app.get(
      "/seller/advertisements/:email",
      verifyToken,
      verifySeller,
      async (req, res) => {
        if (!req.params.email) {
          return res.send("not allowed");
        }
        const result = await bannersCollection
          .find({
            "seller.email": req.params.email,
          })
          .toArray();
        res.send(result);
      }
    );

    // add sellers advertisements to db
    app.post("/banners", verifyToken, verifySeller, async (req, res) => {
      const banner = req.body;
      banner.status = "requested";
      const result = await bannersCollection.insertOne(banner);
      res.send(result);
    });

    // users apis

    // get users payments history
    app.get(
      "/users/payments/:email",
      verifyToken,
      verifyUser,
      async (req, res) => {
        const result = await ordersCollection
          .find({ email: req.params.email })
          .toArray();
        res.send(result);
      }
    );
    app.get();
  } catch (err) {
    console.log(err);
  }
};
run();

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
