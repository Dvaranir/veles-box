import os
import re
import logging
import functools
import requests

from set_all_songs_favorite import favorite_all_songs
from dotenv import load_dotenv
from mutagen.easyid3 import EasyID3
from mutagen.mp3 import MP3
from mutagen.id3 import ID3, APIC, error
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    ReplyKeyboardRemove,
)
from telegram.ext import (
    ApplicationBuilder,
    ContextTypes,
    MessageHandler,
    filters,
    CallbackQueryHandler,
    CommandHandler,
    ConversationHandler,
)
from yt_dlp import YoutubeDL

dotenv_path = os.path.join(os.path.dirname(__file__), '../.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)

TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_USERS_WHITELIST = os.getenv("TELEGRAM_USERS_WHITELIST", "")
WHITELIST = [user.strip() for user in TELEGRAM_USERS_WHITELIST.split(",") if user.strip()]

if not TELEGRAM_TOKEN:
    raise ValueError("TELEGRAM_TOKEN is required")

if not WHITELIST:
    raise ValueError("TELEGRAM_USERS_WHITELIST is required")

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

TEMP_DIR = "/bot/temp"
MUSIC_DIR = "/bot/music"

(
    ASK_RENAME,
    ASK_METADATA_CHANGE,
    ASK_FOR_COVER,
    ASK_METADATA_CUSTOM,
    
    GET_NEW_NAME,
    GET_METADATA_CREDENTIALS,
    GET_COVER,
    GET_METADATA_CUSTOM,
    
    SAVE_TEMP_TO_MUSIC,
    EXIT
) = range(10)

def main():
    application = ApplicationBuilder().token(TELEGRAM_TOKEN).build()

    conv_handler = ConversationHandler(
        entry_points=[MessageHandler(filters.AUDIO, handle_message)],
        states={
            ASK_RENAME: [CallbackQueryHandler(rename_query_handler)],
            ASK_METADATA_CHANGE: [CallbackQueryHandler(metadata_change_query_handler)],
            ASK_FOR_COVER: [CallbackQueryHandler(cover_change_query_handler)],
            ASK_METADATA_CUSTOM: [CallbackQueryHandler(metadata_custom_change_processor)],
            
            GET_NEW_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_new_filename)],
            GET_METADATA_CREDENTIALS: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_metadata_credentials)],
            GET_COVER: [MessageHandler(filters.PHOTO | (filters.TEXT & ~filters.COMMAND), receive_cover)],
            GET_METADATA_CUSTOM: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_metadata_custom)],
            
            SAVE_TEMP_TO_MUSIC: [save_temp_file_to_music_dir],
        },
        fallbacks=[CommandHandler('start', start)],
        allow_reentry=True,
    )

    application.add_handler(conv_handler)

    application.add_handler(MessageHandler(filters.TEXT & ~filters.AUDIO, handle_message))

    logger.info("Bot is starting...")
    application.run_polling()

def is_user_allowed(user_id: str) -> bool:
    return user_id in WHITELIST

def authorized(func):
    @functools.wraps(func)
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
        user_id = str(update.effective_user.id)
        if not is_user_allowed(user_id):
            logger.info(f"Unauthorized access attempt by user {user_id}.")
            await update.message.reply_text("You are not authorized to use this bot.")
            return ConversationHandler.END
        return await func(update, context, *args, **kwargs)
    return wrapper

def sanitize_filename(name: str) -> str:
    """Remove characters not allowed in filenames."""
    return re.sub(r'[<>:"/\\|?*]', '_', name)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Hello! I'm your music bot. Send me a music file or a YouTube URL.")

@authorized
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.audio:
        audio = update.message.audio
        original_filename = sanitize_filename(audio.file_name)
        temp_file_path = os.path.join(TEMP_DIR, original_filename)
        
        sent_message = await update.message.reply_text(
            f"Saving file `{original_filename}` to temp directory",
            parse_mode='Markdown'
        )
        
        file = await context.bot.get_file(audio.file_id)
        await file.download_to_drive(temp_file_path)
        
        context.user_data['temp_file_path'] = temp_file_path
        context.user_data['original_file_extension'] = os.path.splitext(original_filename)[1]
        context.user_data['target_filename_full'] = original_filename

        await sent_message.edit_text(
            f"Do you want to rename the file `{original_filename}`?",
            reply_markup=gen_yes_no_reset_keyboard(),
            parse_mode='Markdown'
        )
        
        return ASK_RENAME

    elif update.message.text and "https://" in update.message.text:
        urls = re.findall(r'https?://\S+', update.message.text)
        url = urls[0]
        if "youtube.com" in url or "youtu.be" in url:
            video_id = extract_youtube_id(url)
            if not video_id:
                await update.message.reply_text(f"URL doesn't have a valid YouTube video ID: {url}")
                return
                
            is_downloaded = await download_youtube_audio(update, context, video_id)
            
            if is_downloaded:
                message = f"Downloaded and saved to temp directory\nDo you want to try to find metadata for `{context.user_data['target_filename_full']}`?"
                logger.info(message)
                await update.message.reply_text(
                    text=message,
                    parse_mode='Markdown',
                    reply_markup=gen_yes_no_reset_keyboard(),
                )
                
                return ASK_METADATA_CHANGE
            else:
                return ConversationHandler.END
                
        else:
            await update.message.reply_text(
                    text='Unsupported URL. Please send a YouTube URL.',
                    parse_mode='Markdown',
                )

@authorized
async def rename_query_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    choice = query.data
   
    if choice == 'no':
        await query.edit_message_text(
                f"Do you want to try to find metadata for `{context.user_data['target_filename_full']}`?",
                reply_markup=gen_yes_no_reset_keyboard(),
                parse_mode='Markdown'
        )
        return ASK_METADATA_CHANGE

    elif choice == 'yes':
        await query.edit_message_text("Please send the new filename (without extension).")
        return GET_NEW_NAME

    return ConversationHandler.END

@authorized
async def metadata_change_query_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    choice = query.data
   
    if choice == 'no':
        return await ask_for_cover_block(update)

    elif choice == 'yes':
        await query.edit_message_text("Please send author and title of this composition in format `AUTHOR - TITLE`.")
        return GET_METADATA_CREDENTIALS

    return ConversationHandler.END

@authorized
async def metadata_custom_change_processor(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    choice = query.data
   
    if choice == 'no':
        return await ask_for_cover_block(update)

    elif choice == 'yes':
        await query.edit_message_text("Please send metadate for this composition in format `AUTHOR - TITLE - ALBUM`.")
        return GET_METADATA_CUSTOM

    return ConversationHandler.END

@authorized
async def cover_change_query_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    choice = query.data
   
    if choice == 'yes':
        await query.edit_message_text("Please send the URL of the cover image or image itselt.")
        return GET_COVER

    await save_temp_file_to_music_dir(update, context)

@authorized
async def receive_new_filename(update: Update, context: ContextTypes.DEFAULT_TYPE):
    new_filename = sanitize_filename(update.message.text)
    
    ext = context.user_data['original_file_extension']
    context.user_data['target_filename_full'] = f"{new_filename}{ext}"
    
    try:
        await update.message.reply_text(
                f"Do you want to try to find metadata for {new_filename}{ext}?",
                reply_markup=gen_yes_no_reset_keyboard(),
                parse_mode='Markdown'
        )
        return ASK_METADATA_CHANGE
        
    except Exception as e:
        logger.error(f"Error renaming file: {e}")
        await update.message.reply_text("An error occurred while renaming the file.")
    
    return ConversationHandler.END

@authorized
async def receive_metadata_credentials(update: Update, context: ContextTypes.DEFAULT_TYPE):
    author, title = update.message.text.split("-")
    
    author = author.strip()
    title = title.strip()
    
    metadata = fetch_metadata_from_musicbrainz(author, title)
    
    if metadata:
        update_mp3_metadata(context.user_data.get('temp_file_path'), metadata)
        await update.message.reply_text(f"Metadata found and saved to file {context.user_data.get('target_filename_full')}")
    else:
        await update.message.reply_text(
                f"Metadata not found, do you want to provide metadata by yourself?",
                reply_markup=gen_yes_no_reset_keyboard(),
                parse_mode='Markdown'
        )
        return ASK_METADATA_CUSTOM
    
    return await ask_for_cover_block(update)

@authorized
async def receive_metadata_custom(update: Update, context: ContextTypes.DEFAULT_TYPE):
    author, title, album = update.message.text.split("-")
    
    metadata = {
        'title': title.strip(),
        'artist': author.strip(),
        'album': album.strip(),
    }
    
    update_mp3_metadata(context.user_data.get('temp_file_path'), metadata)
    await update.message.reply_text(f"Metadata saved to file {context.user_data.get('target_filename_full')}")
    
    return await ask_for_cover_block(update)

@authorized
async def receive_cover(update: Update, context: ContextTypes.DEFAULT_TYPE):
    image_filename = f"cover_{os.urandom(16).hex()}.jpg"
    image_file_path = os.path.join(TEMP_DIR, image_filename)
    
    if update.message.photo:
        photo = update.message.photo[-1]
        image_id = photo.file_id
        image_file = await context.bot.get_file(image_id)
        await image_file.download_to_drive(image_file_path)
        
    elif update.message.text:
        cover_url = update.message.text
        download_image(cover_url, image_file_path)
        
    if os.path.exists(image_file_path):
        inject_cover(context.user_data.get('temp_file_path'), image_file_path)
        os.remove(image_file_path)
        await update.message.reply_text("Cover image added to the file.")
    else:
        await update.message.reply_text("Failed to download the cover image.")
    
    await save_temp_file_to_music_dir(update, context)

async def download_youtube_audio(update: Update, context: ContextTypes.DEFAULT_TYPE, video_id: str):
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(TEMP_DIR, '%(title)s.%(ext)s'),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '320',
        }],
        'quiet': True,
    }
    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=True)
            title = sanitize_filename(info.get('title', 'audio'))
            filename = f"{title}.mp3"
            context.user_data['target_filename_full'] = filename
            
            return True
            
    except Exception as e:
        logger.error(f"Error downloading YouTube audio: {e}")
        await update.message.reply_text(
                text=f"Failed to download YouTube audio: {e}",
                parse_mode='Markdown',
            )
        

def extract_youtube_id(url: str) -> str:
    """Extract YouTube video ID from URL."""
    
    regex = r'(?:v=|youtu\.be/)([^&\n?#]+)'
    match = re.search(regex, url)
    if match:
        return match.group(1)
    return ""
    
def download_image(url, save_path):
    """
    Download an image from a URL and save it to a file.

    Args:
        url (str): URL of the image.
        save_path (str): Path to save the downloaded image.
    """
    response = requests.get(url, stream=True)
    if response.status_code == 200:
        with open(save_path, 'wb') as file:
            for chunk in response.iter_content(1024):
                file.write(chunk)
        print(f"Image downloaded to {save_path}")
    else:
        raise Exception(f"Failed to download image: {response.status_code}")
    
def inject_cover(file_path, image_path):
    """
    Inject a cover image into an MP3 file.

    Args:
        file_path (str): Path to the MP3 file.
        image_path (str): Path to the cover image.
    """
    try:
        audio = MP3(file_path, ID3=ID3)

        if audio.tags is None:
            audio.add_tags()

        with open(image_path, "rb") as img:
            audio.tags.add(
                APIC(
                    encoding=3,
                    mime="image/jpeg",
                    type=3,
                    desc="Cover",
                    data=img.read(),
                )
            )

        audio.save()
        print(f"Cover image added to {file_path}")
    except error as e:
        print(f"An error occurred: {e}")
        
async def pick_available_filename(filename: str, ext: str, update: Update):
    target_file_path = os.path.join(MUSIC_DIR, filename)
    
    if os.path.exists(target_file_path):
        for i in range(1, 100):
            new_file_name = f"{filename}_{i:03d}{ext}"
            file_path = os.path.join(MUSIC_DIR, new_file_name)
            if not os.path.exists(file_path):
                return new_file_name
        else:
            await update.message.reply_text("Failed to find an available filename. Please try again.")
            return ConversationHandler.END
    else:
        return filename
    
def fetch_metadata_from_musicbrainz(artist, title):
    """Fetch metadata from MusicBrainz API."""
    base_url = "https://musicbrainz.org/ws/2/recording/"
    params = {
        "query": f"artist:{artist} AND recording:{title}",
        "fmt": "json",
    }
    response = requests.get(base_url, params=params)
    if response.status_code == 200:
        data = response.json()
        if data["recordings"]:
            recording = data["recordings"][0]
            return {
                "title": recording.get("title", ""),
                "artist": recording["artist-credit"][0]["artist"].get("name", ""),
                "album": recording.get("releases", [{}])[0].get("title", ""),
            }
    return None

def update_mp3_metadata(file_path, metadata):
    """Inject metadata into an MP3 file."""
    audio = EasyID3(file_path)
    audio["title"] = metadata.get("title", "")
    audio["artist"] = metadata.get("artist", "")
    audio["album"] = metadata.get("album", "")
    audio.save()
    
def gen_yes_no_reset_keyboard():
    keyboard = [
        [InlineKeyboardButton("Yes", callback_data='yes')],
        [InlineKeyboardButton("No", callback_data='no')],
        [InlineKeyboardButton("Reset", callback_data='reset')],
    ]
    return InlineKeyboardMarkup(keyboard)

async def ask_for_cover_block(update: Update):
    message_data = {
        'text': "Do you want to add cover?",
        'reply_markup': gen_yes_no_reset_keyboard(),
        'parse_mode': 'Markdown'
    }
    
    query = update.callback_query
    
    if query:
        await query.edit_message_text(**message_data)
    else:
        await update.message.reply_text(**message_data)
        
    return ASK_FOR_COVER

async def metadata_change_processor(update: Update, context: ContextTypes.DEFAULT_TYPE):
    choice = update.callback_query.data
    if choice == 'yes':
        await update.message.reply_text("Please send the new metadata in the format `Artist - Title`.")
        return GET_METADATA_CREDENTIALS
    
    elif choice == 'no':
        return await ask_for_cover_block(update)
    
    return ConversationHandler.END
    
@authorized
async def save_temp_file_to_music_dir(update: Update, context: ContextTypes.DEFAULT_TYPE):
    temp_file_path = context.user_data.get('temp_file_path')
    target_filename = context.user_data.get('target_filename_full')
    _, ext = os.path.splitext(target_filename)
    
    new_filename = await pick_available_filename(target_filename, ext, update)
    new_file_path = os.path.join(MUSIC_DIR, new_filename)
    
    os.rename(temp_file_path, new_file_path)
    
    await update.message.reply_text(f"Saved audio file as `{new_filename}`", parse_mode='Markdown')
    
    favorite_all_songs()

if __name__ == '__main__':
    main()