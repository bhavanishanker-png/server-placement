require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const emailValidator = require('email-validator');
const app = express();
app.use(express.json());
app.use(cors({}));

// Logging connection details without exposing sensitive info
console.log(`Attempting to connect to MySQL server at ${process.env.DB_HOST}:${process.env.DB_PORT}`);

const defaultdb = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    connectTimeout: 10000 // 10 seconds timeout
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

app.get('/',(req,res)=>{
    res.send('Hello World');
})

app.post('/api/create-jobs-table', (req, res) => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS jobs (
            id INT PRIMARY KEY,
            title VARCHAR(255),
            company VARCHAR(255),
            type ENUM('full_time', 'part_time', 'contract'),
            date DATETIME,
            location VARCHAR(255),
            salary VARCHAR(255),
            logo VARCHAR(255),
            UNIQUE KEY (id)
        )
    `;

    defaultdb.query(createTableQuery, (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err });
        }
        res.status(200).json({ message: 'Table created successfully', result });
    });
});

app.post('/api/create-interviews-table', (req, res) => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS interviews (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company VARCHAR(255) NOT NULL,
            date DATETIME NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY (id)
        )
    `;

    defaultdb.query(createTableQuery, (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err });
        }
        res.status(200).json({ message: 'Interviews table created successfully', result });
    });
});


router.post('/add-id-column', async (req, res) => {
  try {
    // Check if the 'id' column exists
    const checkColumnQuery = `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'interviews' AND COLUMN_NAME = 'id';
    `;
    
    const [rows] = await db.query(checkColumnQuery);

    // If the column does not exist, add it
    if (rows.length === 0) {
      const addColumnQuery = `
        ALTER TABLE interviews 
        ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY;
      `;
      
      await db.query(addColumnQuery);
      return res.status(200).json({ message: 'Column "id" added to the interviews table.' });
    }

    return res.status(200).json({ message: 'Column "id" already exists in the interviews table.' });
  } catch (error) {
    console.error('Error adding column to interviews table:', error);
    return res.status(500).json({ message: 'Error adding column to interviews table.', error: error.message });
  }
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

// API to add jobs
app.post('/api/jobs', (req, res) => {
    const jobs = req.body;

    if (!Array.isArray(jobs) || jobs.length === 0) {
        return res.status(400).json({ message: 'Invalid input data' });
    }

    // Prepare SQL queries and parameters for updating jobs
    const updateQueries = jobs.map(job => {
        return {
            query: `
                UPDATE jobs
                SET
                    title = ?,
                    company = ?,
                    type = ?,
                    date = ?,
                    location = ?,
                    salary = ?,
                    logo = ?
                WHERE id = ?;
            `,
            params: [
                job.title,
                job.company,
                job.type,
                job.date,
                job.location,
                job.salary,
                job.logo,
                job.id
            ]
        };
    });

    // Execute all update queries in a transaction
    defaultdb.beginTransaction(err => {
        if (err) {
            return res.status(500).json({ message: 'Transaction error', error: err });
        }

        let queriesExecuted = 0;
        let errorOccurred = false;

        updateQueries.forEach(({ query, params }) => {
            defaultdb.query(query, params, (err, result) => {
                if (err) {
                    errorOccurred = true;
                    return defaultdb.rollback(() => {
                        res.status(500).json({ message: 'Database error', error: err });
                    });
                }

                queriesExecuted++;
                if (queriesExecuted === updateQueries.length && !errorOccurred) {
                    defaultdb.commit(err => {
                        if (err) {
                            return defaultdb.rollback(() => {
                                res.status(500).json({ message: 'Commit error', error: err });
                            });
                        }
                        res.status(200).json({ message: 'Jobs updated successfully' });
                    });
                }
            });
        });
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
    const { companyName, date, status, interviewers } = req.body;

    const updateQuery = `
        UPDATE interviews
        SET companyName = ?, date = ?, status = ?, interviewers = ?
        WHERE id = ?
    `;
    const values = [companyName, date, status, interviewers, interviewId];

    defaultdb.query(updateQuery, values, (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Error updating interview', error: err });
        }

        // Check if any rows were affected
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Interview not found' });
        }

        res.status(200).json({ message: 'Interview updated successfully' });
    });
});

// API to delete a student
app.delete('/api/students/:id', (req, res) => {
    const studentId = req.params.id;
    console.log(studentId)
    const deleteQuery = 'DELETE FROM students WHERE id = ?';
    defaultdb.query(deleteQuery, [studentId], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Error deleting student', error: err });
        }
        res.status(200).json({ message: 'Student deleted successfully' });
    });
});
// API to delete an interview
app.delete('/api/interviews/:id', (req, res) => {
    const interviewId = req.params.id;
    console.log(interviewId);
    
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

app.delete('/api/jobs/:id', (req, res) => {
    const studentId = req.params.id;
    console.log(studentId)
    const deleteQuery = 'DELETE FROM jobs WHERE id = ?';
    defaultdb.query(deleteQuery, [studentId], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Error deleting student', error: err });
        }
        res.status(200).json({ message: 'Student deleted successfully' });
    });
});
// API to show all tables and their data
app.get('/api/tables', (req, res) => {
    const getTablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = ?
    `;

    defaultdb.query(getTablesQuery, [process.env.DB_NAME], (err, tables) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching table names', error: err });
        }

        if (tables.length === 0) {
            return res.status(404).json({ message: 'No tables found' });
        }

        let tableData = {}; // Object to store all tables and their data
        let processedTables = 0; // Counter for processed tables

        tables.forEach(table => {
            const tableName = table.TABLE_NAME; // Correctly access table name

            if (!tableName) {
                return res.status(500).json({ message: 'Invalid table name found' });
            }

            const getTableDataQuery = `SELECT * FROM ??`; // Placeholder for table name to prevent SQL injection
            defaultdb.query(getTableDataQuery, [tableName], (err, tableResults) => {
                if (err) {
                    // Send the error only once if an issue is encountered
                    if (!res.headersSent) {
                        return res.status(500).json({ message: `Error fetching data for table ${tableName}`, error: err });
                    }
                    return; // Exit early if headers have already been sent
                }

                // Add the fetched table data to tableData object
                tableData[tableName] = tableResults;
                processedTables++;

                // If all tables are processed, send the response once
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
    console.log(`Server running on port ${PORT}`);
});
