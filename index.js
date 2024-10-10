import express from "express";
import cors from "cors";
import dotenv, { config } from "dotenv";
import mysql from "mysql2";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
dotenv.config();

app.use(express.json());
app.use(
  cors({
    origin: `${process.env.DOMAIN}`,
    credentials: "true",
  })
);
app.use("/uploads", express.static("uploads"));

/*                                       DB Conf                                    */
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.log("error", err);
    return;
  } else {
    console.log("db connected");
  }
});

/*                               multer conf                                           */
// Set up Multer storage (make sure to define this above your routes)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set the storage location and filename handling
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "/uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

// Initialize the multer middleware
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|mp4|avi|mov|mkv|webm/;
    const extName = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimeType = allowedTypes.test(file.mimetype);

    if (mimeType && extName) {
      return cb(null, true);
    } else {
      cb(new Error("Only images and PDFs are allowed."));
    }
  },
});

app.post("/submit-form", (req, res) => {
  const {
    request_type_id,
    email,
    phno,
    whatsappnumber,
    company_name,
    company_site,
    message,
    username,
  } = req.body;

  console.log(request_type_id, email);

  const query = `
        INSERT INTO glform (request_type_id, email, phno, whats_app_number, company_name, company_site, message, name) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

  db.query(
    query,
    [
      request_type_id,
      email,
      phno,
      whatsappnumber || null,
      company_name,
      company_site,
      message || null,
      username || null,
    ],
    (err, result) => {
      if (err) {
        console.error("Error inserting data:", err);
        return res.json({ message: "Database error" });
      }
      res.status(200).json({ message: "Form submitted successfully" });
    }
  );
});

// Route to Insert URL into seo_url Table
app.post("/add-url", (req, res) => {
  const { url } = req.body;

  // Simple raw SQL insert query
  const sql = `INSERT INTO seo_url (url) VALUES ('${url}')`;

  db.query(sql, (err, result) => {
    if (err) {
      res.json({ error: "Failed to insert URL" });
      return;
    }
    res.json({ message: "URL inserted successfully", id: result.insertId });
  });
});

// Fetch all glform data
app.get("/glform-data", (req, res) => {
  const query = `SELECT * FROM glform`;

  // Execute the query to fetch data
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching data:", err);
      return res.status(500).send("Database error");
    }
    // Send the fetched data as JSON
    res.status(200).json(results);
  });
});

app.get("/request-types", (req, res) => {
  const query = `SELECT * FROM request_type`;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching request types:", err);
      return res.status(500).send("Database error");
    }
    res.status(200).json(results);
  });
});

/*                                       Blog                                        */

// Route to fetch all categories
app.get("/blog_categories", (req, res) => {
  const query = "SELECT id, category_name FROM blog_categories";
  db.query(query, (err, result) => {
    if (err) {
      console.error("Error fetching categories:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.status(200).json(result);
  });
});

// API endpoint to add a new blog
app.post("/add-blog", upload.single("image"), (req, res) => {
  const { categoryId, title, content, conclusion } = req.body;
  const blogImage = req.file;

  // Check if an image was uploaded and set the path accordingly
  const blogImagePath = blogImage
    ? path.join("/uploads", blogImage.filename) // Path relative to the server
    : null;

  const query = `
    INSERT INTO blogs (category_id, title, image, content, conclusion) 
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    query,
    [categoryId, title, blogImagePath, content, conclusion || null],
    (err, result) => {
      if (err) {
        console.error("Error inserting blog:", err);
        return res.json({ message: "Database error" });
      }
      res.json({ message: "Blog added successfully!" });
    }
  );
});

// Get the latest three blog posts
app.get("/latestThreeBlogs", (req, res) => {
  const baseUrl = process.env.BASE_URL; // Ensure this is set in your .env file

  const query = `
    SELECT b.id, b.category_id, b.title, b.content, b.publish, b.conclusion, b.created_at, 
           bc.category_name, 
           CONCAT(?, b.image) AS blog_image
    FROM blogs b
    JOIN blog_categories bc ON b.category_id = bc.id
    WHERE b.publish = 1
    ORDER BY b.created_at DESC
    LIMIT 3
  `;

  db.query(query, [baseUrl], (error, results) => {
    if (error) {
      console.error("Error fetching latest blogs:", error);
      return res.status(500).json({ message: "Error fetching blogs" });
    }
    res.json(results);
  });
});

const BASE_URL = process.env.BASE_URL;

// API to get blogs by IT
app.get("/blogs/category/2", (req, res) => {
  const sql = `SELECT *, CONCAT(?, b.image) AS blog_image 
    FROM blogs b 
    WHERE category_id = ? AND publish = 1`;
  db.query(sql, [BASE_URL, 2], (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json(results);
  });
});

// API to get blogs by SAP
app.get("/blogs/category/1", (req, res) => {
  const sql = `SELECT *, CONCAT(?, b.image) AS blog_image 
    FROM blogs b 
    WHERE category_id = ? AND publish = 1`;
  db.query(sql, [BASE_URL, 1], (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json(results);
  });
});

// API to get blogs by DM
app.get("/blogs/category/3", (req, res) => {
  const sql = `SELECT *, CONCAT(?, b.image) AS blog_image 
    FROM blogs b 
    WHERE category_id = ? AND publish = 1`;
  db.query(sql, [BASE_URL, 3], (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json(results);
  });
});

// get blog by id
app.get("/blogs/:id", (req, res) => {
  const blogId = req.params.id;
  const baseUrl = process.env.BASE_URL; // Set your base URL here

  const sql = `SELECT id, category_id, title, content, conclusion, created_at, 
           CONCAT(?, image) AS blog_image 
    FROM blogs 
    WHERE id = ? AND publish = 1`;

  db.query(sql, [baseUrl, blogId], (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Blog not found" });
    }
    return res.json(results[0]);
  });
});

// getRelatd Blogs
app.get("/relatedBlogs/:category_id/:id", (req, res) => {
  const { category_id, id } = req.params;
  const baseUrl = process.env.BASE_URL; // Your base URL for images

  const query = `
    SELECT id, category_id, title, content, conclusion, 
           CONCAT(?, image) AS blog_image, 
           created_at 
    FROM blogs 
    WHERE category_id = ? AND id != ? AND publish = 1 
    ORDER BY created_at DESC
  `;

  db.query(query, [baseUrl, category_id, id], (error, results) => {
    if (error) {
      return res.status(500).json({ error: "Database query failed" });
    }

    res.json(results);
  });
});

// all blogs
app.get("/blogs", (req, res) => {
  const blogId = req.params.id;
  const baseUrl = process.env.BASE_URL; // Set your base URL here

  const sql = `SELECT id, category_id, title, content, conclusion, created_at, 
               CONCAT(?, image) AS blog_image 
               FROM blogs 
               WHERE publish = 1`;

  db.query(sql, [baseUrl], (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Blog not found" });
    }
    return res.json(results);
  });
});

// categorized blogs
app.get("/blogs/category/:category_id", (req, res) => {
  const categoryId = req.params.category_id;
  const query = `
    SELECT 
      id,
      title,
      CONCAT(?, image) AS blog_image,
      content,
      sub
    FROM blogs
    WHERE category_id = ? AND publish = 1
  `;

  db.query(query, [BASE_URL, categoryId], (error, results) => {
    if (error) {
      console.error("Error fetching blogs:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
    res.json(results);
  });
});

// update blogs
app.get("/update/getblogs/:id", (req, res) => {
  const blogId = req.params.id; // Get the blog ID from the URL parameters

  // SQL query to get the blog details
  const sql = `SELECT id, category_id, title, content, conclusion, created_at, 
                CONCAT(?, image) AS blog_image 
                FROM blogs 
                WHERE id = ?`;

  // Execute the query with baseUrl and blogId as parameters
  db.query(sql, [BASE_URL, blogId], (error, results) => {
    if (error) {
      console.error("Error retrieving blog:", error);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Blog not found" });
    }

    res.json(results[0]); // Send the first result (the blog details)
  });
});

app.put("/blogs/update/:id", upload.single("image"), (req, res) => {
  const blogId = req.params.id;
  const { category_id, title, content, conclusion } = req.body;
  const blogImage = req.file;

  // Create image path if an image was uploaded
  const blogImagePath = blogImage
    ? path.join("/uploads", blogImage.filename) // Path relative to the server
    : null;

  // SQL query to update the blog
  const query = `
    UPDATE blogs 
    SET category_id = ?, title = ?, content = ?, conclusion = ?${
      blogImagePath ? ", image = ?" : ""
    }
    WHERE id = ?
  `;

  // Prepare the values to be updated
  const values = [category_id, title, content, conclusion];
  if (blogImagePath) {
    values.push(blogImagePath); // Only push the image path if a new image was uploaded
  }
  values.push(blogId); // Always include the blog ID

  db.query(query, values, (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database update failed" });
    }
    if (results.affectedRows === 0) {
      return res.json({ error: "Blog not found or no changes made" });
    }
    return res.json({ message: "Blog updated successfully" });
  });
});

// delete Blog
app.delete("/blogs/delete/:id", (req, res) => {
  const blogId = req.params.id;

  // SQL query to delete the blog
  const query = `DELETE FROM blogs WHERE id = ?`;

  db.query(query, [blogId], (err, results) => {
    if (err) {
      return res.json({ error: "Database deletion failed" });
    }
    if (results.affectedRows === 0) {
      return res.json({ error: "Blog not found" });
    }
    return res.json({ message: "Blog deleted successfully" });
  });
});

// pblish Blog
app.put("/blogs/togglePublish/:id", (req, res) => {
  const blogId = req.params.id;

  // Query to get the current publish status
  const checkPublishQuery = "SELECT publish FROM blogs WHERE id = ?";

  db.query(checkPublishQuery, [blogId], (err, results) => {
    if (err) {
      console.error("Error fetching publish status:", err);
      return res.json({ error: "Database query failed" });
    }

    if (results.length === 0) {
      return res.json({ error: "Blog not found" });
    }

    const currentPublishStatus = results[0].publish;

    // Determine the new status: if 1, set to 0; if 0, set to 1
    const newPublishStatus = currentPublishStatus === 1 ? 0 : 1;

    // Update the publish field
    const updatePublishQuery = "UPDATE blogs SET publish = ? WHERE id = ?";

    db.query(updatePublishQuery, [newPublishStatus, blogId], (updateErr) => {
      if (updateErr) {
        console.error("Error updating publish status:", updateErr);
        return res.json({ error: "Database update failed" });
      }

      // Respond with the new publish status
      res.json({ success: true, publish: newPublishStatus === 1 });
    });
  });
});

// content writer
app.get("/content/blogs", (req, res) => {
  const blogId = req.params.id;
  const baseUrl = process.env.BASE_URL; // Set your base URL here

  const sql = `SELECT id, category_id, title, content,publish,conclusion, created_at, 
               CONCAT(?, image) AS blog_image 
               FROM blogs`;

  db.query(sql, [baseUrl], (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Blog not found" });
    }
    return res.json(results);
  });
});

app.get("/blogs/content/category/:category_id", (req, res) => {
  const categoryId = req.params.category_id;
  const query = `
    SELECT 
      id,
      title,
      CONCAT(?, image) AS blog_image,
      content,
      publish
    FROM blogs
    WHERE category_id = ?
  `;

  db.query(query, [BASE_URL, categoryId], (error, results) => {
    if (error) {
      console.error("Error fetching blogs:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
    res.json(results);
  });
});

// login
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.json({ message: "Please provide both email and password." });
  }

  // Query to find the user by email and password
  const sql = "SELECT * FROM login WHERE username = ? AND password = ?";
  db.query(sql, [email, password], (err, results) => {
    if (err) {
      return res.json({ message: "Database error", error: err });
    }

    if (results.length === 0) {
      return res.json({ message: "Invalid email or password" });
    }

    // Login successful, send user data
    const user = results[0];
    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  });
});

app.listen(process.env.PORT, () => {
  console.log(`server is listening on port ${process.env.PORT}`);
});
