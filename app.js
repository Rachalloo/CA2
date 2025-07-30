// Rachel's Part Start
const express = require('express');
const mysql = require('mysql2');
const multer = require("multer");
const session = require('express-session');
const flash = require('connect-flash');

const app = express();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "Pictures");
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// MySQL database connection
const db = mysql.createConnection({
    host: 'c237-all.mysql.database.azure.com',
    port: '3306',
    user: 'c237admin',
    password: 'c2372025!',
    database: 'c237_e65e_team3'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to database');
});

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use('/pictures', express.static('Pictures'));

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(flash());

// EJS
app.set('view engine', 'ejs');

// Sample product list (replace with DB later if needed)
const products = [
    { id: 1, name: "Pet Shampoo", price: 12 },
    { id: 2, name: "Nail Trimming", price: 8 },
    { id: 3, name: "Haircut & Styling", price: 20 }
];

// Middleware to initialize empty cart
app.use((req, res, next) => {
    if (!req.session.cart) {
        req.session.cart = [];
    }
    next();
});

// Auth check middleware
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    req.flash('error', 'Please log in to view this resource');
    res.redirect('/login');
};

const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') return next();
    req.flash('error', 'Access denied');
    res.redirect('/dashboard');
};

// Routes
app.get('/', (req, res) => {
    res.render('index_R', { user: req.session.user, messages: req.flash('success') });
});

app.get('/register', (req, res) => {
    res.render('register_R', {
        messages: req.flash('error'),
        formData: req.flash('formData')[0]
    });
});

const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact } = req.body;

    if (!username || !email || !password || !address || !contact) {
        return res.status(400).send('All fields are required.');
    }

    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 characters');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role } = req.body;

    const getMaxIdSql = 'SELECT MAX(user_id) AS maxId FROM user';
    db.query(getMaxIdSql, (err, results) => {
        if (err) throw err;

        let nextUserId = 1;
        if (results[0].maxId !== null) {
            nextUserId = results[0].maxId + 1;
        }

        const insertSql = 'INSERT INTO user (user_id, username, email, password, address, contact, role) VALUES (?, ?, ?, SHA1(?), ?, ?, ?)';
        db.query(insertSql, [nextUserId, username, email, password, address, contact, role], (err, result) => {
            if (err) throw err;

            req.flash('success', 'Registration successful! Please log in.');
            res.redirect('/login');
        });
    });
});

app.get('/login', (req, res) => {
    res.render('login_R', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM user WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            req.session.user = results[0];
            req.flash('success', 'Login successful!');
            res.redirect('/Home');
        } else {
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin_R', { user: req.session.user });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Grooming pages
app.get('/grooming', (req, res) => {
    res.render('grooming_R');
});

app.get('/appt_form_create', (req, res) => {
    res.render('appt_form_create_SRD');
});

app.post('/appt_form_create', (req, res) => {
    console.log(req.body);
    res.render('appt_form_create_SRD');
});

app.post('/appt_form_create', (req, res) => {
  const formData = req.body;

  res.redirect('/submit_success');
});

app.get('/submit_success', (req, res) => {
  res.render('submit_success_SRD');
});

// Shopping cart routes
app.get('/shop', (req, res) => {
    res.render('shop_R', { products, user: req.session.user, messages: req.flash('success') });
});

app.post('/add-to-cart', (req, res) => {
    const productId = parseInt(req.body.productId);
    const quantity = parseInt(req.body.quantity);
    const product = products.find(p => p.id === productId);

    if (product) {
        const existing = req.session.cart.find(item => item.id === productId);
        if (existing) {
            existing.quantity += quantity;
        } else {
            req.session.cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: quantity
            });
        }
        req.flash('success', 'Item added to cart.');
    }

    res.redirect('/shop');
});

app.get('/cart', (req, res) => {
    const cart = req.session.cart;
    let total = 0;
    for (let i = 0; i < cart.length; i++) {
        total += cart[i].price * cart[i].quantity;
    }

    res.render('cart_R', { cart, total, user: req.session.user, messages: req.flash('success') });
});

app.post('/remove-from-cart', (req, res) => {
    const productId = parseInt(req.body.productId);
    req.session.cart = req.session.cart.filter(item => item.id !== productId);
    req.flash('success', 'Item removed from cart.');
    res.redirect('/cart');
});

app.get('/checkout', checkAuthenticated, (req, res) => {
  res.render('checkout_R', { messages: req.flash('error') });
});

// Route to handle checkout form submission
app.post('/checkout', checkAuthenticated, (req, res) => {
  const { full_name, address, contact, total_price } = req.body;
  const userId = req.session.user.id;

  if (!full_name || !address || !contact || !total_price) {
    req.flash('error', 'All fields are required.');
    return res.redirect('/checkout');
  }

  const sql = `INSERT INTO orders (full_name, address, contact, total_price)
               VALUES (?, ?, ?, ?)`;

  db.query(sql, [ full_name, address, contact, total_price], (err, result) => {
    if (err) throw err;

    const orderId = result.insertId;
    res.render('order_confirmation_R', {
      orderId: orderId,
      total_price: total_price
    });
  });
});
// Rachel's part end

//doris part start
//define routes
app.get("/petDetails", (req, res) => {
    if (!req.session.user || req.session.user.role !== "admin") {
         return res.send(`
            <h2 style="color:red;">Access denied. Admins only.</h2>
            <p>You will be redirected to the login page in 3 seconds...</p>
            <script>
                setTimeout(() => {
                    window.location.href = "/login";
                }, 3000);
            </script>
        `);
    }
    const sql = "SELECT * FROM pets";
    db.query(sql, (error, results) => {
        if (error) {
            console.error("Database query error:", error.message);
            return res.status(500).send("Error retrieving pets.");
        }
        res.render("index_d", { pets: results });
    });
});

//display pet
app.get("/pet/:id", (req, res) => {
    //extract the pet id from the request parameters
    const petId = req.params.id;
    const sql = "SELECT * FROM pets WHERE petId = ?";
    //fetch data from mysql based on the pet id
    db.query(sql, [petId], (error, results) => {
        if (error) {
            console.error("Database query error:", error.message);
            return res.status(500).send("Error retrieving pet by ID.");
        }
        //check if any pet with the given id was found
        if (results.length > 0) {
            //render html page with the pet data
            res.render("pet_d", {pets: results[0]});
        } else {
            //if no pet with the given id was found, render a 404 page or handle it accordingly 
            res.status(404).send("Pet not found.");
        }
    });
});

//add pet 
app.get("/addPet", (req, res) => {
    if (!req.session.user || req.session.user.role !== "admin") {
        return res.status(403).send("Access denied. Admins only.");
    }
    res.render("addPet_d");
});
app.post("/addPet", upload.single("image"), (req, res) => {
    if (!req.session.user || req.session.user.role !== "admin") {
        return res.status(403).send("Access denied. Admins only.");
    }
    const { user, petName, startDate, endDate } = req.body;
    let image = req.file ? req.file.filename : null;
    const sql = "INSERT INTO pets (user, petName, startDate, endDate, image) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [user, petName, startDate, endDate, image], (error, results) => {
        if (error) {
            console.error("Error adding pet:", error);
            return res.status(500).send("Error adding pet.");
        } else {
            res.redirect("/petDetails");
        }
    });
});

//edit pet
app.get("/editPet/:id", (req, res) => {
    if (!req.session.user || req.session.user.role !== "admin") {
        return res.send(`
            <h2 style="color:red;">Access denied. Admins only.</h2>
            <p>Redirecting to login...</p>
            <script>
                setTimeout(() => {
                    window.location.href = "/login";
                }, 3000);
            </script>
        `);
    }
    const petId = req.params.id;
    const sql = "SELECT * FROM pets WHERE petId = ?";
    db.query(sql, [petId], (error, results) => {
        if (error) {
            console.error("Database query error:", error.message);
            return res.status(500).send("Error retrieving pet by ID.");
        }
        if (results.length > 0) {
            res.render("editPet_d", { pets: results[0] });
        } else {
            res.status(404).send("Pet not found.");
        }
    });
});
app.post("/editPet/:id", upload.single("image"), (req, res) => {
    if (!req.session.user || req.session.user.role !== "admin") {
        return res.send(`
            <h2 style="color:red;">Access denied. Admins only.</h2>
            <p>Redirecting to login...</p>
            <script>
                setTimeout(() => {
                    window.location.href = "/login";
                }, 3000);
            </script>
        `);
    }
    const petId = req.params.id;
    const {user, petName, startDate, endDate } = req.body;
    let image = req.body.currentImage;

    if (req.file) {
        image = req.file.filename;
    }
    const sql = "UPDATE pets SET user = ?, petName = ?, startDate = ?, endDate = ?, image = ? WHERE petId = ?";
    db.query(sql, [user, petName, startDate, endDate, image, petId], (error, results) => {
        if (error) {
            console.error("Error updating pet:", error);
            return res.status(500).send("Error updating pet.");
        } else {
            res.redirect("/petDetails");
        }
    });
});

//delete pet 
app.get("/deletePet/:id", (req, res) => {
    const petId = req.params.id;
    const sql = "DELETE FROM pets WHERE petId = ?";
    db.query(sql, [petId], (error, results) => {
        if (error) {
            console.error("Error deleting pet:", error);
            res.status(500).send("Error deleting pet.");
        } else {
            res.redirect("/petDetails");
        }
    });
});

//search function
app.get("/search", (req, res) => {
    const searchQuery = req.query.search || "";
    const sql = searchQuery 
        ? "SELECT * FROM pets WHERE petName LIKE ?"
        : "SELECT * FROM pets";

    const params = searchQuery ? [`%${searchQuery}%`] : [];

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error("Error searching pets:", err.message);
            return res.status(500).send("Error retrieving pets.");
        }
        //if no pets found, render the page with empty results and pass a message
        res.render("index_d", {
            pets: results,
            query: searchQuery,
            noResults: results.length === 0
        });
    });
});
//doris part end

// Syaleez Part start
// READ: List of all appointments
app.get('/appointments', (req, res) => {
    db.query('SELECT * FROM appointments', (err, results) => {
        if (err) throw err;
        res.render('appt_list_S', { appointments: results, messages: req.flash('success'), user: req.session.user });
    });
});

// CREATE: Form to Add appointment
app.get('/appointments/add', (req, res) => {
    res.render('appt_form_create_SRD', {user: req.session.user});
});

// CREATE: Form submission
app.post('/appointments/add', (req, res) => {
    const { pet_name, vet_name, appointment_date, reason, status } = req.body;
    const sql = 'INSERT INTO appointments (pet_name, vet_name, appointment_date, reason, status) VALUES (?, ?, ?, ?,?)';
    db.query(sql, [pet_name, vet_name, appointment_date, reason, status], (err) => {
        if (err) throw err;
        req.flash('success', 'Appointment added!');
        res.redirect('/appointments');
    });
});

// UPDATE: Edit form
app.get('/appointments/edit/:id', (req, res) => {
    db.query('SELECT * FROM appointments WHERE id = ?', [req.params.id], (err, results) => {
        if (err) throw err;
        res.render('appt_edit_S', { appointment: results[0], user: req.session.user });
    });
});

// UPDATE: Edit form submission
app.post('/appointments/edit/:id', (req, res) => {
    const { pet_name, vet_name, date, time } = req.body;
    const sql = 'UPDATE appointments SET pet_name = ?, vet_name = ?, date = ?, time = ? WHERE id = ?';
    db.query(sql, [pet_name, vet_name, date, time, req.params.id], (err) => {
        if (err) throw err;
        req.flash('success', 'Appointment updated!');
        res.redirect('/appointments');
    });
});

// DELETE: Delete Appointment
app.get('/appointments/delete/:id', (req, res) => {
    db.query('DELETE FROM appointments WHERE id = ?', [req.params.id], (err) => {
        if (err) throw err;
        req.flash('success', 'Appointment deleted!');
        res.redirect('/appointments');
    });
});

// ============================================
// Licensed Medication Routes

// READ: List of all medications
app.get('/medications', (req, res) => {
    db.query('SELECT * FROM medications', (err, results) => {
        if (err) throw err;
        res.render('med_list_S', { medications: results, messages: req.flash('success') });
    });
});

// CREATE: Form to add medication
app.get('/medications/add', (req, res) => {
    res.render('med_add_S');
});

// CREATE: Form submission
app.post('/medications/add', (req, res) => {
    const { medication_name, medication_dosage, medication_instructions, medication_licensed } = req.body;
    const sql = 'INSERT INTO medications (medication_name, medication_dosage, medication_instructions, medication_licensed) VALUES (?, ?, ?, ?)';
    db.query(sql, [medication_name, medication_dosage, medication_instructions, medication_licensed], (err) => {
        if (err) throw err;
        req.flash('success', 'Medication added!');
        res.redirect('/medications');
    });
});

// UPDATE: Edit form
app.get('/medications/edit/:id', (req, res) => {
    db.query('SELECT * FROM medications WHERE medication_id = ?', [req.params.id], (err, results) => {
        if (err) throw err;
        res.render('med_edit_S', { medication: results[0] });
    });
});

// UPDATE: Edit form submission
app.post('/medications/edit/:id', (req, res) => {
    const { medication_name, medication_dosage, medication_instructions, medication_licensed } = req.body;
    const sql = 'UPDATE medications SET medication_name = ?, medication_dosage = ?, medication_instructions = ?, medication_licensed = ? WHERE medication_id = ?';
    db.query(sql, [medication_name, medication_dosage, medication_instructions, medication_licensed, req.params.id], (err) => {
        if (err) throw err;
        req.flash('success', 'Medication updated!');
        res.redirect('/medications');
    });
});

// DELETE: Delete medication
app.post('/medications/delete/:id', (req, res) => {
    const sql = 'DELETE FROM medications WHERE medication_id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) throw err;
        req.flash('success', 'Medication deleted!');
        res.redirect('/medications');
    });
});
//Syaleez part end

//Jeslyn part start
// --- PROGRAMME ROUTES ---

// List all programmes
app.get('/programme', (req, res) => {
  db.query('SELECT * FROM programme', (error, results) => {
    if (error) {
      console.error('Database query error:', error.message);
      return res.status(500).send('Error Retrieving programme');
    }
    res.render('programme_j', {
      programmes: results,
      user: req.session.user,
    });
  });
});

// View a single programme
app.get('/programme/:id', (req, res) => {
  const programmeId = req.params.id;
  db.query('SELECT * FROM programme WHERE programmeId = ?', [programmeId], (error, results) => {
    if (error) {
      console.error('Database query error:', error.message);
      return res.status(500).send('Error retrieving programme by ID');
    }
    if (results.length > 0) {
      res.render('programme_j', {
        programmes: [results[0]],  // Wrap in array for reuse of listing EJS
        user: req.session.user,
      });
    } else {
      res.status(404).send('Programme not found');
    }
  });
});

// Add Programme - GET
app.get('/addProg', checkAuthenticated, checkAdmin, (req, res) => {
  res.render('addProg_j', { user: req.session.user });
});

// Add Programme - POST
app.post('/addProg', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
  const { name, description, startDate, endDate, location } = req.body;
  const image = req.file ? req.file.filename : null;
  const sql = "INSERT INTO programme (name, description, startDate, endDate, location, image) VALUES (?, ?, ?, ?, ?, ?)";
  db.query(sql, [name, description, startDate, endDate, location, image], (error) => {
    if (error) {
      console.error("Error adding programme:", error);
      return res.status(500).send("Error adding programme");
    }
    res.redirect('/programme');
  });
});

// Edit Programme - GET
app.get('/editProg/:id', checkAuthenticated, checkAdmin, (req, res) => {
  const programmeId = req.params.id;
  db.query('SELECT * FROM programme WHERE programmeId = ?', [programmeId], (error, results) => {
    if (error) {
      console.error('Database query error:', error.message);
      return res.status(500).send('Error retrieving programme by ID');
    }
    if (results.length > 0) {
      res.render('editProg_j', { programme: results[0], user: req.session.user });
    } else {
      res.status(404).send('Programme not found');
    }
  });
});

// Edit Programme - POST
app.post('/editProg/:id', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
  const programmeId = req.params.id;
  const { name, description, startDate, endDate, location } = req.body;
  let image = req.body.currentImage;
  if (req.file) image = req.file.filename;

  const sql = 'UPDATE programme SET name = ?, description = ?, startDate = ?, endDate = ?, location = ?, image = ? WHERE programmeId = ?';
  db.query(sql, [name, description, startDate, endDate, location, image, programmeId], (error) => {
    if (error) {
      console.error("Error updating programme:", error);
      return res.status(500).send('Error updating programme');
    }
    res.redirect('/programme');
  });
});

// Delete Programme - POST (safer deletion)
app.post('/deleteProg/:id', checkAuthenticated, checkAdmin, (req, res) => {
  const programmeId = req.params.id;
  db.query('DELETE FROM programme WHERE programmeId = ?', [programmeId], (error) => {
    if (error) {
      console.error("Error deleting programme:", error);
      return res.status(500).send('Error deleting programme');
    }
    res.redirect('/programme');
  });
});


// --- PARTNERSHIP ROUTES ---

// List all partnerships
app.get('/partnership', (req, res) => {
  db.query('SELECT * FROM partnership', (error, results) => {
    if (error) {
      console.error('Database query error:', error.message);
      return res.status(500).send('Error Retrieving partnership');
    }
    res.render('partnership_j', {
      partnerships: results,
      user: req.session.user,
    });
  });
});

// View a single partnership
app.get('/partnership/:id', (req, res) => {
  const partnershipId = req.params.id;
  db.query('SELECT * FROM partnership WHERE partnershipId = ?', [partnershipId], (error, results) => {
    if (error) {
      console.error('Database query error:', error.message);
      return res.status(500).send('Error retrieving partnership by ID');
    }
    if (results.length > 0) {
      res.render('partnership_j', {
        partnerships: [results[0]],
        user: req.session.user,
      });
    } else {
      res.status(404).send('Partnership not found');
    }
  });
});

// Add Partnership - GET
app.get('/addPartnership', checkAuthenticated, checkAdmin, (req, res) => {
  res.render('addPartnership_j', { user: req.session.user });
});

// Add Partnership - POST
app.post('/addPartnership', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
  const { name, contact, email } = req.body;
  const image = req.file ? req.file.filename : null;
  const sql = "INSERT INTO partnership (name, contact, email, image) VALUES (?, ?, ?, ?)";
  db.query(sql, [name, contact, email, image], (error) => {
    if (error) {
      console.error("Error adding partnership:", error);
      return res.status(500).send("Error adding partnership");
    }
    res.redirect('/partnership');
  });
});

// Edit Partnership - GET
app.get('/editPartnership/:id', checkAuthenticated, checkAdmin, (req, res) => {
  const partnershipId = req.params.id;
  db.query('SELECT * FROM partnership WHERE partnershipId = ?', [partnershipId], (error, results) => {
    if (error) {
      console.error('Database query error:', error.message);
      return res.status(500).send('Error retrieving partnership by ID');
    }
    if (results.length > 0) {
      res.render('editPartnership_j', { partnership: results[0], user: req.session.user });
    } else {
      res.status(404).send('Partnership not found');
    }
  });
});

// Edit Partnership - POST
app.post('/editPartnership/:id', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
  const partnershipId = req.params.id;
  const { name, contact, email } = req.body;
  let image = req.body.currentImage;
  if (req.file) image = req.file.filename;

  const sql = 'UPDATE partnership SET name = ?, contact = ?, email = ?, image = ? WHERE partnershipId = ?';
  db.query(sql, [name, contact, email, image, partnershipId], (error) => {
    if (error) {
      console.error("Error updating partnership:", error);
      return res.status(500).send('Error updating partnership');
    }
    res.redirect('/partnership');
  });
});

// Delete Partnership - POST
app.post('/deletePartnership/:id', checkAuthenticated, checkAdmin, (req, res) => {
  const partnershipId = req.params.id;
  db.query('DELETE FROM partnership WHERE partnershipId = ?', [partnershipId], (error) => {
    if (error) {
      console.error("Error deleting partnership:", error);
      return res.status(500).send('Error deleting partnership');
    }
    res.redirect('/partnership');
  });
});

//Jeslyn part end

// xinyue part start

// List all Pet Food items
app.get('/petFoodList', (req, res) => {
  db.query("SELECT * FROM pet_food", (err, results) => {
    if (err) {
      console.error('Database query error:', err.message);
      return res.status(500).send('Error retrieving pet food list');
    }
    res.render('foodList_x', {
      petFoods: results,
      user: req.session.user,
    });
  });
});


// Show form to add Pet Food
app.get('/addPetFood', (req, res) => {
    const sql = "SELECT * FROM pet_food";
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching pet foods:", err);
            return res.status(500).send("Error retrieving food list.");
        }
        res.render('addFood_x', {
            petFoods: results,
            user: req.session.user
        });
    });
});

// Handle adding Pet Food
app.post('/addPetFood', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
  const { food_name, food_category, food_brand, food_description, food_price, food_quantity } = req.body;
  const image = req.file ? req.file.filename : null;
  const sql = `
    INSERT INTO pet_food
    (food_name, food_category, food_brand, food_description, food_price, food_quantity, image)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  db.query(sql, [food_name, food_category, food_brand, food_description, food_price, food_quantity, image], (err) => {
  if (err) {
    console.error('Error adding pet food:', err);  
    return res.status(500).send('Error adding pet food: ' + err.message);
  }
  res.redirect('/petFoodList');
});
});

// Show form to edit Pet Food
app.get('/editPetFood/:id', checkAuthenticated, checkAdmin, (req, res) => {
  const id = req.params.id;
  db.query("SELECT * FROM pet_food WHERE id = ?", [id], (err, results) => {
    if (err) {
      console.error('Database query error:', err.message);
      return res.status(500).send('Error retrieving pet food by id');
    }
    if (results.length > 0) {
      res.render('editFood_x', { food: results[0], user: req.session.user });
    } else {
      res.status(404).send('Pet food not found');
    }
  });
});

// Handle editing Pet Food
app.post('/editPetFood/:id', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
  const id = req.params.id;
  const { food_name, food_category, food_brand, food_description, food_price, food_quantity, currentImage } = req.body;
  const image = req.file ? req.file.filename : currentImage;
  const sql = `
    UPDATE pet_food
    SET food_name = ?, food_category = ?, food_brand = ?, food_description = ?, food_price = ?, food_quantity = ?, image = ?
    WHERE id = ?
  `;
  db.query(sql, [food_name, food_category, food_brand, food_description, food_price, food_quantity, image, id], (err) => {
    if (err) {
      console.error('Error updating pet food:', err.message);
      return res.status(500).send('Error updating pet food');
    }
    res.redirect('/petFoodList');
  });
});

// Delete Pet Food - GET (with admin middleware)
app.get('/deletePetFood/:id', checkAuthenticated, checkAdmin, (req, res) => {
  const id = req.params.id;
  db.query("DELETE FROM pet_food WHERE id = ?", [id], (err) => {
    if (err) {
      console.error('Error deleting pet food:', err.message);
      return res.status(500).send('Error deleting pet food');
    }
    res.redirect('/petFoodList');
  });
});
// Xinyue Part End

// En Hui's Part.
// HOME
app.get('/Home', checkAuthenticated, (req, res) => {
    res.render('frontPage', { user: req.session.user });
});

//USER
app.get('/user_schedule', checkAuthenticated, (req, res) => {
    connection.query(
        'SELECT * FROM appointments WHERE user_id = ?', [req.session.user.id],
        (error, results) => {
            if (error) return res.sendStatus(500);
            res.render('userSchedule_E', { requests: results, user: req.session.user });
        }
    );
});

app.post('/user_schedule/:id', checkAuthenticated, (req, res) => {
    const appointmentId = parseInt(req.params.id);

    connection.query('SELECT * FROM request_appointments WHERE appointmentId = ?', [appointmentId], (error, results) => {
        if (error) throw error;
        if (results.length > 0) {
            const appointment = results[0];
            if (!req.session.appointment) req.session.appointment = [];

            // Check if appointment is already in the appointment table
            const existingItem = req.session.appointment.find(appointment => appointment.appointmentId === appointmentId);
            if (existingItem) {
                // Don't do anything
            } else {
                req.session.appointment.push({
                    appointmentId: appointment.appointmentId,
                    appointmentName: appointment.appointmentName,
                    appointmentDate: appointment.appointmentDate,
                });
            }

            res.redirect('/user_schedule');
        } else {
            res.status(404).send("Schedule item not found");
        }
    });
});

app.get('/user_schedule_reschedule-request/:id', checkAuthenticated, (req, res) => {
    const appointmentId = req.params.id;
    const userId = req.session.user.id;

    connection.query(
        'SELECT * FROM appointments WHERE appointmentId = ? AND user_id = ?',
        [appointmentId, userId],
        (error, results) => {
            if (error) return res.sendStatus(500);
            if (results.length === 0)
                return res.sendStatus(404);
            res.render('addSchedule_E', { appointment: results[0], user: req.session.user });
        });
});

app.post('/user_schedule_reschedule-request/:id', checkAuthenticated, (req, res) => {
    const appointmentId = parseInt(req.params.id);
    const { DeleteReq, appointmentDate } = req.body;

    connection.query(
        'UPDATE appointments SET reschedule_request = 1, delete_request = ?, appointment_date = ?, date_of_request = NOW() WHERE appointment_id = ? AND user_id = ?',
        [DeleteReq, appointmentDate, appointmentId, req.session.user.id],
        (err) => {
            if (err) return res.sendStatus(500);
            res.redirect('/user_schedule');
        }
    );
});

app.post('/user_schedule_schedule-delete-request/:id', checkAuthenticated, (req, res) => {
    const appointmentId = parseInt(req.params.id);
    const { ReschId, appointmentDate } = req.body;

    connection.query(
        'UPDATE appointments SET reschedule_request = ?, delete_request = 1, date_of_request = NOW(), appointment_date = ? WHERE appointment_id = ? AND user_id = ?',
        [ReschId, appointmentDate, appointmentId, req.session.user.id],
        (err) => {
            if (err) return res.sendStatus(500);
            res.redirect('/user_schedule');
        }
    );
});

//ADMIN 
app.get('/admin_schedule', checkAuthenticated, checkAdmin, (req, res) => {
    connection.query(
        'SELECT * FROM appointments',
        (error, results) => {
            if (error) return res.sendStatus(500);
            res.render('adminSchedule_E', { requests: results, user: req.session.user });
        }
    );
});

app.post('/admin_schedule_review-reschedule/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const appointmentId = parseInt(req.params.id);

    connection.query(
        'SELECT new_appointment_date, delete_request FROM appointments WHERE appointment_id = ? AND reschedule_request = 1',
        [appointmentId],
        (error, results) => {
            if (error) throw error
            if (results.length === 0) return res.status(404).send('No reschedule request found.');

            const { delete_request, new_appointment_date } = results[0];

            connection.query(
                `UPDATE appointments SET reschedule_request = 0, delete_request = ?, appointment_date = ?, date_of_request = NULL, new_appointment_date = NULL WHERE appointment_id = ?`,
                [delete_request, new_appointment_date, appointmentId],
                (err) => {
                    if (err) {
                        console.error("Error Rescheduling:", err);
                        res.status(500).send('Error Rescheduling');
                    } else {
                        res.redirect('/admin_schedule');
                    }
                }
            );
        }
    );
});

app.get('/admin_schedule_deleteSchedule/:id', (req, res) => {
    const appointmentId = parseInt(req.params.id);

    connection.query('DELETE FROM appointments WHERE appointment_id = ?', [appointmentId], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error deleting schedule:", error);
            res.status(500).send('Error deleting schedule');
        } else {
            // Send a success response
            res.redirect('/admin_schedule');
        }
    });
});
// En Hui's Part End.

// Starting the server - Rach
app.listen(3000, () => {
    console.log('Server started on port 3000');
});
