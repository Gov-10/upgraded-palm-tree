import re, hashlib, io, os
from dotenv import load_dotenv
load_dotenv()
import fitz
from PIL import Image
import pytesseract
if os.path.exists(r"C:\Program Files\Tesseract-OCR\tesseract.exe"):
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

def clean(text):
    text = re.sub(r"\s+", " ", text)
    return text.strip().lower()

def extract(file_bytes, file_ext="pdf"):
    text = ""
    if file_ext in ["png", "jpg", "jpeg"]:
        return ""
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page in doc:
            text += f'{page.get_text()}'
    except Exception as e:
        print(f"Error reading PDF text layer: {e}")
    return clean(text)

def extract_ocr(file_bytes, file_ext="pdf"):
    text = ""
    if file_ext in ["png", "jpg", "jpeg"]:
        try:
            image = Image.open(io.BytesIO(file_bytes))
            text = pytesseract.image_to_string(image)
        except Exception as e:
            print(f"Error performing OCR on image: {e}")
    else:
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            for page in doc:
                pix = page.get_pixmap()
                img_bytes = pix.tobytes("png")
                image = Image.open(io.BytesIO(img_bytes))
                page_text = pytesseract.image_to_string(image)
                text += page_text
        except Exception as e:
            print(f"Error performing OCR on PDF: {e}")
    return clean(text)

def extract_csv(file_bytes):
    pass

def hash_text(text):
    return hashlib.sha256(text.encode()).hexdigest()


