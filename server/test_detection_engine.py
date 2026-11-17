import unittest

from detection_engine import get_group, should_keep_world_detection


class WorldDetectionTests(unittest.TestCase):
    def test_world_classes_use_accessible_groups(self):
        self.assertEqual(get_group("cabinet"), "Furniture")
        self.assertEqual(get_group("idol statue"), "Shrine")
        self.assertEqual(get_group("box on the floor"), "Obstacle")
        self.assertEqual(get_group("remote control"), "Electronic")

    def test_world_confidence_thresholds_filter_weak_and_unknown_labels(self):
        self.assertTrue(should_keep_world_detection("TV stand", 0.45))
        self.assertFalse(should_keep_world_detection("TV stand", 0.449))
        self.assertFalse(should_keep_world_detection("wardrobe", 0.99))


if __name__ == "__main__":
    unittest.main()
