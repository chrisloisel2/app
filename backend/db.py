"""
db.py — instance MongoClient globale partagée par toute l'application.
Importez `mongo` ou utilisez get_col() / get_db() selon vos besoins.
"""
from pymongo import MongoClient
from config import MONGODB_URI

mongo: MongoClient = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)


def get_db(name: str = "physical_data"):
    return mongo[name]


def get_col(db: str = "physical_data", collection: str = ""):
    return mongo[db][collection]
