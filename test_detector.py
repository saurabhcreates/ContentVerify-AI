
from pathlib import Path

from PIL import Image
from transformers import pipeline

MODEL_NAME = "delpot/steganograph-ia-detector"


def main():
    print("Loading alternative image detector...")
    print("The first run may download model files.")
    print("Loading on CPU; please be patient.")

    detector = pipeline(
        "image-classification",
        model=MODEL_NAME,
        device=-1,
    )

    print("\nConfigured model labels:")
    print(detector.model.config.id2label)

    while True:
        image_path = input(
            "\nEnter image path (or type exit): "
        ).strip().strip('"')

        if image_path.lower() == "exit":
            break

        path = Path(image_path)

        if not path.is_file():
            print("Image file not found.")
            continue

        try:
            with Image.open(path) as source:
                image = source.convert("RGB")

            predictions = detector(image, top_k=None)

            print("\nPredictions:")
            for item in sorted(
                predictions,
                key=lambda result: result["score"],
                reverse=True,
            ):
                print(
                    f'{item["label"]}: '
                    f'{item["score"]:.4f} '
                    f'({item["score"] * 100:.2f}%)'
                )

        except Exception as exc:
            print(f"Could not analyze image: {exc}")


if __name__ == "__main__":
    main()

