// Application State
let appState = {
    releaseNotes: [],
    selectedNote: null,
    selectedDate: '',
    selectedLink: '',
    selectedTemplateId: '0',
    activeHashtags: new Set(),
    searchQuery: '',
    filterType: 'all',
    lastFetched: ''
};

// Twitter URL length standard
const TWITTER_URL_LEN = 23;
const MAX_TWEET_LEN = 280;

// Templates configuration
const TWEET_TEMPLATES = {
    '0': (type, text, date, link, hashtags) => {
        // Short / Feature focus
        const prefix = `🚀 BigQuery ${type}: `;
        const suffix = `\n\n${hashtags}`;
        
        // Estimate budget: limit - prefix - link_len - suffix - newlines
        const urlPlaceholderLen = TWITTER_URL_LEN + 2; // URL + 2 newlines
        const fixedLen = prefix.length + urlPlaceholderLen + hashtags.length;
        const textLimit = Math.max(50, MAX_TWEET_LEN - fixedLen);
        
        const contentText = truncateText(text, textLimit);
        return `${prefix}${contentText}\n\n${link}${hashtags ? '\n\n' + hashtags : ''}`;
    },
    '1': (type, text, date, link, hashtags) => {
        // Formal Announcement
        const prefix = `Google Cloud BigQuery Update (${date})\n\n${type}: `;
        const urlPlaceholderLen = TWITTER_URL_LEN + 2; 
        const fixedLen = prefix.length + urlPlaceholderLen + hashtags.length;
        const textLimit = Math.max(50, MAX_TWEET_LEN - fixedLen);
        
        const contentText = truncateText(text, textLimit);
        return `${prefix}${contentText}\n\n${link}${hashtags ? '\n\n' + hashtags : ''}`;
    },
    '2': (type, text, date, link, hashtags) => {
        // Dev Brief
        const prefix = `💻 BQ ${type} - `;
        const suffix = hashtags ? ` ${hashtags}` : '';
        const urlPlaceholderLen = TWITTER_URL_LEN + 1; // space + URL
        const fixedLen = prefix.length + urlPlaceholderLen + suffix.length;
        const textLimit = Math.max(50, MAX_TWEET_LEN - fixedLen);
        
        const contentText = truncateText(text, textLimit);
        return `${prefix}${contentText} ${link}${suffix}`;
    }
};

// Helper to truncate text with ellipsis
function truncateText(str, max) {
    if (!str) return '';
    if (str.length <= max) return str;
    return str.substring(0, max - 3) + '...';
}

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const refreshIcon = document.getElementById('refresh-icon');
const exportCsvBtn = document.getElementById('export-csv-btn');
const searchInput = document.getElementById('search-input');
const typeFilters = document.getElementById('type-filters');
const feedLoader = document.getElementById('feed-loader');
const errorAlert = document.getElementById('error-alert');
const errorText = document.getElementById('error-text');
const retryBtn = document.getElementById('retry-btn');
const releaseNotesList = document.getElementById('release-notes-list');
const cacheStatusText = document.getElementById('cache-status-text');

// Theme toggle elements
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeIconSun = document.getElementById('theme-icon-sun');
const themeIconMoon = document.getElementById('theme-icon-moon');
const themeToggleText = document.getElementById('theme-toggle-text');

// Composer DOM Elements
const composerEmptyState = document.getElementById('composer-empty-state');
const composerActiveState = document.getElementById('composer-active-state');
const tweetPreviewText = document.getElementById('tweet-preview-text');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCountText = document.getElementById('char-count-text');
const charProgressBar = document.getElementById('char-progress-bar');
const charProgressContainer = document.querySelector('.char-count-container');
const selectedNoteIdBadge = document.getElementById('selected-note-id');
const templateList = document.querySelector('.template-list');
const hashtagList = document.querySelector('.hashtag-list');
const tweetBtn = document.getElementById('tweet-btn');
const copyTweetBtn = document.getElementById('copy-tweet-btn');
const toastNotification = document.getElementById('toast-notification');
const toastMessage = document.getElementById('toast-message');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchReleaseNotes(false);
    setupEventListeners();
});

// Event Listeners Setup
function setupEventListeners() {
    // Refresh & Retry
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    retryBtn.addEventListener('click', () => fetchReleaseNotes(true));
    exportCsvBtn.addEventListener('click', exportToCsv);
    themeToggleBtn.addEventListener('click', toggleTheme);
    
    // Search & Filter
    searchInput.addEventListener('input', (e) => {
        appState.searchQuery = e.target.value.toLowerCase().trim();
        renderFeed();
    });
    
    typeFilters.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-pill')) {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            e.target.classList.add('active');
            appState.filterType = e.target.dataset.type;
            renderFeed();
        }
    });
    
    // Composer Inputs
    tweetTextarea.addEventListener('input', (e) => {
        const text = e.target.value;
        updateTweetPreview(text);
        updateCharCount(text);
    });
    
    // Template Choice
    templateList.addEventListener('click', (e) => {
        const chip = e.target.closest('.template-chip');
        if (chip) {
            document.querySelectorAll('.template-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            appState.selectedTemplateId = chip.dataset.templateId;
            generateAndSetTweet();
        }
    });
    
    // Hashtags Choice
    hashtagList.addEventListener('click', (e) => {
        const chip = e.target.closest('.hashtag-chip');
        if (chip) {
            const hashtag = chip.dataset.hashtag;
            if (appState.activeHashtags.has(hashtag)) {
                appState.activeHashtags.delete(hashtag);
                chip.classList.remove('selected');
            } else {
                appState.activeHashtags.add(hashtag);
                chip.classList.add('selected');
            }
            generateAndSetTweet();
        }
    });
    
    // Share Actions
    tweetBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        if (!text) return;
        const encodedText = encodeURIComponent(text);
        const url = `https://twitter.com/intent/tweet?text=${encodedText}`;
        window.open(url, '_blank');
    });
    
    copyTweetBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        if (!text) return;
        copyToClipboard(text, "Tweet text copied to clipboard!");
    });
}

// Fetch Release Notes
async function fetchReleaseNotes(force = false) {
    // Set UI to loading state
    feedLoader.classList.remove('hidden');
    releaseNotesList.classList.add('hidden');
    errorAlert.classList.add('hidden');
    refreshIcon.classList.add('spinning');
    refreshBtn.disabled = true;
    
    const statusDot = document.querySelector('.status-dot');
    statusDot.className = 'status-dot loading';
    cacheStatusText.innerText = 'Syncing...';
    
    try {
        const url = `/api/release-notes${force ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            appState.releaseNotes = result.data;
            appState.lastFetched = result.last_fetched;
            
            // Render
            renderFeed();
            
            // Update cache status
            statusDot.className = 'status-dot green';
            const sourceText = result.source === 'live' ? 'Live synced' : 'Cached';
            cacheStatusText.innerText = `${sourceText}: ${result.last_fetched}`;
            
            // If we have selected something, re-sync or preserve selection
            if (appState.selectedNote) {
                // Find if the note still exists
                let found = false;
                for (const entry of appState.releaseNotes) {
                    const matched = entry.updates.find(u => u.id === appState.selectedNote.id);
                    if (matched) {
                        appState.selectedNote = matched;
                        appState.selectedDate = entry.date;
                        appState.selectedLink = entry.link;
                        found = true;
                        break;
                    }
                }
                if (found) {
                    highlightSelectedCard();
                } else {
                    deselectNote();
                }
            }
        } else {
            showError(result.error || "Failed to load release notes.");
        }
    } catch (err) {
        showError("Network error. Make sure the server is running.");
        console.error(err);
    } finally {
        feedLoader.classList.add('hidden');
        refreshIcon.classList.remove('spinning');
        refreshBtn.disabled = false;
    }
}

// Show Error Panel
function showError(msg) {
    errorAlert.classList.remove('hidden');
    releaseNotesList.classList.add('hidden');
    errorText.innerText = msg;
    
    const statusDot = document.querySelector('.status-dot');
    statusDot.className = 'status-dot';
    cacheStatusText.innerText = 'Off-sync / Error';
}

// Render the feed
function renderFeed() {
    releaseNotesList.innerHTML = '';
    releaseNotesList.classList.remove('hidden');
    
    let visibleEntriesCount = 0;
    
    appState.releaseNotes.forEach(entry => {
        // Filter updates in this entry
        const filteredUpdates = entry.updates.filter(update => {
            // Type filter
            if (appState.filterType !== 'all' && update.type.toLowerCase() !== appState.filterType.toLowerCase()) {
                return false;
            }
            // Search text filter
            if (appState.searchQuery) {
                const textMatch = update.text.toLowerCase().includes(appState.searchQuery);
                const typeMatch = update.type.toLowerCase().includes(appState.searchQuery);
                return textMatch || typeMatch;
            }
            return true;
        });
        
        if (filteredUpdates.length > 0) {
            visibleEntriesCount++;
            
            // Create group element
            const groupDiv = document.createElement('div');
            groupDiv.className = 'release-group';
            
            // Date Heading
            const heading = document.createElement('h3');
            heading.className = 'date-heading';
            heading.innerText = entry.date;
            
            // Add Link icon beside heading
            if (entry.link) {
                const linkIcon = document.createElement('a');
                linkIcon.className = 'date-link';
                linkIcon.href = entry.link;
                linkIcon.target = '_blank';
                linkIcon.rel = 'noopener noreferrer';
                linkIcon.title = 'Open official release notes page';
                linkIcon.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 6px; display: inline-block; vertical-align: middle;">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
                    </svg>
                `;
                heading.appendChild(linkIcon);
            }
            
            groupDiv.appendChild(heading);
            
            // Cards container
            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'group-cards';
            
            filteredUpdates.forEach(update => {
                const card = document.createElement('div');
                card.className = `update-card ${appState.selectedNote && appState.selectedNote.id === update.id ? 'selected' : ''}`;
                card.dataset.id = update.id;
                card.dataset.date = entry.date;
                card.dataset.link = entry.link;
                
                // Add card click listener
                card.addEventListener('click', (e) => {
                    // Prevent card selection if clicking an action button directly
                    if (e.target.closest('.action-icon-btn')) return;
                    selectNote(update, entry.date, entry.link);
                });
                
                // Card header
                const cardHeader = document.createElement('div');
                cardHeader.className = 'card-header';
                
                // Badge
                const typeLower = update.type.toLowerCase();
                const badge = document.createElement('span');
                badge.className = `badge badge-${typeLower}`;
                badge.innerText = update.type;
                cardHeader.appendChild(badge);
                
                // Quick Card Actions
                const actions = document.createElement('div');
                actions.className = 'card-actions';
                
                // Quick Tweet Button
                const tweetActBtn = document.createElement('button');
                tweetActBtn.className = `action-icon-btn ${appState.selectedNote && appState.selectedNote.id === update.id ? 'active-tweet' : ''}`;
                tweetActBtn.title = "Draft tweet for this update";
                tweetActBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                `;
                tweetActBtn.addEventListener('click', () => {
                    selectNote(update, entry.date, entry.link);
                    // Scroll to composer on small screens
                    if (window.innerWidth <= 1024) {
                        document.querySelector('.composer-section').scrollIntoView({ behavior: 'smooth' });
                    }
                    tweetTextarea.focus();
                });
                actions.appendChild(tweetActBtn);
                
                // Quick Copy Text Button
                const copyTextBtn = document.createElement('button');
                copyTextBtn.className = 'action-icon-btn';
                copyTextBtn.title = "Copy update text to clipboard";
                copyTextBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                `;
                copyTextBtn.addEventListener('click', () => {
                    copyToClipboard(update.text, "Update text copied!");
                });
                actions.appendChild(copyTextBtn);
                
                // Quick Copy Link Button
                const copyLinkBtn = document.createElement('button');
                copyLinkBtn.className = 'action-icon-btn';
                copyLinkBtn.title = "Copy anchor link";
                copyLinkBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                `;
                copyLinkBtn.addEventListener('click', () => {
                    // Make a specific anchor link if possible
                    const anchorLink = entry.link ? `${entry.link}` : 'https://cloud.google.com/bigquery/docs/release-notes';
                    copyToClipboard(anchorLink, "Link copied!");
                });
                actions.appendChild(copyLinkBtn);
                
                cardHeader.appendChild(actions);
                card.appendChild(cardHeader);
                
                // Card Content (HTML)
                const cardContent = document.createElement('div');
                cardContent.className = 'card-content';
                cardContent.innerHTML = update.html;
                card.appendChild(cardContent);

                // Card Footer with Copy to Clipboard Button
                const cardFooter = document.createElement('div');
                cardFooter.className = 'card-footer';
                
                const copyBtn = document.createElement('button');
                copyBtn.className = 'btn btn-xs btn-secondary card-copy-btn';
                copyBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    <span>Copy to Clipboard</span>
                `;
                copyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    copyToClipboard(update.text, "Update text copied!");
                });
                cardFooter.appendChild(copyBtn);
                card.appendChild(cardFooter);
                
                cardsContainer.appendChild(card);
            });
            
            groupDiv.appendChild(cardsContainer);
            releaseNotesList.appendChild(groupDiv);
        }
    });
    
    // Empty state if nothing matches search/filters
    if (visibleEntriesCount === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'feed-loader';
        emptyState.innerHTML = `
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted);">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <p>No release notes found matching the filters or search keywords.</p>
        `;
        releaseNotesList.appendChild(emptyState);
    }
}

// Select a release note update
function selectNote(note, date, link) {
    appState.selectedNote = note;
    appState.selectedDate = date;
    appState.selectedLink = link;
    
    // Highlight active card on left
    highlightSelectedCard();
    
    // Enable Composer UI
    composerEmptyState.classList.add('hidden');
    composerActiveState.classList.remove('hidden');
    
    // Set badge ID in composer meta
    selectedNoteIdBadge.innerText = note.id;
    
    // Set templates and tags selections active
    // Reset hashtags chips
    document.querySelectorAll('.hashtag-chip').forEach(chip => {
        const hashtag = chip.dataset.hashtag;
        if (appState.activeHashtags.has(hashtag)) {
            chip.classList.add('selected');
        } else {
            chip.classList.remove('selected');
        }
    });
    
    // Generate tweet text
    generateAndSetTweet();
}

// Highlight the selected card and remove highlight from others
function highlightSelectedCard() {
    document.querySelectorAll('.update-card').forEach(card => {
        if (card.dataset.id === appState.selectedNote.id) {
            card.classList.add('selected');
            card.querySelector('.action-icon-btn').classList.add('active-tweet');
        } else {
            card.classList.remove('selected');
            card.querySelector('.action-icon-btn').classList.remove('active-tweet');
        }
    });
}

// Deselect note
function deselectNote() {
    appState.selectedNote = null;
    appState.selectedDate = '';
    appState.selectedLink = '';
    
    composerEmptyState.classList.remove('hidden');
    composerActiveState.classList.add('hidden');
    
    document.querySelectorAll('.update-card').forEach(card => {
        card.classList.remove('selected');
        card.querySelector('.action-icon-btn').classList.remove('active-tweet');
    });
}

// Generate the Tweet and populate editor
function generateAndSetTweet() {
    if (!appState.selectedNote) return;
    
    const note = appState.selectedNote;
    const date = appState.selectedDate;
    const link = appState.selectedLink || 'https://cloud.google.com/bigquery/docs/release-notes';
    
    // Build tags string
    const hashtagsArray = Array.from(appState.activeHashtags);
    const hashtagsStr = hashtagsArray.join(' ');
    
    // Get generator
    const generator = TWEET_TEMPLATES[appState.selectedTemplateId];
    const generatedText = generator(note.type, note.text, date, link, hashtagsStr);
    
    // Set text area
    tweetTextarea.value = generatedText;
    
    // Update preview & count
    updateTweetPreview(generatedText);
    updateCharCount(generatedText);
}

// Render dynamic mock tweet card text
function updateTweetPreview(text) {
    // Regex to format URLs and Hashtags in preview (blue colored)
    let formattedText = escapeHtml(text);
    
    // Highlight URLs
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    formattedText = formattedText.replace(urlPattern, '<span class="tweet-url">$1</span>');
    
    // Highlight Hashtags
    const hashtagPattern = /(#[a-zA-Z0-9_]+)/g;
    formattedText = formattedText.replace(hashtagPattern, '<span class="tweet-hashtag">$1</span>');
    
    tweetPreviewText.innerHTML = formattedText || '<span style="color: #71767b; font-style: italic;">Post text is empty...</span>';
}

// Escape HTML utility for preview
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Update Character counts & circular progress bar
function updateCharCount(text) {
    // Calculate length (counting URLs as 23 characters)
    const length = calculateTwitterLength(text);
    charCountText.innerText = `${length} / ${MAX_TWEET_LEN}`;
    
    // Circular progress math
    // radius of our svg is 15.9155, circumference is 2 * pi * r ≈ 100
    const percentage = Math.min(100, (length / MAX_TWEET_LEN) * 100);
    charProgressBar.setAttribute('stroke-dasharray', `${percentage}, 100`);
    
    // Warning thresholds
    charProgressContainer.classList.remove('warning', 'exceeded');
    if (length > MAX_TWEET_LEN) {
        charProgressContainer.classList.add('exceeded');
        tweetBtn.disabled = true;
        tweetBtn.style.opacity = 0.5;
        tweetBtn.style.pointerEvents = 'none';
    } else {
        tweetBtn.disabled = false;
        tweetBtn.style.opacity = 1;
        tweetBtn.style.pointerEvents = 'auto';
        if (length >= MAX_TWEET_LEN - 20) {
            charProgressContainer.classList.add('warning');
        }
    }
}

// Calculate Twitter length with URL normalization
function calculateTwitterLength(text) {
    if (!text) return 0;
    
    // Regex for URLs
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlPattern) || [];
    
    // Remove URLs from string to count the rest
    let textWithoutUrls = text.replace(urlPattern, '');
    
    // Length is remaining text + (23 * number of URLs)
    return textWithoutUrls.length + (urls.length * TWITTER_URL_LEN);
}

// Clipboard copy helper
function copyToClipboard(text, successMessage) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(successMessage);
    }).catch(err => {
        console.error("Clipboard copy failed: ", err);
        // Fallback
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showToast(successMessage);
        } catch (copyErr) {
            showToast("Failed to copy text.");
        }
        document.body.removeChild(textArea);
    });
}

// Export release notes to CSV file
function exportToCsv() {
    if (!appState.releaseNotes || appState.releaseNotes.length === 0) {
        showToast("No release notes available to export.");
        return;
    }
    
    const csvRows = [];
    csvRows.push(['Date', 'Type', 'Text', 'Link']);
    
    appState.releaseNotes.forEach(entry => {
        entry.updates.forEach(update => {
            // Filter by type
            if (appState.filterType !== 'all' && update.type.toLowerCase() !== appState.filterType.toLowerCase()) {
                return;
            }
            // Filter by search query
            if (appState.searchQuery) {
                const textMatch = update.text.toLowerCase().includes(appState.searchQuery);
                const typeMatch = update.type.toLowerCase().includes(appState.searchQuery);
                if (!textMatch && !typeMatch) return;
            }
            
            const escapeCsv = (str) => {
                if (!str) return '';
                // Wrap in double quotes and escape any internal double quotes by doubling them
                return `"${str.replace(/"/g, '""')}"`;
            };
            
            csvRows.push([
                escapeCsv(entry.date),
                escapeCsv(update.type),
                escapeCsv(update.text),
                escapeCsv(entry.link)
            ]);
        });
    });
    
    if (csvRows.length <= 1) {
        showToast("No matching release notes to export.");
        return;
    }
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const dateStr = new Date().toISOString().split('T')[0];
    const typeStr = appState.filterType !== 'all' ? `_${appState.filterType.toLowerCase()}` : '';
    const searchStr = appState.searchQuery ? `_search_${appState.searchQuery.replace(/[^a-z0-9]/gi, '_')}` : '';
    link.setAttribute("download", `bigquery_release_notes_${dateStr}${typeStr}${searchStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`Exported ${csvRows.length - 1} updates to CSV!`);
}

// Toast notification helper
let toastTimeout;
function showToast(msg) {
    toastMessage.innerText = msg;
    toastNotification.classList.remove('hidden');
    
    // Clear previous timeout if exists
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    
    toastTimeout = setTimeout(() => {
        toastNotification.classList.add('hidden');
    }, 2500);
}

// Initialize Theme
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        themeIconSun.classList.add('hidden');
        themeIconMoon.classList.remove('hidden');
        themeToggleText.innerText = 'Dark Mode';
    } else {
        document.body.classList.remove('light-theme');
        themeIconSun.classList.remove('hidden');
        themeIconMoon.classList.add('hidden');
        themeToggleText.innerText = 'Light Mode';
    }
}

// Toggle Theme
function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    if (isLight) {
        localStorage.setItem('theme', 'light');
        themeIconSun.classList.add('hidden');
        themeIconMoon.classList.remove('hidden');
        themeToggleText.innerText = 'Dark Mode';
    } else {
        localStorage.setItem('theme', 'dark');
        themeIconSun.classList.remove('hidden');
        themeIconMoon.classList.add('hidden');
        themeToggleText.innerText = 'Light Mode';
    }
}
