import app
import ctypes
import os
import unittest
from unittest.mock import patch, MagicMock

class TestPermissionCheck(unittest.TestCase):
    @patch('app.get_base_path')
    @patch('builtins.open')
    @patch('os.remove')
    def test_check_write_permission_success(self, mock_remove, mock_open, mock_get_base_path):
        """Test standard success case"""
        mock_get_base_path.return_value = 'C:\\Simulated\\Path'
        # Simulates successful open/write
        app.check_write_permission()
        mock_open.assert_called()
        mock_remove.assert_called()
        print("\n[PASS] Write permission check passed successfully.")

    @patch('app.get_base_path')
    @patch('builtins.open')
    @patch('ctypes.windll.user32.MessageBoxW')
    @patch('sys.exit')
    def test_check_write_permission_failure(self, mock_exit, mock_msgbox, mock_open, mock_get_base_path):
        """Test failure case (read-only)"""
        mock_get_base_path.return_value = 'C:\\Program Files\\Protected'
        # Simulate PermissionError
        mock_open.side_effect = PermissionError("Access denied")
        
        # Expect sys.exit(1)
        app.check_write_permission()
        
        mock_msgbox.assert_called_with(
            0, 
            u"無法寫入檔案！\n\n請不要將此程式放在 'C:\\Program Files' 或其他受保護的資料夾。\n"
            u"建議：請將 .exe 移至【桌面】或【我的文件】重新執行。", 
            u"權限錯誤 (Permission Error)", 
            0x10 | 0x1
        )
        mock_exit.assert_called_with(1)
        print("\n[PASS] Write permission check correctly caught failure and showed message box.")

if __name__ == '__main__':
    # Need to mock os.name to 'nt' to ensure message box logic runs if we are not on windows (though we are)
    with patch('os.name', 'nt'):
        unittest.main()
