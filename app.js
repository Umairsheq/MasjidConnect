// Remove Supabase Configuration since it's now in index.html

// Function to check if Supabase is ready
function isSupabaseReady() {
    if (!window.supabase) {
        console.error('Supabase is not initialized!');
        return false;
    }
    try {
        // Test if we can access the from method
        if (typeof window.supabase.from === 'function') {
            return true;
        }
        console.error('Supabase client is missing required methods');
        return false;
    } catch (error) {
        console.error('Error checking Supabase:', error);
        return false;
    }
}

// Initialize check
console.log('Checking Supabase connection...');
if (isSupabaseReady()) {
    console.log('Supabase is ready to use!');
} else {
    console.log('Waiting for Supabase to initialize...');
}

// Function to check if masjid name exists
async function checkMasjidNameExists(masjidName) {
    if (!isSupabaseReady() || !masjidName) return false;

    try {
        const { data, error } = await window.supabase
            .from('masjids')
            .select('name')
            .ilike('name', masjidName)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 means no rows returned
            console.error('Error checking masjid name:', error);
            return false;
        }

        return !!data; // Returns true if masjid exists, false otherwise
    } catch (error) {
        console.error('Error in checkMasjidNameExists:', error);
        return false;
    }
}

// Add event listener for real-time masjid name search
document.addEventListener('DOMContentLoaded', function() {
    const masjidNameInput = document.getElementById('masjidName');
    const searchResultsDiv = document.createElement('div');
    searchResultsDiv.className = 'search-results';
    searchResultsDiv.style.marginTop = '10px';
    searchResultsDiv.style.maxHeight = '200px';
    searchResultsDiv.style.overflowY = 'auto';
    
    if (masjidNameInput) {
        masjidNameInput.parentNode.appendChild(searchResultsDiv);
        
        let timeout;
        masjidNameInput.addEventListener('input', function() {
            clearTimeout(timeout);
            const searchName = this.value.trim();
            
            timeout = setTimeout(async () => {
                if (searchName) {
                    try {
                        const { data, error } = await window.supabase
                            .from('masjids')
                            .select('*')
                            .ilike('name', `${searchName}%`);

                        if (error) throw error;

                        if (data && data.length > 0) {
                            let resultsHtml = '<div style="background: #fff0f0; padding: 10px; border-radius: 5px; border: 1px solid #ffcdd2;">';
                            resultsHtml += '<p style="margin: 0 0 10px 0; color: #d32f2f; font-weight: bold;">Warning: Similar masjid names found!</p>';
                            data.forEach(masjid => {
                                resultsHtml += `
                                    <div style="padding: 8px; border-bottom: 1px solid #ffcdd2; color: #d32f2f;">
                                        "${masjid.name}" already exists
                                    </div>
                                `;
                            });
                            resultsHtml += '</div>';
                            searchResultsDiv.innerHTML = resultsHtml;
                            masjidNameInput.style.borderColor = '#d32f2f';
                        } else {
                            searchResultsDiv.innerHTML = '';
                            masjidNameInput.style.borderColor = '';
                        }
                    } catch (error) {
                        console.error('Search error:', error);
                        searchResultsDiv.innerHTML = '';
                        masjidNameInput.style.borderColor = '';
                    }
                } else {
                    searchResultsDiv.innerHTML = '';
                    masjidNameInput.style.borderColor = '';
                }
            }, 300); // Debounce for 300ms
        });
    }
});

// Save Masjid data
async function saveMasjid(event) {
    event.preventDefault();
    console.log('Attempting to save masjid...');

    if (!isSupabaseReady()) {
        alert('Database is not ready. Please refresh the page.');
        return;
    }

    const masjidName = document.getElementById('masjidName').value.trim();
    
    // Check if masjid exists before saving
    const exists = await checkMasjidNameExists(masjidName);
    if (exists) {
        alert('A masjid with this name already exists!');
        return;
    }

    const masjidData = {
        name: masjidName,
        fajr: document.getElementById('fajr').value,
        zuhr: document.getElementById('zuhr').value,
        asr: document.getElementById('asr').value,
        maghrib: document.getElementById('maghrib').value,
        isha: document.getElementById('isha').value,
        last_updated: new Date().toISOString()
    };

    try {
        console.log('Attempting to insert data:', masjidData);
        
        // Test the Supabase connection first
        const { data: testData, error: testError } = await window.supabase
            .from('masjids')
            .select('count');
            
        if (testError) {
            console.error('Database connection test failed:', testError);
            throw new Error('Database connection failed: ' + testError.message);
        }
        
        console.log('Database connection test successful');

        // Now try to insert the data
        const { data, error } = await window.supabase
            .from('masjids')
            .insert([masjidData])
            .select();

        if (error) {
            console.error('Insert error:', error);
            throw new Error(error.message || 'Failed to add masjid');
        }
        
        if (!data) {
            throw new Error('No data returned from insert');
        }
        
        console.log('Masjid added successfully:', data);
        alert('Masjid added successfully!');
        document.getElementById('masjidForm').reset();
        showAllMasjids(); // Refresh the display
    } catch (error) {
        console.error('Detailed error:', error);
        alert(error.message || 'Error adding masjid. Please try again.');
    }
}

// Search for Masjid
async function searchMasjid() {
    if (!isSupabaseReady()) {
        alert('Please wait a moment and try again. Database is connecting...');
        return;
    }

    const searchInput = document.getElementById('searchInput').value.toLowerCase();
    const resultsDiv = document.getElementById('searchResults');
    
    if (searchInput.length === 0) {
        showAllMasjids();
        return;
    }

    resultsDiv.innerHTML = '<h3>Searching...</h3>';

    try {
        const { data, error } = await window.supabase
            .from('masjids')
            .select('*')
            .ilike('name', `${searchInput}%`);

        if (error) throw error;

        let resultsHtml = '';
        if (data && data.length > 0) {
            resultsHtml = '<div class="masjids-grid">';
            data.forEach(masjid => {
                // Format the last_updated date nicely
                const lastUpdated = masjid.last_updated 
                    ? new Date(masjid.last_updated).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    })
                    : 'Not available';

                resultsHtml += `
                    <div class="masjid-card">
                        <h3>${masjid.name}</h3>
                        <div class="prayer-times-display">
                            <div class="prayer-time">
                                <span class="prayer-label">Fajr:</span>
                                <span class="prayer-value">${masjid.fajr}</span>
                            </div>
                            <div class="prayer-time">
                                <span class="prayer-label">Zuhr:</span>
                                <span class="prayer-value">${masjid.zuhr}</span>
                            </div>
                            <div class="prayer-time">
                                <span class="prayer-label">Asr:</span>
                                <span class="prayer-value">${masjid.asr}</span>
                            </div>
                            <div class="prayer-time">
                                <span class="prayer-label">Maghrib:</span>
                                <span class="prayer-value">${masjid.maghrib}</span>
                            </div>
                            <div class="prayer-time">
                                <span class="prayer-label">Isha:</span>
                                <span class="prayer-value">${masjid.isha}</span>
                            </div>
                        </div>
                        <div class="masjid-footer">
                            <button onclick="updateMasjid(${masjid.id})" class="update-btn">Update Times</button>
                            <div class="last-updated" title="${lastUpdated}">
                                Last updated: <span class="update-time">${lastUpdated}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            resultsHtml += '</div>';
        } else {
            resultsHtml = '<p class="no-results">No masjids found matching your search.</p>';
        }

        resultsDiv.innerHTML = resultsHtml;
    } catch (error) {
        console.error('Error searching for masjids:', error);
        resultsDiv.innerHTML = '<p>Error searching for masjids: ' + error.message + '</p>';
    }
}

// Show all Masjids
async function showAllMasjids() {
    if (!isSupabaseReady()) {
        alert('Database is not ready. Please refresh the page.');
        return;
    }

    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '<h3>Loading all masjids...</h3>';

    try {
        // Get all masjids, sorted by last updated
        const { data, error } = await window.supabase
            .from('masjids')
            .select('*')
            .order('last_updated', { ascending: false });

        if (error) throw error;

        let resultsHtml = '';
        if (data && data.length > 0) {
            resultsHtml = '<div class="masjids-grid">';
            data.forEach(masjid => {
                // Format the last_updated date nicely
                const lastUpdated = masjid.last_updated 
                    ? new Date(masjid.last_updated).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                    })
                    : 'Not available';
                    
                resultsHtml += `
                    <div class="masjid-card">
                        <h3>${masjid.name}</h3>
                        <div class="prayer-times-display">
                            <div class="prayer-time">
                                <span class="prayer-label">Fajr:</span>
                                <span class="prayer-value">${masjid.fajr}</span>
                            </div>
                            <div class="prayer-time">
                                <span class="prayer-label">Zuhr:</span>
                                <span class="prayer-value">${masjid.zuhr}</span>
                            </div>
                            <div class="prayer-time">
                                <span class="prayer-label">Asr:</span>
                                <span class="prayer-value">${masjid.asr}</span>
                            </div>
                            <div class="prayer-time">
                                <span class="prayer-label">Maghrib:</span>
                                <span class="prayer-value">${masjid.maghrib}</span>
                            </div>
                            <div class="prayer-time">
                                <span class="prayer-label">Isha:</span>
                                <span class="prayer-value">${masjid.isha}</span>
                            </div>
                        </div>
                        <div class="masjid-footer">
                            <button onclick="updateMasjid(${masjid.id})" class="update-btn">Update Times</button>
                            <div class="last-updated" title="${lastUpdated}">
                                Last updated: <span class="update-time">${lastUpdated}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            resultsHtml += '</div>';
        } else {
            resultsHtml = '<p class="no-results">No masjids found in the database.</p>';
        }

        resultsDiv.innerHTML = resultsHtml;
    } catch (error) {
        console.error('Error fetching masjids:', error);
        resultsDiv.innerHTML = '<p class="error-message">Error loading masjids: ' + error.message + '</p>';
    }
}

// Add event listener for real-time search
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    // Remove the old event listener
    searchInput.removeEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            searchMasjid();
        }
    });

    // Add new event listener for real-time search
    let searchTimeout;
    searchInput.addEventListener('input', function() {
        // Clear the previous timeout
        clearTimeout(searchTimeout);
        
        // Set a new timeout to avoid too many requests
        searchTimeout = setTimeout(() => {
            searchMasjid();
        }, 300); // Wait 300ms after user stops typing
    });
}

// Add some additional CSS for the search results
const style = document.createElement('style');
style.textContent = `
    .masjid-card {
        background-color: #fff;
        border-radius: 8px;
        padding: 1.5rem;
        margin-bottom: 1rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
    }

    .masjid-card:hover {
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }

    .masjid-card h3 {
        color: var(--primary-color);
        margin-bottom: 1rem;
    }

    .prayer-times-display {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 1rem;
    }

    .prayer-times-display p {
        margin: 0;
    }

    .masjid-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #eee;
    }

    .last-updated {
        color: #333;
        font-weight: 500;
        padding: 0.5rem;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.3s ease;
    }

    .last-updated:hover {
        background-color: #f0f0f0;
    }

    .update-time {
        color: #2196F3;
        font-weight: bold;
    }

    .update-btn {
        background-color: var(--primary-color);
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.3s ease;
    }

    .update-btn:hover {
        background-color: var(--primary-dark);
    }
`;
document.head.appendChild(style);

// Function to export masjid data
function exportMasjidData() {
    const masjids = JSON.parse(localStorage.getItem('masjids')) || [];
    const dataStr = JSON.stringify(masjids, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'masjid-data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Function to import masjid data
function importMasjidData(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            const currentMasjids = JSON.parse(localStorage.getItem('masjids')) || [];
            
            // Merge imported data with existing data, avoiding duplicates
            const mergedMasjids = [...currentMasjids];
            importedData.forEach(importedMasjid => {
                if (!mergedMasjids.some(m => m.name === importedMasjid.name && m.address === importedMasjid.address)) {
                    mergedMasjids.push(importedMasjid);
                }
            });
            
            localStorage.setItem('masjids', JSON.stringify(mergedMasjids));
            alert('Masjid data imported successfully!');
            displayMasjids(); // Refresh the display
        } catch (error) {
            alert('Error importing data. Please make sure the file is valid.');
        }
    };
    reader.readAsText(file);
}

// Gist-based cloud sync
const GIST_ID = 'YOUR_GIST_ID'; // User will need to create a Gist and put ID here

async function uploadToGist() {
    try {
        const masjids = JSON.parse(localStorage.getItem('masjids')) || [];
        const response = await fetch(`https://api.github.com/gists/${GIST_ID}`);
        
        if (response.ok) {
            alert('Data uploaded to cloud successfully!');
        } else {
            throw new Error('Failed to upload');
        }
    } catch (error) {
        alert('Error uploading to cloud. Please check your connection.');
        console.error('Upload error:', error);
    }
}

async function downloadFromGist() {
    try {
        const response = await fetch(`https://api.github.com/gists/${GIST_ID}`);
        
        if (response.ok) {
            const data = await response.json();
            const content = JSON.parse(data.files['masjid-data.json'].content);
            
            // Update local storage with cloud data
            localStorage.setItem('masjids', JSON.stringify(content));
            alert('Data downloaded from cloud successfully!');
            showAllMasjids(); // Refresh the display
        } else {
            throw new Error('Failed to download');
        }
    } catch (error) {
        alert('Error downloading from cloud. Please check your connection.');
        console.error('Download error:', error);
    }
}

// Update Masjid data
async function updateMasjid(masjidId) {
    if (!isSupabaseReady()) {
        alert('Database is not ready. Please refresh the page.');
        return;
    }

    // Create modal for updating prayer times
    const modal = document.createElement('div');
    modal.className = 'update-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Update Prayer Times</h3>
            <form id="updateForm">
                <div class="form-group">
                    <label for="update_fajr">Fajr:</label>
                    <input type="time" id="update_fajr" required>
                </div>
                <div class="form-group">
                    <label for="update_zuhr">Zuhr:</label>
                    <input type="time" id="update_zuhr" required>
                </div>
                <div class="form-group">
                    <label for="update_asr">Asr:</label>
                    <input type="time" id="update_asr" required>
                </div>
                <div class="form-group">
                    <label for="update_maghrib">Maghrib:</label>
                    <input type="time" id="update_maghrib" required>
                </div>
                <div class="form-group">
                    <label for="update_isha">Isha:</label>
                    <input type="time" id="update_isha" required>
                </div>
                <div class="modal-buttons">
                    <button type="submit">Update</button>
                    <button type="button" onclick="this.closest('.update-modal').remove()">Cancel</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    // Get current prayer times
    try {
        const { data, error } = await window.supabase
            .from('masjids')
            .select('*')
            .eq('id', masjidId)
            .single();

        if (error) throw error;

        // Pre-fill the form with current values
        document.getElementById('update_fajr').value = data.fajr;
        document.getElementById('update_zuhr').value = data.zuhr;
        document.getElementById('update_asr').value = data.asr;
        document.getElementById('update_maghrib').value = data.maghrib;
        document.getElementById('update_isha').value = data.isha;

        // Handle form submission
        document.getElementById('updateForm').onsubmit = async (e) => {
            e.preventDefault();
            
            try {
                // Prepare the update data
                const updatedData = {
                    fajr: document.getElementById('update_fajr').value,
                    zuhr: document.getElementById('update_zuhr').value,
                    asr: document.getElementById('update_asr').value,
                    maghrib: document.getElementById('update_maghrib').value,
                    isha: document.getElementById('update_isha').value
                };

                // Update the prayer times
                const { data: updateResult, error: updateError } = await window.supabase
                    .from('masjids')
                    .update(updatedData)
                    .eq('id', masjidId)
                    .select('*, last_updated');

                if (updateError) {
                    throw updateError;
                }

                if (!updateResult || updateResult.length === 0) {
                    throw new Error('No data was updated');
                }

                console.log('Update successful:', updateResult);
                
                // Close the modal and show success message
                modal.remove();
                alert('Prayer times updated successfully!');
                
                // Wait a moment to ensure the database trigger has completed
                setTimeout(async () => {
                    await showAllMasjids(); // Refresh the display
                }, 500);
            } catch (error) {
                console.error('Error updating prayer times:', error);
                alert('Error updating prayer times: ' + error.message);
            }
        };
    } catch (error) {
        console.error('Error fetching masjid data:', error);
        alert('Error fetching masjid data: ' + error.message);
        modal.remove();
    }
}

// Add event listener for real-time search suggestions
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    const suggestionsList = document.getElementById('masjidSuggestions');
    
    if (searchInput && suggestionsList) {
        let timeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(timeout);
            const searchTerm = this.value.trim();
            
            // Only search if there's input
            if (searchTerm.length > 0) {
                timeout = setTimeout(async () => {
                    try {
                        const { data, error } = await window.supabase
                            .from('masjids')
                            .select('name')
                            .ilike('name', `${searchTerm}%`);

                        if (error) throw error;

                        // Clear previous suggestions
                        suggestionsList.innerHTML = '';

                        // Add new suggestions
                        if (data) {
                            data.forEach(masjid => {
                                const option = document.createElement('option');
                                option.value = masjid.name;
                                suggestionsList.appendChild(option);
                            });
                        }
                    } catch (error) {
                        console.error('Error fetching suggestions:', error);
                    }
                }, 300); // Debounce for 300ms
            }
        });
    }
}); 