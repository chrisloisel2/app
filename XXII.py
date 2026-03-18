import json
import logging
import os
import shutil
import sys
import zipfile
from pathlib import Path

import requests
from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import (
    QApplication,
    QDialog,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QVBoxLayout,
)

logging.basicConfig(level=logging.INFO)


def get_cache_temp_data() -> str:
    cache_dir = os.path.join(os.getcwd(), "cache_temp")
    os.makedirs(cache_dir, exist_ok=True)
    return cache_dir


def clean_meta_cache() -> None:
    meta_file = os.path.join(get_cache_temp_data(), "meta_cache.json")
    if os.path.exists(meta_file):
        os.remove(meta_file)


def write_meta_cache(field: str, value) -> None:
    meta_file = os.path.join(get_cache_temp_data(), "meta_cache.json")
    data = {}
    if os.path.exists(meta_file):
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = {}

    data[field] = value

    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def remove_zip_extension(filename: str) -> str:
    return filename[:-4] if filename.lower().endswith(".zip") else filename


def show_info_msg(message: str) -> None:
    print(message)


def download_from_url(signed_url: str, output_file: str) -> str | None:
    try:
        with requests.get(signed_url, stream=True, timeout=30) as response:
            response.raise_for_status()
            with open(output_file, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
        return output_file
    except requests.RequestException as e:
        show_info_msg(f":x: Download failed: {e}")
        return None


class ServerClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.headers = {"Content-Type": "application/json"}
        self.login: str | None = None
        self.password: str | None = None

        self.download_folder = get_cache_temp_data()
        os.makedirs(self.download_folder, exist_ok=True)

    def set_credentials(self, login: str, password: str) -> None:
        self.login = login
        self.password = password

    def release_credentials(self) -> None:
        self.login = None
        self.password = None

    def upload_data(
        self,
        endpoint: str = "/pd/upload",
        reject_session: bool | None = None,
        folder_path: str | None = None,
    ) -> bool:
        data_path = folder_path or self.get_folder_in_temp()
        if not data_path:
            show_info_msg(":warning: No data to upload")
            return False

        file_name = Path(data_path).name

        if (not self.login) or (not self.password):
            self.show_login_window()
            if (not self.login) or (not self.password):
                logging.error(":x: Login failed or cancelled.")
                self.release_credentials()
                return False

        payload = {
            "username": self.login,
            "password": self.password,
            "repo_id": file_name,
            "filename": f"{file_name}.zip",
        }
        if reject_session is not None:
            payload["reject_session"] = reject_session

        try:
            signed_url_response = self.session.post(
                url=f"{self.base_url}{endpoint}",
                json=payload,
                headers=self.headers,
                timeout=10,
            )
        except requests.RequestException as e:
            show_info_msg(f":x: Connection error: {e}")
            self.release_credentials()
            return False

        print("STATUS:", signed_url_response.status_code)
        print("TEXT:", signed_url_response.text)

        if signed_url_response.status_code != 200:
            try:
                error_description = signed_url_response.json().get(
                    "error", "Unknown error"
                )
            except Exception:
                error_description = signed_url_response.text
            show_info_msg(f":x: {error_description}")
            self.release_credentials()
            return False

        response_json = signed_url_response.json()

        # DOC: la clé de retour est "url"
        signed_url = response_json.get("url")
        if not signed_url:
            show_info_msg(":x: No upload URL received from server.")
            return False

        subtitle_path_to_upload = data_path
        subtitle_path_to_upload_zip = os.path.join(
            self.download_folder, f"{file_name}.zip"
        )

        try:
            with zipfile.ZipFile(
                subtitle_path_to_upload_zip,
                "w",
                zipfile.ZIP_DEFLATED,
            ) as zipf:
                for root, dirs, files in os.walk(subtitle_path_to_upload):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, subtitle_path_to_upload)
                        zipf.write(file_path, arcname=arcname)
        except Exception as e:
            show_info_msg(f":x: Zip creation failed: {e}")
            return False

        try:
            with open(subtitle_path_to_upload_zip, "rb") as f:
                response = self.session.put(
                    signed_url,
                    data=f,
                    headers={"Content-Type": "application/zip"},
                    timeout=30,
                )
        except requests.RequestException as e:
            show_info_msg(f":x: Upload request failed: {e}")
            return False

        if response.status_code in (200, 201, 204):
            logging.info(f"Upload successful: {subtitle_path_to_upload_zip}")
        else:
            show_info_msg(
                f":warning: Upload failed {response.status_code}: {response.text}"
            )
            return False

        try:
            os.remove(subtitle_path_to_upload_zip)
        except OSError:
            pass

        return True

    def get_folder_in_temp(self) -> str | None:
        cache_dir = get_cache_temp_data()
        return next(
            (
                os.path.join(cache_dir, folder)
                for folder in os.listdir(cache_dir)
                if os.path.isdir(os.path.join(cache_dir, folder))
            ),
            None,
        )

    def show_login_window(self) -> None:
        dialog = QDialog()
        dialog.setWindowTitle("Login")
        dialog.setMinimumSize(300, 180)

        layout = QVBoxLayout()
        layout.setSpacing(10)
        layout.setContentsMargins(20, 20, 20, 20)

        login_label = QLabel("Login:")
        login_label.setStyleSheet("font-weight: bold;")
        layout.addWidget(login_label)

        login_edit = QLineEdit()
        login_edit.setPlaceholderText("Enter your login")
        login_edit.setStyleSheet("padding: 5px;")
        layout.addWidget(login_edit)

        password_label = QLabel("Password:")
        password_label.setStyleSheet("font-weight: bold;")
        layout.addWidget(password_label)

        password_edit = QLineEdit()
        password_edit.setEchoMode(QLineEdit.EchoMode.Password)
        password_edit.setPlaceholderText("Enter your password")
        password_edit.setStyleSheet("padding: 5px;")
        layout.addWidget(password_edit)

        button_layout = QHBoxLayout()
        button_layout.addStretch()

        ok_button = QPushButton("OK")
        ok_button.setCursor(Qt.CursorShape.PointingHandCursor)
        ok_button.setStyleSheet(
            "QPushButton {"
            "    background-color: #4CAF50;"
            "    color: white;"
            "    border: none;"
            "    padding: 8px 16px;"
            "    border-radius: 4px;"
            "}"
            "QPushButton:hover {"
            "    background-color: #45A049;"
            "}"
        )
        ok_button.clicked.connect(dialog.accept)
        button_layout.addWidget(ok_button)

        layout.addLayout(button_layout)
        dialog.setLayout(layout)

        if dialog.exec() == QDialog.DialogCode.Accepted:
            login = login_edit.text()
            password = password_edit.text()
            if login and password:
                self.set_credentials(login, password)


def create_fake_data_for_upload() -> None:
    cache_dir = get_cache_temp_data()
    repo_dir = os.path.join(cache_dir, "demo_repo")
    os.makedirs(repo_dir, exist_ok=True)

    with open(os.path.join(repo_dir, "subtitle_001.txt"), "w", encoding="utf-8") as f:
        f.write("Ceci est un fichier de test.\n")

    with open(os.path.join(repo_dir, "subtitle_002.txt"), "w", encoding="utf-8") as f:
        f.write("Deuxième fichier de test.\n")


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python XXII.py <path_to_folder>")
        sys.exit(1)

    folder_path = sys.argv[1]
    if not os.path.isdir(folder_path):
        print(f"Error: '{folder_path}' is not a valid directory")
        sys.exit(1)

    app = QApplication(sys.argv)

    client = ServerClient(base_url="http://13.62.206.125:5001")
    client.set_credentials("pd_umi", "sqiu763hQP1")

    print("=== TEST UPLOAD ===")
    try:
        success = client.upload_data(endpoint="/pd/upload", folder_path=folder_path)
        print(f"Upload success: {success}")
    except Exception as e:
        print(f"Upload exception: {e}")

    sys.exit(0)


if __name__ == "__main__":
    main()
