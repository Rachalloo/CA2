const express = require('express');
const mysql = require('mysql2');
const multer = require("multer");

//******** TODO: Insert code to import 'express-session' *********//
const session = require('express-session');

const flash = require('connect-flash');

const app = express();

//set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public/images"); //directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({storage: storage});

// Database connection
const db = mysql.createConnection({
    host: 'c237-all.mysql.database.azure.com',
    port: '3306',
    user: 'c237admin',
    password: 'c2372025!',
    database: 'c237_e65e_team3'
});

db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to database');
});

app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

//******** TODO: Insert code for Session Middleware below ********//
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: {maxAge: 1000 * 60 * 60 * 24 * 7}
}));

app.use(flash());

// Setting up EJS
app.set('view engine', 'ejs');

//******** TODO: Create a Middleware to check if user is logged in. ********//
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

//******** TODO: Create a Middleware to check if user is admin. ********//
const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/dashboard');
    }
};

// Routes
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user, messages: req.flash('success')});
});

app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});


//******** TODO: Create a middleware function validateRegistration ********//
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact } = req.body;

    if (!username || !email || !password || !address || !contact) {
        return res.status(400).send('All fields are required.');
    }
    
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};


//******** TODO: Integrate validateRegistration into the register route. ********//
app.post('/register', validateRegistration, (req, res) => {
    //******** TODO: Update register route to include role. ********//
    const { username, email, password, address, contact, role} = req.body;

    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    db.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

//******** TODO: Insert code for login routes to render login page below ********//
app.get('/login', (req, res) => {
    res.render('login', { 
        messages: req.flash('success'), 
        errors: req.flash('error') 
    });
});

//******** TODO: Insert code for login routes for form submission below ********//
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length > 0) {
            // Successful login
            req.session.user = results[0]; // store user in session
            req.flash('success', 'Login successful!');
            //******** TO DO: Update to redirect users to /dashboard route upon successful log in ********//
            res.redirect('/dashboard');
        } else {
            // Invalid credentials
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});


//******** TODO: Insert code for dashboard route to render dashboard page for users. ********//
app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard', { user: req.session.user });
});

//******** TODO: Insert code for admin route to render dashboard page for admin. ********//
app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin', { user: req.session.user });
});

//******** TODO: Insert code for logout route ********//
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

//doris part start
//define routes
app.get("/petDetails", (req, res) => {
    const sql = "SELECT * FROM pets";
    //fetch data from mysql
    connection.query(sql, (error, results) => {
        if (error) {
            console.error("Database query error:", error.message);
            return res.status(500).send("Error retrieving pets.");
        }
    //render HTML page with data
    res.render("index_d", {pet: results});
    });
});

//display pet
app.get("/pet/:id", (req, res) => {
    //extract the pet id from the request parameters
    const petId = req.params.id;
    const sql = "SELECT * FROM pets WHERE petId = ?";
    //fetch data from mysql based on the pet id
    connection.query(sql, [petId], (error, results) => {
        if (error) {
            console.error("Database query error:", error.message);
            return res.status(500).send("Error retrieving pet by ID.");
        }
        //check if any pet with the given id was found
        if (results.length > 0) {
            //render html page with the pet data
            res.render("pet", {pet: results[0]});
        } else {
            //if no pet with the given id was found, render a 404 page or handle it accordingly 
            res.status(404).send("Pet not found.");
        }
    });
});

//add pet 
app.get("/addPet", (req, res) => {
    res.render("addPet");
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
    connection.query(sql, [petName, startDate, endDate, image], (error, results) => {
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
    connection.query(sql, [petId], (error, results) => {
        if (error) {
            console.error("Database query error:", error.message);
            return res.status(500).send("Error retrieving pet by ID.");
        }
        //check if any pet with the given id was found
        if (results.length > 0) {
            //render html page with the pet data 
            res.render("editPet", {pet: results[0]});
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
    connection.query(sql, [petNameame, startDate, endDate, image, petId], (error, results) => {
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
    connection.query(sql, [petId], (error, results) => {
        if (error) {
            console.error("Error deleting pet:", error);
            res.status(500).send("Error deleting pet.");
        } else {
            res.redirect("/petDetails");
        }
    });
});
//doris part end

// Syaleez Part start
// READ: List of all appointments
app.get('/appointments', (req, res) => {
    db.query('SELECT * FROM appointments', (err, results) => {
        if (err) throw err;
        res.render('appointments', { appointments: results, messages: req.flash('success') });
    });
});

// CREATE: Form to Add appointment
app.get('/appointments/add', (req, res) => {
    res.render('add_appointment');
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
        res.render('edit_appointment', { appointment: results[0] });
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
        res.render('medications', { medications: results, messages: req.flash('success') });
    });
});

// CREATE: Form to add medication
app.get('/medications/add', (req, res) => {
    res.render('add_medication');
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
        res.render('edit_medication', { medication: results[0] });
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

// Starting the server
app.listen(3000, () => {
    console.log('Server started on port 3000');
});
