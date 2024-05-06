const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bodyParser = require('body-parser');
const geo = require('node-geocoder');
const geocoder = geo({ provider: 'openstreetmap' });

const app = express();
const ContactsDB = require('./db');
const db = new ContactsDB();

db.initialize().then(() => {
    console.log('Database initialized.');
}).catch((err) => {
    console.error('Error initializing database:', err);
});

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

app.use(session({
    secret: 'your_secret_key', // Replace with a real secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: !true } // Set true if using https
}));

app.use((req, res, next) => {
    req.db = db;
    next();
});

app.get('/', async (req, res) => {
    try {
        const contacts = await req.db.getContacts();
        const isAuthenticated = !!req.session.user; // Assuming you're using session to store auth status
        res.render('index', {
            title: 'Contact List',
            contacts,
            user: req.session.user,
            isAuthenticated, // Pass this to your template
        });
    } catch (err) {
        res.status(500).send("Error accessing the database");
    }
});


app.get('/signup', (req, res) => {
    res.render('signup');
});

app.post('/signup', async (req, res) => {
    const { username, first_name, last_name, password } = req.body;
    try {
        const exists = await req.db.usernameExists(username);
        if (exists) {
            res.render('signup', { error: 'Username is already taken' });
            return;
        }
        await req.db.createUser(first_name, last_name, username, password);
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        res.status(500).send("Error registering the user");
    }
});


app.get('/create', (req, res) => {
    res.render('create', {user: req.session.user});
});

app.post('/create', async (req, res) => {
    const { prefix, fName, lName, phone, email, address, contactByEmail, contactByPhone, contactByMail } = req.body;

    const contactPreferences = {
        contactByEmail: !!contactByEmail, // Converts 'on' to true, undefined to false
        contactByPhone: !!contactByPhone,
        contactByMail: !!contactByMail
    };

    try {
        const geoResults = await geocoder.geocode(address);
        if (geoResults.length === 0) {
            // If no results, render the create page with an error message and existing form data
            res.render('create', {
                error: "Address not found. Please check the address and try again.",
                prefix, fName, lName, phone, email, contactByEmail, contactByPhone, contactByMail
            });
            return;
        }

        const latitude = geoResults[0].latitude;
        const longitude = geoResults[0].longitude;
        let finalAddress = geoResults[0].formattedAddress;
        finalAddress = finalAddress.replace(/<|>/g, '');

        await req.db.createContact(fName, lName, phone, email, contactPreferences.contactByEmail, contactPreferences.contactByPhone, contactPreferences.contactByMail, prefix, finalAddress, latitude, longitude);
        res.redirect('/');
    } catch (err) {
        console.error('Geocoding error:', err);
        res.render('create', {
            error: "Error processing your request. Please try again.",
            prefix, fName, lName, phone, email, contactByEmail, contactByPhone, contactByMail
        });
    }
});

// Display the login form
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userId = await req.db.getIDByUsername(username);  // Fetch user ID by username
        const passwordMatch = await req.db.checkPassword(userId, password);  // Check the password
        if (passwordMatch) {
            const user = await req.db.getUserByID(userId); // Assuming you have a method to get the user by ID
            req.session.user = {
                id: user.id,
                username: user.userName,
                first_name: user.fName,
                last_name: user.lName
            };
            res.redirect('/');
        } else {
            throw new Error('Incorrect password');
        }
    } catch (err) {
        res.render('login', { error: 'Invalid username or password' });
    }
});


app.get('/logout', (req, res) => {
    req.session.destroy(); // Destroys session
    res.redirect('/');
});

app.get('/:id', async (req, res) => {
    try {
        const isAuthenticated = !!req.session.user;
        const id = req.params.id;
        const contact = await req.db.getContactById(id); // Assuming this method exists and works similarly to getUserById
        if (contact) {
            res.render('contact-details', { contact, user: req.session.user, isAuthenticated, title: `Contact Details for ${contact.fName} ${contact.lName}` });
        } else {
            res.status(404).send("Not found");
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Error accessing the database");
    }
});

app.get('/:id/edit', isAuthenticated, async (req, res) => {
    try {
        const id = req.params.id;
        const contact = await req.db.getContactById(id);
        if (contact) {
            res.render('edit-contact', { user: req.session.user, contact });
        } else {
            res.status(404).send("Contact not found");
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Error accessing the database");
    }
});

app.post('/:id/edit', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const {
        prefix, fName, lName, phone, email, address,
        contactByEmail, contactByPhone, contactByMail
    } = req.body;

    try {
        const geoResults = await geocoder.geocode(address);
        if (geoResults.length === 0) {
            // No results found, render the edit page again with an error message
            res.render('edit-contact', {
                error: "Address not found. Please check the address and try again.",
                contact: { id, prefix, fName, lName, phone, email, address,
                    contactByEmail, contactByPhone, contactByMail }, user: req.session.user
            });
            return;
        }

        const lat = geoResults[0].latitude;
        const lng = geoResults[0].longitude;
        const formattedAddress = geoResults[0].formattedAddress;

        // Proceed with updating the contact in the database
        const contactDetails = { fName, lName, phone, email, contactByEmail,
            contactByPhone, contactByMail, prefix, formattedAddress, lat, lng };
        await req.db.updateContact(id, contactDetails);
        res.redirect('/'); // Redirect to the contact list or to the contact's page
    } catch (err) {
        console.error('Geocoding error:', err);
        res.status(500).send("Error processing your request. Please try again.");
    }
});


app.get('/:id/delete', isAuthenticated, async (req, res) => {
    try {
        const id = req.params.id;
        const contact = await req.db.getContactById(id);
        if (contact) {
            res.render('delete-contact', { user: req.session.user, contact });
        } else {
            res.status(404).send("Contact not found");
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Error accessing the database");
    }
});

app.post('/:id/delete', isAuthenticated, async (req, res) => {
    const id = req.params.id;
    try {
        await req.db.deleteContact(id);
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(500).send("Error deleting from the database");
    }
});

app.get('/api/contacts', async (req, res) => {
    try {
        const contacts = await db.getContacts(); // This should include latitude and longitude
        res.json({ contacts });
    } catch (err) {
        console.error("Error fetching contacts: ", err);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}