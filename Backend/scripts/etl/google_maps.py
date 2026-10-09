"""XLSX Google Maps -> NDJSON Koinonía. No escribe en MongoDB ni modifica el Excel."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import unicodedata
from urllib.parse import parse_qs, urlsplit

VERSION = "koinonia.church-import.v1"
DAYS = dict(zip(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
                ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]))
COMMUNES = ["Santiago", "Cerrillos", "Cerro Navia", "Conchalí", "El Bosque", "Estación Central", "Huechuraba", "Independencia",
            "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Las Condes", "Lo Barnechea", "Lo Espejo", "Lo Prado",
            "Macul", "Maipú", "Ñuñoa", "Pedro Aguirre Cerda", "Peñalolén", "Providencia", "Pudahuel", "Quilicura", "Quinta Normal",
            "Recoleta", "Renca", "San Joaquín", "San Miguel", "San Ramón", "Vitacura", "Puente Alto", "Pirque", "San José de Maipo",
            "Colina", "Lampa", "Tiltil", "San Bernardo", "Buin", "Calera de Tango", "Paine", "Melipilla", "Alhué", "Curacaví",
            "María Pinto", "San Pedro", "Talagante", "El Monte", "Isla de Maipo", "Padre Hurtado", "Peñaflor"]
ACCEPT_CATEGORIES = {"catholic cathedral", "parish", "chapel", "basilica", "church of christ",
                     "jehovah's witness kingdom hall", "church of jesus christ of latter-day saints (mormon)"}
EXCLUDE_CATEGORIES = {"book publisher", "book store", "christian book store", "store", "park", "bus stop", "packaging company",
                      "university", "faith school", "catholic school", "educational institution", "television studio", "garden",
                      "club", "housing complex", "housing development", "hostel", "synagogue"}
RELIGIOUS_NAME = re.compile(r"\b(iglesia|church|parroquia|capilla|basilica|catedral|templo|ministerio|congregacion|cristian\w*|evangel\w*|pentecost\w*|bautista|adventista|metodista|presbiteriana|catolica|cristo|santuario|monasterio|convento|testigos)\b")

def clean(value):
    if value is None:
        return ""
    return " ".join(unicodedata.normalize("NFKC", str(value)).split())

def audit_value(value):
    # Las filas rechazadas también deben poder guardarse como JSON válido para revisión.
    if isinstance(value, float) and not math.isfinite(value):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return value

def fold(value):
    return "".join(c for c in unicodedata.normalize("NFD", clean(value).casefold()) if not unicodedata.combining(c))

def valid_url(value):
    value = clean(value)
    if not value:
        return None
    try:
        parsed = urlsplit(value)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password or re.search(r"\s", value):
            return None
        return value
    except ValueError:
        return None

def normalize_phone(value):
    value = clean(value)
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    if len(digits) == 9:
        digits = "56" + digits
    if len(digits) == 11 and digits.startswith("56"):
        return "+" + digits
    return None

def minute(value, default_period=None):
    match = re.fullmatch(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?", value.strip(), re.I)
    if not match:
        raise ValueError("hour_format")
    hour, minutes, period = int(match[1]), int(match[2] or 0), (match[3] or default_period)
    if not 1 <= hour <= 12 or not 0 <= minutes <= 59 or not period:
        raise ValueError("hour_range")
    return (hour % 12 + (12 if period.upper() == "PM" else 0)) * 60 + minutes

def time_text(value):
    return f"{value // 60:02d}:{value % 60:02d}"

def parse_hours(day, raw):
    day = DAYS.get(clean(day), clean(day))
    if day not in DAYS.values():
        raise ValueError("unknown_day")
    raw = clean(raw)
    result = {"day": day, "raw": raw, "intervals": []}
    if fold(raw) in {"closed", "cerrado"}:
        return {**result, "status": "closed"}
    if fold(raw) in {"open 24 hours", "abierto las 24 horas"}:
        return {**result, "status": "open24h"}
    try:
        for item in raw.split(","):
            parts = re.split(r"\s+to\s+", item.strip(), flags=re.I)
            if len(parts) != 2:
                raise ValueError("hour_interval")
            start_text, end_text = parts
            end = minute(end_text)
            if re.search(r"[AP]M", start_text, re.I):
                start = minute(start_text)
            else:
                # Google omite AM/PM inicial. Se elige el intervalo positivo más corto.
                options = [minute(start_text, period) for period in ["AM", "PM"]]
                options = [start for start in options if 0 < (end - start) % 1440 <= 720]
                if not options:
                    raise ValueError("ambiguous_hours")
                start = min(options, key=lambda x: (end - x) % 1440)
            if start == end:
                raise ValueError("zero_interval")
            result["intervals"].append({"startTime": time_text(start), "endTime": time_text(end), "endDayOffset": int(end < start)})
        return {**result, "status": "intervals"}
    except ValueError:
        return {**result, "status": "unparsed", "intervals": []}

def commune_from(row):
    canonical = {fold(c): c for c in COMMUNES}
    canonical["nunoa"] = "Ñuñoa"
    # Solo segmentos administrativos completos: nunca buscar nombres dentro de la calle.
    tokens = clean(row.get("city")).split(",") + clean(row.get("address")).split(",")[1:]
    found = []
    for token in tokens:
        key = fold(re.sub(r"^\s*\d+\s*", "", token))
        if key in canonical and canonical[key] not in found:
            found.append(canonical[key])
    specific = [c for c in found if c != "Santiago"]
    if len(specific) > 1:
        return None
    return specific[0] if specific else ("Santiago" if "Santiago" in found else None)

def classify(title, categories):
    keys = {fold(c) for c in categories}
    named = bool(RELIGIOUS_NAME.search(fold(title)))
    church_category = any(k == "church" or k.endswith(" church") or k in ACCEPT_CATEGORIES for k in keys)
    if keys & EXCLUDE_CATEGORIES:
        if named or church_category:
            return "review", "conflicting_category_and_name"
        return "excluded", "not_a_community_category"
    if church_category:
        if keys <= {"church"} and not named:
            return "review", "generic_category_ambiguous_name"
        return "accepted", "explicit_church_category"
    return "review", "community_type_requires_review"

def transform(row, row_number, source_file, batch_id):
    issues, fatal = [], []
    title = clean(row.get("title"))
    address = clean(row.get("address"))
    categories = list(dict.fromkeys(clean(row.get(k)) for k in ["categoryName", "categories/0", "categories/1"] if clean(row.get(k))))
    disposition, reason = classify(title, categories)
    maps_url = valid_url(row.get("url"))
    place_id = parse_qs(urlsplit(maps_url or "").query).get("query_place_id", [None])[0]
    if not place_id or not re.fullmatch(r"[A-Za-z0-9_-]{5,200}", place_id):
        fatal.append("missing_or_invalid_place_id")
    if not title:
        fatal.append("missing_title")
    if not address:
        fatal.append("missing_address")
    try:
        lat, lng = float(row["location/lat"]), float(row["location/lng"])
        if not (math.isfinite(lat) and math.isfinite(lng) and -90 <= lat <= 90 and -180 <= lng <= 180) or (lat == 0 and lng == 0):
            raise ValueError()
    except (TypeError, ValueError, KeyError):
        fatal.append("invalid_coordinates")
        lat = lng = None
    commune = commune_from(row)
    if not commune:
        fatal.append("missing_or_ambiguous_commune")
    # La localidad procede del texto del proveedor, no de una validación por polígonos.
    issues.append("commune_from_source_not_geographically_verified")
    if commune and commune != "Santiago":
        issues.append("specific_commune_review_coordinates")
    captured = clean(row.get("scrapedAt"))
    try:
        date = datetime.fromisoformat(captured.replace("Z", "+00:00"))
        if date.tzinfo is None:
            raise ValueError()
        captured = date.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    except ValueError:
        fatal.append("invalid_capture_date")
    location = {"address": address, "commune": commune, "region": "Región Metropolitana de Santiago", "countryCode": "CL",
                "coordinates": {"type": "Point", "coordinates": [lng, lat]}}
    # Este adaptador cubre el export de la Región Metropolitana; otros territorios requieren otro mapeo.
    if fold(row.get("state")) not in {"santiago metropolitan region", "region metropolitana", "region metropolitana de santiago"}:
        fatal.append("unsupported_region")
    raw_city = clean(row.get("city"))
    location["city"] = "Santiago" if "santiago" in fold(raw_city).split(", ") else (commune or raw_city)
    postal = clean(row.get("postalCode"))
    if postal and re.fullmatch(r"\d{7}", postal):
        location["postalCode"] = postal
    elif postal:
        issues.append("invalid_postal_code_omitted")
    contact = {}
    phone = normalize_phone(row.get("phone"))
    if phone:
        contact["phone"] = phone
    elif clean(row.get("phone")):
        issues.append("invalid_phone_omitted")
    website = valid_url(row.get("website"))
    if website:
        host = urlsplit(website).hostname.lower()
        key = next((name for name in ["instagram", "facebook", "youtube"] if host == name + ".com" or host.endswith("." + name + ".com")), "website")
        contact[key] = website
    elif clean(row.get("website")):
        issues.append("invalid_website_omitted")
    hours, seen_days = [], set()
    for i in range(7):
        day, raw = row.get(f"openingHours/{i}/day"), row.get(f"openingHours/{i}/hours")
        if not clean(day) and not clean(raw):
            continue
        try:
            parsed = parse_hours(day, raw)
            if parsed["day"] in seen_days:
                issues.append("duplicate_opening_day_omitted")
                continue
            seen_days.add(parsed["day"])
            hours.append(parsed)
            if parsed["status"] == "unparsed":
                issues.append("unparsed_opening_hours")
        except ValueError:
            issues.append("invalid_opening_day_omitted")
    church = {"identification": {"name": title}, "verification": {"source": "google_maps", "authorized": False}, "location": location,
              "externalProfile": {"provider": "google_maps", "placeId": place_id, "mapsUrl": maps_url, "sourceTitle": title,
                                  "categories": categories, "sourceAddress": address, "sourceCity": raw_city,
                                  "capturedAt": captured, "openingHours": hours}}
    if contact:
        church["contact"] = contact
    if clean(row.get("description")):
        church["identification"]["description"] = clean(row["description"])
        issues.append("description_from_maps_not_institutional")
    if clean(row.get("subTitle")):
        church["externalProfile"]["subtitle"] = clean(row["subTitle"])
    record = {"schemaVersion": VERSION, "externalKey": "google_maps:" + (place_id or f"invalid-row-{row_number}"),
              "provenance": {"batchId": batch_id, "sourceFile": source_file, "sourceRow": row_number, "issues": sorted(set(issues))}, "church": church}
    if fatal:
        disposition, reason = "rejected", ";".join(fatal)
    return record, disposition, reason

def run(input_path, output_path):
    import openpyxl
    input_path, output_path = Path(input_path), Path(output_path)
    workbook = openpyxl.load_workbook(input_path, read_only=True, data_only=True)
    sheet = workbook["Data"] if "Data" in workbook.sheetnames else workbook.active
    values = sheet.iter_rows(values_only=True)
    headers = next(values)
    required = {"title", "address", "city", "state", "location/lat", "location/lng", "url", "scrapedAt"}
    if not required <= set(headers) or len(headers) != len(set(headers)):
        raise ValueError("Faltan columnas requeridas o hay encabezados repetidos")
    digest = hashlib.sha256(input_path.read_bytes()).hexdigest()
    batch_id = "google_maps_" + digest[:16]
    items, raw_rows = [], {}
    for number, values in enumerate(values, 2):
        if all(v is None for v in values):
            continue
        row = dict(zip(headers, values))
        raw_rows[number] = row
        record, status, reason = transform(row, number, input_path.name, batch_id)
        items.append({"record": record, "status": status, "reason": reason})
    workbook.close()
    # Mismo ID: conserva la captura más reciente. IDs distintos nunca se fusionan automáticamente.
    by_key = defaultdict(list)
    for item in items:
        if item["status"] != "rejected":
            by_key[item["record"]["externalKey"]].append(item)
    for group in by_key.values():
        group.sort(key=lambda x: (x["record"]["church"]["externalProfile"]["capturedAt"], -x["record"]["provenance"]["sourceRow"]), reverse=True)
        for duplicate in group[1:]:
            duplicate["status"], duplicate["reason"] = "duplicate", "same_place_id_older_or_repeated"
    positions, names = defaultdict(list), defaultdict(list)
    for item in items:
        if item["status"] not in {"rejected", "duplicate"}:
            church = item["record"]["church"]
            positions[tuple(church["location"]["coordinates"]["coordinates"])].append(item)
            names[fold(church["identification"]["name"])].append(item)
    for group in positions.values():
        if len(group) > 1:
            for item in group:
                item["record"]["provenance"]["issues"].append("shared_coordinates_review_duplicate")
    for group in names.values():
        if len(group) > 1:
            for item in group:
                item["record"]["provenance"]["issues"].append("repeated_name_review_duplicate")
    output_path.mkdir(parents=True, exist_ok=True)
    def write_lines(name, objects):
        with (output_path / name).open("w", encoding="utf-8", newline="\n") as stream:
            for obj in objects:
                stream.write(json.dumps(obj, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n")
    accepted = [i["record"] for i in items if i["status"] == "accepted"]
    write_lines("churches.import.ndjson", accepted)
    # Archivo de revisión: contiene la fila original para corregir sin perder evidencia.
    write_lines("review.ndjson", [{"disposition": i["status"], "reason": i["reason"], "record": i["record"],
                                   "original": {key: audit_value(value) for key, value in raw_rows[i["record"]["provenance"]["sourceRow"]].items()}} for i in items if i["status"] != "accepted"])
    dispositions = Counter(i["status"] for i in items)
    coverage = {key: sum(bool(r["church"].get("contact", {}).get(key)) for r in accepted) for key in ["phone", "website", "facebook", "instagram", "youtube"]}
    coverage["openingHours"] = sum(bool(r["church"]["externalProfile"]["openingHours"]) for r in accepted)
    report = {"schemaVersion": VERSION, "batchId": batch_id, "sourceFile": input_path.name, "sourceSha256": digest,
              "sheet": sheet.title, "inputRows": len(items), "dispositions": dict(dispositions), "acceptedCoverage": coverage,
              "issues": dict(Counter(issue for i in items for issue in i["record"]["provenance"]["issues"])),
              "reasons": dict(Counter(i["reason"] for i in items)),
              "records": [{"row": i["record"]["provenance"]["sourceRow"], "externalKey": i["record"]["externalKey"],
                           "name": i["record"]["church"]["identification"]["name"], "disposition": i["status"], "reason": i["reason"],
                           "issues": i["record"]["provenance"]["issues"]} for i in items]}
    (output_path / "quality-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = ["# Limpieza Google Maps — Koinonía", "", f"Origen: {input_path.name}; hoja {sheet.title}.", "",
             f"Filas originales: {len(items)}. Importables: {len(accepted)}.", "", "| Resultado | Filas |", "|---|---:|"]
    lines += [f"| {key} | {value} |" for key, value in sorted(dispositions.items())]
    lines += ["", "## Cobertura del conjunto importable", "", "| Campo | Registros |", "|---|---:|"]
    lines += [f"| {key} | {value} |" for key, value in coverage.items()]
    lines += ["", "## Criterios", "", "- No se deducen doctrina, liderazgo, idiomas, ministerios ni autorización institucional.",
              "- Las categorías externas permanecen en externalProfile; no se convierten en denominación declarada.",
              "- Horarios de apertura separados de meetings. Se conservan el texto original, cierres, 24 horas y cruces de medianoche.",
              "- Los prefijos AM/PM omitidos se interpretan como el intervalo positivo más corto de hasta 12 horas; revisar el original antes de publicar.",
              "- Comuna tomada del texto del proveedor, sin validación territorial por polígonos. Nunoa se normaliza a Ñuñoa.",
              "- Los lugares de categorías ajenas o ambiguas se conservan en review.ndjson con su fila original y motivo.",
              "- Una categoría Church sin un nombre reconocible como comunidad requiere revisión; no se decide por teología.",
              "- Se deduplica solo por placeId. Nombres o coordenadas compartidas generan alertas, no fusiones.",
              "- El dataset es una captura histórica: capturedAt proviene de scrapedAt, no de la fecha de limpieza.",
              "- Todos se importan en borrador por defecto. Publicación de prueba solo con opción explícita en base _demo.",
              "", "El informe JSON incluye conciliación fila por fila y huella SHA-256 del archivo original."]
    (output_path / "RESUMEN.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"inputRows": len(items), "dispositions": dict(dispositions), "acceptedCoverage": coverage}, ensure_ascii=False))
    return report

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    run(args.input, args.output)
