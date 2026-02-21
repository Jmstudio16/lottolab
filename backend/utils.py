import random
import string
import qrcode
import io
import base64
from datetime import datetime, timezone

def generate_id(prefix: str = "") -> str:
    timestamp = int(datetime.now(timezone.utc).timestamp() * 1000)
    random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"{prefix}{timestamp}{random_suffix}" if prefix else f"{timestamp}{random_suffix}"

def generate_ticket_code() -> str:
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=12))

def generate_verification_code() -> str:
    return ''.join(random.choices(string.digits, k=12))

def generate_qr_code(data: str) -> str:
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    img_str = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"

def get_current_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()
