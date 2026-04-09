import json
import random
import re

# Indian names for synthetic data
NAMES = [
    "Rahul Sharma", "Priya Patel", "Amit Singh", "Neha Gupta", "Ravi Kumar",
    "Pooja Verma", "Sanjay Reddy", "Kavita Desai", "Vikram Malhotra", "Meera Joshi",
    "Soham Gajanan Misal", "Ashvini Bhure", "Latabai", "Monali Bhujbal", "Shrey Rai"
]

MERCHANTS = [
    "Blinkit", "EatClub", "PMPML", "PUNE METRO CCA DR WA", 
    "YOGITA FRUITS AND VEGETABLES", "Swiggy", "Zomato", "Uber", "Ola"
]

def generate_random_amount():
    return str(random.randint(10, 5000)) + ".00"

def generate_txn_id():
    # Typically 12 digits for bank txn / UPI Ref ID
    return str(random.randint(100000000000, 999999999999))

def generate_upi_id(name):
    # e.g., rahul@okhdfcbank
    cleaned_name = re.sub(r'[^a-zA-Z]', '', name).lower()
    suffix = random.choice(["@okhdfcbank", "@okicici", "@ybl", "@ibl", "@paytm"])
    return f"{cleaned_name}{random.randint(1,999)}{suffix}"

# Define tag mapping
TAG2ID = {
    "O": 0,
    "B-MERCHANT": 1,
    "I-MERCHANT": 2,
    "B-AMOUNT": 3,
    "I-AMOUNT": 4,
    "B-TXN_ID": 5,
    "I-TXN_ID": 6,
    "B-UPI_ID": 7,
    "I-UPI_ID": 8
}

def create_synthetic_receipt():
    is_person = random.choice([True, False])
    name = random.choice(NAMES) if is_person else random.choice(MERCHANTS)
    amount = generate_random_amount()
    txn_id = generate_txn_id()
    upi_id = generate_upi_id(name)
    
    # Introduce random OCR variations
    rupee_symbol = random.choice(["₹", "Rs.", "INR ", "€", "xz "]) # Tesseract often misreads ₹
    paid_prefix = random.choice(["Paid to", "Paying", "Transferred to", "Sent to"])
    
    templates = [
        # GPay style
        [
            (paid_prefix.split(), "O"),
            (name.split(), "MERCHANT"),
            ([rupee_symbol + amount], "AMOUNT"),
            (["UPI", "transaction", "ID"], "O"),
            ([txn_id], "TXN_ID"),
            (["To:", upi_id], "UPI_ID") # actually "To:" is O, "upi_id" is UPI_ID
        ],
        # Paytm style
        [
            (["Sent", "Rupees", amount, "successfully", "to"], "AMOUNT"), # Wait, "Sent Rupees successfully to" is mixed
            ([name], "MERCHANT"),
            (["UPI", "Ref", "No:", txn_id], "TXN_ID"),
        ]
    ]
    
    # Let's construct it token by token for precise BIO tagging
    tokens = []
    ner_tags = []
    
    # GPay Style Generator
    def add_tokens(words, tag_type):
        for i, word in enumerate(words):
            tokens.append(word)
            if tag_type == "O":
                ner_tags.append(TAG2ID["O"])
            else:
                prefix = "B-" if i == 0 else "I-"
                ner_tags.append(TAG2ID[prefix + tag_type])

    # Add random noise at the top
    if random.random() > 0.5:
        add_tokens(["14:32", "LTE", "4G"], "O")
        
    add_tokens(paid_prefix.split(), "O")
    add_tokens(name.split(), "MERCHANT")
    
    # Amount block with potential OCR noise and spaces
    add_tokens([rupee_symbol], "O") 
    add_tokens([amount], "AMOUNT")
    
    # Add status
    add_tokens(["Successful"], "O")
    
    add_tokens(["UPI", "transaction", "ID"], "O")
    
    # OCR sometimes splits the Txn ID into two
    if random.random() > 0.8:
        add_tokens([txn_id[:6]], "TXN_ID")
        add_tokens([txn_id[6:]], "TXN_ID") # Technically I-TXN_ID logic handled in add_tokens needs an array
    else:
        add_tokens([txn_id], "TXN_ID")
        
    add_tokens(["Paid", "to"], "O")
    add_tokens([upi_id], "UPI_ID")
    
    # Add random noise at the bottom
    if random.random() > 0.5:
        add_tokens(["POWERED", "BY", "YES", "BANK"], "O")
        
    return {"tokens": tokens, "ner_tags": ner_tags}

def generate_dataset(num_samples=1000, output_file="synthetic_data.jsonl"):
    data = []
    for _ in range(num_samples):
        # 10% chance of inserting entirely random text to make O tags robust
        if random.random() < 0.1:
            tokens = ["Random", "receipt", "junk", str(random.randint(100, 999)), "xyz"]
            ner_tags = [0] * len(tokens)
            data.append({"tokens": tokens, "ner_tags": ner_tags})
        else:
            data.append(create_synthetic_receipt())
            
    with open(output_file, 'w', encoding='utf-8') as f:
        for item in data:
            f.write(json.dumps(item) + '\n')
            
    print(f"Generated {num_samples} synthetic receipts at {output_file}")

if __name__ == "__main__":
    generate_dataset(1500, "train.jsonl")
    generate_dataset(300, "test.jsonl")
