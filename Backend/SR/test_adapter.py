import json
import os
import socket
import threading
import time
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import uvicorn
from main import app

class AdapterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.previous_token = os.environ.get("RECOMMENDER_TOKEN")
        os.environ["RECOMMENDER_TOKEN"] = "test-internal-token"
        cls.sock = socket.socket()
        cls.sock.bind(("127.0.0.1", 0))
        cls.url = f"http://127.0.0.1:{cls.sock.getsockname()[1]}"
        cls.server = uvicorn.Server(uvicorn.Config(app, log_level="error"))
        cls.thread = threading.Thread(target=cls.server.run, kwargs={"sockets": [cls.sock]}, daemon=True)
        cls.thread.start()
        for _ in range(100):
            if cls.server.started:
                return
            time.sleep(0.05)
        raise RuntimeError("El adaptador no inició")

    @classmethod
    def tearDownClass(cls):
        cls.server.should_exit = True
        cls.thread.join(timeout=5)
        cls.sock.close()
        if cls.previous_token is None:
            os.environ.pop("RECOMMENDER_TOKEN", None)
        else:
            os.environ["RECOMMENDER_TOKEN"] = cls.previous_token

    def send(self, payload, token="test-internal-token"):
        request = Request(self.url + "/recommend", data=json.dumps(payload).encode(),
                          headers={"Content-Type": "application/json", "Authorization": "Bearer " + token})
        with urlopen(request, timeout=3) as response:
            return json.load(response)

    def payload(self):
        return {"version": "1", "query": "Jóvenes", "preferences": {"activities": ["Jóvenes"]}, "candidates": [{
            "churchId": "000000000000000000000101", "score": 0.75,
            "components": {"doctrine": 1, "distance": 0.5},
            "identification": {"name": "Comunidad ficticia"}, "doctrine": {}, "community": {"activities": ["Jóvenes"]},
            "sources": [{"id": "000000000000000000000201", "title": "Documento", "text": "Actividades declaradas"}]
        }]}

    def test_http_contract_without_claiming_rag(self):
        response = self.send(self.payload())
        self.assertEqual(response["engine"], "baseline")
        self.assertEqual(response["results"][0]["churchId"], "000000000000000000000101")
        self.assertEqual(response["results"][0]["sourceIds"], [])
        self.assertIn("no se interpreta", response["results"][0]["explanation"])

    def test_rejects_invalid_internal_token(self):
        with self.assertRaises(HTTPError) as error:
            self.send(self.payload(), token="wrong")
        self.assertEqual(error.exception.code, 401)
        error.exception.close()

    def test_rejects_invalid_score_and_unknown_fields(self):
        payload = self.payload()
        payload["candidates"][0]["score"] = 2
        with self.assertRaises(HTTPError) as error:
            self.send(payload)
        self.assertEqual(error.exception.code, 422)
        error.exception.close()
        payload = self.payload()
        payload["password"] = "should-not-be-sent"
        with self.assertRaises(HTTPError) as error:
            self.send(payload)
        self.assertEqual(error.exception.code, 422)
        error.exception.close()

    def test_empty_candidates(self):
        payload = self.payload()
        payload["candidates"] = []
        self.assertEqual(self.send(payload)["results"], [])

if __name__ == "__main__":
    unittest.main()
