import ssl
ssl._create_default_https_context = ssl._create_unverified_context

from fastapi import FastAPI, UploadFile, File, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Any, Dict, List
import easyocr
import re
import cv2
import numpy as np
from PIL import Image
import io

app = FastAPI(title="Legal Metrology Rule 6 & Rule 9 Compliance Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Deep Learning EasyOCR Model
reader = easyocr.Reader(['en'])

# In-memory storage for offline synced inspection records
synced_inspections: List[Dict[str, Any]] = []

# ─── Category keyword → human-readable category label ─────────────────────────
CATEGORY_MAP = {
    "oil": "Edible Oil",
    "dal": "Pulses / Dal",
    "pulses": "Pulses / Dal",
    "lentil": "Pulses / Dal",
    "detergent": "Detergent / Washing Powder",
    "washing powder": "Detergent / Washing Powder",
    "soap": "Personal Care / Soap",
    "biscuit": "Biscuits & Bakery",
    "cookie": "Biscuits & Bakery",
    "wafer": "Biscuits & Bakery",
    "bread": "Biscuits & Bakery",
    "snack": "Packaged Snacks",
    "chips": "Packaged Snacks",
    "namkeen": "Packaged Snacks",
    "atta": "Flour / Atta",
    "flour": "Flour / Atta",
    "rice": "Grains / Rice",
    "rava": "Grains / Rice",
    "suji": "Grains / Rice",
    "tea": "Beverage / Tea",
    "coffee": "Beverage / Coffee",
    "milk": "Dairy / Milk",
    "ghee": "Dairy / Ghee",
    "butter": "Dairy / Butter",
    "paneer": "Dairy / Paneer",
    "curd": "Dairy / Curd",
    "cream": "Dairy / Cream",
    "spice": "Spices / Masala",
    "masala": "Spices / Masala",
    "noodle": "Noodles / Pasta",
    "pasta": "Noodles / Pasta",
    "chocolate": "Confectionery / Chocolate",
    "candy": "Confectionery / Chocolate",
    "juice": "Beverages / Juice",
    "beverage": "Beverages / Juice",
    "shampoo": "Personal Care / Shampoo",
    "toothpaste": "Personal Care / Oral Care",
    "lotion": "Personal Care / Skin Care",
    "sanitizer": "Personal Care / Sanitizer",
    "handwash": "Personal Care / Handwash",
    "cereal": "Breakfast Cereals",
    "flakes": "Breakfast Cereals",
    "salt": "Condiments / Salt",
    "sugar": "Condiments / Sugar",
    "honey": "Condiments / Honey",
    "jam": "Condiments / Jam",
    "sauce": "Condiments / Sauce",
    "ketchup": "Condiments / Sauce",
    "mayonnaise": "Condiments / Mayonnaise",
}


def sanitize_ocr_text(text: str) -> str:
    """Strip common EasyOCR noise characters while preserving alphanumerics and key punctuation."""
    # Keep alphanumerics, spaces, and meaningful punctuation used in declarations
    sanitized = re.sub(r'[^a-zA-Z0-9\s@.,/:₹\-&\(\)%]', ' ', text)
    # Collapse multiple whitespace to a single space
    sanitized = re.sub(r'\s+', ' ', sanitized).strip()
    return sanitized


def detect_category(sanitized_text_lower: str) -> str:
    """Return the best-matching human-readable product category from CATEGORY_MAP."""
    for keyword, label in CATEGORY_MAP.items():
        if re.search(rf'\b{re.escape(keyword)}s?\b', sanitized_text_lower):
            return label
    return "General Packaged Commodity"


class InspectionRecord(BaseModel):
    id: Optional[str] = None
    product_name: Optional[str] = None
    status: Optional[str] = None
    details: Optional[Any] = None
    created_at: Optional[str] = None


def preprocess_image(image_bytes: bytes):
    """Reflective Glare Reduction and Contrast Enhancement via OpenCV"""
    np_img = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("Invalid or unsupported image file.")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    denoised = cv2.bilateralFilter(gray, 9, 75, 75)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)

    return enhanced


def check_rule_6_compliance(extracted_blocks: List[Dict[str, Any]]):
    """
    Enforces Statutory Rules (Rule 6) and Font Size Mandate (Rule 9)
    of Legal Metrology (Packaged Commodities) Rules, 2011.
    Extracts real product data from raw OCR blocks.
    """
    # Sanitize each OCR block text before any processing to remove noise characters
    raw_lines = [sanitize_ocr_text(b["text"]) for b in extracted_blocks if sanitize_ocr_text(b.get("text", ""))]
    full_text = " ".join(raw_lines)
    text_lower = full_text.lower()

    # Detect product category from the sanitized OCR text
    detected_category = detect_category(text_lower)

    # ─────────────────────────────────────────────────────────────────────────
    # 1. Detect Real Brand / Product Name
    # In packaging, PDP brand/product title is in the largest prominent font
    title_candidates = []
    for b in extracted_blocks:
        txt = b.get("text", "").strip()
        h_px = b.get("height_px", 0)
        y_pos = b.get("y_pos", 0)
        # Exclude pure numeric, punctuation, or statutory keywords
        if len(txt) >= 3 and not re.match(r'^[\d\s.,/:#-]+$', txt):
            txt_l = txt.lower()
            if not any(k in txt_l for k in [
                "mrp", "mfg", "mfd", "mlg", "mid by", "pkd", "net wt", "net qty",
                "netquantity", "batch", "lic", "fssai", "exp", "rs.", "rs ", "₹",
                "ingredient", "consumer care", "consumei", "toll free", "manufactured by",
                "packed by", "100g", "nutrition", "usp", "price", "origin", "country",
                "helpline", "customercare", "care@", "@"
            ]):
                title_candidates.append((h_px, y_pos, txt))

    # Prioritize larger font height, then topmost position on PDP (lower y_pos)
    title_candidates.sort(key=lambda x: (x[0], -x[1]), reverse=True)
    detected_product_name = title_candidates[0][2] if title_candidates else "Scanned Package Sample"

    # Explicit product name label if present
    prod_label_match = re.search(
        r'(?:product|commodity|generic name|item name|name of commodity)\s*[:.-]\s*([A-Za-z0-9\s&\'\-]+)',
        full_text,
        re.IGNORECASE
    )
    if prod_label_match:
        explicit_name = prod_label_match.group(1).strip()
        if len(explicit_name) >= 3:
            detected_product_name = explicit_name

    # ─────────────────────────────────────────────────────────────────────────
    # 2. Rule 6(1)(a) / 6(1)(b): Commodity Common / Generic Name
    generic_keywords = [
        "biscuit", "cookie", "cookies", "soap", "oil", "food", "snack", "flour",
        "atta", "rice", "powder", "beverage", "noodle", "noodles", "chips",
        "wafer", "detergent", "shampoo", "toothpaste", "tea", "coffee",
        "cereal", "flakes", "chocolate", "butter", "ghee", "milk", "cream",
        "spices", "masala", "salt", "sugar", "juice", "drink", "water",
        "sauce", "ketchup", "jam", "honey", "pulse", "dal", "lotion",
        "deodorant", "cleaner", "namkeen", "bread", "pasta", "handwash",
        "sanitizer", "conditioner", "paneer", "curd", "mayonnaise"
    ]
    generic_matches = [w for w in generic_keywords if re.search(rf'\b{w}s?\b', text_lower)]
    detected_generic = None
    if generic_matches:
        for line in raw_lines:
            if any(w in line.lower() for w in generic_matches):
                detected_generic = line
                break

    comm_name_text = detected_generic or detected_product_name
    comm_detected = bool(generic_matches or detected_product_name != "Scanned Package Sample")

    # ─────────────────────────────────────────────────────────────────────────
    # 3. Rule 6(1)(c): Net Quantity (Weight / Measure / Volume / Count)
    net_qty_match = re.search(
        r'(?:(?:net\s*(?:quantity|qty|wt\.?|weight)|netquantity|quantity|content|net\s*mass)\s*[:.-]?\s*)?(\b\d+(?:\.\d+)?\s*(?:kg|g|gm|gms|gram|grams|ml|milli\s*litre|milliliters?|l|lt|ltr|litres?|liters?|u|units?|pieces?|pcs?|n)\b)',
        full_text,
        re.IGNORECASE
    )
    if net_qty_match:
        net_qty_text = net_qty_match.group(1).strip()
        net_qty_detected = True
    else:
        # Fallback search for standalone weight patterns
        standalone_qty = re.findall(r'\b\d+(?:\.\d+)?\s*(?:kg|g|gm|gms|ml|l|ltr)\b', text_lower)
        if standalone_qty:
            net_qty_text = standalone_qty[0]
            net_qty_detected = True
        else:
            net_qty_text = "NOT DETECTED"
            net_qty_detected = False

    # ─────────────────────────────────────────────────────────────────────────
    # 4. Rule 6(1)(e) / Rule 6(1)(da): Maximum Retail Price (MRP)
    mrp_match = re.search(
        r'(?:m\.?r\.?p\.?|max(?:imum)?\s*retail\s*price|retail\s*price)\s*[:.-]?\s*(?:(?:rs\.?|₹|inr)\s*)?(\d+(?:\.\d{1,2})?)(?:\s*(?:/-|\.00))?',
        full_text,
        re.IGNORECASE
    )
    if not mrp_match:
        mrp_match = re.search(r'(?:rs\.?|₹)\s*(\d+(?:\.\d{1,2})?)', full_text, re.IGNORECASE)

    if mrp_match:
        mrp_val = mrp_match.group(1).strip()
        incl_taxes = any(k in text_lower for k in ["incl", "taxes", "tax"])
        mrp_text = f"₹{mrp_val}" + (" (incl. of all taxes)" if incl_taxes else "")
        mrp_detected = True
    else:
        mrp_text = "NOT DETECTED"
        mrp_detected = False

    # ─────────────────────────────────────────────────────────────────────────
    # 5. Rule 6(1)(s): Unit Sale Price (USP)
    usp_match = re.search(
        r'(?:(?:usp|unit\s*(?:sale|retail)?\s*price)\s*[:.-]?\s*)?(?:rs\.?|₹)?\s*(\d+(?:\.\d{1,2})?)\s*(?:per|/)\s*(\d*\s*(?:g|gm|kg|ml|l|ltr|100g|100ml|u|unit|n|piece|pcs))',
        full_text,
        re.IGNORECASE
    )
    if usp_match:
        usp_text = f"₹{usp_match.group(1)}/{usp_match.group(2)}"
        usp_detected = True
    else:
        # Check if USP with single value exists e.g. "USP Rs 0.85"
        usp_single = re.search(r'(?:usp|unit\s*sale\s*price)\s*[:.-]?\s*(?:rs\.?|₹)?\s*(\d+(?:\.\d{1,2})?)', full_text, re.IGNORECASE)
        if usp_single:
            usp_text = f"₹{usp_single.group(1)}/unit"
            usp_detected = True
        else:
            usp_alt = re.findall(r'(?:rs\.?|₹)\s*\d+(?:\.\d+)?\s*(?:per|/)\s*(?:100g|100ml|g|kg|ml|l)', text_lower)
            if usp_alt:
                usp_text = usp_alt[0]
                usp_detected = True
            else:
                usp_text = "NOT DETECTED"
                usp_detected = False

    # ─────────────────────────────────────────────────────────────────────────
    # 6. Rule 6(1)(d): Month & Year of Mfg / Packing
    mfg_match = re.search(
        r'(?:m[fl][gd]|mfg|mlg|pkd|pkg|packed|manufactured|date\s*of\s*(?:mfg|pkd|packing)|mfg\s*date|pkd\s*date|date)\s*[:.-]?\s*([0-9]{1,2}[/.,-][0-9]{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[,\s.-]+[0-9]{2,4}|[0-9]{1,2}\s+[a-z]{3,}\s+[0-9]{2,4})',
        full_text,
        re.IGNORECASE
    )
    if mfg_match:
        mfg_text = mfg_match.group(1).replace(',', '/').replace('.', '/').strip()
        mfg_detected = True
    else:
        standalone_date = re.search(r'\b(0[1-9]|1[0-2])[/.,-](20\d\d|\d\d)\b', full_text)
        if standalone_date:
            mfg_text = standalone_date.group(0).replace(',', '/').replace('.', '/').strip()
            mfg_detected = True
        else:
            mfg_text = "NOT DETECTED"
            mfg_detected = False

    # ─────────────────────────────────────────────────────────────────────────
    # 7. Rule 6(1)(a): Manufacturer / Packer Details
    mfr_match = None
    mfr_line_idx = -1
    mfr_triggers = [
        "manufactured by", "mfd by", "mfg by", "mlg by", "mid by", "packed by", "pkd by",
        "marketed by", "imported by", "mfg at", "packer", "pvt ltd", "private limited",
        "ltd.", "lid", "llp", "industries ltd", "federation", "cooperative", "co-operative"
    ]
    for i, line in enumerate(raw_lines):
        if any(trig in line.lower() for trig in mfr_triggers):
            mfr_line_idx = i
            break

    if mfr_line_idx != -1:
        combined_mfr = [raw_lines[mfr_line_idx]]
        for nxt in raw_lines[mfr_line_idx + 1: mfr_line_idx + 3]:
            # Stop if the line begins another statutory declaration
            if any(stop_k in nxt.lower() for stop_k in [
                "consumer care", "consumei", "toll free", "mrp", "net wt", "net qty",
                "netquantity", "batch", "fssai", "country of origin", "country", "made in", "best before"
            ]):
                break
            if re.search(r'\b\d{6}\b|road|street|nagar|plot|phase|industrial|dist|state|india|floor|sector|anand', nxt, re.IGNORECASE):
                combined_mfr.append(nxt)
            elif len(combined_mfr) == 1 and len(nxt) > 5 and not any(k in nxt.lower() for k in ["mrp", "net wt", "batch", "fssai", "care", "origin"]):
                combined_mfr.append(nxt)
        mfr_text = ", ".join(combined_mfr)
        mfr_detected = True
    else:
        mfr_text = "NOT DETECTED"
        mfr_detected = False

    # ─────────────────────────────────────────────────────────────────────────
    # 8. Rule 6(1)(h) / Rule 6(1)(n): Consumer Care Redressal Details
    care_items = []
    # Toll-free or phone numbers (handles 1800-xxx-xxxx, 1800 xxx, etc.)
    phone_matches = re.findall(
        r'(?:1800[\s-]?\d{2,4}[\s-]?\d{3,4}|1800[\s-]?\d{4,8}|(?:\+?91[\s-]?)?[2-9]\d{2,4}[\s-]?\d{6,8})',
        full_text
    )
    if phone_matches:
        care_items.append(f"Helpline: {phone_matches[0]}")

    # Email
    email_matches = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', full_text)
    if email_matches:
        care_items.append(f"Email: {email_matches[0]}")
    elif re.search(r'\b[a-zA-Z0-9._%+-]+(?:\s*@\s*|o)(?:[a-zA-Z0-9.-]+)\.com\b', full_text, re.IGNORECASE):
        cleaned_email = re.search(r'\b[a-zA-Z0-9._%+-]+(?:\s*@\s*|o)(?:[a-zA-Z0-9.-]+)\.com\b', full_text, re.IGNORECASE).group(0)
        cleaned_email = re.sub(r'\s*@\s*', '@', cleaned_email)
        care_items.append(f"Contact: {cleaned_email}")

    if care_items:
        care_text = " | ".join(care_items)
        care_detected = True
    elif re.search(r'(?:consumer|customer|consumei)\s*(?:care|cale|cell|service|redressal|helpline)|grievance', text_lower):
        care_text = "Consumer Care cell declared on package"
        care_detected = True
    else:
        care_text = "NOT DETECTED"
        care_detected = False

    # ─────────────────────────────────────────────────────────────────────────
    # 9. Rule 6(1)(n) / Rule 6(1)(e): Country of Origin
    origin_detected = False
    origin_text = "NOT DETECTED"
    origin_match = re.search(
        r'(?:country\s*of\s*origin|origin|made\s*in|product\s*of|produced\s*in)\s*[:.-]?\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)?)',
        full_text,
        re.IGNORECASE
    )
    if origin_match:
        country = origin_match.group(1).strip()
        origin_text = f"Made in {country}" if "made" not in country.lower() else country
        origin_detected = True
    elif "india" in text_lower:
        origin_text = "Made in India"
        origin_detected = True
    else:
        for c in ["germany", "usa", "italy", "china", "japan", "thailand", "uk", "france", "vietnam", "korea"]:
            if c in text_lower:
                origin_text = f"Country of Origin: {c.title()}"
                origin_detected = True
                break

    # ─────────────────────────────────────────────────────────────────────────
    # 10. Rule 9 Mandate: Minimum Font Size Declaration Analysis
    font_heights_mm = [
        float(b["height_mm"])
        for b in extracted_blocks
        if b.get("height_mm", 0) > 0
    ]
    avg_font_height_mm = (
        float(round(sum(font_heights_mm) / len(font_heights_mm), 1))
        if font_heights_mm else 0.0
    )
    min_font_compliant = bool(avg_font_height_mm >= 1.0)

    # Compile declarations
    rules = [
        {
            "id": "rule_6_1_a_commodity",
            "rule": "Rule 6(1)(a)",
            "title": "Commodity Common Name",
            "detected": comm_detected,
            "extractedText": comm_name_text
        },
        {
            "id": "rule_6_1_c_netqty",
            "rule": "Rule 6(1)(c)",
            "title": "Net Quantity",
            "detected": net_qty_detected,
            "extractedText": net_qty_text
        },
        {
            "id": "rule_6_1_e_mrp",
            "rule": "Rule 6(1)(e)",
            "title": "Maximum Retail Price (MRP)",
            "detected": mrp_detected,
            "extractedText": mrp_text
        },
        {
            "id": "rule_6_1_s_usp",
            "rule": "Rule 6(1)(s)",
            "title": "Unit Sale Price",
            "detected": usp_detected,
            "extractedText": usp_text
        },
        {
            "id": "rule_6_1_d_mfg",
            "rule": "Rule 6(1)(d)",
            "title": "Date of Packing / Mfg",
            "detected": mfg_detected,
            "extractedText": mfg_text
        },
        {
            "id": "rule_6_1_a_mfr",
            "rule": "Rule 6(1)(a)",
            "title": "Manufacturer / Packer Details",
            "detected": mfr_detected,
            "extractedText": mfr_text
        },
        {
            "id": "rule_6_1_h_care",
            "rule": "Rule 6(1)(h)",
            "title": "Consumer Care Details",
            "detected": care_detected,
            "extractedText": care_text
        },
        {
            "id": "rule_6_1_n_origin",
            "rule": "Rule 6(1)(n)",
            "title": "Country of Origin",
            "detected": origin_detected,
            "extractedText": origin_text
        },
        {
            "id": "rule_9_font_size",
            "rule": "Rule 9 Mandate",
            "title": "Minimum Declaration Height",
            "detected": min_font_compliant,
            "extractedText": f"Estimated Avg Font Height: {avg_font_height_mm}mm"
        }
    ]

    total_passed = sum(1 for r in rules if r["detected"])
    compliance_score = int(round((total_passed / len(rules)) * 100))

    violations = []
    for r in rules:
        if not r["detected"]:
            violations.append(
                f"Statutory contravention under {r['rule']}: {r['title']} absent or unreadable on package."
            )

    is_compliant = bool(compliance_score == 100)

    return {
        # productName carries the detected category (e.g. "Edible Oil", "Grains / Rice")
        # so the UI can display a meaningful category title instead of raw OCR noise
        "productName": str(detected_category),
        "genericName": str(comm_name_text),
        "category": str(detected_category),
        "overallStatus": "COMPLIANT" if is_compliant else "NON_COMPLIANT",
        "complianceScore": int(compliance_score),
        "rulesPassed": f"{int(total_passed)}/{int(len(rules))}",
        "violations": violations,
        "fontSizeAnalysis": {
            "avgFontHeightMm": float(avg_font_height_mm),
            "rule9Passed": bool(min_font_compliant),
            "detectedBlocks": extracted_blocks[:5]
        },
        "declarations": [
            {
                "id": str(r["id"]),
                "rule": str(r["rule"]),
                "title": str(r["title"]),
                "detected": bool(r["detected"]),
                "extractedText": r["extractedText"]
            }
            for r in rules
        ],
        "rawExtractedText": str(full_text)
    }


# ─────────────────────────────────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.head("/api/v1/inspect")
@app.get("/api/v1/inspect")
async def inspect_probe():
    """Health / reachability probe used by offline-sync module and client."""
    return {"status": "healthy", "service": "legal_metrology_inspection_engine"}


@app.get("/health")
@app.get("/api/v1/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/api/v1/inspect")
async def inspect_package(image: UploadFile = File(...)):
    """Accepts package photograph, performs EasyOCR and extracts Legal Metrology declarations."""
    contents = await image.read()
    processed_img = preprocess_image(contents)

    # detail=1 returns [(bbox, text, confidence)]
    raw_results = reader.readtext(processed_img, detail=1)

    extracted_blocks = []
    for bbox, text, prob in raw_results:
        pixel_height = float(abs(bbox[2][1] - bbox[0][1]))
        estimated_mm = float(round(pixel_height * 0.26, 1))

        extracted_blocks.append({
            "text": str(text),
            "height_px": int(pixel_height),
            "height_mm": estimated_mm,
            "y_pos": int(bbox[0][1]),
            "confidence": float(prob)
        })

    return check_rule_6_compliance(extracted_blocks)


@app.post("/api/v1/inspections")
async def sync_inspection(record: InspectionRecord):
    """Receives offline inspection records synced from mobile SQLite database."""
    item = record.model_dump() if hasattr(record, 'model_dump') else record.dict()
    synced_inspections.append(item)
    return {
        "status": "success",
        "message": "Inspection recorded successfully",
        "id": record.id,
        "total_synced": len(synced_inspections)
    }


@app.get("/api/v1/inspections")
async def get_inspections():
    """Retrieves all synced inspections."""
    return {
        "count": len(synced_inspections),
        "inspections": synced_inspections
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)