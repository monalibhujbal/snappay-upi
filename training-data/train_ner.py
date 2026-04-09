from datasets import load_dataset
from transformers import AutoTokenizer, AutoModelForTokenClassification, TrainingArguments, Trainer
from transformers import DataCollatorForTokenClassification
import numpy as np

# Map our tags
id2label = {
    0: "O",
    1: "B-MERCHANT",
    2: "I-MERCHANT",
    3: "B-AMOUNT",
    4: "I-AMOUNT",
    5: "B-TXN_ID",
    6: "I-TXN_ID",
    7: "B-UPI_ID",
    8: "I-UPI_ID"
}
label2id = {v: k for k, v in id2label.items()}

model_checkpoint = "distilbert-base-uncased"

def tokenize_and_align_labels(examples):
    tokenizer = AutoTokenizer.from_pretrained(model_checkpoint)
    tokenized_inputs = tokenizer(examples["tokens"], truncation=True, is_split_into_words=True)

    labels = []
    for i, label in enumerate(examples["ner_tags"]):
        word_ids = tokenized_inputs.word_ids(batch_index=i)
        previous_word_idx = None
        label_ids = []
        for word_idx in word_ids:
            if word_idx is None:
                label_ids.append(-100)
            elif word_idx != previous_word_idx:
                label_ids.append(label[word_idx])
            else:
                label_ids.append(label[word_idx])
            previous_word_idx = word_idx
        labels.append(label_ids)

    tokenized_inputs["labels"] = labels
    return tokenized_inputs

def main():
    print("Loading datasets...")
    dataset = load_dataset("json", data_files={"train": "train.jsonl", "test": "test.jsonl"})
    
    tokenizer = AutoTokenizer.from_pretrained(model_checkpoint)
    
    print("Tokenizing data...")
    tokenized_datasets = dataset.map(tokenize_and_align_labels, batched=True)
    
    model = AutoModelForTokenClassification.from_pretrained(
        model_checkpoint,
        id2label=id2label,
        label2id=label2id,
    )
    
    data_collator = DataCollatorForTokenClassification(tokenizer=tokenizer)
    
    training_args = TrainingArguments(
        output_dir="./ner-upi-model",
        evaluation_strategy="epoch",
        learning_rate=2e-5,
        per_device_train_batch_size=16,
        per_device_eval_batch_size=16,
        num_train_epochs=3,
        weight_decay=0.01,
        save_strategy="epoch",
        push_to_hub=False,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_datasets["train"],
        eval_dataset=tokenized_datasets["test"],
        tokenizer=tokenizer,
        data_collator=data_collator,
    )

    print("Starting training...")
    trainer.train()
    
    print("Saving model...")
    trainer.save_model("./ner-upi-model-final")
    print("Training complete! Model saved to ./ner-upi-model-final")

if __name__ == "__main__":
    main()
