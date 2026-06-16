# BigQuery Release Pulse

BigQuery Release Pulse is a modern Flask-based web application that aggregates, categorizes, and formats Google Cloud BigQuery release notes into ready-to-share social media updates for X / Twitter.

## 🚀 Features

- **Automated Aggregation**: Pulls live release updates directly from Google Cloud's official BigQuery Atom feed.
- **Smart Parsing**: Uses BeautifulSoup to convert relative document links to absolute Google Cloud documentation references and extracts updates by category (*Feature*, *Issue*, *Changed*, *Fixed*, *Deprecation*).
- **Caching Mechanism**: Features an in-memory caching system (refreshing every 5 minutes) to protect Google's servers from redundant traffic.
- **Interactive Tweet Composer**: Includes three custom layout templates, dynamic hashtag selection, and auto-generated share cards.
- **Twitter URL length Validation**: Counts URLs as exactly 23 characters matching X's standards, complete with a circular visual indicator.
- **Sleek Glassmorphic Dark UI**: Premium layout styled with modern CSS variables, responsive typography, and glowing gradients.

---

## 🛠️ Tech Stack

- **Backend**: Python 3, Flask, Requests, Beautiful Soup 4, XML ElementTree
- **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript
- **API integration**: X/Twitter Web Intent

---

## 📂 Project Structure

```text
bq-release-notes/
├── app.py                 # Flask server, parsing logic & in-memory cache
├── requirements.txt       # Python dependency list
├── .gitignore             # Git ignore patterns
├── templates/
│   └── index.html         # Frontend HTML structure
└── static/
    ├── css/
    │   └── styles.css     # Dark mode CSS with glowing blobs & flex layouts
    └── js/
        └── main.js        # DOM interactivity, tweet builder, validation
```

---

## 💻 Getting Started

### Prerequisites

Make sure you have **Python 3.8+** installed.

### Installation & Run

1. **Clone the repository**:
   ```bash
   git clone https://github.com/katarzyn12/Kateryna-event-talks-app.git
   cd Kateryna-event-talks-app
   ```

2. **Create and activate a virtual environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install the dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the application**:
   ```bash
   python app.py
   ```

5. **Open in browser**:
   Navigate to [http://localhost:5001](http://localhost:5001) in your browser.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to open issues or submit pull requests.
