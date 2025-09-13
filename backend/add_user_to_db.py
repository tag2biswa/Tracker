import sqlite3
from passlib.context import CryptContext

# Database path
DB_PATH = "time_tracker.db"

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def add_user_to_db(username: str, password: str):
    """
    Adds a user to the database with a hashed password.
    """
    hashed_password = pwd_context.hash(password)

    # Connect to the database
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    try:
        # Insert the user into the users table
        cur.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, hashed_password))
        conn.commit()
        print(f"User '{username}' added successfully!")
    except sqlite3.IntegrityError:
        print(f"Error: Username '{username}' already exists!")
    finally:
        conn.close()

if __name__ == "__main__":
    # Input username and password
    username = input("Enter username: ")
    password = input("Enter password: ")

    # Add user to the database
    add_user_to_db(username, password)