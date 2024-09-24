require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const emailValidator = require('email-validator');

const app = express();
app.use(express.json());
app.use(cors());

console.log(process.env.DB_PASSWORD);

// MySQL connection (defaultdb for all operations)
const defaultdb = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

// Connect to MySQL
defaultdb.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err.message);
        return;
    }
    console.log('Connected to MySQL server.');
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Server Error', error: err.message });
});
app.get("/",(req,res)=>{
    res.send("Hello World")
})
// API for user registration
app.post('/api/register', (req, res) => {
    const { email, password } = req.body;

    // Validate email
    if (!email || !emailValidator.validate(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }

    // Validate password
    if (!password) {
        return res.status(400).json({ message: 'Password cannot be empty' });
    }

    const checkUserQuery = 'SELECT * FROM users WHERE email = ?';
    defaultdb.query(checkUserQuery, [email], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Server error' });
        }
        if (result.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash the password
        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) {
                return res.status(500).json({ message: 'Error hashing password' });
            }

            const insertUserQuery = 'INSERT INTO users (email, password) VALUES (?, ?)';
            defaultdb.query(insertUserQuery, [email, hashedPassword], (err, result) => {
                if (err) {
                    return res.status(500).json({ message: 'Database error' });
                }
                res.status(201).json({ message: 'User registered successfully' });
            });
        });
    });
});

// API for logging in
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !emailValidator.validate(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }

    if (!password) {
        return res.status(400).json({ message: 'Password cannot be empty' });
    }

    const query = 'SELECT * FROM users WHERE email = ?';
    defaultdb.query(query, [email], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Server error' });
        }
        if (result.length === 0) {
            return res.status(400).json({ message: 'User not found' });
        }

        const user = result[0];
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                return res.status(500).json({ message: 'Error comparing passwords' });
            }
            if (isMatch) {
                return res.json({ message: 'Login successful' });
            } else {
                return res.status(400).json({ message: 'Invalid credentials' });
            }
        });
    });
});

// API to get students (no authentication)
app.get('/api/students', (req, res) => {
    const query = 'SELECT * FROM students';
    defaultdb.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching students', error: err });
        }
        res.json(results);
    });
});

// API to add a student
app.post('/api/students', (req, res) => {
    const students = req.body;

    for (const student of students) {
        if (!student.name || !student.age || !student.gender || !student.college || !student.batch || !student.status || student.dsaScore === undefined || student.reactScore === undefined || student.webdScore === undefined) {
            return res.status(400).json({ message: 'All fields are required' });
        }
    }

    const query = `
        INSERT INTO students (name, age, gender, college, batch, status, dsaScore, reactScore, webdScore)
        VALUES ?
    `;
    const values = students.map(student => [
        student.name,
        student.age,
        student.gender,
        student.college,
        student.batch,
        student.status,
        student.dsaScore,
        student.reactScore,
        student.webdScore
    ]);

    defaultdb.query(query, [values], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Error inserting students', error: err });
        }
        res.status(201).json({ message: 'Students added successfully', result });
    });
});

// API to add an interview
app.post('/api/interviews', (req, res) => {
    const { company, date } = req.body;

    if (!company || !date) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const insertInterviewQuery = 'INSERT INTO interviews (company, date) VALUES (?, ?)';
    defaultdb.query(insertInterviewQuery, [company, date], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err });
        }
        res.status(201).json({ message: 'Interview added successfully', interviewId: result.insertId });
    });
});

// API to get interviews with students
app.get('/api/interviews', (req, res) => {
    const interviewQuery = 'SELECT * FROM interviews';
    const studentQuery = 'SELECT * FROM students';

    defaultdb.query(interviewQuery, (err, interviewResults) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch interview data' });
        }

        if (interviewResults.length === 0) {
            return res.status(404).json({ error: 'No interviews found' });
        }

        defaultdb.query(studentQuery, (err, studentResults) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch students data' });
            }

            const interviewsWithStudents = interviewResults.map(interview => ({
                companyName: interview.company,
                date: interview.date,
                students: studentResults.map(student => ({
                    name: student.name,
                    email: student.email,
                    result: student.result
                }))
            }));

            res.json(interviewsWithStudents);
        });
    });
});

// API to delete an interview
app.delete('/api/interviews/:id', (req, res) => {
    const interviewId = req.params.id;

    const deleteQuery = 'DELETE FROM interviews WHERE id = ?';
    defaultdb.query(deleteQuery, [interviewId], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Server error' });
        }
        if (result.affectedRows > 0) {
            res.status(200).json({ message: 'Interview deleted successfully' });
        } else {
            res.status(404).json({ message: 'Interview not found' });
        }
    });
});

// API to add jobs
app.post('/api/jobs', (req, res) => {
    const jobs = req.body;

    const insertJobsQuery = 'INSERT INTO jobs (id, title, company, type, date, location, salary, logo) VALUES ?';
    const values = jobs.map(job => [job.id, job.title, job.company, job.type, job.date, job.location, job.salary, job.logo]);

    defaultdb.query(insertJobsQuery, [values], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err });
        }
        res.status(201).json({ message: 'Jobs inserted successfully' });
    });
});

// API to get jobs
app.get('/api/jobs', (req, res) => {
    const query = 'SELECT * FROM jobs';
    defaultdb.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching jobs', error: err });
        }
        res.json(results);
    });
});

// Start the server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
