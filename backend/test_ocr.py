from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import pytesseract

IMAGE_PATH = "test_prescription.jpg"

image = Image.open(IMAGE_PATH).convert("L")

# Upscale
image = image.resize(
    (image.width * 3, image.height * 3)
)

# Contrast + sharpen
image = ImageEnhance.Contrast(image).enhance(2.5)
image = image.filter(ImageFilter.SHARPEN)

# Create two versions
threshold = image.point(lambda p: 255 if p > 160 else 0)

configs = [
    ("PSM 6", image, "--oem 3 --psm 6"),
    ("PSM 11", image, "--oem 3 --psm 11"),
    ("Threshold PSM 6", threshold, "--oem 3 --psm 6"),
    ("Threshold PSM 11", threshold, "--oem 3 --psm 11"),
]

for name, img, config in configs:
    print("\n" + "=" * 60)
    print(name)
    print("=" * 60)

    text = pytesseract.image_to_string(img, config=config)
    print(text)