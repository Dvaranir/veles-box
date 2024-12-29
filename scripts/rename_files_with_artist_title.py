import os
import re
from mutagen import File

def sanitize_filename(name: str) -> str:
    """Remove characters not allowed in filenames."""
    return re.sub(r'[<>:"/\\|?*]', '_', name)

def rename_files_in_directory(directory: str):
    for entry in os.scandir(directory):
        if entry.is_file():
            audio = File(entry.path)
            if not audio:
                continue

            artist = audio.tags.get('TPE1') or audio.tags.get('artist')
            title = audio.tags.get('TIT2') or audio.tags.get('title')
            if not artist or not title:
                continue

            artist_str = str(artist[0]) if isinstance(artist, list) else str(artist)
            title_str = str(title[0]) if isinstance(title, list) else str(title)

            _, ext = os.path.splitext(entry.name)
            new_name = f"{sanitize_filename(artist_str)} - {sanitize_filename(title_str)}{ext}"
            target_path = os.path.join(directory, new_name)

            if os.path.exists(target_path) and target_path != entry.path:
                for i in range(1, 10):
                    alt_name = f"{sanitize_filename(artist_str)} - {sanitize_filename(title_str)}_{i:02d}{ext}"
                    alt_path = os.path.join(directory, alt_name)
                    if not os.path.exists(alt_path):
                        target_path = alt_path
                        break

            if target_path != entry.path:
                os.rename(entry.path, target_path)

if __name__ == "__main__":
    rename_files_in_directory("../navidrome/music")