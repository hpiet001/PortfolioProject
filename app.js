require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const path = require('path');
const axios = require('axios');


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: true,
}));

// Set EJS as the view engine
app.set('view engine', 'ejs');

// MySQL Database Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});
db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('Connected to MySQL');
});

// Routes
app.get('/', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  db.query('SELECT * FROM Quote WHERE quote_date = ? LIMIT 1', [today], async (err, quoteResults) => {
    if (err) {
      console.error('Error fetching quote:', err);
      return res.render('home', {
        title: 'Home',
        user: req.session.user,
        quotes: [],
        entries: []
      });
    }

    let quote = quoteResults[0];

    // If no quote in DB, fetch from API and insert
    if (!quote) {
      try {
        const response = await axios.get('https://zenquotes.io/api/today');
        const quoteData = response.data[0];
        quote = {
          text: quoteData.q,
          author: quoteData.a,
          quote_date: today
        };

        // Save new quote to DB
        db.query(
          'INSERT INTO Quote (text, author, quote_date) VALUES (?, ?, ?)',
          [quote.text, quote.author, today],
          (insertErr) => {
            if (insertErr) {
              console.error('Error saving quote:', insertErr);
            }
          }
        );
      } catch (apiErr) {
        console.error('Error fetching quote from API:', apiErr);
        return res.render('home', {
          title: 'Home',
          user: req.session.user,
          quotes: [],
          entries: []
        });
      }
    }

    // Now fetch journal entries (only if logged in)
    if (req.session.user) {
      db.query(
        `SELECT je.*, q.text AS quote_text, q.author AS quote_author
         FROM JournalEntry je
         JOIN Quote q ON je.quote_id = q.id
         WHERE je.user_id = ?
         ORDER BY je.date_created DESC`,
        [req.session.user.id],
        (entryErr, entries) => {
          if (entryErr) {
            console.error('Error loading journal entries:', entryErr);
            entries = [];
          }

          return res.render('home', {
            title: 'Home',
            user: req.session.user,
            quotes: [{ content: quote.text, author: quote.author }],
            entries: entries
          });
        }
      );
    } else {
      // Not logged in: show quote only
      return res.render('home', {
        title: 'Home',
        user: null,
        quotes: [{ content: quote.text, author: quote.author }],
        entries: []
      });
    }
  });
});

app.get('/search', (req, res) => {
  const keyword = req.query.q;
  const user = req.session.user;

  if (!user) {
    return res.redirect('/login');
  }

  if (!keyword) {
    return res.render('search', { title: 'Search', user, results: null });
  }

  const searchQuery = `
    SELECT je.*, q.text AS quote_text, q.author AS quote_author
    FROM JournalEntry je
    JOIN Quote q ON je.quote_id = q.id
    WHERE je.user_id = ?
      AND (je.entry_text LIKE ? OR je.mood LIKE ? OR je.tags LIKE ?)
    ORDER BY je.date_created DESC
  `;

  const likeKeyword = `%${keyword}%`;

  db.query(searchQuery, [user.id, likeKeyword, likeKeyword, likeKeyword], (err, results) => {
    if (err) {
      console.error('Search error:', err);
      return res.send('Error performing search.');
    }

    res.render('search', { title: 'Search', user, results });
  });
});

app.get('/newQuote', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('newQuote', { title: 'Add Quote', user: req.session.user });
});


app.get('/about', (req, res) => {
    res.render('about', { title: 'About', user: req.session.user });
});

app.get('/login', (req, res) => {
    res.render('login', { title: 'Login', user: req.session.user });
});

app.get('/register', (req, res) => {
    res.render('register', { title: 'Register', user: req.session.user });
});

app.post('/journal', (req, res) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }
  
    const userId = req.session.user.id;
    const { entry_text, mood, tags } = req.body;
  
    // Get today's quote from DB
    const today = new Date().toISOString().split('T')[0];
  
    db.query(
      'SELECT id FROM Quote WHERE quote_date = ? LIMIT 1',
      [today],
      (err, results) => {
        if (err || results.length === 0) {
          console.error('Quote not found for today.');
          return res.redirect('/');
        }
  
        const quoteId = results[0].id;
  
        // Insert the journal entry
        db.query(
          'INSERT INTO JournalEntry (user_id, quote_id, entry_text, mood, tags) VALUES (?, ?, ?, ?, ?)',
          [userId, quoteId, entry_text, mood, tags],
          (insertErr) => {
            if (insertErr) {
              console.error('Error saving journal entry:', insertErr);
            }
            res.redirect('/');
          }
        );
      }
    );
  });
  

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

const bcrypt = require('bcrypt');

// Handle registration
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Save user in the database
        db.query(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword],
            (err, result) => {
                if (err) {
                    console.error(err);
                    res.send('Error registering user.');
                } else {
                    res.redirect('/login');
                }
            }
        );
    } catch (err) {
        console.error(err);
        res.send('Server error.');
    }
});

app.post('/newQuote', (req, res) => {
  const { text, author, quote_date } = req.body;
  db.query(
    'INSERT INTO Quote (text, author, quote_date) VALUES (?, ?, ?)',
    [text, author, quote_date],
    (err) => {
      if (err) {
        console.error(err);
        return res.send('Error saving quote.');
      }
      res.redirect('/');
    }
  );
});

// Handle login
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    console.log('Form data:', req.body);

  
    db.query(
      'SELECT * FROM users WHERE email = ?',
      [email],
      async (err, results) => {
        if (err) {
          console.error('Database error:', err);
          return res.send('Server error.');
        }
  
        if (results.length === 0) {
          console.log('❌ No user found with that email:', email);
          return res.send('Invalid email or password.');
        }
  
        const user = results[0];
        console.log('✅ Found user:', user);
  
        const match = await bcrypt.compare(password, user.password);
        console.log('Password match:', match);
  
        if (match) {
          req.session.user = { id: user.id, username: user.username };
          console.log('✅ Login success, redirecting...');
          res.redirect('/');
        } else {
          console.log('❌ Password did not match');
          res.send('Invalid email or password.');
        }
      }
    );
  });

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.send('Error logging out.');
        }
        res.redirect('/');
    });
});



