module.exports = function(app, db) {
    // Home Page (List all quotes)
    app.get('/', function(req, res) {
        let sqlQuery = "SELECT * FROM quotes";
        db.query(sqlQuery, (err, quotes) => {
            if (err) {
                return res.status(500).send('Error retrieving quotes');
            }
            res.render('home.ejs', { quotes: quotes });
        });
    });

    // Add New Quote Page
    app.get('/newQuote', function(req, res) {
        res.render('newQuote.ejs');
    });

    // Handle New Quote Submission
    app.post('/quoteadded', function (req, res) {
        let sqlQuery = "INSERT INTO quotes (content, author, user_id) VALUES (?, ?, ?)";
        let newQuote = [req.body.content, req.body.author, req.session.userId]; // Assuming session management is properly set up
    
        db.query(sqlQuery, newQuote, (err, result) => {
            if (err) {
                return res.status(500).send('Error adding quote');
            }
            res.redirect('/'); // Redirect to home page after adding
        });
    });

    // Register Page
    app.get('/register', function(req, res) {
        res.render('register.ejs');
    });

    // Handle Registration
    app.post('/registered', function (req, res) {
        let sqlQuery = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
        let newUser = [req.body.username, req.body.email, req.body.password]; // Password hashing should be added for security
    
        db.query(sqlQuery, newUser, (err, result) => {
            if (err) {
                return res.status(500).send('Error registering user');
            }
            res.redirect('/login'); // Redirect to login after registration
        });
    });

    // Login Page
    app.get('/login', function(req, res) {
        res.render('login.ejs');
    });

    // Handle Login
    app.post('/login', function (req, res) {
        let sqlQuery = "SELECT * FROM users WHERE email = ?";
        db.query(sqlQuery, [req.body.email], (err, results) => {
            if (err || results.length === 0) {
                return res.status(401).send('Invalid credentials');
            }
            // Implement proper password checking (e.g., bcrypt)
            req.session.userId = results[0].id;
            res.redirect('/');
        });
    });

    // Search Quotes Page
    app.get('/search', function(req, res) {
        res.render('search.ejs');
    });

    // Search Results
    app.get('/search-result', function(req, res) {
        let keyword = req.query.keyword;
        let sqlQuery = "SELECT * FROM quotes WHERE content LIKE ?";
        db.query(sqlQuery, [`%${keyword}%`], (err, quotes) => {
            if (err) {
                return res.status(500).send('Error retrieving search results');
            }
            res.render('searchResults.ejs', { quotes: quotes });
        });
    });

    // Journal Page (Optional - if you have a specific journal page)
    app.get('/journal', function(req, res) {
        let sqlQuery = "SELECT * FROM journal WHERE user_id = ?";
        db.query(sqlQuery, [req.session.userId], (err, journalEntries) => {
            if (err) {
                return res.status(500).send('Error retrieving journal entries');
            }
            res.render('journal.ejs', { journalEntries: journalEntries });
        });
    });
};
