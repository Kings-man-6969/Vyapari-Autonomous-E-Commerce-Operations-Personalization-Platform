import unittest
import math
from src.main import compute_embedding, apply_percentile_normalization

class TestRecommendationService(unittest.TestCase):
    def test_compute_embedding_dimensions(self):
        emb = compute_embedding("Handcrafted Kashmiri Silk Saree")
        self.assertEqual(len(emb), 384)
        norm = math.sqrt(sum(x * x for x in emb))
        self.assertAlmostEqual(norm, 1.0, places=1)

    def test_percentile_normalization(self):
        items = [
            {"id": "1", "similarity": 0.95},
            {"id": "2", "similarity": 0.80},
            {"id": "3", "similarity": 0.50},
        ]
        norm_items = apply_percentile_normalization(items, "similarity")
        self.assertEqual(len(norm_items), 3)
        self.assertEqual(norm_items[0]["percentile_score"], 1.0)
        self.assertEqual(norm_items[1]["percentile_score"], 0.5)
        self.assertEqual(norm_items[2]["percentile_score"], 0.0)

    def test_percentile_normalization_single_item(self):
        items = [{"id": "1", "similarity": 0.95}]
        norm_items = apply_percentile_normalization(items, "similarity")
        self.assertEqual(norm_items[0]["percentile_score"], 1.0)

    def test_percentile_normalization_empty(self):
        self.assertEqual(apply_percentile_normalization([]), [])

if __name__ == "__main__":
    unittest.main()
