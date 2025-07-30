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
app.use('/Pictures', express.static('Pictures'));

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
    const sql = 'INSERT INTO user (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    db.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) throw err;
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
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

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            req.session.user = results[0];
            req.flash('success', 'Login successful!');
            res.redirect('/dashboard');
        } else {
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard_R', { user: req.session.user });
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

app.get('/appt_from_create', (req, res) => {
    res.render('appt_from_create_SRDE');
});

app.post('/appt_from_create_SRDE', (req, res) => {
    console.log(req.body);
    res.send('Appointment submitted successfully!');
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

  const sql = `INSERT INTO orders (user_id, full_name, address, contact, total_price)
               VALUES (?, ?, ?, ?, ?)`;

  db.query(sql, [userId, full_name, address, contact, total_price], (err, result) => {
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
    const sql = "SELECT * FROM pets";
    //fetch data from mysql
    db.query(sql, (error, results) => {
        if (error) {
            console.error("Database query error:", error.message);
            return res.status(500).send("Error retrieving pets.");
        }
    //render HTML page with data
    res.render("index_d", {pets: results});
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
    res.render("addPet_d");
});
app.post("/addPet", upload.single("image"), (req, res) => {
    //extract pet data from the request body 
    const {petName, startDate, endDate} = req.body;
    let image;
    if (req.file) {
        image = req.file.filename; //save only the filename
    } else {
        image = null;
    }
    const sql = "INSERT INTO pets (petName, startDate, endDate, image) VALUES (?, ?, ?, ?)";
    //insert the new pet into the database
    db.query(sql, [petName, startDate, endDate, image], (error, results) => {
        if (error) {
            //handle any error that occurs during the database operation
            console.error("Error adding pet:", error);
            res.status(500).send("Error adding pet.");
        } else {
            //send a success response
            res.redirect("/petDetails");
        }
    });
});

//edit pet
app.get("/editPet/:id", (req, res) => {
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
            res.render("editPet_d", {pets: results[0]});
        } else {
            //if no pet with the given id was found, render a 404 page or handle it accordingly 
            res.status(404).send("Pet not found.");
        }
    });
});
app.post("/editPet/:id", upload.single("image"), (req, res) => {
    const petId = req.params.id;
    //extract pet data from the request body 
    const {petName, startDate, endDate} = req.body;
    let image = req.body.currentImage; //retrieve current image filename
    if (req.file) { //if new image is uploaded
        image = req.file.filename //set image to be new image filename
    }
    const sql = "UPDATE pets SET petName = ?, startDate = ?, endDate = ?, image = ? WHERE petId = ?";
    //insert the new pet into the database
    db.query(sql, [petName, startDate, endDate, image, petId], (error, results) => {
        if (error) {
            console.error("Error updating pet:", error);
            res.status(500).send("Error updating pet.");
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
        if (err) throw err;
        res.render("index_d", { pets: results, query: searchQuery });
    });
});
//doris part end

// Syaleez Part start
// READ: List of all appointments
app.get('/appointments', (req, res) => {
    db.query('SELECT * FROM appointments', (err, results) => {
        if (err) throw err;
        res.render('appt_list_S', { appointments: results, messages: req.flash('success') });
    });
});

// CREATE: Form to Add appointment
app.get('/appointments/add', (req, res) => {
    res.render('appt_add_S');
});

// CREATE: Form submission
app.post('/appointments/add', (req, res) => {
    const { pet_name, vet_name, date, time } = req.body;
    const sql = 'INSERT INTO appointments (pet_name, vet_name, date, time) VALUES (?, ?, ?, ?)';
    db.query(sql, [pet_name, vet_name, date, time], (err) => {
        if (err) throw err;
        req.flash('success', 'Appointment added!');
        res.redirect('/appointments');
    });
});

// UPDATE: Edit form
app.get('/appointments/edit/:id', (req, res) => {
    db.query('SELECT * FROM appointments WHERE id = ?', [req.params.id], (err, results) => {
        if (err) throw err;
        res.render('appt_edit_S', { appointment: results[0] });
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
    const { name, dosage, expiration_date } = req.body;
    const sql = 'INSERT INTO medications (name, dosage, expiration_date) VALUES (?, ?, ?)';
    db.query(sql, [name, dosage, expiration_date], (err) => {
        if (err) throw err;
        req.flash('success', 'Medication added!');
        res.redirect('/medications');
    });
});

// UPDATE: Edit form
app.get('/medications/edit/:id', (req, res) => {
    db.query('SELECT * FROM medications WHERE id = ?', [req.params.id], (err, results) => {
        if (err) throw err;
        res.render('med_edit_S', { medication: results[0] });
    });
});

// UPDATE: Edit form submission
app.post('/medications/edit/:id', (req, res) => {
    const { name, dosage, expiration_date } = req.body;
    const sql = 'UPDATE medications SET name = ?, dosage = ?, expiration_date = ? WHERE id = ?';
    db.query(sql, [name, dosage, expiration_date, req.params.id], (err) => {
        if (err) throw err;
        req.flash('success', 'Medication updated!');
        res.redirect('/medications');
    });
});

// DELETE: Delete medication
app.post('/medications/edit/:id', (req, res) => {
    const { name, dosage, expiration_date } = req.body;
    const sql = 'UPDATE medications SET name = ?, dosage = ?, expiration_date = ? WHERE id = ?';
    db.query(sql, [name, dosage, expiration_date, req.params.id], (err) => {
        if (err) throw err;
        req.flash('success', 'Medication updated!');
        res.redirect('/medications');
    });
});
//Syaleez part end

//Jeslyn part start
/******** PROGRAMME ********/
// Define routes
app.get('/programme', (req, res) => {
    const sql = 'SELECT * FROM programme';

    // Fetch data from MySQL
    db.query(sql, (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving programme');
        }

        // Render HTML page with data
        res.render('programme_j', { programme: results });
    });
});


// Retrieve and display one programme by id 
app.get('/programme/:id', (req, res) => {
    const programmeId = req.params.id;
    const sql = 'SELECT * FROM programme WHERE programmeId = ?';
    
    db.query(sql, [programmeId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving programme by ID');
        }
        
        if (results.length > 0) {
            res.render('programme_j', { programme: results[0] });
        } else {
            res.status(404).send('Programme not found');
        }
    });
});

app.get('/addProg', (req, res) => {
    res.render('addProg_j');
});

app.post('/addProg', upload.single('image'), (req, res) => {
    const { name, description, startDate, endDate, location } = req.body;
    let image;
    if (req.file) {
        image = req.file.filename;
    } else {
        image = null;
    }
    const sql = "INSERT INTO programme (name, description, startDate, endDate, location, image) VALUES (?, ?, ?, ?, ?, ?)";
    db.query(sql, [name, description, startDate, endDate, location, image], (error, results) => {
        if (error) {
            console.error("Error adding programme:", error);
            res.status(500).send("Error adding programme");
        } else {
            if (req.session.user && req.session.user.role === 'admin') {
                res.redirect('/programme');
            } else {
                res.redirect('/');
            } 
        }
    });
});

app.get('/editProg/:id', (req, res) => {
    const programmeId = req.params.id;
    const sql = 'SELECT * FROM programme WHERE programmeId = ?';
    
    db.query(sql, [programmeId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving programme by ID');
        }

        if (results.length > 0) {
            res.render('editProg_j', { programme: results[0] });
        } else {
            res.status(404).send('Programme not found');
        }
    });
});

app.post('/editProg/:id', upload.single('image'), (req, res) => {
    const programmeId = req.params.id;
    const { name, description, startDate, endDate, location } = req.body;

    let image = req.body.currentImage;
    if (req.file) {
        image = req.file.filename;
    }

    const sql = 'UPDATE programme SET name = ?, description = ?, startDate = ?, endDate = ?, location = ?, image=? WHERE programmeId = ?';

    db.query(sql, [name, description, startDate, endDate, location, image, programmeId], (error, results) => {
        if (error) {
            console.error("Error adding programme:", error);
            res.status(500).send('Error adding programme');
        } else {
            if (req.session.user && req.session.user.role === 'admin') {
                res.redirect('/programme');
            } else {
                res.redirect('/');
            }
        }
    });
});

app.get('/deleteProg/:id', (req, res) => {
    const programmeId = req.params.id;
    const sql = 'DELETE FROM programme WHERE programmeId = ?';
    
    db.query(sql, [programmeId], (error, results) => {
        if (error) {
            console.error("Error deleting programme:", error);
            res.status(500).send('Error deleting programme');
        } else {
            res.redirect('/programme');
        }
    });
});

/******** PARTNERSHIP ********/

app.get('/partnership', (req, res) => {
    const sql = 'SELECT * FROM partnership';

    db.query(sql, (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving partnership');
        }

        res.render('index_j', { partnership: results });
    });
});

app.get('/partnership/:id', (req, res) => {
    const partnershipId = req.params.id;
    const sql = 'SELECT * FROM partnership WHERE partnershipId = ?';

    db.query(sql, [partnershipId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving partnership by ID');
        }

        if (results.length > 0) {
            res.render('partnership_j', { partnership: results[0] });
        } else {
            res.status(404).send('Partnership not found');
        }
    });
});

app.get('/addPartnership', (req, res) => {
    res.render('addPartnership_j');
});

app.post('/addPartnership', upload.single('image'), (req, res) => {
    const { name, contact, email } = req.body;
    let image = req.file ? req.file.filename : null;

    const sql = "INSERT INTO partnership (name, contact, email, image) VALUES (?, ?, ?, ?)";

    db.query(sql, [name, contact, email, image], (error, results) => {
        if (error) {
            console.error("Error adding partnership:", error);
            res.status(500).send("Error adding partnership");
        } else {
            if (req.session.user && req.session.user.role === 'admin') {
                res.redirect('/programme');  // (Double-check: did you mean '/partnership'?)
            } else {
                res.redirect('/');
            }
        }
    });
});

app.get('/editPartnership/:id', (req, res) => {
    const partnershipId = req.params.id;
    const sql = 'SELECT * FROM partnership WHERE partnershipId = ?';

    db.query(sql, [partnershipId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving partnership by ID');
        }

        if (results.length > 0) {
            res.render('editPartnership_j', { partnership: results[0] });
        } else {
            res.status(404).send('Partnership not found');
        }
    });
});

app.post('/editPartnership/:id', upload.single('image'), (req, res) => {
    const partnershipId = req.params.id;
    const { name, contact, email } = req.body;

    let image = req.body.currentImage;
    if (req.file) {
        image = req.file.filename;
    }

    const sql = 'UPDATE partnership SET name = ?, contact = ?, email = ?, image = ? WHERE partnershipId = ?';

    db.query(sql, [name, contact, email, image, partnershipId], (error, results) => {
        if (error) {
            console.error("Error updating partnership:", error);
            res.status(500).send('Error updating partnership');
        } else {
            if (req.session.user && req.session.user.role === 'admin') {
                res.redirect('/partnership');
            } else {
                res.redirect('/');
            }
        }
    });
});

app.get('/deletePartnership/:id', (req, res) => {
    const partnershipId = req.params.id;
    const sql = 'DELETE FROM partnership WHERE partnershipId = ?';

    db.query(sql, [partnershipId], (error, results) => {
        if (error) {
            console.error("Error deleting partnership:", error);
            res.status(500).send('Error deleting partnership');
        } else {
            res.redirect('/partnership');
        }
    });
});

//Jeslyn part end

//Xinyue part start
// Show form to add Pet Food
app.get('/pet-products/add/food', (req, res) => {
    res.render('addFood_x');
});

// Handle adding Pet Food
app.post('/pet-products/add/food', (req, res) => {
    const { name, type, price } = req.body;
    const query = "INSERT INTO pet_products (name, type, price) VALUES (?, ?, ?)";
    db.query(query, [name, type, price], (err) => {
        if (err) return res.status(500).send("Error adding pet food.");
        res.redirect('/pet-products');
    });
});

// Handle adding Medication
app.post('/pet-products/add/medication', (req, res) => {
    const { name, type, price } = req.body;
    const query = "INSERT INTO pet_products (name, type, price) VALUES (?, ?, ?)";
    db.query(query, [name, type, price], (err) => {
        if (err) return res.status(500).send("Error adding medication.");
        res.redirect('/pet-products');
    });
});

//Edit Pet Food
app.get('/pet-products/edit/food/:id', (req, res) => {
    db.query("SELECT * FROM pet_products WHERE id = ? AND type = 'Food'", [req.params.id], (err, results) => {
        if (err || results.length === 0) return res.status(404).send("Food not found.");
        res.render('editFood', { product: results[0] });
    });
});
app.post('/pet-products/edit/food/:id', (req, res) => {
    const { name, price } = req.body;
    db.query("UPDATE pet_products SET name = ?, price = ? WHERE id = ? AND type = 'Food'", [name, price, req.params.id], err => {
        if (err) return res.status(500).send("Error updating food.");
        res.redirect('/pet-food');
    });
});
;


//Delete Pet Food
app.post('/pet-products/delete/food/:id', (req, res) => {
    db.query("DELETE FROM pet_products WHERE id = ? AND type = 'Food'", [req.params.id], err => {
        if (err) return res.status(500).send("Error deleting food.");
        res.redirect('/pet-products');
    });
});
//Xinyue part end

// En Hui's Part.
//USER
app.get('/user/schedule', checkAuthenticated, (req, res) => {
    connection.query(
        'SELECT * FROM appointments WHERE user_id = ?', [req.session.user.id],
        (error, results) => {
            if (error) return res.sendStatus(500);
            res.render('userSchedule', { requests: results });
        }
    );
});

app.post('/user/schedule/:id', checkAuthenticated, (req, res) => {
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
                    appointmentStartDate: appointment.appointmentStartDate,
                    appointmentEndDate: appointment.appointmentEndDate,
                });
            }

            res.redirect('/user/schedule');
        } else {
            res.status(404).send("Product not found");
        }
    });
});

app.post('/user/schedule/reschedule-request/:id', checkAuthenticated, (req, res) => {
    const appointmentId = parseInt(req.params.id);
    const { DeleteReq, startdate, enddate } = req.body;

    connection.query(
        'UPDATE appointments SET reschedule_request = 1, delete_request = ?, new_start_date = ?, new_end_date = ?, date_of_request = NOW() WHERE appointment_id = ? AND user_id = ?',
        [DeleteReq, startdate, enddate, appointmentId, req.session.user.id],
        (err) => {
            if (err) return res.sendStatus(500);
            res.redirect('/user/schedule');
        }
    );
});

app.post('/user/schedule/schedule-delete-request/:id', checkAuthenticated, (req, res) => {
    const appointmentId = parseInt(req.params.id);
    const { ReschId, newStartDate, newEndDate } = req.body;

    connection.query(
        'UPDATE appointments SET reschedule_request = ?, delete_request = 1, date_of_request = NOW(), new_start_date = ?, new_end_date = ? WHERE appointment_id = ? AND user_id = ?',
        [ReschId, newStartDate, newEndDate, appointmentId, req.session.user.id],
        (err) => {
            if (err) return res.sendStatus(500);
            res.redirect('/user/schedule');
        }
    );
});

//ADMIN 
app.get('/admin/schedule', checkAuthenticated, checkAdmin, (req, res) => {
    connection.query(
        'SELECT * FROM appointments',
        (error, results) => {
            if (error) return res.sendStatus(500);
            res.render('adminSchedule', { requests: results });
        }
    );
});

app.post('/admin/schedule/review-reschedule/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const appointmentId = parseInt(req.params.id);

    connection.query(
        'SELECT new_start_date, new_end_date, delete_request FROM appointments WHERE appointment_id = ? AND reschedule_request = 1',
        [appointmentId],
        (error, results) => {
            if (error) throw error
            if (results.length === 0) return res.status(404).send('No reschedule request found.');

            const { DeleteReq, newStartDate, newEndDate } = results[0];

            connection.query(
                `UPDATE appointments SET reschedule_request = 0, delete_request = ?, start_date = ?, end_date = ?, date_of_request = NULL, new_start_date = NULL, new_end_date = NULL WHERE appointment_id = ?`,
                [DeleteReq, newStartDate, newEndDate, appointmentId],
                (err) => {
                    if (err) {
                        console.error("Error Rescheduling:", err);
                        res.status(500).send('Error Rescheduling');
                    } else {
                        res.redirect('/admin/schedule');
                    }
                }
            );
        }
    );
});

app.get('/admin/schedule/deleteSchedule/:id', (req, res) => {
    const appointmentId = parseInt(req.params.id);

    connection.query('DELETE FROM appointments WHERE appointment_id = ?', [appointmentId], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error deleting schedule:", error);
            res.status(500).send('Error deleting schedule');
        } else {
            // Send a success response
            res.redirect('/admin/schedule');
        }
    });
});
// En Hui's Part End.

// Starting the server - Rach
app.listen(3000, () => {
    console.log('Server started on port 3000');
});
