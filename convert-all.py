# Modify Date: 2021-12-03


import sqlite3
import os
import subprocess
import logging


logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')

print = logging.info


class FileDatabase:
    def __init__(self, db_name):
        self.db_name = db_name
        self.conn = sqlite3.connect(db_name)
        self.c = self.conn.cursor()
        self.create_table()
        self.type_list = [".mp4", ".wmv"]

    def clean_status(self):
        self.conn.execute(
            "UPDATE files SET converting = false AND transfering = false;")
        self.conn.commit()

    def create_table(self):
        self.c.execute('''CREATE TABLE IF NOT EXISTS files (
                            path TEXT PRIMARY KEY,
                            done BOOLEAN NOT NULL DEFAULT false,
                            converting BOOLEAN NOT NULL DEFAULT false,
                            transfering BOOLEAN NOT NULL DEFAULT false);
                            ''')

    def add_file(self, path):
        self.c.execute(
            "INSERT OR IGNORE INTO files (path) VALUES (?)", (path,))
        self.conn.commit()

    def get_files(self):
        self.c.execute("SELECT * FROM files")
        return self.c.fetchall()

    def mark_done(self, path):
        self.c.execute("UPDATE files SET done = true WHERE path = ?", (path,))
        self.conn.commit()

    def mark_converting(self, path):
        self.c.execute(
            "UPDATE files SET converting = true WHERE path = ?", (path,))
        self.conn.commit()

    def mark_done_converting(self, path):
        self.c.execute(
            "UPDATE files SET converting = false WHERE path = ?", (path,))
        self.conn.commit()

    def mark_transfering(self, path):
        self.c.execute(
            "UPDATE files SET transfering = true WHERE path = ?", (path,))
        self.conn.commit()

    def mark_done_transfering(self, path):
        self.c.execute(
            "UPDATE files SET transfering = false WHERE path = ?", (path,))
        self.conn.commit()

    def total_files(self):
        self.c.execute("SELECT COUNT(*) FROM files")
        return self.c.fetchone()[0]

    def not_done(self):
        self.c.execute("SELECT COUNT(*) FROM files WHERE done = false")
        return self.c.fetchone()[0]

    def fetch_one(self):
        self.c.execute(
            "SELECT * FROM files WHERE done = false AND converting = false AND transfering = false ORDER BY path LIMIT 1;")
        return self.c.fetchone()

    def walk(self, path):
        for root, _, files in os.walk(path):
            for file in files:
                for type in self.type_list:
                    if file.endswith(type):
                        self.add_file(os.path.join(root, file))


def run_ffmpeg(filename):
    process = subprocess.run(["ffmpeg", "-i", filename, "-c:v", "libx265",
                              "-c:a", "libopus", "-ab", "64k", "-y", filename + ".mkv"],
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    if process.returncode != 0:
        print("Error: " + filename)


def formatFilesize(size):
    if size < 1024:
        return str(round(size, 2)) + " B"
    elif size < 1024 * 1024:
        return str(round(size / 1024, 2)) + " KB"
    elif size < 1024 * 1024 * 1024:
        return str(round(size / 1024 / 1024, 2)) + " MB"
    else:
        return str(round(size / 1024 / 1024 / 1024, 2)) + " GB"


if __name__ == "__main__":
    args = os.sys.argv

    dbname = "files.db"

    walk = not os.path.exists(dbname)

    db = FileDatabase(dbname)

    if walk:
        tmpDb = FileDatabase(":memory:")
        tmpDb.walk(".")
        tmpDb.conn.backup(db.conn)
        print("Generate database with {} files".format(tmpDb.total_files()))
        exit(0)

    if len(args) > 1:
        if args[1] == "clean":
            db.clean_status()
            print("Clean status")
            exit(0)
        elif args[1] == "list":
            print("Total files: {}".format(db.total_files()))
            print("Not done: {}".format(db.not_done()))
            print("Converting files: {}".format(db.c.execute(
                "SELECT COUNT(*) FROM files WHERE converting = true").fetchone()[0]))
            print("Done: {}".format(db.total_files() - db.not_done()))
            exit(0)
        elif args[1] == "delete":
            files = db.get_files()
            for file in files:
                if file[1] == 1:
                    os.remove(file[0])
                    print("Delete: {}".format(file[0]))
            exit(0)

    while True:
        file = db.fetch_one()
        if file is None:
            break

        db.mark_converting(file[0])
        print("{}/{} {}".format(db.not_done(), db.total_files(),
              formatFilesize(os.path.getsize(file[0]))))
        run_ffmpeg(file[0])

        print("Size change: {}% {} -> {}".format(
            round(os.path.getsize(file[0] + ".mkv") /
                  os.path.getsize(file[0]) * 100),
            formatFilesize(os.path.getsize(file[0])),
            formatFilesize(os.path.getsize(file[0] + ".mkv"))))

        db.mark_done(file[0])
        db.mark_done_converting(file[0])

    print("Done")
