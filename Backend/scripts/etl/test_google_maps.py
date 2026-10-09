import unittest
from google_maps import audit_value, classify, commune_from, normalize_phone, parse_hours, transform, valid_url

class EtlTests(unittest.TestCase):
    def sample(self):
        return {"title": "Iglesia de prueba", "categoryName": "Church", "address": "Calle 100, 8330000 Santiago, Región Metropolitana, Chile",
                "city": "Santiago", "state": "Santiago Metropolitan Region", "location/lat": -33.45, "location/lng": -70.65,
                "url": "https://www.google.com/maps/search/?api=1&query_place_id=ChIJ_test_example", "scrapedAt": "2026-05-18T18:08:42.733Z"}

    def test_opening_hours_not_meetings_and_missing_data_not_fabricated(self):
        row = self.sample()
        row.update({"openingHours/0/day": "Monday", "openingHours/0/hours": "11\u202fAM to 1:30\u202fPM, 3:30 to 7\u202fPM"})
        record, status, _ = transform(row, 2, "example.xlsx", "test-batch")
        self.assertEqual(status, "accepted")
        self.assertEqual(record["church"]["location"]["coordinates"]["coordinates"], [-70.65, -33.45])
        self.assertFalse(record["church"]["verification"]["authorized"])
        self.assertNotIn("meetings", record["church"])
        self.assertNotIn("christianIdentity", record["church"])
        self.assertEqual(record["church"]["externalProfile"]["openingHours"][0]["intervals"][1]["startTime"], "15:30")

    def test_noon_midnight_closed_and_24_hours(self):
        self.assertEqual(parse_hours("Monday", "11 to 1 PM")["intervals"][0], {"startTime": "11:00", "endTime": "13:00", "endDayOffset": 0})
        self.assertEqual(parse_hours("Monday", "12 to 6 AM")["intervals"][0]["startTime"], "00:00")
        self.assertEqual(parse_hours("Monday", "7 PM to 12 AM")["intervals"][0]["endDayOffset"], 1)
        self.assertEqual(parse_hours("Monday", "6 AM to 1:15 AM")["intervals"][0]["endDayOffset"], 1)
        self.assertEqual(parse_hours("Monday", "Closed")["status"], "closed")
        self.assertEqual(parse_hours("Monday", "Open 24 hours")["status"], "open24h")

    def test_unparseable_hours_preserve_original(self):
        hours = parse_hours("Monday", "By appointment")
        self.assertEqual(hours["status"], "unparsed")
        self.assertEqual(hours["raw"], "By appointment")
        self.assertEqual(hours["intervals"], [])

    def test_normalized_contact_without_inventing_missing_values(self):
        self.assertEqual(normalize_phone("+56 2 2638 3189"), "+56226383189")
        self.assertIsNone(normalize_phone(""))
        self.assertIsNone(normalize_phone("123"))
        self.assertIsNone(valid_url("javascript:alert(1)"))
        self.assertIsNone(valid_url("https://user:password@example.org/"))

    def test_commune_from_locality_not_from_street_name(self):
        self.assertEqual(commune_from({"city": "Nunoa, Santiago", "address": "Ossa 750, Nunoa, Santiago, Chile"}), "Ñuñoa")
        self.assertEqual(commune_from({"city": "Santiago", "address": "Av. Providencia 100, Santiago, Chile"}), "Santiago")
        self.assertIsNone(commune_from({"city": "Ñuñoa, San Miguel", "address": "Calle 1"}))

    def test_quarantine_ambiguous_places_and_no_theological_exclusion(self):
        self.assertEqual(classify("Plaza de prueba", ["Park"])[0], "excluded")
        self.assertEqual(classify("Paradero Iglesia San Pedro", ["Bus stop"])[0], "review")
        self.assertEqual(classify("Juan Pérez", ["Church"])[0], "review")
        self.assertEqual(classify("Kingdom Hall", ["Jehovah's Witness Kingdom Hall"])[0], "accepted")
        self.assertEqual(classify("Iglesia Cristiana", ["Spiritist center"])[0], "review")

    def test_rejects_invalid_coordinates_and_unknown_identity(self):
        row = self.sample()
        row["location/lat"] = float("nan")
        row["url"] = "https://www.google.com/maps/"
        _, status, reason = transform(row, 2, "test.xlsx", "test")
        self.assertEqual(status, "rejected")
        self.assertIn("invalid_coordinates", reason)
        self.assertIn("missing_or_invalid_place_id", reason)
        self.assertEqual(audit_value(float("nan")), "nan")

if __name__ == "__main__":
    unittest.main()
