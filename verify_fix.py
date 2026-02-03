import unittest
from unittest.mock import patch, mock_open
import re

# Mocking the setup_config function logic roughly, or testing the regex directly.
# Since we modified the logic inside the function, let's extract the core logic to test it,
# or simulate the file constraints.

class TestEnvParsing(unittest.TestCase):
    def test_regex_matching(self):
        """Test the regex used in app.py"""
        
        # Test API_URL
        line1 = "API_URL=http://example.com"
        line2 = "API_URL = http://example.com"
        line3 = "  API_URL  =  http://example.com"
        
        regex = r'^\s*API_URL\s*='
        
        self.assertTrue(re.match(regex, line1), "Standard format failed")
        self.assertTrue(re.match(regex, line2), "Spaced format failed")
        self.assertTrue(re.match(regex, line3), "Indented/Spaced format failed")
        self.assertFalse(re.match(regex, "#API_URL=..."), "Commented line matched incorrecty")
        
        print("\n[PASS] Regex logic verified.")

if __name__ == '__main__':
    unittest.main()
