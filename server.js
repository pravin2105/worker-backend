const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const fileUpload = require("express-fileupload");
const csv = require("csv-parser");
const fs = require("fs");


const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload());

// MySQL Database Connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root", // Replace with your MySQL username
  password: "12345678", // Replace with your MySQL password
  database: "workersdetails_db", // Your database name
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err.message);
    return;
  }
  console.log("Connected to MySQL database");
});

// Helper function to format dates
const formatDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// ======================== API Endpoints ========================

// 1. Fetch All Workers
app.get("/api/workers", (req, res) => {
  const sql = `
    SELECT id, name, employee_id, email, phone_number, department, 
           DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS date_of_birth, 
           DATE_FORMAT(date_of_joining, '%Y-%m-%d') AS date_of_joining, 
           role 
    FROM workers
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching data:", err.message);
      return res.status(500).json({ message: "Database query failed" });
    }
    res.json(results);
  });
});


// 2. Add a Worker
app.post("/api/workers/add", (req, res) => {
  const {
    name,
    employee_id,
    email,
    phone_number,
    department,
    date_of_birth,
    date_of_joining,
    role,
  } = req.body;

  const sql = "INSERT INTO workers SET ?";
  const newWorker = {
    name,
    employee_id,
    email,
    phone_number,
    department,
    date_of_birth: formatDate(date_of_birth),
    date_of_joining: formatDate(date_of_joining),
    role,
  };

  db.query(sql, newWorker, (err, results) => {
    if (err) {
      console.error("Error adding worker:", err.message);
      return res.status(500).json({ message: "Failed to add worker" });
    }
    res.json({ message: "Worker added successfully", id: results.insertId });
  });
});

// 3. Edit a Worker
app.put("/api/workers/edit", (req, res) => {
  const {
    id,
    name,
    employee_id,
    email,
    phone_number,
    department,
    date_of_birth,
    date_of_joining,
    role,
  } = req.body;

  const sql = `
    UPDATE workers 
    SET name = ?, employee_id = ?, email = ?, phone_number = ?, department = ?, 
        date_of_birth = ?, date_of_joining = ?, role = ?
    WHERE id = ?
  `;

  db.query(
    sql,
    [
      name,
      employee_id,
      email,
      phone_number,
      department,
      formatDate(date_of_birth),
      formatDate(date_of_joining),
      role,
      id,
    ],
    (err) => {
      if (err) {
        console.error("Error updating worker:", err.message);
        return res.status(500).json({ message: "Failed to update worker" });
      }
      res.json({ message: "Worker updated successfully" });
    }
  );
});

// 4. Delete a Worker
app.delete("/api/workers/delete", (req, res) => {
  const { id } = req.body;
  const sql = "DELETE FROM workers WHERE id = ?";
  db.query(sql, [id], (err) => {
    if (err) {
      console.error("Error deleting worker:", err.message);
      return res.status(500).json({ message: "Failed to delete worker" });
    }
    res.json({ message: "Worker deleted successfully" });
  });
});

// ======================== Start the Server ========================
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Debug POST Request for Adding Workers
app.post("/api/workers/add", (req, res) => {
  console.log("Received Data:", req.body); // Debug incoming data
  const worker = { ...req.body };
  const sql = "INSERT INTO workers SET ?";
  db.query(sql, worker, (err, results) => {
    if (err) {
      console.error("Error adding worker:", err.message);
      return res.status(500).send("Database error");
    }
    console.log("Worker added successfully:", results);
    res.json({ id: results.insertId });
  });
});


app.post("/api/workers/upload", (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).send("No file uploaded.");
  }

  const file = req.files.file;
  const results = [];
  const filePath = __dirname + "/uploads/" + file.name;

  file.mv(filePath, (err) => {
    if (err) {
      console.error("Error saving file:", err.message);
      return res.status(500).send("File upload failed.");
    }

    // Read and parse the CSV file
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        // Extract only the required fields from the row
        const {
          name,
          employee_id,
          email,
          phone_number,
          department,
          date_of_birth,
          date_of_joining,
          role,
        } = row;

        // Validate required fields
        if (
          name &&
          /^[a-zA-Z ]+$/.test(name) &&
          employee_id &&
          /^[a-zA-Z0-9]+$/.test(employee_id) &&
          email &&
          /^\S+@\S+\.\S+$/.test(email) &&
          /^\d{10}$/.test(phone_number) &&
          department &&
          date_of_birth &&
          date_of_joining &&
          role
        ) {
          results.push([
            name,
            employee_id,
            email,
            phone_number,
            department,
            formatDate(date_of_birth),
            formatDate(date_of_joining),
            role,
          ]);
        }
      })
      .on("end", () => {
        if (results.length === 0) {
          return res.status(400).send("No valid rows in CSV file.");
        }

        // SQL query to insert data
        const sql =
          "INSERT INTO workers (name, employee_id, email, phone_number, department, date_of_birth, date_of_joining, role) VALUES ?";
        db.query(sql, [results], (err) => {
          if (err) {
            console.error("Error inserting data:", err.message);
            return res.status(500).send("Bulk insert failed. Check for duplicates.");
          }
          res.send("Workers added successfully.");
        });

        // Delete the temporary file
        fs.unlinkSync(filePath);
      })
      .on("error", (error) => {
        console.error("Error reading the CSV file:", error.message);
        res.status(500).send("Error processing the CSV file.");
      });
  });
});
