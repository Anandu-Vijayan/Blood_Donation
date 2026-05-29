from PIL import Image, ImageDraw
import sys

try:
    # Open the original image
    img = Image.open("apps/mobile/assets/logo.png").convert("RGBA")
    width, height = img.size

    # The user provided image is 512x512. It has a shadow on the outside.
    # We want to crop out the shadow, leaving just the inner circle/icon.
    # The actual box with shadow seems to start around pixel 10, but the 
    # inner circle might be smaller. Let's crop a tight 420x420 square from the center.
    crop_size = 420
    left = (width - crop_size) // 2
    top = (height - crop_size) // 2
    right = left + crop_size
    bottom = top + crop_size

    cropped = img.crop((left, top, right, bottom))

    # Resize it back to 512x512 to fit the icon size nicely, without the shadow
    resized = cropped.resize((512, 512), Image.Resampling.LANCZOS)

    # Save as the new logo
    resized.save("apps/mobile/assets/logo.png")
    print("Cropped and saved.")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
