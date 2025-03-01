import os
import requests
import logging

from dotenv import load_dotenv

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

dotenv_path = os.path.join(os.path.dirname(__file__), '../.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)

BASE_URL = os.getenv("NAVIDROME_BASE_URL")
USERNAME = os.getenv("NAVIDROME_USERNAME")
PASSWORD = os.getenv("NAVIDROME_PASSWORD")
API_VERSION = "1.16.1"
CLIENT_NAME = "PythonScript"
TOKEN = None

if(not BASE_URL or not USERNAME or not PASSWORD):
    logger.error("Please set the environment variables NAVIDROME_BASE_URL, NAVIDROME_USERNAME and NAVIDROME_PASSWORD.")
    exit()

def get_token():
    url = f"{BASE_URL}/auth/login"
    
    data = {
        "username": USERNAME,
        "password": PASSWORD
    }
    
    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            token = response.json().get("token")
            if token:
                logger.info("Token retrieved successfully.")
                return token
            else:
                logger.error("Token not found in response.")
                return None
        else:
            logger.error(f"Error retrieving token: {response.status_code} - {response.text}")
            return None
    except requests.exceptions.RequestException as e:
        logger.error(f"Request exception: {e}")
        return None
    except ValueError as e:
        logger.error(f"JSON decode error: {e}")
        return None

def get_songs():
    """
    Fetch all songs from the Navidrome library.
    """
    
    TOKEN = get_token()
    
    url = f"{BASE_URL}/api/song"
    headers = {
        "x-nd-authorization": f"Bearer {TOKEN}"
    }
    params = {
        "_start": 0,
        "_end": 99999,
        "_order": "ASC",
        "_sort": "title"
    }
    
    try:
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code == 200:
            songs = response.json()
            logger.info(f"Fetched {len(songs)} songs.")
            return songs
        else:
            logger.error(f"Error fetching songs: {response.status_code} - {response.text}")
            return []
    except requests.exceptions.RequestException as e:
        logger.error(f"Request exception: {e}")
        return []
    except ValueError as e:
        logger.error(f"JSON decode error: {e}")
        return []

def mark_as_favorite(song_id):
    """
    Mark a song as favorite.
    """
    url = f"{BASE_URL}/rest/star"
    params = {
        "v": API_VERSION,
        "c": CLIENT_NAME,
        "f": "json",
        "u": USERNAME,
        "p": PASSWORD,
        "id": song_id,
    }
    try:
        response = requests.get(url, params=params)
        
        if response.status_code == 200:
            data = response.json()
            
            if data["subsonic-response"]["status"] == "ok":
                logger.info(f"Song {song_id} marked as favorite.")
            else:
                logger.warning(f"Song {song_id} was not marked as favorite.")
        else:
            logger.error(f"Error marking song {song_id} as favorite: {response.status_code} - {response.text}")
    except requests.exceptions.RequestException as e:
        logger.error(f"Request exception for song {song_id}: {e}")
    except ValueError as e:
        logger.error(f"JSON decode error for song {song_id}: {e}")

def mark_as_unfavorite(song_id):
    """
    Mark a song as favorite.
    """
    url = f"{BASE_URL}/rest/unstar"
    params = {
        "v": API_VERSION,
        "c": CLIENT_NAME,
        "f": "json",
        "u": USERNAME,
        "p": PASSWORD,
        "id": song_id,
    }
    try:
        response = requests.get(url, params=params)
        
        if response.status_code == 200:
            data = response.json()
            
            if data["subsonic-response"]["status"] == "ok":
                logger.info(f"Song {song_id} marked as unfavorite.")
            else:
                logger.warning(f"Song {song_id} was not marked as unfavorite.")
        else:
            logger.error(f"Error marking song {song_id} as unfavorite: {response.status_code} - {response.text}")
    except requests.exceptions.RequestException as e:
        logger.error(f"Request exception for song {song_id}: {e}")
    except ValueError as e:
        logger.error(f"JSON decode error for song {song_id}: {e}")

def favorite_all_songs():
    """
    Mark all songs as favorite if not already marked.
    """
    songs = get_songs()
    if not songs:
        logger.info("No songs found.")
        return

    for song in songs:
        song_id = song.get("id")
        if not song_id:
            logger.warning("Song without an ID encountered. Skipping.")
            continue

        # The 'starred' key indicates if the song is already favorited
        if song.get("starred", False):
            logger.info(f"Skipping song {song_id} (already favorited).")
            continue

        mark_as_favorite(song_id)

def unfavorite_all_songs():
    """
    Mark all songs as unfavorite if not already marked.
    """
    songs = get_songs()
    if not songs:
        logger.info("No songs found.")
        return

    for song in songs:
        song_id = song.get("id")
        if not song_id:
            logger.warning("Song without an ID encountered. Skipping.")
            continue

        # The 'starred' key indicates if the song is already favorited
        if not song.get("starred", False):
            logger.info(f"Skipping song {song_id} (already unfavorited).")
            continue

        mark_as_unfavorite(song_id)
        
unfavorite_all_songs()
