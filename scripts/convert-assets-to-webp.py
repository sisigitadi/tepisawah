"""
convert-assets-to-webp.py
Compresses large static images in apps/web/public to WebP format.
Significantly saves storage and network bandwidth on mobile devices.
"""
import os
from PIL import Image

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB_PUBLIC = os.path.join(BASE_DIR, "apps", "web", "public")
ADMIN_PUBLIC = os.path.join(BASE_DIR, "apps", "admin", "public")

def convert_to_webp(src_path, dest_path, quality=82, max_dim=None):
    if not os.path.exists(src_path):
        print(f"Skipping (not found): {src_path}")
        return
    with Image.open(src_path) as img:
        # Convert RGBA or RGB
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            img = img.convert("RGBA")
        else:
            img = img.convert("RGB")
        
        if max_dim:
            w, h = img.size
            if max(w, h) > max_dim:
                scale = max_dim / float(max(w, h))
                new_w, new_h = int(w * scale), int(h * scale)
                img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        img.save(dest_path, "WEBP", quality=quality, method=6)
        src_size = os.path.getsize(src_path)
        dest_size = os.path.getsize(dest_path)
        saving_pct = (1 - (dest_size / src_size)) * 100
        print(f"Converted: {os.path.basename(src_path)} ({src_size/1024:.1f} KB) -> {os.path.basename(dest_path)} ({dest_size/1024:.1f} KB) [-{saving_pct:.1f}%]")

def main():
    print("=== Tepi Sawah Asset Compression to WebP ===")
    
    # 1. Panorama
    panorama_png = os.path.join(WEB_PUBLIC, "sawah-panorama.png")
    panorama_webp = os.path.join(WEB_PUBLIC, "sawah-panorama.webp")
    convert_to_webp(panorama_png, panorama_webp, quality=82, max_dim=1920)
    
    # 2. About Saung
    saung_jpg = os.path.join(WEB_PUBLIC, "about-saung.jpg")
    saung_webp = os.path.join(WEB_PUBLIC, "about-saung.webp")
    convert_to_webp(saung_jpg, saung_webp, quality=82, max_dim=1280)
    
    # 3. Gallery photos
    gallery_dir = os.path.join(WEB_PUBLIC, "gallery")
    if os.path.exists(gallery_dir):
        for fname in os.listdir(gallery_dir):
            if fname.lower().endswith((".jpg", ".jpeg", ".png")):
                base_name, _ = os.path.splitext(fname)
                src = os.path.join(gallery_dir, fname)
                dest = os.path.join(gallery_dir, f"{base_name}.webp")
                convert_to_webp(src, dest, quality=82, max_dim=1200)
                
                # Copy to admin/public/gallery as well
                admin_gal = os.path.join(ADMIN_PUBLIC, "gallery")
                os.makedirs(admin_gal, exist_ok=True)
                admin_dest = os.path.join(admin_gal, f"{base_name}.webp")
                if os.path.exists(dest):
                    with open(dest, "rb") as sf, open(admin_dest, "wb") as df:
                        df.write(sf.read())
                        
    # 4. Also copy webp panorama and saung to apps/order and apps/staff if needed
    for sub in ["order", "staff", "admin"]:
        dest_pan = os.path.join(BASE_DIR, "apps", sub, "public", "sawah-panorama.webp")
        if os.path.exists(panorama_webp):
            with open(panorama_webp, "rb") as sf, open(dest_pan, "wb") as df:
                df.write(sf.read())

    print("\nCompression completed successfully.")

if __name__ == "__main__":
    main()
