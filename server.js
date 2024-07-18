const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const dotenv = require("dotenv");
require('dotenv').config({path: __dirname + '/.env'})
const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET;  // In a real app, use an environment variable

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// User model
const User = mongoose.model('User', {
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true }
});

// Note model
const Note = mongoose.model('Note', {
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  tags: [String],
  backgroundColor: { type: String, default: '#ffffff' },
  archived: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
  deletedAt: Date,
  reminder: Date
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) return res.sendStatus(401);
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// User registration
app.post('/register', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = new User({
      username: req.body.username,
      password: hashedPassword
    });
    await user.save();
    res.status(201).send('User registered successfully');
  } catch (error) {
    res.status(500).send('Error registering user');
  }
});

// User login
app.post('/login', async (req, res) => {
  const user = await User.findOne({ username: req.body.username });
  if (user == null) {
    return res.status(400).send('Cannot find user');
  }
  try {
    if (await bcrypt.compare(req.body.password, user.password)) {
      const token = jwt.sign({ id: user._id }, JWT_SECRET);
      res.json({ token: token });
    } else {
      res.send('Not Allowed');
    }
  } catch {
    res.status(500).send();
  }
});

// Get all notes for a user
app.get('/notes', authenticateToken, async (req, res) => {
  try {
    const notes = await Note.find({ userId: req.user.id, deleted: false });
    res.json(notes);
  } catch (error) {
    res.status(500).send('Error fetching notes');
  }
});

// Create a new note
app.post('/notes', authenticateToken, async (req, res) => {
  const note = new Note({
    userId: req.user.id,
    content: req.body.content,
    tags: req.body.tags,
    backgroundColor: req.body.backgroundColor,
    reminder: req.body.reminder
  });
  try {
    const newNote = await note.save();
    res.status(201).json(newNote);
  } catch (error) {
    res.status(400).send('Error creating note');
  }
});

// Get all notes (including archived, excluding deleted)
app.get('/notes/all', authenticateToken, async (req, res) => {
  try {
    const notes = await Note.find({ userId: req.user.id, deleted: false });
    res.json(notes);
  } catch (error) {
    res.status(500).send('Error fetching all notes');
  }
});

// Update a note (including archive/unarchive)
app.put('/notes/:id', authenticateToken, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (note == null) {
      return res.status(404).send('Note not found');
    }
    Object.assign(note, req.body);
    await note.save();
    res.json(note);
  } catch (error) {
    res.status(400).send(`Error updating note: ${error.message}`);
  }
});

// Permanently delete a note from trash
app.delete('/notes/permanent/:id', authenticateToken, async (req, res) => {
  try {
    const result = await Note.deleteOne({ _id: req.params.id, userId: req.user.id, deleted: true });
    if (result.deletedCount === 0) {
      return res.status(404).send('Note not found in trash');
    }
    res.send('Note permanently deleted');
  } catch (error) {
    res.status(500).send(`Error permanently deleting note: ${error.message}`);
  }
});
// Delete a note (move to trash)
app.delete('/notes/:id', authenticateToken, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
    if (note == null) {
      return res.status(404).send('Note not found');
    }
    note.deleted = true;
    note.deletedAt = new Date();
    await note.save();
    res.send('Note moved to trash');
  } catch (error) {
    res.status(500).send('Error deleting note');
  }
});

// Get archived notes
app.get('/notes/archived', authenticateToken, async (req, res) => {
  try {
    const notes = await Note.find({ userId: req.user.id, archived: true, deleted: false });
    res.json(notes);
  } catch (error) {
    res.status(500).send('Error fetching archived notes');
  }
});


app.get('/notes/get/:id', authenticateToken, async (req, res) => {
  const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
  if (note == null) return res.sendStatus(404);
  res.json(note);
});

// Get trash notes
app.get('/notes/trash', authenticateToken, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));
    const notes = await Note.find({
      userId: req.user.id,
      deleted: true,
      deletedAt: { $gte: thirtyDaysAgo }
    });
    res.json(notes);
  } catch (error) {
    res.status(500).send('Error fetching trash notes');
  }
});

app.get('/notes/search', authenticateToken, async (req, res) => {
  try {
    const searchTerm = req.query.term;
    if (!searchTerm) {
      return res.json(await Note.find({ userId: req.user.id, deleted: false }));
    }
    const notes = await Note.find({
      userId: req.user.id,
      deleted: false,
      $or: [
        { content: { $regex: searchTerm, $options: 'i' } },
        { tags: { $in: [new RegExp(searchTerm, 'i')] } }
      ]
    });
    res.json(notes);
  } catch (error) {
    res.status(500).send('Error searching notes');
  }
});

// Get notes by tag
app.get('/notes/tag/:tag', authenticateToken, async (req, res) => {
  try {
    const notes = await Note.find({
      userId: req.user.id,
      deleted: false,
      tags: { $in: [new RegExp(req.params.tag, 'i')] }
    });
    res.json(notes);
  } catch (error) {
    res.status(500).send('Error fetching notes by tag');
  }
});

// Bonus: Get notes with reminders
app.get('/notes/reminders', authenticateToken, async (req, res) => {
  try {
    const notes = await Note.find({
      userId: req.user.id,
      deleted: false,
      reminder: { $gte: new Date() }
    }).sort({ reminder: 1 });
    res.json(notes);
  } catch (error) {
    res.status(500).send('Error fetching notes with reminders');
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));





