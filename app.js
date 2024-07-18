$(document).ready(function() {
    const API_URL = 'http://localhost:3000';
    let currentUser = null;
    let currentView = 'all';

    // Check if user is logged in
    function checkAuth() {
        const token = localStorage.getItem('token');
        if (token) {
            currentUser = { token: token };
            $('#authContainer').hide();
            $('#mainNav').show();
            loadNotes();
        } else {
            $('#authContainer').show();
            $('#mainNav').hide();
        }
    }

    // Login function
    $('#loginForm').submit(function(e) {
        e.preventDefault();
        $.ajax({
            url: `${API_URL}/login`,
            method: 'POST',
            data: JSON.stringify({
                username: $('#loginUsername').val(),
                password: $('#loginPassword').val()
            }),
            contentType: 'application/json',
            success: function(data) {
                localStorage.setItem('token', data.token);
                checkAuth();
            },
            error: function() {
                alert('Login failed');
            }
        });
    });

    // Register function
    $('#registerForm').submit(function(e) {
        e.preventDefault();
        $.ajax({
            url: `${API_URL}/register`,
            method: 'POST',
            data: JSON.stringify({
                username: $('#registerUsername').val(),
                password: $('#registerPassword').val()
            }),
            contentType: 'application/json',
            success: function() {
                alert('Registration successful. Please log in.');
            },
            error: function() {
                alert('Registration failed');
            }
        });
    });

    // Logout function
    $('#logoutBtn').click(function() {
        localStorage.removeItem('token');
        currentUser = null;
        checkAuth();
    });

    // Load notes based on current view
    function loadNotes() {
        let url;
        switch (currentView) {
            case 'all':
                url = `${API_URL}/notes/all`;
                break;
            case 'archived':
                url = `${API_URL}/notes/archived`;
                break;
            case 'trash':
                url = `${API_URL}/notes/trash`;
                break;
            default:
                url = `${API_URL}/notes`;
        }

        $.ajax({
            url: url,
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + currentUser.token },
            success: function(notes) {
                displayNotes(notes);
            },
            error: function(xhr) {
                alert(`Error loading notes: ${xhr.responseText}`);
            }
        });
    }

    // Display notes
    function displayNotes(notes) {
        const container = $('#notesContainer');
        container.empty();
        notes.forEach(function(note) {
            const noteElement = $(`
                <div class="note" style="background-color: ${note.backgroundColor}">
                    <p>${note.content}</p>
                    <p>Tags: ${note.tags.join(', ')}</p>
                    ${note.reminder ? `<p>Reminder: ${new Date(note.reminder).toLocaleString()}</p>` : ''}
                    ${currentView !== 'trash' ? `
                        <button class="editNoteBtn" data-id="${note._id}">Edit</button>
                        <button class="archiveNoteBtn" data-id="${note._id}">${note.archived ? 'Unarchive' : 'Archive'}</button>
                        <button class="deleteNoteBtn" data-id="${note._id}">Delete</button>
                    ` : `
                        <button class="restoreNoteBtn" data-id="${note._id}">Restore</button>
                        <button class="permanentDeleteNoteBtn" data-id="${note._id}">Permanently Delete</button>
                    `}
                </div>
            `);
            container.append(noteElement);
        });
    }

    // New note button
    $('#newNoteBtn').click(function() {
        openNoteModal();
    });

    function openNoteModal(noteId = null) {
        $('#noteModal').show();
        $('#noteContent').val('');
        $('#noteTags').val('');
        $('#noteColor').val('#ffffff');
        $('#noteReminder').val('');
        $('#saveNoteBtn').data('id', noteId);
    
        if (noteId) {
            $.ajax({
                url: `${API_URL}/notes/get/${noteId}`,
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + currentUser.token },
                success: function(note) {
                    $('#noteContent').val(note.content);
                    $('#noteTags').val(note.tags.join(', '));
                    $('#noteColor').val(note.backgroundColor);
                    $('#noteReminder').val(note.reminder ? new Date(note.reminder).toISOString().slice(0, 16) : '');
                },
                error: function(xhr) {
                    console.log(xhr);
                    if (xhr.status === 404) {
                        alert('Note not found. It may have been deleted.');
                        $('#noteModal').hide();
                    } else {
                        alert(`Error loading note: ${xhr.responseText}`);
                    }
                }
            });
        }
    }

    // Save note
    $('#saveNoteBtn').click(function() {
        const noteId = $(this).data('id');
        const noteData = {
            content: $('#noteContent').val(),
            tags: $('#noteTags').val().split(',').map(tag => tag.trim()),
            backgroundColor: $('#noteColor').val(),
            reminder: $('#noteReminder').val()
        };
        
        const url = noteId ? `${API_URL}/notes/${noteId}` : `${API_URL}/notes`;
        const method = noteId ? 'PUT' : 'POST';

        $.ajax({
            url: url,
            method: method,
            headers: { 'Authorization': 'Bearer ' + currentUser.token },
            data: JSON.stringify(noteData),
            contentType: 'application/json',
            success: function() {
                $('#noteModal').hide();
                loadNotes();
            },
            error: function(xhr) {
                alert(`Error ${noteId ? 'updating' : 'creating'} note: ${xhr.responseText}`);
            }
        });
    });

    // Edit note
    $(document).on('click', '.editNoteBtn', function() {
        const noteId = $(this).data('id');
        openNoteModal(noteId);
    });

    // Archive/Unarchive note
    $(document).on('click', '.archiveNoteBtn', function() {
        const noteId = $(this).data('id');
        const isArchived = $(this).text() === 'Unarchive';
        $.ajax({
            url: `${API_URL}/notes/${noteId}`,
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + currentUser.token },
            data: JSON.stringify({ archived: !isArchived }),
            contentType: 'application/json',
            success: function() {
                loadNotes();
            },
            error: function(xhr) {
                alert(`Error ${isArchived ? 'unarchiving' : 'archiving'} note: ${xhr.responseText}`);
            }
        });
    });

    // Delete note (move to trash)
    $(document).on('click', '.deleteNoteBtn', function() {
        const noteId = $(this).data('id');
        if (confirm('Are you sure you want to move this note to trash?')) {
            $.ajax({
                url: `${API_URL}/notes/${noteId}`,
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + currentUser.token },
                success: function() {
                    loadNotes();
                },
                error: function(xhr) {
                    alert(`Error moving note to trash: ${xhr.responseText}`);
                }
            });
        }
    });

    // Restore note from trash
    $(document).on('click', '.restoreNoteBtn', function() {
        const noteId = $(this).data('id');
        $.ajax({
            url: `${API_URL}/notes/${noteId}`,
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + currentUser.token },
            data: JSON.stringify({ deleted: false, deletedAt: null }),
            contentType: 'application/json',
            success: function() {
                loadNotes();
            },
            error: function(xhr) {
                alert(`Error restoring note: ${xhr.responseText}`);
            }
        });
    });

    // Permanently delete note
    $(document).on('click', '.permanentDeleteNoteBtn', function() {
        const noteId = $(this).data('id');
        if (confirm('Are you sure you want to permanently delete this note? This action cannot be undone.')) {
            $.ajax({
                url: `${API_URL}/notes/permanent/${noteId}`,
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + currentUser.token },
                success: function() {
                    loadNotes();
                },
                error: function(xhr) {
                    alert(`Error permanently deleting note: ${xhr.responseText}`);
                }
            });
        }
    });

    // View buttons
    $('#allNotesBtn').click(function() {
        currentView = 'all';
        loadNotes();
    });

    $('#archivedNotesBtn').click(function() {
        currentView = 'archived';
        loadNotes();
    });

    $('#trashNotesBtn').click(function() {
        currentView = 'trash';
        loadNotes();
    });


    let searchTimeout;

$('#searchInput').on('input', function() {
    clearTimeout(searchTimeout);
    const searchTerm = $(this).val();
    
    searchTimeout = setTimeout(() => {
        $.ajax({
            url: `${API_URL}/notes/search`,
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + currentUser.token },
            data: { term: searchTerm },
            success: function(notes) {
                displayNotes(notes);
            },
            error: function(xhr) {
                alert(`Error searching notes: ${xhr.responseText}`);
            }
        });
    }, 300); // 300ms delay to reduce API calls
});

    // Label view
    $('#labelViewBtn').click(function() {
        const tag = prompt('Enter tag to filter by:');
        if (tag) {
            $.ajax({
                url: `${API_URL}/notes/tag/${tag}`,
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + currentUser.token },
                success: function(notes) {
                    displayNotes(notes);
                },
                error: function() {
                    alert('Error fetching notes by tag');
                }
            });
        }
    });

    // Archived notes
    $('#archivedNotesBtn').click(function() {
        $.ajax({
            url: `${API_URL}/notes/archived`,
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + currentUser.token },
            success: function(notes) {
                displayNotes(notes);
            },
            error: function() {
                alert('Error fetching archived notes');
            }
        });
    });

    // Close modal
$('#closeModalBtn').click(function() {
    $('#noteModal').hide();
});
    // Trash notes
    $('#trashNotesBtn').click(function() {
        $.ajax({
            url: `${API_URL}/notes/trash`,
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + currentUser.token },
            success: function(notes) {
                displayNotes(notes);
            },
            error: function() {
                alert('Error fetching trash notes');
            }
        });
    });

    // Reminder view
    $('#reminderViewBtn').click(function() {
        $.ajax({
            url: `${API_URL}/notes/reminders`,
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + currentUser.token },
            success: function(notes) {
                displayNotes(notes);
            },
            error: function() {
                alert('Error fetching notes with reminders');
            }
        });
    });

    
// Check for due reminders
function checkReminders() {
    $.ajax({
        url: `${API_URL}/notes/reminders`,
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + currentUser.token },
        success: function(notes) {
            const now = new Date();
            notes.forEach(note => {
                const reminderTime = new Date(note.reminder);
                if (reminderTime <= now) {
                    alert(`Reminder: ${note.content}`);
                }
            });
        }
    });
}

// Check reminders every minute
setInterval(checkReminders, 60000);

// Initialize the app
checkAuth();
});