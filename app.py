import os
import requests
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# In-memory cache for feed data
feed_cache = {
    'data': None,
    'last_fetched': None
}
CACHE_DURATION = timedelta(minutes=5)
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def rewrite_relative_links(soup):
    """Convert relative links to absolute links pointing to Google Cloud docs."""
    for a in soup.find_all('a', href=True):
        href = a['href']
        if href.startswith('/'):
            a['href'] = 'https://cloud.google.com' + href
    return soup

def parse_release_notes_feed():
    """Fetches the Google BigQuery release notes Atom feed and parses it into structured data."""
    try:
        response = requests.get(FEED_URL, timeout=15)
        if response.status_code != 200:
            return None, f"Failed to fetch feed: HTTP {response.status_code}"
    except Exception as e:
        return None, f"Error fetching feed: {str(e)}"

    try:
        root = ET.fromstring(response.content)
        # Atom feed namespace
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        entries = root.findall('atom:entry', ns)
        
        parsed_entries = []
        
        for idx, entry in enumerate(entries):
            date_str = entry.find('atom:title', ns).text.strip()
            updated_str = entry.find('atom:updated', ns).text.strip()
            
            link_elem = entry.find('atom:link[@rel="alternate"]', ns)
            entry_link = link_elem.get('href') if link_elem is not None else ""
            
            content_elem = entry.find('atom:content', ns)
            content_html = content_elem.text if content_elem is not None else ""
            
            # Parse individual updates from content HTML
            soup = BeautifulSoup(content_html, 'html.parser')
            soup = rewrite_relative_links(soup)
            
            updates = []
            current_type = None
            current_elements = []
            
            for child in soup.children:
                if child.name == 'h3':
                    # Save the previous update if it exists
                    if current_elements:
                        update_html = "".join(str(c) for c in current_elements).strip()
                        update_soup = BeautifulSoup(update_html, 'html.parser')
                        update_text = update_soup.get_text().strip()
                        
                        updates.append({
                            'id': f"update_{idx}_{len(updates)}",
                            'type': current_type or 'General',
                            'html': update_html,
                            'text': update_text
                        })
                    current_type = child.get_text().strip()
                    current_elements = []
                elif child.name is not None or (isinstance(child, str) and child.strip()):
                    current_elements.append(child)
            
            # Append the final update in this entry
            if current_elements:
                update_html = "".join(str(c) for c in current_elements).strip()
                update_soup = BeautifulSoup(update_html, 'html.parser')
                update_text = update_soup.get_text().strip()
                
                updates.append({
                    'id': f"update_{idx}_{len(updates)}",
                    'type': current_type or 'General',
                    'html': update_html,
                    'text': update_text
                })
            
            parsed_entries.append({
                'id': f"entry_{idx}",
                'date': date_str,
                'updated': updated_str,
                'link': entry_link,
                'updates': updates
            })
            
        return parsed_entries, None
    except Exception as e:
        return None, f"Error parsing XML: {str(e)}"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    now = datetime.now()
    
    # Check if cache is valid
    if (not force_refresh and 
        feed_cache['data'] is not None and 
        feed_cache['last_fetched'] is not None and 
        (now - feed_cache['last_fetched']) < CACHE_DURATION):
        
        return jsonify({
            'success': True,
            'source': 'cache',
            'last_fetched': feed_cache['last_fetched'].strftime('%Y-%m-%d %H:%M:%S'),
            'data': feed_cache['data']
        })
        
    # Fetch and parse
    data, error = parse_release_notes_feed()
    if error:
        # If there's an error but we have cached data, fall back to cache
        if feed_cache['data'] is not None:
            return jsonify({
                'success': True,
                'source': 'cache_fallback',
                'error': error,
                'last_fetched': feed_cache['last_fetched'].strftime('%Y-%m-%d %H:%M:%S'),
                'data': feed_cache['data']
            })
        return jsonify({
            'success': False,
            'error': error
        }), 500
        
    # Update cache
    feed_cache['data'] = data
    feed_cache['last_fetched'] = now
    
    return jsonify({
        'success': True,
        'source': 'live',
        'last_fetched': now.strftime('%Y-%m-%d %H:%M:%S'),
        'data': data
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
