import os
import pickle
from typing import Tuple, List

# TensorFlow and dependencies - required for ML model
from tensorflow.keras.models import load_model
import numpy as np
from PIL import Image


class MLModel:
    """Helper to load a Keras model and class mapping and run image predictions."""
    
    # Plant Disease Class Names (38 classes from PlantVillage dataset)
    DISEASE_CLASS_NAMES = [
        "Pepper__bell___Bacterial_spot",
        "Pepper__bell___healthy", 
        "Potato___Early_blight",
        "Potato___Late_blight",
        "Potato___healthy",
        "Tomato_Bacterial_spot",
        "Tomato_Early_blight",
        "Tomato_Late_blight",
        "Tomato_Leaf_Mold",
        "Tomato_Septoria_leaf_spot",
        "Tomato_Spider_mites_Two_spotted_spider_mite",
        "Tomato__Target_Spot",
        "Pepper Bell Bacterial Spot",
        "Pepper Bell Healthy",
        "Potato Early Blight",
        "Potato Late Blight",
        "Potato Healthy",
        "Tomato Bacterial Spot",
        "Tomato Early Blight",
        "Tomato Late Blight",
        "Tomato Leaf Mold",
        "Tomato Septoria Leaf Spot",
        "Tomato Spider Mites (Two-Spotted Spider Mite)",
        "Tomato Target Spot",
        "Tomato Yellow Leaf Curl Virus",
        "Tomato Mosaic Virus",
        "Tomato Healthy"
    ]

    def __init__(self, model_path: str, classes_path: str = None, target_size: Tuple[int, int] = (224, 224)):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found: {model_path}")

        self.model = load_model(model_path)
        self.target_size = target_size

        # Load classes mapping (pickle) if provided
        self.classes = None
        if classes_path and os.path.exists(classes_path):
            try:
                with open(classes_path, 'rb') as f:
                    loaded_classes = pickle.load(f)
                print(f" Loaded data from {classes_path}")
                print(f"   Type: {type(loaded_classes)}")
                
                # Check if loaded classes are valid (not just numbers)
                if isinstance(loaded_classes, list):
                    # Check if list contains actual names or just indices
                    if loaded_classes and isinstance(loaded_classes[0], str) and not loaded_classes[0].isdigit():
                        self.classes = loaded_classes
                        print(f"   ✓ Using {len(self.classes)} class names from pickle file")
                    else:
                        print(f"    Pickle contains invalid data (numbers/indices), using DISEASE_CLASS_NAMES")
                        self.classes = self.DISEASE_CLASS_NAMES
                elif isinstance(loaded_classes, dict):
                    # Check if dict values are actual names
                    sample_val = next(iter(loaded_classes.values()), None)
                    if sample_val and isinstance(sample_val, str) and not sample_val.isdigit():
                        self.classes = loaded_classes
                        print(f"   ✓ Using {len(self.classes)} class names from pickle dict")
                    else:
                        print(f"    Pickle dict contains invalid data, using DISEASE_CLASS_NAMES")
                        self.classes = self.DISEASE_CLASS_NAMES
                else:
                    print(f"    Unknown pickle format, using DISEASE_CLASS_NAMES")
                    self.classes = self.DISEASE_CLASS_NAMES
                    
            except Exception as e:
                print(f" Failed to load classes from {classes_path}: {e}")
                print(f"   Using DISEASE_CLASS_NAMES")
                self.classes = None
        
        # Use DISEASE class names if no valid mapping loaded
        if self.classes is None:
            print(" Using DISEASE_CLASS_NAMES for disease labels")
            self.classes = self.DISEASE_CLASS_NAMES
        
        print(f" ML Model ready with {len(self.classes) if isinstance(self.classes, (list, dict)) else 'unknown'} disease classes")

        # Normalize flag - assume model expects 0-1 range
        self._scale_0_1 = True

    def _preprocess(self, image_path: str):
        img = Image.open(image_path).convert('RGB')
        img = img.resize(self.target_size)
        arr = np.asarray(img).astype('float32')
        if self._scale_0_1:
            arr = arr / 255.0
        return arr

    def predict_image(self, image_path: str, top_k: int = 3) -> List[Tuple[str, float]]:
        """Predict the image and return a list of (label, confidence) tuples sorted by confidence.

        If classes mapping is not available, labels will be from DISEASE_CLASS_NAMES.
        """
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")

        arr = self._preprocess(image_path)
        inp = np.expand_dims(arr, axis=0)

        preds = self.model.predict(inp)

        # Handle models that return logits or probabilities
        preds = np.asarray(preds).squeeze()
        if preds.ndim == 0:
            # single-value output
            preds = np.array([preds])

        # Ensure 1D vector
        if preds.ndim > 1:
            preds = preds.ravel()

        # convert to probabilities if necessary
        if preds.max() > 1.0 or preds.min() < 0.0:
            # try softmax
            try:
                exp = np.exp(preds - np.max(preds))
                preds = exp / exp.sum()
            except Exception:
                pass

        # Get top_k indices
        idxs = np.argsort(preds)[::-1][:top_k]
        results = []
        for i in idxs:
            label = None
            if self.classes:
                # classes can be list or dict
                if isinstance(self.classes, dict):
                    label = self.classes.get(i, self.classes.get(str(i), f"Class {i}"))
                elif isinstance(self.classes, list):
                    if i < len(self.classes):
                        label = self.classes[i]
                    else:
                        label = f"Class {i}"
                else:
                    label = f"Class {i}"
            else:
                label = f"Class {i}"

            confidence = float(preds[i])
            results.append((label, confidence))
            
        print(f" Prediction results for {os.path.basename(image_path)}:")
        for label, conf in results:
            print(f"   {label}: {conf*100:.1f}%")

        return results
    
    def get_plant_type(self, label: str) -> str:
        """Extract plant type from disease label"""
        label_lower = label.lower()
        if 'potato' in label_lower:
            return 'Potato'
        elif 'tomato' in label_lower:
            return 'Tomato'
        elif 'pepper' in label_lower or 'bell' in label_lower:
            return 'Pepper'
        return 'Unknown'


def load_default_model():
    """Helper to load model from `models/` folder next to this file.

    Expects `best_model_finetuned.h5` and class mapping pickle in the folder.
    """
    base = os.path.join(os.path.dirname(__file__), 'models')
    model_file = os.path.join(base, 'best_model_finetuned.h5')
    # Try several common class-mapping filenames to be flexible
    candidate_class_files = [
        'classes_info.pkl',
        'classes.pkl',
        'class_info.pkl',
        'classess_info.pkl',
        'classes_info.pickle',
        'classes.pickle'
    ]

    classes_file = None
    for fname in candidate_class_files:
        path = os.path.join(base, fname)
        if os.path.exists(path):
            classes_file = path
            break

    return MLModel(model_file, classes_file)
