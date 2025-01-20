# Pharma Care Server

This repository contains the backend implementation for **Pharma Care**, a comprehensive e-commerce platform designed to sell pharmacy products and medicines with a user-friendly interface for buyers, sellers, and administrators. This project offers an extensive set of features, including dashboards for users, sellers, and admins, robust payment management, and advanced reporting tools.

---

## Server URL

[Live Server](https://pharmacare-server.vercel.app/)

---

# Pharma Care - Server Side

## Key Features:

### **User Authentication & Authorization:**

- User sign-up, login, and role-based authentication (User, Seller, Admin).
- Social login integration via Google and GitHub.
- JWT token-based authentication and secure routes for private pages.

### **Multi-Vendor Setup:**

- Supports multiple sellers managing their own products.
- Role-based access control for users (User, Seller, Admin).

---

### **Admin Features:**

1. **User Management:**

   - Promote/demote users to/from Seller/Admin roles.
   - Assign or revoke admin privileges for users.

2. **Category Management:**

   - Add, update, and delete categories for medicines.
   - Maintain a dynamic list of categories on the platform.

3. **Sales Report:**

   - Generate and download sales reports (PDF, CSV, XLSX) by filtering through dates and other criteria.
   - View total sales revenue and pending payments for the platform.

4. **Payment Management:**

   - Approve or reject payments based on order status (Paid or Pending).
   - View detailed payment information for all transactions.

5. **Advertisement Management:**
   - Control which medicines appear in the homepage slider banner.
   - Toggle medicine advertisements on or off via a simple interface.

---

### **Seller Features:**

1. **Medicine Management:**

   - Add new medicines with detailed information (name, category, price, description, etc.).
   - Update or delete their own medicines in the inventory.

2. **Sales & Revenue Tracking:**

   - View total sales revenue for their own products.
   - Track payment status (Pending, Paid) for each transaction.

3. **Advertisement Request:**

   - Submit requests to feature their medicines in the homepage slider.
   - Provide medicine details and images for the advertisement.

4. **Payment History:**
   - View payment history for all sold medicines.
   - See transaction status and pending payments.

---

### **User Features:**

1. **Product Browsing & Search:**

   - Browse medicines by category, price, and discounts.
   - Use search and filter options to easily find products.

2. **Medicine Details:**

   - View detailed information of each medicine, including price, description, and images.
   - Add products to the cart for checkout.

3. **Cart Management:**

   - Add, remove, or modify the quantity of products in the cart.
   - Proceed to checkout and make payments via Stripe.

4. **Order & Payment History:**

   - View past order details, including status (Pending, Paid).
   - Generate invoices for completed purchases.

5. **Profile & Authentication:**
   - Manage personal information like username, email, and profile picture.
   - Secure login and registration with role-based access.

---

### **Common Features:**

1. **Database Management:**

   - MongoDB is used to store user data, products, orders, and payments.
   - Models are created for users, medicines, categories, orders, and payments.

2. **Order & Payment System:**

   - Stripe integration for seamless online payment.
   - Track order status and payment confirmation.

3. **Environment Configuration:**

   - Sensitive data (MongoDB credentials, Firebase keys) are stored in a `.env` file.
   - Separate configurations for local and production environments.

4. **Security Best Practices:**

   - Token validation for private routes.
   - CSRF and XSS protection strategies.

5. **Error Handling & Notifications:**
   - Use of SweetAlert or Toast notifications for successful operations and error messages.
   - Centralized error-handling middleware to capture and handle errors.

---

## Tech Stack

- **Server Framework:** Express.js
- **Database:** MongoDB
- **Authentication:** JWT (JSON Web Tokens)
- **Payment Management:** Stripe
- **Environment Management:** dotenv
- **Middleware:** CORS

---

## Endpoints

## General Endpoints

- **`GET /`**  
  Returns a success message to verify the server is running.

---

## Home Page Endpoints

- **`GET /banner`**  
  Fetches all the dynamic banner sllider for hero.

- **`GET /banners/discounted`**  
  Get all the medicines which has dicount to show discount sliders dynamically.

- **`GET /medicines-count`**  
  Get all the filtered medicines count.

- **`GET /public/categoris`**  
  Get all the categories added by admin from dashboard.

---

## Authentication Endpoints

- **`POST /jwt`**  
  Generates a JWT token for secure data transmission and sets it in a cookie.

- **`POST /user`**  
  Create user on Database after getting successfully created on firebase.

---

## Medicines Endpoints

- **`GET /medicines`**  
  Fetches all medicines based on query parameters (`category`, `count`, `reviews`, `search`).

- **`GET /medicines/categories`**  
  Fetches all unique medicines categories.

---

## Carts Endpoints `(requires JWT verification)`

- **`GET /carts/:email`**  
  Fetches carts items for a specific user.

- **`PATCH /carts/:id`**  
  Update a specific cart item by ID.

- **`POST /carts`**  
  Saves a new cart item to the database.

- **`DELETE /carts/:id`**  
  Delete a specific cart item by id.

- **`DELETE /tutors/:id`**  
  Deletes a specific tutor by ID.

- **`DELETE /clear/carts/:email`**  
  Delete all carts item from a specific user.

---

## Payments Endpoints `(requires JWT & User verification)`

- **`POST /create-payment-intent`**  
  Create client secret which is basically used to cut balance from user's wallet.

---

## Orders Endpoints `(requires JWT & User verification)`

- **`POST /orders`**  
  Saves a new order to the database after successfully payment via stripe.

---

## Invoice Endpoints `(requires JWT & User verification)`

- **`GET /invoice/:id`**  
  Get a specific invoice details via invoice id which is basically transaction id from stripe.

---

## Admin Endpoints `(requires JWT & Admin verification)`

- **`GET /admin-stats`**  
  Get admin stats data with aggregate to visualize with chart.

- **`GET /users/:email`**  
  Get all users data execpt admin who logged in and requested.

- **`PATCH /users/:id/:role`**  
  Update a specific user's role based on id.

- **`GET /categories`**  
  Get all categories to manage them.

- **`POST /categories`**  
  Add a category to the Database form dashboard

- **`PUT /categories/:id`**  
  Update a specific categories by their id.

- **`DELETE /categories/:id`**  
  Delete specific category.

- **`PATCH /payments/:id`**  
  Update payments status. pending to `paid` or `reject`.

- **`PATCH /banners/:id`**  
  Update Banners status. requested to `added` or `removed`.

- **`GET /sales-report`**  
  Generate custom sales report with aggregation.

---

## Seller Endpoints `(requires JWT & Seller verification)`

- **`GET /seller/stats/:email`**  
   Get seller stats data with aggregate to visualize with chart.

- **`GET /seller/medicines/:email`**  
   Get seller's specific medicine data.

- **`GET /seller/payments/:email`**  
   Get seller payments infos with custom aggregate.

- **`POST /medicines`**  
   Save new medicine to the Database.

- **`GET /seller/avertisements/:email`**  
   Get seller's requested advertisements for adding to the slide and their status.

- **`POST /banners`**  
   Request for adding banner to the slide.

---

## User Endpoints `(requires JWT & User verification)`

- **`GET /users/payments/:email`**  
  Get a specific user's payments history.

- **`GET /users/:email`**  
  Get a specific user's details from Database.

- **`PUT /users/:email`**  
  Update a specific user's details..

---

## Features

- **Authentication:**  
  Secure JWT-based authentication and authorization for API access.

- **Dynamic Queries:**  
  Flexible query-based data retrieval for tutors and categories.

- **Database Integration:**  
  Robust interaction with MongoDB for efficient data storage and retrieval.

- **Middleware Usage:**  
  Cookie handling, CORS setup, and request validation for enhanced security and functionality.

---

## Dependencies

The following dependencies are used in this project:

- **cors**: ^2.8.5  
  Middleware to enable Cross-Origin Resource Sharing (CORS).

- **dotenv**: ^16.4.7  
  Loads environment variables from a `.env` file into `process.env`.

- **express**: ^4.21.2  
  Fast, unopinionated web framework for Node.js.

- **jsonwebtoken**: ^9.0.2  
  JSON Web Token (JWT) for securely transmitting information between parties.

- **mongodb**: ^6.12.0  
  Official MongoDB driver for Node.js for data storage and retrieval.

- **stripe**: ^17.5.0  
  Integration with Stripe API for payment processing and related functionality.

---

## 🔧 How to Run

1. **Clone the repository.**

```bash
   git clone https://github.com/FollowNaim/Pharmacare-server
   cd Pharmacare-Server
```

2. **Install Dependencies**

```bash
npm install
```

3. **Setup Environment Variables**

- create .env in the root directory.
- Add `STRIPE_SECRET_KEY` variable and put your **stripe secret token**.
- Add `JWT_SECRET_KEY` variable and put your **jwt secret token**.
- create a collection on mongodb atlas.
- Add `DB_USER, DB_PASS` variable and add your database username and password.

4. **Run the application**

```bash
npm run dev
```

5. **Access the app**

- Open http://localhost:5000 in your browser.

---

## 🛠️ Deployment

- Hosted on Netlify or Vercel for a fast and reliable experience.

---

## 🤝 Contributions

Contributions are welcome! Fork this repository, make your changes, and submit a pull request.
