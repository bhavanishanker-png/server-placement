require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const emailValidator = require('email-validator');
const jwt = require('jsonwebtoken');
const app = express();
app.use(express.json());
app.use(cors());


console.log(`Attempting to connect to MySQL server at ${process.env.DB_HOST}:${process.env.DB_PORT}`);

const defaultdb = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    connectTimeout: 100000000
});

// Test the connection
defaultdb.connect((err) => {
    if (err) {
        console.error('Connection failed:', err.message);
        console.log('Ensure that the MySQL server allows connections from your IP address.');
        return;
    }
    console.log('Successfully connected to MySQL server.');
});

app.get('/', (req, res) => {
    res.send('Hello World');
});

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

                // Create JWT token after successful registration
                const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour
                res.status(201).json({ message: 'User registered successfully', token });
            });
        });
    });
});

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
                // Generate JWT token after successful login
                const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
                return res.json({ message: 'Login successful', token });
            } else {
                return res.status(400).json({ message: 'Invalid credentials' });
            }
        });
    });
});
const authenticateToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};
// API to get students
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
                id:interview.id,
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

// API to add jobs
app.post('/api/jobs', (req, res) => {
    const jobs = req.body;

    if (!Array.isArray(jobs) || jobs.length === 0) {
        return res.status(400).json({ message: 'Invalid input data' });
    }

    const insertQueries = jobs.map(job => {
        return {
            query: `
                INSERT INTO jobs (title, company, type, date, location, salary, logo)
                VALUES (?, ?, ?, ?, ?, ?, ?);
            `,
            params: [
                job.title,
                job.company,
                job.type,
                job.date,
                job.location,
                job.salary,
                job.logo
            ]
        };
    });


    insertQueries.forEach(({ query, params }) => {
        defaultdb.query(query, params, (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: 'Error inserting jobs', error: err });
            }
        });
    });

    res.status(201).json({ message: 'Jobs added successfully' });
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

// API to update student details
app.put('/api/students/:id', (req, res) => {
    const studentId = req.params.id;
    const { name, age, gender, college, batch, status, dsaScore, reactScore, webdScore } = req.body;

    const updateQuery = `
        UPDATE students
        SET name = ?, age = ?, gender = ?, college = ?, batch = ?, status = ?, dsaScore = ?, reactScore = ?, webdScore = ?
        WHERE id = ?
    `;
    
    const values = [name, age, gender, college, batch, status, dsaScore, reactScore, webdScore, studentId];

    defaultdb.query(updateQuery, values, (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Error updating student', error: err });
        }
        res.status(200).json({ message: 'Student updated successfully' });
    });
});

// API to update an interview
app.put('/api/interviews/:id', (req, res) => {
    const interviewId = req.params.id;
    const { company, date } = req.body;

    const updateQuery = `
        UPDATE interviews
        SET company = ?, date = ?
        WHERE id = ?
    `;
    const values = [company, date, interviewId];

    defaultdb.query(updateQuery, values, (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Error updating interview', error: err });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Interview not found' });
        }
        res.status(200).json({ message: 'Interview updated successfully' });
    });
});

// API to delete a student
app.delete('/api/students/:id', (req, res) => {
    const studentId = req.params.id;

    const deleteQuery = 'DELETE FROM students WHERE id = ?';
    defaultdb.query(deleteQuery, [studentId], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Error deleting student', error: err });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Student not found' });
        }
        res.status(200).json({ message: 'Student deleted successfully' });
    });
});

// API to delete an interview
app.delete('/api/interviews/:id', (req, res) => {
    const interviewId = req.params.id;

    const deleteQuery = 'DELETE FROM interviews WHERE id = ?';
    defaultdb.query(deleteQuery, [interviewId], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Error deleting interview', error: err });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Interview not found' });
        }
        res.status(200).json({ message: 'Interview deleted successfully' });
    });
});
app.get('/api/tables', (req, res) => {
    const getTablesQuery = 
        'SELECT table_name FROM information_schema.tables WHERE table_schema = ?';

    defaultdb.query(getTablesQuery, [process.env.DB_NAME], (err, tables) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching table names', error: err });
        }

        if (tables.length === 0) {
            return res.status(404).json({ message: 'No tables found' });
        }

        let tableData = {}; 
        let processedTables = 0; 

        tables.forEach(table => {
            const tableName = table.table_name; 

            if (!tableName) {
                return res.status(500).json({ message: 'Invalid table name found' });
            }

            const getTableDataQuery = 'SELECT * FROM ??'; // Prevents SQL injection
            defaultdb.query(getTableDataQuery, [tableName], (err, tableResults) => {
                if (err) {
                    if (!res.headersSent) {
                        return res.status(500).json({ message: `Error fetching data for table ${tableName}`, error: err });
                    }
                    return;
                }


                tableData[tableName] = tableResults;
                processedTables++;


                if (processedTables === tables.length && !res.headersSent) {
                    res.status(200).json(tableData);
                }
            });
        });
    });
});


// Start the server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
