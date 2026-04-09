import zipfile
import re
import sys

def extract_text_from_docx(docx_path):
    try:
        with zipfile.ZipFile(docx_path) as docx:
            xml_content = docx.read('word/document.xml').decode('utf-8')
            # Replace paragraph tags with newlines
            text = re.sub(r'<w:p [^>]*>', '\n', xml_content)
            text = re.sub(r'<w:p>', '\n', text)
            # Remove all other XML tags
            text = re.sub(r'<[^>]+>', '', text)
            print(text)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    extract_text_from_docx('UPI SnapPay.docx')
