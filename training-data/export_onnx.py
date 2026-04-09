from optimum.onnxruntime import ORTModelForTokenClassification
from transformers import AutoTokenizer
import os

model_path = "./ner-upi-model-final"
export_path = "../public/models/ner-upi"

def main():
    print(f"Loading fine-tuned model from {model_path}...")
    
    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    
    # Load model and export to ONNX graph
    model = ORTModelForTokenClassification.from_pretrained(model_path, export=True)
    
    # Create the public directory if it doesn't exist
    os.makedirs(export_path, exist_ok=True)
    
    print(f"Saving ONNX model and tokenizer to {export_path}...")
    tokenizer.save_pretrained(export_path)
    model.save_pretrained(export_path)
    
    print("Export complete! The Nuxt app can now useTransformers.js from the public folder.")

if __name__ == "__main__":
    main()
